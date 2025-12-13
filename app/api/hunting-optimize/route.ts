// app/api/hunting-optimize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// 🔹 Supabase Postgres용 Pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

// ---- 타입들 ----

type JobGroup = "ALL" | "WARRIOR" | "MAGE" | "THIEF" | "ARCHER" | "PIRATE";

type EquipmentSlotKey =
  | "반지1"
  | "반지2"
  | "반지3"
  | "반지4"
  | "펜던트"
  | "펜던트2"
  | "눈장식"
  | "얼굴장식"
  | "귀고리";

type SlotGroup = "RING" | "PENDANT" | "EYE" | "FACE" | "EARRING";

type ClientSlotEquipment = {
  slot: EquipmentSlotKey;
  itemName?: string | null;
  dropPct: number;
  mesoPct: number;
  useForHunting: boolean;
};

type RequestBody = {
  characterName: string;
  equipment: ClientSlotEquipment[];
  targetDrop: number;
  targetMeso: number;
  excludeKarma: boolean;
  jobGroup: JobGroup; // 프론트에서 전달
  lockedItemNames?: string[]; // ✅ 추가: 고정 사용 체크된 아이템 이름들
};

type DbItemRow = {
  id: number;
  name: string;
  slot_group: SlotGroup;
  equip_unique_group: string;
  job_group: JobGroup;
  karma_scissors: 0 | 1;
  drop_pct: number;
  meso_pct: number;
  price: number;
  date: string;
};

type Candidate = {
  name: string;
  slot: EquipmentSlotKey;
  slotGroup: SlotGroup;
  uniqueGroup: string;
  finalDrop: number;
  finalMeso: number;
  deltaDrop: number;
  deltaMeso: number;
  price: number;
};

type RecommendedItem = {
  slot: EquipmentSlotKey;
  name: string;
  dropPct: number;
  mesoPct: number;
  price: number;
};

type OptimizationResult = {
  itemsToBuy: RecommendedItem[];
  totalPrice: number;
  finalDrop: number;
  finalMeso: number;
};

type PrecomputedCaseRow = {
  number_list: number[];
};

// 프리컴퓨트 슬롯 패턴 키
type SlotsKey = "ALL_SLOTS" | "NO_PENDANT1" | "NO_PENDANT2" | "NONE";

// ---- 슬롯 매핑 ----

const SLOT_TO_GROUP: Record<EquipmentSlotKey, SlotGroup> = {
  반지1: "RING",
  반지2: "RING",
  반지3: "RING",
  반지4: "RING",
  펜던트: "PENDANT",
  펜던트2: "PENDANT",
  눈장식: "EYE",
  얼굴장식: "FACE",
  귀고리: "EARRING",
};

const SLOT_ORDER: EquipmentSlotKey[] = [
  "얼굴장식",
  "눈장식",
  "귀고리",
  "반지1",
  "반지2",
  "반지3",
  "반지4",
  "펜던트",
  "펜던트2",
];

// 🔹 슬롯 그룹별 (drop, meso) 조합당 최대 개수
const LIMIT_PER_SLOT_GROUP: Record<SlotGroup, number> = {
  RING: 6,
  PENDANT: 4,
  EYE: 3,
  FACE: 3,
  EARRING: 3,
};

