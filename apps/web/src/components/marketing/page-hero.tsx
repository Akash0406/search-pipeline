import * as React from 'react';
import { Container } from './section';

/** Consistent hero band for the public info pages. */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-primary/8 to-transparent"
      />
      <Container className="py-16 sm:py-20">
        <div className="max-w-3xl space-y-4">
          {eyebrow ? (
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="text-pretty text-lg leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </Container>
    </section>
  );
}

/** Readable long-form content column for policy/info pages. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-foreground [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      {children}
    </div>
  );
}
