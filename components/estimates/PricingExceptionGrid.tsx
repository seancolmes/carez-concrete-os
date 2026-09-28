'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PourtraceDialog } from '@/components/overlays/PourtraceOverlays';
import { ChevronRight } from 'lucide-react';
import { groupPricingRows, paginateConditionGroups } from '@/lib/estimating/pricingGrid';

export type PricingExceptionRow = {
  id: string;
  conditionId: string;
  conditionName: string;
  name: string;
  measurement: string;
  production: string;
  productionValue: number;
  statusKey: string;
  searchText: string;
  sourceHref?: string;
  sourceAction?: string;
  costHref?: string;
  badge: ReactNode;
  source: ReactNode;
  quoteCandidates: ReactNode;
};

const PAGE_SIZES = [10, 25, 50, 100];
const ROW_HEIGHT = 48;
const GROUP_HEIGHT = 41;
const WINDOW_HEIGHT = 448;
const needsAttention = (status: string) => ['missing_input', 'missing_price', 'missing_labor_rate', 'expired'].includes(status);
const attentionLabel: Record<string, string> = { missing_input: 'no input', missing_price: 'missing price', missing_labor_rate: 'missing labor', expired: 'expired quote' };

export function PricingExceptionGrid({ rows }: { rows: PricingExceptionRow[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledRequest = useRef<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('priority');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(rows.find(row => needsAttention(row.statusKey))?.conditionId ? [rows.find(row => needsAttention(row.statusKey))!.conditionId] : []));

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('pricingOutput');
    if (!requested || handledRequest.current === requested) return;
    const row = rows.find(item => item.id === requested);
    if (!row) return;
    handledRequest.current = requested;
    setExpanded(current => new Set(current).add(row.conditionId));
    setSelectedId(row.id);
  }, [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const result = rows.filter(row => {
      if (term && !row.searchText.toLocaleLowerCase().includes(term)) return false;
      if (filter === 'needs-attention') return needsAttention(row.statusKey);
      if (filter === 'priced') return row.statusKey === 'priced' || row.statusKey === 'manual_override';
      return filter === 'all' || row.statusKey === filter;
    });
    if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'quantity-desc') result.sort((a, b) => b.productionValue - a.productionValue || a.name.localeCompare(b.name));
    if (sort === 'quantity-asc') result.sort((a, b) => a.productionValue - b.productionValue || a.name.localeCompare(b.name));
    return result;
  }, [rows, query, filter, sort]);

  const pages = paginateConditionGroups(groupPricingRows(filtered), pageSize);
  const totalPages = Math.max(1, pages.length);
  const currentPage = Math.min(page, totalPages);
  const pageGroups = pages[currentPage - 1] || [];
  const pageRowCount = pageGroups.reduce((count, group) => count + group.rows.length, 0);
  const pageStart = pages.slice(0, currentPage - 1).reduce((count, groups) => count + groups.reduce((sum, group) => sum + group.rows.length, 0), 0);
  let totalHeight = 0;
  const positionedGroups = pageGroups.map(group => {
    const top = totalHeight;
    const height = GROUP_HEIGHT + (expanded.has(group.id) ? group.rows.length * ROW_HEIGHT : 0);
    totalHeight += height;
    return { ...group, top, height };
  });
  const virtual = pageRowCount > 30;
  const visibleGroups = virtual ? positionedGroups.filter(group => group.top + group.height >= scrollTop - 192 && group.top <= scrollTop + WINDOW_HEIGHT + 192) : positionedGroups;
  const topSpace = visibleGroups[0]?.top || 0;
  const lastGroup = visibleGroups.at(-1);
  const bottomSpace = lastGroup ? totalHeight - lastGroup.top - lastGroup.height : 0;
  const selected = rows.find(row => row.id === selectedId);
  const conditionHolds = new Map<string, Record<string, number>>();
  for (const row of rows) if (needsAttention(row.statusKey)) {
    const counts = conditionHolds.get(row.conditionId) || {};
    counts[row.statusKey] = (counts[row.statusKey] || 0) + 1;
    conditionHolds.set(row.conditionId, counts);
  }

  const resetView = () => { setPage(1); setScrollTop(0); setExpanded(new Set()); scrollRef.current?.scrollTo({ top: 0 }); };
  const changePage = (nextPage: number) => { setPage(nextPage); setScrollTop(0); setExpanded(new Set()); scrollRef.current?.scrollTo({ top: 0 }); };
  const toggleGroup = (id: string) => setExpanded(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const exportFiltered = () => {
    const statusLabels: Record<string, string> = { missing_input: 'No input', missing_price: 'Missing price', missing_labor_rate: 'Missing labor rate', priced: 'Complete', manual_override: 'Manual override', expired: 'Expired quote' };
    const records = [['Condition', 'Output', 'Production', 'Status'], ...filtered.map(row => [row.conditionName, row.name, row.production, statusLabels[row.statusKey] || row.statusKey])];
    const csv = records.map(record => record.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pricing-coverage-filtered.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return <>
    <div className="mb-3 flex flex-wrap items-end gap-2" aria-label="Pricing grid controls">
      <label className="min-w-44 flex-1 text-xs text-muted-foreground sm:max-w-xs">Search outputs
        <Input value={query} onChange={event => { setQuery(event.target.value); resetView(); }} placeholder="Condition, drawing, source…" className="mt-1 h-9" />
      </label>
      <label className="text-xs text-muted-foreground">Status
        <select value={filter} onChange={event => { setFilter(event.target.value); resetView(); }} className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
          <option value="all">All statuses</option><option value="needs-attention">Needs attention</option><option value="missing_input">No input</option><option value="missing_price">Missing price</option><option value="missing_labor_rate">Missing labor</option><option value="expired">Expired quote</option><option value="priced">Complete</option>
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Sort
        <select value={sort} onChange={event => { setSort(event.target.value); resetView(); }} className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
          <option value="priority">Attention first</option><option value="name">Condition A–Z</option><option value="quantity-desc">Quantity high to low</option><option value="quantity-asc">Quantity low to high</option>
        </select>
      </label>
      <button type="button" onClick={exportFiltered} disabled={!filtered.length} className="carez-button-neutral h-9 rounded-md border border-input bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:border-ring hover:bg-accent disabled:opacity-40">Export filtered CSV</button>
    </div>
    <div role="table" aria-label="Pricing outputs" aria-rowcount={filtered.length} className="overflow-hidden rounded-lg border text-sm">
      <div role="rowgroup" className="hidden border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:block">
        <div role="row" className="grid grid-cols-[minmax(0,2fr)_minmax(110px,.65fr)_minmax(145px,.85fr)_100px]">
          <div role="columnheader" className="px-3 py-2">Condition / output</div><div role="columnheader" className="px-3 py-2 text-right">Production</div><div role="columnheader" className="px-3 py-2">Status</div><div role="columnheader" className="px-3 py-2 text-right">Detail</div>
        </div>
      </div>
      <div role="rowgroup" ref={scrollRef} className={virtual ? 'overflow-y-auto' : ''} style={virtual ? { height: WINDOW_HEIGHT } : undefined} onScroll={virtual ? event => setScrollTop(event.currentTarget.scrollTop) : undefined}>
        {virtual && topSpace > 0 ? <div aria-hidden="true" style={{ height: topSpace }} /> : null}
        {visibleGroups.map(group => { const holds = conditionHolds.get(group.id); return <details key={group.id} open={expanded.has(group.id)} className="group border-b border-border/70 last:border-b-0"><summary onClick={event => { event.preventDefault(); toggleGroup(group.id); }} className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 border-l-2 border-transparent bg-muted/60 px-3 text-xs hover:bg-muted focus-visible:border-primary"><span className="flex min-w-0 items-center gap-2"><ChevronRight aria-hidden="true" size={14} className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"/><span className="truncate font-semibold">{group.name}</span></span><span className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[11px]"><span className="font-mono text-muted-foreground">{group.rows.length} output{group.rows.length === 1 ? '' : 's'}</span>{holds ? <span className="font-semibold text-warning">{Object.entries(holds).map(([status, count]) => `${count} ${attentionLabel[status]}`).join(' · ')}</span> : <span className="text-muted-foreground">No pricing holds</span>}</span></summary>{group.rows.map(row => <div role="row" key={row.id} className="grid h-12 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border/70 last:border-b-0 lg:grid-cols-[minmax(0,2fr)_minmax(110px,.65fr)_minmax(145px,.85fr)_100px]">
          <div role="cell" className="min-w-0 px-3"><div className="flex min-w-0 items-center gap-3"><span className="truncate font-medium" title={row.name}>{row.name}</span>{row.sourceHref ? <a href={row.sourceHref} className="shrink-0 text-[11px] font-medium text-primary underline-offset-2 hover:underline">{row.sourceAction}</a> : null}</div><div className="mt-0.5 flex items-center gap-2 lg:hidden">{row.badge}<span className="truncate font-mono text-[11px] text-muted-foreground">{row.production}</span></div></div>
          <div role="cell" className="hidden truncate px-3 text-right font-mono text-xs font-semibold tabular-nums lg:block">{row.production}</div>
          <div role="cell" className="hidden min-w-0 px-3 lg:block">{row.badge}</div>
          <div role="cell" className="px-2 text-right lg:px-3"><button type="button" className="carez-button-neutral h-8 rounded-md border border-input bg-secondary px-2.5 text-xs font-medium text-secondary-foreground hover:border-ring hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-row-id={row.id} onClick={event => setSelectedId(event.currentTarget.dataset.rowId || null)}>View / Edit</button></div>
        </div>)}</details>; })}
        {virtual && bottomSpace > 0 ? <div aria-hidden="true" style={{ height: bottomSpace }} /> : null}
        {filtered.length === 0 ? <div className="px-3 py-8 text-center text-sm text-muted-foreground">No pricing outputs match these filters.</div> : null}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span aria-live="polite">{filtered.length ? `${pageStart + 1}–${pageStart + pageRowCount} of ${filtered.length}` : '0 results'}</span>
      <div className="flex items-center gap-2">
        <label>Rows <select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); resetView(); }} className="rounded border border-input bg-background px-1 py-1 text-foreground">{PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>Previous</Button>
        <span className="tabular-nums">{currentPage} / {totalPages}</span>
        <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)}>Next</Button>
      </div>
    </div>
    <PourtraceDialog variant="review" open={Boolean(selected)} onOpenChange={open => { if (!open) { setSelectedId(null); handledRequest.current = null; const url = new URL(window.location.href); url.searchParams.delete('pricingOutput'); window.history.replaceState(null, '', url); } }} title={selected?.name || 'Pricing output'} description={selected?.measurement}>
        {selected ? <div className="space-y-5 p-4">
          <div className="grid grid-cols-2 gap-3 border-b pb-4"><div><div className="text-xs text-muted-foreground">Production</div><div className="mt-1 font-mono text-sm font-semibold">{selected.production}</div></div><div><div className="text-xs text-muted-foreground">Status</div><div className="mt-1">{selected.badge}</div></div></div>
          <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current source</h3><div className="mt-2 text-sm">{selected.source || 'No pricing source recorded.'}</div></section>
          <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quote candidates</h3><div className="mt-2">{selected.quoteCandidates}</div></section>
          {selected.sourceHref ? <a href={selected.sourceHref} className="inline-flex min-h-9 items-center border border-primary/50 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20">{selected.sourceAction}</a> : null}
          {selected.costHref ? <a href={selected.costHref} className="inline-flex min-h-9 items-center border border-primary/50 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20">Edit unit cost</a> : null}
        </div> : null}
    </PourtraceDialog>
  </>;
}