// ✅ (추가) lockedItemNames -> 제외할 equip_unique_group 목록 만들기
async function buildExcludedUniqueGroups(lockedItemNames?: string[]) {
  const names = (lockedItemNames ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  const extraGroups: string[] = [];

  // ✅ 예외: "여명의 가디언 엔젤 링" 고정 시, unique_group "가디언 엔젤 링"도 제외
  if (names.includes("여명의 가디언 엔젤 링")) {
    extraGroups.push("가디언 엔젤 링");
  }

  if (names.length === 0 && extraGroups.length === 0) {
    return [];
  }

  // name으로 unique_group 조회 (날짜/슬롯그룹 상관없이 DISTINCT로 뽑음)
  // - 같은 name이 여러 date에 있어도 동일 unique_group이면 문제 없음
  let dbGroups: string[] = [];
  if (names.length > 0) {
    const q = await pool.query(
      `
        SELECT DISTINCT equip_unique_group
        FROM drop_meso
        WHERE name = ANY($1::text[])
      `,
      [names]
    );

    dbGroups = (q.rows ?? [])
      .map((r: any) => r?.equip_unique_group)
      .filter((v: any) => typeof v === "string" && v.trim().length > 0);
  }

  // 합쳐서 중복 제거
  const set = new Set<string>([...dbGroups, ...extraGroups]);
  return Array.from(set);
}

// ---- 공통: 최신 날짜 + 후보 불러오기 (drop_meso) ----

async function loadCandidatesForSlot(
  slot: EquipmentSlotKey,
  jobGroup: JobGroup | null,
  excludeKarma: boolean,
  excludedUniqueGroups: string[] // ✅ 추가
): Promise<DbItemRow[]> {
  const slotGroup = SLOT_TO_GROUP[slot];

  // 1) 해당 슬롯 그룹의 최신 날짜
  const dateResult = await pool.query(
    `
      SELECT MAX(date) AS max_date
      FROM drop_meso
      WHERE slot_group = $1
    `,
    [slotGroup]
  );
  const dateRows = dateResult.rows as { max_date: string | null }[];

  const max_date = dateRows[0]?.max_date;
  if (!max_date) return [];

  // 2) 슬롯 그룹별 제한 개수
  const cap = LIMIT_PER_SLOT_GROUP[slotGroup] ?? 3;

  // 3) 최신 날짜 기준 + 조건 + (drop, meso) 조합당 cap개까지 가져오는 쿼리
  let sql = `
    WITH ranked AS (
      SELECT
        d.*,
        ROW_NUMBER() OVER (
          PARTITION BY d.drop_pct, d.meso_pct
          ORDER BY d.price ASC
        ) AS rn
      FROM drop_meso d
      WHERE d.slot_group = $1
        AND d.date       = $2
        AND NOT (d.equip_unique_group = ANY($3::text[]))  -- ✅ 고정 아이템과 같은 unique_group 제외
  `;
  const params: any[] = [slotGroup, max_date, excludedUniqueGroups ?? []];

  if (jobGroup && jobGroup !== "ALL") {
    sql += ` AND (d.job_group = 'ALL' OR d.job_group = $${params.length + 1})`;
    params.push(jobGroup);
  } else {
    sql += ` AND d.job_group = 'ALL'`;
  }

  if (excludeKarma) {
    sql += ` AND d.karma_scissors = 0`;
  }

  sql += `
        AND (d.drop_pct > 0 OR d.meso_pct > 0)
    )
    SELECT *
    FROM ranked
    WHERE rn <= $${params.length + 1}
  `;

  params.push(cap);

  const result = await pool.query(sql, params);
  const rows = result.rows as DbItemRow[];
  return rows;
}

// ---- 중복 처리 / 필터링 로직 ----

function dedupeSameSpecByCheapest(list: Candidate[]): Candidate[] {
  const map = new Map<string, Candidate>();
  for (const cand of list) {
    const key = `${cand.uniqueGroup}|${cand.finalDrop}|${cand.finalMeso}`;
    const existing = map.get(key);
    if (!existing || cand.price < existing.price) map.set(key, cand);
  }
  return Array.from(map.values());
}

function filterDominated(list: Candidate[]): Candidate[] {
  const result: Candidate[] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let dominated = false;
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const b = list[j];
      if (a.uniqueGroup !== b.uniqueGroup) continue;

      const betterOrEqual =
        b.deltaDrop >= a.deltaDrop && b.deltaMeso >= a.deltaMeso && b.price <= a.price;

      const strictlyBetter =
        b.deltaDrop > a.deltaDrop || b.deltaMeso > a.deltaMeso || b.price < a.price;

      if (betterOrEqual && strictlyBetter) {
        dominated = true;
        break;
      }
    }
    if (!dominated) result.push(a);
  }
  return result;
}

// ---- 프리컴퓨트용 슬롯 패턴 판별 ----
function deriveSlotsKeyForPrecompute(equipment: ClientSlotEquipment[]): SlotsKey {
  const withoutFace = equipment.filter((e) => e.slot !== "얼굴장식");

  const allUnlockedExcept = (slotToLock?: EquipmentSlotKey): boolean => {
    return withoutFace.every((e) => {
      if (slotToLock && e.slot === slotToLock) {
        return e.useForHunting === true;
      }
      return e.useForHunting === false;
    });
  };

  if (allUnlockedExcept(undefined)) return "ALL_SLOTS";
  if (allUnlockedExcept("펜던트")) return "NO_PENDANT1";
  if (allUnlockedExcept("펜던트2")) return "NO_PENDANT2";
  return "NONE";
}

