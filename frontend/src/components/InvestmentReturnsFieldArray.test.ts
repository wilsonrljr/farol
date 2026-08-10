import { describe, expect, it } from 'vitest';
import { normalizeInvestmentReturnPeriods } from './InvestmentReturnsFieldArray';

describe('normalizeInvestmentReturnPeriods', () => {
  it('produz uma série contígua iniciada no mês 1 e aberta somente no final', () => {
    const result = normalizeInvestmentReturnPeriods([
      { start_month: 5, end_month: 10, annual_rate: 8 },
      { start_month: 99, end_month: 20, annual_rate: 9 },
      { start_month: 40, end_month: 80, annual_rate: 10 },
    ]);

    expect(result).toEqual([
      { start_month: 1, end_month: 10, annual_rate: 8 },
      { start_month: 11, end_month: 20, annual_rate: 9 },
      { start_month: 21, end_month: null, annual_rate: 10 },
    ]);
  });

  it('não muta os períodos recebidos e fecha intervalos intermediários vazios', () => {
    const input = [
      { start_month: 1, end_month: null, annual_rate: -5 },
      { start_month: 20, end_month: null, annual_rate: 7 },
    ];

    const result = normalizeInvestmentReturnPeriods(input);

    expect(input[0].end_month).toBeNull();
    expect(result[0].end_month).toBe(12);
    expect(result[1].start_month).toBe(13);
    expect(result[1].end_month).toBeNull();
  });
});
