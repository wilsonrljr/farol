"""FastAPI application entrypoint for Farol.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import os
from io import StringIO, BytesIO
import json

import pandas as pd

from .models import (
    LoanSimulationInput,
    ComparisonInput,
    LoanSimulationResult,
    ComparisonResult,
    EnhancedComparisonResult,
    ScenariosMetricsResult,
    ScenarioMetricsSummary,
)
from .finance import (
    convert_interest_rate,
    simulate_sac_loan,
    simulate_price_loan,
    compare_scenarios,
    enhanced_compare_scenarios,
)

APP_NAME = os.getenv("APP_NAME", "Farol")
API_TITLE = os.getenv("API_TITLE", f"{APP_NAME} API")
API_DESCRIPTION = os.getenv(
    "API_DESCRIPTION",
    "Plataforma Farol: simulação e planejamento financeiro (imóveis hoje; outros objetivos no futuro).",
)

app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": f"{API_TITLE}", "name": APP_NAME}


@app.post("/api/simulate-loan", response_model=LoanSimulationResult)
async def simulate_loan(input_data: LoanSimulationInput):
    """
    Simulate a loan with either SAC or PRICE method.
    Supports additional costs (ITBI, deed, HOA, property tax) and inflation.
    """
    try:
        # Calculate loan value (base value, additional costs will be handled in simulation functions)
        loan_value = input_data.property_value - input_data.down_payment

        # Convert interest rates if needed
        annual_rate = input_data.annual_interest_rate
        monthly_rate = input_data.monthly_interest_rate

        if annual_rate is None and monthly_rate is None:
            raise HTTPException(
                status_code=400,
                detail="Either annual_interest_rate or monthly_interest_rate must be provided",
            )

        annual_rate, monthly_rate = convert_interest_rate(annual_rate, monthly_rate)

        # Calculate term in months
        term_months = input_data.loan_term_years * 12

        # Simulate loan
        if input_data.loan_type == "SAC":
            result = simulate_sac_loan(
                loan_value,
                term_months,
                monthly_rate,
                input_data.amortizations,
                input_data.inflation_rate,
            )
        else:  # PRICE
            result = simulate_price_loan(
                loan_value,
                term_months,
                monthly_rate,
                input_data.amortizations,
                input_data.inflation_rate,
            )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/compare-scenarios", response_model=ComparisonResult)
async def compare_housing_scenarios(input_data: ComparisonInput):
    """
    Compare different housing scenarios: buying with a loan, renting and investing, or investing then buying.
    Supports additional costs (ITBI, deed, HOA, property tax) and inflation.
    """
    try:
        # Convert interest rates if needed
        annual_rate = input_data.annual_interest_rate
        monthly_rate = input_data.monthly_interest_rate

        if annual_rate is None and monthly_rate is None:
            raise HTTPException(
                status_code=400,
                detail="Either annual_interest_rate or monthly_interest_rate must be provided",
            )

        annual_rate, monthly_rate = convert_interest_rate(annual_rate, monthly_rate)

        # Calculate rent value if provided as percentage
        rent_value = input_data.rent_value
        if rent_value is None and input_data.rent_percentage is not None:
            rent_value = (
                input_data.property_value * (input_data.rent_percentage / 100) / 12
            )

        if rent_value is None:
            raise HTTPException(
                status_code=400,
                detail="Either rent_value or rent_percentage must be provided",
            )

        # Compare scenarios
        result = compare_scenarios(
            property_value=input_data.property_value,
            down_payment=input_data.down_payment,
            loan_term_years=input_data.loan_term_years,
            monthly_interest_rate=monthly_rate,
            loan_type=input_data.loan_type,
            rent_value=rent_value,
            investment_returns=input_data.investment_returns,
            amortizations=input_data.amortizations,
            additional_costs=input_data.additional_costs,
            inflation_rate=input_data.inflation_rate,
            rent_inflation_rate=input_data.rent_inflation_rate,
            property_appreciation_rate=input_data.property_appreciation_rate,
            invest_loan_difference=input_data.invest_loan_difference,
            fixed_monthly_investment=input_data.fixed_monthly_investment,
            fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
            rent_reduces_investment=input_data.rent_reduces_investment,
            monthly_external_savings=input_data.monthly_external_savings,
            invest_external_surplus=input_data.invest_external_surplus,
            investment_tax=input_data.investment_tax,
            fgts=input_data.fgts,
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/api/scenario-metrics", response_model=ScenariosMetricsResult)
async def scenario_metrics(input_data: ComparisonInput):
    """Lightweight metrics summary (ROI bruto e ajustado, custo líquido) sem monthly_data detalhado."""
    try:
        annual_rate = input_data.annual_interest_rate
        monthly_rate = input_data.monthly_interest_rate
        if annual_rate is None and monthly_rate is None:
            raise HTTPException(
                status_code=400,
                detail="Either annual_interest_rate or monthly_interest_rate must be provided",
            )
        annual_rate, monthly_rate = convert_interest_rate(annual_rate, monthly_rate)

        rent_value = input_data.rent_value
        if rent_value is None and input_data.rent_percentage is not None:
            rent_value = (
                input_data.property_value * (input_data.rent_percentage / 100) / 12
            )
        if rent_value is None:
            raise HTTPException(
                status_code=400,
                detail="Either rent_value or rent_percentage must be provided",
            )

        enhanced = enhanced_compare_scenarios(
            property_value=input_data.property_value,
            down_payment=input_data.down_payment,
            loan_term_years=input_data.loan_term_years,
            monthly_interest_rate=monthly_rate,
            loan_type=input_data.loan_type,
            rent_value=rent_value,
            investment_returns=input_data.investment_returns,
            amortizations=input_data.amortizations,
            additional_costs=input_data.additional_costs,
            inflation_rate=input_data.inflation_rate,
            rent_inflation_rate=input_data.rent_inflation_rate,
            property_appreciation_rate=input_data.property_appreciation_rate,
            invest_loan_difference=input_data.invest_loan_difference,
            fixed_monthly_investment=input_data.fixed_monthly_investment,
            fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
            rent_reduces_investment=input_data.rent_reduces_investment,
            monthly_external_savings=input_data.monthly_external_savings,
            invest_external_surplus=input_data.invest_external_surplus,
            investment_tax=input_data.investment_tax,
            fgts=input_data.fgts,
        )

        summaries = []
        for sc in enhanced.scenarios:
            m = sc.metrics
            summaries.append(
                ScenarioMetricsSummary(
                    name=sc.name,
                    net_cost=sc.total_cost,
                    final_equity=sc.final_equity,
                    total_outflows=(
                        sc.total_outflows if hasattr(sc, "total_outflows") else None
                    ),
                    roi_percentage=m.roi_percentage,
                    roi_adjusted_percentage=m.roi_adjusted_percentage,
                    total_rent_withdrawn_from_investment=m.total_rent_withdrawn_from_investment,
                    months_with_burn=m.months_with_burn,
                    average_sustainable_withdrawal_ratio=m.average_sustainable_withdrawal_ratio,
                )
            )

        return ScenariosMetricsResult(
            best_scenario=enhanced.best_scenario, metrics=summaries
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/api/compare-scenarios-enhanced", response_model=EnhancedComparisonResult)
async def compare_housing_scenarios_enhanced(input_data: ComparisonInput):
    """
    Enhanced comparison of housing scenarios with detailed metrics and month-by-month analysis.
    Includes explicit differences between scenarios, ROI calculations, and comprehensive wealth tracking.
    """
    try:
        # Convert interest rates if needed
        annual_rate = input_data.annual_interest_rate
        monthly_rate = input_data.monthly_interest_rate

        if annual_rate is None and monthly_rate is None:
            raise HTTPException(
                status_code=400,
                detail="Either annual_interest_rate or monthly_interest_rate must be provided",
            )

        annual_rate, monthly_rate = convert_interest_rate(annual_rate, monthly_rate)

        # Calculate rent value if provided as percentage
        rent_value = input_data.rent_value
        if rent_value is None and input_data.rent_percentage is not None:
            rent_value = (
                input_data.property_value * (input_data.rent_percentage / 100) / 12
            )

        if rent_value is None:
            raise HTTPException(
                status_code=400,
                detail="Either rent_value or rent_percentage must be provided",
            )

        # Enhanced comparison with detailed metrics
        result = enhanced_compare_scenarios(
            property_value=input_data.property_value,
            down_payment=input_data.down_payment,
            loan_term_years=input_data.loan_term_years,
            monthly_interest_rate=monthly_rate,
            loan_type=input_data.loan_type,
            rent_value=rent_value,
            investment_returns=input_data.investment_returns,
            amortizations=input_data.amortizations,
            additional_costs=input_data.additional_costs,
            inflation_rate=input_data.inflation_rate,
            rent_inflation_rate=input_data.rent_inflation_rate,
            property_appreciation_rate=input_data.property_appreciation_rate,
            invest_loan_difference=input_data.invest_loan_difference,
            fixed_monthly_investment=input_data.fixed_monthly_investment,
            fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
            rent_reduces_investment=input_data.rent_reduces_investment,
            monthly_external_savings=input_data.monthly_external_savings,
            invest_external_surplus=input_data.invest_external_surplus,
            investment_tax=input_data.investment_tax,
            fgts=input_data.fgts,
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


# --------------------------- EXPORT UTILITIES ---------------------------------
def _dataframe_to_stream(
    df: pd.DataFrame, meta: dict, base_filename: str, file_format: str
) -> StreamingResponse:
    """Serialize DataFrame + optional metadata (meta) to CSV or XLSX streaming response."""
    file_format = file_format.lower()
    if file_format == "csv":
        buff = StringIO()
        # Prepend metadata as commented header lines (simple, keeps single file)
        if meta:
            for k, v in meta.items():
                buff.write(f"# {k}: {v}\n")
        df.to_csv(buff, index=False)
        buff.seek(0)
        return StreamingResponse(
            buff,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={base_filename}.csv"
            },
        )
    elif file_format == "xlsx":
        bio = BytesIO()
        with pd.ExcelWriter(bio, engine="openpyxl") as writer:  # type: ignore
            df.to_excel(writer, index=False, sheet_name="data")
            if meta:
                pd.DataFrame([meta]).to_excel(writer, index=False, sheet_name="summary")
        bio.seek(0)
        return StreamingResponse(
            bio,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={base_filename}.xlsx"
            },
        )
    else:  # pragma: no cover - validation happens earlier
        raise HTTPException(status_code=400, detail="Unsupported format")


@app.post("/api/simulate-loan/export")
async def export_simulate_loan(
    input_data: LoanSimulationInput, format: str = Query("csv", pattern="^(csv|xlsx)$")
):
    """Exporta a simulação de financiamento (SAC/PRICE) em CSV ou XLSX."""
    result = await simulate_loan(input_data)  # reutiliza lógica existente
    rows = []
    for inst in result.installments:
        rows.append(
            {
                "month": inst.month,
                "installment": inst.installment,
                "amortization": inst.amortization,
                "interest": inst.interest,
                "extra_amortization": inst.extra_amortization,
                "outstanding_balance": inst.outstanding_balance,
            }
        )
    df = pd.DataFrame(rows)
    meta = {
        "loan_value": result.loan_value,
        "total_paid": result.total_paid,
        "total_interest_paid": result.total_interest_paid,
        "original_term_months": result.original_term_months,
        "actual_term_months": result.actual_term_months,
        "months_saved": result.months_saved,
        "total_extra_amortization": result.total_extra_amortization,
    }
    return _dataframe_to_stream(df, meta, "loan_simulation", format)


@app.post("/api/compare-scenarios/export")
async def export_compare_scenarios(
    input_data: ComparisonInput,
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    shape: str = Query("long", pattern="^(long|wide)$"),
):
    """Exporta comparação básica.

    XLSX Sheets:
      - summary: agregados por cenário
      - monthly_long: formato longo (cenario, month, ...)
      - monthly_wide: (opcional) pivot (month, <colunas por cenário para equity, investment_balance, property_value, cash_flow)
      - <nome_sanitizado_de_cada_cenario>: dados mensais individuais

    CSV:
      - Sempre monthly_long
      - Header comentado com summary
      - Se shape=wide acrescenta bloco `# --- monthly_wide ---` após summary
    """
    result = await compare_housing_scenarios(input_data)
    # Build long form
    long_rows: list[dict] = []
    for sc in result.scenarios:
        for m in sc.monthly_data:
            row = dict(m)
            row["scenario"] = sc.name
            long_rows.append(row)
    if not long_rows:
        raise HTTPException(status_code=400, detail="No data to export")
    monthly_long = pd.DataFrame(long_rows)
    # Summary
    summary = pd.DataFrame(
        [
            {
                "scenario": sc.name,
                "total_cost": sc.total_cost,
                "final_equity": sc.final_equity,
                "total_outflows": getattr(sc, "total_outflows", None),
                "net_cost": getattr(sc, "net_cost", None),
            }
            for sc in result.scenarios
        ]
    )
    # Wide pivot (selected numeric columns)
    wide = None
    base_cols = [
        "equity",
        "investment_balance",
        "property_value",
        "cash_flow",
    ]
    present_cols = [c for c in base_cols if c in monthly_long.columns]
    if present_cols:
        wide_parts = []
        for col in present_cols:
            pivot = monthly_long.pivot_table(
                index="month", columns="scenario", values=col, aggfunc="first"
            )
            pivot.columns = [f"{col}__{c}" for c in pivot.columns]
            wide_parts.append(pivot)
        if wide_parts:
            from functools import reduce

            wide = reduce(lambda l, r: l.join(r, how="outer"), wide_parts).reset_index()

    if format == "csv":
        buff = StringIO()
        # summary as commented header
        buff.write("# --- summary ---\n")
        summary.to_csv(buff, index=False)
        buff.write("\n# --- monthly_long ---\n")
        monthly_long.to_csv(buff, index=False)
        if shape == "wide" and wide is not None:
            buff.write("\n# --- monthly_wide ---\n")
            wide.to_csv(buff, index=False)
        buff.seek(0)
        return StreamingResponse(
            buff,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=scenarios_comparison.csv"
            },
        )
    # XLSX multi-sheet
    bio = BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as writer:  # type: ignore
        summary.to_excel(writer, index=False, sheet_name="summary")
        monthly_long.to_excel(writer, index=False, sheet_name="monthly_long")
        if wide is not None:
            wide.to_excel(writer, index=False, sheet_name="monthly_wide")
        # Per-scenario sheet
        # Uma única aba por cenário (todos os meses). Garante unicidade de nomes.
        used_sheet_names = set(["summary", "monthly_long", "monthly_wide"])
        for sc in result.scenarios:
            df_sc = pd.DataFrame(sc.monthly_data)
            base = sc.name.strip() or "scenario"
            base = (
                base.replace("/", "_")
                .replace("\\", "_")
                .replace(":", "_")
                .replace("*", "_")
                .replace("?", "_")
                .replace("[", "(")
                .replace("]", ")")
            )
            # Excel limita 31 chars
            candidate = base[:31]
            idx = 1
            while candidate in used_sheet_names:
                suffix = f"_{idx}"
                candidate = (base[: 31 - len(suffix)] + suffix)[:31]
                idx += 1
            used_sheet_names.add(candidate)
            df_sc.to_excel(writer, index=False, sheet_name=candidate)
    bio.seek(0)
    return StreamingResponse(
        bio,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=scenarios_comparison.xlsx"
        },
    )


@app.post("/api/compare-scenarios-enhanced/export")
async def export_compare_scenarios_enhanced(
    input_data: ComparisonInput,
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    shape: str = Query("long", pattern="^(long|wide)$"),
):
    """Exporta comparação avançada com métricas e summary multi-sheet / multi-bloco."""
    result = await compare_housing_scenarios_enhanced(input_data)
    long_rows: list[dict] = []
    for sc in result.scenarios:
        for m in sc.monthly_data:
            row = dict(m)
            row["scenario"] = sc.name
            long_rows.append(row)
    monthly_long = pd.DataFrame(long_rows)
    metrics_df = pd.DataFrame(
        [
            {
                "scenario": sc.name,
                "total_cost": sc.total_cost,
                "final_equity": sc.final_equity,
                "total_cost_difference": sc.metrics.total_cost_difference,
                "total_cost_percentage_difference": sc.metrics.total_cost_percentage_difference,
                "break_even_month": sc.metrics.break_even_month,
                "roi_percentage": sc.metrics.roi_percentage,
                "roi_adjusted_percentage": sc.metrics.roi_adjusted_percentage,
                "average_monthly_cost": sc.metrics.average_monthly_cost,
                "total_interest_or_rent_paid": sc.metrics.total_interest_or_rent_paid,
                "wealth_accumulation": sc.metrics.wealth_accumulation,
                "total_rent_withdrawn_from_investment": sc.metrics.total_rent_withdrawn_from_investment,
                "months_with_burn": sc.metrics.months_with_burn,
                "average_sustainable_withdrawal_ratio": sc.metrics.average_sustainable_withdrawal_ratio,
            }
            for sc in result.scenarios
        ]
    )
    # Wide
    wide = None
    base_cols = [
        "equity",
        "investment_balance",
        "property_value",
        "cash_flow",
        "progress_percent",
        "shortfall",
    ]
    present_cols = [c for c in base_cols if c in monthly_long.columns]
    if present_cols:
        wide_parts = []
        for col in present_cols:
            pivot = monthly_long.pivot_table(
                index="month", columns="scenario", values=col, aggfunc="first"
            )
            pivot.columns = [f"{col}__{c}" for c in pivot.columns]
            wide_parts.append(pivot)
        if wide_parts:
            from functools import reduce

            wide = reduce(lambda l, r: l.join(r, how="outer"), wide_parts).reset_index()

    if format == "csv":
        buff = StringIO()
        buff.write("# --- metrics ---\n")
        metrics_df.to_csv(buff, index=False)
        buff.write("\n# --- monthly_long ---\n")
        monthly_long.to_csv(buff, index=False)
        if shape == "wide" and wide is not None:
            buff.write("\n# --- monthly_wide ---\n")
            wide.to_csv(buff, index=False)
        buff.write("\n# --- comparative_summary(json) ---\n")
        buff.write(json.dumps(result.comparative_summary))
        buff.seek(0)
        return StreamingResponse(
            buff,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=scenarios_comparison_enhanced.csv"
            },
        )
    bio = BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as writer:  # type: ignore
        metrics_df.to_excel(writer, index=False, sheet_name="metrics")
        monthly_long.to_excel(writer, index=False, sheet_name="monthly_long")
        if wide is not None:
            wide.to_excel(writer, index=False, sheet_name="monthly_wide")
        # Comparative summary: consolidar tudo em uma única aba para evitar explosão de sheets
        comp = result.comparative_summary
        if isinstance(comp, dict) and all(isinstance(v, dict) for v in comp.values()):
            rows = []
            for key, data in comp.items():
                row = dict(data)
                row["key"] = key  # preserva identificador (ex: month_1)
                rows.append(row)
            comp_df = pd.DataFrame(rows)
            # Garante ordem por mês se padrão month_<n>
            if "key" in comp_df.columns:
                try:
                    comp_df["__m"] = (
                        comp_df["key"].str.extract(r"month_(\d+)").astype(float)
                    )
                    comp_df = comp_df.sort_values("__m", na_position="last").drop(columns=["__m"])  # type: ignore
                except Exception:
                    pass
            comp_df.to_excel(writer, index=False, sheet_name="comparative_summary")
        else:
            pd.DataFrame([{"comparative_summary_json": json.dumps(comp)}]).to_excel(
                writer, index=False, sheet_name="comparative_summary"
            )
        used_sheet_names = set(
            ["metrics", "monthly_long", "monthly_wide", "comparative_summary"]
        ) | {s for s in writer.book.sheetnames}
        for sc in result.scenarios:
            df_sc = pd.DataFrame(sc.monthly_data)
            base = sc.name.strip() or "scenario"
            base = (
                base.replace("/", "_")
                .replace("\\", "_")
                .replace(":", "_")
                .replace("*", "_")
                .replace("?", "_")
                .replace("[", "(")
                .replace("]", ")")
            )
            candidate = base[:31]
            idx = 1
            while candidate in used_sheet_names:
                suffix = f"_{idx}"
                candidate = (base[: 31 - len(suffix)] + suffix)[:31]
                idx += 1
            used_sheet_names.add(candidate)
            df_sc.to_excel(writer, index=False, sheet_name=candidate)
    bio.seek(0)
    return StreamingResponse(
        bio,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=scenarios_comparison_enhanced.xlsx"
        },
    )


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
