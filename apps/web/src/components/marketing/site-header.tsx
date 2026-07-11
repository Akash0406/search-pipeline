'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from '@careerstack/ui';
import { PUBLIC_NAV } from '@/lib/nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { BrandMark } from './brand-mark';

/** Sticky public navigation with Sign in + Start free CTAs (Req 2.3). */
export function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const [compact, setCompact] = React.useState(false);

  // Compact the nav after the user scrolls (Design §8, task 15.1). Uses a
  // passive scroll listener — no dependency, and motion is neutralized for
  // users who prefer reduced motion via the global CSS rule (Req 57.3).
  React.useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-compact={compact}
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-colors duration-200',
        compact
          ? 'border-border/70 bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70'
          : 'border-transparent bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40',
      )}
    >
      <nav
        aria-label="Primary"
        className={cn(
          'mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 transition-[height] duration-200 sm:px-8',
          compact ? 'h-14' : 'h-16',
        )}
      >
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandMark className="text-lg" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/signin">Start free</Link>
          </Button>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <BrandMark />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {PUBLIC_NAV.map((item) => (
                  <Button
                    key={item.href}
                    asChild
                    variant="ghost"
                    className="justify-start"
                    onClick={() => setOpen(false)}
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                ))}
                <Button asChild variant="ghost" className="justify-start" onClick={() => setOpen(false)}>
                  <Link href="/security">Security</Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild variant="outline" onClick={() => setOpen(false)}>
                  <Link href="/signin">Sign in</Link>
                </Button>
                <Button asChild onClick={() => setOpen(false)}>
                  <Link href="/signin">Start free</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
