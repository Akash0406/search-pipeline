'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type {
  CreateRoleProfileRequest,
  RoleProfileDetail,
  SalaryPreference,
} from '@careerstack/contracts';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  toast,
} from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import { useCreateRoleProfile, useUpdateRoleProfile } from '@/lib/api/hooks';
import { ChipInput } from '@/components/forms/chip-input';
import { ToggleMultiSelect } from '@/components/forms/toggle-multiselect';
import {
  CURRENCY_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  SALARY_PERIOD_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
} from '@/lib/profile-options';
import {
  WorkRightsSection,
  valueToWorkRights,
  workRightsToValue,
  type WorkRightsValue,
} from './work-rights-section';
import type { EmploymentType, Seniority, WorkArrangement } from '@careerstack/contracts';

/** Local editor state — salary amounts are raw strings so "unspecified" ≠ 0. */
interface FormState {
  name: string;
  targetTitles: string[];
  excludedTitles: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  locations: string[];
  workArrangements: WorkArrangement[];
  employmentTypes: EmploymentType[];
  seniorityLevels: Seniority[];
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: string;
}

function initialStateFrom(profile?: RoleProfileDetail): FormState {
  return {
    name: profile?.name ?? '',
    targetTitles: profile?.titles.target ?? [],
    excludedTitles: profile?.titles.excluded ?? [],
    requiredSkills: profile?.skills.required ?? [],
    preferredSkills: profile?.skills.preferred ?? [],
    locations: profile?.locations.map((l) => l.value) ?? [],
    workArrangements: profile?.preferences.workArrangements ?? [],
    employmentTypes: profile?.preferences.employmentTypes ?? [],
    seniorityLevels: profile?.preferences.seniorityLevels ?? [],
    salaryMin: profile?.salary?.min !== undefined ? String(profile.salary.min) : '',
    salaryMax: profile?.salary?.max !== undefined ? String(profile.salary.max) : '',
    salaryCurrency: profile?.salary?.currency ?? '',
    salaryPeriod: profile?.salary?.period ?? '',
  };
}

/** Parse a salary amount input: only a valid non-negative number counts (Req 15.3). */
function parseAmount(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Build the salary DTO from inputs; omitted fields stay unspecified (Req 15.3). */
function buildSalary(state: FormState): SalaryPreference {
  const salary: SalaryPreference = {};
  const min = parseAmount(state.salaryMin);
  const max = parseAmount(state.salaryMax);
  if (min !== undefined) salary.min = min;
  if (max !== undefined) salary.max = max;
  if (state.salaryCurrency) salary.currency = state.salaryCurrency;
  if (state.salaryPeriod)
    salary.period = state.salaryPeriod as NonNullable<SalaryPreference['period']>;
  return salary;
}

/** Native select styled to match the design system inputs. */
function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {children}
      </select>
    </div>
  );
}

