import styles from "./page.module.css";

export default function PersonalInfoPage() {
  return (
    <main className={styles.page}>
        <section className={`${styles.content} mx-auto p-6 md:my-10`}>
            <h1 className="text-2xl md:text-4xl">개인정보처리방침</h1>
            <p className="mt-4 md:mt-6 md:text-lg">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
        </section>
    </main>
  );
}