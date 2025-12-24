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
  funding_source?: 'cash' | 'fgts';
}

// Mirrors backend ContributionInput (same recurrence fields as AmortizationInput,
// but semantics differ: percentage is over investment balance, not loan balance).
export interface ContributionInput extends AmortizationInput {}

export interface InvestmentReturnInput {
  start_month: number;
  end_month?: number | null;
  annual_rate: number; // percentage
}

export interface InvestmentTaxInput {
  enabled?: boolean;
  mode?: 'monthly' | 'on_withdrawal';
  effective_tax_rate?: number; // percentage
}

export interface FGTSInput {
  initial_balance?: number; // R$
  monthly_contribution?: number; // R$
  annual_yield_rate?: number; // percentage
  use_at_purchase?: boolean;
  max_withdrawal_at_purchase?: number | null; // R$
}

export interface FGTSWithdrawalRecord {
  month: number;
  amount: number;
  requested_amount?: number | null;
  reason: 'purchase' | 'amortization';
  success: boolean;
  error?: 'insufficient_balance' | 'cooldown_active' | null;
  cooldown_ends_at?: number | null;
  balance_after?: number | null;
}

export interface PurchaseBreakdown {
  property_value: number;
  cash_down_payment: number;
  fgts_at_purchase: number;
  total_down_payment: number;
  financed_amount: number;
  upfront_costs: number;
  total_cash_needed: number;
}

export interface FGTSUsageSummary {
  initial_balance: number;
  total_contributions: number;
  total_withdrawn: number;
  withdrawn_at_purchase: number;
  withdrawn_for_amortizations: number;
  blocked_count: number;
  blocked_total_value: number;
  final_balance: number;
  withdrawal_history: FGTSWithdrawalRecord[];
}

export interface AdditionalCostsInput {
  itbi_percentage?: number; // default 2
  deed_percentage?: number; // default 1
  monthly_hoa?: number | null;
  monthly_property_tax?: number | null;
}

export interface ComparisonInput {
  property_value: number;
  down_payment: number;
  total_savings?: number | null; // Total available savings (initial_investment = total_savings - down_payment)
  loan_term_years: number;
  annual_interest_rate?: number | null;
  monthly_interest_rate?: number | null;
  loan_type: LoanType;
  rent_value?: number | null;
  rent_percentage?: number | null;
  investment_returns: InvestmentReturnInput[];
  amortizations?: AmortizationInput[];
  contributions?: ContributionInput[];
  additional_costs: AdditionalCostsInput;
  inflation_rate?: number | null;
  rent_inflation_rate?: number | null;
  property_appreciation_rate?: number | null;
  invest_loan_difference?: boolean;
  fixed_monthly_investment?: number | null;
  fixed_investment_start_month?: number | null;
  rent_reduces_investment?: boolean;
  monthly_external_savings?: number | null;
  invest_external_surplus?: boolean;

  investment_tax?: InvestmentTaxInput | null;
  fgts?: FGTSInput | null;
}

export interface MonthlyRecord {
  month: number;
  cash_flow: number;

  scenario_type?: string;
  status?: string;
  phase?: string;

  equity?: number;
  investment_balance?: number;
  property_value?: number;

  // Loan
  installment?: number;
  principal_payment?: number;
  interest_payment?: number;
  outstanding_balance?: number;
  equity_percentage?: number;

  // Rent/Invest
  rent_paid?: number;
  liquid_wealth?: number;
  cumulative_rent_paid?: number;
  cumulative_investment_gains?: number;
  investment_roi_percentage?: number;

  // Costs
  monthly_hoa?: number;
  monthly_property_tax?: number;
  monthly_additional_costs?: number;
  total_monthly_cost?: number;
  cumulative_payments?: number;
  cumulative_interest?: number;

  // Invest-then-buy
  additional_investment?: number;
  target_purchase_cost?: number;
  progress_percent?: number;
  shortfall?: number;
  is_milestone?: boolean;
  purchase_month?: number;
  purchase_price?: number;
  projected_purchase_month?: number;
  estimated_months_remaining?: number;

  extra_contribution_fixed?: number;
  extra_contribution_percentage?: number;
  extra_contribution_total?: number;

  rent_withdrawal_from_investment?: number;
  remaining_investment_before_return?: number;
  external_cover?: number;
  external_surplus_invested?: number;
  sustainable_withdrawal_ratio?: number;
  burn_month?: boolean;

  // Withdrawals (for tax-on-withdrawal mode)
  investment_withdrawal_gross?: number;
  investment_withdrawal_net?: number;
  investment_withdrawal_realized_gain?: number;
  investment_withdrawal_tax_paid?: number;

  // Tax (approximation)
  investment_return_gross?: number;
  investment_tax_paid?: number;
  investment_return_net?: number;

  // FGTS
  fgts_balance?: number;
  fgts_used?: number;

  // Upfront costs
  upfront_additional_costs?: number;
}

export interface ComparisonScenario {
  name: string;
  total_cost: number;
  final_equity: number;
  // Wealth reporting (added to avoid mixing cashflow vs wealth semantics)
  initial_wealth?: number | null;
  final_wealth?: number | null;
  net_worth_change?: number | null;
  total_consumption?: number | null;
  total_outflows?: number;
  net_cost?: number;
  opportunity_cost?: number | null; // Investment gains from initial capital kept invested
  monthly_data: MonthlyRecord[];
  purchase_breakdown?: PurchaseBreakdown;
  fgts_summary?: FGTSUsageSummary;
}

export interface ComparisonResult {
  best_scenario: string;
  scenarios: ComparisonScenario[];
}

export interface ComparisonMetrics {
  total_cost_difference: number;
  total_cost_percentage_difference: number | null;
  break_even_month: number | null;
  roi_percentage: number;
  roi_including_withdrawals_percentage?: number | null;
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
