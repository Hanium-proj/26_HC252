# Chest AI · 진단 지원 플랫폼 (UI)

흉부 X-ray + 임상정보 기반 폐 질환 진단 지원 서비스의 프론트엔드.
2026 한이음 드림업 프로토타입 시연용으로, 5개 주요 기능이 각 화면(라우트)으로
분리되어 있고 **모든 상호작용이 mock 파이프라인 위에서 실제로 동작한다**
(백엔드 없이 실행 가능).

## 화면 구성

- `/` 진단 지원 대시보드 — 워크리스트 행 클릭으로 케이스 선택
- `/analysis` 멀티모달 폐 질환 분류 — 영상 업로드 · 임상 정보 편집 · 분석 실행
- `/evidence` 판독 근거 시각화 — AI OVERLAY 토글 · 대상 소견 전환 · 불투명도
- `/agent` LLM 진단 에이전트 — 질문 입력 · 단계/토큰 스트리밍 · 후속 질문
- `/literature` RAG 문헌·사례 검색 — 질문 수정 · 파이프라인 · 결과 등급

## 실행 (Mac)

    npm install
    npm run dev

브라우저에서 http://localhost:3000 접속. 탑바 `⌘K` 로 검사 검색.

## 시연 흐름 (권장)

1. 대시보드에서 `PX-2026-0125` (분석 중) 행 클릭 -> 분류 분석 이동
2. 임상 정보 확인 후 **멀티모달 분석 실행** -> 단계 진행 -> 확률 · 스코어 표시
   (파일 영역 클릭으로 X-ray 이미지를 직접 업로드해도 된다. 브라우저 메모리에만 올라간다)
3. 근거 시각화에서 AI OVERLAY 끄기 / 외곽선 / 히트맵 토글, 대상 소견 전환
4. 진단 에이전트에서 질문 입력 (스타터 칩 또는 직접 타이핑) -> 답변 스트리밍 ->
   후속 질문 칩 클릭. 우측 레일의 도구 실행 횟수 · 확신도가 함께 갱신된다
5. 문헌 검색에서 질문을 수정하고 Enter -> 검색 파이프라인 -> 결과 · 신뢰도

준비된 에이전트 질문 유형: 감별 진단 / 외래 치료 · 중증도(CURB-65) / 과거 영상 비교 /
근거 영역 설명 / 폐결절 추적 기준 / 다음 검사 권고. 그 외 질문은 범용 답변으로 응답한다.

## 재촬영

사이드바 하단 **세션 초기화** 를 누르면 케이스 선택 · 분석 결과 · 대화 · 업로드 ·
도구 카운트가 처음 상태로 돌아간다. 상태는 `sessionStorage` 에 있으므로 탭을 닫아도
초기화된다.

## 실 API 연동 시

mock 은 `lib/demo/api.ts` 한 파일에 모여 있고, 백엔드 `/agent/stream` 의 SSE 이벤트
순서(`plan -> tool -> evidence -> verdict -> token -> done`)를 그대로 따른다.
같은 이벤트를 내는 fetch/SSE 리더로 이 파일만 교체하면 화면은 수정할 필요가 없다.

- `lib/demo/cases.ts` — 케이스별 환자 · 소견 · 근거 영역 데이터
- `lib/demo/agent-script.ts` — 질문 의도별 에이전트 답변
- `lib/demo/literature-script.ts` — 질의 의도별 문헌 결과
- `lib/demo/store.tsx` — 화면 간 공유 상태 (Context + sessionStorage)

## 모델 실제 출력 (PX-2026-0142 · PX-2026-0125)

`public/xray/model/<케이스>/` 의 6장씩은 비전 파이프라인이 실제로 낸 결과다
(2x3 그리드 figure 를 패널 경계 검출로 분리). 0142 = Pneumothorax AP p=0.803,
0125 = Edema AP p=0.814:

- `original.png` 원본 AP 촬영 / `lung-mask.png` 폐 분할 마스크
- `gradcam-raw.png` · `gradcam-masked.png` Grad-CAM (raw / 마스크 적용)
- `eigencam-raw.png` · `eigencam-masked.png` Eigen-CAM (raw / 마스크 적용)

`lib/demo/cases.ts` 의 `images` 필드에 연결돼 있어서 분석 · 근거 · 대시보드 화면이
그린 오버레이 대신 이 이미지를 쓴다 (히트맵 토글 = 실제 CAM 레이어, 외곽선 =
CAM 핫스팟에서 측정한 좌표). 다른 케이스도 같은 형식의 이미지를 넣고 `images` 만
채우면 된다.

## 실제 영상 교체

X-ray / CT 영상은 `public/xray/` 에 있다. `components/film.tsx` 의 `Film` 에
`src` 를 넘기면 DICOM 코너 텍스트 · 오버레이가 그대로 얹힌다. 근거 영역 좌표는
400x500 필름 공간 기준으로 `lib/demo/cases.ts` 의 `regions` 에 둔다.

## 디자인 시스템

`DESIGN.md` 참고. 토큰 단일 출처는 `app/globals.css`(CSS 변수) +
`tailwind.config.ts` 매핑. 폰트 Pretendard, letter-spacing -2.5%.

## 스택

Next.js 14 (App Router) · TypeScript · Tailwind CSS 3
