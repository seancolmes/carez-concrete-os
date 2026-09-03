'use client';

import { useEffect } from 'react';

type PaneKind = 'sheets' | 'inspector';
type DragState = { kind: PaneKind; startX: number; startWidth: number } | null;

const SHEETS_MIN = 190;
const SHEETS_MAX = 620;
const INSPECTOR_MIN = 300;
const INSPECTOR_MAX = 680;
const CENTER_MIN = 420;
const HANDLE_WIDTH = 8;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function paneKind(aside: HTMLElement): PaneKind | null {
  if (aside.querySelector('[title="Hide sheets"]')) return 'sheets';
  if (aside.querySelector('[title="Hide inspector"]')) return 'inspector';
  return null;
}

export function useTakeoffPaneResize() {
  useEffect(() => {
    const dock = document.querySelector<HTMLElement>('[aria-label="Takeoff quantity worksheet"]');
    const workstation = dock?.parentElement;
    const workspace = dock?.previousElementSibling as HTMLElement | null;
    if (!workstation || !workspace) return;

    let drag: DragState = null;
    const cleanups: Array<() => void> = [];
    const remembered: Partial<Record<PaneKind, number>> = {};

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
      return remembered[kind] || pane.getBoundingClientRect().width;
    };

    const applyGrid = () => {
      if (window.innerWidth <= 900) {
        workspace.style.removeProperty('grid-template-columns');
        return;
      }
      const { sheets, inspector } = getPanes();
      if (sheets && inspector) workspace.style.gridTemplateColumns = `${currentWidth(sheets, 'sheets')}px minmax(${CENTER_MIN}px,1fr) ${currentWidth(inspector, 'inspector')}px`;
      else if (sheets) workspace.style.gridTemplateColumns = `${currentWidth(sheets, 'sheets')}px minmax(${CENTER_MIN}px,1fr)`;
      else if (inspector) workspace.style.gridTemplateColumns = `minmax(${CENTER_MIN}px,1fr) ${currentWidth(inspector, 'inspector')}px`;
      else workspace.style.removeProperty('grid-template-columns');
    };

    const maxFor = (kind: PaneKind) => {
      const { sheets, inspector } = getPanes();
      const other = kind === 'sheets' ? currentWidth(inspector, 'inspector') : currentWidth(sheets, 'sheets');
      const absoluteMax = kind === 'sheets' ? SHEETS_MAX : INSPECTOR_MAX;
      return Math.max(kind === 'sheets' ? SHEETS_MIN : INSPECTOR_MIN, Math.min(absoluteMax, workspace.clientWidth - other - CENTER_MIN));
    };

    const begin = (kind: PaneKind, pane: HTMLElement, event: PointerEvent) => {
      event.preventDefault();
      drag = { kind, startX: event.clientX, startWidth: pane.getBoundingClientRect().width };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const move = (event: PointerEvent) => {
      if (!drag) return;
      const { sheets, inspector } = getPanes();
      const pane = drag.kind === 'sheets' ? sheets : inspector;
      if (!pane) return;
      const delta = event.clientX - drag.startX;
      const raw = drag.kind === 'sheets' ? drag.startWidth + delta : drag.startWidth - delta;
      const min = drag.kind === 'sheets' ? SHEETS_MIN : INSPECTOR_MIN;
      const width = clamp(raw, min, maxFor(drag.kind));
      remembered[drag.kind] = width;
      pane.style.width = `${width}px`;
      applyGrid();
    };

    const end = () => {
      drag = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const bindPane = (pane: HTMLElement, kind: PaneKind) => {
      if (pane.querySelector(`[data-carez-pane-resizer="${kind}"]`)) return;
      pane.style.position = 'relative';
      pane.style.resize = 'none';
      pane.style.direction = 'ltr';
      const handle = document.createElement('div');
      handle.dataset.carezPaneResizer = kind;
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'vertical');
      handle.setAttribute('aria-label', `Resize ${kind} pane`);
      handle.title = `Drag to resize ${kind}`;
      Object.assign(handle.style, {
        position: 'absolute',
        top: '0',
        bottom: '0',
        width: `${HANDLE_WIDTH}px`,
        zIndex: '60',
        cursor: 'col-resize',
        background: 'transparent',
        touchAction: 'none',
        ...(kind === 'sheets' ? { right: '-4px' } : { left: '-4px' }),
      });
      const enter = () => { handle.style.background = 'rgba(30,91,255,.28)'; };
      const leave = () => { if (!drag) handle.style.background = 'transparent'; };
      const down = (event: PointerEvent) => begin(kind, pane, event);
      handle.addEventListener('pointerenter', enter);
      handle.addEventListener('pointerleave', leave);
      handle.addEventListener('pointerdown', down);
      pane.appendChild(handle);
      cleanups.push(() => {
        handle.removeEventListener('pointerenter', enter);
        handle.removeEventListener('pointerleave', leave);
        handle.removeEventListener('pointerdown', down);
        handle.remove();
      });
    };

    const bind = () => {
      const { sheets, inspector } = getPanes();
      if (sheets) bindPane(sheets, 'sheets');
      if (inspector) bindPane(inspector, 'inspector');
      applyGrid();
    };

    const observer = new MutationObserver(bind);
    observer.observe(workspace, { childList: true });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('resize', applyGrid);
    bind();

    return () => {
      observer.disconnect();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('resize', applyGrid);
      cleanups.forEach(cleanup => cleanup());
      workspace.style.removeProperty('grid-template-columns');
      end();
    };
  }, []);
}
