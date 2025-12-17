"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavBar.module.css";

export default function NavBar() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isDropMeso = pathname.startsWith("/dropmeso");
  const isCharacterEquip = pathname.startsWith("/character-equipment");

  return (
    <header className={styles["top-nav"]}>
      <div className={styles["nav-left"]}>
        <Link href="/" className={styles.logo}>
          MAPLE ECONOMY
        </Link>
      </div>

      <nav className={`${styles["nav-links"]} flex`}>
        <Link
          href="/"
          className={`${styles["nav-btn"]} ${
            isHome ? styles["nav-btn-active"] : ""
          } hidden md:flex`}
        >
          홈
        </Link>

        <Link
          href="/character-equipment"
          className={`${styles["nav-btn"]} ${
            isCharacterEquip ? styles["nav-btn-active"] : ""
          } hidden md:inline-flex`}
        >
          캐릭터 템 가격
        </Link>

        <Link
          href="/dropmeso"
          className={`${styles["nav-btn"]} ${
            isDropMeso ? styles["nav-btn-active"] : ""
          }`}
        >
          드/메 템 맞추기
        </Link>

        <button className={`${styles["nav-btn"]} hidden md:inline-flex`}>
          전투력 올리기
        </button>
      </nav>
    </header>
  );
}
