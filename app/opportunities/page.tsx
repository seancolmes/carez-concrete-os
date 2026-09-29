import {redirect} from 'next/navigation';
import {BriefcaseBusiness,ChartNoAxesCombined,ClipboardList,Wallet} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {MetricBentoTile} from '@/components/projects/MetricBentoTile';
import {OpportunitiesGrid,type OpportunityGridRow} from '@/components/opportunities/OpportunitiesGrid';
import {ExpandedOpportunityWorkspace,type OpportunityTab} from '@/components/opportunities/ExpandedOpportunityWorkspace';
import {ScopeView} from '@/components/opportunities/views/ScopeView';
import {IntakeView} from '@/components/opportunities/views/IntakeView';
import {TakeoffView} from '@/components/opportunities/views/TakeoffView';
import {WorksheetView} from '@/components/opportunities/views/WorksheetView';
import {AuditView} from '@/components/opportunities/views/AuditView';
import {ProposalView} from '@/components/opportunities/views/ProposalView';
import {BidIntelligenceView} from '@/components/opportunities/views/BidIntelligenceView';
import {OpportunityActions} from '@/components/opportunities/OpportunityActions';
import {OpportunityToolSwitcher,type OpportunityTool} from '@/components/opportunities/OpportunityToolSwitcher';
import Link from 'next/link';
import {createTakeoffSet} from '@/app/takeoff/actions';
import {convertLeadToEstimate} from '@/app/leads/actions';
import {createClient} from '@/lib/supabase/server';

type Search={lead?:string;estimate?:string;takeoff?:string;tab?:string;view?:string};
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
  const currentEstimate=estimates.find(item=>item.id===estimateId);
  const issuedProposal=estimateId?latestProposal.get(estimateId):undefined;
  const takeoffLocked=Boolean(currentEstimate&&['accepted','approved','superseded'].includes(currentEstimate.status))||Boolean(issuedProposal);
  const validTabs:OpportunityTab[]=['scope','takeoff','worksheet','proposal'];
  const initialTab=validTabs.includes(query.tab as OpportunityTab)?query.tab as OpportunityTab:'scope';
  const validTools:OpportunityTool[]=['intake','audit','intelligence'];
  const activeTool=validTools.includes(query.view as OpportunityTool)?query.view as OpportunityTool:null;
  const openRows=rows.filter(row=>active(row.stage.toLowerCase().replaceAll(' ','_')));
  const decided=leads.filter(item=>item.status==='won'||item.status==='lost').length;
  const wins=leads.filter(item=>item.status==='won').length;
  const backlog=estimates.filter(item=>active(item.status)&&!latestProposal.has(item.id)&&(!latestSet.has(item.id)||!['complete','completed'].includes(latestSet.get(item.id)?.status||''))).length;
  const openValue=openRows.reduce((sum,row)=>sum+Number(row.value||0),0);
  const takeoffPanel=set?<TakeoffView setId={set.id}/>:estimateId?takeoffLocked?<div role="status" className="space-y-3 border-l-2 border-[#D5A94A] py-2 pl-4 text-sm"><p className="font-semibold">This estimate revision is locked.</p><p className="text-muted-foreground">Takeoff cannot start on an issued or finalized revision. Its scope and quantities remain preserved. An open issued proposal can be revised from the Proposal view.</p>{issuedProposal&&<Link href={`/opportunities?estimate=${estimateId}&tab=proposal`} className="inline-flex font-semibold text-[#007A52] hover:underline dark:text-[#009966]">Open Proposal</Link>}</div>:<div className="space-y-3"><p className="text-sm text-muted-foreground">No plan set is linked to this estimate revision yet.</p><form action={createTakeoffSet} className="flex flex-wrap gap-2"><input type="hidden" name="estimate_id" value={estimateId}/><input name="name" aria-label="Plan set name" defaultValue="Concrete Takeoff" className="h-9 rounded-sm border border-input bg-background px-3 text-sm"/><button type="submit" className="carez-button-primary h-9 rounded-sm border border-[#009966]/30 bg-[#007A52] px-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(0,122,82,0.15)] transition-all hover:bg-[#005c3e]">Start takeoff</button></form></div>:<StartEstimate leadId={selectedRow?.leadId||null}/>;

  const workspace=selectedRow?<ExpandedOpportunityWorkspace key={selectedRow.key} initialTab={initialTab} context={selectedRow}
    scope={<ScopeSection leadId={selectedRow.leadId}/>}
    takeoff={takeoffPanel}
    worksheet={estimateId?<WorksheetView estimateId={estimateId}/>:<StartEstimate leadId={selectedRow.leadId}/>}
    proposal={estimateId?<ProposalView estimateId={estimateId}/>:<StartEstimate leadId={selectedRow.leadId}/>}
  />:null;

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col pb-8">
    <header className="industrial-header mb-6 flex flex-wrap items-start justify-between gap-3 px-4 py-3"><div><nav aria-label="Breadcrumb" className="pb-1 text-xs font-medium text-[#7B8580] dark:text-[#7C8580]"><Link href="/overview">Dashboard</Link><span className="mx-1 opacity-50">/</span>Opportunities</nav><h1 className="mt-1 text-2xl font-bold tracking-tight">Opportunities</h1><p className="mt-1 text-sm text-muted-foreground">Follow each pursuit from scope and plans through estimate and proposal.</p></div><OpportunityActions projects={projectResult.data||[]}/></header>
    <section aria-label="Preconstruction summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><MetricBentoTile title="Active Pipeline" icon={<BriefcaseBusiness/>} value={openRows.length} description="Open leads and bids"/><MetricBentoTile title="Win Rate" icon={<ChartNoAxesCombined/>} value={decided?Math.round(wins/decided*100):null} suffix="%" description={decided?`${wins} wins from ${decided} decisions`:'No decided bids yet'}/><MetricBentoTile title="Takeoff Backlog" icon={<ClipboardList/>} value={backlog} description="Active revisions needing takeoff"/><MetricBentoTile title="Open Value" icon={<Wallet/>} value={openValue} prefix="$" description="Open lead and bid value"/></section>
    <OpportunityToolSwitcher initialView={activeTool} panel={activeTool==='intake'?<IntakeView/>:activeTool==='audit'?<AuditView estimateId={query.estimate}/>:activeTool==='intelligence'?<BidIntelligenceView/>:null}/>
    <section aria-label="Opportunities and bids"><OpportunitiesGrid rows={rows} selectedKey={selectedRow?.key||null} workspace={workspace}/></section>
  </div></AppShell>;
}

function ScopeSection({leadId}:{leadId:string|null}){return leadId?<ScopeView id={leadId}/>:<p className="text-sm text-muted-foreground">This estimate was started without a linked CRM lead. Its scope and pricing remain in the worksheet.</p>}
function StartEstimate({leadId}:{leadId:string|null}){return leadId?<div className="space-y-3"><p className="text-sm text-muted-foreground">Start an estimate revision to continue this opportunity.</p><form action={convertLeadToEstimate}><input type="hidden" name="lead_id" value={leadId}/><button type="submit" className="carez-button-primary h-9 rounded-sm border border-[#009966]/30 bg-[#007A52] px-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(0,122,82,0.15)] transition-all hover:bg-[#005c3e]">Start estimate</button></form></div>:<p className="text-sm text-muted-foreground">Choose an estimate revision to continue.</p>}
