import type {
  EmergencyFundPlanInput,
  FIREPlanInput,
  StressTestInput,
  VehicleComparisonInput,
} from '../api/types';
import { MAX_FINANCIAL_AMOUNT, MAX_MONTHLY_INTEREST_RATE } from '../constants/limits';

export type InputValidationErrors = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function numberInRange(
  errors: InputValidationErrors,
  path: string,
  value: unknown,
  options: {
    min: number;
    max: number;
    optional?: boolean;
    integer?: boolean;
    exclusiveMin?: boolean;
    message: string;
  }
) {
  if (options.optional && (value === undefined || value === null)) return;
  const validNumber = typeof value === 'number' && Number.isFinite(value);
  const aboveMinimum = options.exclusiveMin
    ? validNumber && value > options.min
    : validNumber && value >= options.min;
  if (
    !validNumber ||
    !aboveMinimum ||
    value > options.max ||
    (options.integer && !Number.isInteger(value))
  ) {
    errors[path] = options.message;
  }
}

function optionalBoolean(
  errors: InputValidationErrors,
  path: string,
  value: unknown
) {
  if (value !== undefined && value !== null && typeof value !== 'boolean') {
    errors[path] = 'A opção informada é inválida.';
  }
}

export function firstInputError(errors: InputValidationErrors): string | null {
  return Object.values(errors)[0] ?? null;
}

export function validateStressTestInput(input: StressTestInput): InputValidationErrors {
  const errors: InputValidationErrors = {};
  numberInRange(errors, 'monthly_income', input.monthly_income, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    message: 'A renda mensal deve ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'monthly_expenses', input.monthly_expenses, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    message: 'Os gastos mensais devem ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'initial_emergency_fund', input.initial_emergency_fund, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    message: 'A reserva atual deve ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'horizon_months', input.horizon_months, {
    min: 1,
    max: 600,
    integer: true,
    optional: true,
    message: 'O horizonte deve ser um número inteiro entre 1 e 600 meses.',
  });
  numberInRange(errors, 'income_drop_percentage', input.income_drop_percentage, {
    min: 0,
    max: 100,
    optional: true,
    message: 'A queda de renda deve ficar entre 0% e 100%.',
  });
  numberInRange(errors, 'shock_duration_months', input.shock_duration_months, {
    min: 0,
    max: 600,
    integer: true,
    optional: true,
    message: 'A duração do choque deve ser um número inteiro entre 0 e 600 meses.',
  });
  numberInRange(errors, 'shock_start_month', input.shock_start_month, {
    min: 1,
    max: 600,
    integer: true,
    optional: true,
    message: 'O início do choque deve ser um número inteiro entre 1 e 600.',
  });
  numberInRange(errors, 'annual_inflation_rate', input.annual_inflation_rate, {
    min: -100,
    max: 1000,
    optional: true,
    message: 'A inflação anual deve ficar entre -100% e 1.000%.',
  });
  numberInRange(
    errors,
    'annual_emergency_fund_yield_rate',
    input.annual_emergency_fund_yield_rate,
    {
      min: -100,
      max: 1000,
      exclusiveMin: true,
      optional: true,
      message: 'O rendimento anual deve ser maior que -100% e até 1.000%.',
    }
  );

  const horizon = input.horizon_months ?? 60;
  const start = input.shock_start_month ?? 1;
  const duration = input.shock_duration_months ?? 6;
  if (Number.isInteger(start) && start > horizon) {
    errors.shock_start_month = 'O choque precisa começar dentro do horizonte simulado.';
  } else if (Number.isInteger(duration) && duration > 0 && start + duration - 1 > horizon) {
    errors.shock_duration_months = 'A janela do choque precisa terminar dentro do horizonte simulado.';
  }
  return errors;
}

export function isStressTestInput(value: unknown): value is StressTestInput {
  return isRecord(value) && Object.keys(validateStressTestInput(value as unknown as StressTestInput)).length === 0;
}

export function validateEmergencyFundInput(
  input: EmergencyFundPlanInput
): InputValidationErrors {
  const errors: InputValidationErrors = {};
  numberInRange(errors, 'monthly_expenses', input.monthly_expenses, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    message: 'Os gastos mensais devem ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'initial_emergency_fund', input.initial_emergency_fund, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    message: 'A reserva atual deve ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'target_months_of_expenses', input.target_months_of_expenses, {
    min: 1,
    max: 60,
    integer: true,
    optional: true,
    message: 'A meta deve ser um número inteiro entre 1 e 60 meses de gastos.',
  });
  numberInRange(errors, 'monthly_contribution', input.monthly_contribution, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    optional: true,
    message: 'O aporte mensal deve ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'horizon_months', input.horizon_months, {
    min: 1,
    max: 600,
    integer: true,
    optional: true,
    message: 'O horizonte deve ser um número inteiro entre 1 e 600 meses.',
  });
  numberInRange(errors, 'annual_inflation_rate', input.annual_inflation_rate, {
    min: -100,
    max: 1000,
    optional: true,
    message: 'A inflação anual deve ficar entre -100% e 1.000%.',
  });
  numberInRange(
    errors,
    'annual_emergency_fund_yield_rate',
    input.annual_emergency_fund_yield_rate,
    {
      min: -100,
      max: 1000,
      exclusiveMin: true,
      optional: true,
      message: 'O rendimento anual deve ser maior que -100% e até 1.000%.',
    }
  );
  return errors;
}

