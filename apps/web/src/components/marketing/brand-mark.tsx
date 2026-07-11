import { cn } from '@careerstack/ui';
import { BRAND_NAME } from '@/lib/brand';

/** The product wordmark + radar glyph. Brand name always from config (Req 1.2). */
export function BrandMark({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold', className)}>
      <span
        aria-hidden
        className="inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7" opacity="0.6" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" opacity="0.9" />
        </svg>
      </span>
      {showName ? <span className="tracking-tight">{BRAND_NAME}</span> : null}
      <span className="sr-only">{BRAND_NAME}</span>
    </span>
  );
}
