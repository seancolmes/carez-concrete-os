'use client';

import {Badge,Button,Checkbox,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger,Input,Menu,MenuItem,MenuList,MenuPopover,MenuTrigger,Select,Tab,TabList,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow,Textarea} from '@fluentui/react-components';
import {useMemo,useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import { WarningRegular as AlertTriangle, BoxMultipleRegular as Boxes, CalendarClockRegular as CalendarClock, CheckmarkCircleRegular as CheckCircle2, ClipboardCheckmarkRegular as ClipboardCheck, PersonWrenchRegular as HardHat, MoreHorizontalRegular as MoreHorizontal, BoxCheckmarkRegular as PackageCheck, AddRegular as Plus, SearchRegular as Search, CartRegular as ShoppingCart, VehicleTruckRegular as Truck } from '@fluentui/react-icons';
import {
  createResourceRequirement,deleteResourceRequirement,linkPurchaseOrderLine,markMaterialConsumed,reserveEquipment,reserveMaterial,
  restoreResourceRequirement,updateVendorCommitment,waiveResourceRequirement,
} from '@/app/readiness/resources/actions';
import {cn} from '@/lib/utils';

type Row=Record<string,any>;
type Operation=Record<string,any>;
type InventoryItem=Record<string,any>;
type EquipmentItem=Record<string,any>;
type Vendor=Record<string,any>;
type PoLine=Record<string,any>;
type ViewMode='attention'|'all'|'cleared';
type ResourceType='material'|'equipment'|'vendor';
type ResourceAction=(data:FormData)=>Promise<void>;

const relatedTools=[
  {href:'/readiness',label:'Inspections',Icon:ClipboardCheck},
  {href:'/look-ahead',label:'Look-ahead',Icon:CalendarClock},
  {href:'/procurement',label:'Procurement',Icon:ShoppingCart},
];

const n=(value:any)=>Number(value||0);
const q=(value:any,unit?:string)=>`${n(value).toLocaleString(undefined,{maximumFractionDigits:2})}${unit?` ${unit}`:''}`;
const titleCase=(value:any)=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,character=>character.toUpperCase());
const day=(value?:string|null)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`)):'Not dated';
const isCleared=(row:Row)=>Boolean(row.waived_at)||['ready','waived'].includes(String(row.resource_status||''));
const isBlocked=(row:Row)=>Boolean(row.required_before_start)&&!isCleared(row);
const workLabel=(row:Row)=>[row.job_number,row.package_name,row.field_label||row.task_name].filter(Boolean).join(' — ')||'Work package operation';

function Field({label,children}:{label:string;children:React.ReactNode}){
  return <label className="grid min-w-0 gap-1.5 text-xs font-medium text-foreground"><span>{label}</span>{children}</label>;
}

function StatusBadge({row}:{row:Row}){
  const cleared=isCleared(row);
  const blocked=isBlocked(row);
  const warning=Boolean(row.warning_reason)&&!cleared;
  const label=cleared?(row.waived_at?'Waived':'Ready'):titleCase(row.resource_status||'Needed');
  return <Badge appearance={blocked?'filled':'outline'} color={blocked?'danger':'brand'} className={cn(
    'h-5 rounded-md px-1.5 text-[10px] uppercase tracking-[.04em]',
    cleared&&'border-success/30 bg-success/10 text-success',
    warning&&'border-warning/30 bg-warning/10 text-warning',
    !blocked&&!warning&&!cleared&&'text-muted-foreground',
  )}>{label}</Badge>;
}

function ResourceIcon({type}:{type:string}){
  if(type==='equipment')return <Truck className="size-3.5 text-muted-foreground"/>;
  if(type==='vendor')return <HardHat className="size-3.5 text-muted-foreground"/>;
  return <Boxes className="size-3.5 text-muted-foreground"/>;
}

function Coverage({row}:{row:Row}){
  if(row.resource_type==='material'){
    const short=n(row.shortage_quantity);
    return <div className="min-w-0"><div className={cn('font-mono text-xs tabular-nums',short>0?'text-destructive':'text-foreground')}>{short>0?`Short ${q(short,row.unit)}`:`${q(row.safe_inventory_qty,row.unit)} covered`}</div><div className="truncate text-[11px] text-muted-foreground">{q(row.received_qty,row.unit)} received</div></div>;
  }
  if(row.resource_type==='equipment')return <div className="min-w-0"><div className="truncate text-xs font-medium">{row.equipment_name||'Unassigned'}</div><div className="truncate text-[11px] text-muted-foreground">{titleCase(row.reservation_status||'No reservation')}</div></div>;
  return <div className="min-w-0"><div className="truncate text-xs font-medium">{row.vendor_name||'Vendor not selected'}</div><div className="truncate text-[11px] text-muted-foreground">{titleCase(row.vendor_status||'Needed')}</div></div>;
}

export function ResourceReadinessWorkspace({rows,operations,inventory,equipment,vendors,poLines,today,plus7}:{
  rows:Row[];operations:Operation[];inventory:InventoryItem[];equipment:EquipmentItem[];vendors:Vendor[];poLines:PoLine[];today:string;plus7:string;
}){
  const router=useRouter();
  const [view,setView]=useState<ViewMode>('attention');
  const [query,setQuery]=useState('');
  const [typeFilter,setTypeFilter]=useState('all');
  const [jobFilter,setJobFilter]=useState('all');
  const [dueFilter,setDueFilter]=useState('all');
  const [addOpen,setAddOpen]=useState(false);
  const [resourceType,setResourceType]=useState<ResourceType>('material');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [actionError,setActionError]=useState('');
  const [pending,startTransition]=useTransition();

  const blocked=useMemo(()=>rows.filter(isBlocked),[rows]);
  const dueSoon=useMemo(()=>blocked.filter(row=>row.need_by_date&&row.need_by_date>=today&&row.need_by_date<=plus7),[blocked,today,plus7]);
  const warnings=useMemo(()=>rows.filter(row=>Boolean(row.warning_reason)&&!isCleared(row)),[rows]);
  const cleared=useMemo(()=>rows.filter(isCleared),[rows]);
  const jobs=useMemo(()=>Array.from(new Set(rows.map(row=>String(row.job_number||'')).filter(Boolean))).sort(),[rows]);
  const selected=rows.find(row=>row.id===selectedId)||null;

  const filteredRows=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return rows.filter(row=>{
      const clearedRow=isCleared(row);
      if(view==='attention'&&clearedRow)return false;
      if(view==='cleared'&&!clearedRow)return false;
      if(typeFilter!=='all'&&row.resource_type!==typeFilter)return false;
      if(jobFilter!=='all'&&row.job_number!==jobFilter)return false;
      if(dueFilter==='7'&&(!row.need_by_date||row.need_by_date<today||row.need_by_date>plus7))return false;
      if(dueFilter==='overdue'&&(!row.need_by_date||row.need_by_date>=today||clearedRow))return false;
      if(dueFilter==='undated'&&row.need_by_date)return false;
      if(!needle)return true;
      return [workLabel(row),row.label,row.resource_type,row.resource_status,row.warning_reason,row.blocking_reason,row.vendor_name,row.equipment_name,row.notes]
        .some(value=>String(value||'').toLowerCase().includes(needle));
    });
  },[rows,view,typeFilter,jobFilter,dueFilter,query,today,plus7]);

  function submit(event:FormEvent<HTMLFormElement>,action:ResourceAction,{closeAdd=false,closeDetail=false,reset=false}:{closeAdd?:boolean;closeDetail?:boolean;reset?:boolean}={}){
    event.preventDefault();
    setActionError('');
    const form=event.currentTarget;
    const data=new FormData(form);
    startTransition(async()=>{
      try{
        await action(data);
        if(reset)form.reset();
        if(closeAdd)setAddOpen(false);
        if(closeDetail)setSelectedId(null);
        router.refresh();
      }catch(error){
        setActionError(error instanceof Error?error.message:'Unable to save this change.');
      }
    });
  }

  const toolbar=<div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2.5">
    <TabList selectedValue={view} onTabSelect={(_,data)=>setView(data.value as ViewMode)} size="small" aria-label="Resource readiness view">
      <Tab value="attention" icon={<AlertTriangle className="size-3.5"/>}>Needs attention</Tab>
      <Tab value="all">All</Tab>
      <Tab value="cleared" icon={<CheckCircle2 className="size-3.5"/>}>Cleared</Tab>
    </TabList>
    <div className="relative min-w-[240px] flex-1 lg:ml-auto lg:w-[320px] lg:flex-none">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
      <Input appearance="underline" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search work or resource" className="h-8 pl-8 text-xs" aria-label="Search resource requirements"/>
    </div>
    <Select appearance="outline" size="small" className="w-36" value={typeFilter} onChange={event=>setTypeFilter(event.target.value)} aria-label="Filter by resource type">
      <option value="all">Type: All</option><option value="material">Material</option><option value="equipment">Equipment</option><option value="vendor">Vendor</option>
    </Select>
    <Select appearance="outline" size="small" className="w-40" value={jobFilter} onChange={event=>setJobFilter(event.target.value)} aria-label="Filter by job">
      <option value="all">Job: All</option>{jobs.map(job=><option key={job} value={job}>{job}</option>)}
    </Select>
    <Select appearance="outline" size="small" className="w-40" value={dueFilter} onChange={event=>setDueFilter(event.target.value)} aria-label="Filter by due date">
      <option value="all">Due: Any</option><option value="7">Next 7 days</option><option value="overdue">Overdue</option><option value="undated">Not dated</option>
    </Select>
  </div>;

  return <main className="mx-auto w-full max-w-[1540px] space-y-4 px-4 py-4 sm:px-5 lg:px-6">
    <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><div className="text-xs text-muted-foreground">Work readiness</div><h1 className="mt-1 text-xl font-semibold tracking-tight">Resource readiness</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Track material, equipment, and vendor readiness against the work that needs them.</p></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2"><Menu><MenuTrigger><Button appearance="outline" size="small">Related tools</Button></MenuTrigger><MenuPopover><MenuList>{relatedTools.map(({href,label,Icon})=><MenuItem key={href} onClick={()=>router.push(href)} icon={<Icon/>}>{label}</MenuItem>)}</MenuList></MenuPopover></Menu><Button type="button" appearance="primary" size="small" icon={<Plus className="size-3.5"/>} onClick={()=>{setActionError('');setResourceType('material');setAddOpen(true)}}>Add requirement</Button></div>
    </div>

    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {label:'Blocking work',value:blocked.length,help:'Required resources blocking starts.',tone:blocked.length?'danger':''},
        {label:'Due next 7 days',value:dueSoon.length,help:'Blocking items due within seven days.',tone:dueSoon.length?'warning':''},
        {label:'Warnings',value:warnings.length,help:'Unresolved confirmations or shortages.',tone:warnings.length?'warning':''},
        {label:'Cleared',value:cleared.length,help:'Ready or explicitly waived.',tone:''},
      ].map(metric=><div key={metric.label} className={cn('rounded-md border border-border bg-card/30 p-3',metric.tone==='danger'&&'border-destructive/30',metric.tone==='warning'&&'border-warning/25')}><div className="text-[11px] text-muted-foreground">{metric.label}</div><div className={cn('mt-2 font-mono text-xl tabular-nums',metric.tone==='danger'&&'text-destructive',metric.tone==='warning'&&'text-warning')}>{metric.value}</div><div className="mt-1 text-[11px] text-muted-foreground">{metric.help}</div></div>)}
    </div>

    <section aria-label="Resource readiness requirements" className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border p-2">{toolbar}</div>
      {filteredRows.length===0?<div className="flex min-h-64 flex-col items-center justify-center gap-3 p-4 text-center"><PackageCheck/><div><h3 className="text-sm font-semibold">{rows.length?'No requirements match this view':'No resource requirements yet'}</h3><p className="text-xs text-muted-foreground">{rows.length?'Adjust the active filters to review other resource requirements.':'Add a requirement to work that needs material, equipment, or outside services.'}</p></div><Button type="button" appearance="primary" size="small" icon={<Plus/>} onClick={()=>setAddOpen(true)}>Add requirement</Button></div>:<div className="overflow-x-auto">
      <Table className="w-full min-w-[1100px] text-left text-xs">
        <TableHeader><TableRow><TableHeaderCell>Work</TableHeaderCell><TableHeaderCell>Resource</TableHeaderCell><TableHeaderCell>Type</TableHeaderCell><TableHeaderCell>Need by</TableHeaderCell><TableHeaderCell className="text-right">Required</TableHeaderCell><TableHeaderCell>Coverage</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell className="w-12 text-center">Actions</TableHeaderCell></TableRow></TableHeader>
        <TableBody>{filteredRows.map(row=><TableRow key={row.id} className={cn('cursor-pointer',isBlocked(row)&&'border-l-2 border-l-destructive/55')} onClick={()=>{setActionError('');setSelectedId(row.id)}}>
          <TableCell><div className="max-w-[280px]"><div className="truncate text-xs font-medium">{workLabel(row)}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{titleCase(row.operation_status||'')}</div></div></TableCell>
          <TableCell><div className="max-w-[260px]"><div className="truncate text-xs font-medium">{row.label}</div>{row.warning_reason||row.blocking_reason?<div className={cn('mt-0.5 truncate text-[11px]',row.blocking_reason?'text-destructive':'text-warning')}>{row.blocking_reason||row.warning_reason}</div>:null}</div></TableCell>
          <TableCell><div className="flex items-center gap-1.5 text-xs"><ResourceIcon type={row.resource_type}/>{titleCase(row.resource_type)}</div></TableCell>
          <TableCell><span className="font-mono text-xs tabular-nums">{day(row.need_by_date)}</span></TableCell>
          <TableCell className="text-right">{q(row.required_quantity,row.unit)}</TableCell>
          <TableCell><Coverage row={row}/></TableCell>
          <TableCell><StatusBadge row={row}/></TableCell>
          <TableCell className="text-center" onClick={event=>event.stopPropagation()}><Button type="button" appearance="subtle" size="small" icon={<MoreHorizontal/>} aria-label={`Open details for ${row.label}`} onClick={()=>setSelectedId(row.id)}/></TableCell>
        </TableRow>)}</TableBody>
      </Table>
      </div>}
      <div className="flex flex-wrap justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground"><span>{filteredRows.length} of {rows.length} requirements</span><span className="font-mono tabular-nums">Blocking {blocked.length} · Due soon {dueSoon.length} · Warnings {warnings.length}</span></div>
    </section>

    <Dialog open={addOpen} onOpenChange={(_,data)=>setAddOpen(data.open)}>
      <DialogSurface className="w-full overflow-y-auto sm:max-w-xl !fixed !right-0 !top-0 !m-0 !h-dvh !max-h-dvh !rounded-none"><DialogBody><DialogContent><div className="flex justify-end"><DialogTrigger action="close"><Button type="button" appearance="subtle" size="small">Close</Button></DialogTrigger></div>
        <div><DialogTitle>Add resource requirement</DialogTitle><p>Tie a resource to physical work and define when it must be ready.</p></div>
        <form className="space-y-4 px-4 pb-6" onSubmit={event=>submit(event,createResourceRequirement,{closeAdd:true,reset:true})}>
          <Field label="Physical work"><Select appearance="outline" name="work_package_operation_id" required defaultValue=""><option value="" disabled>Choose work package operation</option>{operations.map(operation=><option key={operation.operation_id} value={operation.operation_id}>{operation.job_number} — {operation.package_name} — {operation.field_label||operation.task_name}</option>)}</Select></Field>
          <div className="space-y-1.5"><div className="text-xs font-medium">Type</div><TabList selectedValue={resourceType} onTabSelect={(_,data)=>setResourceType(data.value as ResourceType)} size="small" aria-label="Resource type"><Tab value="material" icon={<Boxes className="size-3.5"/>}>Material</Tab><Tab value="equipment" icon={<Truck className="size-3.5"/>}>Equipment</Tab><Tab value="vendor" icon={<HardHat className="size-3.5"/>}>Vendor</Tab></TabList><input type="hidden" name="resource_type" value={resourceType}/></div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_90px]"><Field label="Resource"><Input appearance="underline" name="label" required placeholder={resourceType==='material'?'Form ties':resourceType==='equipment'?'Line pump':'Testing agency'}/></Field><Field label="Required quantity"><Input appearance="underline" type="number" name="required_quantity" min="0.01" step="0.01" defaultValue="1" required/></Field><Field label="Unit"><Input appearance="underline" name="unit" defaultValue="EA"/></Field></div>

          {resourceType==='material'?<div className="grid gap-3 rounded-md border border-border bg-muted/10 p-3 sm:grid-cols-2"><Field label="Inventory item"><Select appearance="outline" name="inventory_item_id" defaultValue=""><option value="">Not from inventory</option>{inventory.map(item=><option key={item.id} value={item.id}>{item.name} · {q(item.quantity_on_hand,item.unit)} on hand</option>)}</Select></Field><Field label="Reserve from inventory"><Input appearance="underline" type="number" name="reserve_quantity" min="0" step="0.01" placeholder="0"/></Field><Field label="Purchase order line"><Select appearance="outline" name="purchase_order_line_id" defaultValue=""><option value="">Not linked</option>{poLines.map(line=><option key={line.id} value={line.id}>{line.purchase_order_number||''} — {line.description}</option>)}</Select></Field></div>:null}

          {resourceType==='equipment'?<div className="space-y-3 rounded-md border border-border bg-muted/10 p-3"><Field label="Equipment"><Select appearance="outline" name="equipment_asset_id" defaultValue=""><option value="">Not assigned</option>{equipment.map(item=><option key={item.id} value={item.id}>{item.asset_number} — {item.name} · {item.status}</option>)}</Select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Reserve from"><Input appearance="underline" type="date" name="reservation_start"/></Field><Field label="Reserve through"><Input appearance="underline" type="date" name="reservation_end"/></Field></div><label className="flex items-center gap-2 text-xs"><Checkbox name="equipment_confirmed"/> Confirmed and available</label></div>:null}

          {resourceType==='vendor'?<div className="grid gap-3 rounded-md border border-border bg-muted/10 p-3 sm:grid-cols-2"><Field label="Vendor"><Select appearance="outline" name="vendor_id" defaultValue=""><option value="">Not selected</option>{vendors.map(vendor=><option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</Select></Field><Field label="Status"><Select appearance="outline" name="vendor_status" defaultValue="needed"><option value="needed">Need vendor</option><option value="requested">Requested / waiting</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option></Select></Field><Field label="Confirmation / reference"><Input appearance="underline" name="vendor_reference"/></Field></div>:null}

          <div className="grid gap-3 sm:grid-cols-2"><Field label="Need by override"><Input appearance="underline" type="date" name="need_by_override"/></Field><Field label="Schedule offset (days)"><Input appearance="underline" type="number" name="need_offset_days" step="1" defaultValue="0"/></Field></div>
          <Field label="Notes"><Textarea appearance="outline" name="notes" placeholder="Resource-specific note"/></Field>
          <label className="flex items-center gap-2 text-xs"><Checkbox name="required_before_start" defaultChecked/> Block crew start until ready</label>
          {actionError?<div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionError}</div>:null}
          <div className="flex justify-end gap-2"><Button type="button" appearance="outline" onClick={()=>setAddOpen(false)}>Cancel</Button><Button type="submit" appearance="primary" disabled={pending}>Add requirement</Button></div>
        </form>
      </DialogContent></DialogBody></DialogSurface>
    </Dialog>

    {selected?<Dialog open onOpenChange={(_,data)=>{if(!data.open)setSelectedId(null)}}>
      <DialogSurface className="w-full overflow-y-auto sm:max-w-xl !fixed !right-0 !top-0 !m-0 !h-dvh !max-h-dvh !rounded-none"><DialogBody><DialogContent><div className="flex justify-end"><DialogTrigger action="close"><Button type="button" appearance="subtle" size="small">Close</Button></DialogTrigger></div>
        <div><div className="flex items-start gap-3 pr-9"><div className="mt-0.5 rounded-md border border-border bg-muted/25 p-2"><ResourceIcon type={selected.resource_type}/></div><div className="min-w-0 flex-1"><DialogTitle>{selected.label}</DialogTitle><p>{workLabel(selected)} · need by {day(selected.need_by_date)}</p></div><StatusBadge row={selected}/></div></div>
        <div className="space-y-4 px-4 pb-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-md border border-border bg-muted/10 p-3"><div className="text-[11px] text-muted-foreground">Required</div><div className="mt-1 font-mono text-sm tabular-nums">{q(selected.required_quantity,selected.unit)}</div></div><div className="rounded-md border border-border bg-muted/10 p-3"><div className="text-[11px] text-muted-foreground">Type</div><div className="mt-1 text-sm">{titleCase(selected.resource_type)}</div></div><div className="rounded-md border border-border bg-muted/10 p-3"><div className="text-[11px] text-muted-foreground">Need by</div><div className="mt-1 font-mono text-sm tabular-nums">{day(selected.need_by_date)}</div></div></div>
          {selected.blocking_reason?<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"><strong>Do not start:</strong> {selected.blocking_reason}</div>:null}
          {selected.warning_reason?<div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"><strong>Watch:</strong> {selected.warning_reason}</div>:null}

          {selected.resource_type==='material'?<div className="space-y-3"><div className="text-sm font-medium">Resolve material</div><form className="space-y-3 rounded-md border border-border p-3" onSubmit={event=>submit(event,reserveMaterial)}><input type="hidden" name="requirement_id" value={selected.id}/><Field label="Reserve shop inventory"><Select appearance="outline" name="inventory_item_id" defaultValue={selected.inventory_item_id||''} required><option value="" disabled>Choose inventory</option>{inventory.map(item=><option key={item.id} value={item.id}>{item.name} · {q(item.quantity_on_hand,item.unit)} available</option>)}</Select></Field><Field label="Quantity"><Input appearance="underline" type="number" name="quantity" min="0.01" step="0.01" defaultValue={selected.requirement_reserved_qty||selected.required_quantity}/></Field><Button type="submit" appearance="outline" size="small" disabled={pending}>Reserve inventory</Button></form><form className="space-y-3 rounded-md border border-border p-3" onSubmit={event=>submit(event,linkPurchaseOrderLine)}><input type="hidden" name="requirement_id" value={selected.id}/><Field label="Existing purchase order line"><Select appearance="outline" name="purchase_order_line_id" defaultValue={selected.purchase_order_line_id||''} required><option value="" disabled>Choose PO line</option>{poLines.map(line=><option key={line.id} value={line.id}>{line.purchase_order_number||''} — {line.description}</option>)}</Select></Field><Button type="submit" appearance="outline" size="small" disabled={pending}>Link purchase order</Button></form>{n(selected.requirement_reserved_qty)>0?<form onSubmit={event=>submit(event,markMaterialConsumed)}><input type="hidden" name="requirement_id" value={selected.id}/><Button type="submit" appearance="outline" size="small" disabled={pending}>Mark reserved material used</Button></form>:null}</div>:null}

          {selected.resource_type==='equipment'?<div className="space-y-3"><div className="text-sm font-medium">Reserve equipment</div><form className="space-y-3 rounded-md border border-border p-3" onSubmit={event=>submit(event,reserveEquipment)}><input type="hidden" name="requirement_id" value={selected.id}/><Field label="Equipment"><Select appearance="outline" name="equipment_asset_id" defaultValue={selected.equipment_asset_id||''} required><option value="" disabled>Choose equipment</option>{equipment.map(item=><option key={item.id} value={item.id}>{item.asset_number} — {item.name} · {item.status}</option>)}</Select></Field><Field label="Reservation"><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"><Input appearance="underline" type="date" name="start_date" defaultValue={selected.equipment_start_date||selected.need_by_date||''}/><span className="text-xs text-muted-foreground">to</span><Input appearance="underline" type="date" name="end_date" defaultValue={selected.equipment_end_date||selected.need_by_date||''}/></div></Field><label className="flex items-center gap-2 text-xs"><Checkbox name="confirmed" defaultChecked={selected.reservation_status==='confirmed'}/> Confirmed and available</label><Button type="submit" appearance="outline" size="small" disabled={pending}>Save reservation</Button></form></div>:null}

          {selected.resource_type==='vendor'?<div className="space-y-3"><div className="text-sm font-medium">Vendor confirmation</div><form className="space-y-3 rounded-md border border-border p-3" onSubmit={event=>submit(event,updateVendorCommitment)}><input type="hidden" name="requirement_id" value={selected.id}/><div className="grid gap-3 sm:grid-cols-2"><Field label="Vendor"><Select appearance="outline" name="vendor_id" defaultValue={selected.vendor_id||''}><option value="">Not selected</option>{vendors.map(vendor=><option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</Select></Field><Field label="Status"><Select appearance="outline" name="vendor_status" defaultValue={selected.vendor_status||'needed'}><option value="needed">Need vendor</option><option value="requested">Requested / waiting</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Select></Field></div><Field label="Confirmation / reference"><Input appearance="underline" name="vendor_reference" defaultValue={selected.vendor_reference||''}/></Field><Button type="submit" appearance="outline" size="small" disabled={pending}>Save vendor status</Button></form></div>:null}

          {actionError?<div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionError}</div>:null}
          <div className="border-t border-border pt-4"><div className="mb-2 text-xs font-medium text-muted-foreground">Requirement controls</div>{selected.waived_at?<form onSubmit={event=>submit(event,restoreResourceRequirement)} className="flex items-center gap-2"><input type="hidden" name="requirement_id" value={selected.id}/><Button type="submit" appearance="outline" size="small" disabled={pending}>Restore requirement</Button></form>:<form onSubmit={event=>submit(event,waiveResourceRequirement)} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="requirement_id" value={selected.id}/><Input appearance="underline" name="waiver_reason" required placeholder="Reason it is safe to proceed"/><Button type="submit" appearance="outline" size="small" disabled={pending}>Waive</Button></form>}</div>
        </div>
        <div className="border-t border-border"><form className="ml-auto" onSubmit={event=>submit(event,deleteResourceRequirement,{closeDetail:true})}><input type="hidden" name="requirement_id" value={selected.id}/><Button type="submit" appearance="primary" className="bg-destructive text-destructive-foreground" size="small" disabled={pending}>Delete requirement</Button></form></div>
      </DialogContent></DialogBody></DialogSurface>
    </Dialog>:null}
  </main>;
}
