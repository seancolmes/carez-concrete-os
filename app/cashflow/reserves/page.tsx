import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {addCashReserve,releaseCashReserve,recordTaxRemittance,deleteTaxRemittance} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const reserveTypes=[['payroll','Payroll'],['payroll_tax','Payroll Taxes'],['bo_tax','B&O Tax'],['li','L&I'],['emergency','Emergency Buffer'],['owner','Owner Reserve'],['other','Other']];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function ProtectedMoneyPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:cash},{data:reserves},{data:remittances}]=await Promise.all([
    supabase.from('company_cash_position_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
    supabase.from('company_cash_reserves').select('*').eq('company_id',p.company_id).order('active',{ascending:false}).order('due_date',{ascending:true,nullsFirst:false}),
    supabase.from('company_tax_remittances').select('*').eq('company_id',p.company_id).order('payment_date',{ascending:false}).limit(100),
  ]);

  const active=(reserves||[]).filter((r:any)=>r.active);
  const manual=active.reduce((s:number,r:any)=>s+num(r.amount),0);
  const tax=num(cash?.sales_tax_reserve);
  const protectedTotal=manual+tax;

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <header className="carez-page-heading"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Finance</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Protected Money</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Money sitting in Carez accounts that is already spoken for. Treat this as money we must not spend.</p></header>
      <Link className={buttonVariants({variant:'outline'})} href="/cashflow">Back to Cash</Link>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card size="sm"><CardContent className={`h-full space-y-1 ${protectedTotal>0?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Do Not Spend</div><div className="text-2xl font-semibold tabular-nums">{money(protectedTotal)}</div><div className="text-xs text-muted-foreground">Sales tax plus owner-set reserves.</div></CardContent></Card>
      <Card size="sm"><CardContent className={`h-full space-y-1 ${tax>0?'text-warning':''}`}><div className="text-xs font-medium text-muted-foreground">Customer Tax Money</div><div className="text-2xl font-semibold tabular-nums">{money(tax)}</div><div className="text-xs text-muted-foreground">Collected sales tax less recorded tax payments.</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Other Protected Money</div><div className="text-2xl font-semibold tabular-nums">{money(manual)}</div><div className="text-xs text-muted-foreground">Payroll, tax, emergency or owner reserves you set manually.</div></CardContent></Card>
    </div>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Protect Money</h2><p className="mt-1 text-sm text-muted-foreground">Use this when cash needs to be held aside for something specific.</p></div><form action={addCashReserve} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="reserve-type">What Are We Protecting It For?</Label><select id="reserve-type" className={selectClass} name="reserve_type" defaultValue="other">{reserveTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        <div className="grid gap-2"><Label htmlFor="reserve-name">Name</Label><Input id="reserve-name" name="name" required placeholder="September payroll buffer"/></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="reserve-amount">Amount</Label><Input id="reserve-amount" type="number" min="0.01" step="0.01" name="amount" required/></div><div className="grid gap-2"><Label htmlFor="reserve-due">Needed By</Label><Input id="reserve-due" type="date" name="due_date"/></div></div>
        <div className="grid gap-2"><Label htmlFor="reserve-note">Note</Label><Input id="reserve-note" name="notes"/></div>
        <Button type="submit" className="w-fit">Protect This Money</Button>
      </form></CardContent></Card>

      <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Record Tax Payment</h2><p className="mt-1 text-sm text-muted-foreground">Tell Carez when protected tax money actually leaves the bank.</p></div><form action={recordTaxRemittance} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="tax-type">Tax</Label><select id="tax-type" className={selectClass} name="tax_type" defaultValue="sales_tax"><option value="sales_tax">Sales Tax</option><option value="bo_tax">B&amp;O Tax</option><option value="payroll_tax">Payroll Tax</option><option value="li">L&amp;I</option><option value="other">Other Tax</option></select></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="tax-payment-date">Date Paid</Label><Input id="tax-payment-date" type="date" name="payment_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="tax-payment-amount">Amount</Label><Input id="tax-payment-amount" type="number" min="0.01" step="0.01" name="amount" required/></div></div>
        <div className="grid gap-2"><Label htmlFor="tax-reference">Confirmation / Reference</Label><Input id="tax-reference" name="reference_number"/></div>
        <div className="grid gap-2"><Label htmlFor="tax-note">Note</Label><Input id="tax-note" name="notes"/></div>
        <Button type="submit" className="w-fit">Record Tax Payment</Button>
      </form></CardContent></Card>
    </section>

    <section className="space-y-4" aria-labelledby="protected-money-list">
      <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reserves</div><h2 id="protected-money-list" className="mt-1 text-lg font-semibold">Money We Are Holding Aside</h2></div>
      {active.length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No manual reserves</EmptyTitle><EmptyDescription>Sales tax protection still comes directly from Carez billing records.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-3">{active.map((r:any)=><Card key={r.id}><CardContent className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-semibold">{r.name}</div><div className="mt-1 text-sm text-muted-foreground">{String(r.reserve_type).replaceAll('_',' ')}{r.due_date?` · Needed ${r.due_date}`:''}</div></div><strong className="tabular-nums">{money(r.amount)}</strong></div><div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-muted-foreground">{r.notes||'No note'}</div><form action={releaseCashReserve}><input type="hidden" name="reserve_id" value={r.id}/><Button type="submit" variant="outline">Release This Money</Button></form></div></CardContent></Card>)}</div>}
    </section>

    <section className="space-y-4" aria-labelledby="tax-payment-history">
      <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</div><h2 id="tax-payment-history" className="mt-1 text-lg font-semibold">Tax Payments Recorded</h2></div>
      {(remittances||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No tax payments recorded yet</EmptyTitle><EmptyDescription>Recorded tax remittances will appear here.</EmptyDescription></EmptyHeader></Empty>:<Card><CardContent><div className="divide-y rounded-lg border border-border">{(remittances||[]).map((x:any)=><div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={x.id}><div><div className="font-medium">{x.payment_date} · {String(x.tax_type).replaceAll('_',' ')}</div><div className="mt-1 text-sm text-muted-foreground">{x.reference_number||'No reference'}{x.notes?` · ${x.notes}`:''}</div></div><div className="flex items-center gap-3"><strong className="tabular-nums">{money(x.amount)}</strong><form action={deleteTaxRemittance}><input type="hidden" name="remittance_id" value={x.id}/><Button type="submit" variant="outline" size="sm">Delete</Button></form></div></div>)}</div></CardContent></Card>}
    </section>
  </div></AppShell>;
}
