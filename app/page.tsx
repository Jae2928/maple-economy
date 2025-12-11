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
import { useEffect, useState } from "react";
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
  date: string;
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
  content: string;          // 🔹 summary → content
  createdAt: string;
};

type NewsType = "뉴스" | "업데이트" | "공지";
type MarketItem = "메소 마켓" | "솔 에르다 조각";

type NewsItem = {
  id: number;
  type: NewsType;
  title: string;
  content: string;          // 🔹 summary → content
  createdAt: string;
};

const convertType = (type: NoticeRow["type"]): NewsType =>
  type === "NEWS" ? "뉴스" : type === "UPDATE" ? "업데이트" : "공지";

// 아이템 이름 → 이미지 파일명
const imageFileName = (name: string) => {
  if (name === "미트라의 분노 : 전사") return "미트라의 분노 전사";
  return name.replace(/[:]/g, "");
};

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

export default function Home() {
  const router = useRouter();
  
  // ====== 뉴스 관련 상태 ======
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [newsFilter, setNewsFilter] = useState<NewsType | "전체">("전체");

  // ====== 아이템 시세 그래프 상태 (그룹별) ======
  const [chilheukState, setChilheukState] =
    useState<GroupState>(emptyGroupState);
  const [eternelState, setEternelState] =
    useState<GroupState>(emptyGroupState);
  const [seedRingState, setSeedRingState] =
    useState<GroupState>(emptyGroupState);

  const [showChilheuk, setShowChilheuk] = useState(true);
  const [showEternel, setShowEternel] = useState(true);
  const [showSeed, setShowSeed] = useState(true);

  const [searchName, setSearchName] = useState("");

  const [latestDate, setLatestDate] = useState<string | null>(null);

  // ====== 요약 카드 + 모달에서 사용할 마켓 정보 ======
  const [selectedMarketItem, setSelectedMarketItem] =
    useState<MarketItem>("메소 마켓");
  const [marketToday, setMarketToday] = useState<number | null>(null);
  const [marketChange, setMarketChange] = useState<number | null>(null);
  const [marketLatestDate, setMarketLatestDate] = useState<string | null>(null);
  const [marketHistory, setMarketHistory] = useState<MesoPoint[]>([]);
  const [mesoModalOpen, setMesoModalOpen] = useState(false);

  // ====== 날짜 범위 선택 상태 (칠흑, 에테르넬, 시드링) ======
  const [chilheukDateStart, setchilheukDateStart] = useState<string>("");
  const [chilheukDateEnd, setchilheukDateEnd] = useState<string>("");
  const [eternelDateStart, setEternelDateStart] = useState<string>("");
  const [eternelDateEnd, setEternelDateEnd] = useState<string>("");
  const [seedRingDateStart, setSeedRingDateStart] = useState<string>("");
  const [seedRingDateEnd, setSeedRingDateEnd] = useState<string>("");

  // 🔥 기본으로 숨길 아이템
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

  // ====== 1-1) 최초 로딩 시: 최근 7일 날짜 범위 세팅 ======
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

  // ====== 1-2) 그룹별로 /api/price 호출 ======
  const fetchGroupPrice = async (
    group: GroupKey,
    startDate: string,
    endDate: string
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
      const items: string[] = [
        ...new Set(filteredRows.map((r) => r.name)),
      ].sort();

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

      const groupState: GroupState = {
        labels: dateKeys,
        datasets,
      };

      if (group === "칠흑") setChilheukState(groupState);
      else if (group === "에테르넬") setEternelState(groupState);
      else setSeedRingState(groupState);

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

  useEffect(() => {
    if (!chilheukDateStart || !chilheukDateEnd) return;
    fetchGroupPrice("칠흑", chilheukDateStart, chilheukDateEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chilheukDateStart, chilheukDateEnd]);

  useEffect(() => {
    if (!eternelDateStart || !eternelDateEnd) return;
    fetchGroupPrice("에테르넬", eternelDateStart, eternelDateEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eternelDateStart, eternelDateEnd]);

  useEffect(() => {
    if (!seedRingDateStart || !seedRingDateEnd) return;
    fetchGroupPrice("시드링", seedRingDateStart, seedRingDateEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedRingDateStart, seedRingDateEnd]);

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
        const latest =
          points.length > 0 ? points[points.length - 1].date : null;
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
          content: n.content,      // 🔹 summary → content
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

  // ====== 모두 선택/해제 계산 ======
  const chilheukLabels = chilheukState.datasets.map((ds) => ds.label);
  const eternelLabels = eternelState.datasets.map((ds) => ds.label);
  const seedRingLabels = seedRingState.datasets.map((ds) => ds.label);

  const chilheukAllHidden =
    chilheukLabels.length > 0 &&
    chilheukLabels.every((lbl) => hiddenLabels.has(lbl));
  const eternelAllHidden =
    eternelLabels.length > 0 &&
    eternelLabels.every((lbl) => hiddenLabels.has(lbl));
  const seedRingAllHidden =
    seedRingLabels.length > 0 &&
    seedRingLabels.every((lbl) => hiddenLabels.has(lbl));

  const toggleAllForLabels = (labels: string[]) => {
    setHiddenLabels((prev) => {
      const next = new Set(prev);
      const allHidden =
        labels.length > 0 && labels.every((lbl) => next.has(lbl));

      if (allHidden) {
        labels.forEach((lbl) => next.delete(lbl));
      } else {
        labels.forEach((lbl) => next.add(lbl));
      }
      return next;
    });
  };

  // ====== 메인 그래프 옵션 ======
  const lineOptions: any = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
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
        ticks: {
          color: "#9ca3af",
        },
        grid: {
          color: "rgba(148, 163, 184, 0.15)",
        },
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
        grid: {
          color: "rgba(148, 163, 184, 0.15)",
        },
      },
    },
  };

  // ====== 모달 그래프 ======
  const modalLabels = marketHistory.map((p) => p.date.slice(5));
  const modalData = marketHistory.map((p) => p.price);

  const modalChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
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
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

  const latestNews = latestByType("뉴스");
  const latestUpdate = latestByType("업데이트");
  const latestNotice = latestByType("공지");

  return (
    <main className={styles.page}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles["hero-bg"]} />
        <div className={styles["hero-content"]}>
          <div className={styles["hero-title"]}>📈 MAPLE ECONOMY</div>
          <div className={styles["hero-sub"]}>
            메이플의 각종 경제지표를 한 눈에.
          </div>

          <div className={styles["search-box"]}>
            <input
              className={styles["search-input"]}
              placeholder="캐릭터 닉네임으로 입력 시 드/메 템 맞추기로 이동합니다 (추후 변경 예정)."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <button
              className={styles["search-button"]}
              onClick={() => {
                if (searchName.trim()) {
                  router.push(`/dropmeso?search=${encodeURIComponent(searchName)}`);
                }
              }}
            >
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
                  <span
                    className={`${styles["news-tag"]} ${styles["tag-gold"]}`}
                  >
                    뉴스
                  </span>

                  <span
                    className={styles["news-clickable"]}
                    onClick={() => {
                      setNewsFilter("뉴스");
                      setNewsModalOpen(true);
                    }}
                  >
                    {latestNews.title}
                  </span>

                  <span className={styles["news-date"]}>
                    {latestNews.createdAt.slice(0, 10)}
                  </span>
                </li>
              )}

              {latestUpdate && (
                <li>
                  <span
                    className={`${styles["news-tag"]} ${styles["tag-blue"]}`}
                  >
                    업데이트
                  </span>

                  <span
                    className={styles["news-clickable"]}
                    onClick={() => {
                      setNewsFilter("업데이트");
                      setNewsModalOpen(true);
                    }}
                  >
                    {latestUpdate.title}
                  </span>

                  <span className={styles["news-date"]}>
                    {latestUpdate.createdAt.slice(0, 10)}
                  </span>
                </li>
              )}

              {latestNotice && (
                <li>
                  <span
                    className={`${styles["news-tag"]} ${styles["tag-gray"]}`}
                  >
                    공지
                  </span>

                  <span
                    className={styles["news-clickable"]}
                    onClick={() => {
                      setNewsFilter("공지");
                      setNewsModalOpen(true);
                    }}
                  >
                    {latestNotice.title}
                  </span>

                  <span className={styles["news-date"]}>
                    {latestNotice.createdAt.slice(0, 10)}
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* 요약 카드 */}
          <div className={`${styles.card} ${styles["summary-card"]}`}>
            <div className={styles["summary-header-row"]}>
              <img
                src={
                  selectedMarketItem === "메소 마켓"
                    ? "/item_image/item_메소.png"
                    : "/item_image/item_솔 에르다 조각.png"
                }
                alt={selectedMarketItem}
                className={styles["set-icon"]}
              />

              <div className={styles["summary-title"]}>
                {selectedMarketItem === "메소 마켓"
                  ? "메소 마켓 시세"
                  : "솔 에르다 조각 시세"}
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {["메소 마켓", "솔 에르다 조각"].map((label) => (
                  <button
                    key={label}
                    className={[
                      styles["news-filter-btn"],
                      styles["market-toggle-btn"],
                      selectedMarketItem === label
                        ? styles["news-filter-btn-active"]
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => fetchMarket(label as MarketItem)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles["summary-row"]}>
              <div className={styles["summary-label"]}>오늘 가격</div>
              <div
                className={`${styles["summary-value"]} ${styles.highlight}`}
              >
                {marketToday !== null
                  ? selectedMarketItem === "메소 마켓"
                    ? `${marketToday.toLocaleString(
                        "ko-KR"
                      )} 메포 / 1억 메소`
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
                  : `${
                      marketChange > 0 ? "▲" : marketChange < 0 ? "▼" : "―"
                    } ${Math.abs(marketChange).toFixed(1)}%`}
              </div>
            </div>

            <div className={styles["summary-row"]}>
              <div className={styles["summary-label"]}>데이터 기준일</div>
              <div className={styles["summary-value"]}>
                {marketLatestDate ?? latestDate ?? "—"}
              </div>
            </div>

            <button
              className={styles["graph-btn"]}
              onClick={() => setMesoModalOpen(true)}
            >
              📊 그래프 보기
            </button>

            <div className={styles["summary-footer"]}></div>
          </div>
        </div>

        {/* 그래프 섹션 */}
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
                <h2>칠흑 세트</h2>
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
              </div>

              <button
                className={styles["toggle-btn"]}
                onClick={() => setShowChilheuk((prev) => !prev)}
              >
                {showChilheuk ? "접기 ▲" : "펼치기 ▼"}
              </button>
            </div>

            <ItemLegend
              datasets={chilheukState.datasets}
              hiddenLabels={hiddenLabels}
              onToggle={handleToggleLabel}
            />

            {showChilheuk && (
              <Line
                data={{
                  labels: chilheukState.labels,
                  datasets: chilheukState.datasets.filter(
                    (ds) => !hiddenLabels.has(ds.label)
                  ),
                }}
                options={lineOptions}
              />
            )}

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
                <h2>에테르넬 세트</h2>
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
              </div>

              <button
                className={styles["toggle-btn"]}
                onClick={() => setShowEternel((prev) => !prev)}
              >
                {showEternel ? "접기 ▲" : "펼치기 ▼"}
              </button>
            </div>

            <ItemLegend
              datasets={eternelState.datasets}
              hiddenLabels={hiddenLabels}
              onToggle={handleToggleLabel}
            />

            {showEternel && (
              <Line
                data={{
                  labels: eternelState.labels,
                  datasets: eternelState.datasets.filter(
                    (ds) => !hiddenLabels.has(ds.label)
                  ),
                }}
                options={lineOptions}
              />
            )}

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
                <h2>시드링 세트</h2>
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
              </div>

              <button
                className={styles["toggle-btn"]}
                onClick={() => setShowSeed((prev) => !prev)}
              >
                {showSeed ? "접기 ▲" : "펼치기 ▼"}
              </button>
            </div>

            <ItemLegend
              datasets={seedRingState.datasets}
              hiddenLabels={hiddenLabels}
              onToggle={handleToggleLabel}
            />

            {showSeed && (
              <Line
                data={{
                  labels: seedRingState.labels,
                  datasets: seedRingState.datasets.filter(
                    (ds) => !hiddenLabels.has(ds.label)
                  ),
                }}
                options={lineOptions}
              />
            )}

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
          </section>
        </div>
      </section>

      {/* 마켓 그래프 모달 */}
      {mesoModalOpen && (
        <div
          className={styles["modal-backdrop"]}
          onClick={() => setMesoModalOpen(false)}
        >
          <div
            className={styles.modal}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className={styles["modal-header"]}>
              <span>
                {selectedMarketItem === "메소 마켓"
                  ? "메소 마켓 시세 (일별)"
                  : "솔 에르다 조각 시세 (일별)"}
              </span>
              <button
                className={styles["modal-close"]}
                onClick={() => setMesoModalOpen(false)}
              >
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
        <div
          className={styles["modal-backdrop"]}
          onClick={() => setNewsModalOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <span>메이플 경제 뉴스 히스토리</span>
              <button
                className={styles["modal-close"]}
                onClick={() => setNewsModalOpen(false)}
              >
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
                  .filter(
                    (n) => newsFilter === "전체" || n.type === newsFilter
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )
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
                        <span className={styles["news-history-date"]}>
                          {n.createdAt}
                        </span>
                      </div>
                      <div className={styles["news-history-title"]}>
                        {n.title}
                      </div>
                      <div className={styles["news-history-summary"]}>
                        {n.content} {/* 🔹 여기서도 summary → content */}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className={styles.footer}>
        Maple Economy · 개인 프로젝트 · Nexon Open API 활용 (비공식 팬 사이트)
      </footer>
    </main>
  );
}
