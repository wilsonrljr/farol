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


def _input_to_flat_frame(input_data: ComparisonInput) -> pd.DataFrame:
    payload = input_data.model_dump()

    # Keep complex/nested values readable and stable in a single-cell JSON string.
    for key in (
        "investment_returns",
        "amortizations",
        "contributions",
        "additional_costs",
        "investment_tax",
        "fgts",
    ):
        if key in payload:
            payload[key] = json.dumps(payload[key], ensure_ascii=False)

    return pd.DataFrame([payload])


def _columns_dictionary(columns: list[str]) -> pd.DataFrame:
    # Minimal, human-first dictionary. Unknown fields remain with blank description.
    definitions: dict[str, dict[str, str]] = {
        "month": {
            "label": "Mês",
            "unit": "mês",
            "description": "Mês da simulação (1..N).",
        },
        "scenario": {
            "label": "Cenário",
            "unit": "-",
            "description": "Nome do cenário.",
        },
        "cash_flow": {
            "label": "Fluxo de caixa",
            "unit": "R$",
            "description": "Saída líquida do mês (negativo = desembolso).",
        },
        "total_monthly_cost": {
            "label": "Custo mensal total",
            "unit": "R$",
            "description": "Total de saídas/alocações do mês (inclui aportes quando aplicável).",
        },
        "initial_allocation": {
            "label": "Alocação inicial",
            "unit": "R$",
            "description": "Aporte/entrada alocada no mês 1 (ex.: entrada paga ou capital inicial investido).",
        },
        "rent_due": {
            "label": "Aluguel devido",
            "unit": "R$",
            "description": "Somente o aluguel (sem condomínio/IPTU).",
        },
        "rent_paid": {
            "label": "Aluguel pago",
            "unit": "R$",
            "description": "Parcela do aluguel efetivamente coberta (sem condomínio/IPTU).",
        },
        "rent_shortfall": {
            "label": "Falta de aluguel",
            "unit": "R$",
            "description": "Parte do aluguel não coberta por fontes modeladas (assume-se coberta por caixa/crédito externo).",
        },
        "monthly_hoa": {
            "label": "Condomínio",
            "unit": "R$",
            "description": "Condomínio do mês (corrigido por inflação quando configurado).",
        },
        "monthly_property_tax": {
            "label": "IPTU",
            "unit": "R$",
            "description": "IPTU do mês (corrigido por inflação quando configurado).",
        },
        "monthly_additional_costs": {
            "label": "Custos mensais adicionais",
            "unit": "R$",
            "description": "Condomínio + IPTU do mês.",
        },
        "housing_due": {
            "label": "Moradia devida",
            "unit": "R$",
            "description": "Total de moradia do mês. Aluguel + custos mensais (condomínio/IPTU) ou, no financiamento, parcela base + custos + amortização extra em cash.",
        },
        "housing_paid": {
            "label": "Moradia paga",
            "unit": "R$",
            "description": "Total coberto para moradia no mês (aluguel + custos).",
        },
        "housing_shortfall": {
            "label": "Falta de moradia",
            "unit": "R$",
            "description": "Parte do total de moradia não coberta por fontes modeladas.",
        },
        "external_cover": {
            "label": "Cobertura externa",
            "unit": "R$",
            "description": "Parte da moradia coberta por renda externa (ex.: renda líquida mensal).",
        },
        "external_surplus_invested": {
            "label": "Sobra externa investida",
            "unit": "R$",
            "description": "Excedente de renda externa investido no mês.",
        },
        "additional_investment": {
            "label": "Investimento adicional",
            "unit": "R$",
            "description": "Aporte total investido no mês além do saldo inicial (ex.: aportes programados e sobras investidas).",
        },
        "investment_balance": {
            "label": "Saldo investido",
            "unit": "R$",
            "description": "Saldo da conta de investimento ao fim do mês.",
        },
        "investment_return_gross": {
            "label": "Retorno bruto",
            "unit": "R$",
            "description": "Ganho bruto do mês antes de imposto (se aplicável).",
        },
        "investment_tax_paid": {
            "label": "Imposto",
            "unit": "R$",
            "description": "Imposto efetivo pago no mês (modo 'monthly') ou imposto em resgates (modo 'on_withdrawal').",
        },
        "investment_return_net": {
            "label": "Retorno líquido",
            "unit": "R$",
            "description": "Ganho líquido do mês após imposto.",
        },
        "equity": {
            "label": "Equidade",
            "unit": "R$",
            "description": "Equidade do imóvel (valor - saldo devedor) quando aplicável.",
        },
        "property_value": {
            "label": "Valor do imóvel",
            "unit": "R$",
            "description": "Valor do imóvel no mês (valorização + inflação conforme parâmetros).",
        },
        "outstanding_balance": {
            "label": "Saldo devedor",
            "unit": "R$",
            "description": "Saldo devedor do financiamento (quando aplicável).",
        },
        "installment": {
            "label": "Parcela",
            "unit": "R$",
            "description": "Parcela total do financiamento no mês (inclui amortizações extras quando aplicável).",
        },
        "installment_base": {
            "label": "Parcela (base)",
            "unit": "R$",
            "description": "Parcela base do financiamento no mês, excluindo amortizações extras.",
        },
        "principal_payment": {
            "label": "Amortização",
            "unit": "R$",
            "description": "Parte da parcela que amortiza principal (inclui amortizações extras).",
        },
        "principal_base": {
            "label": "Amortização (base)",
            "unit": "R$",
            "description": "Amortização base do principal, excluindo amortizações extras.",
        },
        "extra_amortization": {
            "label": "Amortização extra",
            "unit": "R$",
            "description": "Parte da amortização do mês que veio de pagamentos extras (cash + FGTS).",
        },
        "extra_amortization_cash": {
            "label": "Amortização extra (cash)",
            "unit": "R$",
            "description": "Pagamentos extras feitos com recursos próprios no mês.",
        },
        "extra_amortization_fgts": {
            "label": "Amortização extra (FGTS)",
            "unit": "R$",
            "description": "Pagamentos extras solicitados e efetivamente aplicados via FGTS no mês.",
        },
        "extra_amortization_bonus": {
            "label": "Amortização extra (Bônus)",
            "unit": "R$",
            "description": "Pagamentos extras feitos com bônus no mês.",
        },
        "extra_amortization_13_salario": {
            "label": "Amortização extra (13º)",
            "unit": "R$",
            "description": "Pagamentos extras feitos com 13º salário no mês.",
        },
        "interest_payment": {
            "label": "Juros",
            "unit": "R$",
            "description": "Parte da parcela referente a juros (quando aplicável).",
        },
    }

    rows: list[dict[str, str]] = []
    for col in columns:
        info = definitions.get(col, {})
        rows.append(
            {
                "field": col,
                "label": info.get("label", ""),
                "unit": info.get("unit", ""),
                "description": info.get("description", ""),
            }
        )
    return pd.DataFrame(rows)


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
    amortizations = cast(Any, input_data.amortizations)

    if input_data.loan_type == "SAC":
        result = simulate_sac_loan(
            loan_value,
            term_months,
            monthly_rate,
            amortizations,
            input_data.inflation_rate,
        )
    else:
        result = simulate_price_loan(
            loan_value,
            term_months,
            monthly_rate,
            amortizations,
            input_data.inflation_rate,
        )
    rows = [
        {
            "month": inst.month,
            "installment": inst.installment,
            "amortization": inst.amortization,
            "interest": inst.interest,
            "extra_amortization": inst.extra_amortization,
            "extra_amortization_cash": getattr(inst, "extra_amortization_cash", 0.0),
            "extra_amortization_fgts": getattr(inst, "extra_amortization_fgts", 0.0),
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
    contributions = cast(Any, input_data.contributions)
    investment_tax = cast(Any, input_data.investment_tax)
    result = compare_scenarios(
        property_value=input_data.property_value,
        down_payment=input_data.down_payment,
        loan_term_years=input_data.loan_term_years,
        monthly_interest_rate=monthly_rate,
        loan_type=input_data.loan_type,
        rent_value=rent_value,
        investment_returns=input_data.investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=input_data.additional_costs,
        inflation_rate=input_data.inflation_rate,
        rent_inflation_rate=input_data.rent_inflation_rate,
        property_appreciation_rate=input_data.property_appreciation_rate,
        monthly_net_income=input_data.monthly_net_income,
        monthly_net_income_adjust_inflation=input_data.monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
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
        buff.write("# --- input ---\n")
        _input_to_flat_frame(input_data).to_csv(buff, index=False)
        buff.write("# --- summary ---\n")
        summary.to_csv(buff, index=False)
        buff.write("\n# --- columns_dictionary ---\n")
        _columns_dictionary(list(monthly_long.columns)).to_csv(buff, index=False)
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
        _input_to_flat_frame(input_data).to_excel(
            writer, index=False, sheet_name="input"
        )
        summary.to_excel(writer, index=False, sheet_name="summary")
        _columns_dictionary(list(monthly_long.columns)).to_excel(
            writer, index=False, sheet_name="columns"
        )
        monthly_long.to_excel(writer, index=False, sheet_name="monthly_long")
        if wide is not None:
            wide.to_excel(writer, index=False, sheet_name="monthly_wide")

        used_sheet_names = {
            "input",
            "summary",
            "columns",
            "monthly_long",
            "monthly_wide",
        }
        for sc in result.scenarios:
            df_sc = pd.DataFrame([m.model_dump() for m in sc.monthly_data])
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
    contributions = cast(Any, input_data.contributions)
    investment_tax = cast(Any, input_data.investment_tax)
    extra_kwargs = cast(
        Any,
        {
            "monthly_net_income_adjust_inflation": input_data.monthly_net_income_adjust_inflation,
        },
    )
    result = enhanced_compare_scenarios(
        property_value=input_data.property_value,
        down_payment=input_data.down_payment,
        loan_term_years=input_data.loan_term_years,
        monthly_interest_rate=monthly_rate,
        loan_type=input_data.loan_type,
        rent_value=rent_value,
        investment_returns=input_data.investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=input_data.additional_costs,
        inflation_rate=input_data.inflation_rate,
        rent_inflation_rate=input_data.rent_inflation_rate,
        property_appreciation_rate=input_data.property_appreciation_rate,
        monthly_net_income=input_data.monthly_net_income,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
        **extra_kwargs,
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
                "roi_including_withdrawals_percentage": sc.metrics.roi_including_withdrawals_percentage,
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
        buff.write("# --- input ---\n")
        _input_to_flat_frame(input_data).to_csv(buff, index=False)
        buff.write("\n# --- columns_dictionary ---\n")
        _columns_dictionary(list(monthly_long.columns)).to_csv(buff, index=False)
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
        _input_to_flat_frame(input_data).to_excel(
            writer, index=False, sheet_name="input"
        )
        _columns_dictionary(list(monthly_long.columns)).to_excel(
            writer, index=False, sheet_name="columns"
        )
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
                    comp_df = comp_df.sort_values("__m", na_position="last").drop(
                        columns=["__m"]
                    )  # type: ignore
                except (TypeError, ValueError):
                    pass
            comp_df.to_excel(writer, index=False, sheet_name="comparative_summary")
        else:
            pd.DataFrame([{"comparative_summary_json": json.dumps(comp)}]).to_excel(
                writer, index=False, sheet_name="comparative_summary"
            )

        used_sheet_names = {
            "input",
            "columns",
            "metrics",
            "monthly_long",
            "monthly_wide",
            "comparative_summary",
        } | set(writer.book.sheetnames)

        for sc in result.scenarios:
            df_sc = pd.DataFrame([m.model_dump() for m in sc.monthly_data])
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
