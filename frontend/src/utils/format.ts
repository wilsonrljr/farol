export function money(v: number | null | undefined, locale = 'pt-BR') {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return v.toLocaleString(locale, { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

export function moneyCompact(v: number | null | undefined, locale = 'pt-BR') {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  // Intl compact notation for axes: keeps charts readable.
  const abs = Math.abs(v);
  const maximumFractionDigits = abs >= 1_000_000 ? 1 : abs >= 10_000 ? 0 : 2;
  const formatted = new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits,
  }).format(v);
  return `R$ ${formatted}`;
}

export function percent(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return `${v.toFixed(digits)}%`;
}

export function yearFromMonth(month: number) {
  return Math.max(1, Math.ceil(month / 12));
}

export function formatMonthsYears(months: number | null | undefined) {
  if (!months || months <= 0) return '—';
  const years = months / 12;
  const yearsLabel = Number.isInteger(years)
    ? `${years} anos`
    : `${years.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos`;
  return `${months} meses (${yearsLabel})`;
}

export function formatMonthLabel(month: number) {
  return `Mês ${month} (Ano ${yearFromMonth(month)})`;
}

export function formatYearTickFromMonth(month: number) {
  if (!Number.isFinite(month) || month <= 0) return '';
  if (month === 1) return 'Início';
  if (month % 12 !== 0) return '';
  return `Ano ${Math.max(1, Math.round(month / 12))}`;
}

export function signedMoney(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${money(Math.abs(v))}`;
}

export function signedPercent(v: number | null | undefined, digits = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
}

// Ratio formatting helper for metrics like investment_return_net / withdrawal.
// Example: 1.25 => "1,25×" (means returns covered 125% of withdrawals)
export function ratio(v: number | null | undefined, digits = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}×`;
}

export function ratioAsPercent(v: number | null | undefined, digits = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
