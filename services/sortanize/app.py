"""
Sortanize FastAPI engine — ephemeral match jobs over vendored lead_matching.
Location: services/sortanize-engine/app.py
"""
from __future__ import annotations

import base64
import io
import tempfile
from pathlib import Path
from typing import Any, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from lead_matching import (
    build_column_mapping,
    clean_dataframe_columns,
    cleanup_placeholder_16,
    deduplicate_against_existing,
    deduplicate_leads,
    dataset_quality_stats,
)

MAX_ROWS = 50_000
ALLOWED_EXT = {".csv", ".xlsx", ".xls"}
FIELD_KEYS = (
    "company",
    "phone",
    "email",
    "address",
    "street",
    "house_number",
    "postal_code",
    "city",
    "branch",
)

app = FastAPI(title="sortanize-engine", version="1.0.0")


class FilePayload(BaseModel):
    name: str
    content_base64: str = Field(..., alias="contentBase64")

    model_config = {"populate_by_name": True}


class MarkConfig(BaseModel):
    column: str
    yes: str = "ja"
    no: str = "nein"


class PreviewRequest(BaseModel):
    file: FilePayload


class RunRequest(BaseModel):
    mode: str
    file_a: FilePayload = Field(..., alias="fileA")
    file_b: FilePayload = Field(..., alias="fileB")
    mapping_a: Optional[dict[str, Optional[str]]] = Field(None, alias="mappingA")
    mapping_b: Optional[dict[str, Optional[str]]] = Field(None, alias="mappingB")
    mark: Optional[MarkConfig] = None

    model_config = {"populate_by_name": True}


def _ext(name: str) -> str:
    return Path(name or "").suffix.lower()


def _decode_file(payload: FilePayload) -> tuple[bytes, str]:
    name = (payload.name or "upload").strip()
    ext = _ext(name)
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, detail=f"Dateityp nicht erlaubt: {ext or '(ohne)'}")
    try:
        raw = base64.b64decode(payload.content_base64, validate=True)
    except Exception as exc:  # noqa: BLE001 — trust boundary
        raise HTTPException(400, detail="Base64 ungültig") from exc
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(413, detail="Datei zu groß (max. 20 MB)")
    return raw, name


def _load_dataframe(raw: bytes, name: str) -> pd.DataFrame:
    ext = _ext(name)
    bio = io.BytesIO(raw)
    try:
        if ext == ".csv":
            sample = raw[:8192]
            delimiter = ";" if sample.count(b";") >= sample.count(b",") else ","
            encoding = "utf-8-sig"
            for enc in ("utf-8-sig", "utf-8", "latin1", "cp1252"):
                try:
                    sample.decode(enc)
                    encoding = enc
                    break
                except UnicodeDecodeError:
                    continue
            try:
                df = pd.read_csv(
                    bio,
                    sep=delimiter,
                    encoding=encoding,
                    dtype=str,
                    keep_default_na=False,
                )
            except pd.errors.ParserError:
                bio.seek(0)
                alt = "," if delimiter == ";" else ";"
                df = pd.read_csv(
                    bio,
                    sep=alt,
                    encoding=encoding,
                    dtype=str,
                    keep_default_na=False,
                )
        else:
            df = pd.read_excel(bio, dtype=str).fillna("")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, detail=f"Datei konnte nicht gelesen werden: {name}") from exc

    df = clean_dataframe_columns(df)
    if len(df) > MAX_ROWS:
        raise HTTPException(413, detail=f"Zu viele Zeilen (max. {MAX_ROWS})")
    return df


def _df_to_csv_b64(df: pd.DataFrame) -> str:
    buf = io.StringIO()
    df.to_csv(buf, index=False, sep=";")
    return base64.b64encode(buf.getvalue().encode("utf-8-sig")).decode("ascii")


def _normalize_mapping(
    columns: list[str],
    override: Optional[dict[str, Optional[str]]],
) -> dict[str, Optional[str]]:
    auto = build_column_mapping(columns)
    if not override:
        return auto
    out = dict(auto)
    for key in FIELD_KEYS:
        if key in override:
            val = override[key]
            if val is None or val == "" or val == "__none__":
                out[key] = None
            elif val in columns:
                out[key] = val
            # ignore unknown column names (fail soft on mapping typos)
    return out


