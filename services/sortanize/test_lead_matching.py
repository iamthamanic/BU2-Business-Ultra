from __future__ import annotations

import unittest

import pandas as pd

from lead_matching import (
    SharedIdentifiers,
    build_column_mapping,
    build_records,
    build_shared_identifiers,
    deduplicate_internal,
    deduplicate_leads,
    extract_phone_from_formula,
    normalize_branch,
    normalize_company,
    normalize_email,
    normalize_phone,
    score_match,
)


def record(data: dict[str, str]):
    df = pd.DataFrame([data])
    mapping = build_column_mapping(df.columns)
    return build_records(df, mapping)[0]


def shared_for(*records) -> SharedIdentifiers:
    return build_shared_identifiers(list(records))


class LeadMatchingTests(unittest.TestCase):
    # ── Telefon-Normalisierung ──────────────────────────────────────
    def test_phone_german_formats_normalize_identically(self) -> None:
        expected = "493012345678"
        self.assertEqual(normalize_phone("030 12345678"), expected)
        self.assertEqual(normalize_phone("+49 30 12345678"), expected)
        self.assertEqual(normalize_phone("0049 30 12345678"), expected)

    def test_phone_leading_apostrophe_is_ignored(self) -> None:
        self.assertEqual(normalize_phone("'+49 30 12345678"), "493012345678")

    def test_error_phone_values_are_invalid(self) -> None:
        self.assertEqual(normalize_phone("#ERROR!"), "")
        self.assertEqual(normalize_phone("n.a."), "")
        self.assertEqual(normalize_phone(""), "")
        self.assertEqual(normalize_phone("16"), "")
        self.assertEqual(normalize_phone("0"), "")
        self.assertEqual(normalize_phone("123"), "")

    # ── E-Mail-Normalisierung ───────────────────────────────────────
    def test_email_normalizes_case(self) -> None:
        self.assertEqual(normalize_email("INFO@Firma.de"), "info@firma.de")
        self.assertEqual(normalize_email("info@firma.de"), "info@firma.de")

    def test_error_email_values_do_not_match(self) -> None:
        self.assertEqual(normalize_email("n.a."), "")
        left = record({"Firmenname": "A GmbH", "E-Mail": "n.a."})
        right = record({"Firmenname": "B GmbH", "E-Mail": "n.a."})
        result = score_match(left, right)
        self.assertNotIn("email", result.matched_fields)
        self.assertEqual(result.score, 0)

    # ── Firmenname-Normalisierung ───────────────────────────────────
    def test_company_umlauts_and_legal_form(self) -> None:
        self.assertEqual(
            normalize_company("Müller Umzüge GmbH"),
            normalize_company("Mueller Umzuege"),
        )

    def test_ek_legal_form(self) -> None:
        self.assertEqual(
            normalize_company("Mustermann e.K."),
            normalize_company("Mustermann"),
        )

    # ── E-Mail-Safe-Regeln (NEU) ────────────────────────────────────
    def test_email_alone_is_not_safe(self) -> None:
        left = record({"Firmenname": "Alpha GmbH", "E-Mail": "INFO@Firma.de"})
        right = record({"Firmenname": "Beta GmbH", "E-Mail": "info@firma.de"})
        result = score_match(left, right)
        self.assertEqual(result.score, 100)
        self.assertEqual(result.decision, "possible")

    def test_email_plus_same_company_is_safe(self) -> None:
        left = record({"Firmenname": "Müller GmbH", "E-Mail": "info@mueller.de"})
        right = record({"Firmenname": "Müller GmbH", "E-Mail": "info@mueller.de"})
        result = score_match(left, right)
        self.assertEqual(result.decision, "safe")

    def test_email_plus_address_plz_is_safe(self) -> None:
        left = record(
            {
                "Firmenname": "Alpha GmbH",
                "E-Mail": "info@firma.de",
                "Adresse": "Musterstr. 1",
                "Plz": "10115",
            }
        )
        right = record(
            {
                "Firmenname": "Beta GmbH",
                "E-Mail": "info@firma.de",
                "Adresse": "Musterstraße 1",
                "Plz": "10115",
            }
        )
        result = score_match(left, right)
        self.assertEqual(result.decision, "safe")

    def test_email_plus_same_phone_is_safe(self) -> None:
        left = record(
            {
                "Firmenname": "Alpha GmbH",
                "E-Mail": "info@firma.de",
                "Telefon": "030 12345678",
            }
        )
        right = record(
            {
                "Firmenname": "Beta GmbH",
                "E-Mail": "info@firma.de",
                "Telefon": "+49 30 12345678",
            }
        )
        result = score_match(left, right)
        self.assertEqual(result.decision, "safe")

    def test_portal_email_different_companies_not_safe(self) -> None:
        left = record(
            {"Firmenname": "Apfelbaum GmbH", "E-Mail": "info@elektrikerportal.com"}
        )
        right = record(
            {"Firmenname": "Klümper Fensterbau GmbH", "E-Mail": "info@elektrikerportal.com"}
        )
        result = score_match(left, right)
        self.assertEqual(result.decision, "possible")

    def test_gmail_different_companies_not_safe(self) -> None:
        left = record(
            {"Firmenname": "Köpenicker GmbH", "E-Mail": "dimitri.serovatski@gmail.com"}
        )
        right = record(
            {"Firmenname": "ADM Messebau GmbH", "E-Mail": "dimitri.serovatski@gmail.com"}
        )
        result = score_match(left, right)
        self.assertEqual(result.decision, "possible")

    # ── Telefon-Safe-Regeln ─────────────────────────────────────────
    def test_phone_alone_is_safe(self) -> None:
        left = record({"Firmenname": "Alpha GmbH", "Telefon": "030 12345678"})
        right = record({"Firmenname": "Beta GmbH", "Telefon": "+49 30 12345678"})
        result = score_match(left, right)
        self.assertEqual(result.score, 100)
        self.assertEqual(result.decision, "safe")

    def test_phone_same_different_branch_is_still_safe(self) -> None:
        left = record(
            {
                "Firmenname": "Alpha GmbH",
                "Telefon": "030 12345678",
                "Branche": "Umzugsunternehmen",
            }
        )
        right = record(
            {
                "Firmenname": "Beta GmbH",
                "Telefon": "+49 30 12345678",
                "Branche": "Hausverwaltung",
            }
        )
        result = score_match(left, right)
        self.assertEqual(result.decision, "safe")

    # ── Shared-Identifier-Erkennung ─────────────────────────────────
    def test_shared_phone_different_companies_not_alone_safe(self) -> None:
        left = record({"Firmenname": "Alpha GmbH", "Telefon": "030 12345678"})
        right = record({"Firmenname": "Beta GmbH", "Telefon": "030 12345678"})
        shared = shared_for(left, right)
        result = score_match(left, right, shared)
        self.assertEqual(result.decision, "possible")
        self.assertEqual(result.rule, "Telefon ist Shared-Identifier")

    def test_shared_phone_plus_same_company_is_safe(self) -> None:
        left = record(
            {"Firmenname": "Müller GmbH", "Telefon": "030 12345678"}
        )
        right = record(
            {"Firmenname": "Müller GmbH", "Telefon": "030 12345678"}
        )
        shared = shared_for(left, right)
        result = score_match(left, right, shared)
        self.assertEqual(result.decision, "safe")

    def test_shared_email_detection(self) -> None:
        a = record({"Firmenname": "Apfelbaum GmbH", "E-Mail": "info@elektrikerportal.com"})
        b = record({"Firmenname": "Klümper GmbH", "E-Mail": "info@elektrikerportal.com"})
        shared = shared_for(a, b)
        self.assertIn("info@elektrikerportal.com", shared.shared_emails)

    def test_unique_email_not_shared(self) -> None:
        a = record({"Firmenname": "Müller GmbH", "E-Mail": "info@mueller.de"})
        b = record({"Firmenname": "Müller GmbH", "E-Mail": "info@mueller.de"})
        shared = shared_for(a, b)
        self.assertNotIn("info@mueller.de", shared.shared_emails)

    # ── Firma + Adresse + PLZ ───────────────────────────────────────
    def test_company_address_plz_is_safe(self) -> None:
        left = record(
            {
                "Firmenname": "Müller Umzüge GmbH",
                "Adresse": "Musterstr. 1",
                "Plz": "10115",
            }
        )
        right = record(
            {
                "Firmenname": "Mueller Umzuege",
                "Adresse": "Musterstraße 1",
                "Plz": "10115",
            }
        )
        result = score_match(left, right)
        self.assertEqual(result.decision, "safe")

    def test_company_address_plz_different_branch_is_still_safe(self) -> None:
        left = record(
            {
                "Firmenname": "Müller Umzüge GmbH",
                "Adresse": "Musterstr. 1",
                "Plz": "10115",
                "Branche": "Umzugsunternehmen",
            }
        )
        right = record(
            {
                "Firmenname": "Mueller Umzuege",
                "Adresse": "Musterstraße 1",
                "Plz": "10115",
                "Branche": "Hausverwaltung",
            }
        )
        result = score_match(left, right)
        self.assertEqual(result.decision, "safe")

    # ── Firmenname allein / Review ──────────────────────────────────
    def test_same_name_different_city_is_not_safe_duplicate(self) -> None:
        left = record({"Firmenname": "Müller GmbH", "Plz": "10115", "Stadt": "Berlin"})
        right = record({"Firmenname": "Müller GmbH", "Plz": "50667", "Stadt": "Köln"})
        result = score_match(left, right)
        self.assertEqual(result.score, 45)
        self.assertEqual(result.decision, "none")

    def test_company_plz_city_is_possible_not_safe(self) -> None:
        left = record({"Firmenname": "Müller GmbH", "Plz": "10115", "Stadt": "Berlin"})
        right = record({"Firmenname": "Müller", "Plz": "10115", "Stadt": "Berlin"})
        result = score_match(left, right)
        self.assertEqual(result.score, 80)
        self.assertEqual(result.decision, "possible")

    def test_company_plz_city_same_branch_is_90_review_not_removed(self) -> None:
        existing_df = pd.DataFrame(
            [
                {
                    "Firmenname": "Müller GmbH",
                    "Plz": "10115",
                    "Stadt": "Berlin",
                    "Branche": "Umzugsunternehmen",
                }
            ]
        )
        leads_df = pd.DataFrame(
            [
                {
                    "Firmenname": "Müller",
                    "Plz": "10115",
                    "Stadt": "Berlin",
                    "Branche": "Möbelspedition",
                }
            ]
        )
        existing_mapping = build_column_mapping(existing_df.columns)
        leads_mapping = build_column_mapping(leads_df.columns)
        left = build_records(leads_df, leads_mapping)[0]
        right = build_records(existing_df, existing_mapping)[0]
        score = score_match(left, right)
        result = deduplicate_leads(existing_df, leads_df, existing_mapping, leads_mapping)

        self.assertEqual(normalize_branch("Umzugsfirma"), "umzug")
        self.assertEqual(normalize_branch("Möbelspedition"), "umzug")
        self.assertEqual(score.score, 90)
        self.assertEqual(score.decision, "possible")
        self.assertEqual(len(result.final_leads), 1)
        self.assertEqual(len(result.removed_existing), 0)
        self.assertEqual(len(result.possible_duplicates), 1)

    def test_company_plz_city_different_branch_is_reduced_review(self) -> None:
        left = record(
            {
                "Firmenname": "Müller GmbH",
                "Plz": "10115",
                "Stadt": "Berlin",
                "Branche": "Umzugsunternehmen",
            }
        )
        right = record(
            {
                "Firmenname": "Müller",
                "Plz": "10115",
                "Stadt": "Berlin",
                "Branche": "Hausverwaltung",
            }
        )
        result = score_match(left, right)
        self.assertEqual(result.score, 65)
        self.assertEqual(result.decision, "possible")
        self.assertIn("branch_different", result.matched_fields)

    def test_high_score_without_safe_rule_is_review(self) -> None:
        # E-Mail + PLZ + Ort + Branche, aber keine Identitätsbestätigung
        left = record(
            {
                "Firmenname": "Alpha GmbH",
                "E-Mail": "info@firma.de",
                "Plz": "10115",
                "Stadt": "Berlin",
                "Branche": "Umzugsunternehmen",
            }
        )
        right = record(
            {
                "Firmenname": "Beta GmbH",
                "E-Mail": "info@firma.de",
                "Plz": "10115",
                "Stadt": "Berlin",
                "Branche": "Möbelspedition",
            }
        )
        result = score_match(left, right)
        self.assertGreaterEqual(result.score, 90)
        self.assertEqual(result.decision, "possible")

    # ── Interne Deduplizierung ──────────────────────────────────────
    def test_internal_lead_duplicate_by_email_plus_company(self) -> None:
        df = pd.DataFrame(
            [
                {
                    "Firmenname": "Müller Umzüge GmbH",
                    "Plz": "10115",
                    "Stadt": "Berlin",
                    "E-Mail": "info@mueller.de",
                    "Telefon": "",
                },
                {
                    "Firmenname": "Müller Umzüge",
                    "Plz": "10115",
                    "Stadt": "Berlin",
                    "E-Mail": "INFO@MUELLER.DE",
                    "Telefon": "030 12345678",
                },
            ]
        )
        mapping = build_column_mapping(df.columns)
        final_df, duplicate_df, possible_df = deduplicate_internal(df, mapping)

        self.assertEqual(len(final_df), 1)
        self.assertEqual(len(duplicate_df), 1)
        self.assertEqual(len(possible_df), 0)
        self.assertEqual(duplicate_df.iloc[0]["_match_type"], "LEAD_INTERN")
        self.assertEqual(final_df.iloc[0]["Telefon"], "030 12345678")

    def test_shared_email_internal_does_not_merge(self) -> None:
        df = pd.DataFrame(
            [
                {"Firmenname": "Apfelbaum GmbH", "E-Mail": "info@elektrikerportal.com"},
                {"Firmenname": "Klümper Fensterbau GmbH", "E-Mail": "info@elektrikerportal.com"},
                {"Firmenname": "Andres GmbH", "E-Mail": "info@elektrikerportal.com"},
            ]
        )
        mapping = build_column_mapping(df.columns)
        final_df, duplicate_df, possible_df = deduplicate_internal(df, mapping)
        self.assertEqual(len(final_df), 3)
        self.assertEqual(len(duplicate_df), 0)

    # ── XLSX-Formel-Extraktion ──────────────────────────────────────
    def test_xlsx_phone_formula_extractable(self) -> None:
        self.assertEqual(extract_phone_from_formula("=+493012345678"), "493012345678")

    def test_arbitrary_formula_not_phone(self) -> None:
        self.assertEqual(extract_phone_from_formula("=A1+B1"), "")
        self.assertEqual(extract_phone_from_formula("=SUM(A1:A3)"), "")
        self.assertEqual(extract_phone_from_formula("=VLOOKUP(A1,B:C,2)"), "")

    # ── Strukturfehler ──────────────────────────────────────────────
    def test_error_phone_does_not_destroy_valid_row(self) -> None:
        rec = record(
            {
                "Firmenname": "Müller GmbH",
                "Plz": "10115",
                "Stadt": "Berlin",
                "Telefon": "#ERROR!",
            }
        )
        self.assertEqual(rec.phone, "")
        self.assertEqual(rec.errors, ())

    def test_missing_company_is_flagged(self) -> None:
        rec = record({"Plz": "10115", "Stadt": "Berlin"})
        self.assertIn("Firmenname fehlt", rec.errors)

    def test_invalid_plz_is_flagged(self) -> None:
        rec = record({"Firmenname": "Müller GmbH", "Plz": "Hausverwaltungen"})
        self.assertIn("Ungültige PLZ / mögliche Spaltenverschiebung", rec.errors)

    def test_faulty_row_not_auto_deduped(self) -> None:
        existing_df = pd.DataFrame(
            [{"Firmenname": "Müller GmbH", "Plz": "10115", "Stadt": "Berlin"}]
        )
        leads_df = pd.DataFrame(
            [{"Firmenname": "Müller GmbH", "Plz": "Hausverwaltungen", "Stadt": "Berlin"}]
        )
        existing_mapping = build_column_mapping(existing_df.columns)
        leads_mapping = build_column_mapping(leads_df.columns)
        result = deduplicate_leads(existing_df, leads_df, existing_mapping, leads_mapping)
        self.assertEqual(len(result.final_leads), 1)
        self.assertEqual(len(result.removed_existing), 0)
        self.assertEqual(len(result.error_rows), 1)


if __name__ == "__main__":
    unittest.main()