// ---- 프리컴퓨트 아이템을 실제 슬롯에 배치 ----
function assignPrecomputedToSlots(
  equipment: ClientSlotEquipment[],
  precomputedRows: DbItemRow[],
  slotsKey: SlotsKey
): { slot: EquipmentSlotKey; row: DbItemRow }[] | null {
  const availableByGroup: Record<SlotGroup, EquipmentSlotKey[]> = {
    RING: [],
    PENDANT: [],
    EYE: [],
    FACE: [],
    EARRING: [],
  };

  for (const eq of equipment) {
    if (eq.slot === "얼굴장식") continue;
    if (slotsKey === "NO_PENDANT1" && eq.slot === "펜던트") continue;
    if (slotsKey === "NO_PENDANT2" && eq.slot === "펜던트2") continue;

    const g = SLOT_TO_GROUP[eq.slot];
    availableByGroup[g].push(eq.slot);
  }

  for (const g of Object.keys(availableByGroup) as SlotGroup[]) {
    availableByGroup[g].sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));
  }

  const assigned: { slot: EquipmentSlotKey; row: DbItemRow }[] = [];

  for (const row of precomputedRows) {
    const g = row.slot_group;
    if (g === "FACE") return null;

    const list = availableByGroup[g];
    if (!list || list.length === 0) return null;

    const slot = list.shift() as EquipmentSlotKey;
    assigned.push({ slot, row });
  }

  return assigned;
}

// ---- 프리컴퓨트 케이스 사용 시도 ----

async function tryUsePrecomputedCase(params: {
  equipment: ClientSlotEquipment[];
  targetDrop: number;
  targetMeso: number;
  excludeKarma: boolean;
  jobGroup: JobGroup;
  excludedUniqueGroups: string[]; // ✅ 추가
}): Promise<OptimizationResult | null> {
  const { equipment, targetDrop, targetMeso, excludeKarma, jobGroup, excludedUniqueGroups } = params;

  const face = equipment.find((e) => e.slot === "얼굴장식");
  if (face?.useForHunting === true) return null;

  const slotsKey = deriveSlotsKeyForPrecompute(equipment);
  if (slotsKey === "NONE") return null;

  const caseResult = await pool.query(
    `
      SELECT number_list
      FROM dm_precomputed_case
      WHERE target_drop = $1
        AND target_meso = $2
        AND exclude_karma = $3
        AND slots = $4
      LIMIT 1
    `,
    [targetDrop, targetMeso, excludeKarma, slotsKey]
  );

  if (caseResult.rowCount === 0) return null;

  const caseRow = caseResult.rows[0] as PrecomputedCaseRow;
  const idList = caseRow.number_list || [];
  if (!idList.length) return null;

  const itemsResult = await pool.query(
    `
      SELECT *
      FROM drop_meso
      WHERE id = ANY($1::int4[])
    `,
    [idList]
  );

  const precomputedRows = itemsResult.rows as DbItemRow[];
  if (!precomputedRows.length) return null;

  // ✅ 프리컴퓨트 결과가 고정 아이템 unique_group을 침범하면 프리컴퓨트 사용 포기
  if (
    excludedUniqueGroups.length > 0 &&
    precomputedRows.some((r) => excludedUniqueGroups.includes(r.equip_unique_group))
  ) {
    return null;
  }

  const assigned = assignPrecomputedToSlots(equipment, precomputedRows, slotsKey);
  if (!assigned) return null;

  let finalDrop = 0;
  let finalMeso = 0;
  let totalPrice = 0;
  const itemsToBuy: RecommendedItem[] = [];

  for (const { slot, row } of assigned) {
    const d = row.drop_pct ?? 0;
    const m = row.meso_pct ?? 0;
    const p = Number(row.price ?? 0);

    finalDrop += d;
    finalMeso += m;
    totalPrice += p;

    itemsToBuy.push({
      slot,
      name: row.name,
      dropPct: d,
      mesoPct: m,
      price: p,
    });
  }

  if (finalDrop >= targetDrop && finalMeso >= targetMeso) {
    return { itemsToBuy, totalPrice, finalDrop, finalMeso };
  }

  // 얼굴 후보도 excludedUniqueGroups 적용
  const faceRows = await loadCandidatesForSlot("얼굴장식", jobGroup, excludeKarma, excludedUniqueGroups);

  type FaceChoice = {
    row: DbItemRow | null;
    extraDrop: number;
    extraMeso: number;
    extraPrice: number;
  };

  let bestFace: FaceChoice | null = null;

  for (const row of faceRows) {
    const d = row.drop_pct ?? 0;
    const m = row.meso_pct ?? 0;
    const p = Number(row.price ?? 0);

    const newDrop = finalDrop + d;
    const newMeso = finalMeso + m;

    if (newDrop >= targetDrop && newMeso >= targetMeso) {
      if (!bestFace || p < bestFace.extraPrice) {
        bestFace = { row, extraDrop: d, extraMeso: m, extraPrice: p };
      }
    }
  }

  if (!bestFace) return null;

  if (bestFace.row) {
    finalDrop += bestFace.extraDrop;
    finalMeso += bestFace.extraMeso;
    totalPrice += bestFace.extraPrice;

    itemsToBuy.push({
      slot: "얼굴장식",
      name: bestFace.row.name,
      dropPct: bestFace.extraDrop,
      mesoPct: bestFace.extraMeso,
      price: bestFace.extraPrice,
    });
  }

  return { itemsToBuy, totalPrice, finalDrop, finalMeso };
}

