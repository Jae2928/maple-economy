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

// ---- DB 후보 불러오기 (Supabase / Postgres 버전) ----

async function loadCandidatesForSlot(
  slot: EquipmentSlotKey,
  jobGroup: JobGroup | null,
  excludeKarma: boolean
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

  // 2) 최신 날짜 기준 필터링
  let sql = `
    SELECT *
    FROM drop_meso
    WHERE slot_group = $1
      AND date = $2
  `;
  const params: any[] = [slotGroup, max_date];

  if (jobGroup && jobGroup !== "ALL") {
    sql += ` AND (job_group = 'ALL' OR job_group = $3)`;
    params.push(jobGroup);
  } else {
    sql += ` AND job_group = 'ALL'`;
  }

  if (excludeKarma) {
    sql += ` AND karma_scissors = 0`;
  }

  sql += ` AND (drop_pct > 0 OR meso_pct > 0)`;

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
        b.deltaDrop >= a.deltaDrop &&
        b.deltaMeso >= a.deltaMeso &&
        b.price <= a.price;

      const strictlyBetter =
        b.deltaDrop > a.deltaDrop ||
        b.deltaMeso > a.deltaMeso ||
        b.price < a.price;

      if (betterOrEqual && strictlyBetter) {
        dominated = true;
        break;
      }
    }
    if (!dominated) result.push(a);
  }
  return result;
}

function limitPerStatBySlotGroup(
  list: Candidate[],
  slotGroup: SlotGroup
): Candidate[] {
  const LIMIT: Record<SlotGroup, number> = {
    RING: 6,
    PENDANT: 4,
    EYE: 3,
    FACE: 3,
    EARRING: 3,
  };
  const cap = LIMIT[slotGroup] ?? 3;

  const grouped = new Map<string, Candidate[]>();

  for (const c of list) {
    const key = `${c.finalDrop}|${c.finalMeso}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  const result: Candidate[] = [];
  for (const arr of grouped.values()) {
    arr.sort((a, b) => a.price - b.price);
    result.push(...arr.slice(0, cap));
  }

  return result;
}

// ---- 메인 API ----

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const { equipment, targetDrop, targetMeso, excludeKarma, jobGroup } = body;

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
      return NextResponse.json(
        { message: "장비 정보가 비어 있습니다." },
        { status: 400 }
      );
    }

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
          message:
            "변경 가능한 슬롯이 없습니다. 체크를 풀어서 변경 가능한 슬롯을 늘려주세요.",
        },
        { status: 400 }
      );
    }

    // ---- 슬롯별 후보 생성 ----
    const slotCandidates: Candidate[][] = [];

    for (const slotInfo of mutableSlots) {
      const slot = slotInfo.slot;
      const slotGroup = SLOT_TO_GROUP[slot];

      const dbRows = await loadCandidatesForSlot(slot, jobGroup, excludeKarma);

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
      refined = limitPerStatBySlotGroup(refined, slotGroup);

      refined.sort((a, b) => a.price - b.price);

      slotCandidates.push(refined);
    }

    // ---- DFS (equip_unique_group 전역 1회 제한 + 가지치기) ----

    const nSlots = slotCandidates.length;
    let bestPrice = Number.POSITIVE_INFINITY;
    let best: number[] | null = null;

    const maxDropPerSlot = new Array<number>(nSlots).fill(0);
    const maxMesoPerSlot = new Array<number>(nSlots).fill(0);

    for (let i = 0; i < nSlots; i++) {
      for (const cand of slotCandidates[i]) {
        if (cand.deltaDrop > maxDropPerSlot[i]) {
          maxDropPerSlot[i] = cand.deltaDrop;
        }
        if (cand.deltaMeso > maxMesoPerSlot[i]) {
          maxMesoPerSlot[i] = cand.deltaMeso;
        }
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

      if (possibleMaxDrop < targetDrop || possibleMaxMeso < targetMeso) {
        return;
      }

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

        if (added) {
          usedGroups.delete(cand.uniqueGroup);
        }
      }
    }

    dfs(0, 0, 0, 0, new Set<string>(), new Array(nSlots).fill(0));

    if (!best) {
      return NextResponse.json(
        {
          message:
            "주어진 목표를 만족하는 조합을 찾지 못했습니다. " +
            "목표 수치를 조금 낮추거나, 더 많은 슬롯을 변경 가능하도록 풀어주세요.",
        },
        { status: 400 }
      );
    }

    const bestChoice = best as number[];

    // ---- 결과 재구성 ----

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

    return NextResponse.json<OptimizationResult>(
      {
        itemsToBuy,
        totalPrice,
        finalDrop,
        finalMeso,
      },
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
