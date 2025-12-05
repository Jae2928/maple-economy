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

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

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
  date: string; // "YYYY-MM-DD"
  price: number;
};

// 🔹 아이템 이름을 이미지 파일명으로 변환 (예외 포함)
const imageFileName = (name: string) => {
  if (name === "미트라의 분노 : 전사") return "미트라의 분노 전사";
  return name.replace(/[:]/g, "");
};

// 🔹 커스텀 이미지 Legend 컴포넌트
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

export default function Home() {
  // ▼ 공통 상태들 (순서 유지!)
  const [labels, setLabels] = useState<string[]>([]);
  const [allDatasets, setAllDatasets] = useState<Dataset[] | null>(null);

  const [showChilheuk, setShowChilheuk] = useState(true);
  const [showEternel, setShowEternel] = useState(true);
  const [showSeed, setShowSeed] = useState(true);

  const [searchName, setSearchName] = useState("");

  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState<number>(0);

  // 🔹 메소 마켓 카드 + 모달용
  const [mesoToday, setMesoToday] = useState<number | null>(null);
  const [mesoChange, setMesoChange] = useState<number | null>(null);
  const [mesoHistory, setMesoHistory] = useState<MesoPoint[]>([]);
  const [mesoModalOpen, setMesoModalOpen] = useState(false);

  // 🔹 이미지 legend용 숨김 상태
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set());
  const handleToggleLabel = (label: string) => {
    setHiddenLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // “억 메소” 포맷
  const formatToEok = (value: number) => {
    const eok = value / 100000000;
    if (eok >= 10) return `${Math.round(eok)}억`;
    return `${eok.toFixed(1)}억`;
  };

  // ▼ 1) 아이템 시세 데이터 불러오기
  useEffect(() => {
    axios.get("/api/price").then((res) => {
      const rows: PriceRow[] = res.data.data;

      const dateKeys = [...new Set(rows.map((r) => r.date))].sort();
      setLabels(dateKeys);
      setLatestDate(dateKeys[dateKeys.length - 1] ?? null);

      const items: string[] = [...new Set(rows.map((r) => r.name))];
      setItemCount(items.length);

      const colorFor = (label: string) => {
        let hash = 0;
        for (let i = 0; i < label.length; i++) {
          hash = label.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 55%)`;
      };

      const datasets: Dataset[] = items.map((itemName: string) => {
        const itemData = rows.filter((r) => r.name === itemName);

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

      setAllDatasets(datasets);
    });
  }, []);

  // ▼ 2) 메소 마켓 시세 데이터 불러오기 (/api/meso)
  useEffect(() => {
    axios
      .get("/api/meso")
      .then((res) => {
        const { points, todayPrice, changePercent } = res.data as {
          points: MesoPoint[];
          todayPrice: number | null;
          changePercent: number | null;
        };

        setMesoHistory(points || []);
        setMesoToday(todayPrice);
        setMesoChange(changePercent);
      })
      .catch((err) => {
        console.error("meso fetch error:", err);
      });
  }, []);

  if (!allDatasets || labels.length === 0) {
    return (
      <main className="page">
        <div className="loading">데이터 불러오는 중...</div>
        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #05060a;
            color: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: system-ui, -apple-system, BlinkMacSystemFont,
              "Noto Sans KR", sans-serif;
          }
          .loading {
            font-size: 1.1rem;
            opacity: 0.8;
          }
        `}</style>
      </main>
    );
  }

  // 세트별 아이템 그룹
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

  const getGroupDatasets = (groupName: string): Dataset[] => {
    const targetItems = groupDefs[groupName] || [];
    return allDatasets.filter((ds) => targetItems.includes(ds.label));
  };

  const chilheukDatasets = getGroupDatasets("칠흑");
  const eternelDatasets = getGroupDatasets("에테르넬");
  const seedRingDatasets = getGroupDatasets("시드링");

  // Chart.js 옵션 (기본 legend 끄고, tooltip만 사용)
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

  // 메소 마켓 모달용 차트 데이터
  const mesoLabels = mesoHistory.map((p) => p.date.slice(5)); // "MM-DD"
  const mesoData = mesoHistory.map((p) => p.price);

  const mesoChartOptions: any = {
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
            return `${v.toLocaleString("ko-KR")} 메포 / 1억 메소`;
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

  // 메소 기준일(메소 데이터의 마지막 날짜)
  const mesoLatestDate =
    mesoHistory.length > 0 ? mesoHistory[mesoHistory.length - 1].date : null;

  return (
    <main className="page">
      {/* 상단 네비게이션 */}
      <header className="top-nav">
        <div className="nav-left">
          <span className="logo">MAPLE ECONOMY</span>
        </div>
        <nav className="nav-links">
          <button className="nav-btn nav-btn-active">홈</button>
          <button className="nav-btn">캐릭터 템 가격</button>
          <button className="nav-btn">드메템 맞추기</button>
          <button className="nav-btn">전투력 올리기</button>
        </nav>
        <div className="nav-right"> 
          <button className="small-btn outline">문의 및 개선사항</button> 
        </div>
      </header>

      {/* 히어로 */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <div className="hero-title">📈 Maple Economy</div>
          <div className="hero-sub">
            칠흑 / 에테르넬 / 시드링 주요 아이템의 시세를 한 눈에.
          </div>

          <div className="search-box">
            <input
              className="search-input"
              placeholder="추후: 캐릭터 닉네임 또는 아이템 이름으로 검색할 수 있어요."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <button
              className="search-button"
              onClick={() => {
                console.log("검색:", searchName);
              }}
            >
              검색
            </button>
          </div>
        </div>
      </section>

      {/* 메인 컨텐츠 */}
      <section className="content">
        <div className="top-grid">
          {/* 뉴스 카드 */}
          <div className="card news-card">
            <div className="card-title">📢 메이플 경제 뉴스 (준비 중)</div>
            <ul className="news-list">
              <li>
                <span className="news-tag tag-gold">뉴스</span>
                <div className="news-text">
                  2025-11-14 10:00 (금요일) 썬데이 샤타포스 공지, 2025-11-16 (일요일) 샤타포스
                </div>
                <span className="news-date">2025-11-14</span>
              </li>
              <li>
                <span className="news-tag tag-blue">업데이트</span>
                <div className="news-text">
                  아이템 옵션별 상세 시세 분석 기능이 추가될 예정입니다.
                </div>
                <span className="news-date">2025-11-16</span>
              </li>
              <li>
                <span className="news-tag tag-gray">공지</span>
                <div className="news-text">
                  현재 데이터는 직접 수집한 예시 데이터이며, 실제 시세와
                  차이가 있을 수 있습니다.
                </div>
                <span className="news-date">2025-11-15</span>
              </li>
            </ul>
          </div>

          {/* 메소 마켓 시세 카드 */}
          <div className="card summary-card">
            <div className="summary-header-row">
              <img
                src="/item_image/item_메소.png"
                alt="메소"
                className="set-icon"
              />
              <div className="summary-title">메소 마켓 시세</div>
            </div>

            <div className="summary-row">
              <div className="summary-label">오늘 메소 가격</div>
              <div className="summary-value highlight">
                {mesoToday !== null
                  ? `${mesoToday.toLocaleString("ko-KR")} 메포 / 1억 메소`
                  : "—"}
              </div>
            </div>

            <div className="summary-row">
              <div className="summary-label">전일 대비</div>
              <div
                className={
                  "summary-value change " +
                  (mesoChange != null
                    ? mesoChange > 0
                      ? "up"
                      : mesoChange < 0
                      ? "down"
                      : ""
                    : "")
                }
              >
                {mesoChange == null
                  ? "—"
                  : `${mesoChange > 0 ? "▲" : mesoChange < 0 ? "▼" : "―"} ${Math.abs(
                      mesoChange
                    ).toFixed(1)}%`}
              </div>
            </div>

            <div className="summary-row">
              <div className="summary-label">데이터 기준일</div>
              <div className="summary-value">
                {mesoLatestDate ?? latestDate ?? "—"}
              </div>
            </div>

            <button
              className="graph-btn"
              onClick={() => setMesoModalOpen(true)}
            >
              📊 그래프 보기
            </button>

            <div className="summary-footer">
            </div>
          </div>
        </div>

        {/* 그래프 섹션 */}
        <div className="charts-wrapper">
          {/* 칠흑 세트 */}
          <section className="card chart-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <img
                  src="/item_image/item_혼돈의 칠흑 장신구 상자.png"
                  alt="칠흑"
                  className="set-icon"
                />
                <h2>칠흑 세트</h2>
              </div>
              <button
                className="toggle-btn"
                onClick={() => setShowChilheuk((prev) => !prev)}
              >
                {showChilheuk ? "접기 ▲" : "펼치기 ▼"}
              </button>
            </div>

            <ItemLegend
              datasets={chilheukDatasets}
              hiddenLabels={hiddenLabels}
              onToggle={handleToggleLabel}
            />

            {showChilheuk && (
              <Line
                data={{
                  labels,
                  datasets: chilheukDatasets.filter(
                    (ds) => !hiddenLabels.has(ds.label)
                  ),
                }}
                options={lineOptions}
              />
            )}
          </section>

          {/* 에테르넬 세트 */}
          <section className="card chart-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <img
                  src="/item_image/item_맹세의 에테르넬 방어구 상자.png"
                  alt="에테르넬"
                  className="set-icon"
                />
                <h2>에테르넬 세트</h2>
              </div>
              <button
                className="toggle-btn"
                onClick={() => setShowEternel((prev) => !prev)}
              >
                {showEternel ? "접기 ▲" : "펼치기 ▼"}
              </button>
            </div>

            <ItemLegend
              datasets={eternelDatasets}
              hiddenLabels={hiddenLabels}
              onToggle={handleToggleLabel}
            />

            {showEternel && (
              <Line
                data={{
                  labels,
                  datasets: eternelDatasets.filter(
                    (ds) => !hiddenLabels.has(ds.label)
                  ),
                }}
                options={lineOptions}
              />
            )}
          </section>

          {/* 시드링 세트 */}
          <section className="card chart-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <img
                  src="/item_image/item_백옥의 보스 반지 상자.png"
                  alt="시드링"
                  className="set-icon"
                />
                <h2>시드링 세트</h2>
              </div>
              <button
                className="toggle-btn"
                onClick={() => setShowSeed((prev) => !prev)}
              >
                {showSeed ? "접기 ▲" : "펼치기 ▼"}
              </button>
            </div>

            <ItemLegend
              datasets={seedRingDatasets}
              hiddenLabels={hiddenLabels}
              onToggle={handleToggleLabel}
            />

            {showSeed && (
              <Line
                data={{
                  labels,
                  datasets: seedRingDatasets.filter(
                    (ds) => !hiddenLabels.has(ds.label)
                  ),
                }}
                options={lineOptions}
              />
            )}
          </section>
        </div>
      </section>

      {/* 메소 마켓 모달 */}
      {mesoModalOpen && (
        <div className="modal-backdrop" onClick={() => setMesoModalOpen(false)}>
          <div
            className="modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="modal-header">
              <span>메소 마켓 시세 (일별)</span>
              <button
                className="modal-close"
                onClick={() => setMesoModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {mesoHistory.length === 0 ? (
                <div className="modal-empty">메소 시세 데이터가 없습니다.</div>
              ) : (
                <Line
                  data={{
                    labels: mesoLabels,
                    datasets: [
                      {
                        label: "메소 마켓",
                        data: mesoData,
                        borderColor: "#38bdf8",
                        borderWidth: 2,
                        tension: 0.25,
                        pointRadius: 0,
                      },
                    ],
                  }}
                  options={mesoChartOptions}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        Maple Economy · 개인 프로젝트 · Nexon Open API 활용 (비공식 팬 사이트)
      </footer>

      {/* 스타일 */}
      <style jsx>{`
        .page {
          min-height: 100vh;
          background: radial-gradient(circle at top, #1b2230 0, #05060a 55%);
          color: #f9fafb;
          font-family: system-ui, -apple-system, BlinkMacSystemFont,
            "Noto Sans KR", sans-serif;
          display: flex;
          flex-direction: column;
        }
        .top-nav {
          height: 56px;
          padding: 0 32px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.3);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(3, 7, 18, 0.96);
          backdrop-filter: blur(12px);
          position: relative;
          top: 0;
          z-index: 20;
        }
        .nav-left {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .logo {
          font-weight: 800;
          letter-spacing: 0.08em;
          font-size: 1rem;
        }
        .logo-dot {
          font-size: 0.75rem;
          opacity: 0.7;
        }
        .nav-links {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 10px;
        }
        .nav-right {
          display: flex; 
          gap: 8px;
        }
        .small-btn {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 0.9rem;
          border: none;
          cursor: pointer;
          background: #111827;
          color: #e5e7eb;
        }
        .nav-btn {
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 0.85rem;
          padding: 6px 10px;
          border-radius: 999px;
          cursor: pointer;
        }
        .nav-btn-active {
          color: #e5e7eb;
          background: linear-gradient(135deg, #14b8a6, #6366f1);
        }
        .hero {
          position: relative;
          padding: 40px 24px 32px;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          background-image: url("/hero_placeholder.jpg");
          background-size: cover;
          background-position: center;
          opacity: 0.18;
          filter: blur(2px);
        }
        .hero-content {
          position: relative;
          max-width: 960px;
          margin: 0 auto;
          text-align: center;
        }
        .hero-title {
          font-size: 2.2rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }
        .hero-sub {
          font-size: 0.95rem;
          color: #d1d5db;
          margin-bottom: 22px;
        }
        .search-box {
          margin: 0 auto;
          max-width: 640px;
          display: flex;
          gap: 8px;
          background: rgba(17, 24, 39, 0.9);
          padding: 6px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
        }
        .search-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: #f9fafb;
          padding: 8px 14px;
          font-size: 0.9rem;
        }
        .search-input::placeholder {
          color: #6b7280;
        }
        .search-button {
          border-radius: 999px;
          border: none;
          padding: 8px 18px;
          background: linear-gradient(135deg, #22c55e, #22d3ee);
          color: #020617;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .content {
          max-width: 1200px;
          width: 100%;
          margin: 0 auto 40px;
          padding: 0 24px 24px;
        }
        .top-grid {
          display: grid;
          grid-template-columns: minmax(0, 2.1fr) minmax(0, 1.2fr);
          gap: 18px;
          margin-bottom: 24px;
        }
        .card {
          background: rgba(15, 23, 42, 0.95);
          border-radius: 18px;
          padding: 16px 18px;
          border: 1px solid rgba(75, 85, 99, 0.7);
          box-shadow: 0 18px 35px rgba(15, 23, 42, 0.7);
        }
        .card-title {
          font-size: 0.95rem;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .news-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 0.82rem;
        }
        .news-list li {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
        }
        .news-tag {
          font-size: 0.75rem;
          padding: 2px 6px;
          border-radius: 999px;
          color: #020617;
          font-weight: 600;
        }
        .tag-gold {
          background: #fbbf24;
        }
        .tag-blue {
          background: #38bdf8;
        }
        .tag-gray {
          background: #9ca3af;
        }
        .news-text {
          color: #e5e7eb;
        }
        .news-date {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .summary-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .summary-header-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 6px;
        }
        .summary-title {
          font-size: 0.95rem;
          font-weight: 600;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          padding: 4px 0;
        }
        .summary-label {
          color: #9ca3af;
        }
        .summary-value {
          color: #e5e7eb;
          font-weight: 600;
        }
        .summary-value.highlight {
          color: #facc15;
        }
        .summary-value.change.up {
          color: #22c55e;
        }
        .summary-value.change.down {
          color: #f97373;
        }
        .graph-btn {
          margin-top: 8px;
          width: 100%;
          border-radius: 999px;
          border: none;
          padding: 8px 0;
          background: linear-gradient(135deg, #0ea5e9, #6366f1);
          color: #f9fafb;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .summary-footer {
          margin-top: 6px;
          font-size: 0.78rem;
          color: #9ca3af;
        }

        .charts-wrapper {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .chart-card {
          padding-top: 14px;
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .chart-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chart-header h2 {
          margin: 0;
          font-size: 1rem;
        }
        .set-icon {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          object-fit: cover;
          border: 1px solid rgba(148, 163, 184, 0.7);
          background: #020617;
        }
        .toggle-btn {
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          background: transparent;
          color: #e5e7eb;
          font-size: 0.8rem;
          padding: 4px 10px;
          cursor: pointer;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 40;
        }
        .modal {
          width: min(1000px, 95vw);
          height: min(520px, 85vh);
          background: #020617;
          border-radius: 16px;
          border: 1px solid rgba(75, 85, 99, 0.8);
          display: flex;
          flex-direction: column;
          padding: 12px 16px 16px;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }
        .modal-close {
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .modal-body {
          flex: 1;
        }
        .modal-empty {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          font-size: 0.9rem;
        }

        .footer {
          margin-top: auto;
          padding: 12px 24px 16px;
          font-size: 0.75rem;
          color: #6b7280;
          text-align: center;
          border-top: 1px solid rgba(31, 41, 55, 0.8);
          background: #020617;
        }

        @media (max-width: 900px) {
          .top-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .hero-content {
            padding: 0 8px;
          }
          .content {
            padding: 0 16px 24px;
          }
        }
      `}</style>
    </main>
  );
}
