"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

// ---------- 타입 정의 ----------
type PriceRow = {
  name: string;
  price: number;
  date: string; // YYYY-MM-DD
};

type Dataset = {
  label: string;
  data: (number | null)[];
  borderColor: string;
  borderWidth: number;
  tension: number;
};

type MesoPoint = {
  date: string;
  price: number;
};

type NoticeRow = {
  id: number;
  type: "NEWS" | "UPDATE" | "NOTICE";
  title: string;
  content: string;
  createdAt: string;
};

type NewsType = "뉴스" | "업데이트" | "공지";
type MarketItem = "메소 마켓" | "솔 에르다 조각" | "솔 에르다 조각(챌1)";

type NewsItem = {
  id: number;
  type: NewsType;
  title: string;
  content: string;
  createdAt: string;
};

type GroupState = {
  labels: string[];
  datasets: Dataset[];
};

const emptyGroupState: GroupState = { labels: [], datasets: [] };

const convertType = (type: NoticeRow["type"]): NewsType =>
  type === "NEWS" ? "뉴스" : type === "UPDATE" ? "업데이트" : "공지";

// 아이템 이름 → 이미지 파일명
const imageFileName = (name: string) => {
  if (name === "미트라의 분노 : 전사") return "미트라의 분노 전사";
  return name.replace(/[:]/g, "");
};

// ✅ 모바일 감지 훅
function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [breakpointPx]);

  return isMobile;
}

