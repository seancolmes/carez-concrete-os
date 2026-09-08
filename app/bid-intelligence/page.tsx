import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {createClient} from '@/lib/supabase/server';
import {saveBidProfile,recordCompetitorFeedback,addScopeComparisonItem,deleteScopeComparisonItem,addValueOption,updateValueOptionStatus,recordBidFollowUp,markProposalSent,recordBidOutcome} from './actions';

const money=(v:any)=>v==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v));
const n=(v:any)=>Number(v||0);
const pct=(v:any)=>v==null?'—':`${Number(v).toFixed(1)}%`;
const nice=(v:any)=>String(v||'').replaceAll('_',' ');
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';
const detailsClass='rounded-lg border border-border bg-background';
const summaryClass='cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40';

export default async function BidIntelligencePage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!p?.company_id)redirect('/login');
 if(p.role==='employee')redirect('/employee');
 const companyId=p.company_id;
 const [{data:pipeline},{data:profiles},{data:guardrails},{data:feedback},{data:leveling},{data:scopeItems},{data:options},{data:winRates},{data:leads},{data:estimates}]=await Promise.all([
  supabase.from('bid_pipeline_intelligence').select('*').eq('company_id',companyId).order('bid_due',{ascending:true,nullsFirst:false}),
  supabase.from('bid_pursuit_score').select('*').eq('company_id',companyId),
  supabase.from('estimate_price_guardrail').select('*').eq('company_id',companyId).order('estimate_number'),
  supabase.from('bid_price_feedback_intelligence').select('*').eq('company_id',companyId).order('recorded_at',{ascending:false}),
  supabase.from('bid_scope_leveling_summary').select('*').eq('company_id',companyId).order('recorded_at',{ascending:false}),
  supabase.from('bid_scope_comparison_items').select('*').eq('company_id',companyId).order('sort_order'),
  supabase.from('bid_value_option_financials').select('*').eq('company_id',companyId).order('created_at',{ascending:false}),
  supabase.from('bid_win_rate_summary').select('*').eq('company_id',companyId).order('bid_type'),
  supabase.from('leads').select('id,opportunity_number,customer_name,project_name,city,status,bid_due,follow_up,estimated_value').eq('company_id',companyId).order('created_at',{ascending:false}),
  supabase.from('estimates').select('id,lead_id,estimate_number,name,status,version,proposed_sell_price').eq('company_id',companyId).order('created_at',{ascending:false})
 ]);
 const pipe=pipeline||[];
 const scoreMap=new Map((profiles||[]).map((x:any)=>[x.lead_id,x]));
 const estByLead=new Map<string,any>();
 for(const e of estimates||[]){if(e.lead_id&&!estByLead.has(e.lead_id))estByLead.set(e.lead_id,e);}
 const open=pipe.filter((x:any)=>!['won','lost','passed'].includes(x.pipeline_stage));
 const proposalOut=pipe.filter((x:any)=>x.pipeline_stage==='proposal_out');
 const followups=pipe.filter((x:any)=>x.needs_follow_up);
 const decided=(winRates||[]).reduce((s:number,x:any)=>s+n(x.decided_bids),0);
 const wins=(winRates||[]).reduce((s:number,x:any)=>s+n(x.wins),0);
 const scopeMap=new Map<string,any[]>();
 for(const x of scopeItems||[]){const a=scopeMap.get(x.bid_price_feedback_id)||[];a.push(x);scopeMap.set(x.bid_price_feedback_id,a);}
 const levelingMap=new Map((leveling||[]).map((x:any)=>[x.bid_price_feedback_id,x]));

 return <AppShell userName={p.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
   <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Win profitable work</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Bid Intelligence</h1><p className="mt-1 max-w-5xl text-sm text-muted-foreground">Choose better pursuits, defend scope, measure real market feedback and offer controlled alternatives without cutting below a safe price just because someone says another contractor is cheaper.</p></div>
    <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/leads">Leads</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates">Estimates</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/proposals">Proposals</Link></div>
   </header>

   <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Bid intelligence summary">
    <Metric label="Active Pursuits" value={open.length} help="Leads still capable of becoming work."/>
    <Metric label="Follow-Up Due" value={followups.length} help="Proposal conversations waiting on Carez." tone={followups.length?'destructive':'success'}/>
    <Metric label="Proposals Out" value={proposalOut.length} help="Pricing in the customer's hands."/>
    <Metric label="Measured Win Rate" value={decided?pct(100*wins/decided):'Learning'} help={decided?`${wins} wins from ${decided} decided bids.`:'Carez needs decided bids before judging pricing.'}/>
   </section>

   {decided===0&&<div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm"><strong className="text-warning">Carez does not have enough bid outcomes yet to say you are objectively expensive.</strong><div className="mt-1 text-muted-foreground">Starting now, lost reasons, competitor evidence, bid type, effort and win rate are captured so pricing decisions are based on actual Carez history rather than customer pressure alone.</div></div>}

   <section className="space-y-4">
    <SectionHeading kicker="Pursuit discipline" title="Decide Where Estimating Time Is Worth Spending" description="Score fit consistently before doing a full takeoff. A high score means favorable conditions; it is a decision aid, not an automatic rejection rule."/>
    {(leads||[]).length===0?<Empty className="min-h-44 border border-border bg-muted/10"><EmptyHeader><EmptyTitle>No leads yet</EmptyTitle><EmptyDescription>Create a lead before scoring pursuit fit.</EmptyDescription></EmptyHeader></Empty>:<div className="grid gap-4">{(leads||[]).map((l:any)=>{
      const b:any=scoreMap.get(l.id),e=estByLead.get(l.id);
      return <Card key={l.id} className="gap-0 py-0 shadow-none">
       <CardHeader className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><CardTitle>{l.opportunity_number} — {l.customer_name}</CardTitle><CardDescription className="mt-1">{l.project_name}{l.city?` · ${l.city}`:''} · {nice(l.status)}</CardDescription></div>{b&&<RecommendationBadge recommendation={b.carez_recommendation} score={b.carez_pursuit_score}/>}</CardHeader>
       <CardContent className="space-y-4 py-4">
        <details className={detailsClass} open={!b}><summary className={summaryClass}>{b?'Update Pursuit Score':'Score This Opportunity'}</summary><div className="border-t border-border p-3"><form action={saveBidProfile} className="grid gap-3"><input type="hidden" name="lead_id" value={l.id}/>
         <div className="grid gap-3 md:grid-cols-3"><Field label="How Is This Job Bought?"><select name="bid_type" defaultValue={b?.bid_type||'private_competitive'} className={selectClass}><option value="residential_direct">Residential / direct owner</option><option value="private_competitive">Private competitive</option><option value="gc_invited">GC invited bid</option><option value="negotiated">Negotiated / selective</option><option value="public_hard_bid">Public hard bid</option><option value="repeat_client">Repeat client</option><option value="other">Other</option></select></Field><Field label="Relationship"><select name="relationship_strength" defaultValue={b?.relationship_strength||'new'} className={selectClass}><option value="new">New</option><option value="known">Known</option><option value="repeat">Repeat</option></select></Field><Field label="Expected Competitors"><Input type="number" min="0" name="estimated_competitor_count" defaultValue={b?.estimated_competitor_count??''}/></Field></div>
         <div className="grid gap-3 md:grid-cols-3"><Field label="Customer / GC Budget"><Input type="number" min="0" step="100" name="customer_budget" defaultValue={b?.customer_budget??''}/></Field><Field label="Budget Source"><Input name="customer_budget_source" defaultValue={b?.customer_budget_source||''} placeholder="GC told us / published / owner conversation"/></Field><Field label="Estimator Hours"><Input type="number" min="0" step="0.25" name="estimator_effort_hours" defaultValue={b?.estimator_effort_hours??''}/></Field></div>
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['project_fit_score','Project Fit'],['relationship_score','Relationship'],['scope_clarity_score','Scope Clarity'],['capacity_score','Capacity'],['margin_potential_score','Margin Potential'],['payment_confidence_score','Payment Confidence'],['competition_score','Competition Position'],['risk_score','Risk Quality']].map(([k,text])=><Field label={`${text} · 5 best`} key={k}><select name={k} defaultValue={String(b?.[k]??3)} className={selectClass}>{[1,2,3,4,5].map(v=><option key={v} value={v}>{v}</option>)}</select></Field>)}</div>
         <div className="grid gap-3 md:grid-cols-2"><Field label="Decision"><select name="pursuit_decision" defaultValue={b?.pursuit_decision||'review'} className={selectClass}><option value="pursue">Pursue</option><option value="review">Review</option><option value="pass">Pass</option></select></Field><Field label="If Passing, Why?"><Input name="pass_reason" defaultValue={b?.pass_reason||''}/></Field></div>
         <div><Button type="submit" variant="outline" size="sm">Save Bid Decision</Button></div>
        </form></div></details>

        {b&&<div className="grid gap-3 md:grid-cols-3"><MiniMetric label="Carez Pursuit Score" value={`${b.carez_pursuit_score}/100`} detail={`Recommendation: ${b.carez_recommendation}`}/><MiniMetric label="Estimate Effort" value={b.estimator_effort_hours==null?'—':`${b.estimator_effort_hours} HR`}/><MiniMetric label="Customer Budget" value={money(b.customer_budget)}/></div>}
        {e&&<form action={markProposalSent}><input type="hidden" name="lead_id" value={l.id}/><Button type="submit" variant="outline" size="sm">Mark Proposal Sent</Button></form>}

        <details className={detailsClass}><summary className={summaryClass}>Record Follow-Up</summary><div className="border-t border-border p-3"><form action={recordBidFollowUp} className="grid gap-3"><input type="hidden" name="lead_id" value={l.id}/><Field label="What did the customer / GC say?"><Textarea name="note" rows={2} required placeholder="Reviewed proposal, comparing concrete subs, asked about schedule..."/></Field><Field label="Next Follow-Up"><Input type="date" name="next_follow_up"/></Field><div><Button type="submit" variant="outline" size="sm">Save Follow-Up</Button></div></form></div></details>

        {b&&<details className={detailsClass}><summary className={summaryClass}>Record Final Outcome</summary><div className="border-t border-border p-3"><form action={recordBidOutcome} className="grid gap-3"><input type="hidden" name="lead_id" value={l.id}/><div className="grid gap-3 md:grid-cols-2"><Field label="Outcome"><select name="outcome" defaultValue="lost" className={selectClass}><option value="won">Won</option><option value="lost">Lost</option><option value="no_decision">No decision / project died</option><option value="withdrawn">Carez withdrew</option></select></Field><Field label="Lost Reason"><select name="lost_reason" defaultValue="price" className={selectClass}><option value="price">Price / competitor lower</option><option value="scope">Scope mismatch</option><option value="relationship">Incumbent / relationship</option><option value="schedule">Schedule / availability</option><option value="qualification">Qualification / capability</option><option value="no_feedback">No useful feedback</option><option value="other">Other</option></select></Field></div><Field label="What did we learn?"><Input name="outcome_note" placeholder="Competitor named, amount, scope difference, GC feedback..."/></Field><div><Button type="submit" variant="outline" size="sm">Save Outcome</Button></div></form></div></details>}
       </CardContent>
      </Card>;
    })}</div>}
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="Price defense" title="“Someone Else Is Cheaper”" description="Record exactly what evidence you received. Carez treats a customer claim differently from a quote, bid tab or credible GC feedback."/>
    <Card className="shadow-none"><CardContent className="pt-6"><form action={recordCompetitorFeedback} className="grid gap-3"><div className="grid gap-3 md:grid-cols-3"><Field label="Lead"><select name="lead_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose opportunity</option>{(leads||[]).map((l:any)=><option key={l.id} value={l.id}>{l.opportunity_number} — {l.customer_name} — {l.project_name}</option>)}</select></Field><Field label="Estimate (if applicable)"><select name="estimate_id" defaultValue="" className={selectClass}><option value="">No estimate link</option>{(estimates||[]).map((e:any)=><option key={e.id} value={e.id}>{e.estimate_number} v{e.version} — {e.name}</option>)}</select></Field><Field label="Where Did the Number Come From?"><select name="feedback_source" defaultValue="customer_claim" className={selectClass}><option value="customer_claim">Customer says another contractor is cheaper</option><option value="gc_feedback">GC gave bid feedback</option><option value="public_bid_tab">Public bid tab</option><option value="direct_competitor_quote">Saw competitor quote</option><option value="owner_budget">Owner / GC budget target</option><option value="other">Other</option></select></Field></div><div className="grid gap-3 md:grid-cols-3"><Field label="Competitor"><Input name="competitor_name" placeholder="Optional"/></Field><Field label="Competitor / Target Price"><Input type="number" min="0" step="100" name="competitor_price"/></Field><Field label="Is Their Scope Confirmed Comparable?"><select name="scope_comparable" defaultValue="unknown" className={selectClass}><option value="unknown">Unknown</option><option value="yes">Yes — leveled / comparable</option><option value="no">No — known scope difference</option></select></Field></div><Field label="What exactly were you told / shown?"><Textarea name="note" rows={2}/></Field><div><Button type="submit">Record Market Feedback</Button></div></form></CardContent></Card>

    {(guardrails||[]).length>0&&<div className="grid gap-4">{(guardrails||[]).map((g:any)=>{const lf:any=g.feedback_id?levelingMap.get(g.feedback_id):null;const danger=Boolean(g.competitor_price&&g.competitor_price<g.protected_break_even_price);return <Card key={g.estimate_id} className="gap-0 py-0 shadow-none"><CardHeader className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div><CardTitle>{g.estimate_number} — {g.name}</CardTitle><CardDescription className="mt-1">Estimate pricing guardrail</CardDescription></div><Badge variant="outline" className={g.safe_for_price_comparison?'border-success/30 bg-success/10 text-success':'text-muted-foreground'}>{g.evidence_strength||'no market evidence'}</Badge></CardHeader><CardContent className="space-y-4 py-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><MiniMetric label="Current Proposal" value={money(g.selected_sell_price)} detail={`Projected margin ${pct(g.projected_margin_percent)}`} tone="primary"/><MiniMetric label="Recommended Target" value={money(g.recommended_sell_price)}/><MiniMetric label="Protected Break-Even" value={money(g.protected_break_even_price)} detail="Not a recommended selling price."/><MiniMetric label="Competitor / Target" value={money(g.competitor_price)} detail={g.safe_for_price_comparison?'Comparable evidence':'Not verified comparable'} tone={danger?'destructive':'default'}/></div><div className={`rounded-lg border px-3 py-2 text-sm ${g.safe_for_price_comparison?'border-border bg-muted/20':'border-warning/30 bg-warning/5 text-warning'}`}><strong>CAREZ GUIDANCE:</strong> <span className={g.safe_for_price_comparison?'text-muted-foreground':''}>{g.price_guidance}</span></div>{g.competitor_price&&<p className="text-xs text-muted-foreground">If Carez simply matched that number with the current cost model, projected margin would be {pct(g.margin_if_competitor_price_matched)}. Scope and production assumptions still need review before changing price.</p>}{lf&&<div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-medium">Scope Leveling</div><div className="text-xs text-muted-foreground">{lf.leveling_status}</div></div><div className="sm:text-right"><div className="font-mono text-sm font-semibold tabular-nums">{money(lf.leveled_competitor_price)}</div><div className="text-xs text-muted-foreground">Leveled competitor</div></div></div>}</CardContent></Card>})}</div>}
   </section>

   {(feedback||[]).length>0&&<section className="space-y-4">
    <SectionHeading kicker="Apples to apples" title="Competitor Scope Leveling" description="Confirm scope differences before treating a competitor number as a true price comparison."/>
    <div className="grid gap-4">{(feedback||[]).map((f:any)=>{const lv:any=levelingMap.get(f.id),items=scopeMap.get(f.id)||[],est=(estimates||[]).find((e:any)=>e.id===f.estimate_id);return <Card key={f.id} className="gap-0 py-0 shadow-none"><CardHeader className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div><CardTitle>{f.competitor_name||'Competitor / market feedback'} — {money(f.competitor_price)}</CardTitle><CardDescription className="mt-1">{nice(f.feedback_source)} · evidence {f.evidence_strength} · scope {f.scope_comparable}</CardDescription></div><Badge variant="outline" className={lv?.comparison_ready?'border-success/30 bg-success/10 text-success':f.evidence_strength==='unverified'?'border-warning/30 bg-warning/10 text-warning':'text-muted-foreground'}>{lv?.comparison_ready?'leveled':'needs scope check'}</Badge></CardHeader><CardContent className="space-y-4 py-4">
     {lv&&<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><MiniMetric label="Raw Number" value={money(lv.competitor_price)}/><MiniMetric label="Known Scope Equalization" value={money(lv.equalization_amount)}/><MiniMetric label="Leveled Number" value={money(lv.leveled_competitor_price)} tone="primary"/><MiniMetric label="Unknown Scope Items" value={String(lv.competitor_unknown_items)}/></div>}
     {items.length>0&&<div className="divide-y rounded-lg border border-border">{items.map((x:any)=><div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between" key={x.id}><div><div className="text-sm font-medium">{x.description}</div><div className="mt-1 text-xs text-muted-foreground">Carez: {x.carez_status} · Competitor: {x.competitor_status}{n(x.equalization_amount)?` · equalize ${money(x.equalization_amount)}`:''}</div></div><form action={deleteScopeComparisonItem}><input type="hidden" name="item_id" value={x.id}/><Button type="submit" variant="outline" size="sm">Remove</Button></form></div>)}</div>}
     <form action={addScopeComparisonItem} className="grid gap-3 rounded-lg border border-border p-3"><input type="hidden" name="lead_id" value={f.lead_id}/><input type="hidden" name="bid_price_feedback_id" value={f.id}/><input type="hidden" name="estimate_id" value={f.estimate_id||''}/><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Scope Item"><Input name="description" required placeholder="Rebar material + install"/></Field><Field label="Carez"><select name="carez_status" defaultValue="included" className={selectClass}><option value="included">Included</option><option value="excluded">Excluded</option><option value="allowance">Allowance</option><option value="unknown">Unknown</option></select></Field><Field label="Competitor"><select name="competitor_status" defaultValue="unknown" className={selectClass}><option value="unknown">Unknown</option><option value="included">Included</option><option value="excluded">Excluded</option><option value="allowance">Allowance</option></select></Field><Field label="Add to Competitor to Equalize"><Input type="number" min="0" step="100" name="equalization_amount" defaultValue="0"/></Field></div><Field label="Note"><Input name="note" placeholder="Quote specifically excludes reinforcing / allowance only..."/></Field><div><Button type="submit" variant="outline" size="sm">Add Scope Check</Button></div></form>
     {est&&<p className="text-xs text-muted-foreground">Linked estimate: {est.estimate_number} — {est.name}</p>}
    </CardContent></Card>})}</div>
   </section>}

   <section className="space-y-4">
    <SectionHeading kicker="Value engineering" title="Offer a Better Option, Not a Blind Discount" description="Record alternatives that change method, scope or schedule while showing the impact on Carez cost and the customer price."/>
    <Card className="shadow-none"><CardContent className="pt-6"><form action={addValueOption} className="grid gap-3"><div className="grid gap-3 md:grid-cols-2"><Field label="Lead"><select name="lead_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose opportunity</option>{(leads||[]).map((l:any)=><option key={l.id} value={l.id}>{l.opportunity_number} — {l.customer_name}</option>)}</select></Field><Field label="Estimate"><select name="estimate_id" defaultValue="" className={selectClass}><option value="">Not linked yet</option>{(estimates||[]).map((e:any)=><option key={e.id} value={e.id}>{e.estimate_number} v{e.version} — {e.name}</option>)}</select></Field></div><div className="grid gap-3 md:grid-cols-3"><Field label="Option Name"><Input name="name" required placeholder="Owner handles demo / alternate finish / combine pours"/></Field><Field label="Customer Price Change"><Input type="number" step="100" name="sell_price_change" defaultValue="0"/><span className="text-xs text-muted-foreground">Negative = customer savings.</span></Field><Field label="Carez Cost Change"><Input type="number" step="100" name="company_cost_change" defaultValue="0"/><span className="text-xs text-muted-foreground">Negative = Carez cost savings.</span></Field></div><Field label="Customer-Facing Description"><Textarea name="customer_description" rows={2} required placeholder="Explain exactly what changes and what stays the same."/></Field><div className="grid gap-3 md:grid-cols-3"><Field label="Schedule Days Change"><Input type="number" name="schedule_days_change" defaultValue="0"/></Field><Field label="Function / Quality Impact"><Input name="function_quality_note" placeholder="No structural change / different finish / owner responsibility..."/></Field><Field label="Approval Required"><Input name="approval_required" placeholder="Engineer / GC / owner approval if applicable"/></Field></div><div><Button type="submit">Add Value Option</Button></div></form></CardContent></Card>
    {(options||[]).length>0&&<div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[900px] border-collapse text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr>{['Option','Base','Option Price','Cost Change','Projected Margin','Status'].map(h=><th key={h} className="border-b border-border px-3 py-2.5 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{(options||[]).map((o:any)=><tr key={o.id} className="align-top hover:bg-muted/20"><td className="px-3 py-3"><strong>{o.name}</strong><div className="mt-1 max-w-lg text-xs text-muted-foreground">{o.customer_description}</div></td><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{money(o.base_sell_price)}</td><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{money(o.option_sell_price)}</td><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{money(o.company_cost_change)}</td><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{pct(o.option_projected_margin_percent)}</td><td className="px-3 py-3"><form action={updateValueOptionStatus} className="grid min-w-36 gap-2"><input type="hidden" name="option_id" value={o.id}/><select name="status" defaultValue={o.status} className={selectClass}><option value="suggested">Suggested</option><option value="presented">Presented</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option></select><Button type="submit" variant="outline" size="sm">Save</Button></form></td></tr>)}</tbody></table></div>}
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="Learn the market" title="Win Rate by Bid Type" description="Do not mix hard bids, competitive private work and relationship-driven work into one misleading company number."/>
    {(winRates||[]).length===0?<Empty className="min-h-44 border border-border bg-muted/10"><EmptyHeader><EmptyTitle>No decided-bid history yet</EmptyTitle><EmptyDescription>Carez will build this automatically as bids are marked Won or Lost.</EmptyDescription></EmptyHeader></Empty>:<div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[760px] border-collapse text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr>{['Bid Type','Decided','Wins','Losses','Win Rate','Avg Estimate Hours'].map(h=><th key={h} className="border-b border-border px-3 py-2.5 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{(winRates||[]).map((x:any)=><tr key={x.bid_type} className="hover:bg-muted/20"><td className="px-3 py-3">{nice(x.bid_type)}</td><td className="px-3 py-3 font-mono tabular-nums">{x.decided_bids}</td><td className="px-3 py-3 font-mono tabular-nums">{x.wins}</td><td className="px-3 py-3 font-mono tabular-nums">{x.losses}</td><td className="px-3 py-3 font-mono tabular-nums">{pct(x.win_rate_percent)}</td><td className="px-3 py-3 font-mono tabular-nums">{x.avg_estimator_hours} HR</td></tr>)}</tbody></table></div>}
   </section>
  </div>
 </AppShell>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description:string}){
 return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 max-w-5xl text-sm text-muted-foreground">{description}</p></div>;
}

function Field({label,children}:{label:string;children:any}){
 return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

function Metric({label,value,help,tone='default'}:{label:string;value:string|number;help:string;tone?:'default'|'success'|'warning'|'destructive'}){
 const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='destructive'?'text-destructive':'text-foreground';
 const borderClass=tone==='warning'?'border-warning/30':tone==='destructive'?'border-destructive/30':'';
 return <Card className={`gap-2 py-4 shadow-none ${borderClass}`}><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}

function MiniMetric({label,value,detail,tone='default'}:{label:string;value:string;detail?:string;tone?:'default'|'primary'|'destructive'}){
 const toneClass=tone==='primary'?'text-primary':tone==='destructive'?'text-destructive':'text-foreground';
 return <div className={`rounded-lg border p-3 ${tone==='destructive'?'border-destructive/30':''}`}><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>{detail&&<div className="mt-1 text-xs text-muted-foreground">{detail}</div>}</div>;
}

function RecommendationBadge({recommendation,score}:{recommendation:string;score:any}){
 const cls=recommendation==='pursue'?'border-success/30 bg-success/10 text-success':recommendation==='pass'?'border-destructive/30 bg-destructive/10 text-destructive':'border-warning/30 bg-warning/10 text-warning';
 return <Badge variant="outline" className={cls}>{score}/100 · {recommendation}</Badge>;
}
