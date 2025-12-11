import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { Mail } from "lucide-react";
import "./globals.css";
import NavBar from "./components/NavBar";
import { siteConfig } from "@/config/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  metadataBase: new URL(siteConfig.url),

  alternates: {
    canonical: siteConfig.url,
  },

  authors: [{ name: siteConfig.author }],
  creator: siteConfig.author,
  applicationName: siteConfig.name,

  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage, 
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NavBar />
        {children}
        <footer className="mt-auto py-8 px-6 leading-8 text-gray-500 text-center border-t border-gray-800 bg-gray-950 md:text-lg">
          <div className="flex justify-center space-x-4">
            <a
              href="mailto:jaewon2928@gmail.com"
              className="flex items-center justify-center size-16 rounded-full bg-gray-700 text-white hover:bg-gray-600"
              aria-label="Email"
              title="문의 메일 보내기"
            >
              <Mail className="size-8" />
            </a>
            {/* <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center size-16 rounded-full bg-gray-700 text-white hover:bg-gray-600"
              aria-label="Discord"
            >
              <Image
                src="/discord.svg"
                alt="Discord"
                width={32}
                height={32}
                className="invert"
              />
            </a> */}
          </div>
          <div className="mt-8 md:mt-4">Copyright {currentYear}. 째원 & Megi. All rights reserved.</div>
          <div>
            제작:{" "}
            <a
              href="https://github.com/Jae2928"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              째원
            </a>
            ,{" "}
            <a
              href="https://github.com/gvm1229"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Megi
            </a>
          </div>
          <div className="mt-8 md:mt-4">Maple Economy · 개인 프로젝트 · Nexon Open API 활용 (비공식 팬 사이트)</div>
          <div>Data Based on NEXON OPEN API</div>
          <div className="mt-8 md:mt-4">게임 {"<메이플스토리>"}의 각종 에셋 및 컨텐츠의 권리는 넥슨, 넥슨코리아에 있습니다.</div>
          <div>Maplescouter는 {"<메이플스토리>"}의 팬 사이트이며 컨텐츠를 상업적으로 이용하지 않습니다.</div>
          <div>Maplescouter is not associated with NEXON, nor NEXON Korea and does not provide any warranty.</div>
          <div>Maplescouter is not monetized and does not use the content commercially.</div>
          <div className="mt-8 md:mt-4">
            <a
              href="/personal_info"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              개인정보처리방침
            </a>
          </div>
          <div>
            contact :{" "}
            <a
              href="mailto:jaewon2928@gmail.com"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              jaewon2928@gmail.com
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
