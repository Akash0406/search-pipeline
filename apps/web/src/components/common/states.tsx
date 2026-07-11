import * as React from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { Button, cn } from '@careerstack/ui';

/** Accessible empty state used by every data surface (Design §8 "Required states"). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Accessible error state with a non-technical message and retry affordance. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn’t load this right now. Please try again.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
