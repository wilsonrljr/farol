"""Export endpoints (CSV/XLSX)."""

import json
from io import BytesIO, StringIO
from typing import Any, cast

import pandas as pd  # type: ignore[import-untyped]
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ...finance import (
    simulate_price_loan,
    simulate_sac_loan,
)
from ...models import ComparisonInput, LoanSimulationInput
from ..errors import PublicInputError
from ..input_normalization import resolve_monthly_interest_rate
from .simulations import run_basic_comparison, run_enhanced_comparison

router = APIRouter(tags=["exports"])


def _input_to_flat_frame(input_data: ComparisonInput) -> pd.DataFrame:
    payload = input_data.model_dump()

    # Keep complex/nested values readable and stable in a single-cell JSON string.
    for key in (
        "investment_returns",
        "monthly_plan",
        "extra_income_events",
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
            "description": "Parte do aluguel não coberta pelos recursos modelados; em comparação auditável, acumula como passivo.",
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
        "monthly_other_costs": {
            "label": "Outros custos de moradia",
            "unit": "R$",
            "description": "Manutenção, seguro e outros custos mensais exclusivos da ocupação (corrigidos por inflação quando configurado).",
        },
        "monthly_additional_costs": {
            "label": "Custos mensais adicionais",
            "unit": "R$",
            "description": "Condomínio + IPTU + outros custos de moradia do mês.",
        },
        "housing_due": {
            "label": "Moradia devida",
            "unit": "R$",
            "description": "Total obrigatório de moradia do mês. Aluguel + custos mensais (condomínio/IPTU/outros) ou, no financiamento, parcela base + custos. A amortização extra opcional aparece em campo próprio.",
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
            "label": "Cobertura pelo orçamento (legado)",
            "unit": "R$",
            "description": "Alias legado da parcela da moradia coberta pelo orçamento mensal informado.",
        },
        "external_surplus_invested": {
            "label": "Sobra externa investida (legado)",
            "unit": "R$",
            "description": "Campo legado, sem preenchimento no contrato atual.",
        },
        "additional_investment": {
            "label": "Investimento adicional",
            "unit": "R$",
            "description": "Alocação adicional já incorporada ao investimento no mês.",
        },
        "effective_income": {
            "label": "Orçamento efetivo",
            "unit": "R$",
            "description": "Orçamento mensal disponível no mês, corrigido pela inflação somente quando configurado.",
        },
        "effective_net_income": {
            "label": "Salário líquido efetivo",
            "unit": "R$",
            "description": "Salário líquido do mês, corrigido pela inflação quando configurado.",
        },
        "effective_non_housing_expenses": {
            "label": "Outros gastos efetivos",
            "unit": "R$",
            "description": "Gastos mensais fora da moradia, corrigidos quando configurado.",
        },
        "extra_income": {
            "label": "Renda extra",
            "unit": "R$",
            "description": "13º, bônus ou outra renda configurada para o mês.",
        },
        "disposable_surplus": {
            "label": "Sobra disponível",
            "unit": "R$",
            "description": "Renda menos outros gastos e moradia, sem valores negativos.",
        },
        "wealth_allocation": {
            "label": "Destino para patrimônio",
            "unit": "R$",
            "description": "Parte da sobra escolhida para investir ou amortizar.",
        },
        "investment_allocation": {
            "label": "Investimento da sobra",
            "unit": "R$",
            "description": "Parte da alocação patrimonial investida neste cenário.",
        },
        "extra_amortization_allocation": {
            "label": "Amortização da sobra",
            "unit": "R$",
            "description": "Parte da alocação patrimonial usada para amortizar financiamento.",
        },
        "outside_plan_amount": {
            "label": "Fora do plano",
            "unit": "R$",
            "description": "Sobra não alocada; não vira caixa nem patrimônio na simulação.",
        },
        "budget_deficit": {
            "label": "Déficit do orçamento",
            "unit": "R$",
            "description": "Parcela dos gastos obrigatórios que a renda não cobre.",
        },
        "income_surplus_available": {
            "label": "Sobra do orçamento no mês",
            "unit": "R$",
            "description": "Orçamento do mês menos moradia; é informação de capacidade, não aporte automático.",
        },
        "required_cash_outflow": {
            "label": "Recursos necessários",
            "unit": "R$",
            "description": "Outros gastos, moradia, construção de patrimônio e valor fora do plano reconciliados no mês.",
        },
        "funded_from_resources": {
            "label": "Financiado pelos recursos",
            "unit": "R$",
            "description": "Parcela da necessidade mensal coberta pela renda e rendas extras do mês.",
        },
        "residual_cash_balance": {
            "label": "Caixa residual",
            "unit": "R$",
            "description": "Sempre zero no contrato v3: valores não alocados ficam fora da simulação.",
        },
        "cash_reserve_used_for_purchase": {
            "label": "Caixa usado na compra à vista",
            "unit": "R$",
            "description": "Parcela da reserva de caixa sem rendimento consumida no evento de compra à vista.",
        },
        "unfunded_amount": {
            "label": "Déficit do mês",
            "unit": "R$",
            "description": "Necessidade do mês que não foi coberta pelos recursos modelados.",
        },
        "cumulative_unfunded_amount": {
            "label": "Déficit acumulado",
            "unit": "R$",
            "description": "Soma dos déficits mensais, reconhecida como passivo na comparação.",
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
    amortizations = cast("Any", input_data.amortizations)

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
    result = run_basic_comparison(input_data)

    long_rows: list[dict] = []
    for sc in result.scenarios:
        for m in sc.monthly_data:
            row = m.model_dump()
            row["scenario"] = sc.name
            long_rows.append(row)

    if not long_rows:
        raise PublicInputError("No data to export")

    monthly_long = pd.DataFrame(long_rows)

    summary = pd.DataFrame(
        [
            {
                "scenario": sc.name,
                "scenario_type": sc.scenario_type,
                "comparison_status": result.comparison_status,
                "best_scenario": result.best_scenario,
                "best_scenario_type": result.best_scenario_type,
                "calculation_version": result.calculation_version,
                "warnings": json.dumps(result.warnings, ensure_ascii=False),
                "comparison_warnings": json.dumps(
                    sc.comparison_warnings, ensure_ascii=False
                ),
                "total_cost": sc.total_cost,
                "final_equity": sc.final_equity,
                "initial_wealth": sc.initial_wealth,
                "final_wealth": sc.final_wealth,
                "net_worth_change": sc.net_worth_change,
                "final_assets": sc.final_assets,
                "final_liabilities": sc.final_liabilities,
                "residual_cash_balance": sc.residual_cash_balance,
                "is_feasible": sc.is_feasible,
                "first_unfunded_month": sc.first_unfunded_month,
                "total_unfunded_amount": sc.total_unfunded_amount,
                "total_investment_from_income": sc.total_investment_from_income,
                "total_extra_amortization_from_income": sc.total_extra_amortization_from_income,
                "total_outside_plan": sc.total_outside_plan,
                "total_budget_deficit": sc.total_budget_deficit,
                "total_outflows": sc.total_outflows,
                "net_cost": sc.net_cost,
                "opportunity_cost": sc.opportunity_cost,
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
        if shape == "wide" and wide is not None:
            wide.to_excel(writer, index=False, sheet_name="monthly_wide")

        used_sheet_names = {"input", "summary", "columns", "monthly_long"}
        if shape == "wide" and wide is not None:
            used_sheet_names.add("monthly_wide")
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
    result = run_enhanced_comparison(input_data)

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
                "scenario_type": sc.scenario_type,
                "comparison_status": result.comparison_status,
                "best_scenario": result.best_scenario,
                "best_scenario_type": result.best_scenario_type,
                "calculation_version": result.calculation_version,
                "warnings": json.dumps(result.warnings, ensure_ascii=False),
                "comparison_warnings": json.dumps(
                    sc.comparison_warnings, ensure_ascii=False
                ),
                "is_feasible": sc.is_feasible,
                "first_unfunded_month": sc.first_unfunded_month,
                "total_unfunded_amount": sc.total_unfunded_amount,
                "total_investment_from_income": sc.total_investment_from_income,
                "total_extra_amortization_from_income": sc.total_extra_amortization_from_income,
                "total_outside_plan": sc.total_outside_plan,
                "total_budget_deficit": sc.total_budget_deficit,
                "initial_wealth": sc.initial_wealth,
                "final_wealth": sc.final_wealth,
                "net_worth_change": sc.net_worth_change,
                "final_assets": sc.final_assets,
                "final_liabilities": sc.final_liabilities,
                "residual_cash_balance": sc.residual_cash_balance,
                "total_cost": sc.total_cost,
                "final_equity": sc.final_equity,
                "total_consumption": sc.total_consumption,
                "total_outflows": sc.total_outflows,
                "net_cost": sc.net_cost,
                "opportunity_cost": sc.opportunity_cost,
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
        if shape == "wide" and wide is not None:
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
            "comparative_summary",
        } | set(writer.book.sheetnames)
        if shape == "wide" and wide is not None:
            used_sheet_names.add("monthly_wide")

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
