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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [target, setTarget] = useState<ConditionRow | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const findHost = () => setHost(document.querySelector<HTMLElement>('aside[aria-label="Condition Properties"] header > div:last-child'));
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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
        setTarget(null);
        router.refresh();
      } catch (caught: any) {
        setError(caught?.message || 'Could not delete Condition.');
      }
    });
  };

  if (!host) return null;

  return createPortal(<>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" disabled={locked || isPending} />}>
        <Trash2 />Delete
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Delete draft Condition + takeoffs</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {rows.length ? rows.map(row => <DropdownMenuItem
          key={row.condition_id}
          variant="destructive"
          disabled={row.version_status !== 'draft'}
          onClick={() => { setError(''); setTarget(row); }}
          className="items-start py-2"
        >
          <Trash2 className="mt-0.5" />
          <span className="min-w-0">
            <strong className="block truncate text-xs">{row.code} · {row.name}</strong>
            <small className="block text-[10px] text-muted-foreground">{row.version_status === 'draft' ? 'Draft · linked takeoffs are removed unless shared' : 'Verified · immutable'}</small>
          </span>
        </DropdownMenuItem>) : <div className="px-2 py-3 text-xs text-muted-foreground">No Conditions to delete.</div>}
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog open={Boolean(target)} onOpenChange={open => { if (!open && !isPending) { setTarget(null); setError(''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {target?.code}?</DialogTitle>
          <DialogDescription>
            This permanently removes the draft Condition, its calculated outputs and generated estimate projection, plus takeoff geometry linked only to this Condition. Takeoffs shared with another Condition are preserved. Verified or issued history cannot be deleted.
          </DialogDescription>
        </DialogHeader>
        {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setTarget(null); setError(''); }} disabled={isPending}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={confirmDelete} disabled={isPending || locked}>
            {isPending ? <RefreshCw className="animate-spin" /> : <Trash2 />}
            Delete Condition + takeoffs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>, host);
}
