from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional

import pandas as pd


MISSING_MARKERS = {
    "",
    "nan",
    "n.a.",
    "n.a",
    "na",
    "none",
    "null",
    "#error!",
    "#error",
    "-",
    "<na>",
}

PLACEHOLDER_16_FIELDS = {
    "rechtsform",
    "website",
    "webseite",
    "registergericht",
}

FIELD_ALIASES = {
    "company": ["unternehmen", "firma", "firmenname", "company", "name"],
    "phone": ["telefon", "phone", "fon", "tel", "telefonnummer", "telefonnumer"],
    "email": ["email", "e-mail", "e_mail", "mail", "email_adresse"],
    "address": ["adresse", "address", "anschrift"],
    "street": ["straße", "strasse", "street"],
    "house_number": ["hausnr", "hausnr.", "hausnummer", "house_number"],
    "postal_code": ["plz", "postleitzahl", "zip", "zipcode", "postalcode"],
    "city": ["ort", "stadt", "city", "location"],
    "branch": ["branche", "kategorie", "industry", "category", "geschäftszweig"],
}

FIELD_LABELS = {
    "company": "Firma",
    "phone": "Telefon",
    "email": "E-Mail",
    "postal_code": "PLZ",
    "address": "Adresse",
    "city": "Ort",
    "branch": "Branche",
    "branch_different": "Branche unterschiedlich",
}

SCORE_WEIGHTS = {
    "phone": 100,
    "email": 100,
    "company": 45,
    "postal_code": 25,
    "address": 35,
    "city": 10,
    "branch": 10,
}

REPORT_META_COLUMNS = [
    "_lead_row",
    "_lead_company",
    "_match_score",
    "_match_reason",
    "_match_type",
    "_match_decision",
    "_match_rule",
    "_match_with_row",
    "_match_with_company",
    "_match_with_phone",
    "_match_with_email",
    "_match_with_plz",
    "_match_with_ort",
    "_match_with_adresse",
    "_match_with_branche",
    "_matched_fields",
    "_shared_email",
    "_shared_phone",
    "_lead_phone_norm",
    "_match_phone_norm",
    "_lead_email_norm",
    "_match_email_norm",
    "_lead_company_norm",
    "_match_company_norm",
    "_lead_plz_norm",
    "_match_plz_norm",
    "_lead_ort_norm",
    "_match_ort_norm",
    "_lead_adresse_norm",
    "_match_adresse_norm",
    "_lead_branche_norm",
    "_match_branche_norm",
    "_kept_row",
    "_kept_company",
]

ERROR_REPORT_COLUMNS = [
    "_lead_row",
    "_input_error_reason",
]


def text_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).replace("\ufeff", "").strip()


def is_missing_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return text_value(value).lower() in MISSING_MARKERS


def clean_output_value(value: Any) -> str:
    if is_missing_value(value):
        return ""
    return text_value(value)


def transliterate_de(value: Any) -> str:
    s = text_value(value).lower()
    return (
        s.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )


def normalize_header(value: Any) -> str:
    s = transliterate_de(value)
    s = re.sub(r"^[\W_]+|[\W_]+$", "", s)
    s = re.sub(r"[_./,;:|()[\]{}+-]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def compact_header(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", normalize_header(value))


ALIAS_LOOKUP = {
    field: [compact_header(alias) for alias in aliases]
    for field, aliases in FIELD_ALIASES.items()
}


def clean_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [text_value(col) for col in out.columns]
    return out


def build_column_mapping(columns: Iterable[Any]) -> dict[str, Optional[str]]:
    by_compact: dict[str, str] = {}
    for col in columns:
        cleaned = text_value(col)
        by_compact.setdefault(compact_header(cleaned), cleaned)

    mapping: dict[str, Optional[str]] = {}
    for field, aliases in ALIAS_LOOKUP.items():
        mapping[field] = None
        for alias in aliases:
            if alias in by_compact:
                mapping[field] = by_compact[alias]
                break
    return mapping


