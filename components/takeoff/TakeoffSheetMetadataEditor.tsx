'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {EditRegular as Pencil} from '@fluentui/react-icons';
import { correctTakeoffSheetMetadata } from '@/app/takeoff/[setId]/sheetMetadataActions';
import {Button,Dialog,DialogActions,DialogBody,DialogContent,DialogSurface,DialogTitle,Field,Input} from '@fluentui/react-components';

type Sheet = {
  id: string;
  page_number: number;
  sheet_number: string | null;
  title: string | null;
  updated_at: string;
};

export function TakeoffSheetMetadataEditor({ takeoffSetId, sheet, locked }: {
  takeoffSetId: string;
  sheet: Sheet | null;
  locked: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [editing, setEditing] = useState<Sheet | null>(null);
  const [sheetNumber, setSheetNumber] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function openEditor() {
    if (!sheet || locked) return;
    setEditing({ ...sheet });
    setSheetNumber(sheet.sheet_number || '');
    setTitle(sheet.title || '');
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError('');
    try {
      await correctTakeoffSheetMetadata({
        takeoffSetId,
        sheetId: editing.id,
        pageNumber: editing.page_number,
        expectedUpdatedAt: editing.updated_at,
        sheetNumber,
        title,
      });
      setEditing(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this sheet label.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <Button
      type="button"
      appearance="outline"
      size="small"
      className="h-8 w-8 shrink-0"
      title="Edit selected sheet label"
      aria-label="Edit selected sheet label"
      disabled={locked || !sheet}
      onClick={openEditor}
    ><Pencil fontSize={14} /></Button>
    <Dialog open={Boolean(editing)} onOpenChange={(_,data)=>{if(!data.open&&!saving)setEditing(null);}}>
      <DialogSurface className="z-[120] sm:max-w-md">
        <DialogBody>
          <DialogTitle>Edit sheet label</DialogTitle>
          <DialogContent>
            <p>Correct the number and title for PDF page {editing?.page_number}. The drawing page and measurements stay in place.</p>
            <form id={`${inputId}-form`} onSubmit={save} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'&&!saving)setEditing(null);}} className="space-y-4 pt-3">
              <Field label="Sheet number"><Input id={`${inputId}-number`} appearance="underline" value={sheetNumber} onChange={(_,data)=>setSheetNumber(data.value)} maxLength={80} autoComplete="off" placeholder="e.g. S101"/></Field>
              <Field label="Sheet title"><Input id={`${inputId}-title`} appearance="underline" value={title} onChange={(_,data)=>setTitle(data.value)} maxLength={180} autoComplete="off" placeholder="e.g. Foundation Plan"/></Field>
              {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
            </form>
          </DialogContent>
          <DialogActions>
            <Button type="button" appearance="outline" disabled={saving} onClick={()=>setEditing(null)}>Cancel</Button>
            <Button type="submit" form={`${inputId}-form`} appearance="primary" disabled={saving}>{saving?'Saving…':'Save label'}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  </>;
}
