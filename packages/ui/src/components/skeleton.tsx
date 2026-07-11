import * as React from 'react';
import { cn } from '../lib/utils';

/** Loading placeholder. Animation is suppressed under prefers-reduced-motion. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
