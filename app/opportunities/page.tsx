import {Button,Input} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import { BriefcaseRegular as BriefcaseBusiness, DataTrendingRegular as ChartNoAxesCombined, ClipboardTaskListLtrRegular as ClipboardList, WalletRegular as Wallet } from '@fluentui/react-icons';
import {AppShell} from '@/components/AppShell';
import {MetricBentoTile} from '@/components/projects/MetricBentoTile';
import {OpportunitiesGrid,type OpportunityGridRow} from '@/components/opportunities/OpportunitiesGrid';
import {ScopeView} from '@/components/opportunities/views/ScopeView';
import type {OpportunityDetail} from '@/components/opportunities/views/OpportunitySectionNav';
import {IntakeView} from '@/components/opportunities/views/IntakeView';
import {WorksheetView} from '@/components/opportunities/views/WorksheetView';
import {AuditView} from '@/components/opportunities/views/AuditView';
import {ProposalView} from '@/components/opportunities/views/ProposalView';
import {BidIntelligenceView} from '@/components/opportunities/views/BidIntelligenceView';
import {ActivityView} from '@/components/opportunities/views/ActivityView';
import {OpportunityActions} from '@/components/opportunities/OpportunityActions';
import {OpportunityToolSwitcher,type OpportunityTool} from '@/components/opportunities/OpportunityToolSwitcher';
import Link from 'next/link';
import {createTakeoffSet} from '@/app/takeoff/actions';
import {convertLeadToEstimate} from '@/app/leads/actions';
import {createClient} from '@/lib/supabase/server';

type Search={lead?:string;estimate?:string;takeoff?:string;tab?:string;view?:string;section?:string;detail?:string};
type OpportunitySection='overview'|'scope'|'commercial'|'proposal'|'activity';
const sections:[OpportunitySection,string][]=[['overview','Bids'],['scope','Scope & Plans'],['commercial','Pricing'],['proposal','Proposal'],['activity','Activity']];
const closed=new Set(['won','lost','declined','superseded','accepted','approved','awarded']);
const active=(status:string|null|undefined)=>!closed.has(status||'');
const stage=(status:string|null|undefined)=>String(status||'New').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());

