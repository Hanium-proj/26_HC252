# 인터페이스 계약

A 담당과 B 담당이 독립적으로 개발하기 위해 합의해야 하는 것은 이 문서 하나다.
실제 정의는 `backend/app/schemas/` 에 있고, 이 문서는 그 의도를 설명한다.

**이 계약을 바꾸는 변경은 두 사람 합의 후 PR로만 진행한다.**
`backend/tests/test_schemas.py` 가 계약을 지키는 회귀 테스트다.

## EvidenceItem - 최소 단위

도구 하나가 주장 하나에 대해 내놓은 근거다.

```json
{
  "claim": "pleural_effusion",
  "tool": "classifier",
  "kind": "image",
  "result": true,
  "confidence": 0.82,
  "evidence": { "location": "left_costophrenic_angle" },
  "quality": 0.91
}
```

| 필드 | 타입 | 의미 |
|---|---|---|
| `claim` | str | 검증 대상 주장 |
| `tool` | enum | classifier / localizer / vqa / quantifier / knowledge_rag / case_rag |
| `kind` | enum | image(환자 영상) / literature(문헌) / case(유사 증례) |
| `result` | bool \| float \| str | 도구 판정. classifier=bool, quantifier=float, vqa=str |
| `confidence` | 0~1 | 도구가 자기 판정에 보고한 확신도 |
| `quality` | 0~1 | 입력 품질. 영상 노이즈/자세, 문헌 신선도 등 |
| `evidence` | dict | 도구별 부가 근거. localizer=bbox, rag=citation |

`confidence`와 `quality`를 분리한 이유: 모델이 확신해도 입력이 나쁘면 그 확신을 믿을 수 없다.
Trust 계산은 이 둘을 곱해서 쓴다.

## EvidencePacket - A가 B에게 넘기는 것

```json
{
  "case_id": "c-2026-0142",
  "query": "흉수가 있나요?",
  "items": [ /* EvidenceItem[] */ ],
  "missing_evidence": ["pneumothorax"],
  "notes": {}
}
```

`missing_evidence`는 Planner가 required로 지정했으나 수집하지 못한 근거다.
B는 여기에 항목이 남아 있으면 NEED_MORE_EVIDENCE로 판정한다.

## FinalEvidence - B의 출력

```json
{
  "case_id": "c-2026-0142",
  "query": "흉수가 있나요?",
  "verdicts": [
    {
      "claim": "pleural_effusion",
      "verdict": "ACCEPT",
      "trust_score": 0.87,
      "supporting": [ /* EvidenceItem[] */ ],
      "opposing": [],
      "conflict": null,
      "rationale": "classifier와 문헌 근거가 일치"
    }
  ],
  "citations": [],
  "overall": "ACCEPT"
}
```

## 개발 순서 제안

두 사람이 서로를 기다리지 않게 하려면:

1. (같이) `schemas/`를 확정하고 `test_schemas.py`를 통과시킨다.
2. (각자) 상대 모듈은 **고정된 더미 데이터**로 대체하고 자기 파이프라인을 완성한다.
   - A: RAG 없이 EvidencePacket 생성까지
   - B: 손으로 만든 EvidencePacket JSON을 입력으로 Trust 계산까지
3. (같이) `/agent/stream`에서 실제로 연결하고 맞물리는지 확인한다.

2단계에서 상대를 기다리는 순간 계약이 잘못 잡힌 것이다. 그때 다시 1단계로 돌아간다.
