'use client';

import * as React from 'react';
import {ChevronRight,Eye,EyeOff,Search} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ResizableHandle,ResizablePanel,ResizablePanelGroup} from '@/components/ui/resizable';
import {cn} from '@/lib/utils';

export function CarezToolbar({className,...props}:React.ComponentProps<'div'>){
  return <div data-slot="carez-toolbar" className={cn('flex min-h-9 flex-nowrap items-center gap-1 overflow-x-auto border-b border-border bg-background px-2 py-1',className)} {...props}/>;
}

export function CarezToolbarGroup({className,...props}:React.ComponentProps<'div'>){
  return <div data-slot="carez-toolbar-group" className={cn('flex shrink-0 items-center gap-1',className)} {...props}/>;
}

export function CarezToolbarSeparator({className,...props}:React.ComponentProps<'span'>){
  return <span aria-hidden="true" className={cn('mx-1 h-5 w-px shrink-0 bg-border',className)} {...props}/>;
}

export function CarezResizableWorkspace({className,...props}:React.ComponentProps<typeof ResizablePanelGroup>){
  return <ResizablePanelGroup className={cn('min-h-0 min-w-0 bg-background',className)} {...props}/>;
}

export function CarezWorkspacePane(props:React.ComponentProps<typeof ResizablePanel>){
  return <ResizablePanel {...props}/>;
}

export function CarezWorkspaceHandle({className,...props}:React.ComponentProps<typeof ResizableHandle>){
  return <ResizableHandle withHandle className={cn('bg-border/80 hover:bg-foreground/25',className)} {...props}/>;
}

export type CarezConditionTreeNode={
  id:string;
  label:string;
  children?:CarezConditionTreeNode[];
  color?:string;
  status?:string;
  hidden?:boolean;
  disabled?:boolean;
};

function treeHasMatch(node:CarezConditionTreeNode,query:string):boolean{
  if(!query)return true;
  if(node.label.toLowerCase().includes(query))return true;
  return Boolean(node.children?.some(child=>treeHasMatch(child,query)));
}

export function CarezConditionTree({nodes,selectedId,onSelect,onVisibilityChange,searchable=true,className,ariaLabel='Condition tree'}:{
  nodes:CarezConditionTreeNode[];
  selectedId?:string|null;
  onSelect?:(node:CarezConditionTreeNode)=>void;
  onVisibilityChange?:(node:CarezConditionTreeNode,hidden:boolean)=>void;
  searchable?:boolean;
  className?:string;
  ariaLabel?:string;
}){
  const [query,setQuery]=React.useState('');
  const [expanded,setExpanded]=React.useState<Set<string>>(()=>new Set(nodes.filter(node=>node.children?.length).map(node=>node.id)));
  const normalized=query.trim().toLowerCase();
  const visible=nodes.filter(node=>treeHasMatch(node,normalized));

  const toggle=(id:string)=>setExpanded(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});

  const renderNode=(node:CarezConditionTreeNode,depth:number):React.ReactNode=>{
    if(!treeHasMatch(node,normalized))return null;
    const hasChildren=Boolean(node.children?.length);
    const open=expanded.has(node.id)||Boolean(normalized);
    const selected=node.id===selectedId;
    return <React.Fragment key={node.id}>
      <div className={cn('group flex min-h-8 items-center gap-1 border-b border-border/50 pr-1 text-xs',selected?'bg-accent text-accent-foreground':'hover:bg-muted/40',node.disabled&&'opacity-50')} style={{paddingLeft:(6+depth*14)+'px'}}>
        {hasChildren?<Button type="button" variant="ghost" size="icon-xs" onClick={()=>toggle(node.id)} aria-label={open?'Collapse '+node.label:'Expand '+node.label} aria-expanded={open}><ChevronRight className={cn('size-3 transition-transform duration-150 motion-reduce:transition-none',open&&'rotate-90')}/></Button>:<span className="size-6"/>}
        {node.color?<span className="size-2.5 shrink-0 rounded-[2px] border border-white/15" style={{backgroundColor:node.color}}/>:null}
        <button type="button" disabled={node.disabled} onClick={()=>onSelect?.(node)} onKeyDown={event=>{if(event.key==='ArrowRight'&&hasChildren&&!open){event.preventDefault();toggle(node.id)}if(event.key==='ArrowLeft'&&hasChildren&&open){event.preventDefault();toggle(node.id)}}} className="min-w-0 flex-1 truncate py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40">{node.label}</button>
        {node.status?<span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{node.status}</span>:null}
        {onVisibilityChange?<Button type="button" variant="ghost" size="icon-xs" className="opacity-60 group-hover:opacity-100" onClick={()=>onVisibilityChange(node,!node.hidden)} aria-label={(node.hidden?'Show ':'Hide ')+node.label}>{node.hidden?<EyeOff/>:<Eye/>}</Button>:null}
      </div>
      {hasChildren&&open?<div>{node.children!.map(child=>renderNode(child,depth+1))}</div>:null}
    </React.Fragment>;
  };

  return <div className={cn('min-h-0 overflow-hidden rounded-md border border-border bg-background',className)} aria-label={ariaLabel}>
    {searchable?<div className="relative border-b border-border p-2"><Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Filter conditions" className="h-7 pl-7 text-xs"/></div>:null}
    <div className="max-h-full overflow-auto" role="tree">{visible.length?visible.map(node=>renderNode(node,0)):<div className="px-3 py-6 text-center text-xs text-muted-foreground">No matching items.</div>}</div>
  </div>;
}