export function isEmergencyFundInput(value: unknown): value is EmergencyFundPlanInput {
  return isRecord(value) && Object.keys(validateEmergencyFundInput(value as unknown as EmergencyFundPlanInput)).length === 0;
}

export function validateFireInput(input: FIREPlanInput): InputValidationErrors {
  const errors: InputValidationErrors = {};
  numberInRange(errors, 'monthly_expenses', input.monthly_expenses, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    message: 'Os gastos mensais devem ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'current_portfolio', input.current_portfolio, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    message: 'O patrimônio atual deve ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'monthly_contribution', input.monthly_contribution, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    optional: true,
    message: 'O aporte mensal deve ficar entre zero e R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'horizon_months', input.horizon_months, {
    min: 1,
    max: 600,
    integer: true,
    optional: true,
    message: 'O horizonte deve ser um número inteiro entre 1 e 600 meses.',
  });
  numberInRange(errors, 'annual_return_rate', input.annual_return_rate, {
    min: -50,
    max: 100,
    optional: true,
    message: 'O retorno real anual deve ficar entre -50% e 100%.',
  });
  numberInRange(errors, 'annual_inflation_rate', input.annual_inflation_rate, {
    min: -100,
    max: 1000,
    optional: true,
    message: 'A inflação de referência deve ficar entre -100% e 1.000%.',
  });
  numberInRange(errors, 'safe_withdrawal_rate', input.safe_withdrawal_rate, {
    min: 0,
    max: 20,
    exclusiveMin: true,
    optional: true,
    message: 'A taxa de retirada segura deve ser maior que 0% e até 20%.',
  });

  const mode = input.fire_mode ?? 'traditional';
  if (!['traditional', 'coast', 'barista'].includes(mode)) {
    errors.fire_mode = 'Selecione um modo FIRE válido.';
  }
  for (const [path, value] of [
    ['current_age', input.current_age],
    ['target_retirement_age', input.target_retirement_age],
    ['coast_fire_age', input.coast_fire_age],
  ] as const) {
    numberInRange(errors, path, value, {
      min: 18,
      max: 100,
      integer: true,
      optional: true,
      message: 'As idades devem ser números inteiros entre 18 e 100 anos.',
    });
  }
  numberInRange(errors, 'barista_monthly_income', input.barista_monthly_income, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    optional: true,
    message: 'A renda parcial deve ficar entre zero e R$ 1 quadrilhão.',
  });

  if (mode === 'coast') {
    if (input.current_age == null) {
      errors.current_age = 'Informe sua idade atual para calcular o Coast FIRE.';
    } else {
      const targetAge = input.target_retirement_age ?? 65;
      if (targetAge <= input.current_age) {
        errors.target_retirement_age = 'A idade de aposentadoria deve ser maior que a idade atual.';
      }
      if (
        input.coast_fire_age != null &&
        (input.coast_fire_age < input.current_age || input.coast_fire_age > targetAge)
      ) {
        errors.coast_fire_age = 'A idade para Coast deve ficar entre a idade atual e a aposentadoria.';
      }
    }
  }
  if (mode === 'barista' && input.barista_monthly_income == null) {
    errors.barista_monthly_income = 'Informe a renda parcial para calcular o Barista FIRE.';
  }
  return errors;
}

export function isFireInput(value: unknown): value is FIREPlanInput {
  return isRecord(value) && Object.keys(validateFireInput(value as unknown as FIREPlanInput)).length === 0;
}

