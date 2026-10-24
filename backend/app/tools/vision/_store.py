"""[담당 A] 사전 산출된 모델 결과 저장소.

GPU 서버를 실시간으로 호출하지 않고, 학습 완료 후 일괄 생성해 둔 결과를 읽는다.
평가용 test split 26,489장의 14소견 확률과, 선별된 finding-case 의 CAM 정합성
지표가 이미 파일로 존재하므로 추론을 다시 돌릴 필요가 없다.

이 방식의 근거:
  - 논문의 검증 대상은 분류기 성능이 아니라 근거 통합 파이프라인이다
  - test split 예측은 이미 확정된 산출물이므로 재현성이 오히려 높다
  - RunPod / GPU 없이 전체 파이프라인이 동작한다

실시간 추론이 필요해지면 runpod_client.infer 를 구현해 같은 형식으로 반환하면
나머지 계층은 수정할 필요가 없다.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

# 14개 CheXpert observation. 컬럼 접두사는 prob_ / gt_ / pred_ 이다.
CLASS_NAMES = [
    "Atelectasis",
    "Cardiomegaly",
    "Consolidation",
    "Edema",
    "Enlarged Cardiomediastinum",
    "Fracture",
    "Lung Lesion",
    "Lung Opacity",
    "No Finding",
    "Pleural Effusion",
    "Pleural Other",
    "Pneumonia",
    "Pneumothorax",
    "Support Devices",
]

# 촬영 자세별 입력 품질. 학습과 CAM 평가가 정면(AP/PA)만 사용했으므로
# 측면 영상은 분포 밖 입력으로 보고 낮춘다. AP 는 이동형 촬영이 많아
# PA 보다 낮게 둔다. 학습된 품질 모델이 아니라 휴리스틱이며, 실제 품질
# 판정기가 준비되면 이 표를 대체한다.
VIEW_QUALITY: dict[str, float] = {
    "PA": 0.95,
    "AP": 0.90,
    "AP AXIAL": 0.80,
    "LATERAL": 0.45,
    "LL": 0.45,
}
DEFAULT_VIEW_QUALITY = 0.60


def _default_root() -> Path:
    """산출물 루트. 환경변수로 덮어쓸 수 있다."""
    env = os.getenv("GLASS_HANDOFF_DIR")
    if env:
        return Path(env)
    return Path("data/glass_agent_handoff")


@dataclass
class ImagePrediction:
    """영상 한 장에 대한 분류 결과."""

    dicom_id: str
    study_id: str
    subject_id: str
    view: str
    path: str
    probabilities: dict[str, float]
    ground_truth: dict[str, int] = field(default_factory=dict)

    @property
    def quality(self) -> float:
        return VIEW_QUALITY.get(self.view.upper().strip(), DEFAULT_VIEW_QUALITY)

    def probability(self, finding: str) -> float | None:
        """소견 표기가 달라도 찾는다."""
        if finding in self.probabilities:
            return self.probabilities[finding]
        key = finding.strip().lower().replace("_", " ")
        for name, p in self.probabilities.items():
            if name.lower() == key:
                return p
        return None

    def truth(self, finding: str) -> int | None:
        if finding in self.ground_truth:
            return self.ground_truth[finding]
        key = finding.strip().lower().replace("_", " ")
        for name, v in self.ground_truth.items():
            if name.lower() == key:
                return v
        return None

    def top_findings(self, k: int = 3, exclude_no_finding: bool = True) -> list[tuple[str, float]]:
        items = [
            (n, p)
            for n, p in self.probabilities.items()
            if not (exclude_no_finding and n == "No Finding")
        ]
        return sorted(items, key=lambda x: x[1], reverse=True)[:k]


@dataclass
class CamRecord:
    """finding-case 하나의 CAM 정합성 지표."""

    dicom_id: str
    finding: str
    view: str
    probability: float
    grad_raw_pass: bool
    grad_raw_lung: float
    eigen_raw_pass: bool
    eigen_raw_lung: float
    eigen_masked_lung: float
    output_path: str = ""


class PredictionStore:
    """예측 CSV 와 CAM 정합성 JSON 을 메모리에 올린다."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = Path(root) if root else _default_root()
        self._preds: dict[str, ImagePrediction] = {}
        self._by_study: dict[str, list[str]] = {}
        self._cams: dict[tuple[str, str], CamRecord] = {}
        self._loaded = False

    # ---------- 적재 ----------

    def load(self) -> None:
        if self._loaded:
            return
        self._load_predictions()
        self._load_cams()
        self._loaded = True

    def _load_predictions(self) -> None:
        csv_path = Path(
            os.getenv(
                "GLASS_PREDICTIONS_CSV",
                self.root / "predictions" / "test_image_predictions.csv",
            )
        )
        if not csv_path.exists():
            return

        import csv as _csv

        with csv_path.open(newline="", encoding="utf-8") as fh:
            for row in _csv.DictReader(fh):
                dicom_id = row.get("dicom_id", "")
                if not dicom_id:
                    continue
                probs, truth = {}, {}
                for name in CLASS_NAMES:
                    p = row.get(f"prob_{name}")
                    if p not in (None, ""):
                        probs[name] = float(p)
                    g = row.get(f"gt_{name}")
                    if g not in (None, ""):
                        try:
                            truth[name] = int(float(g))
                        except ValueError:
                            pass
                pred = ImagePrediction(
                    dicom_id=dicom_id,
                    study_id=row.get("study_id", ""),
                    subject_id=row.get("subject_id", ""),
                    view=row.get("ViewPosition", ""),
                    path=row.get("path", ""),
                    probabilities=probs,
                    ground_truth=truth,
                )
                self._preds[dicom_id] = pred
                self._by_study.setdefault(pred.study_id, []).append(dicom_id)

    def _load_cams(self) -> None:
        json_path = Path(
            os.getenv(
                "GLASS_GROUNDING_JSON",
                self.root / "reports" / "grounding_A3_final_cnn.json",
            )
        )
        if not json_path.exists():
            return
        data = json.loads(json_path.read_text(encoding="utf-8"))
        for rec in data.get("records", []):
            grad = rec.get("grad_cam", {})
            eigen = rec.get("eigen_cam", {})
            key = (rec.get("dicom_id", ""), _norm(rec.get("finding", "")))
            self._cams[key] = CamRecord(
                dicom_id=rec.get("dicom_id", ""),
                finding=rec.get("finding", ""),
                view=rec.get("view", ""),
                probability=float(rec.get("prediction_probability", 0.0)),
                grad_raw_pass=bool(grad.get("raw", {}).get("proxy_pass", False)),
                grad_raw_lung=float(grad.get("raw", {}).get("lung_energy_fraction", 0.0)),
                eigen_raw_pass=bool(eigen.get("raw", {}).get("proxy_pass", False)),
                eigen_raw_lung=float(eigen.get("raw", {}).get("lung_energy_fraction", 0.0)),
                eigen_masked_lung=float(
                    eigen.get("lung_masked", {}).get("lung_energy_fraction", 0.0)
                ),
                output_path=rec.get("output_path", ""),
            )

    # ---------- 조회 ----------

    @property
    def available(self) -> bool:
        self.load()
        return bool(self._preds)

    def get(self, image_ref: str) -> ImagePrediction | None:
        """dicom_id 또는 경로로 조회한다."""
        self.load()
        if image_ref in self._preds:
            return self._preds[image_ref]
        stem = Path(image_ref).stem
        return self._preds.get(stem)

    def by_study(self, study_id: str) -> list[ImagePrediction]:
        self.load()
        return [self._preds[d] for d in self._by_study.get(str(study_id), [])]

    def cam(self, dicom_id: str, finding: str) -> CamRecord | None:
        self.load()
        return self._cams.get((dicom_id, _norm(finding)))

    def cam_cases(self) -> list[CamRecord]:
        self.load()
        return list(self._cams.values())

    def sample_ids(self, n: int = 5) -> list[str]:
        self.load()
        return list(self._preds.keys())[:n]

    def stats(self) -> dict[str, Any]:
        self.load()
        return {
            "images": len(self._preds),
            "studies": len(self._by_study),
            "cam_cases": len(self._cams),
            "root": str(self.root),
        }


def _norm(name: str) -> str:
    return "_".join(name.strip().lower().split()).replace("-", "_")


@lru_cache
def get_store() -> PredictionStore:
    return PredictionStore()
