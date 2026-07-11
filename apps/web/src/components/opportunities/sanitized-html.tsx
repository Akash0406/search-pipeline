import * as React from 'react';
import { cn } from '@careerstack/ui';

/**
 * Render server-sanitized opportunity description HTML (Req 45.1).
 *
 * The API sanitizes description markup on the server (`packages/security` HTML
 * sanitizer, Req 33.4) before it ever reaches the client — raw source markup is
 * never stored or returned. We render that already-safe HTML through a single,
 * clearly-marked mechanism so the trust boundary is explicit and auditable in
 * one place, rather than scattering `dangerouslySetInnerHTML` across the UI.
 *
 * Do NOT pass unsanitized/user-controlled HTML here.
 */
export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-sm leading-relaxed text-foreground',
        '[&_a]:text-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2',
        className,
      )}
      // Safe: `html` is sanitized by the API before delivery (see JSDoc above).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
