# Chest AI 디자인 시스템 — "판독실 (The Reading Room)"

의료진(영상의학과 판독의)이 쓰는 임상 진단 보조 도구.
화이트 클리니컬 크롬 + 실제 뎁스(엘리베이션) + 다크 필름 아일랜드 구조.
구분선 대신 표면의 높이 차(그림자 사다리)가 위계를 만들고, 영상 뷰포트만
순검정 필름으로 가라앉는다. 색은 딥 수술 틸(surgical teal) 하나만
상호작용과 AI 표식에 허락되며, 캔버스 배경에는 flow 그라데이션(옐로 →
민트 → 라임 → 틸)과 모노크롬 그레인이 잔잔하게 흐른다.

리서치 근거: 실제 방사선 AI 제품(Lunit INSIGHT·Annalise·Aidoc·Qure.ai)의
필름 뷰어 관례, Radix Colors 라이트 램프, 2025-26 SaaS 대시보드 트렌드
(Linear·Attio·Mercury·Vercel), 임상 AI 채팅 UX(OpenEvidence·Glass
Health·Perplexity 인용 패턴), grainy flow-gradient 배경 트렌드.

## 절대 금지

- 보라·네온 그라데이션, 그라데이션 텍스트, 글래스모피즘 카드
- 구조용 구분선 (사이드바·탑바·패널 경계는 그림자와 표면 단차로만,
  헤어라인은 테이블 행 등 콘텐츠 수준에서만)
- 카드 속 카드 중첩, 좌측 컬러 보더 스트립
- 게이지·도넛 차트, 색칠된 스코어 숫자, 소수점 확률
- 스파클 AI 글리프, 회로 뇌, 카듀시우스, 하트-맥박선 아이콘
- "정상" 카피 (AI 음성은 "유의 소견 미검출 — 판독의 확인 필요")
- 개발 용어 노출 (LangGraph·Qdrant·BM25·softmax 등 — 의사가 사용자다)
- 한글 와이드 트래킹, 이모지

## 디자인 토큰

단일 출처는 `app/globals.css`의 CSS 변수. `tailwind.config.ts`는 매핑만.

### 라이트 크롬 표면

- canvas `#EEF0F4` — 앱 배경 (flow 그라데이션 + 그레인이 이 위에 흐름)
- surface-1 `#FFFFFF` — 사이드바·패널·카드
- surface-2 `#F3F5F8` — 인풋·웰·세그먼트·채팅 버킷
- surface-hover `#E9EDF2`
- hairline `#E7EAEF` / border `#D7DDE4` / border-strong `#BFC8D2` (콘텐츠 전용)

### 다크 필름 아일랜드 (영상 전용)

- film `#000000` — DICOM 필름, 유일한 순검정
- letterbox `#0A0C0F` — 필름 주변 여백·캡션 바

### 텍스트 램프 (쿨 뉴트럴, 그린기 없음)

- ink `#16181D` / ink-2 `#5A6472` / ink-3 `#97A0AB`

### 액센트 — 딥 수술 틸 (화면당 primary fill 정확히 1회)

- accent `#0F766E` / strong `#0C5F59` / brand(포커스 링) `#12A594`
- wash `rgba(15,118,110,0.08)` / wash-2 `0.14`
- 온필름 어노테이션: 외곽선 `#0BD8B6` (90% 초과 실선 / 50–90% 4-3 점선),
  선택 병변 `#38DAFF`, Grad-CAM jet 램프 · Eigen-CAM 시안-틸

### 상태 (텍스트 라벨 항상 병기, 필름 위 사용 금지)

- critical `#C62A2F` text / `#E5484D` fill / `#FEEBEC` wash
- warning `#9D5B00` / `#FFB224` / `#FFF3D0`
- ok `#1D7F54` / `#30A46C` / `#E6F6EB`
- info `#0D74CE` / `#0090FF` / `#E6F4FE`

### 엘리베이션 사다리 (구분선 대신 뎁스)

- shadow-1: 패널 기본 (저알파 3중 레이어)
- shadow-2: 호버·검색 필드·떠 있는 요소
- shadow-3: 팝오버·모달
- shadow-sidebar: 사이드바가 캔버스 위로 드리우는 그림자
- shadow-accent: primary 버튼 전용 (틸 글로우 + 상단 인셋 하이라이트)

### flow 배경 (캔버스 전용 — 사이드바·패널 침범 금지)

`app/layout.tsx`의 FlowBackground: viewport 고정 SVG.
블러(72px) 처리된 유기적 밴드 4개가 대각선으로 흐름 — 옐로 `#F2D478`,
민트 `#86DAB0`, 라임 `#CFE79C`, 틸 `#38A293`. 그 위에 feTurbulence
모노크롬 그레인(opacity 0.16, multiply). 원형 블롭·단순 radial 금지.

### 타이포그래피

- 본문: Pretendard Variable / 데이터: Geist Mono (라틴·숫자 전용)
- body 13px / lh 1.55 / -0.01em / tnum 전역
- 스케일: 11 모노 마이크로 라벨(uppercase +0.06em, 라틴 전용) · 12 메타 ·
  13 UI 기본 · 14 채팅 본문(lh 1.65) · 15 패널 타이틀 · 28 KPI 숫자 ·
  44 히어로 스코어(모노 700)
