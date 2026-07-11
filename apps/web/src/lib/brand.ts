import { DEFAULT_BRAND_NAME } from '@careerstack/config';

/**
 * Resolve the application's display/brand name from central configuration
 * (Req 1.1–1.3). Reads `NEXT_PUBLIC_BRAND_NAME` so the value is available in
 * both Server and Client Components. When unset, it falls back to the shared
 * default constant and records a configuration warning.
 */
let warned = false;

export function getBrandName(): string {
  const configured = process.env.NEXT_PUBLIC_BRAND_NAME?.trim();
  if (configured) {
    return configured;
  }
  if (!warned) {
    warned = true;
    // Config warning per Req 1.3 (does not throw; falls back to the default).
    console.warn(
      `[config] NEXT_PUBLIC_BRAND_NAME is not set; falling back to the default brand name "${DEFAULT_BRAND_NAME}".`,
    );
  }
  return DEFAULT_BRAND_NAME;
}

/** The resolved brand name, evaluated once per runtime. */
export const BRAND_NAME = getBrandName();
