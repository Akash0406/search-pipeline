'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  decodeExplorerState,
  encodeExplorerState,
  type ExplorerState,
} from '@careerstack/contracts';

/**
 * The URL query string is the single source of truth for explorer filter/sort
 * state (Req 44). This hook decodes the current state from the URL and returns
 * setters that re-encode via the shared codec and push the result back to the
 * URL, so every view stays bookmarkable/shareable and is restored on load.
 *
 * Only filter/sort params are ever encoded (Req 44.3) — the codec guarantees
 * this. `router.replace` (not `push`) is used for filter edits so the back
 * button steps through meaningful navigations rather than every keystroke.
 */
export function useExplorerState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Decode from the live URL. `toString()` gives a stable dependency so the
  // memoized state only changes when the query string actually changes.
  const search = searchParams.toString();
  const state = React.useMemo<ExplorerState>(() => decodeExplorerState(search), [search]);

  const commit = React.useCallback(
    (next: ExplorerState) => {
      const qs = encodeExplorerState(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  /** Set (or clear, when value is undefined/empty) a single filter/sort field. */
  const setField = React.useCallback(
    <K extends keyof ExplorerState>(key: K, value: ExplorerState[K] | undefined) => {
      const next: ExplorerState = { ...state };
      if (value === undefined || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      commit(next);
    },
    [state, commit],
  );

  /** Clear every active filter and sort (reset-all). */
  const clearAll = React.useCallback(() => commit({}), [commit]);

  return { state, setField, commit, clearAll };
}
