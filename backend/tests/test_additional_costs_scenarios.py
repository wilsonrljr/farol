"""Condensed version of prior demonstration `test_functionality_demo.py`.
Validates deltas in total cost across scenarios with different additional cost inputs.
"""

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

BASE = {
    "property_value": 500_000,
    "down_payment": 100_000,
    "loan_term_years": 30,
    "annual_interest_rate": 10.0,
    "loan_type": "PRICE",
    "rent_value": 2000,
    "investment_returns": [{"start_month": 1, "end_month": None, "annual_rate": 8.0}],
}


def _buy(data):
    for s in data["scenarios"]:
        if "comprar" in s["name"].lower():
            return s
    raise AssertionError("Buy scenario not found")


def _rent(data):
    for s in data["scenarios"]:
        if "alugar" in s["name"].lower():
            return s
    raise AssertionError("Rent scenario not found")


def _invest_then_buy(data):
    for s in data["scenarios"]:
        if "comprar" in s["name"].lower() and "vista" in s["name"].lower():
            return s
    raise AssertionError("Invest-then-buy scenario not found")


def test_additional_costs_increase_total_cost():
    # Baseline (small but non-zero defaults)
    p0 = dict(
        BASE,
        additional_costs={
            "itbi_percentage": 0.0,
            "deed_percentage": 0.0,
            "monthly_hoa": 0.0,
            "monthly_property_tax": 0.0,
        },
    )
    r0 = client.post("/api/compare-scenarios-enhanced", json=p0)
    assert r0.status_code == 200, r0.text
    b0 = _buy(r0.json())
    rent0 = _rent(r0.json())
    itb0 = _invest_then_buy(r0.json())

    # Upfront only
    p1 = dict(
        BASE,
        additional_costs={
            "itbi_percentage": 2.0,
            "deed_percentage": 1.0,
            "monthly_hoa": 0.0,
            "monthly_property_tax": 0.0,
        },
    )
    r1 = client.post("/api/compare-scenarios-enhanced", json=p1)
    b1 = _buy(r1.json())

    # Upfront + monthly
    p2 = dict(
        BASE,
        additional_costs={
            "itbi_percentage": 2.0,
            "deed_percentage": 1.0,
            "monthly_hoa": 300.0,
            "monthly_property_tax": 200.0,
        },
    )
    r2 = client.post("/api/compare-scenarios-enhanced", json=p2)
    b2 = _buy(r2.json())
    rent2 = _rent(r2.json())
    itb2 = _invest_then_buy(r2.json())

    assert b0["total_cost"] < b1["total_cost"] <= b2["total_cost"]
    # Monthly additional costs present only in third variant
    first_month = b2["monthly_data"][0]
    assert first_month.get("monthly_additional_costs") == 500.0

    # Rent-based scenarios should also reflect recurring costs in monthly records and totals
    assert rent0["total_cost"] < rent2["total_cost"]
    assert itb0["total_cost"] < itb2["total_cost"]

    rent_first = rent2["monthly_data"][0]
    assert rent_first.get("monthly_additional_costs") == 500.0
    assert rent_first.get("housing_due") == 2500.0

    itb_first = itb2["monthly_data"][0]
    assert itb_first.get("monthly_additional_costs") == 500.0
    assert itb_first.get("housing_due") == 2500.0
