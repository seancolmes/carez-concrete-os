import {notFound,redirect} from 'next/navigation';
import {addLeadActivity,setLeadFollowUp,updateLeadStatus} from '@/app/leads/actions';
import {createClient} from '@/lib/supabase/server';
import {Button,Input,Select,Textarea} from '@fluentui/react-components';

const date=(value:string|null)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'Not set';

export async function ActivityView({leadId}:{leadId:string}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const [{data:lead,error:leadError},{data:activities,error:activityError}]=await Promise.all([
    supabase.from('leads').select('id,status,follow_up').eq('company_id',profile.company_id).eq('id',leadId).maybeSingle(),
    supabase.from('lead_activities').select('id,activity_type,note,activity_date,created_at').eq('company_id',profile.company_id).eq('lead_id',leadId).order('activity_date',{ascending:false}).limit(30),
  ]);
  if(leadError||!lead)notFound();
  if(activityError)throw new Error(activityError.message);
  return <div className="space-y-5">
    <div className="grid gap-3 lg:grid-cols-3">
      <form action={updateLeadStatus} className="rounded-lg border border-border bg-card p-3"><input type="hidden" name="id" value={lead.id}/><label className="mb-2 block text-xs text-muted-foreground" htmlFor="activity-stage">Pipeline stage</label><Select appearance="outline" id="activity-stage" name="status" defaultValue={lead.status||'new'}><option value="new">New lead</option><option value="reviewing">Reviewing</option><option value="estimating">Estimating</option><option value="proposal_sent">Proposal sent</option><option value="follow_up">Follow up</option><option value="won">Won</option><option value="lost">Lost</option></Select><Button type="submit" appearance="primary" className="mt-3">Save stage</Button></form>
      <form action={setLeadFollowUp} className="rounded-lg border border-border bg-card p-3"><input type="hidden" name="id" value={lead.id}/><label className="mb-2 block text-xs text-muted-foreground" htmlFor="activity-follow-up">Next follow up</label><Input appearance="underline" id="activity-follow-up" name="follow_up" type="date" defaultValue={lead.follow_up||''}/><Button type="submit" appearance="primary" className="mt-3">Save follow up</Button></form>
      <form action={addLeadActivity} className="rounded-lg border border-border bg-card p-3"><input type="hidden" name="lead_id" value={lead.id}/><label className="mb-2 block text-xs text-muted-foreground" htmlFor="activity-note">Record activity</label><Select appearance="outline" name="activity_type" aria-label="Activity type" defaultValue="note"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="proposal">Proposal</option></Select><Textarea appearance="outline" id="activity-note" name="note" required rows={2} placeholder="Activity notes" className="mt-2 min-h-16"/><Button type="submit" appearance="primary" className="mt-3">Add activity</Button></form>
    </div>
    <section className="rounded-lg border border-border bg-card" aria-labelledby="activity-history-title"><div className="border-b border-border px-4 py-3"><h2 id="activity-history-title" className="text-sm font-semibold">Recent activity</h2></div>{(activities||[]).length?<ol className="divide-y divide-border">{(activities||[]).map(item=><li key={item.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[120px_1fr]"><span className="font-mono text-xs text-muted-foreground">{date(item.activity_date||item.created_at)}</span><div><strong className="font-medium">{String(item.activity_type||'Activity').replaceAll('_',' ')}</strong>{item.note?<p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.note}</p>:null}</div></li>)}</ol>:<p className="px-4 py-8 text-sm text-muted-foreground">No activity has been recorded yet.</p>}</section>
  </div>;
}
