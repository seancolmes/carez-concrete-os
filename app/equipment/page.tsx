import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createEquipmentAsset,assignEquipment,recordEquipmentService,createInventoryItem,adjustInventory} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';
const detailsClass='rounded-lg border border-border bg-background';
const summaryClass='cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40';

export default async function EquipmentPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!profile?.company_id)redirect('/login');
 if(profile.role==='employee')redirect('/employee');
 const [{data:assets},{data:service},{data:inventory},{data:tx},{data:projects},{data:crew}]=await Promise.all([
  supabase.from('equipment_assets').select('*').eq('company_id',profile.company_id).eq('active',true).order('category').order('name'),
  supabase.from('equipment_service_logs').select('*').eq('company_id',profile.company_id).order('service_date',{ascending:false}).limit(20),
  supabase.from('inventory_items').select('*').eq('company_id',profile.company_id).eq('active',true).order('category').order('name'),
  supabase.from('inventory_transactions').select('*,projects(job_number,name),inventory_items(name,unit)').eq('company_id',profile.company_id).order('transaction_date',{ascending:false}).limit(20),
  supabase.from('projects').select('id,job_number,name').eq('status','active').order('job_number'),
  supabase.from('crew_members').select('id,name').eq('active',true).order('name')
 ]);
 void service;void tx;
 const due=(assets||[]).filter((a:any)=>a.next_service_date&&a.next_service_date<=today());
 const assigned=(assets||[]).filter((a:any)=>a.status==='assigned'||a.assigned_project_id);
 const low=(inventory||[]).filter((i:any)=>Number(i.quantity_on_hand||0)<=Number(i.reorder_point||0));

 return <AppShell userName={profile.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
   <header><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assets & stock</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Equipment & Inventory</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Know where the tools are, what needs service, and what supplies are running low.</p></header>

   <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Equipment and inventory summary">
    <Metric label="Active Equipment" value={(assets||[]).length} help="Trucks, trailers, tools and equipment being tracked."/>
    <Metric label="Assigned to Jobs" value={assigned.length} help="Equipment currently tied to a job or worker." tone={assigned.length?'warning':'default'}/>
    <Metric label="Service Due" value={due.length} help="Maintenance due now or overdue." tone={due.length?'destructive':'success'}/>
    <Metric label="Supplies Running Low" value={low.length} help="Inventory at or below reorder point." tone={low.length?'warning':'success'}/>
   </section>

   <section className="grid gap-4 xl:grid-cols-2">
    <Card className="shadow-none"><CardHeader><CardTitle>Add Equipment</CardTitle><CardDescription>Add a truck, trailer, tool, laser or reusable formwork asset.</CardDescription></CardHeader><CardContent><form action={createEquipmentAsset} className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Name"><Input name="name" required placeholder="M18 Rotary Hammer"/></Field><Field label="Asset #"><Input name="asset_number" placeholder="EQ-001"/></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Type"><select name="category" className={selectClass}><option value="truck">Truck</option><option value="trailer">Trailer</option><option value="equipment">Equipment</option><option value="power_tool">Power Tool</option><option value="hand_tool">Hand Tool</option><option value="laser">Laser / Layout</option><option value="formwork">Formwork Asset</option><option value="other">Other</option></select></Field><Field label="Status"><Input value="Available" readOnly/></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Make"><Input name="make"/></Field><Field label="Model"><Input name="model"/></Field></div><Field label="Serial / VIN"><Input name="serial_number"/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Purchase Date"><Input type="date" name="purchase_date"/></Field><Field label="Purchase Cost"><Input type="number" step="0.01" name="purchase_cost"/></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Current Hours / Meter"><Input type="number" step="0.1" name="current_meter_hours"/></Field><Field label="Next Service Date"><Input type="date" name="next_service_date"/></Field></div><Field label="Notes"><Input name="notes"/></Field><div><Button type="submit">Add Equipment</Button></div></form></CardContent></Card>

    <Card className="shadow-none"><CardHeader><CardTitle>Add Inventory Item</CardTitle><CardDescription>Track reusable form material and supplies that need a known on-hand quantity.</CardDescription></CardHeader><CardContent><form action={createInventoryItem} className="grid gap-3"><Field label="Item"><Input name="name" required placeholder="2x4x16 lumber"/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Category"><select name="category" className={selectClass}><option>formwork</option><option>rebar</option><option>stakes</option><option>hardware</option><option>consumables</option><option>safety</option><option>other</option></select></Field><Field label="Unit"><select name="unit" className={selectClass}><option>EA</option><option>LF</option><option>SF</option><option>LB</option><option>TON</option><option>GAL</option></select></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="On Hand"><Input type="number" step="0.01" name="quantity_on_hand" defaultValue="0"/></Field><Field label="Reorder At"><Input type="number" step="0.01" name="reorder_point" defaultValue="0"/></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Target Stock"><Input type="number" step="0.01" name="target_quantity"/></Field><Field label="Average Cost"><Input type="number" step="0.01" name="average_unit_cost"/></Field></div><Field label="Stored Where?"><Input name="storage_location" placeholder="Shop rack A"/></Field><div><Button type="submit">Add Inventory Item</Button></div></form></CardContent></Card>
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="Assets" title="Equipment Board" description="Assign equipment to jobs or workers and keep maintenance visible."/>
    {(assets||[]).length===0?<Empty className="min-h-44 border border-border bg-muted/10"><EmptyHeader><EmptyTitle>No equipment entered</EmptyTitle><EmptyDescription>Add trucks, trailers and important tools you want Carez to track.</EmptyDescription></EmptyHeader></Empty>:<div className="grid gap-4 lg:grid-cols-2">{(assets||[]).map((a:any)=>{
      const serviceDue=Boolean(a.next_service_date&&a.next_service_date<=today());
      return <Card key={a.id} className="gap-0 py-0 shadow-none"><CardHeader className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div><CardTitle>{a.asset_number?`${a.asset_number} — `:''}{a.name}</CardTitle><CardDescription className="mt-1">{[a.make,a.model,a.serial_number].filter(Boolean).join(' · ')||a.category.replaceAll('_',' ')}</CardDescription></div><AssetStatus status={serviceDue?'service_due':a.status}/></CardHeader><CardContent className="space-y-4 py-4"><div className="grid gap-3 sm:grid-cols-3"><MiniMetric label="Current Meter" value={Number(a.current_meter_hours||0).toFixed(1)}/><MiniMetric label="Next Service" value={a.next_service_date||'Not Set'} tone={serviceDue?'destructive':'default'}/><MiniMetric label="Purchase Cost" value={money(a.purchase_cost)}/></div>
       <details className={detailsClass}><summary className={summaryClass}>Assign / Update Status</summary><div className="border-t border-border p-3"><form action={assignEquipment} className="grid gap-3"><input type="hidden" name="id" value={a.id}/><Field label="Status"><select name="status" defaultValue={a.status} className={selectClass}><option value="available">Available</option><option value="assigned">Assigned</option><option value="service">In Service / Repair</option><option value="out_of_service">Out of Service</option></select></Field><Field label="Job"><select name="assigned_project_id" defaultValue={a.assigned_project_id||''} className={selectClass}><option value="">None</option>{(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></Field><Field label="Worker"><select name="assigned_crew_member_id" defaultValue={a.assigned_crew_member_id||''} className={selectClass}><option value="">None</option>{(crew||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><div><Button type="submit" variant="outline" size="sm">Save Assignment</Button></div></form></div></details>
       <details className={detailsClass}><summary className={summaryClass}>Record Service</summary><div className="border-t border-border p-3"><form action={recordEquipmentService} className="grid gap-3"><input type="hidden" name="equipment_id" value={a.id}/><div className="grid gap-3 sm:grid-cols-2"><Field label="Service Date"><Input type="date" name="service_date" defaultValue={today()}/></Field><Field label="Meter Hours"><Input type="number" step="0.1" name="meter_hours" defaultValue={Number(a.current_meter_hours||0)}/></Field></div><Field label="What Was Done?"><Input name="description" required placeholder="Oil/filter service"/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Cost"><Input type="number" step="0.01" name="cost"/></Field><Field label="Vendor"><Input name="vendor"/></Field></div><Field label="Next Service Date"><Input type="date" name="next_service_date"/></Field><div><Button type="submit" variant="outline" size="sm">Save Service</Button></div></form></div></details>
      </CardContent></Card>;
    })}</div>}
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="Stock" title="Form & Supply Inventory" description="Track reusable form material and shop supplies without turning this into a warehouse system."/>
    {(inventory||[]).length===0?<Empty className="min-h-44 border border-border bg-muted/10"><EmptyHeader><EmptyTitle>No inventory items</EmptyTitle><EmptyDescription>Add the material you actually care about keeping track of.</EmptyDescription></EmptyHeader></Empty>:<div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[900px] border-collapse text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr>{['Item','On Hand','Reorder At','Location','Avg Cost','Adjust'].map(head=><th key={head} className="border-b border-border px-3 py-2.5 font-medium">{head}</th>)}</tr></thead><tbody className="divide-y divide-border">{(inventory||[]).map((i:any)=>{const isLow=Number(i.quantity_on_hand||0)<=Number(i.reorder_point||0);return <tr key={i.id} className="align-top hover:bg-muted/20"><td className="px-3 py-3"><strong>{i.name}</strong><div className="mt-1 text-xs text-muted-foreground">{i.category}</div></td><td className={`px-3 py-3 font-mono tabular-nums ${isLow?'text-warning':''}`}>{Number(i.quantity_on_hand||0).toFixed(1)} {i.unit}</td><td className="px-3 py-3 font-mono tabular-nums">{Number(i.reorder_point||0).toFixed(1)} {i.unit}</td><td className="px-3 py-3">{i.storage_location||'—'}</td><td className="px-3 py-3 font-mono tabular-nums">{money(i.average_unit_cost)}</td><td className="px-3 py-3"><details className={detailsClass}><summary className={summaryClass}>Use / Add</summary><div className="min-w-72 border-t border-border p-3"><form action={adjustInventory} className="grid gap-3"><input type="hidden" name="inventory_item_id" value={i.id}/><Field label="Action"><select name="transaction_type" className={selectClass}><option value="out">Used / Sent to Job</option><option value="in">Added / Returned</option><option value="adjustment">Inventory Correction (+/-)</option></select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Quantity"><Input type="number" step="0.01" name="quantity" required/></Field><Field label="Date"><Input type="date" name="transaction_date" defaultValue={today()}/></Field></div><Field label="Job"><select name="project_id" defaultValue="" className={selectClass}><option value="">Shop / no job</option>{(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></Field><Field label="Note"><Input name="note"/></Field><div><Button type="submit" variant="outline" size="sm">Save</Button></div></form></div></details></td></tr>})}</tbody></table></div>}
   </section>
  </div>
 </AppShell>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description:string}){
 return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p></div>;
}

function Field({label,children}:{label:string;children:any}){
 return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

function Metric({label,value,help,tone='default'}:{label:string;value:number;help:string;tone?:'default'|'success'|'warning'|'destructive'}){
 const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='destructive'?'text-destructive':'text-foreground';
 const borderClass=tone==='warning'?'border-warning/30':tone==='destructive'?'border-destructive/30':'';
 return <Card className={`gap-2 py-4 shadow-none ${borderClass}`}><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}

function MiniMetric({label,value,tone='default'}:{label:string;value:string;tone?:'default'|'destructive'}){
 return <div className={`rounded-lg border p-3 ${tone==='destructive'?'border-destructive/30':''}`}><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${tone==='destructive'?'text-destructive':''}`}>{value}</div></div>;
}

function AssetStatus({status}:{status:string}){
 const cls=status==='service_due'||status==='out_of_service'?'border-destructive/30 bg-destructive/10 text-destructive':status==='assigned'||status==='service'?'border-warning/30 bg-warning/10 text-warning':status==='available'?'border-success/30 bg-success/10 text-success':'text-muted-foreground';
 const text=status==='service_due'?'Service Due':String(status||'unknown').replaceAll('_',' ');
 return <Badge variant="outline" className={cls}>{text}</Badge>;
}
