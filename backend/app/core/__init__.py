"""Core domain modules for Farol financial calculations.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from .amortization import preprocess_amortizations
from .costs import AdditionalCostsCalculator, calculate_additional_costs
from .fgts import FGTSManager
from .inflation import apply_inflation, apply_property_appreciation
from .investment import InvestmentAccount
from .rates import convert_interest_rate, get_monthly_investment_rate

__all__ = [
    "AdditionalCostsCalculator",
    "FGTSManager",
    "InvestmentAccount",
    "apply_inflation",
    "apply_property_appreciation",
    "calculate_additional_costs",
    "convert_interest_rate",
    "get_monthly_investment_rate",
    "preprocess_amortizations",
]
