import {redirect} from 'next/navigation';
import {Children,cloneElement,isValidElement,type ReactNode} from 'react';
import Link from 'next/link';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,Input,Field as FluentField,Select,Textarea,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import {PendingActionButton} from './PendingActionButton';
import viewStyles from './opportunity-view.module.css';
import {intelligenceComparisonState,intelligenceReadState,type IntelligenceReads} from './intelligence-read-state';
import {createClient} from '@/lib/supabase/server';
import {saveBidProfile,recordCompetitorFeedback,addScopeComparisonItem,deleteScopeComparisonItem,addValueOption,updateValueOptionStatus,recordBidFollowUp,markProposalSent,recordBidOutcome} from '@/app/bid-intelligence/actions';

const money=(v:any)=>v==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v));
const n=(v:any)=>Number(v||0);
const pct=(v:any)=>v==null?'—':`${Number(v).toFixed(1)}%`;
const nice=(v:any)=>String(v||'').replaceAll('_',' ');
const secondaryActionClass='inline-flex min-h-8 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs font-medium hover:bg-accent';
const primaryActionClass='w-fit border border-border bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90';
const detailsClass='border-b border-border';
const summaryClass='cursor-pointer list-none py-2 text-sm font-medium text-foreground transition-colors hover:text-foreground';
const fieldGridClass='grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-4';