// ---- 메인 API ----

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const { equipment, targetDrop, targetMeso, excludeKarma, jobGroup, lockedItemNames } = body;

    if (!jobGroup) {
      return NextResponse.json(
        {
          message:
            "jobGroup 값이 필요합니다. 먼저 /character-equipment API를 사용하거나, 수동 입력 모드에서 직업군을 선택해 주세요.",
        },
        { status: 400 }
      );
    }

    if (!equipment?.length) {
      return NextResponse.json({ message: "장비 정보가 비어 있습니다." }, { status: 400 });
    }

    // ✅ 고정 아이템 기반 제외 unique_group 목록 계산
    const excludedUniqueGroups = await buildExcludedUniqueGroups(lockedItemNames);

    const lockedSlots = equipment.filter((e) => e.useForHunting);
    const mutableSlots = equipment
      .filter((e) => !e.useForHunting)
      .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

    const baseDrop = lockedSlots.reduce((sum, s) => sum + s.dropPct, 0);
    const baseMeso = lockedSlots.reduce((sum, s) => sum + s.mesoPct, 0);

    const needExtraDrop = Math.max(0, targetDrop - baseDrop);
    const needExtraMeso = Math.max(0, targetMeso - baseMeso);

    if (needExtraDrop <= 0 && needExtraMeso <= 0) {
      return NextResponse.json<OptimizationResult>(
        {
          itemsToBuy: [],
          totalPrice: 0,
          finalDrop: baseDrop,
          finalMeso: baseMeso,
        },
        { status: 200 }
      );
    }

    if (!mutableSlots.length) {
      return NextResponse.json(
        {
          message: "변경 가능한 슬롯이 없습니다. 체크를 풀어서 변경 가능한 슬롯을 늘려주세요.",
        },
        { status: 400 }
      );
    }

    // 🔥 1단계: 프리컴퓨트 케이스 시도 (excludedUniqueGroups 반영)
    const precomputed = await tryUsePrecomputedCase({
      equipment,
      targetDrop,
      targetMeso,
      excludeKarma,
      jobGroup,
      excludedUniqueGroups,
    });

    if (precomputed) {
      return NextResponse.json<OptimizationResult>(precomputed, { status: 200 });
    }

    // 🔥 2단계: 기존 DFS

    const slotCandidates: Candidate[][] = [];

    for (const slotInfo of mutableSlots) {
      const slot = slotInfo.slot;
      const slotGroup = SLOT_TO_GROUP[slot];

      const dbRows = await loadCandidatesForSlot(slot, jobGroup, excludeKarma, excludedUniqueGroups);

      const candidates: Candidate[] = [
        {
          name: "(아이템 없음)",
          slot,
          slotGroup,
          uniqueGroup: `NONE_${slot}`,
          finalDrop: 0,
          finalMeso: 0,
          deltaDrop: 0,
          deltaMeso: 0,
          price: 0,
        },
        ...dbRows.map((row) => ({
          name: row.name,
          slot,
          slotGroup,
          uniqueGroup: row.equip_unique_group,
          finalDrop: row.drop_pct ?? 0,
          finalMeso: row.meso_pct ?? 0,
          deltaDrop: row.drop_pct ?? 0,
          deltaMeso: row.meso_pct ?? 0,
          price: Number(row.price ?? 0),
        })),
      ];

      let refined = dedupeSameSpecByCheapest(candidates);
      refined = filterDominated(refined);
      refined.sort((a, b) => a.price - b.price);

      slotCandidates.push(refined);
    }

    const nSlots = slotCandidates.length;
    let bestPrice = Number.POSITIVE_INFINITY;
    let best: number[] | null = null;

    const maxDropPerSlot = new Array<number>(nSlots).fill(0);
    const maxMesoPerSlot = new Array<number>(nSlots).fill(0);

    for (let i = 0; i < nSlots; i++) {
      for (const cand of slotCandidates[i]) {
        if (cand.deltaDrop > maxDropPerSlot[i]) maxDropPerSlot[i] = cand.deltaDrop;
        if (cand.deltaMeso > maxMesoPerSlot[i]) maxMesoPerSlot[i] = cand.deltaMeso;
      }
    }

    const suffixMaxDrop = new Array<number>(nSlots + 1).fill(0);
    const suffixMaxMeso = new Array<number>(nSlots + 1).fill(0);

    for (let i = nSlots - 1; i >= 0; i--) {
      suffixMaxDrop[i] = suffixMaxDrop[i + 1] + maxDropPerSlot[i];
      suffixMaxMeso[i] = suffixMaxMeso[i + 1] + maxMesoPerSlot[i];
    }

    function dfs(
      slotIdx: number,
      extraDrop: number,
      extraMeso: number,
      cost: number,
      usedGroups: Set<string>,
      chosenIdx: number[]
    ) {
      if (cost >= bestPrice) return;
      if (slotIdx >= nSlots) return;

      const possibleMaxDrop = baseDrop + extraDrop + suffixMaxDrop[slotIdx];
      const possibleMaxMeso = baseMeso + extraMeso + suffixMaxMeso[slotIdx];

      if (possibleMaxDrop < targetDrop || possibleMaxMeso < targetMeso) return;

      const cands = slotCandidates[slotIdx];

      for (let i = 0; i < cands.length; i++) {
        const cand = cands[i];
        const isNone = cand.uniqueGroup.startsWith("NONE_");

        if (!isNone && usedGroups.has(cand.uniqueGroup)) continue;

        const newCost = cost + cand.price;
        if (newCost >= bestPrice) continue;

        const newDrop = extraDrop + cand.deltaDrop;
        const newMeso = extraMeso + cand.deltaMeso;

        chosenIdx[slotIdx] = i;

        const totalDrop = baseDrop + newDrop;
        const totalMeso = baseMeso + newMeso;

        let added = false;
        if (!isNone) {
          usedGroups.add(cand.uniqueGroup);
          added = true;
        }

        if (totalDrop >= targetDrop && totalMeso >= targetMeso) {
          if (newCost < bestPrice) {
            bestPrice = newCost;
            best = [...chosenIdx];
          }
        } else if (slotIdx + 1 < nSlots) {
          dfs(slotIdx + 1, newDrop, newMeso, newCost, usedGroups, chosenIdx);
        }

        if (added) usedGroups.delete(cand.uniqueGroup);
      }
    }

    dfs(0, 0, 0, 0, new Set<string>(), new Array(nSlots).fill(0));

    if (!best) {
      return NextResponse.json(
        {
          message:
            "주어진 목표를 만족하는 조합을 찾지 못했습니다. 목표 수치를 조금 낮추거나, 더 많은 슬롯을 변경 가능하도록 풀어주세요.",
        },
        { status: 400 }
      );
    }

    const bestChoice = best as number[];

    let finalDrop = baseDrop;
    let finalMeso = baseMeso;
    const itemsToBuy: RecommendedItem[] = [];
    let totalPrice = 0;

    for (let slotIdx = 0; slotIdx < nSlots; slotIdx++) {
      const candIdx = bestChoice[slotIdx];
      const cand = slotCandidates[slotIdx][candIdx];
      const slotInfo = mutableSlots[slotIdx];

      finalDrop += cand.finalDrop;
      finalMeso += cand.finalMeso;

      if (cand.price > 0) {
        itemsToBuy.push({
          slot: slotInfo.slot,
          name: cand.name,
          dropPct: cand.finalDrop,
          mesoPct: cand.finalMeso,
          price: cand.price,
        });
        totalPrice += cand.price;
      }
    }

    itemsToBuy.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

    return NextResponse.json<OptimizationResult>(
      { itemsToBuy, totalPrice, finalDrop, finalMeso },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("hunting-optimize error:", err);
    return NextResponse.json(
      {
        message: "최저 비용 세팅을 계산하는 중 서버 오류가 발생했습니다.",
        error: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
