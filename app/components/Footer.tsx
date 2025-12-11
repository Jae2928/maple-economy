// import Image from "next/image";
import { Mail } from "lucide-react";

export default function NavBar() {
    const currentYear = new Date().getFullYear();

    return (
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
          <div className="mt-8 md:mt-4">Maple Economy | 개인 프로젝트</div>
          <div>Data Based on NEXON OPEN API</div>
          <div className="mt-8 md:mt-4">MAPLE ECONOMY is an independent service and is not endorsed, affiliated with, or sponsored by NEXON Korea Corporation.</div>
          <div>All game data, characters, and related content belong to NEXON. Accuracy of the provided data is not guaranteed.</div>
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
    )
}