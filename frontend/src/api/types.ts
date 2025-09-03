// TypeScript interfaces mirroring backend Pydantic models

export type LoanType = 'SAC' | 'PRICE';

export interface AmortizationInput {
  month?: number; // single event month
  value: number; // amount or percentage
  end_month?: number | null;
  interval_months?: number | null; // recurrence interval
  occurrences?: number | null; // alternative to end_month
  value_type?: 'fixed' | 'percentage';
  inflation_adjust?: boolean; // adjust fixed values by inflation
}

export interface InvestmentReturnInput {
  start_month: number;
  end_month?: number | null;
  annual_rate: number; // percentage
}

export interface AdditionalCostsInput {
  itbi_percentage?: number; // default 2
  deed_percentage?: number; // default 1
  monthly_hoa?: number | null;
  monthly_property_tax?: number | null;
}

export interface LoanSimulationInput {
  property_value: number;
  down_payment: number;
  loan_term_years: number;
  annual_interest_rate?: number | null;
  monthly_interest_rate?: number | null;
  loan_type: LoanType;
  amortizations?: AmortizationInput[];
  additional_costs?: AdditionalCostsInput;
  inflation_rate?: number | null;
  rent_inflation_rate?: number | null;
  property_appreciation_rate?: number | null;
}

export interface LoanInstallment {
  month: number;
  installment: number;
  amortization: number;
  interest: number;
  outstanding_balance: number;
  extra_amortization: number;
}

export interface LoanSimulationResult {
  loan_value: number;
  total_paid: number;
  total_interest_paid: number;
  installments: LoanInstallment[];
  original_term_months?: number | null;
  actual_term_months?: number | null;
  months_saved?: number | null;
  total_extra_amortization?: number | null;
}

export interface ComparisonInput {
  property_value: number;
  down_payment: number;
  loan_term_years: number;
  annual_interest_rate?: number | null;
  monthly_interest_rate?: number | null;
  loan_type: LoanType;
  rent_value?: number | null;
  rent_percentage?: number | null;
  investment_returns: InvestmentReturnInput[];
  amortizations?: AmortizationInput[];
  additional_costs?: AdditionalCostsInput;
  inflation_rate?: number | null;
  rent_inflation_rate?: number | null;
  property_appreciation_rate?: number | null;
  invest_loan_difference?: boolean;
  fixed_monthly_investment?: number | null;
  fixed_investment_start_month?: number | null;
  rent_reduces_investment?: boolean;
  monthly_external_savings?: number | null;
  invest_external_surplus?: boolean;
}

export interface ComparisonScenario {
  name: string;
  total_cost: number;
  final_equity: number;
  total_outflows?: number;
  net_cost?: number;
  monthly_data: Array<{
    month: number;
    cash_flow: number;
    equity?: number;
    investment_balance?: number;
    property_value?: number;
    status?: string;
    additional_investment?: number;
    target_purchase_cost?: number;
    progress_percent?: number;
    shortfall?: number;
    is_milestone?: boolean;
    scenario_type?: string;
    purchase_month?: number;
    purchase_price?: number;
    projected_purchase_month?: number;
    estimated_months_remaining?: number;
  }>;
}

export interface ComparisonResult {
  best_scenario: string;
  scenarios: ComparisonScenario[];
}

export interface ComparisonMetrics {
  total_cost_difference: number;
  total_cost_percentage_difference: number;
  break_even_month: number | null;
  roi_percentage: number;
  roi_adjusted_percentage?: number | null;
  average_monthly_cost: number;
  total_interest_or_rent_paid: number;
  wealth_accumulation: number;
  total_rent_withdrawn_from_investment?: number | null;
  months_with_burn?: number | null;
  average_sustainable_withdrawal_ratio?: number | null;
}

export interface EnhancedComparisonScenario extends ComparisonScenario {
  metrics: ComparisonMetrics;
}

export interface EnhancedComparisonResult {
  best_scenario: string;
  scenarios: EnhancedComparisonScenario[];
  comparative_summary: Record<string, any>;
}
