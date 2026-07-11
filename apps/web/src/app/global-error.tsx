'use client';

/**
 * Global error boundary (Next.js App Router). Renders its own `<html>`/`<body>`
 * because it replaces the root layout when a top-level error occurs. Kept free
 * of app providers/context so it can render even when the tree is broken, and
 * so it prerenders cleanly during `next build`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#fefdfb',
          color: '#1b1f2e',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: '32rem', color: '#64748b', margin: 0 }}>
          An unexpected error occurred. You can try again, and if the problem persists please come
          back in a little while.
        </p>
        {error.digest ? (
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            cursor: 'pointer',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#4f46e5',
            color: '#ffffff',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
