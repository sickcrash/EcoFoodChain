// src/utils/numbers.ts

// parse "3.722", "4,5" -> 3722, 4.5
export const parseLocaleNumber = (v: any): number => {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/\./g, '').replace(',', '.').trim();
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

export const formatInt = (n: any, locale: string = 'it-IT') => {
  const num = parseLocaleNumber(n);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(num);
};
