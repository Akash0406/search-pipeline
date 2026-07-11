'use client';

import * as React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@careerstack/ui';
import type { DeleteDataCategory } from '@careerstack/contracts';
import { ApiError } from '@/lib/api/client';
import { useDeleteData } from '@/lib/api/privacy';

/** Selectable deletion categories with human labels (Req 50.2). */
const CATEGORIES: { value: DeleteDataCategory; label: string; description: string }[] = [
  {
    value: 'role_profiles',
    label: 'Role profiles',
    description: 'Every role profile you’ve created, including titles, skills, and preferences.',
  },
  {
    value: 'saved_dismissed',
    label: 'Saved & dismissed',
    description: 'Your saved and dismissed opportunity states.',
  },
  {
    value: 'connections',
    label: 'Connected sources',
    description: 'Your source connections and their configuration.',
  },
  {
    value: 'sessions',
    label: 'Other sessions',
    description: 'Sign out everywhere except this device.',
  },
];

/**
 * Delete specific data categories (Req 50.2). The user picks categories then
 * confirms in an explicit dialog before anything is removed (destructive
 * confirmation, Req 14). This is separate from — and lower-friction than —
 * full account deletion.
 */
export function DeleteDataSection() {
  const [selected, setSelected] = React.useState<Set<DeleteDataCategory>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const deleteData = useDeleteData();

  const toggle = (value: DeleteDataCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const chosen = Array.from(selected);

  const onConfirm = () => {
    deleteData.mutate(chosen, {
      onSuccess: (result) => {
        toast.success('Data deleted', {
          description: `Removed: ${result.categories.join(', ')}.`,
        });
        setSelected(new Set());
        setConfirmOpen(false);
      },
      onError: (error) => {
        toast.error('Couldn’t delete the selected data', {
          description: error instanceof ApiError ? error.message : 'Please try again in a moment.',
        });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trash2 className="size-4 text-muted-foreground" aria-hidden />
          Delete specific data
        </CardTitle>
        <CardDescription>
          Remove selected categories of your data without deleting your whole account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="sr-only">Data categories to delete</legend>
          {CATEGORIES.map((category) => (
            <label
              key={category.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
            >
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={selected.has(category.value)}
                onChange={() => toggle(category.value)}
              />
              <span className="text-sm">
                <span className="font-medium">{category.label}</span>
                <span className="block text-xs text-muted-foreground">{category.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <Button
          variant="destructive"
          disabled={chosen.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Delete selected data
        </Button>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected data?</DialogTitle>
            <DialogDescription>
              This permanently removes{' '}
              {chosen.map((c) => CATEGORIES.find((cat) => cat.value === c)?.label ?? c).join(', ')}.
              This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={deleteData.isPending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={deleteData.isPending}>
              {deleteData.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                'Delete data'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
