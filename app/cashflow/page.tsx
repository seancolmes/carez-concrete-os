import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AlertTriangle,ArrowUpRight,Banknote,CreditCard,Landmark,ReceiptText,ShieldCheck,ShoppingCart,Wallet} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {buttonVariants} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);

const controls=[
  {href:'/banking',label:'Connected bank',copy:'Balances and transactions',Icon:Landmark},
  {href:'/cashflow/expenses',label:'Company expenses',copy:'Rent, insurance, software, accounting, trucks',Icon:ReceiptText},
  {href:'/cashflow/reserves',label:'Protected money',copy:'Taxes and money we must not spend',Icon:ShieldCheck},
  {href:'/payables',label:'Bills we owe',copy:'Vendor bills waiting for payment',Icon:CreditCard},
  {href:'/payroll',label:'Crew pay',copy:'Payroll cash requirement',Icon:Banknote},
] as const;

function LedgerMetric({label,value,help,tone='default'}:{label:string;value:string;help?:string;tone?:'default'|'success'|'warning'|'danger'}){
  return <div className="min-w-0 px-4 py-3 sm:px-5">
    <div className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">{label}</div>
    <div className={cn('mt-2 font-mono text-lg font-semibold tracking-tight tabular-nums sm:text-xl',tone==='success'&&'text-success',tone==='warning'&&'text-warning',tone==='danger'&&'animate-pulse text-warning motion-reduce:animate-none')}>{value}</div>
    {help?<div className="mt-1 text-xs leading-5 text-muted-foreground">{help}</div>:null}
  </div>;
}

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
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-7">
      <header className="carez-page-heading flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">Finance</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Financial Ledger, Procurement &amp; Overhead Controls</h1><p className="mt-2 max-w-4xl text-sm text-muted-foreground">Trace short-term working capital pacing. Monitor progressive customer draws, concrete supplier invoices, and retainage release timing.</p></div>
        <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/banking"><Landmark/>Banking</Link>
      </header>

      <section aria-label="Treasury and burden ledger" className="border-y border-border">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <LedgerMetric label="Net cash after known obligations" value={configured?money(safe):'Unavailable'} help={configured?'Authoritative safe-to-spend position.':'Connect or approve banking to calculate.'} tone={!configured?'warning':safe<0?'danger':'success'}/>
          <LedgerMetric label="Supplier liabilities & material payables" value={money(ap)} help="Open vendor bills reported by Carez." tone={ap>0?'warning':'default'}/>
          <LedgerMetric label="Accounts receivable & progress draws" value="Unavailable" help="No authoritative receivable or draw total is available in this workspace."/>
          <LedgerMetric label="Canonical hourly burden rate" value="Unavailable" help="No authoritative hourly burden rate is available in this workspace."/>
        </div>
      </section>

      {configured&&safe<0?<div className="flex items-start gap-3 border-y border-warning/30 py-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning"/><div><div className="font-mono font-medium text-warning">Carez is short {money(Math.abs(safe))} against known obligations.</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Do not treat the bank balance as available cash.</div></div></div>:null}

      <section aria-labelledby="cash-controls-title" className="border-b border-border">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">Transaction control rail</p><h2 id="cash-controls-title" className="mt-1 text-lg font-semibold">Cash controls</h2><p className="mt-1 text-sm text-muted-foreground">Open the operating record that explains or changes the cash position.</p></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs"><Link className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/payables">Payables</Link><Link className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/procurement/orders">Procurement</Link><Link className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/cashflow/expenses">Overhead</Link></div></div>
        <div className="grid divide-y divide-border border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-3">
          {controls.map(({href,label,copy,Icon})=><Link href={href} key={href} className="group grid min-h-24 grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 transition-all duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Icon className="mt-0.5 size-4 text-primary"/><span className="min-w-0"><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{copy}</span></span><ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground"/></Link>)}
          <Link href="/procurement/orders" className="group grid min-h-24 grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 transition-all duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><ShoppingCart className="mt-0.5 size-4 text-primary"/><span className="min-w-0"><span className="block text-sm font-medium">Open orders</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{money(pos)} committed to vendors</span></span><ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground"/></Link>
        </div>
      </section>

      <div className="grid border-y border-border xl:grid-cols-[1.15fr_.85fr] xl:divide-x xl:divide-border">
        <section aria-labelledby="liabilities-title" className="py-4 xl:py-0"><div className="px-4 pb-3 sm:px-5"><p className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">AP liabilities</p><h2 id="liabilities-title" className="mt-1 text-lg font-semibold">Money already spoken for</h2><p className="mt-1 text-sm text-muted-foreground">Why the bank balance is not the same as safe-to-spend cash.</p></div><dl className="border-t border-border">{[
          ['Customer tax money',tax],['Crew payroll requirement',payrollNeed],['Vendor bills we owe',ap],['Material / service orders already issued',pos],['Unpaid company expenses',companyBills],['Other protected money',reserves],
        ].map(([label,value])=><div key={String(label)} className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-mono text-sm font-medium tabular-nums">{money(value)}</dd></div>)}<div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"><dt className="text-sm font-semibold">Total spoken for</dt><dd className="font-mono text-sm font-semibold tabular-nums">{money(spokenFor)}</dd></div></dl></section>
        <section aria-labelledby="overhead-title" className="border-t border-border py-4 xl:border-t-0 xl:py-0"><div className="flex items-start justify-between gap-3 px-4 pb-3 sm:px-5"><div><p className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">Corporate overhead / burden</p><h2 id="overhead-title" className="mt-1 text-lg font-semibold">Company spending</h2><p className="mt-1 text-sm text-muted-foreground">Operating expenses that keep Carez running.</p></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/cashflow/expenses">Expenses</Link></div><dl className="border-t border-border">{[
          ['This month',money(expenses?.current_month_business_expense)],['This year',money(expenses?.ytd_business_expense)],['Still unpaid',money(expenses?.unpaid_company_expense_obligations)],
        ].map(([label,value])=><div key={String(label)} className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 transition-all duration-150 hover:bg-muted/40 sm:px-5"><dt className="text-sm text-muted-foreground">{label}</dt><dd className={cn('font-mono text-sm font-semibold tabular-nums',label==='Still unpaid'&&num(expenses?.unpaid_company_expense_obligations)>0&&'text-warning')}>{value}</dd></div>)}</dl></section>
      </div>

      <section aria-labelledby="actions-title" className="grid border-y border-border md:grid-cols-[minmax(0,1fr)_auto] md:divide-x md:divide-border"><div className="px-4 py-4 sm:px-5"><p className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">Manual cash accounts</p><h2 id="actions-title" className="mt-1 text-lg font-semibold">Fallback account controls</h2><p className="mt-1 text-sm text-muted-foreground">Connected Banking should handle normal bank balances automatically.</p></div><div className="flex items-center px-4 py-4"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/cashflow/accounts"><Wallet/>Manual accounts</Link></div></section>
    </div>
  </AppShell>;
}
