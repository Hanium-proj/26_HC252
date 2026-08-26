# Chest AI · 진단 지원 플랫폼 (UI)

흉부 X-ray + 임상정보 기반 폐 질환 진단 지원 서비스의 프론트엔드 데모.
2026 한이음 드림업 개발보고서 "S/W 주요 기능" 실물 사진 캡처용으로,
5개 주요 기능을 각 화면(라우트)으로 분리했다.

## 화면 구성 (보고서 표 1:1 매핑)

- `/` 진단 지원 대시보드 (통합 개요)
- `/analysis` 멀티모달 폐 질환 분류 (영상 + 임상정보 -> 질환별 확률/confidence)
- `/evidence` 판독 근거 시각화 (Grad-CAM / Eigen-CAM + 임상 텍스트 중요도 + CheXlocalize)
- `/agent` LLM 진단 에이전트 (LangGraph 파이프라인 · 도구 라우팅 · 근거 종합)
- `/literature` RAG 문헌·사례 검색 (하이브리드 검색 · 리랭킹 · 출처)

## 실행 (Mac)

    npm install
    npm run dev

브라우저에서 http://localhost:3000 접속.

## 실제 영상 교체

X-ray / CT / Grad-CAM 영상은 placeholder다. `components/XrayFrame.tsx`의
`src` prop에 실제 이미지 경로를 넘기면 SVG placeholder가 1:1로 교체된다.

    <XrayFrame src="/xray/px-0142-pa.jpg" caption="정면 · PA" />
    <XrayFrame src="/xray/px-0142-gradcam.png" caption="Grad-CAM 근거" />

이미지는 `public/` 아래에 두고 절대경로(`/xray/...`)로 참조하면 된다.

## 디자인 시스템

`DESIGN.md` 참고. 토큰 단일 출처는 `app/globals.css`(CSS 변수) +
`tailwind.config.ts` 매핑. 폰트 Pretendard, letter-spacing -2.5%.

## 스택

Next.js 14 (App Router) · TypeScript · Tailwind CSS 3
