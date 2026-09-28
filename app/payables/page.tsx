import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {recordVendorPayment,voidVendorPayment} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function PayablesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:s},{data:bills},{data:payments}]=await Promise.all([
    supabase.from('company_ap_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
    supabase.from('vendor_bill_ap_summary').select('*').eq('company_id',p.company_id).order('due_date',{ascending:true,nullsFirst:false}),
    supabase.from('vendor_payment_financial_summary').select('*').eq('company_id',p.company_id).order('payment_date',{ascending:false}).limit(100)
  ]);
  const open=(bills||[]).filter((b:any)=>b.status==='posted'&&num(b.balance_due)>0);

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
    <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Payables</h1><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/procurement/bills">Enter vendor bill</Link></header>

    <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4" aria-label="Payables summary"><Metric label="Total owed" value={money(s?.open_ap)}/><Metric label="Past due" value={money(s?.overdue_ap)}/><Metric label="Due this week" value={money(s?.due_next_7_days)}/><Metric label="Open bills" value={String(open.length)}/></div>

    <section className="space-y-4" aria-labelledby="pay-vendors-title"><div className="carez-page-heading"><h2 id="pay-vendors-title">Bills waiting for payment</h2></div>
      {open.length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No vendor bills waiting for payment</EmptyTitle><EmptyDescription>Posted vendor bills will show here automatically.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y border border-border">{open.map((b:any)=><Sheet key={b.vendor_bill_id}><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm">{b.vendor_name} · {b.vendor_bill_number}</strong><span className="block truncate text-xs text-muted-foreground">{b.job_number} · {b.project_name} · Due {b.due_date||'not set'}</span></div><div className="flex items-center gap-2"><strong className="font-mono text-xs tabular-nums">{money(b.balance_due)}</strong><Badge variant="outline" className={num(b.days_overdue)>0?'border-destructive/30 bg-destructive/10 text-destructive':'text-muted-foreground'}>{num(b.days_overdue)>0?`${b.days_overdue} days late`:'Open'}</Badge><SheetTrigger render={<Button variant="outline" size="sm"/>}>View / Pay</SheetTrigger></div></div><SheetContent className="w-full overflow-hidden sm:max-w-3xl"><SheetHeader><SheetTitle>{b.vendor_name} · {b.vendor_bill_number}</SheetTitle><SheetDescription>{b.job_number} · Due {b.due_date||'not set'}</SheetDescription></SheetHeader><div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-6">
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Original Bill</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(b.total_cost)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3 text-success"><div className="text-xs font-medium text-muted-foreground">Already Paid</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(b.paid_amount)}</div></div><div className={`rounded-lg border border-border bg-muted/20 p-3 ${num(b.days_overdue)>0?'text-destructive':''}`}><div className="text-xs font-medium text-muted-foreground">Still Owed</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(b.balance_due)}</div></div></div>
<Dialog><DialogTrigger render={<Button size="sm" className="w-fit"/>}>Record payment</DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Record vendor payment</DialogTitle><DialogDescription>{b.vendor_name} · {b.vendor_bill_number} · {money(b.balance_due)} still owed. Recording payment reduces cash and the open balance; job cost was posted with the bill.</DialogDescription></DialogHeader><form action={recordVendorPayment} className="grid gap-3"><input type="hidden" name="vendor_bill_id" value={b.vendor_bill_id}/><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`payment-date-${b.vendor_bill_id}`}>Payment Date</Label><Input id={`payment-date-${b.vendor_bill_id}`} type="date" name="payment_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor={`payment-amount-${b.vendor_bill_id}`}>Amount</Label><Input id={`payment-amount-${b.vendor_bill_id}`} type="number" min="0.01" max={num(b.balance_due)} step="0.01" name="amount" defaultValue={num(b.balance_due).toFixed(2)} required/></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`payment-method-${b.vendor_bill_id}`}>How Did We Pay?</Label><select id={`payment-method-${b.vendor_bill_id}`} className={selectClass} name="payment_method" defaultValue="check"><option value="check">Check</option><option value="ach">ACH</option><option value="card">Card</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="other">Other</option></select></div><div className="grid gap-2"><Label htmlFor={`payment-reference-${b.vendor_bill_id}`}>Check / Reference #</Label><Input id={`payment-reference-${b.vendor_bill_id}`} name="reference_number"/></div></div><div className="grid gap-2"><Label htmlFor={`payment-fee-${b.vendor_bill_id}`}>Bank / Processing Fee</Label><Input id={`payment-fee-${b.vendor_bill_id}`} type="number" min="0" step="0.01" name="processing_fee" defaultValue="0"/></div><div className="grid gap-2"><Label htmlFor={`payment-note-${b.vendor_bill_id}`}>Note</Label><Input id={`payment-note-${b.vendor_bill_id}`} name="notes"/></div><Button type="submit" className="w-fit">Record Vendor Payment</Button></form></DialogContent></Dialog>
</div></SheetContent></Sheet>)}</div>}
    </section>

    <section className="space-y-4" aria-labelledby="payments-history-title"><div className="carez-page-heading"><h2 id="payments-history-title">Payments made</h2></div><div>{(payments||[]).length===0?<div className="py-6 text-center text-sm text-muted-foreground">No vendor payments yet.</div>:<div className="divide-y border border-border">{(payments||[]).map((x:any)=><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2" key={x.vendor_payment_id}><div><div className="font-medium">{x.payment_date} · {x.vendor_name}</div><div className="mt-1 text-sm text-muted-foreground">{String(x.payment_method||'').toUpperCase()} {x.reference_number?`· ${x.reference_number}`:''}</div></div><div className="flex items-center gap-2"><strong className="tabular-nums">{money(x.amount)}</strong>{x.status==='posted'&&<Dialog><DialogTrigger render={<Button variant="outline" size="sm"/>}>Void</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Void vendor payment?</DialogTitle><DialogDescription>{money(x.amount)} to {x.vendor_name} will be voided in the payables register.</DialogDescription></DialogHeader><form action={voidVendorPayment}><input type="hidden" name="vendor_payment_id" value={x.vendor_payment_id}/><Button type="submit" variant="destructive">Void payment</Button></form></DialogContent></Dialog>}</div></div>)}</div>}</div></section>
  </div></AppShell>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="min-w-0 bg-card px-3 py-2"><span className="text-xs text-muted-foreground">{label}</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{value}</strong></div>;}
