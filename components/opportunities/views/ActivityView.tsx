import {notFound,redirect} from 'next/navigation';
import {addLeadActivity,setLeadFollowUp,updateLeadStatus} from '@/app/leads/actions';
import {createClient} from '@/lib/supabase/server';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Button,Input,Select,Textarea} from '@fluentui/react-components';

type ActivityLead={id:string;status:string|null;follow_up:string|null};
type ActivityRecord={id:string;activity_type:string|null;note:string|null;activity_date:string|null;created_at:string|null};

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
  return <ActivityContent lead={lead} activities={activities||[]}/>;
}

export function ActivityContent({lead,activities}:{lead:ActivityLead;activities:ActivityRecord[]}){
  return <div className="space-y-5">
    <section className="border-y border-border bg-card" aria-labelledby="activity-history-title"><div className="border-b border-border px-4 py-3"><h2 id="activity-history-title" className="text-sm font-semibold">Recent activity</h2></div>{activities.length?<ol className="divide-y divide-border">{activities.map(item=><li key={item.id} className="grid min-w-0 gap-1 px-4 py-3 text-sm sm:grid-cols-[120px_1fr]"><span className="font-mono text-xs text-muted-foreground">{date(item.activity_date||item.created_at)}</span><div className="min-w-0"><strong className="font-medium">{String(item.activity_type||'Activity').replaceAll('_',' ')}</strong>{item.note?<p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{item.note}</p>:null}</div></li>)}</ol>:<p className="px-4 py-8 text-sm text-muted-foreground">No activity has been recorded yet.</p>}</section>
    <Accordion collapsible multiple>
      <AccordionItem value="stage" className="border-b border-border"><AccordionHeader>Change pipeline stage</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden">
        <form action={updateLeadStatus} className="grid min-w-0 gap-3 py-3"><input type="hidden" name="id" value={lead.id}/><label className="text-xs text-muted-foreground" htmlFor="activity-stage">Pipeline stage</label><Select appearance="outline" className="w-full" id="activity-stage" name="status" defaultValue={lead.status||'new'}><option value="new">New lead</option><option value="reviewing">Reviewing</option><option value="estimating">Estimating</option><option value="proposal_sent">Proposal sent</option><option value="follow_up">Follow up</option><option value="won">Won</option><option value="lost">Lost</option></Select><Button type="submit" appearance="primary" className="w-fit">Save stage</Button></form>
      </AccordionPanel></AccordionItem>
      <AccordionItem value="follow-up" className="border-b border-border"><AccordionHeader>Set follow-up date</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden">
        <form action={setLeadFollowUp} className="grid min-w-0 gap-3 py-3"><input type="hidden" name="id" value={lead.id}/><label className="text-xs text-muted-foreground" htmlFor="activity-follow-up">Next follow up</label><Input appearance="underline" className="w-full" id="activity-follow-up" name="follow_up" type="date" defaultValue={lead.follow_up||''}/><Button type="submit" appearance="primary" className="w-fit">Save follow up</Button></form>
      </AccordionPanel></AccordionItem>
      <AccordionItem value="record" className="border-b border-border"><AccordionHeader>Record activity</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden">
        <form action={addLeadActivity} className="grid min-w-0 gap-3 py-3"><input type="hidden" name="lead_id" value={lead.id}/><label className="text-xs text-muted-foreground" htmlFor="activity-type">Activity type</label><Select appearance="outline" className="w-full" id="activity-type" name="activity_type" defaultValue="note"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="proposal">Proposal</option></Select><label className="text-xs text-muted-foreground" htmlFor="activity-note">Activity notes</label><Textarea appearance="outline" id="activity-note" name="note" required rows={4} placeholder="Activity notes" className="min-h-28 w-full"/><Button type="submit" appearance="primary" className="w-fit">Add activity</Button></form>
      </AccordionPanel></AccordionItem>
    </Accordion>
  </div>;
}
