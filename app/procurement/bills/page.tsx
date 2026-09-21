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
import {createVendorBill,addVendorBillLine,postVendorBill,voidVendorBill} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const units=['EA','CY','LF','SF','LB','TON','GAL','DAY','HR','LS'];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function VendorBillsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:projects},{data:vendors},{data:bills},{data:lines},{data:pos},{data:poLines},{data:codes}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name').in('status',['active','on_hold','completed']).order('job_number'),
    supabase.from('vendors').select('id,name').eq('active',true).order('name'),
    supabase.from('vendor_bill_financial_summary').select('*').eq('company_id',p.company_id).order('bill_date',{ascending:false}),
    supabase.from('vendor_bill_lines').select('*').eq('company_id',p.company_id).order('sort_order'),
    supabase.from('purchase_order_financial_summary').select('*').eq('company_id',p.company_id).in('status',['issued','closed']).order('created_at',{ascending:false}),
    supabase.from('purchase_order_line_financial_summary').select('*').eq('company_id',p.company_id),
    supabase.from('cost_codes').select('id,code,name').eq('company_id',p.company_id).eq('active',true).order('sort_order')
  ]);

  const lMap=new Map<string,any[]>(),poLMap=new Map<string,any[]>();
  for(const l of lines||[]){const a=lMap.get(l.vendor_bill_id)||[];a.push(l);lMap.set(l.vendor_bill_id,a);}
  for(const l of poLines||[]){const a=poLMap.get(l.purchase_order_id)||[];a.push(l);poLMap.set(l.purchase_order_id,a);}
  const drafts=(bills||[]).filter((b:any)=>b.status==='draft');
  const posted=(bills||[]).filter((b:any)=>b.status==='posted');
  const draftValue=drafts.reduce((s:number,b:any)=>s+num(b.total_cost),0);

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procurement</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Vendor Bills</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Enter the invoice the supplier actually sent. Posting it turns the purchase into real job cost.</p></header><div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline'})} href="/procurement">Back to Purchasing</Link><Link className={buttonVariants({variant:'outline'})} href="/payables">Bills We Owe</Link></div></div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card size="sm"><CardContent className={`h-full space-y-1 ${drafts.length?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Need Review</div><div className="text-2xl font-semibold tabular-nums">{drafts.length}</div><div className="text-xs text-muted-foreground">Draft vendor bills not yet counted as job cost.</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Draft Value</div><div className="text-2xl font-semibold tabular-nums">{money(draftValue)}</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1 text-success"><div className="text-xs font-medium text-muted-foreground">Posted Bills</div><div className="text-2xl font-semibold tabular-nums">{posted.length}</div><div className="text-xs text-muted-foreground">Already included in actual job cost.</div></CardContent></Card>
    </div>

    <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Enter Vendor Bill</h2><p className="mt-1 text-sm text-muted-foreground">Link it to a PO whenever possible so Carez can compare ordered vs actual.</p></div><form action={createVendorBill} className="grid gap-4">
      <div className="grid gap-2"><Label htmlFor="bill-po">Purchase Order (best choice when there is one)</Label><select id="bill-po" className={selectClass} name="purchase_order_id" defaultValue=""><option value="">No PO / direct bill</option>{(pos||[]).map((po:any)=><option key={po.purchase_order_id} value={po.purchase_order_id}>{po.po_number} — {po.vendor_name} · {po.job_number}</option>)}</select></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="bill-project">Job (if no PO)</Label><select id="bill-project" className={selectClass} name="project_id" defaultValue=""><option value="">Choose job</option>{(projects||[]).map((x:any)=><option key={x.id} value={x.id}>{x.job_number} — {x.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="bill-vendor">Vendor (if no PO)</Label><select id="bill-vendor" className={selectClass} name="vendor_id" defaultValue=""><option value="">Choose vendor</option>{(vendors||[]).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="bill-number">Vendor Invoice #</Label><Input id="bill-number" name="vendor_bill_number" required/></div><div className="grid gap-2"><Label htmlFor="bill-date">Bill Date</Label><Input id="bill-date" type="date" name="bill_date" defaultValue={today()}/></div></div>
      <div className="grid gap-2"><Label htmlFor="bill-due">Due Date</Label><Input id="bill-due" type="date" name="due_date"/></div>
      <div className="grid gap-2"><Label htmlFor="bill-note">Note</Label><Input id="bill-note" name="notes"/></div>
      <Button type="submit" className="w-fit">Create Draft Bill</Button>
    </form></CardContent></Card>

    <section className="space-y-4" aria-labelledby="vendor-bill-board"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actual cost</div><h2 id="vendor-bill-board" className="mt-1 text-lg font-semibold">Vendor Bill Board</h2><p className="mt-1 text-sm text-muted-foreground">Draft = not job cost yet. Posted = real cost and visible in job budget/forecast.</p></div>
      {(bills||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No vendor bills yet</EmptyTitle><EmptyDescription>Vendor invoices will appear here after they are entered.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(bills||[]).map((b:any)=>{
        const bl=lMap.get(b.vendor_bill_id)||[];
        const po:any=(pos||[]).find((x:any)=>x.purchase_order_id===b.purchase_order_id);
        const available=po?poLMap.get(po.purchase_order_id)||[]:[];
        return <Card key={b.vendor_bill_id}><header className="carez-page-heading flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{b.vendor_name} — {b.vendor_bill_number}</h3><p className="mt-1 text-sm text-muted-foreground">{b.job_number} — {b.project_name} · {b.bill_date}{po?` · ${po.po_number}`:''}</p></div><Badge variant="outline" className={b.status==='posted'?'border-success/30 bg-success/10 text-success':b.status==='void'?'border-destructive/30 bg-destructive/10 text-destructive':'border-primary/30 bg-primary/10 text-primary'}>{b.status}</Badge></header><CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Bill Total</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(b.total_cost)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Tax / Fees</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(b.sales_tax)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Cost Lines</div><div className="mt-1 text-lg font-semibold tabular-nums">{b.line_count}</div></div></div>

          {bl.length>0&&<div className="divide-y rounded-lg border border-border">{bl.map((l:any)=><div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={l.id}><div><div className="font-medium">{l.description}</div><div className="mt-1 text-sm text-muted-foreground">{num(l.quantity).toFixed(2)} {l.unit} × {money(l.unit_cost)}</div></div><strong className="tabular-nums">{money(l.total_cost)}</strong></div>)}</div>}

          {b.status==='draft'&&<details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Actual Cost Line</summary><div className="border-t border-border p-3"><form action={addVendorBillLine} className="grid gap-3"><input type="hidden" name="vendor_bill_id" value={b.vendor_bill_id}/>{po&&<div className="grid gap-2"><Label htmlFor={`bill-po-line-${b.vendor_bill_id}`}>Match PO Line</Label><select id={`bill-po-line-${b.vendor_bill_id}`} className={selectClass} name="purchase_order_line_id" defaultValue=""><option value="">Not tied to one PO line</option>{available.map((l:any)=><option key={l.purchase_order_line_id} value={l.purchase_order_line_id}>{l.description} · ordered {money(l.total_cost)}</option>)}</select></div>}<div className="grid gap-2"><Label htmlFor={`bill-code-${b.vendor_bill_id}`}>Cost Code (if no PO line)</Label><select id={`bill-code-${b.vendor_bill_id}`} className={selectClass} name="cost_code_id" defaultValue=""><option value="">Choose cost type</option>{(codes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor={`bill-description-${b.vendor_bill_id}`}>Description</Label><Input id={`bill-description-${b.vendor_bill_id}`} name="description" placeholder="Can be blank when matching PO line"/></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`bill-qty-${b.vendor_bill_id}`}>Actual Quantity</Label><Input id={`bill-qty-${b.vendor_bill_id}`} type="number" step="0.01" name="quantity" defaultValue="1"/></div><div className="grid gap-2"><Label htmlFor={`bill-unit-${b.vendor_bill_id}`}>Unit</Label><select id={`bill-unit-${b.vendor_bill_id}`} className={selectClass} name="unit" defaultValue="EA">{units.map(u=><option key={u}>{u}</option>)}</select></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`bill-unit-cost-${b.vendor_bill_id}`}>Actual Unit Cost</Label><Input id={`bill-unit-cost-${b.vendor_bill_id}`} type="number" step="0.01" name="unit_cost" required/></div><div className="grid gap-2"><Label htmlFor={`bill-tax-${b.vendor_bill_id}`}>Tax / Fees</Label><Input id={`bill-tax-${b.vendor_bill_id}`} type="number" step="0.01" name="sales_tax" defaultValue="0"/></div></div><Button type="submit" className="w-fit">Add Cost Line</Button></form></div></details>}

          {b.status==='draft'&&<div className="flex flex-wrap gap-2 border-t border-border pt-4">{bl.length>0&&<form action={postVendorBill}><input type="hidden" name="vendor_bill_id" value={b.vendor_bill_id}/><Button type="submit">Post as Real Job Cost</Button></form>}<form action={voidVendorBill}><input type="hidden" name="vendor_bill_id" value={b.vendor_bill_id}/><Button type="submit" variant="outline">Void Draft</Button></form></div>}
          {b.status==='posted'&&<div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"><strong>Posted to Job Cost.</strong> Paying this bill later changes cash only; it will not charge the job twice.</div>}
        </CardContent></Card>;
      })}</div>}
    </section>
  </div></AppShell>;
}
