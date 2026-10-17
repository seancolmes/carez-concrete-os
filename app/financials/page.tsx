import {redirect} from 'next/navigation';
import Link from 'next/link';
import { MoneyRegular as Banknote, CalendarClockRegular as CalendarClock, BuildingBankRegular as Landmark, ReceiptRegular as ReceiptText } from '@fluentui/react-icons';
import {AppShell} from '@/components/AppShell';
import {FinancialsWorkspace} from '@/components/financials/FinancialsWorkspace';
import {WorkspaceRecordBoard,type WorkspaceRecordRow} from '@/components/workspace/WorkspaceRecordBoard';
import {createClient} from '@/lib/supabase/server';

type SearchParams={tab?:string;view?:string};
const workDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);

export default async function FinancialsPage({searchParams}:{searchParams:Promise<SearchParams>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const today=workDate();
  const [{data:invoices,error:invoiceError},{data:projects}]=await Promise.all([
    supabase.from('invoice_financial_summary').select('invoice_id,invoice_number,invoice_type,project_id,invoice_total,amount_paid,balance_due,due_date,status').eq('company_id',profile.company_id).gt('balance_due',0),
    supabase.from('projects').select('id,job_number,name').eq('company_id',profile.company_id).limit(250),
  ]);
  const arAging=invoiceError?null:(invoices||[]).filter(invoice=>invoice.due_date&&invoice.due_date<today&&!['draft','void'].includes(invoice.status)).reduce((sum,invoice)=>sum+Number(invoice.balance_due||0),0);
  const projectMap=new Map((projects||[]).map(project=>[project.id,project]));
  const records:WorkspaceRecordRow[]=[
    ...(invoices||[]).filter(invoice=>!['draft','void'].includes(invoice.status)).map(invoice=>{const project=projectMap.get(invoice.project_id);const overdue=Boolean(invoice.due_date&&invoice.due_date<today);const total=Number(invoice.invoice_total||0);const paid=Number(invoice.amount_paid||0);return{id:`invoice:${invoice.invoice_id}`,code:invoice.invoice_number||'Invoice',title:project?.name||'Customer invoice',context:`${project?.job_number||'Project'} · ${String(invoice.invoice_type||'invoice').replaceAll('_',' ')}`,status:overdue?'Past due':String(invoice.status||'Open').replaceAll('_',' '),tone:overdue?'error' as const:'info' as const,date:invoice.due_date,figureLabel:'Customer balance',figure:money(Number(invoice.balance_due||0)),details:[{label:'Invoice total',value:money(total)},{label:'Paid',value:money(paid)},{label:'Still owed',value:money(Number(invoice.balance_due||0))}],progress:{label:'Invoice collected',used:paid,total,valueLabel:`${money(paid)} / ${money(total)}`},href:'/financials?tab=billing&view=invoices',actionLabel:'Open invoices'};}),
  ].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const {tab,view}=await searchParams;

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <header className="pt-context-band shrink-0 flex-wrap border-b border-border pb-2"><nav aria-label="Breadcrumb" className="text-[11px] font-medium text-muted-foreground"><Link href="/dashboard">Dashboard</Link><span className="mx-1 opacity-50">/</span>Financials</nav><h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Financials</h1></header>
      <dl aria-label="Financial health summary" className="pt-reference-strip text-xs">
        <div><dt className="text-muted-foreground">Cash position</dt><dd className="mt-1 font-semibold">Unavailable · Banking not connected</dd></div>
        <div><dt className="text-muted-foreground">A/R aging · Open invoices past due</dt><dd className={`mt-1 font-semibold tabular-nums ${arAging!==null&&arAging>0?'text-warning':''}`}>{arAging===null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(arAging)}</dd></div>
        <div><dt className="text-muted-foreground">A/P due</dt><dd className="mt-1 font-semibold">Unavailable · Payables not connected</dd></div>
        <div><dt className="text-muted-foreground">Weekly payroll burn</dt><dd className="mt-1 font-semibold">Unavailable · Payroll not connected</dd></div>
      </dl>
      <div className="min-h-0 flex-1 overflow-auto">
      {invoiceError&&<p role="status" className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">Billing records are temporarily unavailable.</p>}
      {records.length>0?<WorkspaceRecordBoard title="Financial worklist" description="Open customer invoices, ordered by due date." rows={records} empty="No open customer invoices require action." phoneStackedRows/>:null}
      <FinancialsWorkspace tab={tab} view={view}/>
      </div>
    </div>
  </AppShell>;
}
