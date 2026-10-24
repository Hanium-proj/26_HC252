# Chest AI Frontend

Next.js 16 / React 19 / TypeScript / Tailwind 3. 고정 환자와 mock API를 제거하고 `/api/[...path]` 서버 프록시로 실제 FastAPI에 연결한다.

- `/`: 실제 업로드·워크리스트·실측 처리 시간 집계
- `/analysis`: 임상 정보·실제 비교 영상 선택, 실제 분석, 점수·설명·JSON 다운로드
- `/evidence`: 실제 소견별 Grad-CAM·폐/심장 분할·불투명도·확대
- `/literature`: 제공 가이드라인·로컬 유사 판독문·공개 논문·공개 증례
- `/agent`: 실제 근거 검색·OpenAI 스트리밍·대화 이력·답변별 출처·중단/오류 표시

데이터 상태는 SWR로 관리하며 검사 데이터는 백엔드에 저장한다. API 키는 서버 환경변수로만 읽고 브라우저 번들에 노출하지 않는다. 실제 프록시 설정은 `.env.example`을 참고한다. 전체 실행은 루트 [README](../README.md)를 따른다.

```bash
npm ci
npm run dev -- --port 3001
npm run lint
npm run typecheck
npm run build
npm audit
```

실제 영상과 모델 출력만 렌더링한다. `public/xray/model/`에 남아 있는 저장소의 기존 영상들은 회귀 검증 입력으로 사용한 자료이며, 사용자 검사로 자동 등록하지 않는다. 연구 모델 점수는 보정된 확률이 아니고 Grad-CAM은 병변 분할이 아니다.
