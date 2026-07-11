import * as React from 'react';
import { cn } from '@careerstack/ui';

/** Consistent horizontal gutters + max width for the marketing surface. */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-8', className)}>{children}</div>;
}

/** A generously-spaced landing section (Design: generous landing spacing). */
export function Section({
  id,
  className,
  children,
  ariaLabelledby,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
  ariaLabelledby?: string;
}) {
  return (
    <section id={id} aria-labelledby={ariaLabelledby} className={cn('py-16 sm:py-24', className)}>
      {children}
    </section>
  );
}

/** Eyebrow + heading + supporting copy, centered by default. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  align = 'center',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl',
      )}
    >
      {eyebrow ? (
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 id={id} className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
