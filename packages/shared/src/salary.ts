/**
 * Salary normalization (Design §3). Pure + deterministic.
 *
 * Salary is normalized ONLY when the source actually provided it. Absent
 * fields stay `undefined` — never fabricated (Req 34.3, 34.4).
 */

import { mapSalaryPeriod } from './enum-mappers.js';
import type { ParsedSalary } from '@careerstack/connectors';
import type { SalaryRange } from './types.js';

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Normalize a parsed salary into a canonical {@link SalaryRange}. Returns
 * `undefined` when nothing usable is present, so the caller omits the field.
 */
export function normalizeSalary(parsed: ParsedSalary): SalaryRange | undefined {
  let min = finiteNumber(parsed.min);
  let max = finiteNumber(parsed.max);
  // If both are present but inverted, order them deterministically.
  if (min !== undefined && max !== undefined && min > max) {
    [min, max] = [max, min];
  }
  const currency =
    typeof parsed.currency === 'string' && parsed.currency.trim().length > 0
      ? parsed.currency.trim().toUpperCase()
      : undefined;
  const period = typeof parsed.period === 'string' ? mapSalaryPeriod(parsed.period) : undefined;

  if (min === undefined && max === undefined && currency === undefined && period === undefined) {
    return undefined;
  }

  const range: SalaryRange = {};
  if (min !== undefined) range.min = min;
  if (max !== undefined) range.max = max;
  if (currency !== undefined) range.currency = currency;
  if (period !== undefined) range.period = period;
  return range;
}