export function ProfileForm({ profile }: { profile?: RoleProfileDetail }) {
  const router = useRouter();
  const isEdit = Boolean(profile);

  const [state, setState] = React.useState<FormState>(() => initialStateFrom(profile));
  const wrInit = React.useMemo(() => workRightsToValue(profile?.workRights), [profile]);
  const [workRightsEnabled, setWorkRightsEnabled] = React.useState(wrInit.enabled);
  const [workRights, setWorkRights] = React.useState<WorkRightsValue>(wrInit.value);
  const [nameError, setNameError] = React.useState<string | undefined>(undefined);
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  const create = useCreateRoleProfile();
  const update = useUpdateRoleProfile(profile?.id ?? '');
  const pending = create.isPending || update.isPending;

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(undefined);

    const name = state.name.trim();
    if (!name) {
      setNameError('Give your profile a name.');
      document.getElementById('profile-name')?.focus();
      return;
    }
    setNameError(undefined);

    const payload: CreateRoleProfileRequest = {
      name,
      titles: { target: state.targetTitles, excluded: state.excludedTitles },
      skills: { required: state.requiredSkills, preferred: state.preferredSkills },
      locations: state.locations.map((value) => ({ value })),
      preferences: {
        workArrangements: state.workArrangements,
        employmentTypes: state.employmentTypes,
        seniorityLevels: state.seniorityLevels,
      },
      salary: buildSalary(state),
    };
    const workRightsDto = valueToWorkRights(workRightsEnabled, workRights);
    if (workRightsDto) payload.workRights = workRightsDto;

    try {
      if (isEdit && profile) {
        await update.mutateAsync(payload);
        toast.success('Profile updated');
      } else {
        await create.mutateAsync(payload);
        toast.success('Profile created');
      }
      router.push('/app/profiles');
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'We couldn’t save your profile. Please try again.';
      setFormError(message);
      toast.error(message);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile name</CardTitle>
          <CardDescription>A short label so you can tell your directions apart.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={state.name}
              onChange={(e) => patch('name', e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'profile-name-error' : undefined}
              required
            />
            {nameError ? (
              <p id="profile-name-error" role="alert" className="text-xs text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Titles</CardTitle>
          <CardDescription>
            Roles you want to see — and any you&apos;d rather avoid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChipInput
            id="target-titles"
            label="Target titles"
            values={state.targetTitles}
            onChange={(v) => patch('targetTitles', v)}
            placeholder="Add a target title"
          />
          <ChipInput
            id="excluded-titles"
            label="Excluded titles"
            tone="muted"
            values={state.excludedTitles}
            onChange={(v) => patch('excludedTitles', v)}
            placeholder="Add a title to exclude"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>What you bring and what you&apos;d like to use.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChipInput
            id="required-skills"
            label="Required skills"
            values={state.requiredSkills}
            onChange={(v) => patch('requiredSkills', v)}
            placeholder="Add a required skill"
          />
          <ChipInput
            id="preferred-skills"
            label="Preferred skills"
            values={state.preferredSkills}
            onChange={(v) => patch('preferredSkills', v)}
            placeholder="Add a preferred skill"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location &amp; work arrangement</CardTitle>
          <CardDescription>Where and how you want to work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChipInput
            id="locations"
            label="Preferred locations"
            values={state.locations}
            onChange={(v) => patch('locations', v)}
            placeholder="Add a city, region, or country"
          />
          <ToggleMultiSelect
            id="work-arrangements"
            label="Work arrangement"
            options={WORK_ARRANGEMENT_OPTIONS}
            values={state.workArrangements}
            onChange={(v) => patch('workArrangements', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employment type &amp; seniority</CardTitle>
          <CardDescription>The kind and level of role you want.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleMultiSelect
            id="employment-types"
            label="Employment type"
            options={EMPLOYMENT_TYPE_OPTIONS}
            values={state.employmentTypes}
            onChange={(v) => patch('employmentTypes', v)}
          />
          <ToggleMultiSelect
            id="seniority-levels"
            label="Seniority"
            options={SENIORITY_OPTIONS}
            values={state.seniorityLevels}
            onChange={(v) => patch('seniorityLevels', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Salary (optional)</CardTitle>
          <CardDescription>
            Leave any field blank to keep it unspecified — we never assume a value.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="salary-min">Minimum</Label>
            <Input
              id="salary-min"
              type="number"
              inputMode="decimal"
              min={0}
              value={state.salaryMin}
              onChange={(e) => patch('salaryMin', e.target.value)}
              placeholder="e.g. 90000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salary-max">Maximum</Label>
            <Input
              id="salary-max"
              type="number"
              inputMode="decimal"
              min={0}
              value={state.salaryMax}
              onChange={(e) => patch('salaryMax', e.target.value)}
              placeholder="e.g. 130000"
            />
          </div>
          <SelectField
            id="salary-currency"
            label="Currency"
            value={state.salaryCurrency}
            onChange={(v) => patch('salaryCurrency', v)}
          >
            <option value="">Unspecified</option>
            {CURRENCY_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="salary-period"
            label="Period"
            value={state.salaryPeriod}
            onChange={(v) => patch('salaryPeriod', v)}
          >
            <option value="">Unspecified</option>
            {SALARY_PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </SelectField>
        </CardContent>
      </Card>

      <WorkRightsSection
        enabled={workRightsEnabled}
        value={workRights}
        onEnabledChange={setWorkRightsEnabled}
        onValueChange={setWorkRights}
      />

      <Separator />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" asChild>
          <Link href="/app/profiles">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : isEdit ? (
            'Save changes'
          ) : (
            'Create profile'
          )}
        </Button>
      </div>
    </form>
  );
}