- 굵기 400/500/600만. 700은 스코어 숫자 전용

### 간격·라운드

- 그룹 내부 8 / 그룹 사이 16 / 섹션 사이 32. 페이지 패딩 28
- radius: 버튼·인풋 6 / 칩 9999 / 카드·패널 12 / 필름·웰 8-10

## 레이아웃

- 앱 셸: 사이드바 240px(흰 시트, shadow-sidebar, 보더 없음) + 콘텐츠
- 탑바 56px: 반투명 베일(blur 14px) — flow 배경이 아래로 비침. 좌측
  브레드크럼(현재 세그먼트만 ink), 우측 검색 220px + `⌘K` + 알림 + 아바타
- 사이드바: 그룹 라벨(WORKSPACE·ASSIST·RECORDS) 11px 모노, 아이템 36px,
  active = 틸 wash + 틸 아이콘. 하단 사용자 + `CXR-NET V2.4 · 검증됨` 칩
- 콘텐츠 max-width 1400, 패널 간 gap 16

## 컴포넌트 언어

- 확률 바: 트랙 4px + 임계값 틱(1×8px 세로선) + 정수 % 모노 600.
  임계 미만 fill 회색 / 이상 틸(위급 소견은 critical-fill)
- 소견 로케이터 글리프: 미니 폐 실루엣 + 병변 위치 점 (아이콘이 곧 위치 정보)
- 히어로 스코어: 모노 중립색 숫자 + 상태 점 + 라틴 마이크로 라벨. 색칠 금지
- 상태 칩: 24px pill, 점 + 라벨, wash 배경, 테두리 없음
- 테이블: 가로 헤어라인만, 숫자 우측 정렬, ID·시각 Geist Mono,
  위급 행 이름 앞 빨강 점, 선택 행 틸 wash
- 모델 각인: 모든 AI 출력에 `CXR-NET V2.4 · 검증일` 11px 모노
- 버튼: primary 틸 fill 화면당 1개(shadow-accent), 나머지 filled-ghost
- 필름 뷰포트(`components/film.tsx`): DICOM 4코너 텍스트(10px 모노 +
  텍스트 섀도), R 마커, W/L·ZOOM 표기, 캡션 바(레터박스), 히트맵 스와치.
  실제 영상은 `public/xray/` — pa.png(메인)·prior.jpeg(비교)·
  ct-axial.png(CT 대조)·case-similar.jpg(유사 사례). 오버레이(히트맵·
  외곽선)는 HeatOverlay가 이미지 위에 동일 언어로 그림
- 뷰어 툴바 48px: 줌·계측·비교·전체화면 + W/L 프리셋 + AI OVERLAY
  3분할 세그먼트(끄기/외곽선/히트맵) + 불투명도 40%

## 에이전트 채팅

- 셸은 뷰포트 고정(h = 100vh - 104px), 메시지 리스트만 내부 스크롤,
  컴포저 하단 고정. 우측 레일도 독립 스크롤
- 아바타·봇 버블 금지. 사용자 = 우측 surface-2 라운드 버블(max 85%),
  에이전트 = 플랫 full-width 산문
- 단계 영수증: 접힌 pill "5단계 실행 · 문헌 3편 인용 · 12초"
- 스트리밍: 실제 단계명 시머 텍스트("진료 가이드라인 검색 중…")
- 인용 칩: 번호 pill(틸 wash) + `영상` 칩(시안) — 근거 화면 딥링크
- 감별진단은 3버킷 구조화: 가장 유력 / 확장 감별 / 놓치면 안 됨
- 컴포저: 검사 컨텍스트 칩 자동 부착 + 하단 상시 면책 1줄

## 아이콘

- 24×24 viewBox, 1.5px 센터 스트로크, round cap/join, currentColor
- 시그니처: 교차 지점 1.5px 갭 브레이크 (돋보기 손잡이, 크로스헤어 틱)
- 렌더 20px, 히트 타깃 32px+

## 모션

- 마이크로 120-150ms / 패널 240ms. ease-out `cubic-bezier(0.165,0.84,0.44,1)`
- transform + opacity만. 버튼 press scale 0.97. reduced-motion 존중

## 카피 원칙 (규제 인지)

- AI는 "감지·제안", 의사는 "확인·판독". 모든 AI 소견에 "의심" 접두
- 확률은 정수 %. "정상" 대신 "유의 소견 미검출"
- 의학 방법론 용어(Grad-CAM·DICOM·PA·mIoU)는 유지, 엔지니어링 용어 금지

## 정보 구조 (보고서 캡처 5장 매핑)

1. `/` 진단 대시보드 — KPI + 우선 확인 케이스(영상·확률·에이전트 통합) + 워크리스트
2. `/analysis` 분류 분석 — 뷰어(PA + 비교) + 임상 정보 입력 + 소견별 확률/스코어
3. `/evidence` 근거 시각화 — PA 외곽선/Grad-CAM/Eigen-CAM/CT 대조 + 문장 기여도 + 정량 평가
4. `/agent` 진단 에이전트 — 채팅(영수증·인용 칩·3버킷 감별) + 도구 실행 현황
5. `/literature` 문헌 검색 — 검색 파이프라인 + 근거 등급 출처 카드 + 신뢰도 검증