export default async function OpportunitiesPage({searchParams}:{searchParams:Promise<Search>}){
  const query=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [leadResult,estimateResult,setResult,proposalResult,summaryResult,projectResult]=await Promise.all([
    supabase.from('leads').select('id,opportunity_number,project_name,customer_name,status,bid_due,estimated_value,created_at').eq('company_id',companyId).order('created_at',{ascending:false}),
    supabase.from('estimates').select('id,lead_id,estimate_number,opportunity_number,version,name,status,proposed_sell_price,updated_at').eq('company_id',companyId).order('updated_at',{ascending:false}),
    supabase.from('takeoff_sets').select('id,estimate_id,name,status,created_at').eq('company_id',companyId).order('created_at',{ascending:false}),
    supabase.from('proposal_conversion_queue').select('estimate_id,conversion_stage,sent_at').eq('company_id',companyId).order('sent_at',{ascending:false}),
    supabase.from('estimate_financial_summary').select('estimate_id,selected_sell_price,recommended_sell_price').eq('company_id',companyId),
    supabase.from('projects').select('id,job_number,name').eq('company_id',companyId).order('created_at',{ascending:false}).limit(100),
  ]);
  for(const result of [leadResult,estimateResult,setResult,proposalResult,summaryResult,projectResult])if(result.error)throw new Error(result.error.message);
  const leads=leadResult.data||[];
  const estimates=estimateResult.data||[];
  const sets=setResult.data||[];
  const proposals=proposalResult.data||[];
  const summaries=new Map((summaryResult.data||[]).map(item=>[item.estimate_id,item]));
  const latestEstimate=new Map<string,(typeof estimates)[number]>();
  for(const estimate of estimates)if(estimate.lead_id&&!latestEstimate.has(estimate.lead_id))latestEstimate.set(estimate.lead_id,estimate);
  const latestSet=new Map<string,(typeof sets)[number]>();
  for(const set of sets)if(!latestSet.has(set.estimate_id))latestSet.set(set.estimate_id,set);
  const latestProposal=new Map<string,(typeof proposals)[number]>();
  for(const proposal of proposals)if(!latestProposal.has(proposal.estimate_id))latestProposal.set(proposal.estimate_id,proposal);
  const valueFor=(estimate:(typeof estimates)[number]|undefined)=>{
    if(!estimate)return null;
    const summary=summaries.get(estimate.id);
    const value=summary?.selected_sell_price??summary?.recommended_sell_price??estimate.proposed_sell_price;
    return value==null?null:Number(value);
  };

  const rows:OpportunityGridRow[]=[
    ...leads.map(lead=>{
      const estimate=latestEstimate.get(lead.id);
      const set=estimate?latestSet.get(estimate.id):undefined;
      const proposal=estimate?latestProposal.get(estimate.id):undefined;
      return {key:`lead:${lead.id}`,leadId:lead.id,estimateId:estimate?.id||null,number:`L-${lead.opportunity_number||'—'}`,name:lead.project_name||lead.customer_name||'Untitled opportunity',customer:lead.customer_name||'Customer not entered',stage:stage(proposal?.conversion_stage||lead.status),bidDue:lead.bid_due,takeoff:set?stage(set.status):'Not started',estimate:estimate?`${estimate.estimate_number}-R${estimate.version??0}`:'Not started',value:valueFor(estimate)??(lead.estimated_value==null?null:Number(lead.estimated_value))};
    }),
    ...estimates.filter(estimate=>!estimate.lead_id).map(estimate=>{
      const set=latestSet.get(estimate.id);
      const proposal=latestProposal.get(estimate.id);
      return {key:`estimate:${estimate.id}`,leadId:null,estimateId:estimate.id,number:estimate.estimate_number||'Estimate',name:estimate.name||'Standalone bid',customer:'Standalone estimate',stage:stage(proposal?.conversion_stage||estimate.status),bidDue:null,takeoff:set?stage(set.status):'Not started',estimate:`${estimate.estimate_number}-R${estimate.version??0}`,value:valueFor(estimate)};
    }),
  ];
  const selectedEstimateById=query.estimate?estimates.find(item=>item.id===query.estimate):undefined;
  const selectedSetById=query.takeoff?sets.find(item=>item.id===query.takeoff):undefined;
  const selectedLeadId=query.lead||selectedEstimateById?.lead_id||estimates.find(item=>item.id===selectedSetById?.estimate_id)?.lead_id||null;
  const selectedKey=selectedLeadId?`lead:${selectedLeadId}`:selectedEstimateById?`estimate:${selectedEstimateById.id}`:selectedSetById?`estimate:${selectedSetById.estimate_id}`:null;
  const selectedRow=rows.find(row=>row.key===selectedKey);
  const estimateId=query.estimate&&estimates.some(item=>item.id===query.estimate&&(!selectedLeadId||item.lead_id===selectedLeadId))?query.estimate:selectedRow?.estimateId||null;
  const set=query.takeoff&&sets.some(item=>item.id===query.takeoff&&item.estimate_id===estimateId)?sets.find(item=>item.id===query.takeoff):estimateId?latestSet.get(estimateId):undefined;
  if(query.tab==='takeoff'&&set)redirect(`/takeoff/${set.id}`);
  const currentEstimate=estimates.find(item=>item.id===estimateId);
  const issuedProposal=estimateId?latestProposal.get(estimateId):undefined;
  const takeoffLocked=Boolean(currentEstimate&&['accepted','approved','superseded'].includes(currentEstimate.status))||Boolean(issuedProposal);
  const validTools:OpportunityTool[]=['intake','audit','intelligence'];
  const activeTool=validTools.includes(query.view as OpportunityTool)?query.view as OpportunityTool:null;
  const sectionFromLegacyTab=query.tab==='worksheet'?'commercial':query.tab==='scope'||query.tab==='takeoff'?'scope':query.tab==='proposal'?'proposal':activeTool?'activity':'overview';
  const section=sections.some(([key])=>key===query.section)?query.section as OpportunitySection:sectionFromLegacyTab;
  const detail=(['scope','plans','estimates','proposals'] as const).find(value=>value===query.detail)||'scope';
  const openRows=rows.filter(row=>active(row.stage.toLowerCase().replaceAll(' ','_')));
  const decided=leads.filter(item=>item.status==='won'||item.status==='lost').length;
  const wins=leads.filter(item=>item.status==='won').length;
  const backlog=estimates.filter(item=>active(item.status)&&!latestProposal.has(item.id)&&(!latestSet.has(item.id)||!['complete','completed'].includes(latestSet.get(item.id)?.status||''))).length;
  const openValue=openRows.reduce((sum,row)=>sum+Number(row.value||0),0);
  const takeoffPanel=estimateId?takeoffLocked?<div role="status" className="space-y-3 border-l-2 border-warning py-2 pl-4 text-sm"><p className="font-semibold">This estimate revision is locked.</p><p className="text-muted-foreground">Takeoff cannot start on an issued or finalized revision. Its scope and quantities remain preserved. An open issued proposal can be revised from the Proposal view.</p>{issuedProposal&&<Link href={`/opportunities?estimate=${estimateId}&tab=proposal`} className="inline-flex font-semibold text-foreground hover:underline">Open Proposal</Link>}</div>:<div className="space-y-3"><p className="text-sm text-muted-foreground">No plan set is linked to this estimate revision yet.</p><form action={createTakeoffSet} className="flex flex-wrap gap-2"><input type="hidden" name="estimate_id" value={estimateId}/><Input appearance="underline" name="name" aria-label="Plan set name" defaultValue="Concrete Takeoff"/><Button type="submit" appearance="primary">Start takeoff</Button></form></div>:<StartEstimate leadId={selectedRow?.leadId||null}/>;

  const recordParams=new URLSearchParams();
  if(selectedRow?.leadId)recordParams.set('lead',selectedRow.leadId);
  if(estimateId)recordParams.set('estimate',estimateId);
  const sectionHref=(key:OpportunitySection)=>{
    const params=new URLSearchParams(recordParams);
    params.set('section',key);
    if(key==='scope')params.set('detail',detail);
    return `/opportunities?${params.toString()}`;
  };
  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="flex min-h-0 w-full flex-col lg:h-full lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-muted-foreground"><Link href="/overview">Workspace</Link><span aria-hidden="true">/</span><Link href="/opportunities">Bids</Link>{selectedRow?<><span aria-hidden="true">/</span><span className="truncate">{selectedRow.number}</span></>:null}</nav>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5"><h1 className="truncate text-base font-semibold text-foreground">{selectedRow?.name||'Opportunity workbench'}</h1>{selectedRow?<span className="text-xs text-muted-foreground">{selectedRow.stage}{currentEstimate?' · '+currentEstimate.estimate_number+'-R'+(currentEstimate.version??0):''}</span>:<span className="text-xs text-muted-foreground">Bids, plans, pricing, and proposals</span>}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {set?<Link href={'/takeoff/'+set.id} className="inline-flex h-8 items-center rounded-md border border-border bg-secondary px-3 text-xs font-medium text-foreground hover:bg-accent">Open Takeoff</Link>:null}
          {estimateId?<Link href={'/vendor-quotes?estimate='+encodeURIComponent(estimateId)} className="inline-flex h-8 items-center rounded-md border border-border bg-secondary px-3 text-xs font-medium text-foreground hover:bg-accent">Price sources</Link>:null}
          <OpportunityActions projects={projectResult.data||[]}/>
        </div>
      </header>
      <nav aria-label="Estimating tasks" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-3 py-1.5">{sections.map(([key,label])=><Link key={key} href={sectionHref(key)} aria-current={section===key?'page':undefined} className={section===key?'whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-foreground':'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground'}>{label}</Link>)}</nav>
      <div className="min-h-0 flex-1 overflow-auto p-3 lg:overflow-hidden lg:p-4">
        {section==='overview'?<div className="flex min-h-0 flex-col gap-3 lg:h-full">
          <section aria-label="Pipeline position" className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4"><MetricBentoTile title="Active Pipeline" icon={<BriefcaseBusiness/>} value={openRows.length} description="Open leads and bids"/><MetricBentoTile title="Win Rate" icon={<ChartNoAxesCombined/>} value={decided?Math.round(wins/decided*100):null} suffix="%" description={decided?wins+' wins from '+decided+' decisions':'No decided bids yet'}/><MetricBentoTile title="Takeoff Backlog" icon={<ClipboardList/>} value={backlog} description="Active revisions needing takeoff"/><MetricBentoTile title="Open Value" icon={<Wallet/>} value={openValue} prefix="$" description="Open lead and bid value"/></section>
          <section aria-label="Opportunities and bids" className="min-h-0 flex-1"><OpportunitiesGrid rows={rows} selectedKey={selectedRow?.key||null}/></section>
        </div>:null}
        {section==='scope'?<section aria-label="Scope and plans" className="h-full min-h-0 overflow-y-auto">{selectedRow?query.tab==='takeoff'?takeoffPanel:<ScopeSection leadId={selectedRow.leadId} panel={detail} estimateId={estimateId}/>:<SelectRecord rows={rows}/>}</section>:null}
        {section==='commercial'?<section aria-label="Pricing" className="h-full min-h-0 overflow-y-auto">{selectedRow?estimateId?<WorksheetView estimateId={estimateId}/>:<StartEstimate leadId={selectedRow.leadId}/>:<SelectRecord rows={rows}/>}</section>:null}
        {section==='proposal'?<section aria-label="Proposal" className="h-full min-h-0 overflow-y-auto">{selectedRow?estimateId?<ProposalView estimateId={estimateId}/>:<StartEstimate leadId={selectedRow.leadId}/>:<SelectRecord rows={rows}/>}</section>:null}
        {section==='activity'?<section aria-label="Opportunity activity" className="h-full min-h-0 overflow-y-auto"><OpportunityToolSwitcher initialView={activeTool} panel={activeTool==='intake'?<IntakeView/>:activeTool==='audit'?<AuditView estimateId={estimateId||undefined}/>:activeTool==='intelligence'?<BidIntelligenceView/>:null}/>{!activeTool?selectedRow?.leadId?<ActivityView leadId={selectedRow.leadId}/>:selectedRow?<p className="border border-border bg-card p-4 text-sm text-muted-foreground">This standalone estimate has no lead activity.</p>:<SelectRecord rows={rows}/>:null}</section>:null}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-1.5 text-[11px] text-muted-foreground"><span>{rows.length} loaded bids</span><span>{selectedRow?selectedRow.number+' · '+selectedRow.name:'Select a bid to inspect its work'}</span></footer>
    </div>
  </AppShell>;
}
function ScopeSection({leadId,panel,estimateId}:{leadId:string|null;panel:OpportunityDetail;estimateId:string|null}){return leadId?<ScopeView id={leadId} panel={panel} estimateId={estimateId}/>:<p className="border border-border bg-card p-4 text-sm text-muted-foreground">This estimate was started without a linked CRM lead. Its scope and pricing remain in the worksheet.</p>}
function SelectRecord({rows}:{rows:OpportunityGridRow[]}){return <div className="flex h-full min-h-0 flex-col gap-2"><p className="shrink-0 text-sm text-muted-foreground">Select a bid below to open this task.</p><div className="min-h-0 flex-1"><OpportunitiesGrid rows={rows} selectedKey={null}/></div></div>}
function StartEstimate({leadId}:{leadId:string|null}){return leadId?<div className="space-y-3 border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Start an estimate revision to continue this opportunity.</p><form action={convertLeadToEstimate}><input type="hidden" name="lead_id" value={leadId}/><Button type="submit" appearance="primary">Start estimate</Button></form></div>:<p className="border border-border bg-card p-4 text-sm text-muted-foreground">Choose an estimate revision to continue.</p>}
