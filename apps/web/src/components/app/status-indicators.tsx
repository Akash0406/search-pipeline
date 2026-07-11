'use client';

import * as React from 'react';
import { Activity, CloudOff, Wifi, WifiOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, cn } from '@careerstack/ui';

/**
 * Online/offline indicator (Design §8 required states; supports the PWA
 * offline surface, Req 2.5). Reflects the browser's connectivity so the shell
 * can communicate degraded states.
 */
export function OnlineIndicator() {
  const [online, setOnline] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Avoid a hydration flash: only surface the offline state once mounted.
  if (!mounted || online) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex"
            aria-label="You are online"
          >
            <Wifi className="size-3.5 text-success" aria-hidden />
            Online
          </span>
        </TooltipTrigger>
        <TooltipContent>Connected</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs text-warning-foreground"
    >
      <WifiOff className="size-3.5" aria-hidden />
      Offline
    </span>
  );
}

/**
 * Data-source health indicator placeholder (Design §8). The live status wires
 * to `/admin/connector-health` + SSE in a later task; for now it renders a
 * neutral, accessible placeholder so the shell layout is complete.
 */
export function SourceHealthIndicator({ status = 'unknown' as const }: { status?: 'ok' | 'degraded' | 'unknown' }) {
  const config = {
    ok: { icon: Activity, label: 'Sources healthy', className: 'text-success' },
    degraded: { icon: CloudOff, label: 'Some sources degraded', className: 'text-warning' },
    unknown: { icon: Activity, label: 'Source status pending', className: 'text-muted-foreground' },
  }[status];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground md:inline-flex"
          aria-label={config.label}
        >
          <Icon className={cn('size-3.5', config.className)} aria-hidden />
          Sources
        </span>
      </TooltipTrigger>
      <TooltipContent>{config.label}</TooltipContent>
    </Tooltip>
  );
}
