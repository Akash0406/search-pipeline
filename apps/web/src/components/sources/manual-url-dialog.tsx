'use client';

import * as React from 'react';
import { CheckCircle2, Link as LinkIcon, Loader2 } from 'lucide-react';
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
  toast,
} from '@careerstack/ui';
import { ApiError } from '@/lib/api/client';
import { useSubmitManualUrl } from '@/lib/api/connections';

/** Loose URL check for inline validation before hitting the API. */
function looksLikeUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Save-a-URL flow (Req 23): submit a single job-posting URL for one-off
 * fetch + parse via `POST /sources/manual-url`. Shows submission progress and
 * makes clear that unparseable pages are routed to review rather than dropped.
 */
export function ManualUrlDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const submit = useSubmitManualUrl();
  const [url, setUrl] = React.useState('');
  const [submittedRunId, setSubmittedRunId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setUrl('');
      setSubmittedRunId(null);
    }
  }, [open]);

  const valid = looksLikeUrl(url);

  const onSubmit = () => {
    if (!valid) return;
    submit.mutate(
      { url: url.trim() },
      {
        onSuccess: (result) => {
          setSubmittedRunId(result.runId);
          toast.success('URL submitted', {
            description:
              'We’re fetching and parsing it now. It’ll appear in Opportunities shortly.',
          });
        },
        onError: (error) => {
          toast.error('Couldn’t submit the URL', {
            description:
              error instanceof ApiError ? error.message : 'Please check the link and try again.',
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-4 text-primary" aria-hidden />
            Save a URL
          </DialogTitle>
          <DialogDescription>
            Paste a job-posting URL and we’ll fetch and parse it. Anything we can’t parse is kept
            and sent for review — never discarded.
          </DialogDescription>
        </DialogHeader>

        {submittedRunId ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">Submitted for processing</p>
              <p className="text-muted-foreground">
                We’re working on it in the background. Newly discovered opportunities show up in
                your explorer automatically.
              </p>
            </div>
          </div>
        ) : (
          <form
            className="space-y-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <Label htmlFor="manual-url">Job posting URL</Label>
            <Input
              id="manual-url"
              type="url"
              inputMode="url"
              placeholder="https://company.com/careers/senior-engineer"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              aria-invalid={url.length > 0 && !valid}
            />
            {url.length > 0 && !valid ? (
              <p className="text-xs text-destructive">Enter a valid http(s) URL.</p>
            ) : null}
          </form>
        )}

        <DialogFooter>
          {submittedRunId ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submit.isPending}
              >
                Cancel
              </Button>
              <Button onClick={onSubmit} disabled={!valid || submit.isPending}>
                {submit.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  'Submit URL'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
