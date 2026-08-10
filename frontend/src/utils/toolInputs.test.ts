import { describe, expect, it } from 'vitest';
import type {
  FIREPlanInput,
  StressTestInput,
  VehicleComparisonInput,
} from '../api/types';
import {
  isVehicleInput,
  validateFireInput,
  validateStressTestInput,
  validateVehicleInput,
} from './toolInputs';

describe('tool input validation', () => {
  it('rejeita uma janela de choque que ultrapassa o horizonte', () => {
    const input: StressTestInput = {
      monthly_income: 5_000,
      monthly_expenses: 4_000,
      initial_emergency_fund: 10_000,
      horizon_months: 12,
      shock_start_month: 10,
      shock_duration_months: 4,
    };

    expect(validateStressTestInput(input).shock_duration_months).toContain('horizonte');
  });

  it('trata zero como valor presente e valida as relações do Coast FIRE', () => {
    const input: FIREPlanInput = {
      monthly_expenses: 0,
      current_portfolio: 0,
      monthly_contribution: 0,
      safe_withdrawal_rate: 4,
      fire_mode: 'coast',
      current_age: 40,
      target_retirement_age: 40,
    };

    const errors = validateFireInput(input);
    expect(errors.monthly_expenses).toBeUndefined();
    expect(errors.current_portfolio).toBeUndefined();
    expect(errors.target_retirement_age).toContain('maior');
  });

  it('rejeita opções de veículo malformadas mesmo quando outra modalidade está ativa', () => {
    const malformed = {
      vehicle_price: 100_000,
      include_cash: true,
      financing: {
        enabled: 'false',
        down_payment: -1,
        term_months: 48,
        annual_interest_rate: 10,
      },
    } as unknown as VehicleComparisonInput;

    const errors = validateVehicleInput(malformed);
    expect(errors['financing.enabled']).toBeDefined();
    expect(errors['financing.down_payment']).toBeDefined();
    expect(isVehicleInput(malformed)).toBe(false);
  });

  it('exige ao menos uma opção e impede entrada maior que o veículo', () => {
    const input: VehicleComparisonInput = {
      vehicle_price: 50_000,
      include_cash: false,
      financing: {
        enabled: false,
        down_payment: 60_000,
        term_months: 48,
        annual_interest_rate: 10,
      },
    };

    const errors = validateVehicleInput(input);
    expect(errors.options).toBeDefined();
    expect(errors['financing.down_payment']).toContain('preço');
  });
});
