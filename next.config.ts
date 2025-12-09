import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // 서버 쪽 typeorm 을 사용한 쿼리문이 이상하게 축소화 안되도록
    // 클라이언트 쪽은 제대로 minify 되니까 용량 및 성능 걱정은 할 필요 없음
    serverMinification: false,
  }
};

export default nextConfig;
