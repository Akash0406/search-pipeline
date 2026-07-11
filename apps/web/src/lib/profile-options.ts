/**
 * Human-facing labels for the role-profile enum vocabularies (Req 13.2, 14, 15).
 * Values mirror `@careerstack/contracts` enums exactly; labels are the display
 * strings shown in the profile editor.
 */
import type {
  EmploymentType,
  SalaryPeriod,
  Seniority,
  WorkArrangement,
} from '@careerstack/contracts';
import type { ToggleOption } from '@/components/forms/toggle-multiselect';

export const WORK_ARRANGEMENT_OPTIONS: ReadonlyArray<ToggleOption<WorkArrangement>> = [
  { value: 'on_site', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
];

export const EMPLOYMENT_TYPE_OPTIONS: ReadonlyArray<ToggleOption<EmploymentType>> = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
];

export const SENIORITY_OPTIONS: ReadonlyArray<ToggleOption<Seniority>> = [
  { value: 'intern', label: 'Intern' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'principal', label: 'Principal' },
  { value: 'executive', label: 'Executive' },
];

export const SALARY_PERIOD_OPTIONS: ReadonlyArray<{ value: SalaryPeriod; label: string }> = [
  { value: 'hour', label: 'Per hour' },
  { value: 'day', label: 'Per day' },
  { value: 'month', label: 'Per month' },
  { value: 'year', label: 'Per year' },
];

/** Common currency codes offered in the salary editor (free from assumptions). */
export const CURRENCY_OPTIONS: readonly string[] = [
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'INR',
  'SGD',
  'JPY',
];
