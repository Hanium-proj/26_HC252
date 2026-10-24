# 실제 로컬 API 계약

기존 EvidencePacket/FinalEvidence 계약은 보존하지만 현재 UI는 실제 분석 결과를 담는 별도 계약을 사용한다. 프론트 JSON 타입은 `frontend/lib/live/types.ts`, 입력·영상 응답 검증은 `backend/app/schemas/live.py`에 있다.

| 요청 | 동작 |
|---|---|
| `GET /health` | 프로세스 health. 외부 모델/키 유효성을 보장하지 않음 |
| `POST /studies` | multipart `file`. PNG/JPEG/DICOM 해독 후 메타데이터 제거된 PNG 저장 |
| `GET /studies` | 실제 저장된 검사 목록, 입력, 실제 분석 결과 |
| `GET /studies/{id}` | 단일 검사 조회 |
| `PATCH /studies/{id}` | `{note, prior_id, patient_ref}` 저장. 같은 익명 환자 식별자가 등록된 검사만 비교. 변경 시 분석 무효화, 분석 중 수정 차단 |
| `GET /studies/{id}/image/{kind}` | 원본, `cam-N`, `anatomy`, `lung-mask`. 경로 검증·no-store |
| `POST /analyze` | `{case_id, query?}`. 실제 영상 설명·18개 소견·CAM·분할 결과 |
| `GET /literature/search?q=...` | 제공된 문헌 청크 검색. `public=true`면 공개 논문 |
| `GET /cases/search?q=...` | 로컬 MIMIC 판독문 유사 검색. `public=true`면 공개 증례 보고 |
| `POST /agent/stream` | `{case_id?, query, history?, top_k?}`. 실제 OpenAI SSE |

`/health` 외 API는 `X-API-Key`로 보호한다. Next 서버 프록시는 `BACKEND_API_KEY`를 주입한다. 브라우저에는 OpenAI 키나 백엔드 키를 전달하지 않는다. 현재 단일 사용자 로컬 작업 공간이며 프록시 자체에 사용자 로그인 기능은 없다.

## 분석 결과

- `report`: Pydantic 구조 검증을 통과한 OpenAI 영상 설명. 모델 자기 설명이며 전문의 정답이 아니다.
- `classifier`: 실제 모델명·18개 `findings`·점수·해당 영상 CAM URL·실제 계산 시간.
- `segmentation`: 실제 PSPNet 해부학적 마스크·픽셀 면적 비율·심장/폐영역 폭 비율.
- `completed_at`, `latency_ms`, `clinical_snapshot`, `limitations`.
- `verdict=CAUTION`: 임상 검증을 마치지 않은 연구 출력이므로 자동 확정하지 않는다.

## SSE

`plan → tool → evidence → verdict → token... → done`.

`evidence.hits`는 실제 출처·본문·검색 관련도다. `token.text`는 실제 OpenAI 토큰 청크다. `done`은 전체 지연, 첫 토큰 지연, 실제 사용 토큰과 모델명을 포함한다. 검색 실패 시 실제 근거가 없음을 제한 사항으로 전달한다. 생성 실패는 `error` 이벤트로 전파하며 UI는 해당 답변을 미완성으로 표시한다.

HTTP 200만으로 스트리밍 성공을 판단하면 안 된다. 반드시 `done`을 확인한다. 출처 번호는 답변별로 저장된 근거 목록과 대조한다. 모델의 문헌 해석과 문장 수준 근거 일치 여부는 자동 임상 검증이 아니다.