def cleanup_placeholder_16(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    out = df.copy()
    replacements = 0
    for col in out.columns:
        if compact_header(col) not in PLACEHOLDER_16_FIELDS:
            continue
        mask = out[col].map(lambda value: text_value(value) == "16")
        count = int(mask.sum())
        if count:
            out.loc[mask, col] = ""
            replacements += count
    return out, replacements


def count_known_missing_markers(df: pd.DataFrame) -> int:
    total = 0
    for col in df.columns:
        values = df[col].map(text_value)
        total += int(values.map(lambda value: bool(value) and is_missing_value(value)).sum())
    return total


def extract_phone_from_formula(value: Any) -> str:
    """Extrahiert eine Telefonnummer aus einer eindeutigen Excel-Formel.

    Nur Formeln der Form ``=+493012345678`` (optionales ``+``, sonst nur
    Ziffern/Leerzeichen) werden interpretiert. Beliebige Formeln wie
    ``=A1+B1``, ``=SUM(...)`` oder ``=VLOOKUP(...)`` liefern ``""``.
    """
    s = text_value(value)
    if not s.startswith("="):
        return ""
    body = s[1:].strip()
    if re.fullmatch(r"\+?\d[\d\s]*", body):
        return re.sub(r"\D", "", body)
    return ""


def normalize_phone(value: Any) -> str:
    if is_missing_value(value):
        return ""

    raw = text_value(value)
    if raw.startswith("="):
        digits = extract_phone_from_formula(raw)
    else:
        digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    if digits.startswith("0049"):
        digits = "49" + digits[4:]
    elif digits.startswith("00"):
        digits = digits[2:]

    if digits.startswith("490"):
        digits = "49" + digits[3:]
    elif digits.startswith("0"):
        digits = "49" + digits[1:]

    if not digits.startswith("49"):
        return ""
    if len(digits) < 10 or len(digits) > 15:
        return ""

    return digits


EMAIL_RE = re.compile(r"^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$")


def normalize_email(value: Any) -> str:
    if is_missing_value(value):
        return ""

    email = text_value(value).lower()
    if email.startswith("mailto:"):
        email = email[7:].strip()

    if email.count("@") != 1 or re.search(r"\s", email):
        return ""

    local, domain = email.rsplit("@", 1)
    if not local or not domain or "." not in domain:
        return ""
    if domain.startswith(".") or domain.endswith(".") or ".." in domain:
        return ""
    if not EMAIL_RE.match(email):
        return ""

    return email


LEGAL_FORM_PATTERNS = [
    r"(?<![a-z0-9])gmbh\s*(?:&|und|\+)\s*co\.?\s*kg(?![a-z0-9])",
    r"(?<![a-z0-9])gmbh\s*(?:&|und|\+)\s*co\.?(?![a-z0-9])",
    r"(?<![a-z0-9])ug\s*\(\s*haftungsbeschraenkt\s*\)(?![a-z0-9])",
    r"(?<![a-z0-9])gmbh(?![a-z0-9])",
    r"(?<![a-z0-9])ug(?![a-z0-9])",
    r"(?<![a-z0-9])ag(?![a-z0-9])",
    r"(?<![a-z0-9])kg(?![a-z0-9])",
    r"(?<![a-z0-9])ohg(?![a-z0-9])",
    r"(?<![a-z0-9])gbr(?![a-z0-9])",
    r"(?<![a-z0-9])e\s*\.?\s*k\.?(?![a-z0-9])",
]


def normalize_company(value: Any) -> str:
    if is_missing_value(value):
        return ""

    s = f" {transliterate_de(value)} "
    for pattern in LEGAL_FORM_PATTERNS:
        s = re.sub(pattern, " ", s)

    s = re.sub(r"[^a-z0-9]+", " ", s)
    compact = "".join(s.split())
    if len(compact) < 3:
        return ""
    return compact


def normalize_postal_code(value: Any) -> str:
    if is_missing_value(value):
        return ""

    s = text_value(value)
    s = re.sub(r"([.,])0+$", "", s)
    digits = re.sub(r"\D", "", s)
    if len(digits) == 4:
        return digits.zfill(5)
    if len(digits) == 5:
        return digits
    return ""


def normalize_city(value: Any) -> str:
    if is_missing_value(value):
        return ""

    s = transliterate_de(value)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def normalize_address(value: Any) -> str:
    if is_missing_value(value):
        return ""

    s = transliterate_de(value)
    s = re.sub(r"\b([a-z]+)\s*str\.", r"\1strasse", s)
    s = re.sub(r"\b([a-z]+)\s*str\b", r"\1strasse", s)
    s = re.sub(r"\bstr\.", "strasse", s)
    s = re.sub(r"\bstr\b", "strasse", s)
    s = s.replace("straße", "strasse")
    s = re.sub(r"\b\d{5}\b.*$", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


BRANCH_SYNONYMS = (
    (
        "umzug",
        (
            "umzug",
            "umzuege",
            "umzugsfirma",
            "umzugsfirmen",
            "umzugsunternehmen",
            "moebelspedition",
            "moebelspediteur",
            "moebeltransport",
            "moebeltransporte",
            "transportumzug",
        ),
    ),
    (
        "hausverwaltung",
        (
            "hausverwaltung",
            "hausverwaltungen",
            "immobilienverwaltung",
            "immobilienverwaltungen",
            "propertymanagement",
        ),
    ),
    (
        "handwerk",
        (
            "handwerk",
            "handwerker",
            "bauhandwerk",
        ),
    ),
    (
        "logistik",
        (
            "logistik",
            "spedition",
            "transport",
            "transporte",
        ),
    ),
)


def normalize_branch(value: Any) -> str:
    if is_missing_value(value):
        return ""

    normalized = normalize_city(value)
    if not normalized:
        return ""

    compact = re.sub(r"[^a-z0-9]", "", normalized)
    for category, synonyms in BRANCH_SYNONYMS:
        for synonym in synonyms:
            if synonym in compact:
                return category

    if len(compact) < 3:
        return ""
    return compact


def row_value(row: Mapping[str, Any], column: Optional[str]) -> str:
    if not column:
        return ""
    try:
        return text_value(row.get(column, ""))
    except AttributeError:
        return text_value(row[column]) if column in row else ""


def normalized_address_from_row(
    row: Mapping[str, Any],
    mapping: Mapping[str, Optional[str]],
) -> str:
    address = row_value(row, mapping.get("address"))
    if not is_missing_value(address):
        normalized = normalize_address(address)
        if normalized:
            return normalized

    street = row_value(row, mapping.get("street"))
    house_number = row_value(row, mapping.get("house_number"))
    combined = " ".join(part for part in (street, house_number) if not is_missing_value(part))
    return normalize_address(combined)


@dataclass(frozen=True)
class LeadRecord:
    row_id: Any
    position: int
    row_number: int
    company_raw: str
    phone_raw: str
    email_raw: str
    postal_code_raw: str
    city_raw: str
    address_raw: str
    branch_raw: str
    company: str
    phone: str
    email: str
    postal_code: str
    city: str
    address: str
    branch: str
    filled_fields: int
    errors: tuple[str, ...]


@dataclass(frozen=True)
class MatchResult:
    score: int
    decision: str
    reason: str
    rule: str
    matched_fields: tuple[str, ...]


@dataclass(frozen=True)
class SharedIdentifiers:
    shared_emails: frozenset[str]
    shared_phones: frozenset[str]


@dataclass
class DeduplicationResult:
    final_leads: pd.DataFrame
    removed_existing: pd.DataFrame
    internal_duplicates: pd.DataFrame
    possible_duplicates: pd.DataFrame
    error_rows: pd.DataFrame


def source_row_number(row_id: Any, position: int) -> int:
    if isinstance(row_id, int):
        return row_id + 2
    return position + 2


def meaningful_field_count(row: Mapping[str, Any]) -> int:
    if hasattr(row, "to_dict"):
        values = row.to_dict().values()
    else:
        row_values = getattr(row, "values")
        values = row_values() if callable(row_values) else row_values
    return sum(1 for value in values if not is_missing_value(value))


def compute_record_errors(
    company_raw: str,
    postal_code_raw: str,
    postal_code_norm: str,
) -> tuple[str, ...]:
    errors: list[str] = []
    if is_missing_value(company_raw):
        errors.append("Firmenname fehlt")
    if not is_missing_value(postal_code_raw) and not postal_code_norm:
        errors.append("Ungültige PLZ / mögliche Spaltenverschiebung")
    return tuple(errors)


def make_record(
    row_id: Any,
    position: int,
    row: Mapping[str, Any],
    mapping: Mapping[str, Optional[str]],
) -> LeadRecord:
    company_raw = row_value(row, mapping.get("company"))
    phone_raw = row_value(row, mapping.get("phone"))
    email_raw = row_value(row, mapping.get("email"))
    postal_code_raw = row_value(row, mapping.get("postal_code"))
    city_raw = row_value(row, mapping.get("city"))
    branch_raw = row_value(row, mapping.get("branch"))

    address_col = mapping.get("address")
    address_raw = row_value(row, address_col)
    if is_missing_value(address_raw):
        street = row_value(row, mapping.get("street"))
        house_number = row_value(row, mapping.get("house_number"))
        address_raw = " ".join(
            part for part in (street, house_number) if not is_missing_value(part)
        )

    company = normalize_company(company_raw)
    postal_code = normalize_postal_code(postal_code_raw)

    return LeadRecord(
        row_id=row_id,
        position=position,
        row_number=source_row_number(row_id, position),
        company_raw=company_raw,
        phone_raw=phone_raw,
        email_raw=email_raw,
        postal_code_raw=postal_code_raw,
        city_raw=city_raw,
        address_raw=address_raw,
        branch_raw=branch_raw,
        company=company,
        phone=normalize_phone(phone_raw),
        email=normalize_email(email_raw),
        postal_code=postal_code,
        city=normalize_city(city_raw),
        address=normalized_address_from_row(row, mapping),
        branch=normalize_branch(branch_raw),
        filled_fields=meaningful_field_count(row),
        errors=compute_record_errors(company_raw, postal_code_raw, postal_code),
    )


def build_records(
    df: pd.DataFrame,
    mapping: Mapping[str, Optional[str]],
) -> list[LeadRecord]:
    records: list[LeadRecord] = []
    for position, (row_id, row) in enumerate(df.iterrows()):
        records.append(make_record(row_id, position, row, mapping))
    return records


def build_shared_identifiers(records: Iterable[LeadRecord]) -> SharedIdentifiers:
    email_companies: dict[str, set[str]] = {}
    phone_companies: dict[str, set[str]] = {}
    for record in records:
        if record.email and record.company:
            email_companies.setdefault(record.email, set()).add(record.company)
        if record.phone and record.company:
            phone_companies.setdefault(record.phone, set()).add(record.company)

    shared_emails = {email for email, companies in email_companies.items() if len(companies) > 1}
    shared_phones = {phone for phone, companies in phone_companies.items() if len(companies) > 1}
    return SharedIdentifiers(frozenset(shared_emails), frozenset(shared_phones))


def format_reason(matched_fields: Iterable[str]) -> str:
    fields = tuple(matched_fields)
    if fields == ("phone",):
        return "Telefon exakt"
    if fields == ("email",):
        return "E-Mail exakt"
    if not fields:
        return "Keine relevanten Uebereinstimmungen"
    return " + ".join(FIELD_LABELS[field] for field in fields)


def score_match(
    left: LeadRecord,
    right: LeadRecord,
    shared: Optional[SharedIdentifiers] = None,
) -> MatchResult:
    matched: list[str] = []
    score = 0

    comparisons = (
        ("phone", left.phone, right.phone),
        ("email", left.email, right.email),
        ("company", left.company, right.company),
        ("postal_code", left.postal_code, right.postal_code),
        ("address", left.address, right.address),
        ("city", left.city, right.city),
    )

    for field, left_value, right_value in comparisons:
        if left_value and right_value and left_value == right_value:
            matched.append(field)
            score += SCORE_WEIGHTS[field]

    if left.branch and right.branch:
        if left.branch == right.branch:
            matched.append("branch")
            score += SCORE_WEIGHTS["branch"]
        else:
            matched.append("branch_different")
            score -= 15

    matched_tuple = tuple(matched)
    has = lambda field: field in matched_tuple
    shared = shared or SharedIdentifiers(frozenset(), frozenset())

    if has("phone"):
        phone_shared = left.phone in shared.shared_phones
        if not phone_shared:
            decision, rule, reason = "safe", "Telefon exakt", "Telefon exakt"
        elif has("company"):
            decision, rule, reason = "safe", "Telefon + Firmenname", "Telefon + Firmenname"
        elif has("address") and has("postal_code"):
            decision, rule, reason = "safe", "Telefon + Adresse + PLZ", "Telefon + Adresse + PLZ"
        elif has("email") and left.email not in shared.shared_emails:
            decision, rule, reason = "safe", "Telefon + E-Mail", "Telefon + E-Mail"
        else:
            decision, rule, reason = "possible", "Telefon ist Shared-Identifier", "Telefon ist Shared-Identifier"
    elif has("email"):
        if has("company"):
            decision, rule, reason = "safe", "E-Mail + Firmenname", "E-Mail + Firmenname"
        elif has("address") and has("postal_code"):
            decision, rule, reason = "safe", "E-Mail + Adresse + PLZ", "E-Mail + Adresse + PLZ"
        else:
            decision, rule, reason = "possible", "E-Mail exakt, aber keine Identitätsbestätigung", "E-Mail exakt, aber keine Identitätsbestätigung"
    elif has("company") and has("address") and has("postal_code"):
        decision, rule, reason = "safe", "Firma + Adresse + PLZ", "Firma + Adresse + PLZ"
    elif score >= 90:
        decision, rule = "possible", "Score >= 90 Review"
        reason = format_reason(matched_tuple)
    elif 60 <= score <= 89:
        decision, rule = "possible", "Score 60-89 Review"
        reason = format_reason(matched_tuple)
    else:
        decision, rule = "none", "Score < 60"
        reason = format_reason(matched_tuple)

    return MatchResult(
        score=score,
        decision=decision,
        reason=reason,
        rule=rule,
        matched_fields=matched_tuple,
    )


class MatchingIndex:
    def __init__(self, records: Iterable[LeadRecord] = ()) -> None:
        self.records: list[LeadRecord] = []
        self.by_phone: dict[str, list[int]] = {}
        self.by_email: dict[str, list[int]] = {}
        self.by_company: dict[str, list[int]] = {}
        for record in records:
            self.add(record)

    def add(self, record: LeadRecord) -> int:
        idx = len(self.records)
        self.records.append(record)
        if record.phone:
            self.by_phone.setdefault(record.phone, []).append(idx)
        if record.email:
            self.by_email.setdefault(record.email, []).append(idx)
        if record.company:
            self.by_company.setdefault(record.company, []).append(idx)
        return idx

    def candidate_indices(self, record: LeadRecord) -> list[int]:
        candidates: set[int] = set()
        if record.phone:
            candidates.update(self.by_phone.get(record.phone, ()))
        if record.email:
            candidates.update(self.by_email.get(record.email, ()))
        if record.company:
            candidates.update(self.by_company.get(record.company, ()))
        return sorted(candidates)


def normalized_field_values(record: LeadRecord) -> dict[str, str]:
    return {
        "phone": record.phone,
        "email": record.email,
        "company": record.company,
        "postal_code": record.postal_code,
        "city": record.city,
        "address": record.address,
        "branch": record.branch,
    }


def dataframe_from_rows(
    rows: list[dict[str, Any]],
    original_columns: Iterable[str],
) -> pd.DataFrame:
    columns = list(original_columns)
    for col in REPORT_META_COLUMNS:
        if col not in columns:
            columns.append(col)
    return pd.DataFrame(rows, columns=columns)


def error_dataframe_from_rows(
    rows: list[dict[str, Any]],
    original_columns: Iterable[str],
) -> pd.DataFrame:
    columns = list(original_columns)
    for col in ERROR_REPORT_COLUMNS:
        if col not in columns:
            columns.append(col)
    return pd.DataFrame(rows, columns=columns)


def safe_cell(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return value


def report_row(
    lead_row: Mapping[str, Any],
    original_columns: Iterable[str],
    lead_record: LeadRecord,
    match_record: LeadRecord,
    result: MatchResult,
    match_type: str,
    shared: Optional[SharedIdentifiers] = None,
    extra: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    shared = shared or SharedIdentifiers(frozenset(), frozenset())
    out = {col: safe_cell(lead_row.get(col, "")) for col in original_columns}
    out.update(
        {
            "_lead_row": lead_record.row_number,
            "_lead_company": lead_record.company_raw,
            "_match_score": result.score,
            "_match_reason": result.reason,
            "_match_type": match_type,
            "_match_decision": result.decision,
            "_match_rule": result.rule,
            "_match_with_row": match_record.row_number,
            "_match_with_company": match_record.company_raw,
            "_match_with_phone": match_record.phone_raw,
            "_match_with_email": match_record.email_raw,
            "_match_with_plz": match_record.postal_code_raw,
            "_match_with_ort": match_record.city_raw,
            "_match_with_adresse": match_record.address_raw,
            "_match_with_branche": match_record.branch_raw,
            "_matched_fields": ", ".join(result.matched_fields),
            "_shared_email": "1" if (lead_record.email and lead_record.email in shared.shared_emails) else "",
            "_shared_phone": "1" if (lead_record.phone and lead_record.phone in shared.shared_phones) else "",
            "_lead_phone_norm": lead_record.phone,
            "_match_phone_norm": match_record.phone,
            "_lead_email_norm": lead_record.email,
            "_match_email_norm": match_record.email,
            "_lead_company_norm": lead_record.company,
            "_match_company_norm": match_record.company,
            "_lead_plz_norm": lead_record.postal_code,
            "_match_plz_norm": match_record.postal_code,
            "_lead_ort_norm": lead_record.city,
            "_match_ort_norm": match_record.city,
            "_lead_adresse_norm": lead_record.address,
            "_match_adresse_norm": match_record.address,
            "_lead_branche_norm": lead_record.branch,
            "_match_branche_norm": match_record.branch,
            "_kept_row": "",
            "_kept_company": "",
        }
    )
    if extra:
        out.update(extra)
    return out


def error_report_row(
    lead_row: Mapping[str, Any],
    original_columns: Iterable[str],
    lead_record: LeadRecord,
) -> dict[str, Any]:
    out = {col: safe_cell(lead_row.get(col, "")) for col in original_columns}
    out["_lead_row"] = lead_record.row_number
    out["_input_error_reason"] = "; ".join(lead_record.errors)
    return out


def best_match(matches: list[tuple[LeadRecord, MatchResult]]) -> tuple[LeadRecord, MatchResult]:
    return sorted(
        matches,
        key=lambda item: (
            item[1].score,
            len(item[1].matched_fields),
            -item[0].row_number,
        ),
        reverse=True,
    )[0]


def deduplicate_against_existing(
    existing_df: pd.DataFrame,
    leads_df: pd.DataFrame,
    existing_mapping: Mapping[str, Optional[str]],
    leads_mapping: Mapping[str, Optional[str]],
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    existing_records = build_records(existing_df, existing_mapping)
    lead_records = build_records(leads_df, leads_mapping)
    shared = build_shared_identifiers(existing_records + lead_records)
    existing_index = MatchingIndex(existing_records)

    removed_rows: list[dict[str, Any]] = []
    possible_rows: list[dict[str, Any]] = []
    error_rows: list[dict[str, Any]] = []
    keep_ids: list[Any] = []

    original_columns = list(leads_df.columns)

    for record in lead_records:
        lead_row = leads_df.loc[record.row_id]

        if record.errors:
            keep_ids.append(record.row_id)
            error_rows.append(error_report_row(lead_row, original_columns, record))
            continue

        safe_matches: list[tuple[LeadRecord, MatchResult]] = []
        possible_matches: list[tuple[LeadRecord, MatchResult]] = []

        for candidate_idx in existing_index.candidate_indices(record):
            candidate = existing_index.records[candidate_idx]
            if candidate.errors:
                continue
            result = score_match(record, candidate, shared)
            if result.decision == "safe":
                safe_matches.append((candidate, result))
            elif result.decision == "possible":
                possible_matches.append((candidate, result))

        if safe_matches:
            match_record, result = best_match(safe_matches)
            removed_rows.append(
                report_row(
                    lead_row,
                    original_columns,
                    record,
                    match_record,
                    result,
                    "BESTANDSKUNDE",
                    shared,
                )
            )
        else:
            keep_ids.append(record.row_id)
            for match_record, result in possible_matches:
                possible_rows.append(
                    report_row(
                        lead_row,
                        original_columns,
                        record,
                        match_record,
                        result,
                        "BESTANDSKUNDE",
                        shared,
                    )
                )

    remaining_df = leads_df.loc[keep_ids].copy()
    removed_df = dataframe_from_rows(removed_rows, original_columns)
    possible_df = dataframe_from_rows(possible_rows, original_columns)
    error_df = error_dataframe_from_rows(error_rows, original_columns)
    return remaining_df, removed_df, possible_df, error_df


class UnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))

    def find(self, item: int) -> int:
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


def canonical_record(records: list[LeadRecord], cluster: list[int]) -> int:
    return sorted(
        cluster,
        key=lambda idx: (-records[idx].filled_fields, records[idx].position),
    )[0]


def deduplicate_internal(
    leads_df: pd.DataFrame,
    leads_mapping: Mapping[str, Optional[str]],
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    records = build_records(leads_df, leads_mapping)
    original_columns = list(leads_df.columns)
    if not records:
        empty = dataframe_from_rows([], original_columns)
        return leads_df.copy(), empty, empty

    shared = build_shared_identifiers(records)
    index = MatchingIndex()
    uf = UnionFind(len(records))
    safe_edges: dict[tuple[int, int], MatchResult] = {}
    possible_rows: list[dict[str, Any]] = []

    for idx, record in enumerate(records):
        if record.errors:
            continue
        for candidate_idx in index.candidate_indices(record):
            candidate = records[candidate_idx]
            if candidate.errors:
                continue
            result = score_match(record, candidate, shared)
            if result.decision == "safe":
                uf.union(idx, candidate_idx)
                safe_edges[tuple(sorted((idx, candidate_idx)))] = result
            elif result.decision == "possible":
                possible_rows.append(
                    report_row(
                        leads_df.loc[record.row_id],
                        original_columns,
                        record,
                        candidate,
                        result,
                        "LEAD_INTERN",
                        shared,
                    )
                )
        index.add(record)

    clusters_by_root: dict[int, list[int]] = {}
    for idx in range(len(records)):
        clusters_by_root.setdefault(uf.find(idx), []).append(idx)

    keep_record_indices: set[int] = set()
    duplicate_rows: list[dict[str, Any]] = []

    for cluster in clusters_by_root.values():
        if len(cluster) == 1:
            keep_record_indices.add(cluster[0])
            continue

        keep_idx = canonical_record(records, cluster)
        keep_record_indices.add(keep_idx)
        keep = records[keep_idx]

        for duplicate_idx in sorted(idx for idx in cluster if idx != keep_idx):
            duplicate = records[duplicate_idx]
            direct_result = safe_edges.get(tuple(sorted((duplicate_idx, keep_idx))))
            witness = keep

            if direct_result is None:
                candidates: list[tuple[int, MatchResult]] = []
                for other_idx in cluster:
                    if other_idx == duplicate_idx:
                        continue
                    edge_result = safe_edges.get(tuple(sorted((duplicate_idx, other_idx))))
                    if edge_result is not None:
                        candidates.append((other_idx, edge_result))
                if candidates:
                    witness_idx, direct_result = sorted(
                        candidates,
                        key=lambda item: (
                            item[1].score,
                            len(item[1].matched_fields),
                            -records[item[0]].row_number,
                        ),
                        reverse=True,
                    )[0]
                    witness = records[witness_idx]
                else:
                    direct_result = score_match(duplicate, keep, shared)

            duplicate_rows.append(
                report_row(
                    leads_df.loc[duplicate.row_id],
                    original_columns,
                    duplicate,
                    witness,
                    direct_result,
                    "LEAD_INTERN",
                    shared,
                    extra={
                        "_kept_row": keep.row_number,
                        "_kept_company": keep.company_raw,
                    },
                )
            )

    keep_ids = [
        records[idx].row_id
        for idx in sorted(keep_record_indices, key=lambda item: records[item].position)
    ]
    final_df = leads_df.loc[keep_ids].copy()
    internal_df = dataframe_from_rows(duplicate_rows, original_columns)
    possible_df = dataframe_from_rows(possible_rows, original_columns)
    return final_df, internal_df, possible_df


def deduplicate_leads(
    existing_df: pd.DataFrame,
    leads_df: pd.DataFrame,
    existing_mapping: Mapping[str, Optional[str]],
    leads_mapping: Mapping[str, Optional[str]],
) -> DeduplicationResult:
    remaining_df, removed_existing, possible_existing, error_existing = deduplicate_against_existing(
        existing_df,
        leads_df,
        existing_mapping,
        leads_mapping,
    )
    final_leads, internal_duplicates, possible_internal = deduplicate_internal(
        remaining_df,
        leads_mapping,
    )
    possible_duplicates = pd.concat(
        [possible_existing, possible_internal],
        ignore_index=True,
    )
    return DeduplicationResult(
        final_leads=final_leads,
        removed_existing=removed_existing,
        internal_duplicates=internal_duplicates,
        possible_duplicates=possible_duplicates,
        error_rows=error_existing,
    )


def remove_rows_by_lead_row(
    final_leads: pd.DataFrame,
    report_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Entfernt Zeilen aus ``final_leads``, deren ``_lead_row`` in ``report_df`` vorkommt.

    Gibt ``(verbleibende, entfernte)`` zurück. Die Zuordnung erfolgt über die
    Zeilennummer ``_lead_row`` (== Index + 2 bei Standard-RangeIndex).
    """
    if report_df is None or report_df.empty or "_lead_row" not in report_df.columns:
        return final_leads, pd.DataFrame(columns=final_leads.columns)

    lead_rows = {int(row) for row in report_df["_lead_row"]}
    removed_mask = final_leads.index.map(lambda idx: (idx + 2) in lead_rows)
    removed = final_leads[removed_mask].copy()
    kept = final_leads[~removed_mask].copy()
    return kept, removed


def valid_normalized_count(
    df: pd.DataFrame,
    mapping: Mapping[str, Optional[str]],
    field: str,
    normalizer,
) -> tuple[int, int]:
    column = mapping.get(field)
    if not column:
        return 0, 0
    values = [normalizer(value) for value in df[column]]
    valid = [value for value in values if value]
    return len(valid), len(set(valid))


def unusable_field_count(
    df: pd.DataFrame,
    mapping: Mapping[str, Optional[str]],
    field: str,
    normalizer,
) -> int:
    column = mapping.get(field)
    if not column:
        return 0
    return int(sum(1 for value in df[column] if not normalizer(value)))


def error_marker_count(
    df: pd.DataFrame,
    mapping: Mapping[str, Optional[str]],
    field: str,
) -> int:
    column = mapping.get(field)
    if not column:
        return 0
    return int(
        sum(
            1
            for value in df[column]
            if text_value(value).lower() in {"#error!", "#error"}
        )
    )


def invalid_plz_count(
    df: pd.DataFrame,
    mapping: Mapping[str, Optional[str]],
) -> int:
    column = mapping.get("postal_code")
    if not column:
        return 0
    return int(
        sum(
            1
            for value in df[column]
            if not is_missing_value(value) and not normalize_postal_code(value)
        )
    )


def structural_suspect_count(
    df: pd.DataFrame,
    mapping: Mapping[str, Optional[str]],
) -> int:
    company_col = mapping.get("company")
    plz_col = mapping.get("postal_code")
    count = 0
    for _, row in df.iterrows():
        company_raw = row_value(row, company_col)
        plz_raw = row_value(row, plz_col)
        if not normalize_company(company_raw):
            count += 1
            continue
        if not is_missing_value(plz_raw) and not normalize_postal_code(plz_raw):
            count += 1
    return count


def dataset_quality_stats(
    df: pd.DataFrame,
    mapping: Mapping[str, Optional[str]],
    placeholder_16_cleaned: int = 0,
) -> dict[str, int]:
    usable_phones, distinct_phones = valid_normalized_count(
        df,
        mapping,
        "phone",
        normalize_phone,
    )
    usable_emails, distinct_emails = valid_normalized_count(
        df,
        mapping,
        "email",
        normalize_email,
    )
    usable_plz, _ = valid_normalized_count(
        df,
        mapping,
        "postal_code",
        normalize_postal_code,
    )
    return {
        "rows": len(df),
        "usable_phones": usable_phones,
        "distinct_phones": distinct_phones,
        "unusable_phones": unusable_field_count(df, mapping, "phone", normalize_phone),
        "error_phones": error_marker_count(df, mapping, "phone"),
        "usable_emails": usable_emails,
        "distinct_emails": distinct_emails,
        "unusable_emails": unusable_field_count(df, mapping, "email", normalize_email),
        "usable_plz": usable_plz,
        "invalid_plz": invalid_plz_count(df, mapping),
        "structural_suspects": structural_suspect_count(df, mapping),
        "known_missing_markers": count_known_missing_markers(df),
        "placeholder_16_cleaned": placeholder_16_cleaned,
    }
