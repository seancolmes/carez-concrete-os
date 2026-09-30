import {redirect} from 'next/navigation';
import Link from 'next/link';
import { WarningRegular as AlertTriangle, ArrowUpRightRegular as ArrowUpRight, MoneyRegular as Banknote, PaymentRegular as CreditCard, BuildingBankRegular as Landmark, ReceiptRegular as ReceiptText, ShieldCheckmarkRegular as ShieldCheck, CartRegular as ShoppingCart, WalletRegular as Wallet } from '@fluentui/react-icons';
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
  return <div className="min-w-0 bg-card px-3 py-2 sm:px-4 sm:py-3">
    <div className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">{label}</div>
    <div className={cn('mt-1 break-words font-mono text-base font-semibold tracking-tight tabular-nums sm:text-xl',tone==='success'&&'text-success',tone==='warning'&&'text-warning',tone==='danger'&&'text-warning')}>{value}</div>
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

  return <>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
      <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Cash flow</h1><Link className={secondaryLinkClass} href="/banking"><Landmark/>Banking</Link></header>

      <section aria-label="Cash position" className="grid grid-cols-2 gap-px border border-border bg-border [&>*:first-child]:col-span-2 sm:grid-cols-3 sm:[&>*:first-child]:col-span-1">
        <LedgerMetric label="Available after obligations" value={configured?money(safe):'Unavailable'} help={configured?undefined:'Connect or approve banking to calculate.'} tone={!configured?'warning':safe<0?'danger':'success'}/>
        <LedgerMetric label="Bank cash" value={configured?money(bank):'Unavailable'}/>
        <LedgerMetric label="Known obligations" value={money(spokenFor)}/>
      </section>

      {configured&&safe<0?<div className="flex items-start gap-3 border border-warning/30 bg-warning/5 px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning"/><div><strong className="text-warning">Short {money(Math.abs(safe))} against known obligations</strong><p className="text-xs text-muted-foreground">The bank balance is not available cash.</p></div></div>:null}

      <section aria-labelledby="liabilities-title" className="space-y-2"><div className="carez-page-heading"><h2 id="liabilities-title">Known obligations</h2></div><dl className="divide-y border border-border">{[
        ['Customer tax money',tax],['Crew payroll requirement',payrollNeed],['Vendor bills',ap],['Issued material and service orders',pos],['Unpaid company expenses',companyBills],['Other protected money',reserves],
      ].map(([label,value])=><div key={String(label)} className="flex items-center justify-between gap-4 px-3 py-2"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-mono text-sm font-medium tabular-nums">{money(value)}</dd></div>)}<div className="flex items-center justify-between gap-4 bg-muted/30 px-3 py-2"><dt className="text-sm font-semibold">Total obligations</dt><dd className="font-mono text-sm font-semibold tabular-nums">{money(spokenFor)}</dd></div></dl></section>

      <section aria-labelledby="cash-controls-title" className="space-y-2"><div className="carez-page-heading"><h2 id="cash-controls-title">Cash controls</h2></div><div className="grid divide-y border border-border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-3">{controls.map(({href,label,copy,Icon})=><Link href={href} key={href} className="group flex min-h-14 items-center gap-3 border-b border-border px-3 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Icon className="size-4 shrink-0 text-primary"/><span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><span className="block truncate text-xs text-muted-foreground">{copy}</span></span><ArrowUpRight className="size-3.5 text-muted-foreground"/></Link>)}<Link href="/procurement/orders" className="group flex min-h-14 items-center gap-3 border-b border-border px-3 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><ShoppingCart className="size-4 shrink-0 text-primary"/><span className="min-w-0 flex-1"><strong className="block text-sm">Open orders</strong><span className="block truncate text-xs text-muted-foreground">{money(pos)} committed</span></span><ArrowUpRight className="size-3.5 text-muted-foreground"/></Link></div></section>

      <section aria-labelledby="spending-title" className="space-y-2"><div className="carez-page-heading flex items-center justify-between gap-3"><h2 id="spending-title">Company spending</h2><Link className={secondaryLinkClass} href="/cashflow/expenses">Expenses</Link></div><dl className="grid grid-cols-3 divide-x border border-border bg-card/70">{[
        ['This month',money(expenses?.current_month_business_expense)],['This year',money(expenses?.ytd_business_expense)],['Still unpaid',money(expenses?.unpaid_company_expense_obligations)],
      ].map(([label,value])=><div key={label} className="min-w-0 px-3 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="truncate font-mono text-sm font-semibold tabular-nums sm:text-base">{value}</dd></div>)}</dl></section>

      <Link className={secondaryLinkClass+' w-fit'} href="/cashflow/accounts"><Wallet/>Manual account fallback</Link>
    </div>
  </>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
