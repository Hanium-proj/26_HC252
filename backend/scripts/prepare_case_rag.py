"""Index real MIMIC-CXR reports in local FTS5, without extracting 227k files.

Never prints report text or identifiers. Outputs stay under ignored data/.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sqlite3
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.storage import root  # noqa: E402


def report_text(text: str) -> str:
    parts = re.split(r"(?m)^\s*([A-Z][A-Z /_-]{2,40}):\s*", text)
    selected = []
    for i in range(1, len(parts) - 1, 2):
        if parts[i].strip() in {"FINDINGS", "IMPRESSION", "CONCLUSION"}:
            selected.append(parts[i] + ": " + parts[i + 1])
    # Last paragraph only for reports lacking formal section headings.
    fallback = re.split(r"\n\s*\n", text.strip())[-1]
    return " ".join((" ".join(selected) if selected else fallback).split())[:10000]


def build(bundle: Path, labels_path: Path):
    labels = {}
    with labels_path.open(newline="") as stream:
        for row in csv.DictReader(stream):
            labels["s" + row["study_id"]] = {
                k: float(v)
                for k, v in row.items()
                if k not in {"subject_id", "study_id"} and v.strip()
            }
    report_zip = root() / "mimic-cxr-reports.zip"
    if not report_zip.exists():
        with zipfile.ZipFile(bundle) as archive:
            member = next(n for n in archive.namelist() if n.endswith("/mimic-cxr-reports.zip"))
            with archive.open(member) as source, report_zip.open("wb") as target:
                shutil.copyfileobj(source, target)
    output = root() / "case-reports.building.sqlite3"
    output.unlink(missing_ok=True)
    db = sqlite3.connect(output)
    db.execute("CREATE VIRTUAL TABLE reports USING fts5(case_id UNINDEXED, text, labels UNINDEXED)")
    batch = []
    count = 0
    with zipfile.ZipFile(report_zip) as archive:
        for member in archive.infolist():
            match = re.search(r"/(s\d+)\.txt$", member.filename)
            if not match or member.file_size > 1_000_000:
                continue
            text = report_text(archive.read(member).decode("utf-8", errors="replace"))
            if not text:
                continue
            identifier = match[1]
            batch.append((identifier, text, json.dumps(labels.get(identifier, {}))))
            if len(batch) == 2000:
                db.executemany("INSERT INTO reports VALUES (?,?,?)", batch)
                count += len(batch)
                batch.clear()
                print(f"Indexed {count} reports", flush=True)
    db.executemany("INSERT INTO reports VALUES (?,?,?)", batch)
    count += len(batch)
    db.execute("INSERT INTO reports(reports) VALUES ('optimize')")
    db.commit()
    db.close()
    output.replace(root() / "case-reports.sqlite3")
    print(f"Ready: {count} local reports")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("labels", type=Path)
    args = parser.parse_args()
    build(args.bundle, args.labels)
