import csv
from io import StringIO

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def _parse_summary_section(csv_export_text: str) -> list[dict[str, str]]:
    lines = csv_export_text.splitlines()

    try:
        start = lines.index("# --- summary ---") + 1
    except ValueError as exc:  # pragma: no cover
        raise AssertionError("Missing summary section marker") from exc

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
        "inflation_rate": 0.0,
        "rent_inflation_rate": 0.0,
        "rent_reduces_investment": False,
        "monthly_external_savings": 0.0,
        "invest_external_surplus": False,
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
