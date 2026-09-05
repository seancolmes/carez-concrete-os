'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Copy, FilePlus2, GripHorizontal, LayoutTemplate, Move, PencilLine, Plus, X } from 'lucide-react';
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
import { AssemblySystemPresetBar } from './AssemblySystemPresetBar';
import { TakeoffDrawingWorkspace } from './TakeoffDrawingWorkspace';
import { ConcreteConditionAuthoring } from './ConcreteConditionAuthoring';
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

type Props = { setId: string; workspaceProps: any; builderData: BuilderData; conditionData: any };
type DialogMode = 'blank' | 'templates' | 'existing';
type DialogDrag = { startX: number; startY: number; originX: number; originY: number; left: number; right: number; top: number; bottom: number };
type PaneDrag = { kind: 'palette' | 'test'; startX: number; width: number };
type RecipeWindow = { x: number; y: number; width: number; height: number };
type RecipeDrag = { startX: number; startY: number; x: number; y: number };
type RecipeResize = { startX: number; startY: number; width: number; height: number };

const BUILDER_PANE_STORAGE_KEY = 'carez.assemblyBuilder.panes.v1';
const RECIPE_WINDOW_STORAGE_KEY = 'carez.scopeRecipe.window.v1';
const DEFAULT_RECIPE_WINDOW: RecipeWindow = { x: 96, y: 70, width: 1120, height: 610 };
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

const codeFromName = (name: string) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28);

