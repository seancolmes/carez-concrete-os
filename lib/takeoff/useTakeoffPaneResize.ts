'use client';

import { useEffect } from 'react';

type PaneKind = 'sheets' | 'inspector';
type DragState = {
  kind: PaneKind;
  startX: number;
  startWidth: number;
} | null;

const SHEETS_MIN = 190;
const SHEETS_DEFAULT = 242;
const SHEETS_MAX = 620;
const INSPECTOR_MIN = 300;
const INSPECTOR_DEFAULT = 326;
const INSPECTOR_MAX = 680;
const CENTER_MIN = 420;
const HANDLE_WIDTH = 16;
const KEYBOARD_STEP = 16;
const STORAGE_KEYS: Record<PaneKind, string> = {
  sheets: 'carez.takeoff.sheetsWidth',
  inspector: 'carez.takeoff.inspectorWidth',
};

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
    const workspace = dock?.previousElementSibling as HTMLElement | null;
    if (!workspace) return;

    const originalWorkspaceDisplay = workspace.style.display;
    const originalWorkspaceFlexDirection = workspace.style.flexDirection;
    const originalWorkspaceGridTemplateColumns = workspace.style.gridTemplateColumns;

    let drag: DragState = null;
    let hiddenInspectorMeta: HTMLElement | null = null;
    let centerElement: HTMLElement | null = null;
    const widths: Partial<Record<PaneKind, number>> = {};
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

    const getCenter = () => workspace.querySelector<HTMLElement>(':scope > section');

    const loadWidth = (kind: PaneKind, pane: HTMLElement | null) => {
      const remembered = widths[kind];
      if (remembered !== undefined) return remembered;

      let stored = Number.NaN;
      try {
        stored = Number(window.localStorage.getItem(STORAGE_KEYS[kind]));
      } catch {
        // Local storage can be unavailable in restricted browser contexts.
      }

      const measured = pane?.getBoundingClientRect().width || defaultFor(kind);
      const initial = Number.isFinite(stored) && stored > 0 ? stored : measured;
      widths[kind] = clamp(initial, minimumFor(kind), maximumFor(kind));
      return widths[kind] as number;
    };

    const maxFor = (kind: PaneKind) => {
      const { sheets, inspector } = getPanes();
      const otherWidth = kind === 'sheets'
        ? (inspector ? loadWidth('inspector', inspector) : 0)
        : (sheets ? loadWidth('sheets', sheets) : 0);
      const available = workspace.clientWidth - otherWidth - CENTER_MIN;
      return Math.max(minimumFor(kind), Math.min(maximumFor(kind), available));
    };

    const saveWidth = (kind: PaneKind, value: number) => {
      widths[kind] = clamp(value, minimumFor(kind), maxFor(kind));
      try {
        window.localStorage.setItem(STORAGE_KEYS[kind], String(Math.round(widths[kind] as number)));
      } catch {
        // Width persistence is optional; resizing must still work without it.
      }
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
      handle.setAttribute('aria-valuemax', String(Math.round(maxFor(kind))));
      handle.setAttribute('aria-valuenow', String(Math.round(loadWidth(kind, pane))));
    };

    const clearPaneInlineLayout = (pane: HTMLElement | null) => {
      if (!pane) return;
      pane.style.removeProperty('flex');
      pane.style.removeProperty('width');
    };

    const applyLayout = () => {
      hideInspectorSheetMeta();
      const { sheets, inspector } = getPanes();
      const center = getCenter();
      centerElement = center;

      if (window.innerWidth <= 900) {
        workspace.style.display = originalWorkspaceDisplay;
        workspace.style.flexDirection = originalWorkspaceFlexDirection;
        workspace.style.gridTemplateColumns = originalWorkspaceGridTemplateColumns;
        clearPaneInlineLayout(sheets);
        clearPaneInlineLayout(inspector);
        if (center) {
          center.style.removeProperty('flex');
          center.style.removeProperty('min-width');
        }
        positionHandle('sheets', null);
        positionHandle('inspector', null);
        return;
      }

      workspace.style.display = 'flex';
      workspace.style.flexDirection = 'row';
      workspace.style.gridTemplateColumns = 'none';

      if (sheets) {
        const width = clamp(loadWidth('sheets', sheets), SHEETS_MIN, maxFor('sheets'));
        widths.sheets = width;
        sheets.style.flex = `0 0 ${width}px`;
        sheets.style.width = `${width}px`;
      }

      if (inspector) {
        const width = clamp(loadWidth('inspector', inspector), INSPECTOR_MIN, maxFor('inspector'));
        widths.inspector = width;
        inspector.style.flex = `0 0 ${width}px`;
        inspector.style.width = `${width}px`;
      }

      if (center) {
        center.style.flex = '1 1 0';
        center.style.minWidth = `${CENTER_MIN}px`;
      }

      positionHandle('sheets', sheets);
      positionHandle('inspector', inspector);
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

    const moveDrag = (event: MouseEvent) => {
      if (!drag) return;
      if (event.buttons === 0) {
        endDrag();
        return;
      }
      if (event.cancelable) event.preventDefault();
      const delta = event.clientX - drag.startX;
      const rawWidth = drag.kind === 'sheets'
        ? drag.startWidth + delta
        : drag.startWidth - delta;
      saveWidth(drag.kind, rawWidth);
      applyLayout();
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

      const mouseDown = (event: MouseEvent) => {
        if (window.innerWidth <= 900 || event.button !== 0) return;
        const { sheets, inspector } = getPanes();
        const pane = kind === 'sheets' ? sheets : inspector;
        if (!pane) return;
        event.preventDefault();
        event.stopPropagation();
        drag = {
          kind,
          startX: event.clientX,
          startWidth: loadWidth(kind, pane),
        };
        line.style.opacity = '1';
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      };

      const mouseEnter = () => { line.style.opacity = '1'; };
      const mouseLeave = () => { if (!drag || drag.kind !== kind) line.style.opacity = '0'; };
      const focus = () => { line.style.opacity = '1'; };
      const blur = () => { if (!drag || drag.kind !== kind) line.style.opacity = '0'; };
      const keyDown = (event: KeyboardEvent) => {
        const { sheets, inspector } = getPanes();
        const pane = kind === 'sheets' ? sheets : inspector;
        if (!pane) return;
        const current = loadWidth(kind, pane);

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          saveWidth(kind, current + (kind === 'sheets' ? -KEYBOARD_STEP : KEYBOARD_STEP));
          applyLayout();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          saveWidth(kind, current + (kind === 'sheets' ? KEYBOARD_STEP : -KEYBOARD_STEP));
          applyLayout();
        } else if (event.key === 'Home') {
          event.preventDefault();
          saveWidth(kind, minimumFor(kind));
          applyLayout();
        } else if (event.key === 'End') {
          event.preventDefault();
          saveWidth(kind, maxFor(kind));
          applyLayout();
        }
      };
      const doubleClick = () => {
        saveWidth(kind, defaultFor(kind));
        applyLayout();
      };

      handle.addEventListener('mousedown', mouseDown);
      handle.addEventListener('mouseenter', mouseEnter);
      handle.addEventListener('mouseleave', mouseLeave);
      handle.addEventListener('focus', focus);
      handle.addEventListener('blur', blur);
      handle.addEventListener('keydown', keyDown);
      handle.addEventListener('dblclick', doubleClick);
      document.body.appendChild(handle);
      handles[kind] = handle;
      handleLines[kind] = line;

      return () => {
        handle.removeEventListener('mousedown', mouseDown);
        handle.removeEventListener('mouseenter', mouseEnter);
        handle.removeEventListener('mouseleave', mouseLeave);
        handle.removeEventListener('focus', focus);
        handle.removeEventListener('blur', blur);
        handle.removeEventListener('keydown', keyDown);
        handle.removeEventListener('dblclick', doubleClick);
        handle.remove();
      };
    };

    const removeSheetHandle = createHandle('sheets');
    const removeInspectorHandle = createHandle('inspector');
    const mutationObserver = new MutationObserver(applyLayout);
    mutationObserver.observe(workspace, { childList: true });
    const resizeObserver = new ResizeObserver(applyLayout);
    resizeObserver.observe(workspace);

    const reposition = () => {
      const { sheets, inspector } = getPanes();
      positionHandle('sheets', sheets);
      positionHandle('inspector', inspector);
    };

    window.addEventListener('mousemove', moveDrag, { passive: false });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', endDrag);
    window.addEventListener('resize', applyLayout);
    window.addEventListener('scroll', reposition, true);
    applyLayout();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', moveDrag);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('blur', endDrag);
      window.removeEventListener('resize', applyLayout);
      window.removeEventListener('scroll', reposition, true);
      removeSheetHandle();
      removeInspectorHandle();
      workspace.style.display = originalWorkspaceDisplay;
      workspace.style.flexDirection = originalWorkspaceFlexDirection;
      workspace.style.gridTemplateColumns = originalWorkspaceGridTemplateColumns;
      const { sheets, inspector } = getPanes();
      clearPaneInlineLayout(sheets);
      clearPaneInlineLayout(inspector);
      if (centerElement) {
        centerElement.style.removeProperty('flex');
        centerElement.style.removeProperty('min-width');
      }
      hiddenInspectorMeta?.style.removeProperty('display');
      endDrag();
    };
  }, []);
}
