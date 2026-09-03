'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Copy, FilePlus2, LayoutTemplate, PencilLine, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ASSEMBLY_TEMPLATES } from '@/lib/takeoff/assemblyTemplates';
import {
  createAssemblyDraft,
  createAssemblyFromTemplate,
  createAssemblyRevision,
  duplicateAssemblyDraft,
} from '@/app/takeoff/[setId]/assemblyActions';
import { AssemblyBuilderProvider } from './AssemblyBuilderContext';
import { AssemblyBuilderComposer } from './AssemblyBuilderComposer';
import { TakeoffDrawingWorkspace } from './TakeoffDrawingWorkspace';
import styles from './TakeoffAssemblyBuilderShell.module.css';

type BuilderData = {
  assemblies: any[];
  versions: any[];
  variables: any[];
  components: any[];
  children: any[];
  bindings: any[];
  folders: any[];
  measurements: any[];
};

type Props = {
  setId: string;
  workspaceProps: any;
  builderData: BuilderData;
};

type DialogMode = 'blank' | 'templates' | 'existing';

const latestByAssembly = (versions: any[]) => {
  const map = new Map<string, any[]>();
  for (const version of versions) {
    const list = map.get(version.assembly_id) || [];
    list.push(version);
    map.set(version.assembly_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => Number(b.version_no || 0) - Number(a.version_no || 0));
  return map;
};

export function TakeoffAssemblyBuilderShell({ setId, workspaceProps, builderData }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('blank');
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [blank, setBlank] = useState({ code: '', name: '', category: 'Foundations', primaryMeasurement: 'LF' as 'LF' | 'SF' | 'EA' | 'CY', description: '' });
  const [duplicate, setDuplicate] = useState<{ sourceVersionId: string; code: string; name: string } | null>(null);

  const versionsByAssembly = useMemo(() => latestByAssembly(builderData.versions), [builderData.versions]);
  const activeVersion = builderData.versions.find(version => version.id === activeVersionId) || null;

  useEffect(() => {
    if (activeVersionId && !activeVersion && !isPending) {
      const timer = window.setTimeout(() => router.refresh(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [activeVersionId, activeVersion, isPending, router]);

  const enterVersion = (versionId: string) => {
    setActiveVersionId(versionId);
    setOpen(true);
    setDialogOpen(false);
    setFocus(false);
    setMessage('');
  };

  const run = (work: () => Promise<any>, onDone: (result: any) => void, pendingLabel: string) => {
    setMessage(pendingLabel);
    startTransition(async () => {
      try {
        const result = await work();
        onDone(result);
        router.refresh();
      } catch (error: any) {
        setMessage(error?.message || 'Unable to complete assembly action.');
      }
    });
  };

  const openCreate = () => {
    setDialogMode('blank');
    setDuplicate(null);
    setDialogOpen(true);
  };
  const openLibrary = () => {
    setDialogMode('existing');
    setDuplicate(null);
    setDialogOpen(true);
  };
  const closeBuilder = () => {
    setFocus(false);
    setOpen(false);
  };

  return <AssemblyBuilderProvider value={{ open, focus, openCreate, openLibrary, closeBuilder }}>
    <div className={`${styles.shell} ${focus ? styles.focusShell : ''}`}>
      <TakeoffDrawingWorkspace {...workspaceProps} />

      {open && activeVersionId && <div className={focus ? styles.focusLayer : styles.builderLayer}>
        <AssemblyBuilderComposer
          setId={setId}
          versionId={activeVersionId}
          builderData={builderData}
          focus={focus}
          onFocusChange={setFocus}
          onClose={closeBuilder}
          onCreateAnother={openCreate}
        />
      </div>}

      {dialogOpen && <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
        <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Assembly Builder start">
          <header className={styles.dialogHeader}>
            <div>
              <span>Assembly Builder</span>
              <strong>Create or continue a concrete recipe</strong>
            </div>
            <button type="button" className={styles.iconButton} onClick={() => setDialogOpen(false)} aria-label="Close"><X size={17} /></button>
          </header>

          <nav className={styles.dialogTabs} aria-label="Assembly start options">
            <button type="button" className={dialogMode === 'blank' ? styles.activeTab : ''} onClick={() => { setDialogMode('blank'); setDuplicate(null); }}><FilePlus2 size={15} />Blank</button>
            <button type="button" className={dialogMode === 'templates' ? styles.activeTab : ''} onClick={() => { setDialogMode('templates'); setDuplicate(null); }}><LayoutTemplate size={15} />Templates</button>
            <button type="button" className={dialogMode === 'existing' ? styles.activeTab : ''} onClick={() => { setDialogMode('existing'); setDuplicate(null); }}><Copy size={15} />Company library</button>
          </nav>

          <div className={styles.dialogBody}>
            {dialogMode === 'blank' && <div className={styles.blankForm}>
              <div className={styles.dialogIntro}><strong>Start clean.</strong><span>Define the recipe identity here. Properties, resources, formulas, and child assemblies are built in the workstation—not in this dialog.</span></div>
              <div className={styles.fieldGrid}>
                <label><span>Assembly code</span><input value={blank.code} onChange={event => setBlank(value => ({ ...value, code: event.target.value.toUpperCase() }))} placeholder="FTG-STRIP" /></label>
                <label className={styles.wide}><span>Assembly name</span><input value={blank.name} onChange={event => setBlank(value => ({ ...value, name: event.target.value }))} placeholder="Strip Footing" /></label>
                <label><span>Category</span><input value={blank.category} onChange={event => setBlank(value => ({ ...value, category: event.target.value }))} /></label>
                <label><span>Takeoff measurement</span><select value={blank.primaryMeasurement} onChange={event => setBlank(value => ({ ...value, primaryMeasurement: event.target.value as any }))}><option value="LF">Linear · LF</option><option value="SF">Area · SF</option><option value="EA">Count · EA</option><option value="CY">Volume · CY</option></select></label>
                <label className={styles.full}><span>Description <em>optional</em></span><textarea value={blank.description} onChange={event => setBlank(value => ({ ...value, description: event.target.value }))} rows={2} placeholder="What this assembly represents and when your company uses it." /></label>
              </div>
              <footer className={styles.dialogFooter}><span>{message}</span><button type="button" className={styles.primaryButton} disabled={isPending || !blank.code.trim() || !blank.name.trim()} onClick={() => run(
                () => createAssemblyDraft(setId, blank),
                result => enterVersion(result.assembly_version_id),
                'Creating draft…',
              )}><Plus size={15} />Create draft</button></footer>
            </div>}

            {dialogMode === 'templates' && <div>
              <div className={styles.dialogIntro}><strong>Start from structure, not assumptions.</strong><span>Templates copy a concrete recipe pattern into a company-owned draft. They do not promote prices, production rates, waste, or means and methods into company truth.</span></div>
              <div className={styles.templateGrid}>{ASSEMBLY_TEMPLATES.map(template => <article key={template.id} className={styles.templateCard}>
                <div className={styles.templateIcon}>{template.primaryMeasurement}</div>
                <div className={styles.templateCopy}><span>{template.category}</span><strong>{template.name}</strong><p>{template.description}</p><small>{template.properties.length} properties · {template.components.length} resource outputs</small></div>
                <button type="button" disabled={isPending} onClick={() => run(
                  () => createAssemblyFromTemplate(setId, { templateId: template.id }),
                  result => enterVersion(result.assembly_version_id),
                  `Copying ${template.name} template…`,
                )}>Use template</button>
              </article>)}</div>
              <footer className={styles.dialogFooter}><span>{message}</span></footer>
            </div>}

            {dialogMode === 'existing' && <div>
              <div className={styles.dialogIntro}><strong>Company assemblies.</strong><span>Continue a draft, create a revision from a published version, or duplicate a recipe into a new company-owned assembly.</span></div>
              {duplicate ? <div className={styles.duplicateForm}>
                <button type="button" className={styles.backButton} onClick={() => setDuplicate(null)}>← Back to library</button>
                <strong>Duplicate assembly</strong>
                <div className={styles.fieldGrid}>
                  <label><span>New code</span><input value={duplicate.code} onChange={event => setDuplicate(value => value ? { ...value, code: event.target.value.toUpperCase() } : value)} /></label>
                  <label className={styles.wide}><span>New name</span><input value={duplicate.name} onChange={event => setDuplicate(value => value ? { ...value, name: event.target.value } : value)} /></label>
                </div>
                <footer className={styles.dialogFooter}><span>{message}</span><button type="button" className={styles.primaryButton} disabled={isPending || !duplicate.code.trim() || !duplicate.name.trim()} onClick={() => run(
                  () => duplicateAssemblyDraft(setId, duplicate),
                  result => enterVersion(result.assembly_version_id),
                  'Duplicating recipe…',
                )}><Copy size={15} />Create duplicate</button></footer>
              </div> : <div className={styles.libraryList}>
                {builderData.assemblies.length === 0 && <div className={styles.emptyLibrary}>No company assemblies yet. Start blank or use a template.</div>}
                {builderData.assemblies.map(assembly => {
                  const versions = versionsByAssembly.get(assembly.id) || [];
                  const draft = versions.find(version => version.status === 'draft');
                  const published = versions.find(version => version.status === 'published');
                  const latest = draft || published || versions[0];
                  return <article className={styles.libraryRow} key={assembly.id}>
                    <div className={styles.libraryMeasure}>{assembly.primary_measurement}</div>
                    <div className={styles.libraryCopy}><span>{assembly.category}</span><strong>{assembly.code} · {assembly.name}</strong><small>{draft ? `Draft v${draft.version_no}` : published ? `Published v${published.version_no}` : 'No published version'}</small></div>
                    <div className={styles.libraryActions}>
                      {draft && <button type="button" onClick={() => enterVersion(draft.id)}><PencilLine size={14} />Edit draft</button>}
                      {!draft && published && <button type="button" disabled={isPending} onClick={() => run(
                        () => createAssemblyRevision(setId, published.id),
                        result => enterVersion(result.assembly_version_id),
                        'Creating revision…',
                      )}><FilePlus2 size={14} />New revision</button>}
                      {latest && <button type="button" className={styles.secondaryButton} onClick={() => setDuplicate({ sourceVersionId: latest.id, code: `${assembly.code}-COPY`, name: `${assembly.name} Copy` })}><Copy size={14} />Duplicate</button>}
                    </div>
                  </article>;
                })}
              </div>}
              {!duplicate && <footer className={styles.dialogFooter}><span>{message}</span></footer>}
            </div>}
          </div>
        </section>
      </div>}
    </div>
  </AssemblyBuilderProvider>;
}
