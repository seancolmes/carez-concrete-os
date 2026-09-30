'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {ArrowClockwiseRegular as RefreshCw,DeleteRegular as Trash2} from '@fluentui/react-icons';
import { deleteProjectConcreteCondition } from '@/app/takeoff/[setId]/conditionActions';
import {Button,Combobox,Dialog,DialogActions,DialogBody,DialogContent,DialogSurface,DialogTitle,Field,Option} from '@fluentui/react-components';

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
  const rows = useMemo(() => currentConditions(conditions), [conditions]);
  const draftRows = useMemo(() => rows.filter(row => row.version_status === 'draft'), [rows]);
  const [open, setOpen] = useState(false);
  const [selectedConditionId, setSelectedConditionId] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

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
        // The Condition delete can atomically remove the currently selected
        // drawing measurement. A full same-route reload deliberately resets all
        // client drawing selection/tool state before another action can submit
        // the now-deleted measurement ID.
        window.location.reload();
      } catch (caught: any) {
        setError(caught?.message || 'Could not delete Condition.');
      }
    });
  };

  return <>
    <Button
      type="button"
      size="small"
      appearance="outline"
      icon={<Trash2/>}
      disabled={locked || isPending || !draftRows.length}
      onClick={openDeleteDialog}
      title={draftRows.length ? 'Delete a draft Condition' : 'No draft Conditions can be deleted'}
    >
      Delete
    </Button>

    <Dialog open={open} onOpenChange={(_,data) => {
      if (!data.open && isPending) return;
      setOpen(data.open);
      if (!data.open) setError('');
    }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Delete draft Condition?</DialogTitle>
          <DialogContent>
            This permanently removes the selected draft Condition, its calculated outputs and generated estimate projection, plus takeoff geometry linked only to this Condition. Takeoffs shared with another Condition are preserved. Verified or issued history cannot be deleted.
          </DialogContent>

          <Field label="Condition"><Combobox appearance="underline" value={target?`${target.code} · ${target.name}`:''} selectedOptions={selectedConditionId?[selectedConditionId]:[]} placeholder="Select Condition" onOptionSelect={(_,data)=>{setSelectedConditionId(data.optionValue||'');setError('');}} disabled={isPending||locked}>{draftRows.map(row=><Option key={row.condition_id} value={row.condition_id} text={`${row.code} · ${row.name}`}>{row.code} · {row.name}</Option>)}</Combobox></Field>

        {target ? <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <strong className="block text-foreground">{target.code} · {target.name}</strong>
          <span>Draft revision R{target.revision_no} · linked takeoffs are removed unless another Condition still uses them.</span>
        </div> : null}

        {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

        <DialogActions>
          <Button type="button" appearance="outline" onClick={() => { setOpen(false); setError(''); }} disabled={isPending}>Cancel</Button>
          <Button type="button" appearance="primary" style={{backgroundColor:'var(--pt-danger)',borderColor:'var(--pt-danger)',color:'white'}} icon={isPending?<RefreshCw className="animate-spin"/>:<Trash2/>} onClick={confirmDelete} disabled={isPending || locked || !target}>
            Delete Condition + takeoffs
          </Button>
        </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  </>;
}
