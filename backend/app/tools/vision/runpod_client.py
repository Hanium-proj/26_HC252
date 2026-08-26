"""[담당 A] RunPod 모델 서버 HTTP 클라이언트.

GPU 모델(ViT classifier, CAM, VQA, Qwen)은 RunPod 에서 서빙하고
Railway 의 이 백엔드는 HTTP 로만 호출한다. 이 파일이 그 유일한 경계다.
"""

from __future__ import annotations

from typing import Any


async def infer(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    """RunPod 엔드포인트를 호출한다.

    구현 시 반드시 챙길 것:
      - timeout (cold start 로 첫 호출이 수십 초 걸릴 수 있음)
      - 재시도 + 지수 백오프
      - 실패 시 예외 대신 빈 결과 + missing_evidence 로 흘려보낼지 결정
    """
    raise NotImplementedError("담당 A: RunPod 클라이언트 구현")