export function validateVehicleInput(input: VehicleComparisonInput): InputValidationErrors {
  const errors: InputValidationErrors = {};
  optionalBoolean(errors, 'include_cash', input.include_cash);
  numberInRange(errors, 'vehicle_price', input.vehicle_price, {
    min: 0,
    max: MAX_FINANCIAL_AMOUNT,
    exclusiveMin: true,
    message: 'O preço do veículo deve ser maior que zero e até R$ 1 quadrilhão.',
  });
  numberInRange(errors, 'horizon_months', input.horizon_months, {
    min: 1,
    max: 240,
    integer: true,
    optional: true,
    message: 'O horizonte deve ser um número inteiro entre 1 e 240 meses.',
  });
  numberInRange(errors, 'annual_depreciation_rate', input.annual_depreciation_rate, {
    min: 0,
    max: 100,
    optional: true,
    message: 'A depreciação anual deve ficar entre 0% e 100%.',
  });
  numberInRange(errors, 'annual_inflation_rate', input.annual_inflation_rate, {
    min: -100,
    max: 1000,
    optional: true,
    message: 'A inflação anual deve ficar entre -100% e 1.000%.',
  });
  for (const [path, value, label] of [
    ['monthly_insurance', input.monthly_insurance, 'O seguro mensal'],
    ['monthly_maintenance', input.monthly_maintenance, 'A manutenção mensal'],
    ['monthly_fuel', input.monthly_fuel, 'O combustível mensal'],
  ] as const) {
    numberInRange(errors, path, value, {
      min: 0,
      max: MAX_FINANCIAL_AMOUNT,
      optional: true,
      message: `${label} deve ficar entre zero e R$ 1 quadrilhão.`,
    });
  }
  numberInRange(errors, 'annual_ipva_percentage', input.annual_ipva_percentage, {
    min: 0,
    max: 50,
    optional: true,
    message: 'O IPVA anual deve ficar entre 0% e 50%.',
  });

  const financing = input.financing;
  if (financing != null && !isRecord(financing)) {
    errors.financing = 'A configuração do financiamento é inválida.';
  } else if (financing != null) {
    const config = financing as NonNullable<VehicleComparisonInput['financing']>;
    optionalBoolean(errors, 'financing.enabled', config.enabled);
    numberInRange(errors, 'financing.down_payment', config.down_payment, {
      min: 0,
      max: MAX_FINANCIAL_AMOUNT,
      optional: true,
      message: 'A entrada do financiamento deve ficar entre zero e R$ 1 quadrilhão.',
    });
    if ((config.down_payment ?? 0) > input.vehicle_price) {
      errors['financing.down_payment'] = 'A entrada não pode superar o preço do veículo.';
    }
    numberInRange(errors, 'financing.term_months', config.term_months, {
      min: 1,
      max: 120,
      integer: true,
      optional: true,
      message: 'O prazo do financiamento deve ser um inteiro entre 1 e 120 meses.',
    });
    const hasAnnual = config.annual_interest_rate != null;
    const hasMonthly = config.monthly_interest_rate != null;
    if ((config.enabled ?? true) === true && hasAnnual === hasMonthly) {
      errors['financing.annual_interest_rate'] = 'Informe apenas a taxa anual ou apenas a mensal.';
    }
    numberInRange(errors, 'financing.annual_interest_rate', config.annual_interest_rate, {
      min: 0,
      max: 1000,
      optional: true,
      message: 'A taxa anual do financiamento deve ficar entre 0% e 1.000%.',
    });
    numberInRange(errors, 'financing.monthly_interest_rate', config.monthly_interest_rate, {
      min: 0,
      max: MAX_MONTHLY_INTEREST_RATE,
      optional: true,
      message: 'A taxa mensal do financiamento deve ficar entre 0% e 100%.',
    });
    if (config.loan_type != null && !['PRICE', 'SAC'].includes(config.loan_type)) {
      errors['financing.loan_type'] = 'Selecione um sistema de amortização válido.';
    }
  }

  const consortium = input.consortium;
  if (consortium != null && !isRecord(consortium)) {
    errors.consortium = 'A configuração do consórcio é inválida.';
  } else if (consortium != null) {
    const config = consortium as NonNullable<VehicleComparisonInput['consortium']>;
    optionalBoolean(errors, 'consortium.enabled', config.enabled);
    numberInRange(errors, 'consortium.term_months', config.term_months, {
      min: 1,
      max: 120,
      integer: true,
      optional: true,
      message: 'O prazo do consórcio deve ser um inteiro entre 1 e 120 meses.',
    });
    numberInRange(errors, 'consortium.admin_fee_percentage', config.admin_fee_percentage, {
      min: 0,
      max: 200,
      optional: true,
      message: 'A taxa de administração deve ficar entre 0% e 200%.',
    });
    numberInRange(errors, 'consortium.contemplation_month', config.contemplation_month, {
      min: 1,
      max: 120,
      integer: true,
      optional: true,
      message: 'O mês de contemplação deve ser um inteiro entre 1 e 120.',
    });
    if ((config.contemplation_month ?? 1) > (config.term_months ?? 60)) {
      errors['consortium.contemplation_month'] = 'A contemplação não pode ocorrer depois do fim do consórcio.';
    }
  }

  const subscription = input.subscription;
  if (subscription != null && !isRecord(subscription)) {
    errors.subscription = 'A configuração da assinatura é inválida.';
  } else if (subscription != null) {
    const config = subscription as NonNullable<VehicleComparisonInput['subscription']>;
    optionalBoolean(errors, 'subscription.enabled', config.enabled);
    numberInRange(errors, 'subscription.monthly_fee', config.monthly_fee, {
      min: 0,
      max: MAX_FINANCIAL_AMOUNT,
      message: 'A mensalidade da assinatura deve ficar entre zero e R$ 1 quadrilhão.',
    });
  }

  const hasEnabledOption =
    (input.include_cash ?? true) === true ||
    (financing != null && (financing.enabled ?? true) === true) ||
    (consortium != null && (consortium.enabled ?? true) === true) ||
    (subscription != null && (subscription.enabled ?? true) === true);
  if (!hasEnabledOption) {
    errors.options = 'Selecione ao menos uma modalidade para comparar.';
  }
  return errors;
}

export function isVehicleInput(value: unknown): value is VehicleComparisonInput {
  return isRecord(value) && Object.keys(validateVehicleInput(value as unknown as VehicleComparisonInput)).length === 0;
}
