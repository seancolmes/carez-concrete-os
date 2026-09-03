'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Copy, FilePlus2, GripHorizontal, LayoutTemplate, PencilLine, Plus, X } from 'lucide-react';
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
type DialogDrag = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};
type PaneDrag = { kind: 'palette' | 'test'; startX: number; width: number };

const BUILDER_PANE_STORAGE_KEY = 'carez.assemblyBuilder.panes.v1';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

const codeFromName = (name: string) => name
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 28);

export function TakeoffAssemblyBuilderShell({ setId, workspaceProps, builderData }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLElement | null>(null);
  const dialogDragRef = useRef<DialogDrag | null>(null);
  const paneDragRef = useRef<PaneDrag | null>(null);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('blank');
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 });
  const [paletteWidth, setPaletteWidth] = useState(200);
  const [testBenchWidth, setTestBenchWidth] = useState(360);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [blankCodeTouched, setBlankCodeTouched] = useState(false);
  const [blank, setBlank] = useState({ code: '', name: '', category: 'Foundations', primaryMeasurement: 'LF' as 'LF' | 'SF' | 'EA' | 'CY', description: '' });
  const [duplicate, setDuplicate] = useState<{ sourceVersionId: string; code: string; name: string } | null>(null);

  const versionsByAssembly = useMemo(() => latestByAssembly(builderData.versions), [builderData.versions]);
  const activeVersion = builderData.versions.find(version => version.id === activeVersionId) || null;
  const builderPaneStyle = {
    '--assembly-palette-width': `${paletteWidth}px`,
    '--assembly-test-width': `${testBenchWidth}px`,
  } as CSSProperties;

  useEffect(() => {
    if (activeVersionId && !activeVersion && !isPending) {
      const timer = window.setTimeout(() => router.refresh(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [activeVersionId, activeVersion, isPending, router]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(BUILDER_PANE_STORAGE_KEY) || '{}');
      if (Number.isFinite(Number(stored.palette))) setPaletteWidth(clamp(Number(stored.palette), 160, 340));
      if (Number.isFinite(Number(stored.test))) setTestBenchWidth(clamp(Number(stored.test), 280, 640));
    } catch {
      // Pane preferences are optional.
    }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(BUILDER_PANE_STORAGE_KEY, JSON.stringify({ palette: paletteWidth, test: testBenchWidth })); }
    catch { /* Browser storage is optional. */ }
  }, [paletteWidth, testBenchWidth]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const dialogDrag = dialogDragRef.current;
      if (dialogDrag) {
        const requestedX = event.clientX - dialogDrag.startX;
        const requestedY = event.clientY - dialogDrag.startY;
        const deltaX = Math.max(10 - dialogDrag.left, Math.min(window.innerWidth - 10 - dialogDrag.right, requestedX));
        const deltaY = Math.max(10 - dialogDrag.top, Math.min(window.innerHeight - 10 - dialogDrag.bottom, requestedY));
        setDialogOffset({ x: dialogDrag.originX + deltaX, y: dialogDrag.originY + deltaY });
      }

      const paneDrag = paneDragRef.current;
      if (paneDrag?.kind === 'palette') setPaletteWidth(clamp(paneDrag.width + event.clientX - paneDrag.startX, 160, 340));
      if (paneDrag?.kind === 'test') setTestBenchWidth(clamp(paneDrag.width - (event.clientX - paneDrag.startX), 280, 640));
    };
    const end = () => {
      dialogDragRef.current = null;
      paneDragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

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

  const resetDialog = () => {
    setDialogOffset({ x: 0, y: 0 });
    setMessage('');
  };

  const openCreate = () => {
    setDialogMode('blank');
    setDuplicate(null);
    setBlankCodeTouched(false);
    setBlank({ code: '', name: '', category: 'Foundations', primaryMeasurement: 'LF', description: '' });
    resetDialog();
    setDialogOpen(true);
  };
  const openLibrary = () => {
    setDialogMode('existing');
    setDuplicate(null);
    resetDialog();
    setDialogOpen(true);
  };
  const closeBuilder = () => {
    setFocus(false);
    setOpen(false);
  };

  const startDialogDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button,input,select,textarea,a')) return;
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    dialogDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: dialogOffset.x,
      originY: dialogOffset.y,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startPaneDrag = (event: ReactPointerEvent<HTMLButtonElement>, kind: PaneDrag['kind']) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    paneDragRef.current = { kind, startX: event.clientX, width: kind === 'palette' ? paletteWidth : testBenchWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return <AssemblyBuilderProvider value={{ open, focus, openCreate, openLibrary, closeBuilder }}>
    <div className={`${styles.shell} ${focus ? styles.focusShell : ''}`}>
      <TakeoffDrawingWorkspace {...workspaceProps} />

      {open && activeVersionId && <div className={focus ? styles.focusLayer : styles.builderLayer} style={builderPaneStyle}>
        <AssemblyBuilderComposer
          setId={setId}
          versionId={activeVersionId}
          builderData={builderData}
          focus={focus}
          onFocusChange={setFocus}
          onClose={closeBuilder}
          onCreateAnother={openCreate}
        />
        <button type="button" className={`${styles.builderPaneHandle} ${styles.palettePaneHandle}`} aria-label="Resize Assembly Builder block palette" title="Drag to resize blocks pane" onPointerDown={event => startPaneDrag(event, 'palette')} />
        <button type="button" className={`${styles.builderPaneHandle} ${styles.testPaneHandle}`} aria-label="Resize Assembly Builder Test Bench" title="Drag to resize Test Bench" onPointerDown={event => startPaneDrag(event, 'test')} />
      </div>}

      {dialogOpen && <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
        <section ref={dialogRef} className={styles.dialog} style={{ transform: `translate(${dialogOffset.x}px, ${dialogOffset.y}px)` }} role="dialog" aria-modal="true" aria-label="Assembly Builder start">
          <header className={styles.dialogHeader} onPointerDown={startDialogDrag} title="Drag to move">
            <div className={styles.dialogIdentity}>
              <GripHorizontal size={15} aria-hidden="true" />
              <div><span>Assembly Builder</span><strong>Create or continue a concrete recipe</strong></div>
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
              <div className={styles.dialogIntro}><strong>New blank recipe</strong><span>Name it, choose what you measure, then build the materials and labor in the workstation.</span></div>
              <div className={styles.fieldGrid}>
                <label className={styles.wide}><span>Assembly name</span><input value={blank.name} onChange={event => { const name = event.target.value; setBlank(value => ({ ...value, name, code: blankCodeTouched ? value.code : codeFromName(name) })); }} placeholder="Strip Footing" autoFocus /></label>
                <label><span>Code</span><input value={blank.code} onChange={event => { setBlankCodeTouched(true); setBlank(value => ({ ...value, code: event.target.value.toUpperCase() })); }} placeholder="STRIP-FOOTING" /></label>
                <label><span>Category</span><input value={blank.category} onChange={event => setBlank(value => ({ ...value, category: event.target.value }))} /></label>
                <label><span>Takeoff measurement</span><select value={blank.primaryMeasurement} onChange={event => setBlank(value => ({ ...value, primaryMeasurement: event.target.value as any }))}><option value="LF">Linear feet</option><option value="SF">Square feet</option><option value="EA">Count</option><option value="CY">Cubic yards</option></select></label>
              </div>
              <footer className={styles.dialogFooter}><span>{message}</span><button type="button" className={styles.primaryButton} disabled={isPending || !blank.code.trim() || !blank.name.trim() || !blank.category.trim()} onClick={() => run(
                () => createAssemblyDraft(setId, blank),
                result => enterVersion(result.assembly_version_id),
                'Creating blank recipe…',
              )}><Plus size={15} />Create blank recipe</button></footer>
            </div>}

            {dialogMode === 'templates' && <div>
              <div className={styles.dialogIntro}><strong>Start from a concrete pattern.</strong><span>A template copies structure only. Review the quantities, production assumptions, and prices before publishing.</span></div>
              <div className={styles.templateGrid}>{ASSEMBLY_TEMPLATES.map(template => <article key={template.id} className={styles.templateCard}>
                <div className={styles.templateIcon}>{template.primaryMeasurement}</div>
                <div className={styles.templateCopy}><span>{template.category}</span><strong>{template.name}</strong><p>{template.description}</p><small>{template.properties.length} inputs · {template.components.length} materials/labor outputs</small></div>
                <button type="button" disabled={isPending} onClick={() => run(
                  () => createAssemblyFromTemplate(setId, { templateId: template.id }),
                  result => enterVersion(result.assembly_version_id),
                  `Copying ${template.name} template…`,
                )}>Use template</button>
              </article>)}</div>
              <footer className={styles.dialogFooter}><span>{message}</span></footer>
            </div>}

            {dialogMode === 'existing' && <div>
              <div className={styles.dialogIntro}><strong>Company assemblies</strong><span>Edit a draft, create the next revision, or duplicate a recipe.</span></div>
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