def _prepare(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    cleaned, n = cleanup_placeholder_16(df)
    return cleaned, n


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "sortanize-engine"}


@app.post("/preview")
def preview(body: PreviewRequest) -> dict[str, Any]:
    raw, name = _decode_file(body.file)
    df = _load_dataframe(raw, name)
    df, _ = _prepare(df)
    columns = [str(c) for c in df.columns]
    mapping = build_column_mapping(columns)
    stats = dataset_quality_stats(df, mapping)
    return {
        "ok": True,
        "name": name,
        "columns": columns,
        "mapping": mapping,
        "rowCount": int(len(df)),
        "stats": stats,
        "warnings": _warnings(mapping),
    }


def _warnings(mapping: dict[str, Optional[str]]) -> list[str]:
    warnings: list[str] = []
    if not mapping.get("phone") and not mapping.get("email"):
        warnings.append("Weder Telefon noch E-Mail erkannt — Matching wird schwächer.")
    if not mapping.get("company"):
        warnings.append("Keine Firmen-Spalte erkannt.")
    return warnings


@app.post("/run")
def run(body: RunRequest) -> dict[str, Any]:
    mode = (body.mode or "").strip().lower()
    if mode not in ("duplicates", "customer-match"):
        raise HTTPException(400, detail="mode muss duplicates oder customer-match sein")

    raw_a, name_a = _decode_file(body.file_a)
    raw_b, name_b = _decode_file(body.file_b)
    if len(raw_a) + len(raw_b) > 20 * 1024 * 1024:
        raise HTTPException(413, detail="Dateien zusammen zu groß (max. 20 MB)")

    # Ephemeral dir — always cleaned in finally
    with tempfile.TemporaryDirectory(prefix="sortanize-") as tmp:
        Path(tmp, name_a).write_bytes(raw_a)
        Path(tmp, name_b).write_bytes(raw_b)

        df_a = _load_dataframe(raw_a, name_a)
        df_b = _load_dataframe(raw_b, name_b)
        df_a, _ = _prepare(df_a)
        df_b, _ = _prepare(df_b)

        mapping_a = _normalize_mapping(list(df_a.columns), body.mapping_a)
        mapping_b = _normalize_mapping(list(df_b.columns), body.mapping_b)

        if mode == "duplicates":
            return _run_duplicates(df_a, df_b, mapping_a, mapping_b)
        return _run_customer_match(df_a, df_b, mapping_a, mapping_b, body.mark)


def _run_duplicates(
    existing: pd.DataFrame,
    leads: pd.DataFrame,
    mapping_a: dict[str, Optional[str]],
    mapping_b: dict[str, Optional[str]],
) -> dict[str, Any]:
    result = deduplicate_leads(existing, leads, mapping_a, mapping_b)
    counts = {
        "existingRows": int(len(existing)),
        "leadRows": int(len(leads)),
        "finalLeads": int(len(result.final_leads)),
        "removedExisting": int(len(result.removed_existing)),
        "internalDuplicates": int(len(result.internal_duplicates)),
        "possibleDuplicates": int(len(result.possible_duplicates)),
        "errorRows": int(len(result.error_rows)),
    }
    files = [
        {
            "name": "bereinigte_liste.csv",
            "label": "Bereinigte Liste",
            "contentBase64": _df_to_csv_b64(result.final_leads),
        },
        {
            "name": "entfernte_bestandskunden.csv",
            "label": "Entfernte Bestandstreffer",
            "contentBase64": _df_to_csv_b64(result.removed_existing),
        },
        {
            "name": "interne_duplikate.csv",
            "label": "Interne Duplikate",
            "contentBase64": _df_to_csv_b64(result.internal_duplicates),
        },
        {
            "name": "moegliche_duplikate.csv",
            "label": "Mögliche Duplikate",
            "contentBase64": _df_to_csv_b64(result.possible_duplicates),
        },
        {
            "name": "fehlerzeilen.csv",
            "label": "Fehlerzeilen",
            "contentBase64": _df_to_csv_b64(result.error_rows),
        },
    ]
    return {"ok": True, "mode": "duplicates", "counts": counts, "files": files}


