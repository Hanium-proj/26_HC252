> 2026-10-25 현재 실제 로컬 실행 구성은 [README](../README.md)와 [LIVE_API](LIVE_API.md)를 우선 참고합니다. 아래 문서는 기존 팀 배포 구상·EvidencePacket 계약이며, 원래 RunPod 모델이 연결되었다는 의미가 아닙니다.

# 인터페이스 계약

담당 A와 담당 B가 독립적으로 개발하기 위해 합의해야 하는 것은 이 문서 하나다.
실제 정의는 `backend/app/schemas/`에 있고, 이 문서는 그 의도를 설명한다.

**형식 기준은 담당 A의 Agent 파이프라인 출력이다.**
변경은 두 사람 합의 후 PR로만 진행한다. `backend/tests/test_schemas.py`가
담당 A의 실제 출력을 픽스처로 쓰는 회귀 테스트다.

---

## EvidenceItem

도구 하나가 내놓은 근거 단위.

```json
{
  "source": "classifier",
  "claim": "{'finding': 'pleural_effusion', 'probability': 0.82}",
  "evidence_type": "model",
  "confidence": 0.82,
  "metadata": {"finding": "pleural_effusion", "probability": 0.82}
}
```

| 필드 | 타입 | 의미 |
|---|---|---|
| `source` | enum | gatekeeper / classifier / localizer / vqa / quantifier / knowledge / case |
| `claim` | str | 도구가 주장하는 내용 |
| `evidence_type` | enum | model(영상) / literature(문헌) / case(증례) |
| `confidence` | 0~1 | 도구가 자기 판정에 보고한 확신도 |
| `metadata` | dict | 도구별 구조화 출력. **Trust 계산의 입력** |

---

## metadata 규약 - 여기가 핵심

Trust 계산에는 세 가지가 필요한데, 모두 `metadata`에서 도출한다.
따라서 담당 A가 별도 필드를 만들 필요는 없으나 **아래 키는 반드시 채워야 한다.**

| 도구 | 필수 키 | 용도 |
|---|---|---|
| `gatekeeper` | `quality` (0~1) | **영상 품질. 모든 영상 근거에 전파된다** |
| `classifier` | `finding`, `probability` | 검증 대상과 판정 |
| `localizer` | `finding`, `region` | 검증 대상과 위치 |
| `vqa` | `finding`, `answer` | 맥락 정보 |
| `quantifier` | `finding`, `value` | 검증 대상과 측정값 |

### 왜 이 세 가지가 필요한가

**검증 대상(`finding`)** - 근거를 묶는 조인 키다. Trust는 같은 소견에 대한
근거를 모아 지지와 반대를 센다. 이 값이 없으면 모든 근거가 별개 주장이 되어
**충돌 탐지가 영원히 작동하지 않는다.**

**판정** - `probability`, `region`, `value` 등에서 소견 존재 여부를 도출한다.
도출 규칙은 `app/trust/normalize.py`에 도구별로 있다.

**품질(`quality`)** - 신뢰도 계산식의 한 축이다.

```
신뢰도 = 도구 사전확률 x 근거성격 가중치 x confidence x quality
```

품질이 0.25 미만이면 confidence가 0.99여도 0점이 된다. 판독 불가능한 영상에서
나온 확신은 근거가 될 수 없기 때문이다. `gatekeeper`가 이 값을 보고하지 않으면
0.6이 적용된다. 품질 미상을 완벽한 영상과 동일하게 취급하지 않기 위함이다.

### 소견 표기

`finding` 값은 자동 정규화된다. 표기를 통일할 필요는 없다.

```
"Pleural Effusion"  ->  pleural_effusion
"pleural effusion"  ->  pleural_effusion
"pleural_effusion"  ->  pleural_effusion
```

### 소견을 특정하지 못한 경우

`finding`이 `unknown`, `none`, 빈 문자열이면 해당 근거는 **Trust 계산에서
제외되고 `limitations`에 기록된다.**

Planner가 대상을 특정하지 못했는데 `finding: unknown`에 확률 0.82를 달아
보내면, 존재하지 않는 소견을 승인하게 된다. 이 경우 `finding_presence`로
폴백하지 말고 유효한 observation으로 정규화하거나 실패를 선언해야 한다.

---

## EvidencePacket

담당 A -> 담당 B로 넘어가는 컨테이너.

