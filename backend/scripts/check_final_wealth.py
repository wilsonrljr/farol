from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app


def make_payload(*, rent_inflation_rate: float, rent_reduces_investment: bool) -> dict:
    return {
        "property_value": 500000,
        "down_payment": 100000,
        "loan_term_years": 30,
        "loan_type": "SAC",
        "annual_interest_rate": 10.0,
        "inflation_rate": 4.0,
        "property_appreciation_rate": 2.0,
        "rent_value": 2000,
        "rent_inflation_rate": rent_inflation_rate,
        "investment_returns": [
            {"annual_rate": 10.0, "start_month": 1, "end_month": None}
        ],
        "amortizations": [],
        "contributions": [],
        "additional_costs": {
            "itbi_rate": 3.0,
            "deed_cost_rate": 1.0,
            "monthly_condo": 350,
            "monthly_property_tax": 200,
        },
        "rent_reduces_investment": rent_reduces_investment,
        "invest_external_surplus": False,
    }


def main() -> None:
    client = TestClient(app)

    for rent_reduces in (False, True):
        for r in (2.0, 6.0):
            resp = client.post(
                "/api/compare-scenarios-enhanced",
                json=make_payload(
                    rent_inflation_rate=r,
                    rent_reduces_investment=rent_reduces,
                ),
            )
            if resp.status_code != 200:
                print("rent_reduces_investment", rent_reduces)
                print("rent_inflation_rate", r)
                print("status", resp.status_code)
                try:
                    print(resp.json())
                except Exception:
                    print(resp.text)
                print("---")
                continue
            data = resp.json()

            print("rent_reduces_investment", rent_reduces)
            print("rent_inflation_rate", r)
            for s in data["scenarios"]:
                print(
                    " ",
                    s["name"],
                    "final_equity=",
                    s.get("final_equity"),
                    "final_wealth=",
                    s.get("final_wealth"),
                    "total_cost=",
                    s.get("total_cost"),
                )
            print("---")


if __name__ == "__main__":
    main()
