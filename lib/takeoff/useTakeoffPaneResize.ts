'use client';

import { useEffect } from 'react';

type PaneKind = 'sheets' | 'inspector';
type DragState = {
  kind: PaneKind;
  startX: number;
  startWidth: number;
  pointerId: number;
} | null;

const SHEETS_MIN = 190;
const SHEETS_DEFAULT = 242;
const SHEETS_MAX = 620;
const INSPECTOR_MIN = 300;
const INSPECTOR_DEFAULT = 326;
const INSPECTOR_MAX = 680;
const CENTER_MIN = 420;
const HANDLE_WIDTH = 10;
const KEYBOARD_STEP = 16;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function paneKind(aside: HTMLElement): PaneKind | null {
  if (aside.querySelector('[title="Hide sheets"]')) return 'sheets';
  if (aside.querySelector('[title="Hide inspector"]')) return 'inspector';
  return null;
}

function minimumFor(kind: PaneKind) {
  return kind === 'sheets' ? SHEETS_MIN : INSPECTOR_MIN;
}

function maximumFor(kind: PaneKind) {
  return kind === 'sheets' ? SHEETS_MAX : INSPECTOR_MAX;
}

function defaultFor(kind: PaneKind) {
  return kind === 'sheets' ? SHEETS_DEFAULT : INSPECTOR_DEFAULT;
}