export async function BidIntelligenceView(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!p?.company_id)redirect('/login');
 if(p.role==='employee')redirect('/employee');
 const companyId=p.company_id;
 const [pipeline,profiles,guardrails,feedback,leveling,scopeItems,options,winRates,leads,estimates]=await Promise.all([
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
 return <BidIntelligenceContent reads={{pipeline,profiles,guardrails,feedback,leveling,scopeItems,options,winRates,leads,estimates}}/>;
}

export function BidIntelligenceContent({reads}:{reads:IntelligenceReads}){
 const model=intelligenceReadState(reads);
 const {available}=model;
 const {profiles,guardrails,feedback,leveling,scopeItems,options,winRates,leads,estimates}=model.records;
 const scoreMap=new Map((profiles||[]).map((x:any)=>[x.lead_id,x]));
 const estByLead=new Map<string,any>();
 for(const e of estimates||[]){if(e.lead_id&&!estByLead.has(e.lead_id))estByLead.set(e.lead_id,e);}
 const {decided,wins}=model;
 const scopeMap=new Map<string,any[]>();
 for(const x of scopeItems||[]){const a=scopeMap.get(x.bid_price_feedback_id)||[];a.push(x);scopeMap.set(x.bid_price_feedback_id,a);}
 const levelingMap=new Map((leveling||[]).map((x:any)=>[x.bid_price_feedback_id,x]));

 return <>
  <div className={`${viewStyles.workspace} flex w-full min-w-0 flex-col gap-6 rounded-lg border border-border`}>
   <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company-wide intelligence</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Bid Intelligence</h1><p className="mt-1 max-w-5xl text-sm text-muted-foreground">All company opportunities, including bids outside the selected workspace.</p></div>
    <div className="flex flex-wrap gap-2"><Link className={secondaryActionClass} href="/opportunities">Open bid pipeline</Link></div>
   </header>

   <section className={fieldGridClass} aria-label="Bid intelligence summary">
    <Metric label="Active Pursuits" value={model.activePursuits??'Unavailable'} help="Leads still capable of becoming work."/>
    <Metric label="Follow-Up Due" value={model.followupsDue??'Unavailable'} help="Proposal conversations waiting on PourTrace." tone={model.followupsDue===null?'default':model.followupsDue?'destructive':'success'}/>
    <Metric label="Proposals Out" value={model.proposalsOut??'Unavailable'} help="Pricing in the customer's hands."/>
    <Metric label="Measured Win Rate" value={decided===null?'Unavailable':decided?pct(100*wins!/decided):'Learning'} help={decided===null?'Win-rate history could not be loaded.':decided?`${wins} wins from ${decided} decided bids.`:'PourTrace needs decided bids before judging pricing.'}/>
   </section>

   {!available.pipeline&&<Unavailable label="Pipeline intelligence" read={reads.pipeline}/> }

   {available.winRates&&decided===0&&<div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm"><strong className="text-warning">No decided bids.</strong><span className="text-muted-foreground"> Pricing comparisons need recorded bid outcomes.</span></div>}

   <section className="space-y-4">
    <SectionHeading kicker="Pursuit discipline" title="Pursuit profiles" description="Score fit consistently before doing a full takeoff. A high score means favorable conditions; it is a decision aid, not an automatic rejection rule."/>
    {!available.leads&&<Unavailable label="Leads" read={reads.leads}/>}
    {!available.profiles&&<Unavailable label="Pursuit profiles" read={reads.profiles}/> }
    {!available.estimates&&<Unavailable label="Estimates" read={reads.estimates}/> }
    {available.leads&&leads.length===0?<div className="rounded-md border border-border bg-secondary p-4"><div><h3>No leads yet</h3><p>Create a lead before scoring pursuit fit.</p></div></div>:<div className="grid gap-4">{(leads||[]).map((l:any)=>{
      const b:any=scoreMap.get(l.id),e=estByLead.get(l.id);
      return <article key={l.id} className="border-b border-border pb-4 ">
       <header className="grid gap-3 border-b border-border py-2  sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><h3 className="text-base font-semibold">{l.opportunity_number} — {l.customer_name}</h3><p className="mt-1 text-sm text-muted-foreground">{l.project_name}{l.city?` · ${l.city}`:''} · {nice(l.status)}</p></div>{b&&<RecommendationBadge recommendation={b.carez_recommendation} score={b.carez_pursuit_score}/>}</header>
       <div className="space-y-4 py-2">
        {b&&<div className={fieldGridClass}><MiniMetric label="PourTrace Pursuit Score" value={`${b.carez_pursuit_score}/100`} detail={`Recommendation: ${b.carez_recommendation}`}/><MiniMetric label="Estimate Effort" value={b.estimator_effort_hours==null?'—':`${b.estimator_effort_hours} HR`}/><MiniMetric label="Customer Budget" value={money(b.customer_budget)}/></div>}
        {available.profiles&&<Accordion collapsible ><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>{b?'Update Pursuit Score':'Score This Opportunity'}</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="pb-2 pt-3"><form action={saveBidProfile} className="grid gap-4"><input type="hidden" name="lead_id" value={l.id}/>
         <div className={fieldGridClass}><Field scope={`pursuit-${l.id}`} label="How Is This Job Bought?"><Select appearance="outline" className="w-full" name="bid_type" defaultValue={b?.bid_type||'private_competitive'}><option value="residential_direct">Residential / direct owner</option><option value="private_competitive">Private competitive</option><option value="gc_invited">GC invited bid</option><option value="negotiated">Negotiated / selective</option><option value="public_hard_bid">Public hard bid</option><option value="repeat_client">Repeat client</option><option value="other">Other</option></Select></Field><Field scope={`pursuit-${l.id}`} label="Relationship"><Select appearance="outline" className="w-full" name="relationship_strength" defaultValue={b?.relationship_strength||'new'}><option value="new">New</option><option value="known">Known</option><option value="repeat">Repeat</option></Select></Field><Field scope={`pursuit-${l.id}`} label="Expected Competitors"><Input appearance="underline" className="w-full" type="number" min="0" name="estimated_competitor_count" defaultValue={b?.estimated_competitor_count??''}/></Field></div>
         <div className={fieldGridClass}><Field scope={`pursuit-${l.id}`} label="Customer / GC Budget"><Input appearance="underline" className="w-full" type="number" min="0" step="100" name="customer_budget" defaultValue={b?.customer_budget??''}/></Field><Field scope={`pursuit-${l.id}`} label="Budget Source"><Input appearance="underline" className="w-full" name="customer_budget_source" defaultValue={b?.customer_budget_source||''} placeholder="GC told us / published / owner conversation"/></Field><Field scope={`pursuit-${l.id}`} label="Estimator Hours"><Input appearance="underline" className="w-full" type="number" min="0" step="0.25" name="estimator_effort_hours" defaultValue={b?.estimator_effort_hours??''}/></Field></div>
         <div className={fieldGridClass}>{[['project_fit_score','Project Fit'],['relationship_score','Relationship'],['scope_clarity_score','Scope Clarity'],['capacity_score','Capacity'],['margin_potential_score','Margin Potential'],['payment_confidence_score','Payment Confidence'],['competition_score','Competition Position'],['risk_score','Risk Quality']].map(([k,text])=><Field scope={`pursuit-${l.id}`} label={`${text} · 5 best`} key={k}><Select appearance="outline" className="w-full" name={k} defaultValue={String(b?.[k]??3)}>{[1,2,3,4,5].map(v=><option key={v} value={String(v)}>{v}</option>)}</Select></Field>)}</div>
         <div className={fieldGridClass}><Field scope={`pursuit-${l.id}`} label="Decision"><Select appearance="outline" className="w-full" name="pursuit_decision" defaultValue={b?.pursuit_decision||'review'}><option value="pursue">Pursue</option><option value="review">Review</option><option value="pass">Pass</option></Select></Field><Field scope={`pursuit-${l.id}`} label="If Passing, Why?"><Input appearance="underline" className="w-full" name="pass_reason" defaultValue={b?.pass_reason||''}/></Field></div>
         <div><PendingActionButton label="Save Hit Decision" pendingLabel="Saving decision…" className={primaryActionClass}/></div>
        </form></div></AccordionPanel></AccordionItem></Accordion>

        }


        {available.estimates&&e&&<form action={markProposalSent}><input type="hidden" name="lead_id" value={l.id}/><Button type="submit" appearance="outline" size="small">Mark Proposal Sent</Button></form>}

        <Accordion collapsible><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>Record Follow-Up</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="pb-2 pt-3"><form action={recordBidFollowUp} className="grid gap-4"><input type="hidden" name="lead_id" value={l.id}/><Field scope={`follow-up-${l.id}`} label="What did the customer / GC say?"><Textarea appearance="outline" className="w-full" name="note" rows={2} required placeholder="Reviewed proposal, comparing concrete subs, asked about schedule..."/></Field><Field scope={`follow-up-${l.id}`} label="Next Follow-Up"><Input appearance="underline" className="w-full" type="date" name="next_follow_up"/></Field><div><Button type="submit" appearance="outline" size="small">Save Follow-Up</Button></div></form></div></AccordionPanel></AccordionItem></Accordion>

        {available.profiles&&b&&<Accordion collapsible><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>Record Final Outcome</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="pb-2 pt-3"><form action={recordBidOutcome} className="grid gap-4"><input type="hidden" name="lead_id" value={l.id}/><div className={fieldGridClass}><Field scope={`outcome-${l.id}`} label="Outcome"><Select appearance="outline" className="w-full" name="outcome" defaultValue="lost"><option value="won">Won</option><option value="lost">Lost</option><option value="no_decision">No decision / project died</option><option value="withdrawn">PourTrace withdrew</option></Select></Field><Field scope={`outcome-${l.id}`} label="Lost Reason"><Select appearance="outline" className="w-full" name="lost_reason" defaultValue="price"><option value="price">Price / competitor lower</option><option value="scope">Scope mismatch</option><option value="relationship">Incumbent / relationship</option><option value="schedule">Schedule / availability</option><option value="qualification">Qualification / capability</option><option value="no_feedback">No useful feedback</option><option value="other">Other</option></Select></Field></div><Field scope={`outcome-${l.id}`} label="What did we learn?"><Textarea appearance="outline" className="min-h-24 w-full" rows={3} name="outcome_note" placeholder="Competitor named, amount, scope difference, GC feedback..."/></Field><div><Button type="submit" appearance="outline" size="small">Save Outcome</Button></div></form></div></AccordionPanel></AccordionItem></Accordion>}
       </div>
      </article>;
    })}</div>}
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="Price defense" title="Market feedback" description="Record exactly what evidence you received. PourTrace treats a customer claim differently from a quote, bid tab or credible GC feedback."/>


    {!available.guardrails&&<Unavailable label="Pricing guardrails" read={reads.guardrails}/> }
    {!available.feedback&&<Unavailable label="Competitor feedback" read={reads.feedback}/> }
    {!available.leveling&&<Unavailable label="Scope leveling" read={reads.leveling}/> }
    {!available.scopeItems&&<Unavailable label="Scope comparison items" read={reads.scopeItems}/> }
    {(guardrails||[]).length>0&&<div className="grid gap-4">{(guardrails||[]).map((g:any)=>{const lf:any=g.feedback_id?levelingMap.get(g.feedback_id):null;const comparisonAvailable=model.guardrailComparisonAvailable;const danger=comparisonAvailable&&Boolean(g.competitor_price&&g.competitor_price<g.protected_break_even_price);return <article key={g.estimate_id} className="border-b border-border pb-4 "><header className="grid gap-3 border-b border-border py-2  sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div><h3 className="text-base font-semibold">{g.estimate_number} — {g.name}</h3><p className="mt-1 text-sm text-muted-foreground">Estimate pricing guardrail</p></div><Badge appearance="outline" className={comparisonAvailable&&g.safe_for_price_comparison?'border-success/30 bg-success/10 text-success':'text-muted-foreground'}>{comparisonAvailable?g.evidence_strength||'no market evidence':'Comparison unavailable'}</Badge></header><div className="space-y-4 py-2"><div className={fieldGridClass}><MiniMetric label="Current Proposal" value={money(g.selected_sell_price)} detail={`Projected margin ${pct(g.projected_margin_percent)}`} tone="primary"/><MiniMetric label="Recommended Target" value={money(g.recommended_sell_price)}/><MiniMetric label="Protected Break-Even" value={money(g.protected_break_even_price)} detail="Not a recommended selling price."/><MiniMetric label="Competitor / Target" value={money(g.competitor_price)} detail={!comparisonAvailable?'Comparison unavailable':g.safe_for_price_comparison?'Comparable evidence':'Not verified comparable'} tone={danger?'destructive':'default'}/></div><div className={`rounded-lg border px-3 py-2 text-sm ${!comparisonAvailable||g.safe_for_price_comparison?'border-border bg-muted/20':'border-warning/30 bg-warning/5 text-warning'}`}><strong>Pricing guidance:</strong> <span className={!comparisonAvailable||g.safe_for_price_comparison?'text-muted-foreground':''}>{comparisonAvailable?g.price_guidance:'Unavailable — comparison inputs could not be loaded.'}</span></div>{comparisonAvailable&&g.competitor_price&&<p className="text-xs text-muted-foreground">If PourTrace simply matched that number with the current cost model, projected margin would be {pct(g.margin_if_competitor_price_matched)}. Scope and production assumptions still need review before changing price.</p>}{available.leveling&&lf&&<div className="flex flex-col gap-2 border-t border-border py-2  sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-medium">Scope Leveling</div><div className="text-xs text-muted-foreground">{available.scopeItems?lf.leveling_status:'Unavailable'}</div></div><div className="sm:text-right"><div className="font-mono text-sm font-semibold tabular-nums">{available.scopeItems?money(lf.leveled_competitor_price):'Unavailable'}</div><div className="text-xs text-muted-foreground">Leveled competitor</div></div></div>}</div></article>})}</div>}
   </section>

   {(feedback||[]).length>0&&<section className="space-y-4">
    <SectionHeading kicker="Apples to apples" title="Scope comparison" description="Confirm scope differences before treating a competitor number as a true price comparison."/>
    <div className="grid gap-4">{(feedback||[]).map((f:any)=>{const lv:any=levelingMap.get(f.id),items=scopeMap.get(f.id)||[],est=(estimates||[]).find((e:any)=>e.id===f.estimate_id),comparisonState=intelligenceComparisonState(model,lv);return <article key={f.id} className="border-b border-border pb-4 "><header className="grid gap-3 border-b border-border py-2  sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div><h3 className="text-base font-semibold">{f.competitor_name||'Competitor / market feedback'} — {money(f.competitor_price)}</h3><p className="mt-1 text-sm text-muted-foreground">{nice(f.feedback_source)} · evidence {f.evidence_strength} · scope {f.scope_comparable}</p></div><Badge appearance="outline" className={comparisonState==='ready'?'border-success/30 bg-success/10 text-success':comparisonState==='needs-scope-check'&&f.evidence_strength==='unverified'?'border-warning/30 bg-warning/10 text-warning':'text-muted-foreground'}>{comparisonState==='unavailable'?'Comparison unavailable':comparisonState==='missing'?'Leveling not recorded':comparisonState==='ready'?'leveled':'needs scope check'}</Badge></header><div className="space-y-4 py-2">
     {lv&&<div className={fieldGridClass}><MiniMetric label="Raw Number" value={available.leveling?money(lv.competitor_price):'Unavailable'}/><MiniMetric label="Known Scope Equalization" value={available.leveling&&available.scopeItems?money(lv.equalization_amount):'Unavailable'}/><MiniMetric label="Leveled Number" value={available.leveling&&available.scopeItems?money(lv.leveled_competitor_price):'Unavailable'} tone="primary"/><MiniMetric label="Unknown Scope Items" value={available.scopeItems&&available.leveling?String(lv.competitor_unknown_items):'Unavailable'}/></div>}
     {items.length>0&&<div className="divide-y divide-border border-y border-border dark:divide-border ">{items.map((x:any)=><div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between" key={x.id}><div><div className="text-sm font-medium">{x.description}</div><div className="mt-1 text-xs text-muted-foreground">PourTrace: {x.carez_status} · Competitor: {x.competitor_status}{n(x.equalization_amount)?` · equalize ${money(x.equalization_amount)}`:''}</div></div><form action={deleteScopeComparisonItem}><input type="hidden" name="item_id" value={x.id}/><Button type="submit" appearance="outline" size="small">Remove</Button></form></div>)}</div>}
     {available.feedback&&available.scopeItems&&<Accordion collapsible><AccordionItem value="scope" className={detailsClass}><AccordionHeader className={summaryClass}>Add scope check</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><form action={addScopeComparisonItem} className="grid gap-4 border-t border-border pt-4 "><input type="hidden" name="lead_id" value={f.lead_id}/><input type="hidden" name="bid_price_feedback_id" value={f.id}/><input type="hidden" name="estimate_id" value={f.estimate_id||''}/><div className={fieldGridClass}><Field scope={`scope-${f.id}`} label="Scope Item"><Input appearance="underline" className="w-full" name="description" required placeholder="Rebar material + install"/></Field><Field scope={`scope-${f.id}`} label="PourTrace"><Select appearance="outline" className="w-full" name="carez_status" defaultValue="included"><option value="included">Included</option><option value="excluded">Excluded</option><option value="allowance">Allowance</option><option value="unknown">Unknown</option></Select></Field><Field scope={`scope-${f.id}`} label="Competitor"><Select appearance="outline" className="w-full" name="competitor_status" defaultValue="unknown"><option value="unknown">Unknown</option><option value="included">Included</option><option value="excluded">Excluded</option><option value="allowance">Allowance</option></Select></Field><Field scope={`scope-${f.id}`} label="Add to Competitor to Equalize"><Input appearance="underline" className="w-full" type="number" min="0" step="100" name="equalization_amount" defaultValue="0"/></Field></div><Field scope={`scope-${f.id}`} label="Note"><Textarea appearance="outline" className="min-h-24 w-full" rows={3} name="note" placeholder="Quote specifically excludes reinforcing / allowance only..."/></Field><div><Button type="submit" appearance="outline" size="small">Add Scope Check</Button></div></form></AccordionPanel></AccordionItem></Accordion>}
     {f.estimate_id&&!available.estimates&&<Unavailable label="Linked estimate" read={reads.estimates}/> }
     {available.estimates&&est&&<p className="text-xs text-muted-foreground">Linked estimate: {est.estimate_number} — {est.name}</p>}
    </div></article>})}</div>
   </section>}

   <section aria-label="Record market feedback">
    <ChoiceReadStatus reads={reads}/>
    {model.choicesAvailable&&available.feedback&&<Accordion collapsible><AccordionItem value="feedback" className={detailsClass}><AccordionHeader className={summaryClass}>Record market feedback</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><article><div className="pt-2"><form action={recordCompetitorFeedback} className="grid gap-4"><div className={fieldGridClass}><Field scope="market-feedback" label="Lead"><Select appearance="outline" className="w-full" name="lead_id" required defaultValue=""><option value="" disabled>Choose opportunity</option>{(leads||[]).map((l:any)=><option key={l.id} value={l.id}>{l.opportunity_number} — {l.customer_name} — {l.project_name}</option>)}</Select></Field><Field scope="market-feedback" label="Estimate (if applicable)"><Select appearance="outline" className="w-full" name="estimate_id" defaultValue=""><option value="">No estimate link</option>{(estimates||[]).map((e:any)=><option key={e.id} value={e.id}>{e.estimate_number} v{e.version} — {e.name}</option>)}</Select></Field><Field scope="market-feedback" label="Where Did the Number Come From?"><Select appearance="outline" className="w-full" name="feedback_source" defaultValue="customer_claim"><option value="customer_claim">Customer says another contractor is cheaper</option><option value="gc_feedback">GC gave bid feedback</option><option value="public_bid_tab">Public bid tab</option><option value="direct_competitor_quote">Saw competitor quote</option><option value="owner_budget">Owner / GC budget target</option><option value="other">Other</option></Select></Field></div><div className={fieldGridClass}><Field scope="market-feedback" label="Competitor"><Input appearance="underline" className="w-full" name="competitor_name" placeholder="Optional"/></Field><Field scope="market-feedback" label="Competitor / Target Price"><Input appearance="underline" className="w-full" type="number" min="0" step="100" name="competitor_price"/></Field><Field scope="market-feedback" label="Is Their Scope Confirmed Comparable?"><Select appearance="outline" className="w-full" name="scope_comparable" defaultValue="unknown"><option value="unknown">Unknown</option><option value="yes">Yes — leveled / comparable</option><option value="no">No — known scope difference</option></Select></Field></div><Field scope="market-feedback" label="What exactly were you told / shown?"><Textarea appearance="outline" className="w-full" name="note" rows={2}/></Field><div><PendingActionButton label="Record Market Feedback" pendingLabel="Recording feedback…" className={primaryActionClass}/></div></form></div></article></AccordionPanel></AccordionItem></Accordion>}
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="Value engineering" title="Value options" description="Record alternatives that change method, scope or schedule while showing the impact on PourTrace cost and the customer price."/>

    {!available.options&&<Unavailable label="Value options" read={reads.options}/> }
    {(options||[]).length>0&&<div className="overflow-x-auto rounded-lg border border-border"><Table className="w-full min-w-[900px] border-collapse text-sm"><TableHeader className="bg-muted/30 text-left text-xs text-muted-foreground"><TableRow>{['Option','Base','Option Price','Cost Change','Projected Margin','Status'].map(h=><TableHeaderCell key={h} className="border-b border-border px-3 py-2.5 font-medium">{h}</TableHeaderCell>)}</TableRow></TableHeader><TableBody className="divide-y divide-border">{(options||[]).map((o:any)=><TableRow key={o.id} className="align-top hover:bg-muted/20"><TableCell className="px-3 py-3"><strong>{o.name}</strong><div className="mt-1 max-w-lg text-xs text-muted-foreground">{o.customer_description}</div></TableCell><TableCell className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{money(o.base_sell_price)}</TableCell><TableCell className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{money(o.option_sell_price)}</TableCell><TableCell className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{money(o.company_cost_change)}</TableCell><TableCell className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{pct(o.option_projected_margin_percent)}</TableCell><TableCell className="px-3 py-3"><form action={updateValueOptionStatus} className="grid min-w-36 gap-2"><input type="hidden" name="option_id" value={o.id}/><Select appearance="outline" className="w-full" name="status" aria-label={`Status for ${o.name}`} defaultValue={o.status}><option value="suggested">Suggested</option><option value="presented">Presented</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option></Select><Button type="submit" appearance="outline" size="small">Save</Button></form></TableCell></TableRow>)}</TableBody></Table></div>}
    <ChoiceReadStatus reads={reads}/>
    {model.choicesAvailable&&available.options&&<Accordion collapsible><AccordionItem value="option" className={detailsClass}><AccordionHeader className={summaryClass}>Add value option</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><article><div className="pt-2"><form action={addValueOption} className="grid gap-4"><div className={fieldGridClass}><Field scope="value-option" label="Lead"><Select appearance="outline" className="w-full" name="lead_id" required defaultValue=""><option value="" disabled>Choose opportunity</option>{(leads||[]).map((l:any)=><option key={l.id} value={l.id}>{l.opportunity_number} — {l.customer_name}</option>)}</Select></Field><Field scope="value-option" label="Estimate"><Select appearance="outline" className="w-full" name="estimate_id" defaultValue=""><option value="">Not linked yet</option>{(estimates||[]).map((e:any)=><option key={e.id} value={e.id}>{e.estimate_number} v{e.version} — {e.name}</option>)}</Select></Field></div><div className={fieldGridClass}><Field scope="value-option" label="Option Name"><Input appearance="underline" className="w-full" name="name" required placeholder="Owner handles demo / alternate finish / combine pours"/></Field><Field scope="value-option" label="Customer Price Change"><Input appearance="underline" className="w-full" type="number" step="100" name="sell_price_change" defaultValue="0"/><span className="text-xs text-muted-foreground">Negative = customer savings.</span></Field><Field scope="value-option" label="PourTrace Cost Change"><Input appearance="underline" className="w-full" type="number" step="100" name="company_cost_change" defaultValue="0"/><span className="text-xs text-muted-foreground">Negative = PourTrace cost savings.</span></Field></div><Field scope="value-option" label="Customer-Facing Description"><Textarea appearance="outline" className="w-full" name="customer_description" rows={2} required placeholder="Explain exactly what changes and what stays the same."/></Field><div className={fieldGridClass}><Field scope="value-option" label="Schedule Days Change"><Input appearance="underline" className="w-full" type="number" name="schedule_days_change" defaultValue="0"/></Field><Field scope="value-option" label="Function / Quality Impact"><Input appearance="underline" className="w-full" name="function_quality_note" placeholder="No structural change / different finish / owner responsibility..."/></Field><Field scope="value-option" label="Approval Required"><Input appearance="underline" className="w-full" name="approval_required" placeholder="Engineer / GC / owner approval if applicable"/></Field></div><div><PendingActionButton label="Add Value Option" pendingLabel="Adding option…" className={primaryActionClass}/></div></form></div></article></AccordionPanel></AccordionItem></Accordion>}
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="Learn the market" title="Results by bid type" description="Do not mix hard bids, competitive private work and relationship-driven work into one misleading company number."/>
    {!available.winRates&&<Unavailable label="Win-rate history" read={reads.winRates}/> }
    {available.winRates&&winRates.length===0?<div className="rounded-md border border-border bg-secondary p-4"><div><h3>No decided-bid history yet</h3><p>Won and lost bids will appear here.</p></div></div>:winRates.length>0?<div className="overflow-x-auto rounded-lg border border-border"><Table className="w-full min-w-[760px] border-collapse text-sm"><TableHeader className="bg-muted/30 text-left text-xs text-muted-foreground"><TableRow>{['Bid Type','Decided','Wins','Losses','Win Rate','Avg Estimate Hours'].map(h=><TableHeaderCell key={h} className="border-b border-border px-3 py-2.5 font-medium">{h}</TableHeaderCell>)}</TableRow></TableHeader><TableBody className="divide-y divide-border">{(winRates||[]).map((x:any)=><TableRow key={x.bid_type} className="hover:bg-muted/20"><TableCell className="px-3 py-3">{nice(x.bid_type)}</TableCell><TableCell className="px-3 py-3 font-mono tabular-nums">{x.decided_bids}</TableCell><TableCell className="px-3 py-3 font-mono tabular-nums">{x.wins}</TableCell><TableCell className="px-3 py-3 font-mono tabular-nums">{x.losses}</TableCell><TableCell className="px-3 py-3 font-mono tabular-nums">{pct(x.win_rate_percent)}</TableCell><TableCell className="px-3 py-3 font-mono tabular-nums">{x.avg_estimator_hours} HR</TableCell></TableRow>)}</TableBody></Table></div>:null}
   </section>
  </div>
 </>;
}

function SectionHeading({title,description}:{kicker:string;title:string;description:string}){
 return <div className="mb-3 border-b border-border pb-3"><h2 className="text-base font-semibold text-foreground">{title}</h2><details className="pt-help"><summary>About this section</summary><p>{description}</p></details></div>;
}

function Field({scope,label,children}:{scope:string;label:string;children:ReactNode}){
 const controlId=`intelligence-${scope}-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
 const controls=Children.map(children,child=>isValidElement<{id?:string}>(child)&&(child.type===Input||child.type===Select||child.type===Textarea)?cloneElement(child,{id:controlId}):child);
 return <FluentField className="min-w-0" label={{children:label,id:`${controlId}-label`,htmlFor:controlId,className:"mb-1 block text-xs font-medium text-muted-foreground"}}>{controls}</FluentField>;
}

function Metric({label,value,help,tone='default'}:{label:string;value:string|number;help:string;tone?:'default'|'success'|'warning'|'destructive'}){
 const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='destructive'?'text-destructive':'text-foreground';
 const borderClass=tone==='warning'?'border-t-2 border-warning':tone==='destructive'?'border-t-2 border-destructive':'';
 return <div className={`min-w-0 px-4 py-3 ${borderClass}`}><div className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{help}</div></div>;
}

function MiniMetric({label,value,detail,tone='default'}:{label:string;value:string;detail?:string;tone?:'default'|'primary'|'destructive'}){
 const toneClass=tone==='primary'?'text-primary':tone==='destructive'?'text-destructive':'text-foreground';
 return <div className={`min-w-0 border-l border-border px-3 py-2 first:border-l-0 ${tone==='destructive'?'border-destructive/30':''}`}><div className="font-mono text-[10px] font-medium uppercase tracking-[.1em] text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>{detail&&<div className="mt-1 text-xs text-muted-foreground">{detail}</div>}</div>;
}

function RecommendationBadge({recommendation,score}:{recommendation:string;score:any}){
 const cls=recommendation==='pursue'?'border-success/30 bg-success/10 text-success':recommendation==='pass'?'border-destructive/30 bg-destructive/10 text-destructive':'border-warning/30 bg-warning/10 text-warning';
 return <Badge appearance="outline" className={cls}>{score}/100 · {recommendation}</Badge>;
}

function Unavailable({label,read}:{label:string;read:IntelligenceReads[keyof IntelligenceReads]}){
 return <div role="status" data-read-unavailable={label} data-read-error-code={read.error?.code} className="border-l-2 border-border py-2 pl-3 text-sm text-muted-foreground"><strong className="text-foreground">{label}: Unavailable</strong><p>{read.error?'This information could not be loaded.':'The read returned no usable information.'}</p></div>;
}

function ChoiceReadStatus({reads}:{reads:IntelligenceReads}){
 const {available}=intelligenceReadState(reads);
 return <>{!available.leads&&<Unavailable label="Lead choices" read={reads.leads}/>} {!available.estimates&&<Unavailable label="Estimate choices" read={reads.estimates}/>}</>;
}
