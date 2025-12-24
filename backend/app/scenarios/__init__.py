"""Scenario simulation modules.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from .base import ScenarioSimulator
from .buy import BuyScenarioSimulator
from .comparison import compare_scenarios, enhanced_compare_scenarios
from .invest_then_buy import InvestThenBuyScenarioSimulator
from .rent_and_invest import RentAndInvestScenarioSimulator

__all__ = [
    "BuyScenarioSimulator",
    "InvestThenBuyScenarioSimulator",
    "RentAndInvestScenarioSimulator",
    "ScenarioSimulator",
    "compare_scenarios",
    "enhanced_compare_scenarios",
]
