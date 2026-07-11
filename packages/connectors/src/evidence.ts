/**
 * Evidence helpers that mechanically enforce the no-fabrication rule
 * (Req 34.3, 34.4 / OPP-003.3, OPP-003.4).
 *
 * The single most important convention encoded here: a fact that is *absent*
 * from the source yields `undefined` (the enclosing {@link ParsedOpportunity}
 * field is simply omitted). Connectors call {@link structuredEvidence} /
 * {@link parserEvidence} with the raw source value; if that value is empty the
 * helper returns `undefined`, so a connector cannot accidentally emit a
 * fabricated evidence record for a missing fact.
 */

import type { EvidenceValue, ExtractionMethod } from './types.js';

/** Max length of a stored `sourceText` snippet. */
const MAX_SOURCE_TEXT = 1000;

/** A value is "absent" when it is null/undefined, blank, empty array, or NaN. */
export function isAbsent(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'number') return Number.isNaN(value);
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Trim an arbitrary value into a bounded, human-readable source snippet. */
export function toSourceText(value: unknown): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const text = (raw ?? '').trim();
  return text.length > MAX_SOURCE_TEXT ? `${text.slice(0, MAX_SOURCE_TEXT)}\u2026` : text;
}

/** Options shared by the evidence builders. */
export interface EvidenceOptions {
  /** Exact snippet the value came from. Defaults to the stringified value. */
  sourceText?: string;
  /** Extraction confidence 0..1. Method-specific default when omitted. */
  confidence?: number;
  /** Mark the fact uncertain (OPP-003.4). */
  uncertain?: boolean;
}

interface BuildInput<T> {
  raw: T | null | undefined;
  rawArtifactId: string;
  method: ExtractionMethod;
  defaultConfidence: number;
  options: EvidenceOptions | undefined;
}

function build<T>({
  raw,
  rawArtifactId,
  method,
  defaultConfidence,
  options,
}: BuildInput<T>): EvidenceValue<T> | undefined {
  // No-fabrication gate: absent source values never produce evidence.
  if (isAbsent(raw)) return undefined;

  const value = raw as T;
  const confidence = clampConfidence(options?.confidence ?? defaultConfidence);
  const sourceText = options?.sourceText ?? toSourceText(value);

  const result: EvidenceValue<T> = {
    value,
    evidence: { rawArtifactId, sourceText, method, confidence },
  };
  // Only attach `uncertain` when true (exactOptionalPropertyTypes-friendly).
  if (options?.uncertain === true) result.uncertain = true;
  return result;
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Build a `STRUCTURED_DATA` evidence value from a structured-source field
 * (JSON APIs / JSON-LD). Returns `undefined` when the field is absent.
 */
export function structuredEvidence<T>(
  raw: T | null | undefined,
  rawArtifactId: string,
  options?: EvidenceOptions,
): EvidenceValue<T> | undefined {
  return build({
    raw,
    rawArtifactId,
    method: 'STRUCTURED_DATA',
    defaultConfidence: 1,
    options,
  });
}

/**
 * Build a `PARSER` evidence value for best-effort HTML extraction (manual URL
 * fallback). Defaults to low confidence and `uncertain: true`. Returns
 * `undefined` when the field is absent.
 */
export function parserEvidence<T>(
  raw: T | null | undefined,
  rawArtifactId: string,
  options?: EvidenceOptions,
): EvidenceValue<T> | undefined {
  return build({
    raw,
    rawArtifactId,
    method: 'PARSER',
    defaultConfidence: 0.3,
    options: { uncertain: true, ...options },
  });
}

/**
 * Build a list of `STRUCTURED_DATA` evidence values, dropping absent entries.
 * Returns `undefined` when nothing remains, so the enclosing list field is
 * omitted rather than emitted empty.
 */
export function structuredList(
  raws: ReadonlyArray<string | null | undefined> | null | undefined,
  rawArtifactId: string,
  options?: EvidenceOptions,
): EvidenceValue<string>[] | undefined {
  if (!raws) return undefined;
  const items: EvidenceValue<string>[] = [];
  for (const raw of raws) {
    const ev = structuredEvidence(raw, rawArtifactId, options);
    if (ev) items.push(ev);
  }
  return items.length > 0 ? items : undefined;
}

/**
 * Explicitly represent a fact that is expected but could not be determined
 * (OPP-003.4). Rarely needed — prefer omitting the field entirely. The value is
 * carried for traceability but flagged `uncertain`.
 */
export function uncertainEvidence<T>(
  value: T,
  rawArtifactId: string,
  method: ExtractionMethod,
  options?: EvidenceOptions,
): EvidenceValue<T> {
  return {
    value,
    evidence: {
      rawArtifactId,
      sourceText: options?.sourceText ?? toSourceText(value),
      method,
      confidence: clampConfidence(options?.confidence ?? 0),
    },
    uncertain: true,
  };
}
