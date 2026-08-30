"""[담당 B] Case RAG 인덱스 구성 - MIMIC-CXR study 단위 테이블 생성.

Case RAG 스키마 정의는 다음과 같다.
  - study 1건 = row 1건
  - retrieval_text = Findings + Impression (없으면 파서 fallback)
  - study_id / dicom_ids / view_positions / 14개 observation 을 메타데이터로 보존

당초 계획은 파일명에서 dicom_id 를 추출해 image_to_study_map 과 매칭하는
방식이었으나, labels.csv 가 path/dicom_id/study_id 매핑을 이미
보유하므로 해당 단계를 생략한다.

주의: MIMIC-CXR 은 PhysioNet credentialed 데이터이다. 본 모듈이 생성하는 산출물도
원문 리포트를 포함하므로 저장소에 커밋하지 않는다(.gitignore 처리됨).
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

OBSERVATIONS = [
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


def _clean(x: object) -> str:
    if pd.isna(x):
        return ""
    return " ".join(str(x).split())


def load_sections(sectioned_csv: Path) -> pd.DataFrame:
    """공식 파서(create_section_files.py) 출력에서 study 별 섹션을 읽는다.

    출력의 study 컬럼은 's50414267' 형태이므로 정수 study_id 로 변환한다.
    """
    df = pd.read_csv(sectioned_csv)
    df["study_id"] = (
        df["study"].astype(str).str.lstrip("s").astype("int64")
    )
    for col in ("findings", "impression", "last_paragraph", "comparison"):
        if col not in df.columns:
            df[col] = ""
        df[col] = df[col].map(_clean)
    return df


def build_retrieval_text(row: pd.Series) -> str:
    """검색 대상 텍스트를 구성한다.

    Findings + Impression 을 기본으로 하고, 둘 다 없으면 last_paragraph 로
    대체한다. 정형 섹션이 없는 리포트가 존재하기 때문이다.
    비교 소견(comparison)은 과거 검사 참조라 유사 사례 검색에 잡음이 되므로 제외한다.
    """
    # study-list 에는 있으나 섹션 파서가 처리하지 못한 study 가 존재하므로
    # (227,835 중 54건) 각 필드를 _clean 으로 통과시켜 NaN 을 흡수한다.
    parts = [_clean(row.get("findings")), _clean(row.get("impression"))]
    text = " ".join(p for p in parts if p).strip()
    return text or _clean(row.get("last_paragraph"))


def build_study_table(
    sectioned_csv: Path, labels_csv: Path, study_list_gz: Path
) -> pd.DataFrame:
    """study 단위 마스터 테이블을 만든다."""
    sections = load_sections(sectioned_csv)
    studies = pd.read_csv(study_list_gz)
    labels = pd.read_csv(labels_csv, low_memory=False)

    # 이미지 단위 -> study 단위로 접기
    agg = (
        labels.groupby("study_id")
        .agg(
            subject_id=("subject_id", "first"),
            image_count=("dicom_id", "size"),
            dicom_ids=("dicom_id", lambda s: "|".join(s.astype(str))),
            view_positions=("view", lambda s: "|".join(s.dropna().astype(str))),
            image_paths=("path", lambda s: "|".join(s.astype(str))),
            split=("split", "first"),
            study_date=("StudyDate", "first"),
        )
        .reset_index()
    )
    # 라벨은 study 내 이미지에 동일하게 부여되므로 첫 값을 취한다
    label_first = labels.groupby("study_id")[OBSERVATIONS].first().reset_index()
    agg = agg.merge(label_first, on="study_id", how="left")

    master = (
        studies[["study_id", "subject_id", "path"]]
        .rename(columns={"path": "report_relpath"})
        .merge(sections, on="study_id", how="left", suffixes=("", "_sec"))
        .merge(agg.drop(columns=["subject_id"]), on="study_id", how="left")
    )
    master["retrieval_text"] = master.apply(build_retrieval_text, axis=1)
    master["case_id"] = "s" + master["study_id"].astype(str)
    master["has_retrieval_text"] = master["retrieval_text"].str.len() > 0
    return master