// 커스텀 Legend
function ItemLegend({
  datasets,
  hiddenLabels,
  onToggle,
}: {
  datasets: Dataset[];
  hiddenLabels: Set<string>;
  onToggle: (label: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginBottom: "8px",
      }}
    >
      {datasets.map((ds) => {
        const hidden = hiddenLabels.has(ds.label);
        return (
          <div
            key={ds.label}
            onClick={() => onToggle(ds.label)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.8rem",
              cursor: "pointer",
              opacity: hidden ? 0.4 : 1,
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid #ddd",
                background: "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={`/item_image/item_${imageFileName(ds.label)}.png`}
                alt={ds.label}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <span>{ds.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ====== 세트별 아이템 그룹 ======
const groupDefs: Record<string, string[]> = {
  칠흑: [
    "거대한 공포",
    "고통의 근원",
    "루즈 컨트롤 머신 마크",
    "마력이 깃든 안대",
    "몽환의 벨트",
    "미트라의 분노 : 전사",
    "저주받은 적의 마도서",
    "창세의 뱃지",
    "커맨더 포스 이어링",
    "컴플리트 언더컨트롤",
  ],
  에테르넬: [
    "에테르넬 나이트헬름",
    "에테르넬 나이트아머",
    "에테르넬 나이트팬츠",
    "에테르넬 나이트숄더",
    "에테르넬 나이트글러브",
    "에테르넬 나이트슈즈",
    "에테르넬 나이트케이프",
  ],
  시드링: ["리스트레인트 링 LV4", "컨티뉴어스 링 LV4"],
};

// ====== 챌린저스용 그룹 ======
const challengerGroupDefs: Record<string, string[]> = {
  "챌여명": ["가디언 엔젤 링", "트와일라이트 마크", "에스텔라 이어링", "데이브레이크 펜던트"],
  "챌칠흑": [...groupDefs.칠흑],
  "챌시드링": [...groupDefs.시드링],
};

// ---------- 표 렌더링용 ----------
type TableRow = {
  name: string;
  price: number | null;
  prevDayPrice: number | null;
  prevWeekPrice: number | null;
  dayChangePct: number | null;
  weekChangePct: number | null;
};

function pctChange(now: number, prev: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return null;
  if (prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

function getValueAtOrBefore(data: (number | null)[], idx: number): number | null {
  if (idx < 0) return null;
  for (let i = idx; i >= 0; i--) {
    const v = data[i];
    if (v != null) return v;
  }
  return null;
}

function ChangeWithPrice({
  prevPrice,
  pct,
  formatToEok,
}: {
  prevPrice: number | null;
  pct: number | null;
  formatToEok: (v: number) => string;
}) {
  if (prevPrice == null || pct == null) {
    return <span style={{ opacity: 0.6 }}>-</span>;
  }

  const up = pct > 0;
  const down = pct < 0;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontVariantNumeric: "tabular-nums",
        color: up ? "#ef4444" : down ? "#3b82f6" : "#cbd5e1",
        whiteSpace: "nowrap",
      }}
      title={`${prevPrice.toLocaleString("ko-KR")} 메소, ${pct.toFixed(1)}%`}
    >
      <span style={{ color: "#e5e7eb" }}>{formatToEok(prevPrice)}</span>
      <span>
        {up ? "▲" : down ? "▼" : "―"} {Math.abs(pct).toFixed(1)}%
      </span>
    </span>
  );
}

function PriceTable({
  groupState,
  formatToEok,
  isMobile,
}: {
  groupState: GroupState;
  formatToEok: (v: number) => string;
  isMobile: boolean;
}) {
  const rows: TableRow[] = useMemo(() => {
    const labels = groupState.labels;
    const lastIdx = labels.length - 1;
    const prevIdx = lastIdx - 1;
    const weekIdx = lastIdx - 7;

    return groupState.datasets
      .map((ds) => {
        const now = lastIdx >= 0 ? getValueAtOrBefore(ds.data, lastIdx) : null;
        const prev = prevIdx >= 0 ? getValueAtOrBefore(ds.data, prevIdx) : null;
        const week = weekIdx >= 0 ? getValueAtOrBefore(ds.data, weekIdx) : null;

        const dayPct = now != null && prev != null ? pctChange(now, prev) : null;
        const weekPct = now != null && week != null ? pctChange(now, week) : null;

        return {
          name: ds.label,
          price: now,
          prevDayPrice: prev,
          prevWeekPrice: week,
          dayChangePct: dayPct,
          weekChangePct: weekPct,
        };
      })
      .sort((a, b) => {
        const av = a.price ?? -1;
        const bv = b.price ?? -1;
        return bv - av;
      });
  }, [groupState]);

  const thBase: CSSProperties = {
    textAlign: "left",
    padding: isMobile ? "10px 8px" : "12px 12px",
    fontSize: isMobile ? "0.8rem" : "0.85rem",
    borderBottom: "1px solid rgba(148,163,184,0.25)",
    whiteSpace: "nowrap",
  };

  const tdBase: CSSProperties = {
    padding: isMobile ? "10px 8px" : "12px 12px",
    fontSize: isMobile ? "0.82rem" : "0.9rem",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
    verticalAlign: "middle",
  };

  return (
    <div style={{ marginTop: 8, overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 12,
          overflow: "hidden",
          background: "rgba(15, 23, 42, 0.55)",
        }}
      >
        <thead>
          <tr
            style={{
              background: "rgba(31, 41, 55, 0.95)",
              color: "#e5e7eb",
            }}
          >
            <th style={thBase}>{isMobile ? "아이콘" : "이름"}</th>
            <th style={thBase}>{isMobile ? "가격" : "현재 가격"}</th>
            <th style={thBase}>전일 가격, 대비</th>
            <th style={thBase}>전주 가격, 대비</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ color: "#e5e7eb" }}>
              <td style={{ ...tdBase, minWidth: isMobile ? 56 : 220 }}>
                <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 0 : 10 }}>
                  <div
                    style={{
                      width: isMobile ? 30 : 28,
                      height: isMobile ? 30 : 28,
                      borderRadius: 6,
                      overflow: "hidden",
                      border: "1px solid rgba(148,163,184,0.35)",
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "0 0 auto",
                    }}
                    title={r.name}
                  >
                    <img
                      src={`/item_image/item_${imageFileName(r.name)}.png`}
                      alt={r.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>

                  {!isMobile && <span style={{ whiteSpace: "nowrap" }}>{r.name}</span>}
                </div>
              </td>

              <td style={tdBase}>
                {r.price == null ? (
                  <span style={{ opacity: 0.6 }}>-</span>
                ) : (
                  <span
                    title={`${r.price.toLocaleString("ko-KR")} 메소`}
                    style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
                  >
                    {formatToEok(r.price)}
                  </span>
                )}
              </td>

              <td style={tdBase}>
                <ChangeWithPrice prevPrice={r.prevDayPrice} pct={r.dayChangePct} formatToEok={formatToEok} />
              </td>

              <td style={tdBase}>
                <ChangeWithPrice prevPrice={r.prevWeekPrice} pct={r.weekChangePct} formatToEok={formatToEok} />
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "14px 12px",
                  textAlign: "center",
                  color: "#cbd5e1",
                  opacity: 0.8,
                }}
              >
                표시할 데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// =========================
// ✅ 중복 제거용 공용 로직/훅/컴포넌트
// =========================
const formatDate = (d: Date) => d.toISOString().slice(0, 10);

// 그래프 기본: 최근 7일(오늘 포함)
function getDefaultChartRange() {
  const today = new Date();
  const end = formatDate(today);
  const startD = new Date(today);
  startD.setDate(today.getDate() - 6);
  const start = formatDate(startD);
  return { start, end };
}

// 표는 항상 "latest 기준 8일치"
function getTableRangeFromLatest(latest: string) {
  const end = latest;
  const d = new Date(latest);
  d.setDate(d.getDate() - 7);
  const start = d.toISOString().slice(0, 10);
  return { start, end };
}

function buildGroupState(
  rows: PriceRow[],
  itemNames: string[],
  colorFor: (label: string) => string
): GroupState {
  const filteredRows = rows.filter((r) => itemNames.includes(r.name));
  const dateKeys = [...new Set(filteredRows.map((r) => r.date))].sort();
  const items: string[] = [...new Set(filteredRows.map((r) => r.name))].sort();

  const datasets: Dataset[] = items.map((itemName: string) => {
    const itemData = filteredRows.filter((r) => r.name === itemName);
    const dataPerDate = dateKeys.map((dateKey) => {
      const entry = itemData.find((x) => x.date === dateKey);
      return entry ? entry.price : null;
    });

    return {
      label: itemName,
      data: dataPerDate,
      borderColor: colorFor(itemName),
      borderWidth: 2,
      tension: 0.2,
    };
  });

  return { labels: dateKeys, datasets };
}

async function fetchPriceRows(apiPath: string, startDate: string, endDate: string, itemNames: string[]) {
  const res = await axios.get(apiPath, {
    params: { startDate, endDate, names: itemNames.join(",") },
  });
  return (res.data.data ?? []) as PriceRow[];
}

type PriceSectionConfig = {
  id: string;
  title: string;
  icon: string;
  apiPath: string;
  itemNames: string[];
  showToggleAll?: boolean; // 그래프에서만 "모두 선택/해제" 버튼
};

function usePriceSectionState({
  apiPath,
  itemNames,
  colorFor,
  updateLatestDate,
}: {
  apiPath: string;
  itemNames: string[];
  colorFor: (label: string) => string;
  updateLatestDate?: (maxDate: string) => void; // 기존 그룹들에서만 latestDate 갱신용
}) {
  const { start: defaultStart, end: defaultEnd } = getDefaultChartRange();

  const [view, setView] = useState<"chart" | "table">("table");
  const [show, setShow] = useState(true);

  const [dateStart, setDateStart] = useState<string>(defaultStart);
  const [dateEnd, setDateEnd] = useState<string>(defaultEnd);

  const [chartState, setChartState] = useState<GroupState>(emptyGroupState);
  const [tableState, setTableState] = useState<GroupState>(emptyGroupState);

  const validRange = (s: string, e: string) => s && e && new Date(s) <= new Date(e);

  // 그래프 데이터 fetch
  useEffect(() => {
    if (!validRange(dateStart, dateEnd)) return;

    (async () => {
      try {
        const rows = await fetchPriceRows(apiPath, dateStart, dateEnd, itemNames);
        const state = buildGroupState(rows, itemNames, colorFor);
        setChartState(state);

        const maxDate = state.labels[state.labels.length - 1] ?? null;
        if (maxDate && updateLatestDate) updateLatestDate(maxDate);
      } catch (err) {
        console.error("price fetch error:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, dateStart, dateEnd, itemNames.join("|")]);

  // 표로 전환되면 최신일 기준 8일치 fetch
  useEffect(() => {
    if (view !== "table") return;
    if (!chartState.labels.length) return;

    const latest = chartState.labels[chartState.labels.length - 1];
    const { start, end } = getTableRangeFromLatest(latest);
    if (!validRange(start, end)) return;

    (async () => {
      try {
        const rows = await fetchPriceRows(apiPath, start, end, itemNames);
        const state = buildGroupState(rows, itemNames, colorFor);
        setTableState(state);
      } catch (err) {
        console.error("table fetch error:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, chartState.labels.length, apiPath, itemNames.join("|")]);

  // 첫 진입이 표이므로: chart 로딩 완료 후 table도 한 번 바로 채움
  useEffect(() => {
    if (view !== "table") return;
    if (!chartState.labels.length) return;

    const latest = chartState.labels[chartState.labels.length - 1];
    const { start, end } = getTableRangeFromLatest(latest);
    if (!validRange(start, end)) return;

    (async () => {
      try {
        const rows = await fetchPriceRows(apiPath, start, end, itemNames);
        const state = buildGroupState(rows, itemNames, colorFor);
        setTableState(state);
      } catch (err) {
        console.error("table init fetch error:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartState.labels.length]);

  return {
    view,
    setView,
    show,
    setShow,
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    chartState,
    tableState,
  };
}

function PriceSection({
  cfg,
  section,
  isMobile,
  hiddenLabels,
  onToggleLabel,
  headerMiniBtn,
  lineOptions,
  formatToEok,
  toggleAllForLabels,
}: {
  cfg: PriceSectionConfig;
  section: ReturnType<typeof usePriceSectionState>;
  isMobile: boolean;
  hiddenLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  headerMiniBtn: CSSProperties;
  lineOptions: any;
  formatToEok: (v: number) => string;
  toggleAllForLabels: (labels: string[]) => void;
}) {
  const labels = section.chartState.datasets.map((ds) => ds.label);
  const allHidden = labels.length > 0 && labels.every((lbl) => hiddenLabels.has(lbl));

  return (
    <section className={`${styles.card} ${styles["chart-card"]}`}>
      <div className={styles["chart-header"]}>
        <div className={styles["chart-title-wrap"]}>
          <img src={cfg.icon} alt={cfg.title} className={styles["set-icon"]} />
          <h2>{cfg.title}</h2>

          {cfg.showToggleAll && section.view === "chart" && (
            <button
              type="button"
              style={{
                marginLeft: 8,
                fontSize: "0.75rem",
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "transparent",
                color: "#e5e7eb",
                cursor: "pointer",
              }}
              onClick={() => toggleAllForLabels(labels)}
            >
              {allHidden ? "모두 선택" : "모두 해제"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={headerMiniBtn}
            onClick={() => section.setView((v) => (v === "chart" ? "table" : "chart"))}
          >
            {section.view === "chart" ? "표" : "그래프"}
          </button>

          <button className={styles["toggle-btn"]} onClick={() => section.setShow((p) => !p)}>
            {section.show ? "접기 ▲" : "펼치기 ▼"}
          </button>
        </div>
      </div>

      {section.view === "chart" && (
        <ItemLegend datasets={section.chartState.datasets} hiddenLabels={hiddenLabels} onToggle={onToggleLabel} />
      )}

      {section.show && (
        <>
          {section.view === "chart" ? (
            <Line
              data={{
                labels: section.chartState.labels,
                datasets: section.chartState.datasets.filter((ds) => !hiddenLabels.has(ds.label)),
              }}
              options={lineOptions}
            />
          ) : (
            <PriceTable groupState={section.tableState} formatToEok={formatToEok} isMobile={isMobile} />
          )}
        </>
      )}

      {section.view === "chart" && (
        <div className="mt-8 w-full flex justify-end gap-3">
          <div>
            <label className="mr-4">시작 날짜:</label>
            <input
              type="date"
              value={section.dateStart}
              onChange={(e) => section.setDateStart(e.target.value)}
              className="bg-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mr-4">종료 날짜:</label>
            <input
              type="date"
              value={section.dateEnd}
              onChange={(e) => section.setDateEnd(e.target.value)}
              className="bg-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const isMobile = useIsMobile(640);

  // ====== 뉴스 관련 상태 ======
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [newsFilter, setNewsFilter] = useState<NewsType | "전체">("전체");

  // ====== ✅ 챌린저스 섹션 펼치기/접기 ======
  const [showChallengers, setShowChallengers] = useState(false);

  const [searchName, setSearchName] = useState("");
  const [latestDate, setLatestDate] = useState<string | null>(null);

  // ====== 요약 카드 + 모달에서 사용할 마켓 정보 ======
  const [selectedMarketItem, setSelectedMarketItem] = useState<MarketItem>("메소 마켓");
  const [marketToday, setMarketToday] = useState<number | null>(null);
  const [marketChange, setMarketChange] = useState<number | null>(null);
  const [marketLatestDate, setMarketLatestDate] = useState<string | null>(null);
  const [marketHistory, setMarketHistory] = useState<MesoPoint[]>([]);
  const [mesoModalOpen, setMesoModalOpen] = useState(false);

  // 🔥 그래프 기본 숨김 아이템 (그래프에서만 사용)
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(
    () => new Set(["창세의 뱃지", "컴플리트 언더컨트롤"])
  );

  const handleToggleLabel = (label: string) => {
    setHiddenLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleAllForLabels = (labels: string[]) => {
    setHiddenLabels((prev) => {
      const next = new Set(prev);
      const allHidden = labels.length > 0 && labels.every((lbl) => next.has(lbl));
      if (allHidden) labels.forEach((lbl) => next.delete(lbl));
      else labels.forEach((lbl) => next.add(lbl));
      return next;
    });
  };

  const formatToEok = (value: number) => {
    const eok = value / 100000000;
    if (eok >= 10) return `${Math.round(eok)}억`;
    return `${eok.toFixed(1)}억`;
  };

  const colorFor = (label: string) => {
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 55%)`;
  };

  // ✅ latestDate 갱신(기존 그룹들에서만)
  const updateLatestDate = (maxDate: string) => {
    setLatestDate((prev) => {
      if (!prev) return maxDate;
      return prev > maxDate ? prev : maxDate;
    });
  };

  // ====== 섹션 Config ======
  const NORMAL_GROUPS: PriceSectionConfig[] = [
    {
      id: "chilheuk",
      title: "칠흑 시세",
      icon: "/item_image/item_혼돈의 칠흑 장신구 상자.png",
      apiPath: "/api/price",
      itemNames: groupDefs.칠흑,
      showToggleAll: true,
    },
    {
      id: "eternel",
      title: "에테르넬 시세",
      icon: "/item_image/item_맹세의 에테르넬 방어구 상자.png",
      apiPath: "/api/price",
      itemNames: groupDefs.에테르넬,
      showToggleAll: true,
    },
    {
      id: "seed",
      title: "시드링 시세",
      icon: "/item_image/item_백옥의 보스 반지 상자.png",
      apiPath: "/api/price",
      itemNames: groupDefs.시드링,
      showToggleAll: true,
    },
  ];

  const CHALLENGER_GROUPS: PriceSectionConfig[] = [
    {
      id: "chYeo",
      title: "(챌)여명 시세",
      icon: "/item_image/item_여명 세트 변환 주문서.png",
      apiPath: "/api/challenger_price",
      itemNames: challengerGroupDefs["챌여명"],
      showToggleAll: true,
    },
    {
      id: "chChil",
      title: "(챌)칠흑 시세",
      icon: "/item_image/item_혼돈의 칠흑 장신구 상자.png",
      apiPath: "/api/challenger_price",
      itemNames: challengerGroupDefs["챌칠흑"],
      showToggleAll: true,
    },
    {
      id: "chSeed",
      title: "(챌)시드링 시세",
      icon: "/item_image/item_백옥의 보스 반지 상자.png",
      apiPath: "/api/challenger_price",
      itemNames: challengerGroupDefs["챌시드링"],
      showToggleAll: true,
    },
  ];

  // ====== ✅ 섹션 상태(훅) ======
  const normalSections = NORMAL_GROUPS.map((cfg) =>
    usePriceSectionState({
      apiPath: cfg.apiPath,
      itemNames: cfg.itemNames,
      colorFor,
      updateLatestDate,
    })
  );

  const challengerSections = CHALLENGER_GROUPS.map((cfg) =>
    usePriceSectionState({
      apiPath: cfg.apiPath,
      itemNames: cfg.itemNames,
      colorFor,
    })
  );

  // ====== 2) 마켓 데이터 ======
  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  const fetchMarket = (item: MarketItem) => {
    if (item === "솔 에르다 조각(챌1)") {
      const end = formatDate(new Date());
      const startD = new Date();
      startD.setDate(startD.getDate() - 29);
      const start = formatDate(startD);

      axios
        .get("/api/challenger_price", {
          params: {
            startDate: start,
            endDate: end,
            names: "솔 에르다 조각",
          },
        })
        .then((res) => {
          const rows: PriceRow[] = res.data.data || [];
          const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
          const points: MesoPoint[] = sorted.map((r) => ({ date: r.date, price: r.price }));

          const todayPrice = points.length ? points[points.length - 1].price : null;
          const prevPrice = points.length >= 2 ? points[points.length - 2].price : null;

          const changePercent =
            todayPrice != null && prevPrice != null && prevPrice !== 0
              ? ((todayPrice - prevPrice) / prevPrice) * 100
              : null;

          setSelectedMarketItem(item);
          setMarketHistory(points);
          setMarketToday(todayPrice);
          setMarketChange(changePercent);
          setMarketLatestDate(points.length ? points[points.length - 1].date : null);
        })
        .catch((err) => {
          console.error("challenger market fetch error:", err);
        });

      return;
    }

    axios
      .get(`/api/etc?item=${encodeURIComponent(item)}`)
      .then((res) => {
        const {
          points,
          todayPrice,
          changePercent,
        }: {
          points: MesoPoint[];
          todayPrice: number | null;
          changePercent: number | null;
        } = res.data;

        setSelectedMarketItem(item);
        setMarketHistory(points || []);
        setMarketToday(todayPrice);
        setMarketChange(changePercent);
        const latest = points.length > 0 ? points[points.length - 1].date : null;
        setMarketLatestDate(latest);
      })
      .catch((err) => {
        console.error("market fetch error:", err);
      });
  };

  useEffect(() => {
    fetchMarket("메소 마켓");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        setMesoModalOpen(false);
        setNewsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ====== 3) 뉴스 데이터 ======
  useEffect(() => {
    axios
      .get("/api/notice")
      .then((res) => {
        const raw: NoticeRow[] = res.data.data;

        const mapped: NewsItem[] = raw.map((n) => ({
          id: n.id,
          type: convertType(n.type),
          title: n.title,
          content: n.content,
          createdAt: n.createdAt,
        }));

        setNewsItems(mapped);
      })
      .catch((err) => {
        console.error("notice fetch error:", err);
      });
  }, []);

  const isPriceLoading = normalSections.every((s) => !s.chartState.labels.length);
  if (isPriceLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>데이터 불러오는 중...</div>
      </main>
    );
  }

  // 🔍 드/메 페이지로 이동
  const handleCharacterSearch = () => {
    const trimmed = searchName.trim();
    if (!trimmed) return;
    router.push(`/dropmeso?search=${encodeURIComponent(trimmed)}`);
  };

  // ====== 메인 그래프 옵션 ======
  const lineOptions: any = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || "";
            const value = context.parsed.y as number;
            const pretty = value.toLocaleString("ko-KR");
            const eok = formatToEok(value);
            return `${label}: ${pretty} 메소 (${eok})`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "category",
        ticks: { color: "#9ca3af" },
        grid: { color: "rgba(148, 163, 184, 0.15)" },
      },
      y: {
        ticks: {
          color: "#9ca3af",
          callback: (value: any) => {
            const num = Number(value);
            if (isNaN(num)) return value;
            return formatToEok(num);
          },
        },
        grid: { color: "rgba(148, 163, 184, 0.15)" },
      },
    },
  };

  // ====== 모달 그래프 ======
  const modalLabels = marketHistory.map((p) => p.date.slice(5));
  const modalData = marketHistory.map((p) => p.price);

  const modalChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const v = ctx.parsed.y as number;
            if (selectedMarketItem === "메소 마켓") {
              return `${v.toLocaleString("ko-KR")} 메포 / 1억 메소`;
            }
            return `${v.toLocaleString("ko-KR")} 메소`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "category",
        ticks: { color: "#9ca3af" },
        grid: { color: "rgba(75, 85, 99, 0.3)" },
      },
      y: {
        position: "right",
        ticks: {
          color: "#9ca3af",
          callback: (v: any) => Number(v).toLocaleString("ko-KR"),
        },
        grid: { color: "rgba(75, 85, 99, 0.25)" },
      },
    },
  };

  // ====== 타입별 최신 글 ======
  const latestByType = (type: NewsType): NewsItem | undefined =>
    newsItems
      .filter((n) => n.type === type)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const latestNews = latestByType("뉴스");
  const latestUpdate = latestByType("업데이트");
  const latestNotice = latestByType("공지");

  // 공통 버튼 스타일
  const headerMiniBtn: CSSProperties = {
    fontSize: "0.78rem",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  // ✅ 요약카드 제목 (모바일에서만 '다조 시세'로)
  const summaryTitleText =
    selectedMarketItem === "메소 마켓"
      ? "메소 마켓 시세"
      : selectedMarketItem === "솔 에르다 조각(챌1)"
      ? isMobile
        ? "다조(챌1) 시세"
        : "솔 에르다 조각(챌1) 시세"
      : isMobile
      ? "다조 시세"
      : "솔 에르다 조각 시세";

  // ✅ 요약카드 전일 대비 색: 칠흑 표(ChangeWithPrice)와 동일 규칙
  const marketChangeColor =
    marketChange == null
      ? undefined
      : marketChange > 0
      ? "#ef4444"
      : marketChange < 0
      ? "#3b82f6"
      : "#cbd5e1";

  return (
    <main className={styles.page}>
      {/* Hero Section */}
      <section className={`${styles.hero} md:h-80 md:flex md:justify-center md:items-center`}>
        <div className={styles["hero-bg"]} />
        <div className={`${styles["hero-content"]} md:w-full`}>
          <h1 className={`${styles["hero-title"]} text-2xl md:text-4xl md:-mt-4`}>📈 MAPLE ECONOMY</h1>
          <p className={styles["hero-sub"]}>메이플의 각종 경제지표를 한 눈에.</p>

          <div className={`${styles["search-box"]} mx-auto md:mt-12`}>
            <input
              className={styles["search-input"]}
              placeholder="캐릭터 닉네임으로 입력 시 드/메 템 맞추기로 이동합니다 (추후 변경 예정)."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCharacterSearch();
                }
              }}
            />
            <button className={styles["search-button"]} onClick={handleCharacterSearch}>
              검색
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className={styles.content}>
        <div className={styles["top-grid"]}>
          {/* 뉴스 카드 */}
          <div className={`${styles.card} ${styles["news-card"]}`}>
            <div className={styles["news-header-row"]}>
              <div className={styles["card-title"]}>📢 메이플 경제 뉴스</div>
              <button
                className={styles["news-more-btn"]}
                onClick={() => {
                  setNewsFilter("전체");
                  setNewsModalOpen(true);
                }}
              >
                전체 보기
              </button>
            </div>

            {/* ✅ (2) 모바일은 기존 유지 / 데스크톱만 간격 확대 */}
            <ul
              className={styles["news-list"]}
              style={
                isMobile
                  ? undefined
                  : {
                      display: "flex",
                      flexDirection: "column",
                      gap: 16, // 데스크톱에서만 간격 확대(기존 대비 2배 체감)
                    }
              }
            >
              {latestNews && (
                <li>
                  <span className={`${styles["news-tag"]} ${styles["tag-gold"]}`}>뉴스</span>
                  <span
                    className={styles["news-clickable"]}
                    onClick={() => {
                      setNewsFilter("뉴스");
                      setNewsModalOpen(true);
                    }}
                  >
                    {latestNews.title}
                  </span>
                  <span className={styles["news-date"]}>{latestNews.createdAt.slice(0, 10)}</span>
                </li>
              )}

              {latestUpdate && (
                <li>
                  <span className={`${styles["news-tag"]} ${styles["tag-blue"]}`}>업데이트</span>
                  <span
                    className={styles["news-clickable"]}
                    onClick={() => {
                      setNewsFilter("업데이트");
                      setNewsModalOpen(true);
                    }}
                  >
                    {latestUpdate.title}
                  </span>
                  <span className={styles["news-date"]}>{latestUpdate.createdAt.slice(0, 10)}</span>
                </li>
              )}

              {latestNotice && (
                <li>
                  <span className={`${styles["news-tag"]} ${styles["tag-gray"]}`}>공지</span>
                  <span
                    className={styles["news-clickable"]}
                    onClick={() => {
                      setNewsFilter("공지");
                      setNewsModalOpen(true);
                    }}
                  >
                    {latestNotice.title}
                  </span>
                  <span className={styles["news-date"]}>{latestNotice.createdAt.slice(0, 10)}</span>
                </li>
              )}
            </ul>
          </div>

          {/* 요약 카드 */}
          <div className={`${styles.card} ${styles["summary-card"]}`}>
            <div
              className={styles["summary-header-row"]}
              style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
            >
              <img
                src={
                  selectedMarketItem === "메소 마켓"
                    ? "/item_image/item_메소.png"
                    : "/item_image/item_솔 에르다 조각.png"
                }
                alt={selectedMarketItem}
                className={styles["set-icon"]}
                style={{ flex: "0 0 auto" }}
              />

              <div
                className={styles["summary-title"]}
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  fontSize: isMobile ? "0.95rem" : undefined,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={selectedMarketItem === "메소 마켓" ? "메소 마켓 시세" : "솔 에르다 조각 시세"}
              >
                {summaryTitleText}
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: 6, flex: "0 0 auto", flexShrink: 0 }}>
                {(["메소 마켓", "솔 에르다 조각", "솔 에르다 조각(챌1)"] as MarketItem[])
                  .filter((label) => label !== selectedMarketItem)
                  .map((label) => {
                    const buttonText =
                      label === "솔 에르다 조각"
                        ? "다조"
                        : label === "솔 에르다 조각(챌1)"
                        ? "다조(챌1)"
                        : label;

                    return (
                      <button
                        key={label}
                        className={[styles["news-filter-btn"], styles["market-toggle-btn"]]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => fetchMarket(label)}
                        style={{
                          fontSize: isMobile ? "0.72rem" : undefined,
                          padding: isMobile ? "6px 8px" : undefined,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {buttonText}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className={styles["summary-row"]}>
              <div className={styles["summary-label"]}>오늘 가격</div>
              <div className={`${styles["summary-value"]} ${styles.highlight}`}>
                {marketToday !== null
                  ? selectedMarketItem === "메소 마켓"
                    ? `${marketToday.toLocaleString("ko-KR")} 메포 / 1억 메소`
                    : `${marketToday.toLocaleString("ko-KR")} 메소`
                  : "—"}
              </div>
            </div>

            <div className={styles["summary-row"]}>
              <div className={styles["summary-label"]}>전일 대비</div>
              <div
                className={[styles["summary-value"], styles.change].filter(Boolean).join(" ")}
                style={{ color: marketChangeColor }}
              >
                {marketChange == null
                  ? "—"
                  : `${marketChange > 0 ? "▲" : marketChange < 0 ? "▼" : "―"} ${Math.abs(
                      marketChange
                    ).toFixed(1)}%`}
              </div>
            </div>

            <div className={styles["summary-row"]}>
              <div className={styles["summary-label"]}>데이터 기준일</div>
              <div className={styles["summary-value"]}>{marketLatestDate ?? latestDate ?? "—"}</div>
            </div>

            <button className={styles["graph-btn"]} onClick={() => setMesoModalOpen(true)}>
              📊 그래프 보기
            </button>

            <div className={styles["summary-footer"]}></div>
          </div>
        </div>

        {/* 그래프/표 섹션 */}
        <div className={styles["charts-wrapper"]}>
          {/* ✅ 챌린저스 접기바 */}
          <section
            className={styles.card}
            style={{
              padding: 14,
              borderRadius: 18,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(15, 23, 42, 0.55)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/item_image/item_챌린저스 서버.png" alt="챌린저스" className={styles["set-icon"]} />
              <div
                style={{
                  fontWeight: 800,
                  fontSize: isMobile ? "1rem" : "1.05rem",
                  color: "#e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                챌린저스 시세
              </div>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <button className={styles["toggle-btn"]} onClick={() => setShowChallengers((p) => !p)}>
                  {showChallengers ? "접기 ▲" : "펼치기 ▼"}
                </button>
              </div>
            </div>

            {showChallengers && (
              <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
                {CHALLENGER_GROUPS.map((cfg, idx) => (
                  <PriceSection
                    key={cfg.id}
                    cfg={cfg}
                    section={challengerSections[idx]}
                    isMobile={isMobile}
                    hiddenLabels={hiddenLabels}
                    onToggleLabel={handleToggleLabel}
                    headerMiniBtn={headerMiniBtn}
                    lineOptions={lineOptions}
                    formatToEok={formatToEok}
                    toggleAllForLabels={toggleAllForLabels}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ✅ 기존 3개(중복 제거 렌더링) */}
          {NORMAL_GROUPS.map((cfg, idx) => (
            <PriceSection
              key={cfg.id}
              cfg={cfg}
              section={normalSections[idx]}
              isMobile={isMobile}
              hiddenLabels={hiddenLabels}
              onToggleLabel={handleToggleLabel}
              headerMiniBtn={headerMiniBtn}
              lineOptions={lineOptions}
              formatToEok={formatToEok}
              toggleAllForLabels={toggleAllForLabels}
            />
          ))}
        </div>
      </section>

      {/* 마켓 그래프 모달 */}
      {mesoModalOpen && (
        <div className={styles["modal-backdrop"]} onClick={() => setMesoModalOpen(false)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className={styles["modal-header"]} style={{ flex: "0 0 auto" }}>
              <span>
                {selectedMarketItem === "메소 마켓"
                  ? "메소 마켓 시세 (일별)"
                  : selectedMarketItem === "솔 에르다 조각(챌1)"
                  ? "솔 에르다 조각(챌1) 시세 (일별)"
                  : "솔 에르다 조각 시세 (일별)"}
              </span>
              <button className={styles["modal-close"]} onClick={() => setMesoModalOpen(false)}>
                ✕
              </button>
            </div>

            <div
              className={`${styles["modal-body"]} dark-scroll`}
              style={{
                flex: "1 1 auto",
                overflowY: "auto",
                minHeight: 0,
              }}
            >
              {marketHistory.length === 0 ? (
                <div className={styles["modal-empty"]}>데이터가 없습니다.</div>
              ) : (
                <Line
                  data={{
                    labels: modalLabels,
                    datasets: [
                      {
                        label: selectedMarketItem,
                        data: modalData,
                        borderColor: "#38bdf8",
                        borderWidth: 2,
                        tension: 0.25,
                        pointRadius: 0,
                      },
                    ],
                  }}
                  options={modalChartOptions}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 뉴스 히스토리 모달 */}
      {newsModalOpen && (
        <div className={styles["modal-backdrop"]} onClick={() => setNewsModalOpen(false)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className={styles["modal-header"]} style={{ flex: "0 0 auto" }}>
              <span>메이플 경제 뉴스 히스토리</span>
              <button className={styles["modal-close"]} onClick={() => setNewsModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className={styles["news-filter-row"]} style={{ flex: "0 0 auto" }}>
              {["전체", "뉴스", "업데이트", "공지"].map((t) => (
                <button
                  key={t}
                  className={[
                    styles["news-filter-btn"],
                    newsFilter === t ? styles["news-filter-btn-active"] : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setNewsFilter(t as NewsType | "전체")}
                >
                  {t}
                </button>
              ))}
            </div>

            <div
              className={`${styles["modal-body"]} dark-scroll`}
              style={{
                flex: "1 1 auto",
                overflowY: "auto",
                minHeight: 0,
              }}
            >
              <div className={styles["news-history-list"]}>
                {newsItems
                  .filter((n) => newsFilter === "전체" || n.type === newsFilter)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((n) => (
                    <div key={n.id} className={styles["news-history-item"]}>
                      <div className={styles["news-history-header"]}>
                        <span
                          className={`${styles["news-tag"]} ${
                            n.type === "뉴스"
                              ? styles["tag-gold"]
                              : n.type === "업데이트"
                              ? styles["tag-blue"]
                              : styles["tag-gray"]
                          }`}
                        >
                          {n.type}
                        </span>
                        <span className={styles["news-history-date"]}>{n.createdAt}</span>
                      </div>
                      <div className={styles["news-history-title"]}>{n.title}</div>
                      <div className={styles["news-history-summary"]}>{n.content}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ (1) 다크 톤 스크롤바 스타일 */}
      <style jsx global>{`
        .dark-scroll {
          scrollbar-width: thin; /* Firefox */
          scrollbar-color: rgba(148, 163, 184, 0.35) rgba(15, 23, 42, 0.25);
        }

        .dark-scroll::-webkit-scrollbar {
          width: 10px;
        }

        .dark-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.25);
          border-radius: 999px;
        }

        .dark-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.28);
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.35);
        }

        .dark-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.4);
        }
      `}</style>
    </main>
  );
}
