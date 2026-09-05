'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2 } from 'lucide-react';
import { deleteProjectConcreteCondition } from '@/app/takeoff/[setId]/conditionActions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ConditionRow = {
  condition_id: string;
  condition_version_id: string;
  code: string;
  name: string;
  revision_no: number;
  version_status: string;
};

type Props = {
  setId: string;
  locked: boolean;
  conditions: ConditionRow[];
};

function currentConditions(rows: ConditionRow[]) {
  const latest = new Map<string, ConditionRow>();
  for (const row of rows || []) {
    const prior = latest.get(row.condition_id);
    if (!prior || Number(row.revision_no) > Number(prior.revision_no)) latest.set(row.condition_id, row);
  }
  return [...latest.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export function ConditionDeletionManager({ setId, locked, conditions }: Props) {
  const router = useRouter();
  const rows = useMemo(() => currentConditions(conditions), [conditions]);
  const draftRows = useMemo(() => rows.filter(row => row.version_status === 'draft'), [rows]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedConditionId, setSelectedConditionId] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const findHost = () => setHost(document.querySelector<HTMLElement>('aside[aria-label="Condition Properties"] header > div:last-child'));
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selectedConditionId && draftRows.some(row => row.condition_id === selectedConditionId)) return;
    setSelectedConditionId(draftRows[0]?.condition_id || '');
  }, [draftRows, selectedConditionId]);

  const target = draftRows.find(row => row.condition_id === selectedConditionId) || null;

  const openDeleteDialog = () => {
    if (locked || isPending || !draftRows.length) return;
    setError('');
    setSelectedConditionId(current => draftRows.some(row => row.condition_id === current) ? current : draftRows[0].condition_id);
    setOpen(true);
  };

  const confirmDelete = () => {
    if (!target || locked) return;
    setError('');
    startTransition(async () => {
      try {
        await deleteProjectConcreteCondition({
          takeoffSetId: setId,
          conditionId: target.condition_id,
          deleteLinkedTakeoffs: true,
        });
        setOpen(false);
        setSelectedConditionId('');
        router.refresh();
      } catch (caught: any) {
        setError(caught?.message || 'Could not delete Condition.');
      }
    });
  };

  if (!host) return null;

  return createPortal(<>
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={locked || isPending || !draftRows.length}
      onClick={openDeleteDialog}
      title={draftRows.length ? 'Delete a draft Condition' : 'No draft Conditions can be deleted'}
    >
      <Trash2 />Delete
    </Button>

    <Dialog open={open} onOpenChange={nextOpen => {
      if (!nextOpen && isPending) return;
      setOpen(nextOpen);
      if (!nextOpen) setError('');
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete draft Condition?</DialogTitle>
          <DialogDescription>
            This permanently removes the selected draft Condition, its calculated outputs and generated estimate projection, plus takeoff geometry linked only to this Condition. Takeoffs shared with another Condition are preserved. Verified or issued history cannot be deleted.
          </DialogDescription>
        </DialogHeader>

        <label className="grid gap-1.5 text-xs">
          <span className="font-medium text-foreground">Condition</span>
          <select
            value={selectedConditionId}
            onChange={event => { setSelectedConditionId(event.target.value); setError(''); }}
            disabled={isPending || locked}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {draftRows.map(row => <option key={row.condition_id} value={row.condition_id}>{row.code} · {row.name}</option>)}
          </select>
        </label>

        {target ? <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <strong className="block text-foreground">{target.code} · {target.name}</strong>
          <span>Draft revision R{target.revision_no} · linked takeoffs are removed unless another Condition still uses them.</span>
        </div> : null}

        {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setOpen(false); setError(''); }} disabled={isPending}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={confirmDelete} disabled={isPending || locked || !target}>
            {isPending ? <RefreshCw className="animate-spin" /> : <Trash2 />}
            Delete Condition + takeoffs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>, host);
}