def _run_customer_match(
    existing: pd.DataFrame,
    check: pd.DataFrame,
    mapping_a: dict[str, Optional[str]],
    mapping_b: dict[str, Optional[str]],
    mark: Optional[MarkConfig],
) -> dict[str, Any]:
    if not mark or not str(mark.column or "").strip():
        raise HTTPException(400, detail="Mark-Spalte fehlt")
    yes_v = str(mark.yes if mark.yes is not None else "ja").strip()
    no_v = str(mark.no if mark.no is not None else "nein").strip()
    if not yes_v or not no_v:
        raise HTTPException(400, detail="ja/nein-Werte dürfen nicht leer sein")
    col = str(mark.column).strip()
    if len(col) > 80:
        raise HTTPException(400, detail="Spaltenname zu lang")

    remaining, removed, possible, errors = deduplicate_against_existing(
        existing, check, mapping_a, mapping_b
    )
    matched_lead_rows: set[int] = set()
    if removed is not None and not removed.empty and "_lead_row" in removed.columns:
        for val in removed["_lead_row"]:
            try:
                matched_lead_rows.add(int(val))
            except (TypeError, ValueError):
                continue

    out = check.copy()
    if col not in out.columns:
        out[col] = no_v
    for idx in out.index:
        lead_row = int(idx) + 2  # lead_matching row_number convention
        out.at[idx, col] = yes_v if lead_row in matched_lead_rows else no_v

    counts = {
        "existingRows": int(len(existing)),
        "checkRows": int(len(check)),
        "markedYes": int(len(matched_lead_rows)),
        "markedNo": int(len(check) - len(matched_lead_rows)),
        "possibleDuplicates": int(len(possible)),
        "errorRows": int(len(errors)),
        "remainingUnmatched": int(len(remaining)),
    }
    files = [
        {
            "name": "pruefliste_markiert.csv",
            "label": "Prüfliste markiert",
            "contentBase64": _df_to_csv_b64(out),
        },
        {
            "name": "treffer_report.csv",
            "label": "Treffer-Report",
            "contentBase64": _df_to_csv_b64(removed),
        },
        {
            "name": "moegliche_treffer.csv",
            "label": "Mögliche Treffer",
            "contentBase64": _df_to_csv_b64(possible),
        },
    ]
    return {
        "ok": True,
        "mode": "customer-match",
        "counts": counts,
        "mark": {"column": col, "yes": yes_v, "no": no_v},
        "files": files,
    }


@app.post("/match")
def simple_list_match(body: dict[str, Any]):
    """Lightweight string-list matcher used by BU2 UI smoke path."""
    source = [str(x) for x in (body.get("source") or [])]
    target = [str(x) for x in (body.get("target") or [])]
    threshold = float(body.get("threshold", 0.6))
    import re
    def norm(s: str) -> str:
        s = s.strip().lower()
        s = re.sub(r"[^a-z0-9äöüß\s\-]", "", s)
        return re.sub(r"\s+", " ", s)
    def score(a: str, b: str) -> float:
        na, nb = norm(a), norm(b)
        if not na or not nb: return 0.0
        if na == nb: return 1.0
        if na in nb or nb in na: return 0.85
        sa, sb = set(na.split()), set(nb.split())
        if not sa or not sb: return 0.0
        return len(sa & sb) / len(sa | sb)
    used=set(); matches=[]
    for s in source:
        best_i, best = -1, 0.0
        for i,t in enumerate(target):
            if i in used: continue
            sc=score(s,t)
            if sc>best: best, best_i = sc, i
        if best_i>=0 and best>=threshold:
            used.add(best_i)
            matches.append({"source":s,"target":target[best_i],"score":round(best,3),"matched":True})
        else:
            matches.append({"source":s,"target":None,"score":round(best,3),"matched":False})
    return {"matches": matches, "unmatched_targets": [t for i,t in enumerate(target) if i not in used]}
