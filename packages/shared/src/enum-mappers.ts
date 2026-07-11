/**
 * Map free-text source values onto the fixed canonical enums (Design §3, §5).
 *
 * No-fabrication rule (Req 34.3, 34.4): when a value cannot be confidently
 * mapped, these return `undefined` so the caller OMITS the field rather than
 * guessing a default.
 */

import type { EmploymentType, SalaryPeriod, Seniority, WorkArrangement } from './types.js';

function norm(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map work-arrangement text → {@link WorkArrangement}, else `undefined`. */
export function mapWorkArrangement(input: string): WorkArrangement | undefined {
  const t = norm(input);
  if (t.length === 0) return undefined;
  if (/(^|\b)(remote|work from home|wfh|anywhere|distributed)(\b|$)/.test(t)) {
    return 'remote';
  }
  if (/hybrid|flexible|part remote/.test(t)) return 'hybrid';
  if (/on ?site|onsite|in office|in person|in the office|office based/.test(t)) {
    return 'on_site';
  }
  return undefined;
}

/** Map employment-type text → {@link EmploymentType}, else `undefined`. */
export function mapEmploymentType(input: string): EmploymentType | undefined {
  const t = norm(input);
  if (t.length === 0) return undefined;
  if (/full ?time|full_time|fulltime|permanent|fte|ongoing/.test(t)) {
    return 'full_time';
  }
  if (/part ?time|part_time|parttime/.test(t)) return 'part_time';
  if (/intern(ship)?|trainee|apprentice/.test(t)) return 'internship';
  if (/contract|contractor|fixed[- ]?term|freelance|consultant/.test(t)) {
    return 'contract';
  }
  if (/temporary|temp|casual|seasonal|locum/.test(t)) return 'temporary';
  return undefined;
}

/** Map seniority text → {@link Seniority}, else `undefined`. */
export function mapSeniority(input: string): Seniority | undefined {
  const t = norm(input);
  if (t.length === 0) return undefined;
  // Order matters: check the most specific / senior signals first.
  if (/\b(intern|internship)\b/.test(t)) return 'intern';
  if (/\b(chief|c[- ]?level|cto|ceo|cfo|coo|vp|vice president|director|head of|head)\b/.test(t)) {
    return 'executive';
  }
  if (/\bprincipal\b/.test(t)) return 'principal';
  if (/\b(lead|staff|manager)\b/.test(t)) return 'lead';
  if (/\b(senior|snr|sr)\b/.test(t)) return 'senior';
  if (/\b(mid|intermediate|mid level|mid-level)\b/.test(t)) return 'mid';
  if (/\b(junior|jr|entry|entry level|graduate|grad|associate)\b/.test(t)) {
    return 'junior';
  }
  return undefined;
}

/** Map a salary-period string → {@link SalaryPeriod}, else `undefined`. */
export function mapSalaryPeriod(input: string): SalaryPeriod | undefined {
  const t = norm(input);
  if (t.length === 0) return undefined;
  if (/hour|hourly|\bhr\b|per hour|ph\b/.test(t)) return 'hour';
  if (/\bday\b|daily|per day/.test(t)) return 'day';
  if (/month|monthly|per month|pm\b/.test(t)) return 'month';
  if (/year|yearly|annum|annual|per annum|\bpa\b|\bp\/a\b/.test(t)) return 'year';
  return undefined;
}
