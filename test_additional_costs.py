#!/usr/bin/env python3
"""
Test script to verify that additional costs are being calculated correctly.
"""

from backend.app.finance import calculate_additional_costs
from backend.app.models import AdditionalCostsInput

# Test with default values (should have ITBI and deed costs)
property_value = 500000  # R$ 500,000
additional_costs = AdditionalCostsInput(
    itbi_percentage=2.0,
    deed_percentage=1.0,
    monthly_hoa=300.0,  # R$ 300 monthly HOA
    monthly_property_tax=200.0,  # R$ 200 monthly property tax
)

print("=== Testing Additional Costs Calculation ===")
print(f"Property Value: R$ {property_value:,.2f}")
print(f"ITBI Percentage: {additional_costs.itbi_percentage}%")
print(f"Deed Percentage: {additional_costs.deed_percentage}%")
print(f"Monthly HOA: R$ {additional_costs.monthly_hoa}")
print(f"Monthly Property Tax: R$ {additional_costs.monthly_property_tax}")
print()

# Calculate costs
costs = calculate_additional_costs(property_value, additional_costs)

print("=== Calculated Costs ===")
print(f"ITBI: R$ {costs['itbi']:,.2f}")
print(f"Deed: R$ {costs['deed']:,.2f}")
print(f"Total Upfront: R$ {costs['total_upfront']:,.2f}")
print(f"Monthly HOA: R$ {costs['monthly_hoa']:,.2f}")
print(f"Monthly Property Tax: R$ {costs['monthly_property_tax']:,.2f}")
print(f"Total Monthly: R$ {costs['total_monthly']:,.2f}")
print()

# Test with null values (should be zero)
additional_costs_null = AdditionalCostsInput(
    itbi_percentage=0.0,
    deed_percentage=0.0,
    monthly_hoa=None,
    monthly_property_tax=None,
)

costs_null = calculate_additional_costs(property_value, additional_costs_null)

print("=== With Null/Zero Values ===")
print(f"ITBI: R$ {costs_null['itbi']:,.2f}")
print(f"Deed: R$ {costs_null['deed']:,.2f}")
print(f"Total Upfront: R$ {costs_null['total_upfront']:,.2f}")
print(f"Monthly HOA: R$ {costs_null['monthly_hoa']:,.2f}")
print(f"Monthly Property Tax: R$ {costs_null['monthly_property_tax']:,.2f}")
print(f"Total Monthly: R$ {costs_null['total_monthly']:,.2f}")
print()

# Test with no additional costs object (should be zero)
costs_none = calculate_additional_costs(property_value, None)

print("=== With No Additional Costs Object ===")
print(f"ITBI: R$ {costs_none['itbi']:,.2f}")
print(f"Deed: R$ {costs_none['deed']:,.2f}")
print(f"Total Upfront: R$ {costs_none['total_upfront']:,.2f}")
print(f"Monthly HOA: R$ {costs_none['monthly_hoa']:,.2f}")
print(f"Monthly Property Tax: R$ {costs_none['monthly_property_tax']:,.2f}")
print(f"Total Monthly: R$ {costs_none['total_monthly']:,.2f}")