export function TakeoffAssemblyBuilderShell({ setId, workspaceProps, builderData, conditionData }: Props) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const dialogDragRef = useRef<DialogDrag | null>(null);
  const paneDragRef = useRef<PaneDrag | null>(null);
  const recipeDragRef = useRef<RecipeDrag | null>(null);
  const recipeResizeRef = useRef<RecipeResize | null>(null);

  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('blank');
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 });
  const [paletteWidth, setPaletteWidth] = useState(200);
  const [testBenchWidth, setTestBenchWidth] = useState(360);
  const [recipeWindow, setRecipeWindow] = useState<RecipeWindow>(DEFAULT_RECIPE_WINDOW);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [blankCodeTouched, setBlankCodeTouched] = useState(false);
  const [blank, setBlank] = useState({ code: '', name: '', category: 'Foundations', primaryMeasurement: 'LF' as 'LF' | 'SF' | 'EA' | 'CY', description: '' });
  const [duplicate, setDuplicate] = useState<{ sourceVersionId: string; code: string; name: string } | null>(null);

  const versionsByAssembly = useMemo(() => latestByAssembly(builderData.versions), [builderData.versions]);
  const activeVersion = builderData.versions.find(version => version.id === activeVersionId) || null;
  const activeAssembly = activeVersion ? builderData.assemblies.find(assembly => assembly.id === activeVersion.assembly_id) : null;
  const activeName = activeVersion?.assembly_name_snapshot || activeAssembly?.name || 'Scope Recipe';
  const builderPaneStyle = {
    '--assembly-palette-width': `${paletteWidth}px`,
    '--assembly-test-width': `${testBenchWidth}px`,
  } as CSSProperties;
  const recipeStyle = focus ? builderPaneStyle : ({
    ...builderPaneStyle,
    left: recipeWindow.x,
    top: recipeWindow.y,
    width: recipeWindow.width,
    height: recipeWindow.height,
  } as CSSProperties);

  const constrainRecipeWindow = (candidate: RecipeWindow) => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return candidate;
    const minWidth = Math.min(760, Math.max(620, rect.width - 20));
    const minHeight = Math.min(420, Math.max(330, rect.height - 20));
    const width = clamp(candidate.width, minWidth, Math.max(minWidth, rect.width - 16));
    const height = clamp(candidate.height, minHeight, Math.max(minHeight, rect.height - 16));
    return {
      width,
      height,
      x: clamp(candidate.x, 8, Math.max(8, rect.width - width - 8)),
      y: clamp(candidate.y, 8, Math.max(8, rect.height - height - 8)),
    };
  };

  useEffect(() => {
    if (activeVersionId && !activeVersion && !isPending) {
      const timer = window.setTimeout(() => router.refresh(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [activeVersionId, activeVersion, isPending, router]);

  useEffect(() => {
    try {
      const panes = JSON.parse(window.localStorage.getItem(BUILDER_PANE_STORAGE_KEY) || '{}');
      if (Number.isFinite(Number(panes.palette))) setPaletteWidth(clamp(Number(panes.palette), 160, 340));
      if (Number.isFinite(Number(panes.test))) setTestBenchWidth(clamp(Number(panes.test), 280, 640));
      const saved = JSON.parse(window.localStorage.getItem(RECIPE_WINDOW_STORAGE_KEY) || '{}');
      if ([saved.x, saved.y, saved.width, saved.height].every(value => Number.isFinite(Number(value)))) {
        window.setTimeout(() => setRecipeWindow(current => constrainRecipeWindow({ x: Number(saved.x), y: Number(saved.y), width: Number(saved.width), height: Number(saved.height) })), 0);
      } else {
        window.setTimeout(() => setRecipeWindow(current => constrainRecipeWindow(current)), 0);
      }
    } catch {
      window.setTimeout(() => setRecipeWindow(current => constrainRecipeWindow(current)), 0);
    }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(BUILDER_PANE_STORAGE_KEY, JSON.stringify({ palette: paletteWidth, test: testBenchWidth })); }
    catch { /* Browser storage is optional. */ }
  }, [paletteWidth, testBenchWidth]);

  useEffect(() => {
    if (focus) return;
    try { window.localStorage.setItem(RECIPE_WINDOW_STORAGE_KEY, JSON.stringify(recipeWindow)); }
    catch { /* Browser storage is optional. */ }
  }, [recipeWindow, focus]);

  useEffect(() => {
    const resize = () => { if (!focus) setRecipeWindow(current => constrainRecipeWindow(current)); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [focus]);

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

      const recipeDrag = recipeDragRef.current;
      if (recipeDrag && !focus) {
        setRecipeWindow(current => constrainRecipeWindow({ ...current, x: recipeDrag.x + event.clientX - recipeDrag.startX, y: recipeDrag.y + event.clientY - recipeDrag.startY }));
      }

      const recipeResize = recipeResizeRef.current;
      if (recipeResize && !focus) {
        setRecipeWindow(current => constrainRecipeWindow({ ...current, width: recipeResize.width + event.clientX - recipeResize.startX, height: recipeResize.height + event.clientY - recipeResize.startY }));
      }

      const paneDrag = paneDragRef.current;
      if (paneDrag?.kind === 'palette') setPaletteWidth(clamp(paneDrag.width + event.clientX - paneDrag.startX, 160, 340));
      if (paneDrag?.kind === 'test') setTestBenchWidth(clamp(paneDrag.width - (event.clientX - paneDrag.startX), 280, 640));
    };
    const end = () => {
      dialogDragRef.current = null;
      recipeDragRef.current = null;
      recipeResizeRef.current = null;
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
  }, [focus]);

  const enterVersion = (versionId: string) => {
    setActiveVersionId(versionId);
    setOpen(true);
    setDialogOpen(false);
    setFocus(false);
    setMessage('');
    setRecipeWindow(current => constrainRecipeWindow(current));
  };

  const run = (work: () => Promise<any>, onDone: (result: any) => void, pendingLabel: string) => {
    setMessage(pendingLabel);
    startTransition(async () => {
      try {
        const result = await work();
        onDone(result);
        router.refresh();
      } catch (error: any) {
        setMessage(error?.message || 'Unable to complete recipe action.');
      }
    });
  };

  const resetDialog = () => { setDialogOffset({ x: 0, y: 0 }); setMessage(''); };
  const openCreate = () => {
    setDialogMode('blank');
    setDuplicate(null);
    setBlankCodeTouched(false);
    setBlank({ code: '', name: '', category: 'Foundations', primaryMeasurement: 'LF', description: '' });
    resetDialog();
    setDialogOpen(true);
  };
  const openLibrary = () => { setDialogMode('existing'); setDuplicate(null); resetDialog(); setDialogOpen(true); };
  const closeBuilder = () => { setFocus(false); setOpen(false); };

  const startDialogDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button,input,select,textarea,a')) return;
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    dialogDragRef.current = { startX: event.clientX, startY: event.clientY, originX: dialogOffset.x, originY: dialogOffset.y, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startRecipeDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (focus || event.button !== 0 || (event.target as HTMLElement).closest('button,input,select,textarea,a')) return;
    event.preventDefault();
    recipeDragRef.current = { startX: event.clientX, startY: event.clientY, x: recipeWindow.x, y: recipeWindow.y };
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startRecipeResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (focus || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    recipeResizeRef.current = { startX: event.clientX, startY: event.clientY, width: recipeWindow.width, height: recipeWindow.height };
    document.body.style.cursor = 'nwse-resize';
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
    <div ref={shellRef} className={`${styles.shell} ${focus ? styles.focusShell : ''}`}>
      <TakeoffDrawingWorkspace {...workspaceProps} />

      <ConcreteConditionAuthoring
        setId={setId}
        locked={Boolean(workspaceProps.locked)}
        data={conditionData}
        measurements={workspaceProps.initialMeasurements || []}
        sheets={workspaceProps.initialSheets || []}
        assemblies={workspaceProps.assemblies || []}
        assemblyVersions={workspaceProps.versions || []}
      />

      {open && activeVersionId && <section className={`${styles.recipeWindow} ${focus ? styles.recipeWindowFocus : ''}`} style={recipeStyle} aria-label={`${activeName} Scope Recipe Editor`}>
        <header className={styles.recipeWindowBar} onPointerDown={startRecipeDrag} title={focus ? 'Focus Builder' : 'Drag to move Scope Recipe Editor'}>
          <div className={styles.recipeWindowIdentity}><Move size={13} /><span>Scope Recipe</span><strong>{activeName}</strong>{activeVersion && <small>Draft v{activeVersion.version_no}</small>}</div>
          <span className={styles.windowHint}>{focus ? 'Focused editor' : 'Drag window · resize from lower-right corner'}</span>
        </header>
        <AssemblySystemPresetBar setId={setId} versionId={activeVersionId} disabled={activeVersion?.status !== 'draft'} />
        <div className={styles.recipeWindowBody}>
          <AssemblyBuilderComposer
            setId={setId}
            versionId={activeVersionId}
            builderData={builderData}
            focus={focus}
            onFocusChange={setFocus}
            onClose={closeBuilder}
            onCreateAnother={openCreate}
          />
          <button type="button" className={`${styles.builderPaneHandle} ${styles.palettePaneHandle}`} aria-label="Resize recipe blocks pane" title="Drag to resize blocks pane" onPointerDown={event => startPaneDrag(event, 'palette')} />
          <button type="button" className={`${styles.builderPaneHandle} ${styles.testPaneHandle}`} aria-label="Resize Test Bench" title="Drag to resize Test Bench" onPointerDown={event => startPaneDrag(event, 'test')} />
        </div>
        {!focus && <button type="button" className={styles.recipeResizeCorner} aria-label="Resize Scope Recipe Editor" title="Drag to resize window" onPointerDown={startRecipeResize}><span /></button>}
      </section>}

      {dialogOpen && <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
        <section ref={dialogRef} className={styles.dialog} style={{ transform: `translate(${dialogOffset.x}px, ${dialogOffset.y}px)` }} role="dialog" aria-modal="true" aria-label="Scope Recipe start">
          <header className={styles.dialogHeader} onPointerDown={startDialogDrag} title="Drag to move">
            <div className={styles.dialogIdentity}><GripHorizontal size={15} aria-hidden="true" /><div><span>Scope Recipe</span><strong>Create or continue a concrete recipe</strong></div></div>
            <button type="button" className={styles.iconButton} onClick={() => setDialogOpen(false)} aria-label="Close"><X size={17} /></button>
          </header>

          <nav className={styles.dialogTabs} aria-label="Scope Recipe start options">
            <button type="button" className={dialogMode === 'blank' ? styles.activeTab : ''} onClick={() => { setDialogMode('blank'); setDuplicate(null); }}><FilePlus2 size={15} />Blank</button>
            <button type="button" className={dialogMode === 'templates' ? styles.activeTab : ''} onClick={() => { setDialogMode('templates'); setDuplicate(null); }}><LayoutTemplate size={15} />Templates</button>
            <button type="button" className={dialogMode === 'existing' ? styles.activeTab : ''} onClick={() => { setDialogMode('existing'); setDuplicate(null); }}><Copy size={15} />Company recipes</button>
          </nav>

          <div className={styles.dialogBody}>
            {dialogMode === 'blank' && <div className={styles.blankForm}>
              <div className={styles.dialogIntro}><strong>New blank Scope Recipe</strong><span>Name the reusable scope and choose its primary measurement. Add concrete systems after it opens.</span></div>
              <div className={styles.fieldGrid}>
                <label className={styles.wide}><span>Recipe name</span><input value={blank.name} onChange={event => { const name = event.target.value; setBlank(value => ({ ...value, name, code: blankCodeTouched ? value.code : codeFromName(name) })); }} placeholder="Strip Footing" autoFocus /></label>
                <label><span>Code</span><input value={blank.code} onChange={event => { setBlankCodeTouched(true); setBlank(value => ({ ...value, code: event.target.value.toUpperCase() })); }} placeholder="STRIP-FOOTING" /></label>
                <label><span>Category</span><input value={blank.category} onChange={event => setBlank(value => ({ ...value, category: event.target.value }))} /></label>
                <label><span>Primary takeoff</span><select value={blank.primaryMeasurement} onChange={event => setBlank(value => ({ ...value, primaryMeasurement: event.target.value as any }))}><option value="LF">Linear feet</option><option value="SF">Square feet</option><option value="EA">Count</option><option value="CY">Cubic yards</option></select></label>
              </div>
              <footer className={styles.dialogFooter}><span>{message}</span><button type="button" className={styles.primaryButton} disabled={isPending || !blank.code.trim() || !blank.name.trim() || !blank.category.trim()} onClick={() => run(() => createAssemblyDraft(setId, blank), result => enterVersion(result.assembly_version_id), 'Creating blank Scope Recipe…')}><Plus size={15} />Create recipe</button></footer>
            </div>}

            {dialogMode === 'templates' && <div>
              <div className={styles.dialogIntro}><strong>Start from a concrete pattern.</strong><span>Templates copy structure only. Project variables, production assumptions, products and prices remain yours.</span></div>
              <div className={styles.templateGrid}>{ASSEMBLY_TEMPLATES.map(template => <article key={template.id} className={styles.templateCard}>
                <div className={styles.templateIcon}>{template.primaryMeasurement}</div>
                <div className={styles.templateCopy}><span>{template.category}</span><strong>{template.name}</strong><p>{template.description}</p><small>{template.properties.length} variables · {template.components.length} scope items</small></div>
                <button type="button" disabled={isPending} onClick={() => run(() => createAssemblyFromTemplate(setId, { templateId: template.id }), result => enterVersion(result.assembly_version_id), `Copying ${template.name} template…`)}>Use template</button>
              </article>)}</div>
              <footer className={styles.dialogFooter}><span>{message}</span></footer>
            </div>}

            {dialogMode === 'existing' && <div>
              <div className={styles.dialogIntro}><strong>Company Scope Recipes</strong><span>Edit a draft, create the next immutable revision, or duplicate reusable scope logic.</span></div>
              {duplicate ? <div className={styles.duplicateForm}>
                <button type="button" className={styles.backButton} onClick={() => setDuplicate(null)}>← Back to recipes</button>
                <strong>Duplicate Scope Recipe</strong>
                <div className={styles.fieldGrid}>
                  <label><span>New code</span><input value={duplicate.code} onChange={event => setDuplicate(value => value ? { ...value, code: event.target.value.toUpperCase() } : value)} /></label>
                  <label className={styles.wide}><span>New name</span><input value={duplicate.name} onChange={event => setDuplicate(value => value ? { ...value, name: event.target.value } : value)} /></label>
                </div>
                <footer className={styles.dialogFooter}><span>{message}</span><button type="button" className={styles.primaryButton} disabled={isPending || !duplicate.code.trim() || !duplicate.name.trim()} onClick={() => run(() => duplicateAssemblyDraft(setId, duplicate), result => enterVersion(result.assembly_version_id), 'Duplicating Scope Recipe…')}><Copy size={15} />Create duplicate</button></footer>
              </div> : <div className={styles.libraryList}>
                {builderData.assemblies.length === 0 && <div className={styles.emptyLibrary}>No company Scope Recipes yet. Start blank or use a template.</div>}
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
                      {!draft && published && <button type="button" disabled={isPending} onClick={() => run(() => createAssemblyRevision(setId, published.id), result => enterVersion(result.assembly_version_id), 'Creating recipe revision…')}><FilePlus2 size={14} />New revision</button>}
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
