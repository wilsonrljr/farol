import { describe, expect, it } from 'vitest';
import { escapeCsvCell } from './BatchComparisonResults';

describe('escapeCsvCell', () => {
  it('escapa fórmulas, delimitadores e aspas em nomes controlados pelo usuário', () => {
    expect(escapeCsvCell('=HYPERLINK("https://example.test")')).toBe(
      '"\'=HYPERLINK(""https://example.test"")"'
    );
    expect(escapeCsvCell('  =1+1')).toBe('"\'  =1+1"');
    expect(escapeCsvCell('Cenário; principal')).toBe('"Cenário; principal"');
  });

  it('preserva métricas negativas como células numéricas', () => {
    expect(escapeCsvCell(-123.45)).toBe('-123.45');
    expect(escapeCsvCell(42)).toBe('42');
  });

  it('mantém ROI ausente como célula vazia, sem convertê-lo em zero', () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
    expect(escapeCsvCell(Number.NaN)).toBe('""');
  });
});
