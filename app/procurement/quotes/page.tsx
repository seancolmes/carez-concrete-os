import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createVendorQuote,addVendorQuoteLine,setVendorQuoteStatus,convertQuoteToPurchaseOrder} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const units=['EA','CY','LF','SF','LB','TON','GAL','DAY','HR','LS'];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function QuotesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:projects},{data:vendors},{data:quotes},{data:lines},{data:codes},{data:catalog}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name').in('status',['active','on_hold']).order('job_number'),
    supabase.from('vendors').select('id,name,vendor_type').eq('active',true).order('name'),
    supabase.from('vendor_quote_financial_summary').select('*').eq('company_id',p.company_id).order('quote_date',{ascending:false}),
    supabase.from('vendor_quote_lines').select('*').eq('company_id',p.company_id).order('sort_order'),
    supabase.from('cost_codes').select('id,code,name').eq('company_id',p.company_id).eq('active',true).order('sort_order'),
    supabase.from('cost_catalog_items').select('id,name').eq('company_id',p.company_id).eq('active',true).order('name')
  ]);

  const lMap=new Map<string,any[]>();
  for(const l of lines||[]){const a=lMap.get(l.vendor_quote_id)||[];a.push(l);lMap.set(l.vendor_quote_id,a);}
  const waiting=(quotes||[]).filter((q:any)=>q.status==='received').length;
  const accepted=(quotes||[]).filter((q:any)=>q.status==='accepted').length;

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procurement</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Get Material Pricing</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Record vendor pricing, compare it to the job, then turn the selected quote into a purchase order.</p></header><Link className={buttonVariants({variant:'outline'})} href="/procurement">Back to Purchasing</Link></div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Quotes Saved</div><div className="text-2xl font-semibold tabular-nums">{(quotes||[]).length}</div></CardContent></Card>
      <Card size="sm"><CardContent className={waiting?'h-full space-y-1 text-warning':'h-full space-y-1 text-success'}><div className="text-xs font-medium text-muted-foreground">Need a Decision</div><div className="text-2xl font-semibold tabular-nums">{waiting}</div><div className="text-xs text-muted-foreground">Received pricing not yet accepted or rejected.</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Accepted</div><div className="text-2xl font-semibold tabular-nums">{accepted}</div></CardContent></Card>
    </div>

    <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Record Vendor Quote</h2><p className="mt-1 text-sm text-muted-foreground">Use this after a supplier sends pricing by email, phone or PDF.</p></div><form action={createVendorQuote} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="quote-project">Job</Label><select id="quote-project" className={selectClass} name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((x:any)=><option key={x.id} value={x.id}>{x.job_number} — {x.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="quote-vendor">Vendor</Label><select id="quote-vendor" className={selectClass} name="vendor_id" required defaultValue=""><option value="" disabled>Choose vendor</option>{(vendors||[]).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="vendor-quote-number">Vendor Quote #</Label><Input id="vendor-quote-number" name="vendor_quote_number"/></div><div className="grid gap-2"><Label htmlFor="quote-date">Quote Date</Label><Input id="quote-date" type="date" name="quote_date" defaultValue={today()}/></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="quote-expires">Expires</Label><Input id="quote-expires" type="date" name="expires_on"/></div><div className="grid gap-2"><Label htmlFor="quote-notes">Notes</Label><Input id="quote-notes" name="notes" placeholder="Delivery included, fuel surcharge, etc."/></div></div>
      <Button type="submit" className="w-fit">Create Quote</Button>
    </form></CardContent></Card>

    <section className="space-y-4" aria-labelledby="saved-quotes-title"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pricing</div><h2 id="saved-quotes-title" className="mt-1 text-lg font-semibold">Saved Vendor Quotes</h2></div>
      {(quotes||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No quotes yet</EmptyTitle><EmptyDescription>Record supplier pricing here before issuing a PO.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(quotes||[]).map((q:any)=>{const ql=lMap.get(q.vendor_quote_id)||[];return <Card key={q.vendor_quote_id}><header className="carez-page-heading flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{q.vendor_name}</h3><p className="mt-1 text-sm text-muted-foreground">{q.job_number} — {q.project_name} · {q.internal_quote_number}</p></div><Badge variant="outline" className={q.status==='accepted'||q.status==='converted'?'border-success/30 bg-success/10 text-success':q.status==='rejected'?'border-destructive/30 bg-destructive/10 text-destructive':'border-primary/30 bg-primary/10 text-primary'}>{q.status}</Badge></header><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Quote Total</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(q.total_cost)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Materials / Lines</div><div className="mt-1 text-lg font-semibold tabular-nums">{q.line_count}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Quote Date</div><div className="mt-1 font-semibold">{q.quote_date}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Expires</div><div className="mt-1 font-semibold">{q.expires_on||'Not Set'}</div></div></div>
        {ql.length>0&&<div className="divide-y rounded-lg border border-border">{ql.map((l:any)=><div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={l.id}><div><div className="font-medium">{l.description}</div><div className="mt-1 text-xs text-muted-foreground">{num(l.quantity).toFixed(2)} {l.unit} × {money(l.unit_cost)}</div></div><strong className="tabular-nums">{money(l.total_cost)}</strong></div>)}</div>}
        {q.status==='received'&&<details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Material / Service</summary><div className="border-t border-border p-3"><form action={addVendorQuoteLine} className="grid gap-3"><input type="hidden" name="vendor_quote_id" value={q.vendor_quote_id}/><div className="grid gap-2"><Label htmlFor={`cost-code-${q.vendor_quote_id}`}>Cost Code</Label><select id={`cost-code-${q.vendor_quote_id}`} className={selectClass} name="cost_code_id" required defaultValue=""><option value="" disabled>Choose cost type</option>{(codes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor={`catalog-${q.vendor_quote_id}`}>Catalog Item (optional)</Label><select id={`catalog-${q.vendor_quote_id}`} className={selectClass} name="catalog_item_id" defaultValue=""><option value="">Custom</option>{(catalog||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor={`description-${q.vendor_quote_id}`}>Description</Label><Input id={`description-${q.vendor_quote_id}`} name="description" required placeholder="4000 PSI concrete / #4 rebar / 2x4..."/></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`quantity-${q.vendor_quote_id}`}>Quantity</Label><Input id={`quantity-${q.vendor_quote_id}`} type="number" step="0.01" name="quantity" defaultValue="1"/></div><div className="grid gap-2"><Label htmlFor={`unit-${q.vendor_quote_id}`}>Unit</Label><select id={`unit-${q.vendor_quote_id}`} className={selectClass} name="unit" defaultValue="EA">{units.map(u=><option key={u}>{u}</option>)}</select></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`unit-cost-${q.vendor_quote_id}`}>Unit Cost</Label><Input id={`unit-cost-${q.vendor_quote_id}`} type="number" step="0.01" name="unit_cost" required/></div><div className="grid gap-2"><Label htmlFor={`sales-tax-${q.vendor_quote_id}`}>Tax / Fee</Label><Input id={`sales-tax-${q.vendor_quote_id}`} type="number" step="0.01" name="sales_tax" defaultValue="0"/></div></div><Button type="submit" className="w-fit">Add Line</Button></form></div></details>}
        <div className="flex flex-wrap gap-2">{q.status==='received'&&<><form action={setVendorQuoteStatus}><input type="hidden" name="vendor_quote_id" value={q.vendor_quote_id}/><input type="hidden" name="status" value="accepted"/><Button type="submit" variant="outline">Use This Price</Button></form><form action={setVendorQuoteStatus}><input type="hidden" name="vendor_quote_id" value={q.vendor_quote_id}/><input type="hidden" name="status" value="rejected"/><Button type="submit" variant="outline">Reject</Button></form></>}{['received','accepted'].includes(q.status)&&ql.length>0&&<form action={convertQuoteToPurchaseOrder}><input type="hidden" name="vendor_quote_id" value={q.vendor_quote_id}/><Button type="submit">Turn Into Purchase Order</Button></form>}</div>
      </CardContent></Card>;})}</div>}
    </section>
  </div></AppShell>;
}
