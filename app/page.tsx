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
type MarketItem = "메소 마켓" | "솔 에르다 조각";

type NewsItem = {
  id: number;
  type: NewsType;
  title: string;
  content: string;
  createdAt: string;
};

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
    "블랙 하트",
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

type GroupKey = "칠흑" | "에테르넬" | "시드링";

type GroupState = {
  labels: string[];
  datasets: Dataset[];
};

const emptyGroupState: GroupState = { labels: [], datasets: [] };

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

  const thBase: React.CSSProperties = {
    textAlign: "left",
    padding: isMobile ? "10px 8px" : "12px 12px",
    fontSize: isMobile ? "0.8rem" : "0.85rem",
    borderBottom: "1px solid rgba(148,163,184,0.25)",
    whiteSpace: "nowrap",
  };

  const tdBase: React.CSSProperties = {
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

export default function Home() {
  const router = useRouter();
  const isMobile = useIsMobile(640);

  // ====== 뉴스 관련 상태 ======
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [newsFilter, setNewsFilter] = useState<NewsType | "전체">("전체");

  // ====== 아이템 시세 (그룹별) ======
  const [chilheukState, setChilheukState] = useState<GroupState>(emptyGroupState);
  const [eternelState, setEternelState] = useState<GroupState>(emptyGroupState);
  const [seedRingState, setSeedRingState] = useState<GroupState>(emptyGroupState);

  // ✅ 표 전용(항상 8일치) 상태
  const [chilheukTableState, setChilheukTableState] = useState<GroupState>(emptyGroupState);
  const [eternelTableState, setEternelTableState] = useState<GroupState>(emptyGroupState);
  const [seedTableState, setSeedTableState] = useState<GroupState>(emptyGroupState);

  const [showChilheuk, setShowChilheuk] = useState(true);
  const [showEternel, setShowEternel] = useState(true);
  const [showSeed, setShowSeed] = useState(true);

  // ✅ 표/그래프 토글 상태 (그룹별) - 🔥 기본은 표
  const [chilheukView, setChilheukView] = useState<"chart" | "table">("table");
  const [eternelView, setEternelView] = useState<"chart" | "table">("table");
  const [seedView, setSeedView] = useState<"chart" | "table">("table");

  const [searchName, setSearchName] = useState("");
  const [latestDate, setLatestDate] = useState<string | null>(null);

  // ====== 요약 카드 + 모달에서 사용할 마켓 정보 ======
  const [selectedMarketItem, setSelectedMarketItem] = useState<MarketItem>("메소 마켓");
  const [marketToday, setMarketToday] = useState<number | null>(null);
  const [marketChange, setMarketChange] = useState<number | null>(null);
  const [marketLatestDate, setMarketLatestDate] = useState<string | null>(null);
  const [marketHistory, setMarketHistory] = useState<MesoPoint[]>([]);
  const [mesoModalOpen, setMesoModalOpen] = useState(false);

  // ====== 날짜 범위 선택 상태 (그래프용) ======
  const [chilheukDateStart, setchilheukDateStart] = useState<string>("");
  const [chilheukDateEnd, setchilheukDateEnd] = useState<string>("");
  const [eternelDateStart, setEternelDateStart] = useState<string>("");
  const [eternelDateEnd, setEternelDateEnd] = useState<string>("");
  const [seedRingDateStart, setSeedRingDateStart] = useState<string>("");
  const [seedRingDateEnd, setSeedRingDateEnd] = useState<string>("");

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

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  // ✅ 표는 항상 "오늘 포함 8일치" (오늘 ~ 7일 전)
  const getTableRangeFromLatest = (latest: string) => {
    const end = latest;
    const d = new Date(latest);
    d.setDate(d.getDate() - 7);
    const start = d.toISOString().slice(0, 10);
    return { start, end };
  };

  // ====== 1-1) 최초 로딩 시: 그래프는 최근 7일(오늘 포함 7일 = 6일 전부터) ======
  useEffect(() => {
    const today = new Date();
    const end = formatDate(today);
    const startDate = new Date();
    startDate.setDate(today.getDate() - 6);
    const start = formatDate(startDate);

    setchilheukDateStart(start);
    setchilheukDateEnd(end);
    setEternelDateStart(start);
    setEternelDateEnd(end);
    setSeedRingDateStart(start);
    setSeedRingDateEnd(end);
  }, []);

  // ====== 공통 fetch (setter로 넣어서 재사용) ======
  const fetchGroupPrice = async (
    group: GroupKey,
    startDate: string,
    endDate: string,
    setter: (s: GroupState) => void
  ) => {
    if (!startDate || !endDate) return;
    if (new Date(startDate) > new Date(endDate)) return;

    const itemNames = groupDefs[group];

    try {
      const res = await axios.get("/api/price", {
        params: {
          startDate,
          endDate,
          names: itemNames.join(","),
        },
      });

      const rows: PriceRow[] = res.data.data;
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

      const groupState: GroupState = { labels: dateKeys, datasets };
      setter(groupState);

      const maxDate = dateKeys[dateKeys.length - 1] ?? null;
      if (maxDate) {
        setLatestDate((prev) => {
          if (!prev) return maxDate;
          return prev > maxDate ? prev : maxDate;
        });
      }
    } catch (err) {
      console.error("price fetch error:", err);
    }
  };

  // ====== 1-2) 그래프용 fetch ======
  useEffect(() => {
    if (!chilheukDateStart || !chilheukDateEnd) return;
    fetchGroupPrice("칠흑", chilheukDateStart, chilheukDateEnd, setChilheukState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chilheukDateStart, chilheukDateEnd]);

  useEffect(() => {
    if (!eternelDateStart || !eternelDateEnd) return;
    fetchGroupPrice("에테르넬", eternelDateStart, eternelDateEnd, setEternelState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eternelDateStart, eternelDateEnd]);

  useEffect(() => {
    if (!seedRingDateStart || !seedRingDateEnd) return;
    fetchGroupPrice("시드링", seedRingDateStart, seedRingDateEnd, setSeedRingState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedRingDateStart, seedRingDateEnd]);

  // ✅ 표로 전환될 때는 자동으로 8일치 데이터 fetch
  useEffect(() => {
    if (chilheukView !== "table") return;
    if (!chilheukState.labels.length) return;

    const latest = chilheukState.labels[chilheukState.labels.length - 1];
    const { start, end } = getTableRangeFromLatest(latest);
    fetchGroupPrice("칠흑", start, end, setChilheukTableState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chilheukView, chilheukState.labels]);

  useEffect(() => {
    if (eternelView !== "table") return;
    if (!eternelState.labels.length) return;

    const latest = eternelState.labels[eternelState.labels.length - 1];
    const { start, end } = getTableRangeFromLatest(latest);
    fetchGroupPrice("에테르넬", start, end, setEternelTableState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eternelView, eternelState.labels]);

  useEffect(() => {
    if (seedView !== "table") return;
    if (!seedRingState.labels.length) return;

    const latest = seedRingState.labels[seedRingState.labels.length - 1];
    const { start, end } = getTableRangeFromLatest(latest);
    fetchGroupPrice("시드링", start, end, setSeedTableState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedView, seedRingState.labels]);

  // ✅ 첫 진입이 "표"이므로, 데이터 로딩 후 표용 8일치도 바로 가져오게 처리
  useEffect(() => {
    if (chilheukView === "table" && chilheukState.labels.length) {
      const latest = chilheukState.labels[chilheukState.labels.length - 1];
      const { start, end } = getTableRangeFromLatest(latest);
      fetchGroupPrice("칠흑", start, end, setChilheukTableState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chilheukState.labels.length]);

  useEffect(() => {
    if (eternelView === "table" && eternelState.labels.length) {
      const latest = eternelState.labels[eternelState.labels.length - 1];
      const { start, end } = getTableRangeFromLatest(latest);
      fetchGroupPrice("에테르넬", start, end, setEternelTableState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eternelState.labels.length]);

  useEffect(() => {
    if (seedView === "table" && seedRingState.labels.length) {
      const latest = seedRingState.labels[seedRingState.labels.length - 1];
      const { start, end } = getTableRangeFromLatest(latest);
      fetchGroupPrice("시드링", start, end, setSeedTableState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedRingState.labels.length]);

  // ====== 2) 마켓 데이터 ======
  const fetchMarket = (item: MarketItem) => {
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

  const isPriceLoading =
    !chilheukState.labels.length &&
    !eternelState.labels.length &&
    !seedRingState.labels.length;

  if (isPriceLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>데이터 불러오는 중...</div>
      </main>
    );
  }

  // ====== 모두 선택/해제 계산 (그래프용) ======
  const chilheukLabels = chilheukState.datasets.map((ds) => ds.label);
  const eternelLabels = eternelState.datasets.map((ds) => ds.label);
  const seedRingLabels = seedRingState.datasets.map((ds) => ds.label);

  const chilheukAllHidden =
    chilheukLabels.length > 0 && chilheukLabels.every((lbl) => hiddenLabels.has(lbl));
  const eternelAllHidden =
    eternelLabels.length > 0 && eternelLabels.every((lbl) => hiddenLabels.has(lbl));
  const seedRingAllHidden =
    seedRingLabels.length > 0 && seedRingLabels.every((lbl) => hiddenLabels.has(lbl));

  const toggleAllForLabels = (labels: string[]) => {
    setHiddenLabels((prev) => {
      const next = new Set(prev);
      const allHidden = labels.length > 0 && labels.every((lbl) => next.has(lbl));

      if (allHidden) labels.forEach((lbl) => next.delete(lbl));
      else labels.forEach((lbl) => next.add(lbl));
      return next;
    });
  };

  // 🔍 드/메 페이지로 이동하는 공통 검색 함수
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
  const headerMiniBtn: React.CSSProperties = {
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
      : isMobile
      ? "다조 시세"
      : "솔 에르다 조각 시세";

  return (
    <main className={styles.page}>
      {/* Hero Section */}
      <section className={`${styles.hero} md:h-80 md:flex md:justify-center md:items-center`}>
        <div className={styles["hero-bg"]} />
        <div className={`${styles["hero-content"]} md:w-full`}>
          <h1 className={`${styles["hero-title"]} text-2xl md:text-4xl md:-mt-4`}>
            📈 MAPLE ECONOMY
          </h1>

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
            <ul className={styles["news-list"]}>
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                // ✅ 한 줄 유지 + 넘치면 title 쪽이 줄어들게
                minWidth: 0,
              }}
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

              {/* ✅ title은 남는 공간을 먹되, 길면 ... 처리(버튼은 밀리지 않음) */}
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

              {/* ✅ 우측 버튼은 항상 우측 고정(줄어들지 않게) */}
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  gap: 6,
                  flex: "0 0 auto",
                  flexShrink: 0,
                }}
              >
                {["메소 마켓", "솔 에르다 조각"].map((label) => (
                  <button
                    key={label}
                    className={[
                      styles["news-filter-btn"],
                      styles["market-toggle-btn"],
                      selectedMarketItem === label ? styles["news-filter-btn-active"] : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => fetchMarket(label as MarketItem)}
                    style={{
                      fontSize: isMobile ? "0.72rem" : undefined,
                      padding: isMobile ? "6px 8px" : undefined,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </button>
                ))}
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
                className={[
                  styles["summary-value"],
                  styles.change,
                  marketChange != null
                    ? marketChange > 0
                      ? styles.up
                      : marketChange < 0
                      ? styles.down
                      : ""
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
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
          {/* 칠흑 세트 */}
          <section className={`${styles.card} ${styles["chart-card"]}`}>
            <div className={styles["chart-header"]}>
              <div className={styles["chart-title-wrap"]}>
                <img
                  src="/item_image/item_혼돈의 칠흑 장신구 상자.png"
                  alt="칠흑"
                  className={styles["set-icon"]}
                />
                <h2>칠흑 시세</h2>

                {chilheukView === "chart" && (
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
                    onClick={() => toggleAllForLabels(chilheukLabels)}
                  >
                    {chilheukAllHidden ? "모두 선택" : "모두 해제"}
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  style={headerMiniBtn}
                  onClick={() => setChilheukView((v) => (v === "chart" ? "table" : "chart"))}
                >
                  {chilheukView === "chart" ? "표" : "그래프"}
                </button>

                <button className={styles["toggle-btn"]} onClick={() => setShowChilheuk((p) => !p)}>
                  {showChilheuk ? "접기 ▲" : "펼치기 ▼"}
                </button>
              </div>
            </div>

            {chilheukView === "chart" && (
              <ItemLegend datasets={chilheukState.datasets} hiddenLabels={hiddenLabels} onToggle={handleToggleLabel} />
            )}

            {showChilheuk && (
              <>
                {chilheukView === "chart" ? (
                  <Line
                    data={{
                      labels: chilheukState.labels,
                      datasets: chilheukState.datasets.filter((ds) => !hiddenLabels.has(ds.label)),
                    }}
                    options={lineOptions}
                  />
                ) : (
                  <PriceTable groupState={chilheukTableState} formatToEok={formatToEok} isMobile={isMobile} />
                )}
              </>
            )}

            {chilheukView === "chart" && (
              <div className="mt-8 w-full flex justify-end gap-3">
                <div>
                  <label className="mr-4">시작 날짜:</label>
                  <input
                    type="date"
                    value={chilheukDateStart}
                    onChange={(e) => setchilheukDateStart(e.target.value)}
                    className="bg-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mr-4">종료 날짜:</label>
                  <input
                    type="date"
                    value={chilheukDateEnd}
                    onChange={(e) => setchilheukDateEnd(e.target.value)}
                    className="bg-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 에테르넬 세트 */}
          <section className={`${styles.card} ${styles["chart-card"]}`}>
            <div className={styles["chart-header"]}>
              <div className={styles["chart-title-wrap"]}>
                <img
                  src="/item_image/item_맹세의 에테르넬 방어구 상자.png"
                  alt="에테르넬"
                  className={styles["set-icon"]}
                />
                <h2>에테르넬 시세</h2>

                {eternelView === "chart" && (
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
                    onClick={() => toggleAllForLabels(eternelLabels)}
                  >
                    {eternelAllHidden ? "모두 선택" : "모두 해제"}
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  style={headerMiniBtn}
                  onClick={() => setEternelView((v) => (v === "chart" ? "table" : "chart"))}
                >
                  {eternelView === "chart" ? "표" : "그래프"}
                </button>

                <button className={styles["toggle-btn"]} onClick={() => setShowEternel((p) => !p)}>
                  {showEternel ? "접기 ▲" : "펼치기 ▼"}
                </button>
              </div>
            </div>

            {eternelView === "chart" && (
              <ItemLegend datasets={eternelState.datasets} hiddenLabels={hiddenLabels} onToggle={handleToggleLabel} />
            )}

            {showEternel && (
              <>
                {eternelView === "chart" ? (
                  <Line
                    data={{
                      labels: eternelState.labels,
                      datasets: eternelState.datasets.filter((ds) => !hiddenLabels.has(ds.label)),
                    }}
                    options={lineOptions}
                  />
                ) : (
                  <PriceTable groupState={eternelTableState} formatToEok={formatToEok} isMobile={isMobile} />
                )}
              </>
            )}

            {eternelView === "chart" && (
              <div className="mt-8 w-full flex justify-end gap-3">
                <div>
                  <label className="mr-4">시작 날짜:</label>
                  <input
                    type="date"
                    value={eternelDateStart}
                    onChange={(e) => setEternelDateStart(e.target.value)}
                    className="bg-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mr-4">종료 날짜:</label>
                  <input
                    type="date"
                    value={eternelDateEnd}
                    onChange={(e) => setEternelDateEnd(e.target.value)}
                    className="bg-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 시드링 세트 */}
          <section className={`${styles.card} ${styles["chart-card"]}`}>
            <div className={styles["chart-header"]}>
              <div className={styles["chart-title-wrap"]}>
                <img
                  src="/item_image/item_백옥의 보스 반지 상자.png"
                  alt="시드링"
                  className={styles["set-icon"]}
                />
                <h2>시드링 시세</h2>

                {seedView === "chart" && (
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
                    onClick={() => toggleAllForLabels(seedRingLabels)}
                  >
                    {seedRingAllHidden ? "모두 선택" : "모두 해제"}
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  style={headerMiniBtn}
                  onClick={() => setSeedView((v) => (v === "chart" ? "table" : "chart"))}
                >
                  {seedView === "chart" ? "표" : "그래프"}
                </button>

                <button className={styles["toggle-btn"]} onClick={() => setShowSeed((p) => !p)}>
                  {showSeed ? "접기 ▲" : "펼치기 ▼"}
                </button>
              </div>
            </div>

            {seedView === "chart" && (
              <ItemLegend datasets={seedRingState.datasets} hiddenLabels={hiddenLabels} onToggle={handleToggleLabel} />
            )}

            {showSeed && (
              <>
                {seedView === "chart" ? (
                  <Line
                    data={{
                      labels: seedRingState.labels,
                      datasets: seedRingState.datasets.filter((ds) => !hiddenLabels.has(ds.label)),
                    }}
                    options={lineOptions}
                  />
                ) : (
                  <PriceTable groupState={seedTableState} formatToEok={formatToEok} isMobile={isMobile} />
                )}
              </>
            )}

            {seedView === "chart" && (
              <div className="mt-8 w-full flex justify-end gap-3">
                <div>
                  <label className="mr-4">시작 날짜:</label>
                  <input
                    type="date"
                    value={seedRingDateStart}
                    onChange={(e) => setSeedRingDateStart(e.target.value)}
                    className="bg-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mr-4">종료 날짜:</label>
                  <input
                    type="date"
                    value={seedRingDateEnd}
                    onChange={(e) => setSeedRingDateEnd(e.target.value)}
                    className="bg-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      {/* 마켓 그래프 모달 */}
      {mesoModalOpen && (
        <div className={styles["modal-backdrop"]} onClick={() => setMesoModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <span>
                {selectedMarketItem === "메소 마켓"
                  ? "메소 마켓 시세 (일별)"
                  : "솔 에르다 조각 시세 (일별)"}
              </span>
              <button className={styles["modal-close"]} onClick={() => setMesoModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className={styles["modal-body"]}>
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
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <span>메이플 경제 뉴스 히스토리</span>
              <button className={styles["modal-close"]} onClick={() => setNewsModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className={styles["news-filter-row"]}>
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

            <div className={styles["modal-body"]}>
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
    </main>
  );
}
