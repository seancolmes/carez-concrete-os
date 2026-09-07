import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AlertTriangle,Banknote,CreditCard,Landmark,ReceiptText,ShieldCheck,ShoppingCart,Wallet} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);

function CashMetric({label,value,help,tone='default'}:{label:string;value:string;help?:string;tone?:'default'|'success'|'warning'|'danger'}){
  return <Card className={cn('gap-2 py-4 shadow-none',tone==='danger'&&'border-destructive/25',tone==='warning'&&'border-warning/30')}>
    <CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={cn('font-mono text-xl font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-warning',tone==='danger'&&'text-destructive')}>{value}</CardTitle></CardHeader>
    {help?<CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent>:null}
  </Card>;
}

const controls=[
  {href:'/banking',label:'Connected bank',copy:'Balances and transactions',Icon:Landmark},
  {href:'/cashflow/expenses',label:'Company expenses',copy:'Rent, insurance, software, accounting, trucks',Icon:ReceiptText},
  {href:'/cashflow/reserves',label:'Protected money',copy:'Taxes and money we must not spend',Icon:ShieldCheck},
  {href:'/payables',label:'Bills we owe',copy:'Vendor bills waiting for payment',Icon:CreditCard},
  {href:'/payroll',label:'Crew pay',copy:'Payroll cash requirement',Icon:Banknote},
] as const;

export default async function CashflowPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:c},{data:payroll},{data:expenses},{data:bankAccounts}]=await Promise.all([
    supabase.from('company_cash_position_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
    supabase.from('company_payroll_cash_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
    supabase.from('company_expense_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
    supabase.from('plaid_bank_account_summary').select('*').eq('company_id',p.company_id),
  ]);

  const bank=num(c?.bank_cash),tax=num(c?.sales_tax_reserve),payrollNeed=num(c?.payroll_cash_requirement||payroll?.total_open_payroll_requirement),ap=num(c?.open_ap),pos=num(c?.open_po_commitments),companyBills=num(c?.unpaid_company_expense_obligations),reserves=num(c?.manual_reserves),spokenFor=tax+payrollNeed+ap+pos+companyBills+reserves,safe=num(c?.safe_cash_after_known_obligations),configured=Boolean(c?.balance_as_of)||((bankAccounts||[]).filter((x:any)=>x.include_in_cash!==false&&x.active!==false).length>0);

  return <AppShell userName={p.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Finance</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Cash position</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">What is in the bank, what is already spoken for, and what Carez can actually spend without taking from payroll, vendors, or taxes.</p></div>
        <Link className={buttonVariants({size:'sm'})} href="/banking"><Landmark/>Banking</Link>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <CashMetric label="Bank balance" value={configured?money(bank):'Check banking'} help="Connected and approved manual cash included in Carez." tone={configured?'default':'warning'}/>
        <CashMetric label="Money already spoken for" value={money(spokenFor)} help="Taxes, payroll, vendor bills, open orders, company bills, and reserves." tone={spokenFor>0?'warning':'default'}/>
        <CashMetric label="Tax money — do not spend" value={money(tax)} tone={tax>0?'warning':'default'}/>
        <CashMetric label="Money needed for payroll" value={money(payrollNeed)} tone={payrollNeed>0?'warning':'default'}/>
        <CashMetric label="Bills we owe" value={money(ap)} tone={ap>0?'warning':'default'}/>
        <CashMetric label="Safe to spend" value={configured?money(safe):'Unavailable'} help="Unpaid customer invoices and unbilled work are not counted as cash." tone={!configured?'warning':safe<0?'danger':'success'}/>
      </section>

      {configured&&safe<0?<div className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive"/><div><div className="font-medium text-destructive">Carez is short {money(Math.abs(safe))} against known obligations.</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Do not treat the bank balance as available cash.</div></div></div>:null}

      <section className="space-y-4">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cash controls</p><h2 className="mt-1 text-lg font-semibold">Where the money is going</h2><p className="mt-1 text-sm text-muted-foreground">Open the area that explains or changes the cash position above.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {controls.map(({href,label,copy,Icon})=><Link href={href} key={href} className="group"><Card className="h-full gap-3 py-4 shadow-none transition-colors group-hover:bg-muted/40"><CardHeader className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3 px-4"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="size-4"/></span><div><CardTitle className="text-sm">{label}</CardTitle><CardDescription className="mt-1 text-xs leading-5">{copy}</CardDescription></div></CardHeader></Card></Link>)}
          <Link href="/procurement/orders" className="group"><Card className="h-full gap-3 py-4 shadow-none transition-colors group-hover:bg-muted/40"><CardHeader className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3 px-4"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><ShoppingCart className="size-4"/></span><div><CardTitle className="text-sm">Open orders</CardTitle><CardDescription className="mt-1 text-xs leading-5">{money(pos)} committed to vendors</CardDescription></div></CardHeader></Card></Link>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="shadow-none">
          <CardHeader><CardTitle>Money already spoken for</CardTitle><CardDescription>Why the bank balance is not the same as safe-to-spend cash.</CardDescription></CardHeader>
          <CardContent><dl className="divide-y rounded-lg border">{[
            ['Customer tax money',tax],['Crew payroll requirement',payrollNeed],['Vendor bills we owe',ap],['Material / service orders already issued',pos],['Unpaid company expenses',companyBills],['Other protected money',reserves],
          ].map(([label,value])=><div key={String(label)} className="flex items-center justify-between gap-4 px-3 py-2.5"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-mono font-medium tabular-nums">{money(value)}</dd></div>)}<div className="flex items-center justify-between gap-4 bg-muted/30 px-3 py-3"><dt className="text-sm font-semibold">Total spoken for</dt><dd className="font-mono font-semibold tabular-nums">{money(spokenFor)}</dd></div></dl></CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="grid grid-cols-[1fr_auto] gap-3"><div><CardTitle>Company spending</CardTitle><CardDescription>Operating expenses that keep Carez running.</CardDescription></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/cashflow/expenses">Expenses</Link></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">{[
            ['This month',money(expenses?.current_month_business_expense),'default'],['This year',money(expenses?.ytd_business_expense),'default'],['Still unpaid',money(expenses?.unpaid_company_expense_obligations),num(expenses?.unpaid_company_expense_obligations)>0?'warning':'success'],
          ].map(([label,value,tone])=><div key={String(label)} className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={cn('mt-1.5 font-mono text-lg font-semibold tabular-nums',tone==='warning'&&'text-warning',tone==='success'&&'text-success')}>{value}</div></div>)}</CardContent>
        </Card>
      </div>

      <Card className="shadow-none"><CardHeader className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><CardTitle className="flex items-center gap-2"><Wallet className="size-4 text-primary"/>Manual cash accounts</CardTitle><CardDescription className="mt-1">Fallback only. Connected Banking should handle normal bank balances automatically.</CardDescription></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/cashflow/accounts">Manual accounts</Link></CardHeader></Card>
    </div>
  </AppShell>;
}
