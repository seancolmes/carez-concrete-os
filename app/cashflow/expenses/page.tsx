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
import {addCompanyExpense,markCompanyExpensePaid,voidCompanyExpense} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function CompanyExpensesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:expenses},{data:items},{data:summary}]=await Promise.all([
    supabase.from('company_expenses').select('*').eq('company_id',p.company_id).order('expense_date',{ascending:false}).limit(200),
    supabase.from('overhead_items').select('id,category,name,business_use_percent').eq('company_id',p.company_id).eq('active',true).order('sort_order'),
    supabase.from('company_expense_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
  ]);

  const unpaid=(expenses||[]).filter((e:any)=>e.payment_status==='unpaid');
  const month=num(summary?.current_month_business_expense);
  const ytd=num(summary?.ytd_business_expense);
  const cats=[...new Set((items||[]).map((i:any)=>i.category))];

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Finance</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Company Expenses</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Things Carez pays to stay in business that do not belong to one specific job.</p></header>
      <Link className={buttonVariants({variant:'outline'})} href="/cashflow">Back to Cash</Link>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Spent This Month</div><div className="text-2xl font-semibold tabular-nums">{money(month)}</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Spent This Year</div><div className="text-2xl font-semibold tabular-nums">{money(ytd)}</div></CardContent></Card>
      <Card size="sm"><CardContent className={`h-full space-y-1 ${unpaid.length?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Company Bills Still Unpaid</div><div className="text-2xl font-semibold tabular-nums">{unpaid.length}</div></CardContent></Card>
    </div>

    <Card><CardContent className="space-y-4">
      <div><h2 className="font-semibold">Record Company Expense</h2><p className="mt-1 text-sm text-muted-foreground">Rent, insurance, software, accounting, vehicle overhead and similar operating cost.</p></div>
      <form action={addCompanyExpense} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-date">Date</Label><Input id="expense-date" type="date" name="expense_date" defaultValue={today()}/></div>
          <div className="grid gap-2"><Label htmlFor="expense-overhead">Planned Overhead Item</Label><select id="expense-overhead" className={selectClass} name="overhead_item_id" defaultValue=""><option value="">Other / unplanned</option>{(items||[]).map((i:any)=><option key={i.id} value={i.id}>{i.category} — {i.name}</option>)}</select></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-category">Category</Label><select id="expense-category" className={selectClass} name="category" defaultValue={cats[0]||'Other'}>{cats.map(c=><option key={c} value={c}>{c}</option>)}<option value="Other">Other</option></select></div>
          <div className="grid gap-2"><Label htmlFor="expense-payee">Who Was Paid?</Label><Input id="expense-payee" name="payee"/></div>
        </div>
        <div className="grid gap-2"><Label htmlFor="expense-description">What Was It?</Label><Input id="expense-description" name="description" required/></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-subtotal">Subtotal</Label><Input id="expense-subtotal" type="number" step="0.01" min="0" name="subtotal" required/></div>
          <div className="grid gap-2"><Label htmlFor="expense-tax">Tax / Fees</Label><Input id="expense-tax" type="number" step="0.01" min="0" name="sales_tax" defaultValue="0"/></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-business-use">Business Use %</Label><Input id="expense-business-use" type="number" min="0" max="100" step="0.01" name="business_use_percent"/></div>
          <div className="grid gap-2"><Label htmlFor="expense-source">Paid From</Label><select id="expense-source" className={selectClass} name="cash_source" defaultValue="company_account"><option value="company_account">Carez Account</option><option value="personal">Paid Personally</option><option value="noncash">Non-cash / allocation</option></select></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-status">Status</Label><select id="expense-status" className={selectClass} name="payment_status" defaultValue="paid"><option value="paid">Already Paid</option><option value="unpaid">Still Owed</option></select></div>
          <div className="grid gap-2"><Label htmlFor="expense-due-date">Due Date if Unpaid</Label><Input id="expense-due-date" type="date" name="due_date"/></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-paid-date">Paid Date</Label><Input id="expense-paid-date" type="date" name="paid_date" defaultValue={today()}/></div>
          <div className="grid gap-2"><Label htmlFor="expense-payment-method">How Paid</Label><select id="expense-payment-method" className={selectClass} name="payment_method" defaultValue="card"><option value="card">Card</option><option value="ach">ACH</option><option value="check">Check</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="other">Other</option></select></div>
        </div>
        <div className="grid gap-2"><Label htmlFor="expense-reference">Reference / Receipt</Label><Input id="expense-reference" name="reference_number"/></div>
        <div className="grid gap-2"><Label htmlFor="expense-notes">Note</Label><Input id="expense-notes" name="notes"/></div>
        <Button type="submit" className="w-fit">Record Expense</Button>
      </form>
    </CardContent></Card>

    <section className="space-y-4" aria-labelledby="recent-company-expenses">
      <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</div><h2 id="recent-company-expenses" className="mt-1 text-lg font-semibold">Recent Company Expenses</h2></div>
      {(expenses||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No company expenses yet</EmptyTitle><EmptyDescription>Operating expenses will appear here after they are recorded.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-3">{(expenses||[]).filter((e:any)=>e.payment_status!=='void').map((e:any)=><Card key={e.id}><CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-semibold">{e.description}</div><div className="mt-1 text-sm text-muted-foreground">{e.expense_date} · {e.category} · {e.payee||'No payee'}</div></div><Badge variant="outline" className={e.payment_status==='paid'?'border-success/30 bg-success/10 text-success':'border-warning/30 bg-warning/10 text-warning'}>{e.payment_status==='paid'?'Paid':'Still Owed'}</Badge></div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-3"><div className="text-sm text-muted-foreground">Business portion {Number(e.business_use_percent||100).toFixed(0)}%</div><strong className="tabular-nums">{money(e.business_expense_amount)}</strong></div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {e.payment_status==='unpaid'&&<details className="w-full rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Mark Paid</summary><div className="border-t border-border p-3"><form action={markCompanyExpensePaid} className="grid gap-3"><input type="hidden" name="expense_id" value={e.id}/><div className="grid gap-2"><Label htmlFor={`expense-paid-${e.id}`}>Paid Date</Label><Input id={`expense-paid-${e.id}`} type="date" name="paid_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor={`expense-method-${e.id}`}>How Paid</Label><select id={`expense-method-${e.id}`} className={selectClass} name="payment_method"><option value="card">Card</option><option value="ach">ACH</option><option value="check">Check</option><option value="cash">Cash</option></select></div><div className="grid gap-2"><Label htmlFor={`expense-ref-${e.id}`}>Reference</Label><Input id={`expense-ref-${e.id}`} name="reference_number"/></div><Button type="submit" className="w-fit">Mark Paid</Button></form></div></details>}
          <form action={voidCompanyExpense}><input type="hidden" name="expense_id" value={e.id}/><Button type="submit" variant="outline">Void</Button></form>
        </div>
      </CardContent></Card>)}</div>}
    </section>
  </div></AppShell>;
}
