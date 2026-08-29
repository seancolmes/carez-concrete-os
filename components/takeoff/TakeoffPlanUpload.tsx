'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { attachPlanToTakeoffSet } from '@/app/takeoff/[setId]/actions';

export function TakeoffPlanUpload({ companyId, takeoffSetId }: { companyId: string; takeoffSetId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  async function submit(fd: FormData) {
    const file = fd.get('file') as File;
    if (!file || file.size === 0) { setMessage('Choose a PDF plan set.'); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setMessage('The drawing workspace currently requires PDF plans.'); return; }
    setBusy(true);
    setMessage('Uploading plan set...');
    let path = '';
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      path = `${companyId}/plans/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from('carez-documents').upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (error) throw error;
      const meta = new FormData();
      meta.set('takeoff_set_id', takeoffSetId);
      meta.set('storage_path', path);
      meta.set('source_filename', file.name);
      meta.set('mime_type', 'application/pdf');
      await attachPlanToTakeoffSet(meta);
      setMessage('Plan set attached. Opening drawing workspace...');
      location.reload();
    } catch (error: any) {
      if (path) await supabase.storage.from('carez-documents').remove([path]);
      setMessage(error?.message || 'Plan upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return <form action={submit} className="form">
    <label className="field"><span>PDF Plan Set</span><input name="file" type="file" accept="application/pdf,.pdf" required /></label>
    <div className="alert info"><strong>Revision rule:</strong> after drawing measurements exist, this source PDF cannot be silently replaced. Revised plans should create the next takeoff/estimate revision so quantity deltas remain auditable.</div>
    {message && <div className="meta">{message}</div>}
    <button className="button" disabled={busy}>{busy ? 'Uploading...' : 'Attach PDF + Open Drawings'}</button>
  </form>;
}
