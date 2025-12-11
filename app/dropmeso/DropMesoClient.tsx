"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import styles from "./page.module.css";

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

// 🔹 직업군 타입 (수동 / 자동 공통으로 사용)
type ManualJobGroup = "" | "WARRIOR" | "MAGE" | "THIEF" | "ARCHER" | "PIRATE";

const MANUAL_JOB_OPTIONS: { value: ManualJobGroup; label: string }[] = [
  { value: "", label: "선택 안 함" },
  { value: "WARRIOR", label: "전사" },
  { value: "ARCHER", label: "궁수" },
  { value: "MAGE", label: "마법사" },
  { value: "THIEF", label: "도적" },
  { value: "PIRATE", label: "해적" },
];

// --- 넥슨 API에서 오는 슬롯 데이터 형태 ---
type ApiSlotEquipment = {
  slot: EquipmentSlotKey;
  itemName: string | null;
  dropPct: number;
  mesoPct: number;
};

type CharacterEquipResponse = {
  characterName: string;
  jobGroup: ManualJobGroup | null; // 🔥 route.ts에서 내려주는 직업군
  activePreset: 1 | 2 | 3;
  presets: {
    1?: ApiSlotEquipment[];
    2?: ApiSlotEquipment[];
    3?: ApiSlotEquipment[];
  };
};

