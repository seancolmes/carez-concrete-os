import {redirect} from 'next/navigation';
import Link from 'next/link';
import { MoneyRegular as Banknote, CalendarClockRegular as CalendarClock, BuildingBankRegular as Landmark, ReceiptRegular as ReceiptText } from '@fluentui/react-icons';
import {AppShell} from '@/components/AppShell';
import {FinancialsWorkspace} from '@/components/financials/FinancialsWorkspace';
import {WorkspaceRecordBoard,type WorkspaceRecordRow} from '@/components/workspace/WorkspaceRecordBoard';
import {createClient} from '@/lib/supabase/server';
import {financialMoney as money,financialNumber} from '@/lib/financials/amount';
import {cashFigures} from '@/lib/financials/cashReadModel';
import {dashboardReceivables} from '@/lib/dashboard/receivables';
import {invoiceCollectionKind} from '@/lib/billing/invoiceCollection';

type SearchParams={tab?:string;view?:string};

export default async function FinancialsPage({searchParams}:{searchParams:Promise<SearchParams>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const [invoiceRead,projectsRead,cashRead,apRead,payrollRead]=await Promise.all([
    supabase.from('invoice_financial_summary').select('invoice_id,invoice_number,invoice_type,project_id,invoice_total,amount_paid,balance_due,due_date,status,collection_status,payment_basis_status').eq('company_id',profile.company_id),
    supabase.from('projects').select('id,job_number,name').eq('company_id',profile.company_id),
    supabase.from('company_cash_position_summary').select('*').eq('company_id',profile.company_id).maybeSingle(),
    supabase.from('company_ap_summary').select('due_next_7_days').eq('company_id',profile.company_id).maybeSingle(),
    supabase.from('company_payroll_cash_summary').select('total_open_payroll_requirement').eq('company_id',profile.company_id).maybeSingle(),
  ]);
  const arAging=dashboardReceivables({data:[],error:null},invoiceRead).overdue;
  const cash=cashFigures(cashRead,payrollRead);
  const apDue=apRead.error?null:financialNumber(apRead.data?.due_next_7_days);
  const payrollNeed=payrollRead.error?null:financialNumber(payrollRead.data?.total_open_payroll_requirement);
  const projectMap=new Map((projectsRead.data||[]).map(project=>[project.id,project]));
  const records:WorkspaceRecordRow[]=(invoiceRead.data||[])
    .filter(invoice=>!['draft','void'].includes(invoice.status)&&(financialNumber(invoice.balance_due)===null||Number(invoice.balance_due)>0||invoiceCollectionKind(invoice.collection_status)==='unavailable'))
    .map(invoice=>{
      const project=projectMap.get(invoice.project_id),kind=invoiceCollectionKind(invoice.collection_status);
      const total=financialNumber(invoice.invoice_total),paid=financialNumber(invoice.amount_paid);
      return{id:`invoice:${invoice.invoice_id}`,code:invoice.invoice_number||'Invoice',title:project?.name||(projectsRead.error?'Job unavailable':'Customer invoice'),context:`${project?.job_number||'Project'} · ${String(invoice.invoice_type||'invoice').replaceAll('_',' ')}`,
        status:kind==='unavailable'?'Collection unavailable':kind==='overdue'?'Past due':String(invoice.collection_status||invoice.status).replaceAll('_',' '),tone:kind==='overdue'?'error' as const:kind==='unavailable'?'warning' as const:'info' as const,
        date:invoice.due_date,figureLabel:'Customer balance',figure:money(invoice.balance_due),details:[{label:'Invoice total',value:money(total)},{label:'Posted payment allocations',value:money(paid)},{label:'Customer balance',value:money(invoice.balance_due)}],
        progress:total!==null&&paid!==null&&total>0?{label:'Invoice collected',used:paid,total,valueLabel:`${money(paid)} / ${money(total)}`}:undefined,
        href:`/billing/invoices/${invoice.invoice_id}`,actionLabel:'Open invoice'};
    }).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const {tab,view}=await searchParams;

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <header className="pt-context-band shrink-0 flex-wrap border-b border-border pb-2"><nav aria-label="Breadcrumb" className="text-[11px] font-medium text-muted-foreground"><Link href="/dashboard">Dashboard</Link><span className="mx-1 opacity-50">/</span>Financials</nav><h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Financials</h1></header>
      <dl aria-label="Financial health summary" className="pt-reference-strip text-xs">
        <div><dt className="text-muted-foreground">Bank cash · recorded balances</dt><dd className="mt-1 font-semibold">{money(cash.bank)}</dd></div>
        <div><dt className="text-muted-foreground">A/R aging · Open invoices past due</dt><dd className={`mt-1 font-semibold tabular-nums ${arAging!==null&&arAging>0?'text-warning':''}`}>{money(arAging)}</dd></div>
        <div><dt className="text-muted-foreground">A/P due · next 7 days</dt><dd className="mt-1 font-semibold">{money(apDue)}</dd></div>
        <div><dt className="text-muted-foreground">Open payroll requirement</dt><dd className="mt-1 font-semibold">{money(payrollNeed)}</dd></div>
      </dl>
      <div className="min-h-0 flex-1 overflow-auto">
      {invoiceRead.error&&<p role="status" className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">Billing records are temporarily unavailable.</p>}
      {projectsRead.error&&<p role="status" className="mb-2 text-xs text-muted-foreground">Job names unavailable; invoice records remain visible.</p>}
      {records.length>0?<WorkspaceRecordBoard title="Financial worklist" description="Open or unavailable customer balances, ordered by due date." rows={records} empty="No open customer invoices require action." phoneStackedRows/>:null}
      <FinancialsWorkspace tab={tab} view={view}/>
      </div>
    </div>
  </AppShell>;
}