```json
{
  "query": {"question": "...", "image_path": "...", "context": {"targets": [...]}},
  "plan": {
    "task_type": "finding_presence",
    "target": "pleural_effusion",
    "targets": ["pleural_effusion"],
    "required_evidence": ["classifier_prediction", "cam_localization"],
    "tool_call_order": ["gatekeeper", "classifier", "localizer", "vqa"],
    "expected_output_format": "..."
  },
  "items": [ /* EvidenceItem[] */ ],
  "tool_results": [
    {"tool_name": "localizer", "status": "failed", "payload": {}, "error": "CAM 생성 실패"}
  ],
  "limitations": [],
  "status": "complete"
}
```

**`tool_results`가 중요하다.** `items`에는 성공한 근거만 담기므로, 어떤 도구가
실패했는지는 여기서만 알 수 있다. Trust는 이 정보와 `required_evidence`를
대조해 근거 결손을 판정하고 `NEED_MORE_EVIDENCE`를 낸다.

근거가 없어서 못 정하는 것과 근거를 보고 아니라고 판단한 것은 다르다.

### required_evidence 명명 규약

항목명은 도구명과 1:1이 아니므로 키워드로 담당 도구를 판정한다.

| 키워드 | 담당 도구 |
|---|---|
| classifier, prediction, probability | classifier |
| cam, localization, localizer, heatmap, region | localizer |
| vqa, visual_question | vqa |
| quantif, measurement, ctr | quantifier |
| knowledge, literature, guideline | knowledge |
| case, similar | case |

**새 항목명을 추가할 때는 `app/schemas/evidence.py`의
`EVIDENCE_TOOL_KEYWORDS`도 함께 갱신해야 한다.** 매핑되지 않는 항목은
결손 판정이 보류된다.

---

## 질문 유형 8종

| task_type | 예시 |
|---|---|
| `finding_presence` | 흉수가 있어? |
| `finding_location` | 폐렴이 어느 부위에 있어? |
| `report_generation` | 판독문을 작성해줘 |
| `evidence_explanation` | 왜 폐렴이라고 판단했어? |
| `clinical_guidance` | 다음에 어떤 검사가 필요해? |
| `literature_search` | 흉수의 영상학적 기준을 찾아줘 |
| `temporal_comparison` | 지난 X-ray보다 좋아졌어? |
| `uncertainty_check` | 이 결과를 얼마나 믿을 수 있어? |

---

## FinalEvidence - 담당 B의 출력

```json
{
  "query": "흉수가 있어?",
  "task_type": "finding_presence",
  "verdicts": [{
    "claim": "pleural_effusion",
    "verdict": "ACCEPT",
    "trust_score": 1.0,
    "supporting": [ /* EvidenceItem[] */ ],
    "opposing": [],
    "conflict": null,
    "rationale": "지지 근거 신뢰도 1.248 이 임계값 0.35 이상"
  }],
  "citations": [{"claim": "pleural_effusion", "doc_id": "GL004", "page": 12}],
  "limitations": [],
  "overall": "ACCEPT"
}
```

`overall`은 가장 보수적인 판정을 따른다. 주장 하나라도 근거가 부족하면
케이스 전체를 확정하지 않는다.

---

## 담당 B의 RAG를 도구로 호출하기

`knowledge`와 `case`는 담당 A의 orchestrator에서 도구로 호출할 수 있다.
결과가 같은 `EvidenceItem` 형식으로 나오므로 packet에 그대로 넣으면 된다.

```python
from app.retrieval.knowledge_rag.search import search as knowledge_search
from app.retrieval.case_rag.search import search as case_search

items = await knowledge_search(claim="pleural_effusion", query="흉수의 원인은?")
items += await case_search(claim="Pleural Effusion", query_text="Large left pleural effusion")
```

HTTP로 쓰려면 `docs/RAG_셋업가이드.md`를 참고한다.

---

## 개발 순서

두 사람이 서로를 기다리지 않으려면:

1. (같이) 이 문서의 형식을 확정하고 `test_schemas.py`를 통과시킨다.
2. (각자) 상대 모듈은 고정된 더미 데이터로 대체하고 자기 파이프라인을 완성한다.
3. (같이) `/agent/stream`에서 실제로 연결한다.

2단계에서 상대를 기다리는 순간 계약이 잘못 잡힌 것이다. 그때 1단계로 돌아간다.
