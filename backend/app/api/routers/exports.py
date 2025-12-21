"""Export endpoints (CSV/XLSX)."""

import json
from io import BytesIO, StringIO

import pandas as pd  # type: ignore[import-untyped]
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ...models import ComparisonInput, LoanSimulationInput
from .simulations import (
    compare_housing_scenarios,
    compare_housing_scenarios_enhanced,
    simulate_loan,
)

router = APIRouter(tags=["exports"])


def _dataframe_to_stream(
    df: pd.DataFrame,
    meta: dict,
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
async def export_simulate_loan(
    input_data: LoanSimulationInput,
    file_format: str = Query("csv", pattern="^(csv|xlsx)$", alias="format"),
) -> StreamingResponse:
    """Export loan simulation (SAC/PRICE) to CSV or XLSX."""
    result = await simulate_loan(input_data)
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
    meta = {
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
async def export_compare_scenarios(
    input_data: ComparisonInput,
    file_format: str = Query("csv", pattern="^(csv|xlsx)$", alias="format"),
    shape: str = Query("long", pattern="^(long|wide)$"),
) -> StreamingResponse:
    """Export basic scenario comparison."""
    result = await compare_housing_scenarios(input_data)

    long_rows: list[dict] = []
    for sc in result.scenarios:
        for m in sc.monthly_data:
            row = dict(m)
            row["scenario"] = sc.name
            long_rows.append(row)

    if not long_rows:
        raise HTTPException(status_code=400, detail="No data to export")

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
async def export_compare_scenarios_enhanced(
    input_data: ComparisonInput,
    file_format: str = Query("csv", pattern="^(csv|xlsx)$", alias="format"),
    shape: str = Query("long", pattern="^(long|wide)$"),
) -> StreamingResponse:
    """Export enhanced scenario comparison (metrics + monthly data)."""
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

        comp = result.comparative_summary
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
