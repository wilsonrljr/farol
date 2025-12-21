"""Export endpoints (CSV/XLSX)."""

import json
from io import BytesIO, StringIO
from typing import Any, cast

import pandas as pd  # type: ignore[import-untyped]
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..input_normalization import resolve_monthly_interest_rate, resolve_rent_value
from ...finance import (
    simulate_price_loan,
    simulate_sac_loan,
)
from ...models import ComparisonInput, LoanSimulationInput
from ...scenarios.comparison import compare_scenarios, enhanced_compare_scenarios

router = APIRouter(tags=["exports"])


def _dataframe_to_stream(
    df: pd.DataFrame,
    meta: dict[str, object],
    base_filename: str,
    file_format: str,
) -> StreamingResponse:
    """Serialize DataFrame + optional metadata to CSV or XLSX streaming response."""
    file_format = file_format.lower()
    if file_format == "csv":
        buff = StringIO()
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

    if file_format == "xlsx":
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

    raise HTTPException(status_code=400, detail="Unsupported format")


@router.post("/api/simulate-loan/export")
def export_simulate_loan(
    input_data: LoanSimulationInput,
    file_format: str = Query("csv", pattern="^(csv|xlsx)$", alias="format"),
) -> StreamingResponse:
    """Export loan simulation (SAC/PRICE) to CSV or XLSX."""
    loan_value = input_data.property_value - input_data.down_payment

    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )
    term_months = input_data.loan_term_years * 12

    if input_data.loan_type == "SAC":
        result = simulate_sac_loan(
            loan_value,
            term_months,
            monthly_rate,
            input_data.amortizations,
            input_data.inflation_rate,
        )
    else:
        result = simulate_price_loan(
            loan_value,
            term_months,
            monthly_rate,
            input_data.amortizations,
            input_data.inflation_rate,
        )
    rows = [
        {
            "month": inst.month,
            "installment": inst.installment,
            "amortization": inst.amortization,
            "interest": inst.interest,
            "extra_amortization": inst.extra_amortization,
            "outstanding_balance": inst.outstanding_balance,
        }
        for inst in result.installments
    ]
    df = pd.DataFrame(rows)
    meta: dict[str, object] = {
        "loan_value": result.loan_value,
        "total_paid": result.total_paid,
        "total_interest_paid": result.total_interest_paid,
        "original_term_months": result.original_term_months,
        "actual_term_months": result.actual_term_months,
        "months_saved": result.months_saved,
        "total_extra_amortization": result.total_extra_amortization,
    }
    return _dataframe_to_stream(df, meta, "loan_simulation", file_format)


@router.post("/api/compare-scenarios/export")
def export_compare_scenarios(
    input_data: ComparisonInput,
    file_format: str = Query("csv", pattern="^(csv|xlsx)$", alias="format"),
    shape: str = Query("long", pattern="^(long|wide)$"),
) -> StreamingResponse:
    """Export basic scenario comparison."""
    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )

    rent_value = resolve_rent_value(
        property_value=input_data.property_value,
        rent_value=input_data.rent_value,
        rent_percentage=input_data.rent_percentage,
    )

    amortizations = cast(Any, input_data.amortizations)
    result = compare_scenarios(
        property_value=input_data.property_value,
        down_payment=input_data.down_payment,
        loan_term_years=input_data.loan_term_years,
        monthly_interest_rate=monthly_rate,
        loan_type=input_data.loan_type,
        rent_value=rent_value,
        investment_returns=input_data.investment_returns,
        amortizations=amortizations,
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

    long_rows: list[dict] = []
    for sc in result.scenarios:
        for m in sc.monthly_data:
            row = m.model_dump()
            row["scenario"] = sc.name
            long_rows.append(row)

    if not long_rows:
        raise ValueError("No data to export")

    monthly_long = pd.DataFrame(long_rows)

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

    wide = None
    base_cols = ["equity", "investment_balance", "property_value", "cash_flow"]
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

            wide = reduce(
                lambda left, right: left.join(right, how="outer"), wide_parts
            ).reset_index()

    if file_format == "csv":
        buff = StringIO()
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

    bio = BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as writer:  # type: ignore
        summary.to_excel(writer, index=False, sheet_name="summary")
        monthly_long.to_excel(writer, index=False, sheet_name="monthly_long")
        if wide is not None:
            wide.to_excel(writer, index=False, sheet_name="monthly_wide")

        used_sheet_names = {"summary", "monthly_long", "monthly_wide"}
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
            "Content-Disposition": "attachment; filename=scenarios_comparison.xlsx"
        },
    )


@router.post("/api/compare-scenarios-enhanced/export")
def export_compare_scenarios_enhanced(
    input_data: ComparisonInput,
    file_format: str = Query("csv", pattern="^(csv|xlsx)$", alias="format"),
    shape: str = Query("long", pattern="^(long|wide)$"),
) -> StreamingResponse:
    """Export enhanced scenario comparison (metrics + monthly data)."""
    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )

    rent_value = resolve_rent_value(
        property_value=input_data.property_value,
        rent_value=input_data.rent_value,
        rent_percentage=input_data.rent_percentage,
    )

    amortizations = cast(Any, input_data.amortizations)
    result = enhanced_compare_scenarios(
        property_value=input_data.property_value,
        down_payment=input_data.down_payment,
        loan_term_years=input_data.loan_term_years,
        monthly_interest_rate=monthly_rate,
        loan_type=input_data.loan_type,
        rent_value=rent_value,
        investment_returns=input_data.investment_returns,
        amortizations=amortizations,
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

    long_rows: list[dict] = []
    for sc in result.scenarios:
        for m in sc.monthly_data:
            row = m.model_dump()
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

            wide = reduce(
                lambda left, right: left.join(right, how="outer"), wide_parts
            ).reset_index()

    if file_format == "csv":
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

        comp: dict[str, dict[str, object]] = dict(result.comparative_summary)
        if isinstance(comp, dict) and all(isinstance(v, dict) for v in comp.values()):
            rows = []
            for key, data in comp.items():
                row = dict(data)
                row["key"] = key
                rows.append(row)
            comp_df = pd.DataFrame(rows)
            if "key" in comp_df.columns:
                try:
                    comp_df["__m"] = (
                        comp_df["key"].str.extract(r"month_(\d+)").astype(float)
                    )
                    comp_df = comp_df.sort_values("__m", na_position="last").drop(columns=["__m"])  # type: ignore
                except (TypeError, ValueError):
                    pass
            comp_df.to_excel(writer, index=False, sheet_name="comparative_summary")
        else:
            pd.DataFrame([{"comparative_summary_json": json.dumps(comp)}]).to_excel(
                writer, index=False, sheet_name="comparative_summary"
            )

        used_sheet_names = {
            "metrics",
            "monthly_long",
            "monthly_wide",
            "comparative_summary",
        } | set(writer.book.sheetnames)

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
