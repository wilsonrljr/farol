import csv
import json
from io import StringIO

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def _parse_section(csv_export_text: str, marker: str) -> list[dict[str, str]]:
    lines = csv_export_text.splitlines()

    try:
        start = lines.index(marker) + 1
    except ValueError as exc:  # pragma: no cover
        raise AssertionError(f"Missing section marker: {marker}") from exc

    end = len(lines)
    for i in range(start, len(lines)):
        if lines[i].startswith("# ---"):
            end = i
            break

    summary_lines = [
        line for line in lines[start:end] if line.strip() and not line.startswith("#")
    ]
    reader = csv.DictReader(StringIO("\n".join(summary_lines)))
    return list(reader)


def _parse_summary_section(csv_export_text: str) -> list[dict[str, str]]:
    return _parse_section(csv_export_text, "# --- summary ---")


def test_export_compare_scenarios_parity_with_total_savings_initial_investment():
    # Use total_savings so initial_investment is derived and must be respected by exports.
    payload = {
        "property_value": 300_000.0,
        "down_payment": 60_000.0,
        "total_savings": 100_000.0,
        "loan_term_years": 1,
        "annual_interest_rate": 9.6,
        "loan_type": "PRICE",
        "rent_value": 1_000.0,
        "investment_returns": [{"start_month": 1, "annual_rate": 0.0}],
        "additional_costs": {
            "itbi_percentage": 0.0,
            "deed_percentage": 0.0,
            "monthly_hoa": 0.0,
            "monthly_property_tax": 0.0,
        },
        "inflation_rate": 0.0,
        "rent_inflation_rate": 0.0,
    }

    r_api = client.post("/api/compare-scenarios", json=payload)
    assert r_api.status_code == 200, r_api.text
    api = r_api.json()

    rent_api = next(sc for sc in api["scenarios"] if sc["name"] == "Alugar e investir")
    assert rent_api.get("total_outflows") is not None
    assert rent_api.get("net_cost") is not None

    # With the current semantics, month 1 includes total_savings as invested capital outflow.
    # total_outflows = total_savings + rent_value * term_months
    expected_outflows = 100_000.0 + 1_000.0 * 12
    assert abs(float(rent_api["total_outflows"]) - expected_outflows) < 1e-6

    r_export = client.post(
        "/api/compare-scenarios/export?format=csv&shape=long", json=payload
    )
    assert r_export.status_code == 200, r_export.text

    rows = _parse_summary_section(r_export.text)
    rent_row = next(row for row in rows if row["scenario"] == "Alugar e investir")

    export_outflows = float(rent_row["total_outflows"])
    export_net_cost = float(rent_row["net_cost"])

    assert abs(export_outflows - float(rent_api["total_outflows"])) < 1e-6
    assert abs(export_net_cost - float(rent_api["net_cost"])) < 1e-6


@pytest.mark.parametrize(
    ("api_path", "export_path", "section_marker"),
    [
        (
            "/api/compare-scenarios",
            "/api/compare-scenarios/export?format=csv&shape=long",
            "# --- summary ---",
        ),
        (
            "/api/compare-scenarios-enhanced",
            "/api/compare-scenarios-enhanced/export?format=csv&shape=long",
            "# --- metrics ---",
        ),
    ],
)
def test_exports_preserve_version_balance_sheet_and_scenario_warnings(
    api_path: str,
    export_path: str,
    section_marker: str,
) -> None:
    payload = {
        "property_value": 500_000.0,
        "down_payment": 100_000.0,
        "total_savings": 115_000.0,
        "loan_term_years": 30,
        "annual_interest_rate": 10.0,
        "loan_type": "PRICE",
        "rent_value": 2_000.0,
        "investment_returns": [{"start_month": 1, "annual_rate": 8.0}],
        "additional_costs": {
            "itbi_percentage": 2.0,
            "deed_percentage": 1.0,
            "monthly_hoa": 0.0,
            "monthly_property_tax": 0.0,
        },
        "inflation_rate": 0.0,
        "rent_inflation_rate": 0.0,
        "property_appreciation_rate": 0.0,
        "monthly_net_income": 3_000.0,
    }

    api_response = client.post(api_path, json=payload)
    export_response = client.post(export_path, json=payload)

    assert api_response.status_code == 200, api_response.text
    assert export_response.status_code == 200, export_response.text
    api_result = api_response.json()
    api_buy = next(
        scenario
        for scenario in api_result["scenarios"]
        if scenario["scenario_type"] == "buy"
    )
    assert api_buy["is_feasible"] is False
    assert api_buy["comparison_warnings"]

    rows = _parse_section(export_response.text, section_marker)
    export_buy = next(row for row in rows if row["scenario_type"] == "buy")

    assert export_buy["calculation_version"] == api_result["calculation_version"]
    assert json.loads(export_buy["warnings"]) == api_result["warnings"]
    assert (
        json.loads(export_buy["comparison_warnings"]) == api_buy["comparison_warnings"]
    )
    for field in ("final_assets", "final_liabilities", "residual_cash_balance"):
        assert float(export_buy[field]) == pytest.approx(api_buy[field])
