export function money(v: number | null | undefined, locale = 'pt-BR') {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return v.toLocaleString(locale, { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

export function percent(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return `${v.toFixed(digits)}%`;
}
