// app/api/character-equipment-detail/route.ts
import { NextRequest, NextResponse } from "next/server";

const NEXON_API_KEY = process.env.NEXON_API_KEY;

type JobGroup = "ALL" | "WARRIOR" | "MAGE" | "THIEF" | "ARCHER" | "PIRATE";

function classNameToJobGroup(cls: string): JobGroup {
  const name = cls.replace(/\s+/g, "");

  if (
    /히어로|팔라딘|다크나이트|소울마스터|미하일|블래스터|데몬슬레이어|데몬어벤져|아란|카이저|아델|렌|제로/i.test(
      name
    )
  )
    return "WARRIOR";
  if (
    /아크메이지|비숍|플레임위자드|배틀메이지|에반|루미너스|일리움|라라|키네시스/i.test(
      name
    )
  )
    return "MAGE";
  if (
    /나이트로드|섀도어|듀얼블레이더|나이트워커|제논|팬텀|카데나|칼리|호영/i.test(
      name
    )
  )
    return "THIEF";
  if (
    /보우마스터|신궁|패스파인더|윈드브레이커|와일드헌터|메르세데스|카인/i.test(
      name
    )
  )
    return "ARCHER";
  if (
    /바이퍼|캡틴|캐논마스터|스트라이커|메카닉|제논|은월|엔젤릭버스터|아크/i.test(
      name
    )
  )
    return "PIRATE";

  return "ALL";
}

type EquipmentSlotKey =
  | "반지1"
  | "반지2"
  | "반지3"
  | "반지4"
  | "펜던트"
  | "펜던트2"
  | "벨트"
  | "눈장식"
  | "얼굴장식"
  | "귀고리";

type SlotEquipmentDetail = {
  slot: EquipmentSlotKey;
  itemName: string | null;
  itemIcon: string | null;
  potentialOptions: (string | null)[];
  additionalPotentialOptions: (string | null)[];
  starforce: number | null;
};

function getPresetArray(data: any, preset: 1 | 2 | 3) {
  const active = data.preset_no ?? 1;
  if (preset === active) return data.item_equipment ?? [];

  return (
    data[
      preset === 1
        ? "item_equipment_preset_1"
        : preset === 2
        ? "item_equipment_preset_2"
        : "item_equipment_preset_3"
    ] ?? []
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const characterName = searchParams.get("characterName");

    if (!characterName) {
      return NextResponse.json({ message: "characterName 필요" }, { status: 400 });
    }

    // 1) OCID
    const idRes = await fetch(
      `https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(
        characterName
      )}`,
      {
        headers: { "x-nxopen-api-key": NEXON_API_KEY! },
        cache: "no-store",
      }
    );

    const { ocid } = await idRes.json();
    if (!ocid) {
      return NextResponse.json({ message: "캐릭터 없음" }, { status: 404 });
    }

    // 2) 장비
    const equipRes = await fetch(
      `https://open.api.nexon.com/maplestory/v1/character/item-equipment?ocid=${ocid}`,
      {
        headers: { "x-nxopen-api-key": NEXON_API_KEY! },
        cache: "no-store",
      }
    );

    const equipJson = await equipRes.json();

    const job = equipJson.character_class ?? null;
    const jobGroup = job ? classNameToJobGroup(job) : "ALL";

    const allowedSlots: EquipmentSlotKey[] = [
      "반지1",
      "반지2",
      "반지3",
      "반지4",
      "펜던트",
      "펜던트2",
      "벨트",
      "눈장식",
      "얼굴장식",
      "귀고리",
    ];

    const presets: Record<1 | 2 | 3, SlotEquipmentDetail[]> = {
      1: [],
      2: [],
      3: [],
    };

    ([1, 2, 3] as const).forEach((presetNo) => {
      presets[presetNo] = getPresetArray(equipJson, presetNo)
        .filter((i: any) => allowedSlots.includes(i.item_equipment_slot))
        .map((i: any) => ({
          slot: i.item_equipment_slot,
          itemName: i.item_name ?? null,

          // ✅ 변경: 더 선명한 아이콘
          itemIcon: i.item_shape_icon ?? null,

          potentialOptions: [
            i.potential_option_1 ?? null,
            i.potential_option_2 ?? null,
            i.potential_option_3 ?? null,
          ],
          additionalPotentialOptions: [
            i.additional_potential_option_1 ?? null,
            i.additional_potential_option_2 ?? null,
            i.additional_potential_option_3 ?? null,
          ],
          starforce:
            typeof i.starforce === "number" ? i.starforce : Number(i.starforce) || null,
        }));
    });

    return NextResponse.json({
      characterName,
      job,
      jobGroup,
      activePreset: equipJson.preset_no ?? 1,
      presets,
    });
  } catch (e) {
    return NextResponse.json({ message: "서버 오류", detail: String(e) }, { status: 500 });
  }
}
