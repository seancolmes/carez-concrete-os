import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,Checkbox,Input,Label,Textarea} from '@fluentui/react-components';
import {ProcurementForm} from '@/components/financials/ProcurementForm';
import {createClient} from '@/lib/supabase/server';
import {financialMoney} from '@/lib/financials/amount';
import {closeoutReadModel} from '@/lib/projects/closeoutReadModel';
import {ensureCloseout,saveCloseoutChecklist,completeProjectCloseout,reopenProject} from './actions';

const confirmations=[['punch_complete','Punch list complete'],['timecards_complete','All crew time approved'],['purchase_orders_closed','Purchase orders closed'],['vendor_bills_complete','Vendor bills entered'],['change_orders_complete','Change orders settled'],['customer_billed_complete','Customer fully billed'],['customer_paid_complete','Customer fully paid'],['documents_complete','Tickets / receipts / documents filed'],['warranty_sent','Warranty / final package sent if required']];
export default async function CloseoutPage({searchParams}:{searchParams:Promise<{project?:string}>}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile,error:profileError}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(profileError||!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
 const company=profile.company_id;const selected=(await searchParams).project;
 const [projectsR,closeoutsR,ordersR,billsR,changesR,shiftsR,billingR,docsR,eventsR]=await Promise.all([
  supabase.from('projects').select('id,job_number,name,status,completed_at,updated_at').eq('company_id',company).in('status',['active','on_hold','completed']).order('created_at',{ascending:false}),
  supabase.from('project_closeouts').select('*').eq('company_id',company),
  supabase.from('purchase_orders').select('project_id,status',{count:'exact'}).eq('company_id',company).in('status',['draft','issued']),
  supabase.from('vendor_bills').select('project_id,status',{count:'exact'}).eq('company_id',company).eq('status','draft'),
  supabase.from('change_orders').select('project_id,status',{count:'exact'}).eq('company_id',company).in('status',['draft','submitted']),
  supabase.from('employee_shift_sessions').select('project_id,status',{count:'exact'}).eq('company_id',company).in('status',['active','open','submitted']),
  supabase.from('project_billing_summary').select('project_id,payment_basis_status,outstanding_ar,unbilled_contract').eq('company_id',company),
  supabase.from('company_documents').select('project_id').eq('company_id',company),
  supabase.from('project_closeout_events').select('id,project_id,event_type,recorded_at,reason,actor_id').eq('company_id',company).order('recorded_at',{ascending:false})
 ]);
 const projects=(projectsR.data||[]).filter((p:any)=>!selected||p.id===selected);
 return <AppShell userName={profile.full_name||user.email||'Workspace'}><div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
  <header className="pt-context-band shrink-0 flex-wrap"><nav aria-label="Breadcrumb" className="text-xs text-muted-foreground"><Link href={selected?`/projects/${selected}`:'/projects'}>Projects</Link><span className="mx-2">/</span>Closeout</nav><h1 className="text-lg font-semibold">Project closeout</h1><p className="text-xs text-muted-foreground">Confirm the work, billing and records before completing a job. New work requires an owner to reopen it.</p></header>
  {projectsR.error?<p role="status" className="p-3 text-sm text-muted-foreground">Projects unavailable.</p>:<section className="min-h-0 flex-1 space-y-4 overflow-auto">
   {projects.length===0?<div className="surface-card p-4"><h2 className="font-semibold">{selected?'Project not available here':'No projects yet'}</h2><p className="text-sm text-muted-foreground">Closeout applies to active, held and completed projects.</p></div>:projects.map((p:any)=>{
    const c=closeoutsR.data?.find((x:any)=>x.project_id===p.id);const bill=billingR.data?.find((x:any)=>x.project_id===p.id);
    const state=closeoutReadModel(p.id,{checklist:{data:c,error:closeoutsR.error},billing:{data:bill,error:billingR.error},orders:ordersR,bills:billsR,changes:changesR,shifts:shiftsR});
    const completed=p.status==='completed';const history=(eventsR.data||[]).filter((e:any)=>e.project_id===p.id);
    const documents=docsR.error?'Unavailable':String((docsR.data||[]).filter((d:any)=>d.project_id===p.id).length);
    const label=completed?'Completed':state.unavailable?'Readiness unavailable':state.blockers?'Needs cleanup':state.canComplete?'Ready to close':'Confirm checklist';
    return <article key={p.id} className="surface-card min-w-0 overflow-hidden">
     <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3"><div className="min-w-0"><h2 className="break-words font-semibold"><Link href={`/projects/${p.id}`}>{p.job_number} · {p.name}</Link></h2><p className="mt-1 text-xs text-muted-foreground">{completed?`Completed ${p.completed_at?.slice(0,10)||'date not recorded'}`:state.unavailable?'Some required facts are unavailable. Known holds remain visible.':`${state.blockers} system blocker${state.blockers===1?'':'s'}`}</p></div><Badge appearance="outline" color={state.unavailable||state.blockers?'warning':completed||state.canComplete?'success':'informative'}>{label}</Badge></header>
     <div className="space-y-3 p-3">
      <dl className="pt-reference-strip text-xs">{[['Open time',state.openTime],['Open POs',state.openPO],['Draft bills',state.draftBills],['Open COs',state.openCO],['Unbilled contract',financialMoney(state.unbilled)],['Outstanding A/R',financialMoney(state.ar)],['Saved documents',documents]].map(([label,value])=><div key={String(label)}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold tabular-nums">{value===null?'Unavailable':String(value)}</dd></div>)}</dl>
      {state.billingStatus&&<p role="status" className="text-sm text-muted-foreground">{state.billingStatus}. Missing balances are not zero.</p>}
      {completed&&(state.unavailable||state.blockers>0)&&<p role="status" className="text-sm text-warning">Current records need review. Collection and audited corrections can continue; new work requires owner reopening.</p>}
      {!completed&&closeoutsR.error&&<p role="status" className="text-sm text-muted-foreground">Checklist unavailable; editing is disabled.</p>}
      {!completed&&!closeoutsR.error&&!c&&<ProcurementForm action={ensureCloseout}><input type="hidden" name="project_id" value={p.id}/><Button type="submit" appearance="primary">Start closeout</Button></ProcurementForm>}
      {!completed&&!closeoutsR.error&&c&&<ProcurementForm key={`${c.id}:${c.updated_at}`} action={saveCloseoutChecklist} className="grid gap-3 border-y border-border py-3"><input type="hidden" name="project_id" value={p.id}/><input type="hidden" name="expected_updated_at" value={c.updated_at}/><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{confirmations.map(([name,label])=><Checkbox key={name} id={`closeout-${p.id}-${name}`} name={name} defaultChecked={c[name]===true} label={label}/>)}</div><Label htmlFor={`closeout-note-${p.id}`}>Closeout note</Label><Textarea id={`closeout-note-${p.id}`} name="closeout_notes" rows={3} defaultValue={c.closeout_notes||''}/><Button type="submit" appearance="secondary" className="w-fit">Save checklist</Button></ProcurementForm>}
      {!completed&&c&&<ProcurementForm action={completeProjectCloseout} className="space-y-2"><input type="hidden" name="project_id" value={p.id}/><input type="hidden" name="expected_updated_at" value={c.updated_at}/><Button type="submit" appearance="primary" disabled={!state.canComplete}>Complete project</Button>{!state.canComplete&&<p className="text-xs text-muted-foreground">Confirm every required checkbox and resolve recorded blockers. The server rechecks current facts.</p>}</ProcurementForm>}
      {completed&&profile.role==='owner'&&<Accordion collapsible className="border-t border-border pt-3"><AccordionItem value="reopen"><AccordionHeader>Reopen for new work</AccordionHeader><AccordionPanel><ProcurementForm action={reopenProject} className="mt-3 grid gap-2"><input type="hidden" name="project_id" value={p.id}/><input type="hidden" name="expected_project_updated_at" value={p.updated_at}/><Label htmlFor={`reopen-${p.id}`}>Reason for reopening</Label><Input appearance="outline" id={`reopen-${p.id}`} name="reopen_reason" required/><p className="text-xs text-muted-foreground">The prior completion is retained in history. A new closeout requires fresh confirmations.</p><Button type="submit" appearance="primary" className="w-fit">Reopen project</Button></ProcurementForm></AccordionPanel></AccordionItem></Accordion>}
      {eventsR.error?<p role="status" className="text-sm text-muted-foreground">Closeout history unavailable.</p>:history.length>0&&<section aria-label="Recorded closeout history" className="border-t border-border pt-3"><h3 className="text-sm font-semibold">Recorded closeout history</h3><ol className="mt-2 divide-y divide-border">{history.map((e:any)=><li key={e.id} className="py-2 text-xs text-muted-foreground">{e.event_type==='reopen'?'Reopened':'Completed'} · {e.recorded_at}{e.reason?` · ${e.reason}`:''}</li>)}</ol></section>}
     </div>
    </article>;
   })}
  </section>}
 </div></AppShell>;
}
