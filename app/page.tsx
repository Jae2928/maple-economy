// app/dropmeso/page.tsx
import { Suspense } from "react";
import DropMesoClient from "./DropMesoClient";
import styles from "./page.module.css";

// Suspense 로딩 중에 보여줄 스켈레톤 화면
function DropMesoFallback() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {/* 헤더 스켈레톤 */}
        <section className={styles.header}>
          <div>
            <div className={styles.breadcrumb}></div>
            <h1 className={styles.title}>드랍/메획 세팅 계산기</h1>
            <p className={styles.subtitle}>
              드/메 세팅 화면을 불러오는 중입니다...
            </p>
          </div>
        </section>

        {/* 카드 하나로 대충 자리를 채워주는 정도의 스켈레톤 */}
        <section className="grid gap-4 items-start md:grid-cols-7">
          <div className={`${styles.card} md:col-span-7`}>
            <div
              style={{
                height: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.7,
                fontSize: "0.95rem",
              }}
            >
              잠시만 기다려 주세요. 캐릭터 정보와 세팅 화면을 준비하는 중입니다...
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<DropMesoFallback />}>
      <DropMesoClient />
    </Suspense>
  );
}
