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


def test_owner_and_renter_costs_are_charged_to_the_right_scenarios():
    payload = dict(
        BASE,
        additional_costs={
            "itbi_percentage": 2.0,
            "deed_percentage": 1.0,
            "owner_monthly_costs": {
                "hoa": 700.0,
                "property_tax": 300.0,
                "other": 240.0,
            },
            "renter_monthly_costs": {
                "hoa": 150.0,
                "property_tax": 0.0,
                "other": 60.0,
            },
        },
    )
    response = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert response.status_code == 200, response.text

    data = response.json()
    buy_month = _buy(data)["monthly_data"][0]
    rent_month = _rent(data)["monthly_data"][0]
    invest_month = _invest_then_buy(data)["monthly_data"][0]
    assert buy_month["monthly_other_costs"] == 240.0
    assert buy_month["monthly_additional_costs"] == 1_240.0
    assert rent_month["monthly_other_costs"] == 60.0
    assert rent_month["monthly_additional_costs"] == 210.0
    assert invest_month["monthly_other_costs"] == 60.0
    assert invest_month["monthly_additional_costs"] == 210.0


def test_invest_then_buy_purchase_month_reconciles_overlapping_housing_costs():
    """The purchase month charges both sides of the occupancy transition.

    Rent and renter costs are already due for the month. Owner costs start when
    the purchase occurs. The public breakdown and the canonical resource ledger
    must therefore agree on the combined housing obligation.
    """
    payload = dict(
        BASE,
        total_savings=530_000.0,
        monthly_plan={
            "net_income": 5_000.0,
            "non_housing_expenses": 0.0,
            "adjust_for_inflation": False,
            "wealth_allocation_percentage": 0.0,
            "financed_purchase": {
                "amortization_percentage": 0.0,
                "amortization_effect": "reduce_term",
            },
        },
        investment_returns=[{"start_month": 1, "end_month": None, "annual_rate": 0.0}],
        additional_costs={
            "itbi_percentage": 2.0,
            "deed_percentage": 1.0,
            "owner_monthly_costs": {
                "hoa": 700.0,
                "property_tax": 300.0,
                "other": 240.0,
            },
            "renter_monthly_costs": {
                "hoa": 150.0,
                "property_tax": 0.0,
                "other": 60.0,
            },
        },
    )

    response = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert response.status_code == 200, response.text

    scenario = _invest_then_buy(response.json())
    transition = scenario["monthly_data"][0]
    after_purchase = scenario["monthly_data"][1]

    assert transition["status"] == "Imóvel comprado"
    assert transition["rent_due"] == 2_000.0
    assert transition["monthly_hoa"] == 850.0
    assert transition["monthly_property_tax"] == 300.0
    assert transition["monthly_other_costs"] == 300.0
    assert transition["monthly_additional_costs"] == 1_450.0
    assert transition["housing_due"] == 3_450.0
    assert transition["housing_paid"] == 3_450.0
    assert transition["housing_shortfall"] == 0.0
    assert transition["total_monthly_cost"] == 533_450.0

    # Unallocated surplus stays outside the simulation; it is not accumulated
    # into a hidden cash reserve or spent on the purchase.
    assert transition.get("cash_reserve_used_for_purchase") is None
    assert transition["outside_plan_amount"] == 1_550.0
    assert transition["required_cash_outflow"] == 5_000.0
    assert transition["funded_from_resources"] == 5_000.0
    assert transition["unfunded_amount"] == 0.0

    # From the following month onward there is no rent/renter overlap.
    assert after_purchase.get("rent_due") is None
    assert after_purchase["monthly_other_costs"] == 240.0
    assert after_purchase["monthly_additional_costs"] == 1_240.0
    assert after_purchase["housing_due"] == 1_240.0


def test_invest_then_buy_transition_shortfall_becomes_a_ledger_liability():
    payload = dict(
        BASE,
        total_savings=530_000.0,
        monthly_plan={
            "net_income": 2_500.0,
            "non_housing_expenses": 0.0,
            "adjust_for_inflation": False,
            "wealth_allocation_percentage": 0.0,
            "financed_purchase": {
                "amortization_percentage": 0.0,
                "amortization_effect": "reduce_term",
            },
        },
        investment_returns=[{"start_month": 1, "end_month": None, "annual_rate": 0.0}],
        additional_costs={
            "itbi_percentage": 2.0,
            "deed_percentage": 1.0,
            "owner_monthly_costs": {
                "hoa": 700.0,
                "property_tax": 300.0,
                "other": 240.0,
            },
            "renter_monthly_costs": {
                "hoa": 150.0,
                "property_tax": 0.0,
                "other": 60.0,
            },
        },
    )

    response = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert response.status_code == 200, response.text

    scenario = _invest_then_buy(response.json())
    transition = scenario["monthly_data"][0]

    assert transition["status"] == "Imóvel comprado"
    assert transition["monthly_other_costs"] == 300.0
    assert transition["housing_due"] == 3_450.0
    assert transition["housing_paid"] == 2_500.0
    assert transition["housing_shortfall"] == 950.0
    assert transition.get("cash_reserve_used_for_purchase") is None
    assert transition["required_cash_outflow"] == 3_450.0
    assert transition["funded_from_resources"] == 2_500.0
    assert transition["unfunded_amount"] == 950.0
    assert scenario["is_feasible"] is False
    assert scenario["first_unfunded_month"] == 1
    assert scenario["total_unfunded_amount"] == 950.0


def test_legacy_costs_preserve_behavior_and_mixed_shape_is_rejected():
    legacy = dict(
        BASE,
        additional_costs={
            "itbi_percentage": 0,
            "deed_percentage": 0,
            "monthly_hoa": 400,
            "monthly_property_tax": 100,
        },
    )
    response = client.post("/api/compare-scenarios-enhanced", json=legacy)
    assert response.status_code == 200, response.text
    data = response.json()
    assert _buy(data)["monthly_data"][0]["monthly_additional_costs"] == 500.0
    assert _rent(data)["monthly_data"][0]["monthly_additional_costs"] == 500.0

    mixed = dict(legacy)
    mixed["additional_costs"] = {
        **legacy["additional_costs"],
        "owner_monthly_costs": {"hoa": 1, "property_tax": 2},
    }
    rejected = client.post("/api/compare-scenarios-enhanced", json=mixed)
    assert rejected.status_code == 422
