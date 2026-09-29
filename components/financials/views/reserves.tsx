import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Button,buttonVariants} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {addCashReserve,releaseCashReserve,recordTaxRemittance,deleteTaxRemittance} from '@/app/cashflow/actions';

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

  return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
    <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Protected money</h1><div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/cashflow">Cash flow</Link><Dialog><DialogTrigger render={<Button variant="outline" size="sm"/>}>Record tax payment</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Record tax payment</DialogTitle><DialogDescription>Record a tax remittance that has actually left the bank.</DialogDescription></DialogHeader><form action={recordTaxRemittance} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="tax-type">Tax</Label><select id="tax-type" className={selectClass} name="tax_type" defaultValue="sales_tax"><option value="sales_tax">Sales Tax</option><option value="bo_tax">B&amp;O Tax</option><option value="payroll_tax">Payroll Tax</option><option value="li">L&amp;I</option><option value="other">Other Tax</option></select></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="tax-payment-date">Date Paid</Label><Input id="tax-payment-date" type="date" name="payment_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="tax-payment-amount">Amount</Label><Input id="tax-payment-amount" type="number" min="0.01" step="0.01" name="amount" required/></div></div>
        <div className="grid gap-2"><Label htmlFor="tax-reference">Confirmation / Reference</Label><Input id="tax-reference" name="reference_number"/></div>
        <div className="grid gap-2"><Label htmlFor="tax-note">Note</Label><Input id="tax-note" name="notes"/></div>
        <Button type="submit" className="w-fit">Record Tax Payment</Button>
      </form></DialogContent></Dialog><Dialog><DialogTrigger render={<Button size="sm"/>}>Protect money</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Protect money</DialogTitle><DialogDescription>Set cash aside for a specific obligation or reserve.</DialogDescription></DialogHeader><form action={addCashReserve} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="reserve-type">What Are We Protecting It For?</Label><select id="reserve-type" className={selectClass} name="reserve_type" defaultValue="other">{reserveTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        <div className="grid gap-2"><Label htmlFor="reserve-name">Name</Label><Input id="reserve-name" name="name" required placeholder="September payroll buffer"/></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="reserve-amount">Amount</Label><Input id="reserve-amount" type="number" min="0.01" step="0.01" name="amount" required/></div><div className="grid gap-2"><Label htmlFor="reserve-due">Needed By</Label><Input id="reserve-due" type="date" name="due_date"/></div></div>
        <div className="grid gap-2"><Label htmlFor="reserve-note">Note</Label><Input id="reserve-note" name="notes"/></div>
        <Button type="submit" className="w-fit">Protect This Money</Button>
      </form></DialogContent></Dialog></div></header>

    <div className="grid grid-cols-3 divide-x border border-border bg-card/70" aria-label="Protected money summary"><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Protected total</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{money(protectedTotal)}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Customer tax</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{money(tax)}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Other reserves</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{money(manual)}</strong></div></div>

    <section className="space-y-2" aria-labelledby="protected-money-list"><div className="carez-page-heading"><h2 id="protected-money-list">Active reserves</h2></div>
      {active.length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No manual reserves</EmptyTitle><EmptyDescription>Sales tax protection comes from billing records.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y border border-border">{active.map((r:any)=><Sheet key={r.id}><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm">{r.name}</strong><span className="block truncate text-xs text-muted-foreground">{String(r.reserve_type).replaceAll('_',' ')}{r.due_date?` · Needed ${r.due_date}`:''}</span></div><div className="flex items-center gap-2"><strong className="font-mono text-sm tabular-nums">{money(r.amount)}</strong><SheetTrigger render={<Button variant="outline" size="sm"/>}>View details</SheetTrigger></div></div><SheetContent className="w-full overflow-hidden sm:max-w-xl"><SheetHeader><SheetTitle>{r.name}</SheetTitle><SheetDescription>{String(r.reserve_type).replaceAll('_',' ')} · {money(r.amount)}</SheetDescription></SheetHeader><div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-6"><div className="text-sm text-muted-foreground">{r.notes||'No note'}{r.due_date?` · Needed ${r.due_date}`:''}</div><Dialog><DialogTrigger render={<Button variant="outline" size="sm" className="w-fit"/>}>Release reserve</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Release protected money?</DialogTitle><DialogDescription>{money(r.amount)} will no longer be counted as a protected reserve.</DialogDescription></DialogHeader><form action={releaseCashReserve}><input type="hidden" name="reserve_id" value={r.id}/><Button type="submit">Release reserve</Button></form></DialogContent></Dialog></div></SheetContent></Sheet> )}</div>}
    </section>

    <section className="space-y-4" aria-labelledby="tax-payment-history">
      <div className="carez-page-heading"><h2 id="tax-payment-history">Tax payments</h2></div>
      {(remittances||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No tax payments recorded yet</EmptyTitle><EmptyDescription>Recorded tax remittances will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y border border-border">{(remittances||[]).map((x:any)=><div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={x.id}><div><div className="font-medium">{x.payment_date} · {String(x.tax_type).replaceAll('_',' ')}</div><div className="mt-1 text-sm text-muted-foreground">{x.reference_number||'No reference'}{x.notes?` · ${x.notes}`:''}</div></div><div className="flex items-center gap-3"><strong className="tabular-nums">{money(x.amount)}</strong><form action={deleteTaxRemittance}><input type="hidden" name="remittance_id" value={x.id}/><Button type="submit" variant="outline" size="sm">Delete</Button></form></div></div>)}</div>}
    </section>
  </div></>;
}
