import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createPurchaseOrder,addPurchaseOrderLine,issuePurchaseOrder,closePurchaseOrder,recordPurchaseOrderReceipt} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const units=['EA','CY','LF','SF','LB','TON','GAL','DAY','HR','LS'];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function OrdersPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:projects},{data:vendors},{data:pos},{data:lines},{data:receipts},{data:codes},{data:catalog}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name').in('status',['active','on_hold']).order('job_number'),
    supabase.from('vendors').select('id,name').eq('active',true).order('name'),
    supabase.from('purchase_order_financial_summary').select('*').eq('company_id',p.company_id).order('created_at',{ascending:false}),
    supabase.from('purchase_order_line_financial_summary').select('*').eq('company_id',p.company_id),
    supabase.from('purchase_order_receipts').select('*').eq('company_id',p.company_id).order('received_date',{ascending:false}),
    supabase.from('cost_codes').select('id,code,name').eq('company_id',p.company_id).eq('active',true).order('sort_order'),
    supabase.from('cost_catalog_items').select('id,name').eq('company_id',p.company_id).eq('active',true).order('name')
  ]);

  const lMap=new Map<string,any[]>(),rMap=new Map<string,any[]>();
  for(const l of lines||[]){const a=lMap.get(l.purchase_order_id)||[];a.push(l);lMap.set(l.purchase_order_id,a);}
  for(const r of receipts||[]){const a=rMap.get(r.purchase_order_id)||[];a.push(r);rMap.set(r.purchase_order_id,a);}
  const open=(pos||[]).filter((x:any)=>x.status==='issued');
  const draft=(pos||[]).filter((x:any)=>x.status==='draft');
  const commit=open.reduce((s:number,x:any)=>s+num(x.open_commitment),0);

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procurement</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Purchase Orders</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Tell the vendor what Carez is buying, commit the cost, then record what actually showed up.</p></header><Link className={buttonVariants({variant:'outline'})} href="/procurement">Back to Purchasing</Link></div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Draft Orders</div><div className="text-2xl font-semibold tabular-nums">{draft.length}</div><div className="text-xs text-muted-foreground">Not committed until issued.</div></CardContent></Card>
      <Card size="sm"><CardContent className={`h-full space-y-1 ${open.length?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Open Orders</div><div className="text-2xl font-semibold tabular-nums">{open.length}</div><div className="text-xs text-muted-foreground">Issued to vendors.</div></CardContent></Card>
      <Card size="sm"><CardContent className={`h-full space-y-1 ${commit>0?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Money Already Ordered</div><div className="text-2xl font-semibold tabular-nums">{money(commit)}</div><div className="text-xs text-muted-foreground">Committed cost not yet converted to vendor bill cost.</div></CardContent></Card>
    </div>

    <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Create Purchase Order</h2><p className="mt-1 text-sm text-muted-foreground">Use direct PO when you already know what vendor you are buying from.</p></div><form action={createPurchaseOrder} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="po-project">Job</Label><select id="po-project" className={selectClass} name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((x:any)=><option key={x.id} value={x.id}>{x.job_number} — {x.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="po-vendor">Vendor</Label><select id="po-vendor" className={selectClass} name="vendor_id" required defaultValue=""><option value="" disabled>Choose vendor</option>{(vendors||[]).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div></div>
      <div className="grid gap-2"><Label htmlFor="po-delivery">Expected Delivery</Label><Input id="po-delivery" type="date" name="expected_delivery_date"/></div>
      <div className="grid gap-2"><Label htmlFor="po-instructions">Delivery Instructions</Label><Input id="po-instructions" name="delivery_instructions" placeholder="Call 30 minutes ahead / gate code / pump location..."/></div>
      <div className="grid gap-2"><Label htmlFor="po-terms">Terms / Note</Label><Input id="po-terms" name="terms" placeholder="Net 30 / COD"/></div>
      <Button type="submit" className="w-fit">Create Draft PO</Button>
    </form></CardContent></Card>

    <section className="space-y-4" aria-labelledby="po-board-title"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Orders</div><h2 id="po-board-title" className="mt-1 text-lg font-semibold">Purchase Order Board</h2></div>
      {(pos||[]).length===0?<Card><CardContent className="py-8 text-center"><div className="font-medium">No purchase orders yet</div><p className="mt-1 text-sm text-muted-foreground">Create a direct order or turn an accepted vendor quote into a PO.</p></CardContent></Card>:<div className="space-y-4">{(pos||[]).map((po:any)=>{
        const pl=lMap.get(po.purchase_order_id)||[];
        const pr=rMap.get(po.purchase_order_id)||[];
        return <Card key={po.purchase_order_id}><header className="flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{po.po_number} — {po.vendor_name}</h3><p className="mt-1 text-sm text-muted-foreground">{po.job_number} — {po.project_name} · {po.expected_delivery_date?`Expected ${po.expected_delivery_date}`:'Delivery date not set'}</p></div><Badge variant="outline" className={po.status==='issued'?'border-primary/30 bg-primary/10 text-primary':po.status==='closed'?'border-success/30 bg-success/10 text-success':po.status==='cancelled'?'border-destructive/30 bg-destructive/10 text-destructive':'text-muted-foreground'}>{po.status}</Badge></header><CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Order Total</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(po.po_total)}</div></div><div className={`rounded-lg border border-border bg-muted/20 p-3 ${num(po.open_commitment)>0?'text-warning':''}`}><div className="text-xs font-medium text-muted-foreground">Still Committed</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(po.open_commitment)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Vendor Cost Posted</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(po.actual_cost)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Deliveries</div><div className="mt-1 text-lg font-semibold tabular-nums">{pr.length}</div></div></div>

          {pl.length>0&&<div className="divide-y rounded-lg border border-border">{pl.map((l:any)=><div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={l.purchase_order_line_id}><div><div className="font-medium">{l.description}</div><div className="mt-1 text-sm text-muted-foreground">Ordered {num(l.quantity).toFixed(2)} {l.unit} · Received {num(l.received_quantity).toFixed(2)}</div></div><strong className="tabular-nums">{money(l.total_cost)}</strong></div>)}</div>}

          {po.status==='draft'&&<details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Material / Service</summary><div className="border-t border-border p-3"><form action={addPurchaseOrderLine} className="grid gap-3"><input type="hidden" name="purchase_order_id" value={po.purchase_order_id}/><div className="grid gap-2"><Label htmlFor={`po-code-${po.purchase_order_id}`}>Cost Code</Label><select id={`po-code-${po.purchase_order_id}`} className={selectClass} name="cost_code_id" required defaultValue=""><option value="" disabled>Choose cost type</option>{(codes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor={`po-catalog-${po.purchase_order_id}`}>Catalog Item (optional)</Label><select id={`po-catalog-${po.purchase_order_id}`} className={selectClass} name="catalog_item_id" defaultValue=""><option value="">Custom</option>{(catalog||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor={`po-description-${po.purchase_order_id}`}>Description</Label><Input id={`po-description-${po.purchase_order_id}`} name="description" required/></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`po-qty-${po.purchase_order_id}`}>Quantity</Label><Input id={`po-qty-${po.purchase_order_id}`} type="number" step="0.01" name="quantity" defaultValue="1"/></div><div className="grid gap-2"><Label htmlFor={`po-unit-${po.purchase_order_id}`}>Unit</Label><select id={`po-unit-${po.purchase_order_id}`} className={selectClass} name="unit" defaultValue="EA">{units.map(u=><option key={u}>{u}</option>)}</select></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`po-unit-cost-${po.purchase_order_id}`}>Unit Cost</Label><Input id={`po-unit-cost-${po.purchase_order_id}`} type="number" step="0.01" name="unit_cost" required/></div><div className="grid gap-2"><Label htmlFor={`po-tax-${po.purchase_order_id}`}>Tax / Fee</Label><Input id={`po-tax-${po.purchase_order_id}`} type="number" step="0.01" name="sales_tax" defaultValue="0"/></div></div><Button type="submit" className="w-fit">Add Line</Button></form></div></details>}

          {po.status==='issued'&&pl.length>0&&<details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Receive Delivery / Ticket</summary><div className="border-t border-border p-3"><form action={recordPurchaseOrderReceipt} className="grid gap-3"><input type="hidden" name="purchase_order_id" value={po.purchase_order_id}/><div className="grid gap-2"><Label htmlFor={`receipt-line-${po.purchase_order_id}`}>What Arrived?</Label><select id={`receipt-line-${po.purchase_order_id}`} className={selectClass} name="purchase_order_line_id" required defaultValue=""><option value="" disabled>Choose order line</option>{pl.map((l:any)=><option key={l.purchase_order_line_id} value={l.purchase_order_line_id}>{l.description}</option>)}</select></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`receipt-date-${po.purchase_order_id}`}>Date</Label><Input id={`receipt-date-${po.purchase_order_id}`} type="date" name="received_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor={`receipt-qty-${po.purchase_order_id}`}>Quantity Received</Label><Input id={`receipt-qty-${po.purchase_order_id}`} type="number" step="0.01" min="0.01" name="quantity_received" required/></div></div><div className="grid gap-2"><Label htmlFor={`receipt-ticket-${po.purchase_order_id}`}>Delivery Ticket #</Label><Input id={`receipt-ticket-${po.purchase_order_id}`} name="delivery_ticket"/></div><div className="grid gap-2"><Label htmlFor={`receipt-note-${po.purchase_order_id}`}>Note</Label><Input id={`receipt-note-${po.purchase_order_id}`} name="notes"/></div><Button type="submit" className="w-fit">Record Delivery</Button></form></div></details>}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4"><Link className={buttonVariants({variant:'outline'})} href={`/procurement/purchase-orders/${po.purchase_order_id}`}>Print / Vendor PO</Link>{po.status==='draft'&&pl.length>0&&<form action={issuePurchaseOrder}><input type="hidden" name="purchase_order_id" value={po.purchase_order_id}/><input type="hidden" name="issue_date" value={today()}/><Button type="submit">Issue PO — Commit Cost</Button></form>}{po.status==='draft'&&<form action={closePurchaseOrder}><input type="hidden" name="purchase_order_id" value={po.purchase_order_id}/><input type="hidden" name="status" value="cancelled"/><Button type="submit" variant="outline">Cancel</Button></form>}{po.status==='issued'&&<form action={closePurchaseOrder}><input type="hidden" name="purchase_order_id" value={po.purchase_order_id}/><input type="hidden" name="status" value="closed"/><Button type="submit" variant="outline">Close Order</Button></form>}</div>
        </CardContent></Card>;
      })}</div>}
    </section>
  </div></AppShell>;
}
