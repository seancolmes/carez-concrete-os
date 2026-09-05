'use client';

import {useMemo,useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {
  AlertTriangle,Boxes,CalendarClock,CheckCircle2,ClipboardCheck,HardHat,MoreHorizontal,PackageCheck,Plus,Search,ShoppingCart,Truck,
} from 'lucide-react';
import {
  createResourceRequirement,deleteResourceRequirement,linkPurchaseOrderLine,markMaterialConsumed,reserveEquipment,reserveMaterial,
  restoreResourceRequirement,updateVendorCommitment,waiveResourceRequirement,
} from '@/app/readiness/resources/actions';
import {CarezDataGrid,CarezDataGridBody,CarezDataGridCell,CarezDataGridHead,CarezDataGridHeaderCell,CarezDataGridRow,CarezDataGridTable} from '@/components/carez/data-grid';
import {CarezDateTimeField,CarezDateTimeRange,CarezNumberField} from '@/components/carez/fields';
import {CarezRelatedToolsMenu} from '@/components/carez/related-tools-menu';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {Sheet,SheetContent,SheetDescription,SheetFooter,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Textarea} from '@/components/ui/textarea';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
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
  return <Badge variant={blocked?'destructive':'outline'} className={cn(
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
    <ToggleGroup value={[view]} onValueChange={values=>{const next=values[0] as ViewMode|undefined;if(next)setView(next)}} size="sm" aria-label="Resource readiness view">
      <ToggleGroupItem value="attention"><AlertTriangle className="size-3.5"/> Needs attention</ToggleGroupItem>
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="cleared"><CheckCircle2 className="size-3.5"/> Cleared</ToggleGroupItem>
    </ToggleGroup>
    <div className="relative min-w-[240px] flex-1 lg:ml-auto lg:w-[320px] lg:flex-none">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
      <Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search work or resource" className="h-8 pl-8 text-xs" aria-label="Search resource requirements"/>
    </div>
    <NativeSelect size="sm" className="w-36" value={typeFilter} onChange={event=>setTypeFilter(event.target.value)} aria-label="Filter by resource type">
      <NativeSelectOption value="all">Type: All</NativeSelectOption><NativeSelectOption value="material">Material</NativeSelectOption><NativeSelectOption value="equipment">Equipment</NativeSelectOption><NativeSelectOption value="vendor">Vendor</NativeSelectOption>
    </NativeSelect>
    <NativeSelect size="sm" className="w-40" value={jobFilter} onChange={event=>setJobFilter(event.target.value)} aria-label="Filter by job">
      <NativeSelectOption value="all">Job: All</NativeSelectOption>{jobs.map(job=><NativeSelectOption key={job} value={job}>{job}</NativeSelectOption>)}
    </NativeSelect>
    <NativeSelect size="sm" className="w-40" value={dueFilter} onChange={event=>setDueFilter(event.target.value)} aria-label="Filter by due date">
      <NativeSelectOption value="all">Due: Any</NativeSelectOption><NativeSelectOption value="7">Next 7 days</NativeSelectOption><NativeSelectOption value="overdue">Overdue</NativeSelectOption><NativeSelectOption value="undated">Not dated</NativeSelectOption>
    </NativeSelect>
  </div>;

  return <main className="mx-auto w-full max-w-[1540px] space-y-4 px-4 py-4 sm:px-5 lg:px-6">
    <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><div className="text-xs text-muted-foreground">Work readiness</div><h1 className="mt-1 text-xl font-semibold tracking-tight">Resource readiness</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Track material, equipment, and vendor readiness against the work that needs them.</p></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2"><CarezRelatedToolsMenu items={relatedTools}/><Button type="button" size="sm" onClick={()=>{setActionError('');setResourceType('material');setAddOpen(true)}}><Plus className="size-3.5"/> Add requirement</Button></div>
    </div>

    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {label:'Blocking work',value:blocked.length,help:'Required resources blocking starts.',tone:blocked.length?'danger':''},
        {label:'Due next 7 days',value:dueSoon.length,help:'Blocking items due within seven days.',tone:dueSoon.length?'warning':''},
        {label:'Warnings',value:warnings.length,help:'Unresolved confirmations or shortages.',tone:warnings.length?'warning':''},
        {label:'Cleared',value:cleared.length,help:'Ready or explicitly waived.',tone:''},
      ].map(metric=><div key={metric.label} className={cn('rounded-md border border-border bg-card/30 p-3',metric.tone==='danger'&&'border-destructive/30',metric.tone==='warning'&&'border-warning/25')}><div className="text-[11px] text-muted-foreground">{metric.label}</div><div className={cn('mt-2 font-mono text-xl tabular-nums',metric.tone==='danger'&&'text-destructive',metric.tone==='warning'&&'text-warning')}>{metric.value}</div><div className="mt-1 text-[11px] text-muted-foreground">{metric.help}</div></div>)}
    </div>

    <CarezDataGrid
      aria-label="Resource readiness requirements"
      toolbar={toolbar}
      footer={<><span>{filteredRows.length} of {rows.length} requirements</span><span className="font-mono tabular-nums">Blocking {blocked.length} · Due soon {dueSoon.length} · Warnings {warnings.length}</span></>}
      isEmpty={filteredRows.length===0}
      empty={<Empty className="min-h-64 rounded-none border-0"><EmptyHeader><EmptyMedia variant="icon"><PackageCheck/></EmptyMedia><EmptyTitle>{rows.length?'No requirements match this view':'No resource requirements yet'}</EmptyTitle><EmptyDescription>{rows.length?'Adjust the active filters to review other resource requirements.':'Add a requirement to work that needs material, equipment, or outside services.'}</EmptyDescription></EmptyHeader><EmptyContent><Button type="button" size="sm" onClick={()=>setAddOpen(true)}><Plus className="size-3.5"/> Add requirement</Button></EmptyContent></Empty>}
    >
      <CarezDataGridTable>
        <CarezDataGridHead><tr><CarezDataGridHeaderCell>Work</CarezDataGridHeaderCell><CarezDataGridHeaderCell>Resource</CarezDataGridHeaderCell><CarezDataGridHeaderCell>Type</CarezDataGridHeaderCell><CarezDataGridHeaderCell>Need by</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Required</CarezDataGridHeaderCell><CarezDataGridHeaderCell>Coverage</CarezDataGridHeaderCell><CarezDataGridHeaderCell>Status</CarezDataGridHeaderCell><CarezDataGridHeaderCell className="w-12 text-center">Actions</CarezDataGridHeaderCell></tr></CarezDataGridHead>
        <CarezDataGridBody>{filteredRows.map(row=><CarezDataGridRow key={row.id} className={cn('cursor-pointer',isBlocked(row)&&'border-l-2 border-l-destructive/55')} onClick={()=>{setActionError('');setSelectedId(row.id)}}>
          <CarezDataGridCell><div className="max-w-[280px]"><div className="truncate text-xs font-medium">{workLabel(row)}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{titleCase(row.operation_status||'')}</div></div></CarezDataGridCell>
          <CarezDataGridCell><div className="max-w-[260px]"><div className="truncate text-xs font-medium">{row.label}</div>{row.warning_reason||row.blocking_reason?<div className={cn('mt-0.5 truncate text-[11px]',row.blocking_reason?'text-destructive':'text-warning')}>{row.blocking_reason||row.warning_reason}</div>:null}</div></CarezDataGridCell>
          <CarezDataGridCell><div className="flex items-center gap-1.5 text-xs"><ResourceIcon type={row.resource_type}/>{titleCase(row.resource_type)}</div></CarezDataGridCell>
          <CarezDataGridCell><span className="font-mono text-xs tabular-nums">{day(row.need_by_date)}</span></CarezDataGridCell>
          <CarezDataGridCell numeric>{q(row.required_quantity,row.unit)}</CarezDataGridCell>
          <CarezDataGridCell><Coverage row={row}/></CarezDataGridCell>
          <CarezDataGridCell><StatusBadge row={row}/></CarezDataGridCell>
          <CarezDataGridCell className="text-center" onClick={event=>event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" aria-label={`Actions for ${row.label}`}/> }><MoreHorizontal/></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>setSelectedId(row.id)}>Open details</DropdownMenuItem></DropdownMenuContent></DropdownMenu></CarezDataGridCell>
        </CarezDataGridRow>)}</CarezDataGridBody>
      </CarezDataGridTable>
    </CarezDataGrid>

    <Sheet open={addOpen} onOpenChange={setAddOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>Add resource requirement</SheetTitle><SheetDescription>Tie a resource to physical work and define when it must be ready.</SheetDescription></SheetHeader>
        <form className="space-y-4 px-4 pb-6" onSubmit={event=>submit(event,createResourceRequirement,{closeAdd:true,reset:true})}>
          <Field label="Physical work"><NativeSelect name="work_package_operation_id" required defaultValue=""><NativeSelectOption value="" disabled>Choose work package operation</NativeSelectOption>{operations.map(operation=><NativeSelectOption key={operation.operation_id} value={operation.operation_id}>{operation.job_number} — {operation.package_name} — {operation.field_label||operation.task_name}</NativeSelectOption>)}</NativeSelect></Field>
          <div className="space-y-1.5"><div className="text-xs font-medium">Type</div><ToggleGroup value={[resourceType]} onValueChange={values=>{const next=values[0] as ResourceType|undefined;if(next)setResourceType(next)}} size="sm" aria-label="Resource type"><ToggleGroupItem value="material"><Boxes className="size-3.5"/> Material</ToggleGroupItem><ToggleGroupItem value="equipment"><Truck className="size-3.5"/> Equipment</ToggleGroupItem><ToggleGroupItem value="vendor"><HardHat className="size-3.5"/> Vendor</ToggleGroupItem></ToggleGroup><input type="hidden" name="resource_type" value={resourceType}/></div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_90px]"><Field label="Resource"><Input name="label" required placeholder={resourceType==='material'?'Form ties':resourceType==='equipment'?'Line pump':'Testing agency'}/></Field><Field label="Required quantity"><CarezNumberField name="required_quantity" min="0.01" step="0.01" defaultValue="1" required/></Field><Field label="Unit"><Input name="unit" defaultValue="EA"/></Field></div>

          {resourceType==='material'?<div className="grid gap-3 rounded-md border border-border bg-muted/10 p-3 sm:grid-cols-2"><Field label="Inventory item"><NativeSelect name="inventory_item_id" defaultValue=""><NativeSelectOption value="">Not from inventory</NativeSelectOption>{inventory.map(item=><NativeSelectOption key={item.id} value={item.id}>{item.name} · {q(item.quantity_on_hand,item.unit)} on hand</NativeSelectOption>)}</NativeSelect></Field><Field label="Reserve from inventory"><CarezNumberField name="reserve_quantity" min="0" step="0.01" placeholder="0"/></Field><Field label="Purchase order line"><NativeSelect name="purchase_order_line_id" defaultValue=""><NativeSelectOption value="">Not linked</NativeSelectOption>{poLines.map(line=><NativeSelectOption key={line.id} value={line.id}>{line.purchase_order_number||''} — {line.description}</NativeSelectOption>)}</NativeSelect></Field></div>:null}

          {resourceType==='equipment'?<div className="space-y-3 rounded-md border border-border bg-muted/10 p-3"><Field label="Equipment"><NativeSelect name="equipment_asset_id" defaultValue=""><NativeSelectOption value="">Not assigned</NativeSelectOption>{equipment.map(item=><NativeSelectOption key={item.id} value={item.id}>{item.asset_number} — {item.name} · {item.status}</NativeSelectOption>)}</NativeSelect></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Reserve from"><CarezDateTimeField name="reservation_start"/></Field><Field label="Reserve through"><CarezDateTimeField name="reservation_end"/></Field></div><label className="flex items-center gap-2 text-xs"><Checkbox name="equipment_confirmed"/> Confirmed and available</label></div>:null}

          {resourceType==='vendor'?<div className="grid gap-3 rounded-md border border-border bg-muted/10 p-3 sm:grid-cols-2"><Field label="Vendor"><NativeSelect name="vendor_id" defaultValue=""><NativeSelectOption value="">Not selected</NativeSelectOption>{vendors.map(vendor=><NativeSelectOption key={vendor.id} value={vendor.id}>{vendor.name}</NativeSelectOption>)}</NativeSelect></Field><Field label="Status"><NativeSelect name="vendor_status" defaultValue="needed"><NativeSelectOption value="needed">Need vendor</NativeSelectOption><NativeSelectOption value="requested">Requested / waiting</NativeSelectOption><NativeSelectOption value="confirmed">Confirmed</NativeSelectOption><NativeSelectOption value="completed">Completed</NativeSelectOption></NativeSelect></Field><Field label="Confirmation / reference"><Input name="vendor_reference"/></Field></div>:null}

          <div className="grid gap-3 sm:grid-cols-2"><Field label="Need by override"><CarezDateTimeField name="need_by_override"/></Field><Field label="Schedule offset (days)"><CarezNumberField name="need_offset_days" step="1" defaultValue="0"/></Field></div>
          <Field label="Notes"><Textarea name="notes" placeholder="Resource-specific note"/></Field>
          <label className="flex items-center gap-2 text-xs"><Checkbox name="required_before_start" defaultChecked/> Block crew start until ready</label>
          {actionError?<div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionError}</div>:null}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>Add requirement</Button></div>
        </form>
      </SheetContent>
    </Sheet>

    <Sheet open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelectedId(null)}}>
      {selected?<SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><div className="flex items-start gap-3 pr-9"><div className="mt-0.5 rounded-md border border-border bg-muted/25 p-2"><ResourceIcon type={selected.resource_type}/></div><div className="min-w-0 flex-1"><SheetTitle>{selected.label}</SheetTitle><SheetDescription>{workLabel(selected)} · need by {day(selected.need_by_date)}</SheetDescription></div><StatusBadge row={selected}/></div></SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-md border border-border bg-muted/10 p-3"><div className="text-[11px] text-muted-foreground">Required</div><div className="mt-1 font-mono text-sm tabular-nums">{q(selected.required_quantity,selected.unit)}</div></div><div className="rounded-md border border-border bg-muted/10 p-3"><div className="text-[11px] text-muted-foreground">Type</div><div className="mt-1 text-sm">{titleCase(selected.resource_type)}</div></div><div className="rounded-md border border-border bg-muted/10 p-3"><div className="text-[11px] text-muted-foreground">Need by</div><div className="mt-1 font-mono text-sm tabular-nums">{day(selected.need_by_date)}</div></div></div>
          {selected.blocking_reason?<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"><strong>Do not start:</strong> {selected.blocking_reason}</div>:null}
          {selected.warning_reason?<div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"><strong>Watch:</strong> {selected.warning_reason}</div>:null}

          {selected.resource_type==='material'?<div className="space-y-3"><div className="text-sm font-medium">Resolve material</div><form className="space-y-3 rounded-md border border-border p-3" onSubmit={event=>submit(event,reserveMaterial)}><input type="hidden" name="requirement_id" value={selected.id}/><Field label="Reserve shop inventory"><NativeSelect name="inventory_item_id" defaultValue={selected.inventory_item_id||''} required><NativeSelectOption value="" disabled>Choose inventory</NativeSelectOption>{inventory.map(item=><NativeSelectOption key={item.id} value={item.id}>{item.name} · {q(item.quantity_on_hand,item.unit)} available</NativeSelectOption>)}</NativeSelect></Field><Field label="Quantity"><CarezNumberField name="quantity" min="0.01" step="0.01" defaultValue={selected.requirement_reserved_qty||selected.required_quantity}/></Field><Button type="submit" variant="outline" size="sm" disabled={pending}>Reserve inventory</Button></form><form className="space-y-3 rounded-md border border-border p-3" onSubmit={event=>submit(event,linkPurchaseOrderLine)}><input type="hidden" name="requirement_id" value={selected.id}/><Field label="Existing purchase order line"><NativeSelect name="purchase_order_line_id" defaultValue={selected.purchase_order_line_id||''} required><NativeSelectOption value="" disabled>Choose PO line</NativeSelectOption>{poLines.map(line=><NativeSelectOption key={line.id} value={line.id}>{line.purchase_order_number||''} — {line.description}</NativeSelectOption>)}</NativeSelect></Field><Button type="submit" variant="outline" size="sm" disabled={pending}>Link purchase order</Button></form>{n(selected.requirement_reserved_qty)>0?<form onSubmit={event=>submit(event,markMaterialConsumed)}><input type="hidden" name="requirement_id" value={selected.id}/><Button type="submit" variant="outline" size="sm" disabled={pending}>Mark reserved material used</Button></form>:null}</div>:null}

          {selected.resource_type==='equipment'?<div className="space-y-3"><div className="text-sm font-medium">Reserve equipment</div><form className="space-y-3 rounded-md border border-border p-3" onSubmit={event=>submit(event,reserveEquipment)}><input type="hidden" name="requirement_id" value={selected.id}/><Field label="Equipment"><NativeSelect name="equipment_asset_id" defaultValue={selected.equipment_asset_id||''} required><NativeSelectOption value="" disabled>Choose equipment</NativeSelectOption>{equipment.map(item=><NativeSelectOption key={item.id} value={item.id}>{item.asset_number} — {item.name} · {item.status}</NativeSelectOption>)}</NativeSelect></Field><Field label="Reservation"><CarezDateTimeRange startName="start_date" endName="end_date" startValue={selected.equipment_start_date||selected.need_by_date||''} endValue={selected.equipment_end_date||selected.need_by_date||''}/></Field><label className="flex items-center gap-2 text-xs"><Checkbox name="confirmed" defaultChecked={selected.reservation_status==='confirmed'}/> Confirmed and available</label><Button type="submit" variant="outline" size="sm" disabled={pending}>Save reservation</Button></form></div>:null}

          {selected.resource_type==='vendor'?<div className="space-y-3"><div className="text-sm font-medium">Vendor confirmation</div><form className="space-y-3 rounded-md border border-border p-3" onSubmit={event=>submit(event,updateVendorCommitment)}><input type="hidden" name="requirement_id" value={selected.id}/><div className="grid gap-3 sm:grid-cols-2"><Field label="Vendor"><NativeSelect name="vendor_id" defaultValue={selected.vendor_id||''}><NativeSelectOption value="">Not selected</NativeSelectOption>{vendors.map(vendor=><NativeSelectOption key={vendor.id} value={vendor.id}>{vendor.name}</NativeSelectOption>)}</NativeSelect></Field><Field label="Status"><NativeSelect name="vendor_status" defaultValue={selected.vendor_status||'needed'}><NativeSelectOption value="needed">Need vendor</NativeSelectOption><NativeSelectOption value="requested">Requested / waiting</NativeSelectOption><NativeSelectOption value="confirmed">Confirmed</NativeSelectOption><NativeSelectOption value="completed">Completed</NativeSelectOption><NativeSelectOption value="cancelled">Cancelled</NativeSelectOption></NativeSelect></Field></div><Field label="Confirmation / reference"><Input name="vendor_reference" defaultValue={selected.vendor_reference||''}/></Field><Button type="submit" variant="outline" size="sm" disabled={pending}>Save vendor status</Button></form></div>:null}

          {actionError?<div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionError}</div>:null}
          <div className="border-t border-border pt-4"><div className="mb-2 text-xs font-medium text-muted-foreground">Requirement controls</div>{selected.waived_at?<form onSubmit={event=>submit(event,restoreResourceRequirement)} className="flex items-center gap-2"><input type="hidden" name="requirement_id" value={selected.id}/><Button type="submit" variant="outline" size="sm" disabled={pending}>Restore requirement</Button></form>:<form onSubmit={event=>submit(event,waiveResourceRequirement)} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="requirement_id" value={selected.id}/><Input name="waiver_reason" required placeholder="Reason it is safe to proceed"/><Button type="submit" variant="outline" size="sm" disabled={pending}>Waive</Button></form>}</div>
        </div>
        <SheetFooter className="border-t border-border"><form className="ml-auto" onSubmit={event=>submit(event,deleteResourceRequirement,{closeDetail:true})}><input type="hidden" name="requirement_id" value={selected.id}/><Button type="submit" variant="destructive" size="sm" disabled={pending}>Delete requirement</Button></form></SheetFooter>
      </SheetContent>:null}
    </Sheet>
  </main>;
}