// --- 프론트에서 쓰는 슬롯 데이터 ---
type SlotEquipment = {
  slot: EquipmentSlotKey;
  itemName: string | null;
  dropPct: number; // 아이템 드랍률 (%)
  mesoPct: number; // 메소 획득량 (%)
  useForHunting: boolean; // 이 아이템을 현재 세팅에 "고정 사용"할지 여부
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

const SLOT_LABEL: Record<EquipmentSlotKey, string> = {
  반지1: "반지 1",
  반지2: "반지 2",
  반지3: "반지 3",
  반지4: "반지 4",
  펜던트: "펜던트 1",
  펜던트2: "펜던트 2",
  눈장식: "눈장식",
  얼굴장식: "얼굴장식",
  귀고리: "귀고리",
};

// 항상 이 순서로 정렬
const ALL_SLOTS: EquipmentSlotKey[] = [
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

const createEmptySlots = (): SlotEquipment[] =>
  ALL_SLOTS.map((slot) => ({
    slot,
    itemName: null,
    dropPct: 0,
    mesoPct: 0,
    useForHunting: true, // 기본값: 모두 "해당 아이템 사용"으로 고정
  }));

// 넥슨 API 응답을 → 모든 슬롯이 채워진 배열로 정규화
const normalizePreset = (apiSlots?: ApiSlotEquipment[]): SlotEquipment[] => {
  const map = new Map<EquipmentSlotKey, ApiSlotEquipment>();
  (apiSlots ?? []).forEach((s) => map.set(s.slot, s));

  return ALL_SLOTS.map<SlotEquipment>((slot) => {
    const found = map.get(slot);
    return {
      slot,
      itemName: found?.itemName ?? null,
      dropPct: found?.dropPct ?? 0,
      mesoPct: found?.mesoPct ?? 0,
      useForHunting: true, // 불러온 템은 기본적으로 "사용" 체크
    };
  });
};

export default function DropMesoClient() {
  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search") || "";

  // 🔹 검색 파라미터로 온 값으로 초기화
  const [characterName, setCharacterName] = useState(searchValue);

  // 🔥 캐릭터 장비에서 자동으로 감지된 직업군
  const [characterJobGroup, setCharacterJobGroup] =
    useState<ManualJobGroup>("");

  // 프리셋별 장비
  const [presetEquipments, setPresetEquipments] = useState<
    Record<1 | 2 | 3, SlotEquipment[]>
  >({
    1: createEmptySlots(),
    2: createEmptySlots(),
    3: createEmptySlots(),
  });

  const [selectedPreset, setSelectedPreset] = useState<1 | 2 | 3>(1);
  const [hasFetchedEquip, setHasFetchedEquip] = useState(false);

  // 수동 입력 장비
  const [manualEquipment, setManualEquipment] =
    useState<SlotEquipment[]>(createEmptySlots);

  // 수동 입력 모드에서 사용할 직업군
  const [manualJobGroup, setManualJobGroup] = useState<ManualJobGroup>("");

  // true → 수동 입력 / false → 캐릭터 장비 모드
  const [useManualInput, setUseManualInput] = useState<boolean>(true);

  const [loadingEquip, setLoadingEquip] = useState(false);
  const [equipError, setEquipError] = useState<string | null>(null);

  // 🔹 목표값 입력은 string으로 관리 (빈 문자열 허용)
  const [targetDropInput, setTargetDropInput] = useState<string>("200");
  const [targetMesoInput, setTargetMesoInput] = useState<string>("100");

  const [excludeKarma, setExcludeKarma] = useState<boolean>(true);

  const [optimizing, setOptimizing] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  // 현재 선택된 프리셋 장비 (항상 존재는 함)
  const activePresetEquipment: SlotEquipment[] =
    presetEquipments[selectedPreset];

  // 최종적으로 계산에 사용할 장비 배열
  const activeEquipment: SlotEquipment[] | null = useManualInput
    ? manualEquipment
    : hasFetchedEquip
    ? activePresetEquipment
    : null;

  // 🔹 targetDrop/targetMeso 숫자 버전 (0~200 / 0~100으로 클램프)
  const targetDrop = useMemo(() => {
    if (targetDropInput === "") return 0;
    const n = Number(targetDropInput);
    if (Number.isNaN(n)) return 0;
    return Math.min(200, Math.max(0, Math.round(n)));
  }, [targetDropInput]);

  const targetMeso = useMemo(() => {
    if (targetMesoInput === "") return 0;
    const n = Number(targetMesoInput);
    if (Number.isNaN(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }, [targetMesoInput]);

  // 🔹 현재 "고정 사용"으로 체크한 장비 기준 드랍/메획 합계
  const { currentDrop, currentMeso } = useMemo(() => {
    if (!activeEquipment) return { currentDrop: 0, currentMeso: 0 };
    return activeEquipment.reduce(
      (acc, item) => {
        if (!item.useForHunting) return acc;
        return {
          currentDrop: acc.currentDrop + item.dropPct,
          currentMeso: acc.currentMeso + item.mesoPct,
        };
      },
      { currentDrop: 0, currentMeso: 0 }
    );
  }, [activeEquipment]);

  const needDrop = Math.max(0, targetDrop - currentDrop);
  const needMeso = Math.max(0, targetMeso - currentMeso);

  // 1. 캐릭터 장비 불러오기
  const handleFetchEquipment = async (nameArg?: string) => {
    const name = (nameArg ?? characterName).trim();

    if (!name) {
      setEquipError("캐릭터 닉네임을 입력해주세요.");
      return;
    }

    setLoadingEquip(true);
    setEquipError(null);
    setResult(null);

    try {
      const res = await axios.get<CharacterEquipResponse>(
        "/api/character-equipment",
        {
          params: { characterName: name },
        }
      );

      console.log("character-equipment res:", res.data);

      const p1 = normalizePreset(res.data.presets[1]);
      const p2 = normalizePreset(res.data.presets[2]);
      const p3 = normalizePreset(res.data.presets[3]);

      setPresetEquipments({ 1: p1, 2: p2, 3: p3 });

      // 🔹 자동 감지된 직업군 저장
      setCharacterJobGroup(res.data.jobGroup ?? "");

      // 🔹 기본 선택 프리셋: activePreset이 있으면 그걸로, 없으면 1
      const presetToUse = (res.data.activePreset ?? 1) as 1 | 2 | 3;
      setSelectedPreset(presetToUse);

      setHasFetchedEquip(true);
      setUseManualInput(false); // 자동으로 캐릭터 장비 모드로 전환
      setOptError(null);
    } catch (err: any) {
      console.error("fetch equipment error:", err);
      const msg =
        err?.response?.data?.message ??
        "장비 정보를 불러오는 중 오류가 발생했습니다.";
      setEquipError(msg);
      setHasFetchedEquip(false);
    } finally {
      setLoadingEquip(false);
    }
  };

  // 🔹 URL에 ?search=닉네임 이 있을 경우: 자동으로 불러오기
  useEffect(() => {
    if (searchValue) {
      setCharacterName(searchValue);
      handleFetchEquipment(searchValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  // 체크 토글 (슬롯 개별)
  const toggleSlotUse = (slot: EquipmentSlotKey) => {
    if (useManualInput) {
      setManualEquipment((prev) =>
        prev.map((item) =>
          item.slot === slot
            ? { ...item, useForHunting: !item.useForHunting }
            : item
        )
      );
    } else {
      setPresetEquipments((prev) => ({
        ...prev,
        [selectedPreset]: prev[selectedPreset].map((item) =>
          item.slot === slot
            ? { ...item, useForHunting: !item.useForHunting }
            : item
        ),
      }));
    }
    setResult(null);
  };

  // 🔹 모두 선택 / 모두 해제 (수동 입력 테이블)
  const manualAnyChecked = manualEquipment.some((i) => i.useForHunting);
  const handleManualToggleAll = () => {
    const next = !manualAnyChecked ? true : false;
    setManualEquipment((prev) =>
      prev.map((item) => ({ ...item, useForHunting: next }))
    );
    setResult(null);
  };

  // 🔹 모두 선택 / 모두 해제 (캐릭터 장비 테이블)
  const presetAnyChecked = activePresetEquipment.some((i) => i.useForHunting);
  const handlePresetToggleAll = () => {
    const next = !presetAnyChecked ? true : false;
    setPresetEquipments((prev) => ({
      ...prev,
      [selectedPreset]: prev[selectedPreset].map((item) => ({
        ...item,
        useForHunting: next,
      })),
    }));
    setResult(null);
  };

  // 수동 입력 카드에서 드랍/메획 값 수정
  const handleManualValueChange = (
    slot: EquipmentSlotKey,
    field: "dropPct" | "mesoPct",
    value: number
  ) => {
    const clamped =
      field === "dropPct"
        ? Math.min(200, Math.max(0, value))
        : Math.min(100, Math.max(0, value));

    setManualEquipment((prev) =>
      prev.map((item) =>
        item.slot === slot ? { ...item, [field]: clamped } : item
      )
    );
    setResult(null);
  };

  // 🔹 목표 드랍/메획 input 변경 핸들러
  const handleTargetDropChange = (value: string) => {
    if (value === "") {
      setTargetDropInput("");
      return;
    }
    const n = Number(value);
    if (Number.isNaN(n)) return;
    const clamped = Math.min(200, Math.max(0, Math.round(n)));
    setTargetDropInput(String(clamped));
  };

  const handleTargetMesoChange = (value: string) => {
    if (value === "") {
      setTargetMesoInput("");
      return;
    }
    const n = Number(value);
    if (Number.isNaN(n)) return;
    const clamped = Math.min(100, Math.max(0, Math.round(n)));
    setTargetMesoInput(String(clamped));
  };

  // 2. 최저 비용 세팅 계산 요청
  const handleOptimize = async () => {
    if (!activeEquipment) {
      setOptError("먼저 장비 정보를 입력하거나 불러와 주세요.");
      return;
    }
    if (needDrop <= 0 && needMeso <= 0) {
      setOptError("이미 목표 수치를 만족하고 있습니다.");
      return;
    }

    // 🔥 최종 직업군 결정: 수동 모드 → manualJobGroup, 캐릭터 모드 → characterJobGroup
    const finalJobGroup: ManualJobGroup = useManualInput
      ? manualJobGroup
      : characterJobGroup;

    if (!finalJobGroup) {
      setOptError(
        "직업군 정보가 없습니다. 캐릭터 장비를 다시 불러오거나, 수동 입력 모드에서 직업군을 선택해 주세요."
      );
      return;
    }

    setOptimizing(true);
    setOptError(null);
    setResult(null);

    try {
      const res = await axios.post("/api/hunting-optimize", {
        characterName: useManualInput ? "" : characterName,
        equipment: activeEquipment,
        targetDrop,
        targetMeso,
        excludeKarma,
        jobGroup: finalJobGroup, // 🔥 여기서 서버로 전달
      });

      setResult(res.data as OptimizationResult);
    } catch (err: any) {
      console.error(err);
      setOptError(
        err?.response?.data?.message ??
          "최저 비용 세팅을 계산하는 중 오류가 발생했습니다."
      );
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {/* 헤더 */}
        <section className={styles.header}>
          <div>
            <div className={styles.breadcrumb}></div>
            <h1 className={styles.title}>드랍/메획 세팅 계산기</h1>
            <p className={styles.subtitle}>
              현재 착용중인 장비나 직접 설정한 수치를 기준으로, 목표 아이템 드랍률 · 메소
              획득량을 가장 저렴한 조합으로 맞춰주는 도우미입니다.
            </p>
          </div>
        </section>

        <section className="grid gap-4 items-start md:grid-cols-7">
          {/* 왼쪽: 캐릭터 / 장비 */}
          {/* 1단계: 캐릭터 장비 불러오기 카드 */}
          <div className={`${styles.card} md:h-full md:col-span-4 md:order-1 md:flex md:flex-col md:justify-between`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardStep}>1</span>
              <div>
                <div className={styles.cardTitle}>캐릭터 장비 불러오기</div>
                <div className={styles.cardDesc}>
                  넥슨 Open API를 통해 현재 장착 중인 사냥 템 프리셋을 불러옵니다. 
                  <br />
                  (원치 않으면 아래에서 직접 입력도 가능합니다.)
                </div>
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.label}>캐릭터 닉네임</label>
              <input
                className={styles.input}
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="예: 앙헤카톤의주"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFetchEquipment();
                  }
                }}
              />
            </div>

            <button
              className={styles.primaryButton}
              onClick={() => handleFetchEquipment()}
              disabled={loadingEquip}
            >
              {loadingEquip ? "불러오는 중..." : "장비 불러오기"}
            </button>

            {equipError && (
              <div className={styles.errorText}>{equipError}</div>
            )}

            {!useManualInput && characterJobGroup && (
              <div className={styles.smallText} style={{ marginTop: 8 }}>
              </div>
            )}
          </div>

          {/* 1-2단계: 현재 사냥 세팅 */}
          <div className={`${styles.card} md:col-span-4 md:order-3`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardStep}>1-2</span>
              <div>
                <div className={styles.cardTitle}>
                  {useManualInput
                    ? "직접 입력한 사냥 세팅"
                    : "현재 장착 중인 사냥 템"}
                </div>
                <div className={styles.cardDesc}>
                  {useManualInput
                    ? '슬롯별 드랍/메획을 직접 입력하고, "해당 아이템 사용"에 체크된 슬롯은 이미 확보된 수치로 고정합니다.'
                    : '각 슬롯의 체크박스는 "이 아이템을 그대로 사용할지"를 의미합니다. 체크된 부위의 드랍/메획은 이미 채워진 값으로 보고, 나머지 부위에서 부족한 수치를 맞춥니다.'}
                </div>
              </div>

              {/* 우측 상단: 프리셋 선택 + 모드 전환 버튼 */}
              <div className="ml-auto flex flex-col items-center gap-2 self-center shrink-0">
                {!useManualInput && hasFetchedEquip && (
                  <div className="w-full flex flex-col gap-2 md:flex-row">
                    {[1, 2, 3].map((no) => {
                      const active = selectedPreset === no;
                      return (
                        <button
                          key={no}
                          type="button"
                          style={{
                            fontSize: "0.8rem",
                            padding: "4px 12px",
                            borderRadius: 999,
                            border: active
                              ? "1px solid #60a5fa"
                              : "1px solid rgba(148,163,184,0.5)",
                            background: active
                              ? "rgba(37,99,235,0.35)"
                              : "transparent",
                            color: active ? "#e5f2ff" : "#cbd5f5",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setSelectedPreset(no as 1 | 2 | 3);
                            setResult(null);
                          }}
                        >
                          프리셋 {no}
                        </button>
                      );
                    })}
                  </div>
                )}

                {useManualInput ? (
                  hasFetchedEquip && (
                    <button
                      type="button"
                      style={{
                        fontSize: "0.8rem",
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "transparent",
                        border: "1px solid rgba(148,163,184,0.5)",
                        color: "#93c5fd",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setUseManualInput(false);
                        setResult(null);
                        setOptError(null);
                      }}
                    >
                      불러온 장비 사용
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    style={{
                      fontSize: "0.8rem",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "transparent",
                      border: "1px solid rgba(148,163,184,0.5)",
                      color: "#93c5fd",
                      cursor: "pointer",
                      width: "100%",
                    }}
                    onClick={() => {
                      setUseManualInput(true);
                      setResult(null);
                      setOptError(null);
                    }}
                  >
                    직접 입력으로 전환
                  </button>
                )}
              </div>
            </div>

            {/* 수동 입력 모드 */}
            {useManualInput && (
              <>
                <p className={styles.smallText}>
                  각 슬롯에 현재 착용 중인 아이템의 드랍률 · 메소 획득량을
                  입력하세요. <br />
                  드랍/메획이 0%여도, &quot;해당 아이템 사용&quot;
                  체크 시 해당 슬롯은 고정되고, <br />
                  나머지 슬롯에서만 부족한 수치를 맞춥니다.
                </p>

                {/* 🔥 수동 입력용 직업군 선택 */}
                <div className={styles.formRow}>
                  <label className={styles.label}>직업군 선택 *필수</label>
                  <select
                    className={styles.input}
                    value={manualJobGroup}
                    onChange={(e) => {
                      setManualJobGroup(e.target.value as ManualJobGroup);
                      setResult(null);
                      setOptError(null);
                    }}
                  >
                    {MANUAL_JOB_OPTIONS.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>슬롯</th>
                        <th>아이템 드랍률 (%)</th>
                        <th>메소 획득량 (%)</th>
                        <th>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            <span>해당 아이템 사용</span>
                            <label
                              className={styles.checkboxLabel}
                              style={{ fontSize: "0.7rem" }}
                            >
                              <input
                                type="checkbox"
                                checked={manualAnyChecked}
                                onChange={handleManualToggleAll}
                                style={{ transform: "scale(0.9)" }}
                              />
                              <span>
                                {manualAnyChecked ? "모두 해제" : "모두 선택"}
                              </span>
                            </label>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualEquipment.map((item) => (
                        <tr key={item.slot}>
                          <td>{SLOT_LABEL[item.slot]}</td>
                          <td>
                            <input
                              type="number"
                              className={styles.input}
                              style={{ maxWidth: 80 }}
                              value={item.dropPct}
                              min={0}
                              max={200}
                              step={20}
                              onChange={(e) =>
                                handleManualValueChange(
                                  item.slot,
                                  "dropPct",
                                  Number(e.target.value) || 0
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className={styles.input}
                              style={{ maxWidth: 80 }}
                              value={item.mesoPct}
                              min={0}
                              max={100}
                              step={20}
                              onChange={(e) =>
                                handleManualValueChange(
                                  item.slot,
                                  "mesoPct",
                                  Number(e.target.value) || 0
                                )
                              }
                            />
                          </td>
                          <td>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={item.useForHunting}
                                onChange={() => toggleSlotUse(item.slot)}
                              />
                              <span>해당 아이템 사용</span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 캐릭터 장비 모드 */}
            {!useManualInput && (
              <>
                {!hasFetchedEquip ? (
                  <div className={styles.emptyState}>
                    아직 캐릭터 장비를 불러오지 않았습니다. 위 카드에서
                    닉네임을 입력하고 &quot;장비 불러오기&quot; 버튼을
                    눌러주세요.
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>슬롯</th>
                          <th>아이템</th>
                          <th>아이템 드랍률</th>
                          <th>메소 획득량</th>
                          <th>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              <span>해당 아이템 사용</span>
                              <label
                                className={styles.checkboxLabel}
                                style={{ fontSize: "0.7rem" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={presetAnyChecked}
                                  onChange={handlePresetToggleAll}
                                  style={{ transform: "scale(0.9)" }}
                                />
                                <span>
                                  {presetAnyChecked ? "모두 해제" : "모두 선택"}
                                </span>
                              </label>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePresetEquipment.map((item) => (
                          <tr key={item.slot}>
                            <td>{SLOT_LABEL[item.slot]}</td>
                            <td>{item.itemName ?? "-"}</td>
                            <td>
                              {item.dropPct !== 0
                                ? `${item.dropPct}%`
                                : "-"}
                            </td>
                            <td>
                              {item.mesoPct !== 0
                                ? `${item.mesoPct}%`
                                : "-"}
                            </td>
                            <td>
                              <label className={styles.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  checked={item.useForHunting}
                                  onChange={() => toggleSlotUse(item.slot)}
                                />
                                <span>해당 아이템 사용</span>
                              </label>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 오른쪽: 목표 / 옵션 / 결과 */}
          {/* 목표 설정 카드 */}
          <div className={`${styles.card} md:col-span-3 md:order-2`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardStep}>2</span>
              <div>
                <div className={styles.cardTitle}>목표 수치 설정</div>
                <div className={styles.cardDesc}>
                  &quot;해당 아이템 사용&quot;으로 체크된 슬롯들의 드랍/메획을
                  현재 세팅으로 보고, 나머지 부위에서 부족한 수치를
                  채웁니다.
                </div>
              </div>
            </div>

            <div className={styles.statsRow}>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>현재 아이템 드랍률</div>
                <div className={styles.statValue}>{currentDrop}%</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>현재 메소 획득량</div>
                <div className={styles.statValue}>{currentMeso}%</div>
              </div>
            </div>

            <div className={styles.statsRow}>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>목표 아이템 드랍률</div>
                <input
                  className={styles.input}
                  type="number"
                  step={20}
                  min={0}
                  max={200}
                  value={targetDropInput}
                  onChange={(e) => handleTargetDropChange(e.target.value)}
                />
                <div className={styles.needText}>
                  부족분: {needDrop <= 0 ? "없음" : `${needDrop}%`}
                </div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>목표 메소 획득량</div>
                <input
                  className={styles.input}
                  type="number"
                  step={20}
                  min={0}
                  max={100}
                  value={targetMesoInput}
                  onChange={(e) => handleTargetMesoChange(e.target.value)}
                />
                <div className={styles.needText}>
                  부족분: {needMeso <= 0 ? "없음" : `${needMeso}%`}
                </div>
              </div>
            </div>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={excludeKarma}
                onChange={(e) => setExcludeKarma(e.target.checked)}
              />
              <span>
                가위 횟수 제한 달린 템을 제외하고 추천 (영구 교환가능 템만 추천)
              </span>
            </label>
          </div>

          {/* 결과 카드 */}
          <div className={`${styles.card} md:h-fit md:col-span-3 md:order-last`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardStep}>3</span>
              <div>
                <div className={styles.cardTitle}>최저 비용 세팅 계산</div>
                <div className={styles.cardDesc}>
                  DB에 저장된 시세를 바탕으로, 가장 적은 비용으로 목표를
                  만족하는 조합을 찾습니다. 최대 2분까지 소요될 수 있습니다.
                </div>
              </div>
            </div>

            <button
              className={styles.primaryButton}
              onClick={handleOptimize}
              disabled={optimizing || !activeEquipment}
            >
              {optimizing ? "계산 중..." : "최저 비용 세팅 계산하기"}
            </button>

            {optError && <div className={styles.errorText}>{optError}</div>}

            {!result && !optError && (
              <p className={styles.smallText}>
                <br />
                계산 버튼을 누르면, 새로 구매해야 하는 아이템과 비용이 여기 표시됩니다.
              </p>
            )}

            {result && (
              <div className={styles.resultPanel}>
                <div className={styles.resultSummary}>
                  <div>
                    <div className={styles.resultLabel}>최종 아이템 드랍률</div>
                    <div className={styles.resultValue}>
                      {result.finalDrop}%
                    </div>
                  </div>
                  <div>
                    <div className={styles.resultLabel}>최종 메소 획득량</div>
                    <div className={styles.resultValue}>
                      {result.finalMeso}%
                    </div>
                  </div>
                  <div>
                    <div className={styles.resultLabel}>예상 총 비용</div>
                    <div className={styles.resultValue}>
                      {result.totalPrice.toLocaleString("ko-KR")} 메소
                    </div>
                  </div>
                </div>

                <div className={styles.sectionDivider} />

                <div className={styles.sectionTitle}>구매 추천 아이템</div>

                {result.itemsToBuy.length === 0 ? (
                  <div className={styles.emptyState}>
                    추가로 구매해야 하는 아이템이 없습니다. 🎉
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>슬롯</th>
                          <th>아이템</th>
                          <th>아이템 드랍률</th>
                          <th>메소 획득량</th>
                          <th>가격</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...result.itemsToBuy]
                          .sort((a, b) => {
                            // 1) 얼굴장식은 항상 맨 위
                            if (a.slot === "얼굴장식" && b.slot !== "얼굴장식")
                              return -1;
                            if (b.slot === "얼굴장식" && a.slot !== "얼굴장식")
                              return 1;

                            // 2) 나머지는 ALL_SLOTS 순서대로
                            return (
                              ALL_SLOTS.indexOf(a.slot) -
                              ALL_SLOTS.indexOf(b.slot)
                            );
                          })
                          .map((item, idx) => (
                            <tr key={`${item.slot}-${idx}`}>
                              <td>{SLOT_LABEL[item.slot]}</td>
                              <td>{item.name}</td>
                              <td>{item.dropPct ? `${item.dropPct}%` : "-"}</td>
                              <td>{item.mesoPct ? `${item.mesoPct}%` : "-"}</td>
                              <td>{item.price.toLocaleString("ko-KR")} 메소</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
