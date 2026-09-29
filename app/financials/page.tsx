import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Banknote,CalendarClock,Landmark,ReceiptText} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {FinancialsWorkspace} from '@/components/financials/FinancialsWorkspace';
import {MetricBentoTile} from '@/components/projects/MetricBentoTile';
import {WorkspaceRecordBoard,type WorkspaceRecordRow} from '@/components/ui/WorkspaceRecordBoard';
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
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col">
      <header className="industrial-header mb-6 px-4 py-3"><nav aria-label="Breadcrumb" className="pb-1 text-xs font-medium text-[#7B8580] dark:text-[#7C8580]"><Link href="/overview">Dashboard</Link><span className="mx-1 opacity-50">/</span>Financials</nav><h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B19] dark:text-[#F4F6F5]">Financials</h1><p className="mt-1 text-sm text-[#525C57] dark:text-[#B6BEBA]">Customer billing and job costs are available. Banking, payables, and payroll need their financial data connections.</p></header>
      <section aria-label="Financial health summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBentoTile title="Cash position" icon={<Landmark/>} value={null} prefix="$" precision={2} description="Banking is not connected yet"/>
        <MetricBentoTile title="A/R aging" icon={<ReceiptText/>} value={arAging} prefix="$" precision={2} description="Open invoices past due" tone={arAging!==null&&arAging>0?'warning':'neutral'}/>
        <MetricBentoTile title="A/P due" icon={<CalendarClock/>} value={null} prefix="$" precision={2} description="Payables are not connected yet"/>
        <MetricBentoTile title="Weekly payroll burn" icon={<Banknote/>} value={null} prefix="$" precision={2} description="Payroll is not connected yet"/>
      </section>
      {invoiceError&&<p role="status" className="mb-3 rounded-md border border-[#8A610B]/40 bg-[#FFF5D9] px-3 py-2 text-xs text-[#8A610B] dark:border-[#D5A94A]/40 dark:bg-[#181A1B] dark:text-[#D5A94A]">Billing records are temporarily unavailable.</p>}
      <WorkspaceRecordBoard title="Financial worklist" description="Open customer invoices, ordered by due date." rows={records} empty={invoiceError?'Billing records are temporarily unavailable.':'No open customer invoices require action.'}/>
      <FinancialsWorkspace tab={tab} view={view}/>
    </main>
  </AppShell>;
}
