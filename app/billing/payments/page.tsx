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
import {recordInvoicePayment} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function PaymentsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!p?.company_id)redirect('/login');if(p.role==='employee')redirect('/employee');
 const [{data:invoices},{data:payments},{data:projects},{data:customers}]=await Promise.all([
  supabase.from('invoice_financial_summary').select('*').eq('company_id',p.company_id).eq('status','sent').order('due_date',{ascending:true,nullsFirst:false}),
  supabase.from('payment_financial_summary').select('*').eq('company_id',p.company_id).order('received_date',{ascending:false}).limit(100),
  supabase.from('projects').select('id,job_number,name').eq('company_id',p.company_id),
  supabase.from('customers').select('id,name').eq('company_id',p.company_id)
 ]);
 const projectMap=new Map((projects||[]).map((x:any)=>[x.id,x]));
 const customerMap=new Map((customers||[]).map((x:any)=>[x.id,x]));
 const open=(invoices||[]).filter((i:any)=>num(i.balance_due)>0);
 const overdue=open.filter((i:any)=>num(i.days_overdue)>0);
 const owed=open.reduce((s:number,i:any)=>s+num(i.balance_due),0);
 const late=overdue.reduce((s:number,i:any)=>s+num(i.balance_due),0);

 return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
   <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Customer Payments</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">See who owes Carez money, what is late, and record deposits/checks against the correct invoice.</p></header>
   <Link className={buttonVariants({variant:'outline'})} href="/billing">Back to Billing</Link>
  </div>

  <div className="grid gap-3 sm:grid-cols-3">
   <Card size="sm"><CardContent className={owed>0?'space-y-1 text-warning':'space-y-1 text-success'}><div className="text-xs font-medium text-muted-foreground">Money Customers Owe Us</div><div className="text-2xl font-semibold tabular-nums">{money(owed)}</div></CardContent></Card>
   <Card size="sm"><CardContent className={late>0?'space-y-1 text-destructive':'space-y-1 text-success'}><div className="text-xs font-medium text-muted-foreground">Past Due</div><div className="text-2xl font-semibold tabular-nums">{money(late)}</div></CardContent></Card>
   <Card size="sm"><CardContent className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Open Invoices</div><div className="text-2xl font-semibold tabular-nums">{open.length}</div></CardContent></Card>
  </div>

  <section className="space-y-4" aria-labelledby="money-owed"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receivables</div><h2 id="money-owed" className="mt-1 text-lg font-semibold">Money Still Owed</h2><p className="mt-1 text-sm text-muted-foreground">Record the payment only when the money actually arrives.</p></div>
   {open.length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>Nobody owes Carez on a sent invoice</EmptyTitle><EmptyDescription>Open sent invoices with a remaining balance will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{open.map((i:any)=>{
    const project:any=projectMap.get(i.project_id);
    const isLate=num(i.days_overdue)>0;
    return <Card key={i.invoice_id}><header className="carez-page-heading flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{i.invoice_number} — {project?`${project.job_number} ${project.name}`:'Job'}</h3><p className="mt-1 text-sm text-muted-foreground">{i.bill_to_name||'Customer'} · Due {i.due_date||'not set'}</p></div><Badge variant="outline" className={isLate?'border-destructive/30 bg-destructive/10 text-destructive':'border-warning/30 bg-warning/10 text-warning'}>{isLate?`${i.days_overdue} Days Late`:'Open'}</Badge></header><CardContent className="space-y-5">
     <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Invoice</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(i.invoice_total)}</div></div><div className="rounded-lg border border-success/30 bg-success/5 p-3 text-success"><div className="text-xs font-medium text-muted-foreground">Already Paid</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(i.amount_paid)}</div></div><div className={`rounded-lg border bg-muted/20 p-3 ${isLate?'border-destructive/30 text-destructive':'border-primary/25'}`}><div className="text-xs font-medium text-muted-foreground">Still Owed</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(i.balance_due)}</div></div></div>

     <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Record Money Received</summary><div className="border-t border-border p-3"><form action={recordInvoicePayment} className="grid gap-4"><input type="hidden" name="invoice_id" value={i.invoice_id}/>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`payment-date-${i.invoice_id}`}>Date Money Arrived</Label><Input id={`payment-date-${i.invoice_id}`} type="date" name="received_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor={`payment-amount-${i.invoice_id}`}>Amount Received</Label><Input id={`payment-amount-${i.invoice_id}`} type="number" step="0.01" min="0.01" max={num(i.balance_due)} name="amount" defaultValue={num(i.balance_due).toFixed(2)} required/></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`payment-method-${i.invoice_id}`}>How Did They Pay?</Label><select id={`payment-method-${i.invoice_id}`} className={selectClass} name="payment_method" defaultValue="check"><option value="check">Check</option><option value="ach">ACH</option><option value="card">Card</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="other">Other</option></select></div><div className="grid gap-2"><Label htmlFor={`payment-reference-${i.invoice_id}`}>Check / Reference #</Label><Input id={`payment-reference-${i.invoice_id}`} name="reference_number"/></div></div>
      <div className="grid gap-2"><Label htmlFor={`payment-fee-${i.invoice_id}`}>Processing Fee</Label><Input id={`payment-fee-${i.invoice_id}`} type="number" step="0.01" min="0" name="processing_fee" defaultValue="0"/></div>
      <div className="grid gap-2"><Label htmlFor={`payment-notes-${i.invoice_id}`}>Note</Label><Input id={`payment-notes-${i.invoice_id}`} name="notes"/></div>
      <Button type="submit" className="w-fit">Record Customer Payment</Button>
     </form></div></details>
    </CardContent></Card>})}</div>}
  </section>

  <section className="space-y-4" aria-labelledby="money-received"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment history</div><h2 id="money-received" className="mt-1 text-lg font-semibold">Money Received</h2></div>
   {(payments||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No customer payments yet</EmptyTitle><EmptyDescription>Recorded invoice payments will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y rounded-lg border border-border">{(payments||[]).map((x:any)=>{const project:any=projectMap.get(x.project_id),customer:any=customerMap.get(x.customer_id);return <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={x.payment_id}><div><div className="font-medium">{x.received_date} · {customer?.name||project?.name||'Customer'}</div><div className="mt-1 text-xs text-muted-foreground">{project?`${project.job_number} · `:''}{String(x.payment_method||'').toUpperCase()} {x.reference_number?`· ${x.reference_number}`:''}</div></div><strong className="tabular-nums text-success">{money(x.amount)}</strong></div>})}</div>}
  </section>
 </div></AppShell>;
}
