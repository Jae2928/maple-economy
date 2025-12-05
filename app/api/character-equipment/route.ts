// app/api/character-equipment/route.ts
import { NextRequest, NextResponse } from "next/server";

const NEXON_API_KEY = process.env.NEXON_API_KEY;

// ===== 🔥 추가: 직업 그룹 매핑 함수 =====
type JobGroup = "ALL" | "WARRIOR" | "MAGE" | "THIEF" | "ARCHER" | "PIRATE";

function classNameToJobGroup(cls: string): JobGroup {
  const name = cls.replace(/\s+/g, "");

  if (/히어로|팔라딘|다크나이트|소울마스터|미하일|블래스터|데몬슬레이어|데몬어벤져|아란|카이저|아델|렌|제로/i.test(name))
    return "WARRIOR";

  if (/아크메이지|비숍|플레임위자드|배틀메이지|에반|루미너스|일리움|라라|키네시스/i.test(name))
    return "MAGE";

  if (/나이트로드|섀도어|듀얼블레이더|나이트워커|제논|팬텀|카데나|칼리|호영/i.test(name))
    return "THIEF";

  if (/보우마스터|신궁|패스파인더|윈드브레이커|와일드헌터|메르세데스|카인/i.test(name))
    return "ARCHER";

  if (/바이퍼|캡틴|캐논마스터|스트라이커|메카닉|제논|은월|엔젤릭버스터|아크/i.test(name))
    return "PIRATE";

  return "ALL";
}

// (기존 코드 동일)
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

type SlotEquipment = {
  slot: EquipmentSlotKey;
  itemName: string | null;
  dropPct: number;
  mesoPct: number;
};

function extractDropMesoFromItem(item: any): { dropPct: number; mesoPct: number } {
  const potentials = [
    item.potential_option_1,
    item.potential_option_2,
    item.potential_option_3,
  ] as (string | null)[];

  let drop = 0;
  let meso = 0;

  for (const p of potentials) {
    if (!p) continue;
    const m = p.match(/(아이템 드롭률|메소 획득량) \+(\d+)%/);
    if (!m) continue;

    const value = Number(m[2]);
    if (m[1] === "아이템 드롭률") drop += value;
    if (m[1] === "메소 획득량") meso += value;
  }
  return { dropPct: drop, mesoPct: meso };
}

function getPresetArray(data: any, preset: 1 | 2 | 3) {
  const activePreset: number = data.preset_no ?? 1;
  if (preset === activePreset) return data.item_equipment ?? [];

  const key =
    preset === 1
      ? "item_equipment_preset_1"
      : preset === 2
      ? "item_equipment_preset_2"
      : "item_equipment_preset_3";

  return data[key] ?? [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const characterName = searchParams.get("characterName");

    if (!characterName) {
      return NextResponse.json({ message: "characterName 파라미터가 필요합니다." }, { status: 400 });
    }

    // 1) OCID 조회
    const idRes = await fetch(
      `https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(
        characterName
      )}`,
      {
        headers: { "x-nxopen-api-key": NEXON_API_KEY as string },
        cache: "no-store",
      }
    );


    const idJson = await idRes.json();
    const ocid = idJson.ocid;
    if (!ocid) return NextResponse.json({ message: "캐릭터를 찾을 수 없습니다." }, { status: 404 });

    // 2) 장비 정보 조회
    const equipRes = await fetch(
      `https://open.api.nexon.com/maplestory/v1/character/item-equipment?ocid=${ocid}`,
      {
        headers: { "x-nxopen-api-key": NEXON_API_KEY as string },
        cache: "no-store",
      }
    );

    const equipJson = await equipRes.json();

    // ===== 🔥 여기서 직업 추출 =====
    const job = equipJson.character_class ?? null;
    const jobGroup = job ? classNameToJobGroup(job) : "ALL";

    const allowedSlots: EquipmentSlotKey[] = [
      "반지1",
      "반지2",
      "반지3",
      "반지4",
      "펜던트",
      "펜던트2",
      "눈장식",
      "얼굴장식",
      "귀고리",
    ];

    const presets: Record<1 | 2 | 3, SlotEquipment[]> = { 1: [], 2: [], 3: [] };

    ([1, 2, 3] as const).forEach((presetNo) => {
      const arr = getPresetArray(equipJson, presetNo);

      presets[presetNo] = arr
        .filter((item: any) => allowedSlots.includes(item.item_equipment_slot as EquipmentSlotKey))
        .map((item: any) => {
          const { dropPct, mesoPct } = extractDropMesoFromItem(item);
          return {
            slot: item.item_equipment_slot as EquipmentSlotKey,
            itemName: item.item_name ?? null,
            dropPct,
            mesoPct,
          };
        });
    });

    return NextResponse.json({
      characterName,
      job,
      jobGroup, // 🔥 추가됨
      activePreset: equipJson.preset_no ?? 1,
      presets,
    });

  } catch (err) {
    return NextResponse.json({ message: "서버 오류 발생", detail: String(err) }, { status: 500 });
  }
}
