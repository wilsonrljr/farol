"""Unit tests for additional (upfront + monthly) property costs calculations.

Converted from the previous root-level script `test_additional_costs.py`.
"""

from backend.app.core.costs import calculate_additional_costs
from backend.app.models import AdditionalCostsInput


def test_additional_costs_full_case():
    property_value = 500_000
    costs_in = AdditionalCostsInput(
        itbi_percentage=2.0,
        deed_percentage=1.0,
        monthly_hoa=300.0,
        monthly_property_tax=200.0,
    )
    costs = calculate_additional_costs(property_value, costs_in)
    assert costs["itbi"] == property_value * 0.02
    assert costs["deed"] == property_value * 0.01
    assert costs["total_upfront"] == costs["itbi"] + costs["deed"]
    assert costs["monthly_hoa"] == 300.0
    assert costs["monthly_property_tax"] == 200.0
    assert costs["total_monthly"] == 500.0


def test_additional_costs_nulls_zero():
    property_value = 500_000
    costs_in = AdditionalCostsInput(
        itbi_percentage=0.0,
        deed_percentage=0.0,
        monthly_hoa=None,
        monthly_property_tax=None,
    )
    costs = calculate_additional_costs(property_value, costs_in)
    assert costs["itbi"] == 0
    assert costs["deed"] == 0
    assert costs["total_upfront"] == 0
    assert costs["monthly_hoa"] == 0
    assert costs["monthly_property_tax"] == 0
    assert costs["total_monthly"] == 0


def test_additional_costs_none_object():
    property_value = 500_000
    costs = calculate_additional_costs(property_value, None)
    assert all(v == 0 for v in costs.values())
