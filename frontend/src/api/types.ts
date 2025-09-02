// TypeScript interfaces mirroring backend Pydantic models

export type LoanType = 'SAC' | 'PRICE';

export interface AmortizationInput {
  month: number;
  value: number;
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
}

export interface ComparisonScenario {
  name: string;
  total_cost: number;
  final_equity: number;
  monthly_data: any[]; // refine later
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
  average_monthly_cost: number;
  total_interest_or_rent_paid: number;
  wealth_accumulation: number;
}

export interface EnhancedComparisonScenario extends ComparisonScenario {
  metrics: ComparisonMetrics;
}

export interface EnhancedComparisonResult {
  best_scenario: string;
  scenarios: EnhancedComparisonScenario[];
  comparative_summary: Record<string, any>;
}
