import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Badge,Button,Checkbox,Label,Textarea} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {ensureCloseout,saveCloseoutChecklist,completeProjectCloseout} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));

export default async function CloseoutPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!profile?.company_id)redirect('/login');
 if(profile.role==='employee')redirect('/employee');
 const [{data:projects},{data:closeouts},{data:pos},{data:bills},{data:cos},{data:shifts},{data:billing},{data:docs}]=await Promise.all([
  supabase.from('projects').select('id,job_number,name,status,completed_at').in('status',['active','on_hold','completed']).order('created_at',{ascending:false}),
  supabase.from('project_closeouts').select('*').eq('company_id',profile.company_id),
  supabase.from('purchase_orders').select('project_id,status'),
  supabase.from('vendor_bills').select('project_id,status'),
  supabase.from('change_orders').select('project_id,status'),
  supabase.from('employee_shift_sessions').select('project_id,status'),
  supabase.from('project_billing_summary').select('project_id,outstanding_ar,unbilled_contract'),
  supabase.from('company_documents').select('project_id').eq('company_id',profile.company_id)
 ]);
 const cMap=new Map((closeouts||[]).map((c:any)=>[c.project_id,c]));
 const billMap=new Map((billing||[]).map((b:any)=>[b.project_id,b]));
 const docCount=new Map<string,number>();
 for(const d of docs||[])if(d.project_id)docCount.set(d.project_id,(docCount.get(d.project_id)||0)+1);
 const active=(projects||[]).filter((p:any)=>p.status!=='completed');
 const completed=(projects||[]).filter((p:any)=>p.status==='completed');

 return <AppShell userName={profile.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
   <header className="shrink-0 border border-border bg-card px-4 py-3 shadow-sm"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Project control</p><h1 className="mt-1 text-lg font-semibold tracking-tight">Project Closeout</h1><p className="mt-1 max-w-4xl text-xs text-muted-foreground">Finish the loose ends, collect the money, and lock the job down before calling it complete.</p></header>

   <section className="grid shrink-0 gap-2 md:grid-cols-2" aria-label="Closeout summary">
    <Metric label="Jobs Still Open" value={String(active.length)} help="Active or on-hold jobs not fully closed."/>
    <Metric label="Closed Jobs" value={String(completed.length)} help="Completed project history."/>
   </section>

   <section className="min-h-0 flex-1 space-y-4 overflow-auto border border-border bg-card/40 p-3">
    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Close jobs right</p><h2 className="mt-1 text-lg font-semibold">Closeout Checklist</h2><p className="mt-1 max-w-5xl text-sm text-muted-foreground">Carez will not close a project if it still sees open time, POs, bills, change orders, unbilled work or customer money owed.</p></div>
    {(projects||[]).length===0?<div className="min-h-44 border border-border bg-muted/10"><div><h3>No projects yet</h3><p>Closeout starts when a project is nearly finished.</p></div></div>:<div className="grid gap-4">{(projects||[]).map((p:any)=>{
      const c:any=cMap.get(p.id),b:any=billMap.get(p.id)||{};
      const openPO=(pos||[]).filter((x:any)=>x.project_id===p.id&&['draft','issued'].includes(x.status)).length;
      const draftBills=(bills||[]).filter((x:any)=>x.project_id===p.id&&x.status==='draft').length;
      const openCO=(cos||[]).filter((x:any)=>x.project_id===p.id&&['draft','submitted'].includes(x.status)).length;
      const openTime=(shifts||[]).filter((x:any)=>x.project_id===p.id&&['open','submitted'].includes(x.status)).length;
      const moneyLeft=Number(b.outstanding_ar||0)+Number(b.unbilled_contract||0);
      const blockers=openPO+draftBills+openCO+openTime+(moneyLeft>0?1:0);
      const isCompleted=p.status==='completed';
      return <article key={p.id} className="flex flex-col gap-0 border border-border bg-card py-0 shadow-none">
       <header className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div><h3>{p.job_number} — {p.name}</h3><p className="mt-1">{isCompleted?`Completed ${p.completed_at?.slice(0,10)||''}`:`${blockers} system blocker${blockers===1?'':'s'} detected`}</p></div><Badge appearance="outline" className={isCompleted?'border-success/30 bg-success/10 text-success':blockers?'border-warning/30 bg-warning/10 text-warning':'border-success/30 bg-success/10 text-success'}>{isCompleted?'Closed':blockers?'Needs Cleanup':'Ready to Close'}</Badge></header>
       <div className="space-y-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><MiniMetric label="Open Time" value={String(openTime)} tone={openTime?'destructive':'success'}/><MiniMetric label="Open POs" value={String(openPO)} tone={openPO?'warning':'success'}/><MiniMetric label="Draft Bills" value={String(draftBills)} tone={draftBills?'warning':'success'}/><MiniMetric label="Open COs" value={String(openCO)} tone={openCO?'warning':'success'}/><MiniMetric label="Still to Bill / Collect" value={money(moneyLeft)} tone={moneyLeft>0?'destructive':'success'}/><MiniMetric label="Saved Documents" value={String(docCount.get(p.id)||0)}/></div>

        {!isCompleted&&!c&&<form action={ensureCloseout}><input type="hidden" name="project_id" value={p.id}/><Button type="submit">Start Closeout</Button></form>}

        {!isCompleted&&c&&<form action={saveCloseoutChecklist} className="grid gap-4 rounded-lg border border-border p-3"><input type="hidden" name="project_id" value={p.id}/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
          ['punch_complete','Punch list complete',c.punch_complete],['timecards_complete','All crew time approved',c.timecards_complete],['purchase_orders_closed','Purchase orders closed',c.purchase_orders_closed],['vendor_bills_complete','Vendor bills entered',c.vendor_bills_complete],['change_orders_complete','Change orders settled',c.change_orders_complete],['customer_billed_complete','Customer fully billed',c.customer_billed_complete],['customer_paid_complete','Customer fully paid',c.customer_paid_complete],['documents_complete','Tickets / receipts / documents filed',c.documents_complete],['warranty_sent','Warranty / final package sent if required',c.warranty_sent]
        ].map(([name,text,checked]:any)=><Checkbox key={name} name={name} defaultChecked={checked} label={text} className="text-sm"/>)}</div><div className="grid gap-1.5"><Label>Closeout Note</Label><Textarea name="closeout_notes" rows={2} defaultValue={c.closeout_notes||''}/></div><div><Button type="submit" appearance="secondary" size="small">Save Checklist</Button></div></form>}

        {!isCompleted&&c&&<form action={completeProjectCloseout} className="space-y-2"><input type="hidden" name="project_id" value={p.id}/><Button type="submit" disabled={blockers>0}>Close Project</Button>{blockers>0&&<p className="text-xs text-muted-foreground">Clear the system blockers above before Carez will close this job.</p>}</form>}
       </div>
      </article>;
    })}</div>}
   </section>
  </div>
 </AppShell>;
}

function Metric({label,value,help}:{label:string;value:string;help:string}){
 return <article className="flex flex-col gap-2 border border-border bg-card py-4 shadow-none"><header className="gap-1 px-4"><p className="text-xs font-medium">{label}</p><h3 className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</h3></header><div className="px-4 text-xs leading-5 text-muted-foreground">{help}</div></article>;
}

function MiniMetric({label,value,tone='default'}:{label:string;value:string;tone?:'default'|'success'|'warning'|'destructive'}){
 const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='destructive'?'text-destructive':'text-foreground';
 const borderClass=tone==='warning'?'border-warning/30':tone==='destructive'?'border-destructive/30':tone==='success'?'border-success/30':'';
 return <div className={`rounded-lg border p-3 ${borderClass}`}><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div></div>;
}
