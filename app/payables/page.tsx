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

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accounts payable</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Bills We Owe</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Vendor invoices Carez has already accepted as real cost and still needs to pay.</p></header><Link className={buttonVariants({variant:'outline'})} href="/procurement/bills">Enter Vendor Bill</Link></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card size="sm"><CardContent className={`h-full space-y-1 ${num(s?.open_ap)>0?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Total We Owe</div><div className="text-2xl font-semibold tabular-nums">{money(s?.open_ap)}</div><div className="text-xs text-muted-foreground">Posted supplier bills not fully paid.</div></CardContent></Card>
      <Card size="sm"><CardContent className={`h-full space-y-1 ${num(s?.overdue_ap)>0?'text-destructive':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Past Due</div><div className="text-2xl font-semibold tabular-nums">{money(s?.overdue_ap)}</div></CardContent></Card>
      <Card size="sm"><CardContent className={`h-full space-y-1 ${num(s?.due_next_7_days)>0?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Due This Week</div><div className="text-2xl font-semibold tabular-nums">{money(s?.due_next_7_days)}</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Open Bills</div><div className="text-2xl font-semibold tabular-nums">{open.length}</div></CardContent></Card>
    </div>

    <section className="space-y-4" aria-labelledby="pay-vendors-title"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pay vendors</div><h2 id="pay-vendors-title" className="mt-1 text-lg font-semibold">Bills Waiting for Payment</h2><p className="mt-1 text-sm text-muted-foreground">The cost already hit the job when the vendor bill was posted. Paying it here only reduces cash and what Carez owes.</p></div>
      {open.length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No vendor bills waiting for payment</EmptyTitle><EmptyDescription>Posted vendor bills will show here automatically.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{open.map((b:any)=><Card key={b.vendor_bill_id}><header className="flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{b.vendor_name} — {b.vendor_bill_number}</h3><p className="mt-1 text-sm text-muted-foreground">{b.job_number} — {b.project_name} · Due {b.due_date||'not set'}</p></div><Badge variant="outline" className={num(b.days_overdue)>0?'border-destructive/30 bg-destructive/10 text-destructive':'border-primary/30 bg-primary/10 text-primary'}>{num(b.days_overdue)>0?`${b.days_overdue} Days Late`:'Open'}</Badge></header><CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Original Bill</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(b.total_cost)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3 text-success"><div className="text-xs font-medium text-muted-foreground">Already Paid</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(b.paid_amount)}</div></div><div className={`rounded-lg border border-border bg-muted/20 p-3 ${num(b.days_overdue)>0?'text-destructive':''}`}><div className="text-xs font-medium text-muted-foreground">Still Owed</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(b.balance_due)}</div></div></div>
        <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Pay This Vendor</summary><div className="border-t border-border p-3"><form action={recordVendorPayment} className="grid gap-3"><input type="hidden" name="vendor_bill_id" value={b.vendor_bill_id}/><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`payment-date-${b.vendor_bill_id}`}>Payment Date</Label><Input id={`payment-date-${b.vendor_bill_id}`} type="date" name="payment_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor={`payment-amount-${b.vendor_bill_id}`}>Amount</Label><Input id={`payment-amount-${b.vendor_bill_id}`} type="number" min="0.01" max={num(b.balance_due)} step="0.01" name="amount" defaultValue={num(b.balance_due).toFixed(2)} required/></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`payment-method-${b.vendor_bill_id}`}>How Did We Pay?</Label><select id={`payment-method-${b.vendor_bill_id}`} className={selectClass} name="payment_method" defaultValue="check"><option value="check">Check</option><option value="ach">ACH</option><option value="card">Card</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="other">Other</option></select></div><div className="grid gap-2"><Label htmlFor={`payment-reference-${b.vendor_bill_id}`}>Check / Reference #</Label><Input id={`payment-reference-${b.vendor_bill_id}`} name="reference_number"/></div></div><div className="grid gap-2"><Label htmlFor={`payment-fee-${b.vendor_bill_id}`}>Bank / Processing Fee</Label><Input id={`payment-fee-${b.vendor_bill_id}`} type="number" min="0" step="0.01" name="processing_fee" defaultValue="0"/></div><div className="grid gap-2"><Label htmlFor={`payment-note-${b.vendor_bill_id}`}>Note</Label><Input id={`payment-note-${b.vendor_bill_id}`} name="notes"/></div><Button type="submit" className="w-fit">Record Vendor Payment</Button></form></div></details>
      </CardContent></Card>)}</div>}
    </section>

    <section className="space-y-4" aria-labelledby="payments-history-title"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</div><h2 id="payments-history-title" className="mt-1 text-lg font-semibold">Payments We Made</h2></div><Card><CardContent>{(payments||[]).length===0?<div className="py-6 text-center text-sm text-muted-foreground">No vendor payments yet.</div>:<div className="divide-y">{(payments||[]).map((x:any)=><div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={x.vendor_payment_id}><div><div className="font-medium">{x.payment_date} · {x.vendor_name}</div><div className="mt-1 text-sm text-muted-foreground">{String(x.payment_method||'').toUpperCase()} {x.reference_number?`· ${x.reference_number}`:''}</div></div><div className="flex items-center gap-2"><strong className="tabular-nums">{money(x.amount)}</strong>{x.status==='posted'&&<form action={voidVendorPayment}><input type="hidden" name="vendor_payment_id" value={x.vendor_payment_id}/><Button type="submit" variant="outline" size="sm">Void</Button></form>}</div></div>)}</div>}</CardContent></Card></section>
  </div></AppShell>;
}
