"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import styles from "./page.module.css";

type JobGroup = "ALL" | "WARRIOR" | "MAGE" | "THIEF" | "ARCHER" | "PIRATE";

type SlotEquipment = {
  itemName: string | null;
  itemIcon: string | null;
  potentialOptions: (string | null)[];
  additionalPotentialOptions: (string | null)[];
  starforce: number | null;

  // API에서 slot을 보내고 있으니(정렬/키용) optional로 받아둠
  slot?: string;
};

type ApiResponse = {
  characterName: string;
  job: string | null;
  jobGroup: JobGroup;
  activePreset: 1 | 2 | 3;
  presets: Record<1 | 2 | 3, SlotEquipment[]>;
};

function jobGroupLabel(g: JobGroup) {
  switch (g) {
    case "WARRIOR":
      return "전사";
    case "MAGE":
      return "마법사";
    case "THIEF":
      return "도적";
    case "ARCHER":
      return "궁수";
    case "PIRATE":
      return "해적";
    default:
      return "전체";
  }
}

function OptList({ items }: { items: (string | null)[] }) {
  const filtered = items.filter((x) => x && x.trim().length > 0) as string[];
  if (filtered.length === 0) return <span className={styles.dim}>-</span>;

  // ✅ ul 기본 들여쓰기 제거해서 "-"와 같은 세로열로 맞추기
  return (
    <ul
      className={styles.optList}
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
      }}
    >
      {filtered.map((t, i) => (
        <li
          key={`${t}-${i}`}
          style={{
            margin: 0,
            padding: 0,
          }}
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

export default function CharacterEquipmentPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const [selectedPreset, setSelectedPreset] = useState<1 | 2 | 3>(1);

  // 슬롯 컬럼은 표에 표시하지 않지만, 응답 순서 그대로 렌더
  const rows = useMemo(() => {
    return data?.presets?.[selectedPreset] ?? [];
  }, [data, selectedPreset]);

  const fetchData = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    setErrMsg(null);
    setData(null);

    try {
      const res = await axios.get("/api/character-equipment-detail", {
        params: { characterName: trimmed },
      });

      const d = res.data as ApiResponse;
      setData(d);
      setSelectedPreset(d.activePreset ?? 1);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "데이터를 불러오지 못했습니다.";
      setErrMsg(String(msg));
    } finally {
      setLoading(false);
    }
  };

  // ✅ "가격 검색" 버튼 클릭 (DB 연결 전: 버튼만)
  const handlePriceSearch = () => {
    alert("가격 검색 기능은 DB 준비 후 연결할 예정입니다!");
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>캐릭터 장비 옵션 조회</h1>
        <p className={styles.sub}>
          닉네임을 입력하면 프리셋별 장비 아이콘/잠재/에디셔널/스타포스를
          보여줍니다.
        </p>

        <div className={styles.searchBox}>
          <input
            className={styles.searchInput}
            placeholder="캐릭터 닉네임"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchData();
            }}
          />
          <button
            className={styles.searchBtn}
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? "조회중..." : "조회"}
          </button>
        </div>

        {errMsg && <div className={styles.error}>{errMsg}</div>}
      </section>

      {data && (
        <section className={styles.card}>
          {/* ✅ 상단 3영역: 왼쪽(캐릭터정보) / 가운데(가격검색) / 오른쪽(프리셋) */}
          <div className={styles.headerRow}>
            <div className={styles.headerLeft}>
              <div className={styles.charName}>{data.characterName}</div>
              <div className={styles.meta}>
                직업: <b>{data.job ?? "-"}</b> / 직업군:{" "}
                <b>{jobGroupLabel(data.jobGroup)}</b>
              </div>
            </div>

            <div className={styles.headerCenter}>
              <button
                className={styles.priceBtn}
                onClick={handlePriceSearch}
                disabled={!data || rows.length === 0}
                title="DB와 매칭하여 가격을 표시합니다(준비중)"
              >
                가격 검색
              </button>
            </div>

            <div className={styles.headerRight}>
              <div className={styles.presetRow}>
                {([1, 2, 3] as const).map((p) => (
                  <button
                    key={p}
                    className={`${styles.presetBtn} ${
                      selectedPreset === p ? styles.presetBtnActive : ""
                    }`}
                    onClick={() => setSelectedPreset(p)}
                  >
                    프리셋 {p}
                    {data.activePreset === p ? " (현재)" : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thIcon}> </th>
                  <th>아이템</th>
                  <th>잠재 (Potential)</th>
                  <th>에디셔널 (Additional)</th>
                  <th className={styles.thStar}>스타포스</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.itemName ?? "empty"}-${r.slot ?? "slot"}-${idx}`}>
                    <td className={styles.iconCell}>
                      {r.itemIcon ? (
                        <img
                          src={r.itemIcon}
                          alt={r.itemName ?? "item"}
                          className={styles.itemIcon}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <span className={styles.dim}>-</span>
                      )}
                    </td>

                    <td className={styles.item}>
                      {r.itemName ?? <span className={styles.dim}>-</span>}
                    </td>

                    <td className={styles.optCell}>
                      <OptList items={r.potentialOptions ?? []} />
                    </td>

                    <td className={styles.optCell}>
                      <OptList items={r.additionalPotentialOptions ?? []} />
                    </td>

                    <td className={styles.starCell}>
                      {r.starforce == null ? (
                        <span className={styles.dim}>-</span>
                      ) : (
                        `★ ${r.starforce}`
                      )}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
                      표시할 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.hint}>
            ※ DB가 준비되면 이 결과를 저장/통계/아이템 시세 매칭까지 확장할 수
            있어요.
          </div>
        </section>
      )}
    </main>
  );
}
