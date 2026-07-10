/**
 * Post-auth redirect helpers.
 *
 * `returnTo` values arrive from user input, so only SAFE same-origin relative
 * paths are honored (must start with a single `/`). Anything else falls back to
 * the app home, preventing open-redirect abuse.
 */
export const SIGNIN_PATH = '/signin';
export const APP_HOME_PATH = '/app';

/** Return a safe relative path or the fallback. */
export function safeReturnTo(returnTo: string | undefined, fallback = APP_HOME_PATH): string {
  if (!returnTo) return fallback;
  // Reject absolute URLs and protocol-relative (`//host`) targets.
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return fallback;
  return returnTo;
}

/** Build a sign-in URL carrying a non-technical error code (and resend flag). */
export function signinErrorUrl(error: string, offerResend = false): string {
  const params = new URLSearchParams({ error });
  if (offerResend) params.set('resend', '1');
  return `${SIGNIN_PATH}?${params.toString()}`;
}
