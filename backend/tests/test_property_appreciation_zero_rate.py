"""Regression test: explicit 0% appreciation must not fall back to inflation.

This covers a subtle bug where using `or` would treat 0.0 as falsy and
unexpectedly apply the fallback inflation rate.
"""

from backend.app.core.inflation import apply_property_appreciation


def test_property_appreciation_zero_rate_does_not_use_fallback_inflation():
    base_value = 500_000.0
    inflation_rate = 10.0

    # Explicitly set appreciation_rate to 0.0: value should remain constant.
    v1 = apply_property_appreciation(
        base_value,
        month=1,
        base_month=1,
        property_appreciation_rate=0.0,
        fallback_inflation_rate=inflation_rate,
    )
    v12 = apply_property_appreciation(
        base_value,
        month=12,
        base_month=1,
        property_appreciation_rate=0.0,
        fallback_inflation_rate=inflation_rate,
    )

    assert v1 == base_value
    assert v12 == base_value
