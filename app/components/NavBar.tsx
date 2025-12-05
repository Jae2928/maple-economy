"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavBar.module.css";

export default function NavBar() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isDropMeso = pathname.startsWith("/dropmeso");

  return (
    <header className={styles["top-nav"]}>
      {/* 🔥 왼쪽 로고 */}
      <div className={styles["nav-left"]}>
        <Link href="/" className={styles.logo}>
          MAPLE ECONOMY
        </Link>
      </div>

      {/* 🔥 중앙 네비 */}
      <nav className={styles["nav-links"]}>
        <Link
          href="/"
          className={`${styles["nav-btn"]} ${
            isHome ? styles["nav-btn-active"] : ""
          }`}
        >
          홈
        </Link>

        <button className={styles["nav-btn"]}>캐릭터 템 가격</button>

        <Link
          href="/dropmeso"
          className={`${styles["nav-btn"]} ${
            isDropMeso ? styles["nav-btn-active"] : ""
          }`}
        >
          드/메 템 맞추기
        </Link>

        <button className={styles["nav-btn"]}>전투력 올리기</button>
      </nav>

      {/* 🔥 우측 문의 버튼 */}
      <div className={styles["nav-right"]}>
        <button className={`${styles["small-btn"]} ${styles.outline}`}>
          문의 및 개선사항
        </button>
      </div>
    </header>
  );
}
