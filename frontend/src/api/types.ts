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
  funding_source?: 'cash' | 'fgts' | 'bonus' | '13_salario';
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
  continue_contributions_after_purchase?: boolean; // If true, contributions continue after property purchase
  additional_costs: AdditionalCostsInput;
  inflation_rate?: number | null;
  rent_inflation_rate?: number | null;
  property_appreciation_rate?: number | null;
  monthly_net_income?: number | null; // Monthly net income - housing costs paid from this, surplus invested

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
  installment_base?: number;
  principal_payment?: number;
  principal_base?: number;
  interest_payment?: number;
  extra_amortization?: number;
  extra_amortization_cash?: number;
  extra_amortization_fgts?: number;
  extra_amortization_bonus?: number;
  extra_amortization_13_salario?: number;
  outstanding_balance?: number;
  equity_percentage?: number;

  // Rent/Invest
  rent_due?: number;
  rent_paid?: number;
  rent_shortfall?: number;
  housing_due?: number;
  housing_paid?: number;
  housing_shortfall?: number;
  liquid_wealth?: number;
  cumulative_rent_paid?: number;
  cumulative_investment_gains?: number;
  investment_roi_percentage?: number;

  // Costs
  /** One-off cash allocation (e.g., month-1 down payment invested/paid). */
  initial_allocation?: number;
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

// --- Tools: Stress Test ---

export interface StressTestInput {
  monthly_income: number;
  monthly_expenses: number;
  initial_emergency_fund: number;

  horizon_months?: number;
  income_drop_percentage?: number;
  shock_duration_months?: number;
  shock_start_month?: number;

  annual_inflation_rate?: number | null;
  annual_emergency_fund_yield_rate?: number | null;
}

export interface StressTestMonth {
  month: number;
  income: number;
  expenses: number;
  net_cash_flow: number;
  emergency_fund_balance: number;
  depleted: boolean;
  uncovered_deficit: number;
}

export interface StressTestResult {
  months_survived: number;
  depleted_at_month?: number | null;
  final_emergency_fund_balance: number;
  min_emergency_fund_balance: number;
  total_uncovered_deficit: number;
  monthly_data: StressTestMonth[];
}

export interface EmergencyFundPlanInput {
  monthly_expenses: number;
  initial_emergency_fund: number;
  target_months_of_expenses?: number;
  monthly_contribution?: number;
  horizon_months?: number;
  annual_inflation_rate?: number | null;
  annual_emergency_fund_yield_rate?: number | null;
}

export interface EmergencyFundPlanMonth {
  month: number;
  expenses: number;
  target_amount: number;
  contribution: number;
  investment_return: number;
  emergency_fund_balance: number;
  progress_percent: number;
  achieved: boolean;
}

export interface EmergencyFundPlanResult {
  achieved_at_month?: number | null;
  months_to_goal?: number | null;
  final_emergency_fund_balance: number;
  target_amount_end: number;
  monthly_data: EmergencyFundPlanMonth[];
}

export interface VehicleFinancingConfig {
  enabled?: boolean;
  down_payment?: number;
  term_months?: number;
  annual_interest_rate?: number | null;
  monthly_interest_rate?: number | null;
  loan_type?: 'PRICE' | 'SAC';
}

export interface VehicleConsortiumConfig {
  enabled?: boolean;
  term_months?: number;
  admin_fee_percentage?: number;
  contemplation_month?: number;
}

export interface VehicleSubscriptionConfig {
  enabled?: boolean;
  monthly_fee: number;
}

export interface VehicleComparisonInput {
  vehicle_price: number;
  horizon_months?: number;
  annual_depreciation_rate?: number | null;
  annual_inflation_rate?: number | null;
  monthly_insurance?: number;
  monthly_maintenance?: number;
  monthly_fuel?: number;
  annual_ipva_percentage?: number;
  include_cash?: boolean;
  financing?: VehicleFinancingConfig | null;
  consortium?: VehicleConsortiumConfig | null;
  subscription?: VehicleSubscriptionConfig | null;
}

