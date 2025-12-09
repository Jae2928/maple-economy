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
      <nav className={`${styles["nav-links"]} hidden md:flex`}>
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

      <button className="bg-gray-800 p-1.5 rounded-md md:hidden">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 5.25h16.5M3.75 12h16.5M3.75 18.75h16.5"
          />
        </svg>
      </button>

      {/* 🔥 우측 문의 버튼 */}
      {/* <div className={styles["nav-right"]}>
        <button className={`${styles["small-btn"]} ${styles.outline}`}>
          문의 및 개선사항
        </button>
      </div> */}
    </header>
  );
}
