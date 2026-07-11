'use client';

import * as React from 'react';
import { ArrowLeft, Check, Loader2, Plug } from 'lucide-react';
import type { ConnectorListItem, SourceType } from '@careerstack/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
  cn,
  toast,
} from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import { useConnectors, useCreateConnection } from '@/lib/api/connections';
import { ErrorState } from '@/components/common/states';
import { SOURCE_TYPE_LABELS } from '@/lib/opportunity-options';
import {
  CONNECTABLE_SOURCE_TYPES,
  CONNECTOR_CONFIG_FIELDS,
  CONNECTOR_DESCRIPTIONS,
} from '@/lib/connection-options';

/**
 * Add-a-source wizard (Req 20–22). A two-step dialog: pick a connector type
 * (from `GET /connectors`), then enter the required config (board slug /
 * career-page URL) and submit (`POST /connections`). Accessible dialog with
 * labelled fields, inline help, and full loading/error handling.
 */
export function ConnectionWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const connectors = useConnectors();
  const create = useCreateConnection();

  const [selected, setSelected] = React.useState<SourceType | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [displayName, setDisplayName] = React.useState('');

  // Reset the wizard whenever it is (re)opened.
  React.useEffect(() => {
    if (open) {
      setSelected(null);
      setValues({});
      setDisplayName('');
    }
  }, [open]);

  // Only offer connector types we can create a persistent connection for, and
  // only those the API actually exposes.
  const available = (connectors.data?.connectors ?? []).filter((c) =>
    CONNECTABLE_SOURCE_TYPES.includes(c.sourceType),
  );

  const fields = selected ? (CONNECTOR_CONFIG_FIELDS[selected] ?? []) : [];
  const canSubmit =
    selected !== null && fields.every((f) => (values[f.key] ?? '').trim().length > 0);

  const submit = () => {
    if (!selected || !canSubmit) return;
    const config: Record<string, string> = {};
    for (const field of fields) config[field.key] = values[field.key]!.trim();
    if (displayName.trim()) config.displayName = displayName.trim();

    create.mutate(
      { sourceType: selected, config },
      {
        onSuccess: () => {
          toast.success('Source connected', {
            description: `We’ll start discovering opportunities from ${SOURCE_TYPE_LABELS[selected]} shortly.`,
          });
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error('Couldn’t connect the source', {
            description:
              error instanceof ApiError ? error.message : 'Please check the details and try again.',
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="size-4 text-primary" aria-hidden />
            {selected ? `Connect ${SOURCE_TYPE_LABELS[selected]}` : 'Connect a source'}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? 'Enter the details below and we’ll discover opportunities automatically.'
              : 'Pick where you want to track opportunities from. You can add more later.'}
          </DialogDescription>
        </DialogHeader>

        {selected === null ? (
          connectors.isLoading ? (
            <div className="space-y-2" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : connectors.isError ? (
            <ErrorState
              title="Couldn’t load connector types"
              onRetry={() => void connectors.refetch()}
            />
          ) : (
            <ul className="space-y-2" role="list">
              {available.map((connector: ConnectorListItem) => (
                <li key={connector.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(connector.sourceType)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                      'hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
                      <Plug className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        {connector.displayName || SOURCE_TYPE_LABELS[connector.sourceType]}
                        {connector.isFirstParty ? (
                          <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                            First-party
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {CONNECTOR_DESCRIPTIONS[connector.sourceType] ?? ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {available.length === 0 ? (
                <li className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No connector types are available right now.
                </li>
              ) : null}
            </ul>
          )
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                <Input
                  id={`field-${field.key}`}
                  type={field.type === 'url' ? 'url' : 'text'}
                  inputMode={field.type === 'url' ? 'url' : 'text'}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  autoFocus
                  required
                />
                {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="field-displayName">Label (optional)</Label>
              <Input
                id="field-displayName"
                placeholder="A name to recognise this source"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </form>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {selected !== null ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(null)}
              disabled={create.isPending}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Button>
          ) : (
            <span />
          )}
          {selected !== null ? (
            <Button type="button" onClick={submit} disabled={!canSubmit || create.isPending}>
              {create.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Connecting…
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden />
                  Connect source
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