export interface VehicleComparisonMonth {
  month: number;
  cash_flow: number;
  cumulative_outflow: number;
  asset_value: number;
  net_position: number;
}

export interface VehicleComparisonScenario {
  name: string;
  total_outflows: number;
  final_asset_value: number;
  net_cost: number;
  monthly_data: VehicleComparisonMonth[];
}

export interface VehicleComparisonResult {
  scenarios: VehicleComparisonScenario[];
}

// ---------------------------------------------------------------------------
// FIRE (Financial Independence, Retire Early) Planner
// ---------------------------------------------------------------------------

export type FIREMode = 'traditional' | 'coast' | 'barista';

export interface FIREPlanInput {
  monthly_expenses: number;
  current_portfolio: number;
  monthly_contribution?: number;
  horizon_months?: number;
  annual_return_rate?: number;
  annual_inflation_rate?: number | null;
  safe_withdrawal_rate?: number;
  fire_mode?: FIREMode;
  coast_fire_age?: number | null;
  current_age?: number | null;
  target_retirement_age?: number | null;
  barista_monthly_income?: number | null;
}

export interface FIREPlanMonth {
  month: number;
  age?: number | null;
  portfolio_balance: number;
  monthly_expenses: number;
  contribution: number;
  investment_return: number;
  fire_number: number;
  progress_percent: number;
  monthly_passive_income: number;
  years_of_expenses_covered: number;
  fi_achieved: boolean;
}

export interface FIREPlanResult {
  fi_achieved: boolean;
  fi_month?: number | null;
  fi_age?: number | null;
  years_to_fi?: number | null;
  months_to_fi?: number | null;
  fire_number: number;
  final_portfolio: number;
  final_monthly_passive_income: number;
  total_contributions: number;
  total_investment_returns: number;
  coast_fire_number?: number | null;
  coast_fire_achieved?: boolean | null;
  monthly_data: FIREPlanMonth[];
}

// ---------------------------------------------------------------------------
// Batch Comparison (Multiple Presets)
// ---------------------------------------------------------------------------

export interface BatchComparisonItem {
  preset_id: string;
  preset_name: string;
  input: ComparisonInput;
}

export interface BatchComparisonInput {
  items: BatchComparisonItem[];
}

export interface BatchComparisonResultItem {
  preset_id: string;
  preset_name: string;
  result: EnhancedComparisonResult;
}

export interface BatchComparisonRanking {
  preset_id: string;
  preset_name: string;
  scenario_name: string;
  final_wealth: number;
  net_worth_change: number;
  total_cost: number;
  roi_percentage: number;
}

export interface BatchComparisonResult {
  results: BatchComparisonResultItem[];
  global_best: {
    preset_id: string;
    preset_name: string;
    scenario_name: string;
    final_wealth: number;
  };
  ranking: BatchComparisonRanking[];
}

// ---------------------------------------------------------------------------
// Sensitivity Analysis
// ---------------------------------------------------------------------------

export type SensitivityParameterType =
  | 'annual_interest_rate'
  | 'investment_return_rate'
  | 'down_payment'
  | 'property_value'
  | 'rent_value'
  | 'inflation_rate'
  | 'property_appreciation_rate'
  | 'loan_term_years';

export interface SensitivityRange {
  min_value: number;
  max_value: number;
  steps?: number;
}

export interface SensitivityAnalysisInput {
  base_input: ComparisonInput;
  parameter: SensitivityParameterType;
  range: SensitivityRange;
}

export interface SensitivityScenarioResult {
  name: string;
  final_wealth: number;
  total_cost: number;
  roi_percentage: number;
  net_worth_change: number;
}

export interface SensitivityDataPoint {
  parameter_value: number;
  best_scenario: string;
  scenarios: Record<string, SensitivityScenarioResult>;
}

export interface SensitivityBreakeven {
  parameter_value: number;
  from_scenario: string;
  to_scenario: string;
}

export interface SensitivityAnalysisResult {
  parameter: string;
  parameter_label: string;
  base_value: number;
  data_points: SensitivityDataPoint[];
  breakeven_points: SensitivityBreakeven[];
  best_overall: SensitivityDataPoint;
}
