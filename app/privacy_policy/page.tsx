import styles from "./page.module.css";

export default function PersonalInfoPage() {
  return (
    <main className={styles.page}>
      <section className={`${styles.content} mx-auto p-6 md:my-10`}>
        <h1 className="text-2xl md:text-4xl">
          MAPLE ECONOMY 개인정보처리방침 (Privacy Policy)
        </h1>

        <div className="mt-4 md:mt-6 md:text-lg leading-relaxed whitespace-pre-line">
          <p>
            본 개인정보처리방침은 “MAPLE ECONOMY”(이하 “본 서비스”) 이용 과정에서 처리되는 개인정보 및 관련 정보를 안내하기 위해 마련되었습니다.
            본 서비스는 「개인정보 보호법」을 비롯한 대한민국 관련 법령을 준수합니다.
          </p>

          <h2 className="text-xl font-bold mt-6">1. 수집하는 개인정보 항목</h2>
          <p>본 서비스는 회원가입을 제공하지 않으며 사용자가 직접 입력하는 개인정보를 수집하지 않습니다.</p>
          <p>다만 서비스 운영 및 안정성 확보 목적을 위해 다음 정보가 자동으로 수집될 수 있습니다.</p>

          <h3 className="text-lg font-semibold mt-4">① 서비스 이용 과정에서 자동 수집되는 정보</h3>
          <ul className="list-disc ml-6 mt-2">
            <li>IP 주소</li>
            <li>브라우저 정보(User-Agent)</li>
            <li>접속 일시, 요청 URL</li>
            <li>서비스 오류 로그</li>
            <li>쿠키 또는 로컬스토리지에 저장된 사용자 환경 설정</li>
            <li>기기 정보(브라우저 타입, 화면 해상도 등)</li>
          </ul>
          <p className="mt-2">
            이 정보는 Vercel(호스팅), Supabase(데이터베이스 및 로그 처리), CDN 서비스 제공자가 자동으로 수집·보관할 수 있습니다.
          </p>

          <h3 className="text-lg font-semibold mt-4">② Google AdSense 광고 제공 시 자동 수집될 수 있는 정보</h3>
          <ul className="list-disc ml-6 mt-2">
            <li>쿠키(Cookie)</li>
            <li>광고 식별자</li>
            <li>관심사 기반 광고 데이터</li>
            <li>IP 주소 등 비식별 로그 정보</li>
          </ul>
          <p className="mt-2">
            Google의 광고 쿠키는 이용자가 선택하여 차단하거나 설정 변경이 가능합니다.<br />
            Google 광고 정책:{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              className="text-blue-600 underline"
              target="_blank"
            >
              https://policies.google.com/technologies/ads
            </a>
          </p>

          <h2 className="text-xl font-bold mt-6">2. 개인정보의 이용 목적</h2>
          <ul className="list-disc ml-6 mt-2">
            <li>서비스 제공 및 안정적 운영</li>
            <li>트래픽 분석 및 오류 분석</li>
            <li>보안 강화 및 부정 이용 방지</li>
            <li>이용 패턴 분석을 통한 서비스 개선</li>
            <li>Google AdSense 기반 광고 제공 및 성능 분석</li>
          </ul>

          <h3 className="text-lg font-semibold mt-4">메이플스토리 API 관련 안내</h3>
          <p>
            이용자가 검색한 캐릭터명, 장착 아이템 정보 등은 서버에 저장하지 않습니다.<br />
            해당 정보는 NEXON Open API를 통해 조회 후 화면에 일시적으로 표시될 뿐,
            서버·DB·로그에 저장되지 않습니다.
          </p>

          <h2 className="text-xl font-bold mt-6">3. 개인정보의 보유 및 이용 기간</h2>
          <p>본 서비스는 개인을 식별할 수 있는 정보를 직접 저장하지 않습니다.</p>
          <p>단, Vercel 및 Supabase에서 자동 생성되는 로그는 아래 정책에 따라 보관됩니다.</p>

          <table className="w-full border border-gray-600 mt-4">
            <thead className="bg-gray-700">
              <tr>
                <th className="border border-gray-600 px-4 py-2 text-left">서비스</th>
                <th className="border border-gray-600 px-4 py-2 text-left">로그 보유 기간</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800">
              <tr>
                <td className="border border-gray-600 px-4 py-2">Vercel</td>
                <td className="border border-gray-600 px-4 py-2">1시간</td>
              </tr>
              <tr>
                <td className="border border-gray-600 px-4 py-2">Supabase</td>
                <td className="border border-gray-600 px-4 py-2">24시간</td>
              </tr>
            </tbody>
          </table>


          <p className="mt-2">보유 기간 경과 시 자동 삭제됩니다.</p>

          <h2 className="text-xl font-bold mt-6">4. 개인정보의 제3자 제공</h2>
          <p>본 서비스는 이용자의 개인정보를 판매하거나 제공하지 않습니다.</p>
          <p>단, 다음 경우에는 예외적으로 로그 정보가 처리될 수 있습니다.</p>
          <ul className="list-disc ml-6 mt-2">
            <li>서비스 운영을 위해 외부 서비스(Vercel, Supabase, Google 등)가 불가피하게 처리할 경우</li>
            <li>법령상 요구가 있는 경우(수사기관 요청 등)</li>
            <li>개인을 식별할 수 없는 통계 자료 제공</li>
          </ul>

          <h2 className="text-xl font-bold mt-6">5. 쿠키 및 로컬스토리지 사용</h2>
          <p>본 서비스는 다음 목적을 위해 쿠키 · 로컬스토리지를 사용할 수 있습니다.</p>
          <ul className="list-disc ml-6 mt-2">
            <li>검색 옵션, 그래프 설정 등 사용자 환경 저장</li>
            <li>광고 제공(Google AdSense 적용 시)</li>
            <li>서비스 성능 분석</li>
          </ul>
          <p>이용자는 브라우저 설정을 통해 쿠키를 거부하거나 삭제할 수 있습니다.</p>

          <h2 className="text-xl font-bold mt-6">6. 이용자의 권리</h2>
          <p>
            본 서비스는 개인정보를 직접 저장하지 않으므로
            열람·정정·삭제 요청은 브라우저 설정 또는 외부 서비스(Vercel, Google 설정 등)를 통해 이루어집니다.
          </p>
          <p>다음 요청은 문의를 통해 처리할 수 있습니다.</p>
          <ul className="list-disc ml-6 mt-2">
            <li>광고 식별자 및 로컬스토리지 데이터 삭제 요청</li>
            <li>수집 정보 관련 문의</li>
            <li>개인정보 관련 불만 처리</li>
          </ul>

          <h2 className="text-xl font-bold mt-6">7. 개인정보의 파기</h2>
          <p>본 서비스는 개인정보를 저장하지 않습니다.</p>
          <p>운영 과정에서 생성된 로그는 외부 서비스 정책에 따라 자동 삭제됩니다.</p>

          <h2 className="text-xl font-bold mt-6">8. 개인정보 보호를 위한 기술적·관리적 조치</h2>
          <ul className="list-disc ml-6 mt-2">
            <li>HTTPS 기반 암호화 통신</li>
            <li>서버 접근 권한 최소화</li>
            <li>외부 로그 서비스(Vercel, Supabase) 사용으로 안전한 로그 관리</li>
            <li>정기적인 보안 업데이트 및 취약점 점검</li>
          </ul>

          <h2 className="text-xl font-bold mt-6">9. 개인정보 보호책임자</h2>
          <p>
            책임자: MAPLE ECONOMY 운영자<br />
            이메일:{" "}
            <a href="mailto:jaewon2928@gmail.com" className="text-blue-600 underline">
              jaewon2928@gmail.com
            </a>
          </p>

          <h2 className="text-xl font-bold mt-6">10. 개인정보처리방침의 변경</h2>
          <p>
            본 방침은 법령 또는 서비스 정책 변경에 따라 수정될 수 있으며,
            변경 시 웹사이트 내 공지 또는 본 페이지를 통해 안내됩니다.
          </p>
          <br/>
          <p><strong>최종 수정일:</strong> 2025-12-11</p>
        </div>
      </section>
    </main>
  );
}