export function useTakeoffPaneResize() {
  useEffect(() => {
    const dock = document.querySelector<HTMLElement>('[aria-label="Takeoff quantity worksheet"]');
    const workstation = dock?.parentElement;
    const workspace = dock?.previousElementSibling as HTMLElement | null;
    if (!workstation || !workspace) return;

    let drag: DragState = null;
    let frame = 0;
    let hiddenInspectorMeta: HTMLElement | null = null;
    const remembered: Partial<Record<PaneKind, number>> = {};
    const handles: Partial<Record<PaneKind, HTMLDivElement>> = {};
    const handleLines: Partial<Record<PaneKind, HTMLDivElement>> = {};

    const getPanes = () => {
      const panes = Array.from(workspace.querySelectorAll<HTMLElement>(':scope > aside'));
      return panes.reduce<{ sheets: HTMLElement | null; inspector: HTMLElement | null }>((result, aside) => {
        const kind = paneKind(aside);
        if (kind) result[kind] = aside;
        return result;
      }, { sheets: null, inspector: null });
    };

    const currentWidth = (pane: HTMLElement | null, kind: PaneKind) => {
      if (!pane) return 0;
      if (remembered[kind] !== undefined) return remembered[kind] as number;
      const measured = pane.getBoundingClientRect().width;
      return measured > 0 ? measured : defaultFor(kind);
    };

    const maxFor = (kind: PaneKind) => {
      const { sheets, inspector } = getPanes();
      const otherWidth = kind === 'sheets'
        ? currentWidth(inspector, 'inspector')
        : currentWidth(sheets, 'sheets');
      const available = workspace.clientWidth - otherWidth - CENTER_MIN;
      return Math.max(minimumFor(kind), Math.min(maximumFor(kind), available));
    };

    const setRememberedWidth = (kind: PaneKind, width: number) => {
      remembered[kind] = clamp(width, minimumFor(kind), maxFor(kind));
    };

    const hideInspectorSheetMeta = () => {
      const { inspector } = getPanes();
      if (!inspector) return;
      const closeButton = inspector.querySelector<HTMLElement>('[title="Hide inspector"]');
      const header = closeButton?.parentElement;
      const identity = header?.firstElementChild;
      const title = identity?.firstElementChild;
      const meta = title?.nextElementSibling;
      if (meta instanceof HTMLElement) {
        hiddenInspectorMeta = meta;
        meta.style.display = 'none';
      }
    };

    const positionHandle = (kind: PaneKind, pane: HTMLElement | null) => {
      const handle = handles[kind];
      if (!handle) return;

      if (window.innerWidth <= 900 || !pane) {
        handle.style.display = 'none';
        return;
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const paneRect = pane.getBoundingClientRect();
      const boundary = kind === 'sheets' ? paneRect.right : paneRect.left;

      handle.style.display = 'block';
      handle.style.left = `${Math.round(boundary - HANDLE_WIDTH / 2)}px`;
      handle.style.top = `${Math.round(workspaceRect.top)}px`;
      handle.style.height = `${Math.max(0, Math.round(workspaceRect.height))}px`;
      handle.setAttribute('aria-valuemin', String(minimumFor(kind)));
      handle.setAttribute('aria-valuemax', String(maxFor(kind)));
      handle.setAttribute('aria-valuenow', String(Math.round(currentWidth(pane, kind))));
    };

    const updateHandles = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panes = getPanes();
        positionHandle('sheets', panes.sheets);
        positionHandle('inspector', panes.inspector);
      });
    };

    const applyGrid = () => {
      hideInspectorSheetMeta();

      if (window.innerWidth <= 900) {
        workspace.style.removeProperty('grid-template-columns');
        positionHandle('sheets', null);
        positionHandle('inspector', null);
        return;
      }

      const { sheets, inspector } = getPanes();
      if (sheets && remembered.sheets === undefined) {
        remembered.sheets = clamp(sheets.getBoundingClientRect().width || SHEETS_DEFAULT, SHEETS_MIN, SHEETS_MAX);
      }
      if (inspector && remembered.inspector === undefined) {
        remembered.inspector = clamp(inspector.getBoundingClientRect().width || INSPECTOR_DEFAULT, INSPECTOR_MIN, INSPECTOR_MAX);
      }

      if (sheets) remembered.sheets = clamp(currentWidth(sheets, 'sheets'), SHEETS_MIN, maxFor('sheets'));
      if (inspector) remembered.inspector = clamp(currentWidth(inspector, 'inspector'), INSPECTOR_MIN, maxFor('inspector'));

      const sheetWidth = sheets ? currentWidth(sheets, 'sheets') : 0;
      const inspectorWidth = inspector ? currentWidth(inspector, 'inspector') : 0;

      if (sheets && inspector) {
        workspace.style.gridTemplateColumns = `${sheetWidth}px minmax(${CENTER_MIN}px, 1fr) ${inspectorWidth}px`;
      } else if (sheets) {
        workspace.style.gridTemplateColumns = `${sheetWidth}px minmax(${CENTER_MIN}px, 1fr)`;
      } else if (inspector) {
        workspace.style.gridTemplateColumns = `minmax(${CENTER_MIN}px, 1fr) ${inspectorWidth}px`;
      } else {
        workspace.style.removeProperty('grid-template-columns');
      }

      updateHandles();
    };

    const endDrag = () => {
      if (drag) {
        const line = handleLines[drag.kind];
        if (line) line.style.opacity = '0';
      }
      drag = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const beginDrag = (kind: PaneKind, event: PointerEvent) => {
      if (window.innerWidth <= 900 || event.button !== 0) return;
      const { sheets, inspector } = getPanes();
      const pane = kind === 'sheets' ? sheets : inspector;
      if (!pane) return;

      event.preventDefault();
      event.stopPropagation();
      drag = {
        kind,
        startX: event.clientX,
        startWidth: currentWidth(pane, kind),
        pointerId: event.pointerId,
      };
      const line = handleLines[kind];
      if (line) line.style.opacity = '1';
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const moveDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (event.cancelable) event.preventDefault();
      const delta = event.clientX - drag.startX;
      const rawWidth = drag.kind === 'sheets'
        ? drag.startWidth + delta
        : drag.startWidth - delta;
      setRememberedWidth(drag.kind, rawWidth);
      applyGrid();
    };

    const adjustByKeyboard = (kind: PaneKind, boundaryDelta: number) => {
      const { sheets, inspector } = getPanes();
      const pane = kind === 'sheets' ? sheets : inspector;
      if (!pane) return;
      const widthDelta = kind === 'sheets' ? boundaryDelta : -boundaryDelta;
      setRememberedWidth(kind, currentWidth(pane, kind) + widthDelta);
      applyGrid();
    };

    const createHandle = (kind: PaneKind) => {
      const handle = document.createElement('div');
      const line = document.createElement('div');

      handle.dataset.carezPaneResizer = kind;
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'vertical');
      handle.setAttribute('aria-label', `Resize ${kind} pane`);
      handle.tabIndex = 0;
      handle.title = `Drag to resize ${kind}`;
      Object.assign(handle.style, {
        position: 'fixed',
        width: `${HANDLE_WIDTH}px`,
        zIndex: '2147483000',
        cursor: 'col-resize',
        background: 'transparent',
        touchAction: 'none',
        outline: 'none',
      });
      Object.assign(line.style, {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: `${Math.floor(HANDLE_WIDTH / 2) - 1}px`,
        width: '2px',
        background: '#1e5bff',
        opacity: '0',
        transition: 'opacity 100ms ease',
        pointerEvents: 'none',
      });
      handle.appendChild(line);

      const pointerDown = (event: PointerEvent) => beginDrag(kind, event);
      const pointerEnter = () => { line.style.opacity = '1'; };
      const pointerLeave = () => { if (!drag || drag.kind !== kind) line.style.opacity = '0'; };
      const focus = () => { line.style.opacity = '1'; };
      const blur = () => { if (!drag || drag.kind !== kind) line.style.opacity = '0'; };
      const keyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          adjustByKeyboard(kind, -KEYBOARD_STEP);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          adjustByKeyboard(kind, KEYBOARD_STEP);
        } else if (event.key === 'Home') {
          event.preventDefault();
          remembered[kind] = minimumFor(kind);
          applyGrid();
        } else if (event.key === 'End') {
          event.preventDefault();
          remembered[kind] = maxFor(kind);
          applyGrid();
        }
      };
      const doubleClick = () => {
        setRememberedWidth(kind, defaultFor(kind));
        applyGrid();
      };

      handle.addEventListener('pointerdown', pointerDown);
      handle.addEventListener('pointerenter', pointerEnter);
      handle.addEventListener('pointerleave', pointerLeave);
      handle.addEventListener('focus', focus);
      handle.addEventListener('blur', blur);
      handle.addEventListener('keydown', keyDown);
      handle.addEventListener('dblclick', doubleClick);
      document.body.appendChild(handle);
      handles[kind] = handle;
      handleLines[kind] = line;

      return () => {
        handle.removeEventListener('pointerdown', pointerDown);
        handle.removeEventListener('pointerenter', pointerEnter);
        handle.removeEventListener('pointerleave', pointerLeave);
        handle.removeEventListener('focus', focus);
        handle.removeEventListener('blur', blur);
        handle.removeEventListener('keydown', keyDown);
        handle.removeEventListener('dblclick', doubleClick);
        handle.remove();
      };
    };

    const removeSheetHandle = createHandle('sheets');
    const removeInspectorHandle = createHandle('inspector');
    const mutationObserver = new MutationObserver(applyGrid);
    mutationObserver.observe(workspace, { childList: true });
    const resizeObserver = new ResizeObserver(applyGrid);
    resizeObserver.observe(workspace);

    const pointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag();
    };
    const reposition = () => updateHandles();

    window.addEventListener('pointermove', moveDrag, { passive: false });
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    window.addEventListener('resize', applyGrid);
    window.addEventListener('scroll', reposition, true);
    applyGrid();

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', moveDrag);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('resize', applyGrid);
      window.removeEventListener('scroll', reposition, true);
      removeSheetHandle();
      removeInspectorHandle();
      workspace.style.removeProperty('grid-template-columns');
      hiddenInspectorMeta?.style.removeProperty('display');
      endDrag();
    };
  }, []);
}
