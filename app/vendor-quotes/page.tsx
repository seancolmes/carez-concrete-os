import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {CopyVendorLink} from '@/components/opportunities/CopyVendorLink';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Button,Checkbox,Field,Input,Select,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {
  createEstimateSupplierQuote,createEstimateSupplierQuoteLine,
  createEstimateSupplierQuoteSet,selectEstimateSupplierQuoteLine,
} from '@/app/estimates/actions';
import {createVendorAccessLink,revokeVendorAccessLink} from './actions';

type Search={estimate?:string};
const card='rounded-sm border border-border bg-card p-3';
const money=(value:number|string|null|undefined)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));

export default async function VendorQuotesPage({searchParams}:{searchParams:Promise<Search>}){
  const query=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;
  const userName=profile.full_name||user.email||'Owner';
  const {data:estimates,error:estimateListError}=await supabase.from('estimates')
    .select('id,name,estimate_number,version,status').eq('company_id',companyId)
    .order('updated_at',{ascending:false}).limit(50);
  if(estimateListError)throw new Error(estimateListError.message);
  const estimateId=query.estimate||null;
  const estimate=estimateId?(estimates||[]).find(row=>row.id===estimateId):null;
  if(estimateId&&!estimate){
    const {data:found,error}=await supabase.from('estimates')
      .select('id,name,estimate_number,version,status').eq('company_id',companyId).eq('id',estimateId).maybeSingle();
    if(error||!found)notFound();
    return renderEstimate(found);
  }
  return renderEstimate(estimate||null);

  async function renderEstimate(selected:NonNullable<typeof estimate>|null){
    if(!selected)return <AppShell userName={userName}><div className="mx-auto flex min-h-0 w-full max-w-screen-xl flex-col gap-3 lg:h-full"><Header/><div className={card}><p className="mb-3 text-sm text-muted-foreground">Choose an estimate revision to manage supplier pricing.</p><EstimateLinks/></div></div></AppShell>;
    const [{data:sets,error:setsError},{data:measurements,error:measurementError},{count:proposalCount,error:proposalError}]=await Promise.all([
      supabase.from('estimate_supplier_quote_sets').select('id,name,bid_zone,scope_note,status').eq('company_id',companyId).eq('estimate_id',selected.id).order('created_at'),
      supabase.from('takeoff_measurements').select('id,name').eq('company_id',companyId).eq('estimate_id',selected.id).eq('status','active'),
      supabase.from('proposal_presentations').select('id',{count:'exact',head:true}).eq('company_id',companyId).eq('estimate_id',selected.id),
    ]);
    for(const error of [setsError,measurementError,proposalError])if(error)throw new Error(error.message);
    const measurementIds=new Set((measurements||[]).map(row=>row.id));
    const {data:outputs,error:outputError}=measurementIds.size?await supabase.from('takeoff_measurement_outputs')
      .select('id,measurement_id,label,production_quantity,production_unit,estimate_item_type,generated_estimate_item_id,is_active,estimate_visible,price_source_id')
      .eq('company_id',companyId).eq('is_active',true).eq('estimate_visible',true).in('measurement_id',[...measurementIds]):{data:[],error:null};
    if(outputError)throw new Error(outputError.message);
    const setIds=(sets||[]).map(row=>row.id);
    const {data:quotes,error:quotesError}=setIds.length?await supabase.from('estimate_supplier_quotes')
      .select('id,quote_set_id,supplier_name,supplier_quote_number,quote_date,expires_at,status').eq('company_id',companyId).in('quote_set_id',setIds).order('created_at'):{data:[],error:null};
    if(quotesError)throw new Error(quotesError.message);
    const quoteIds=(quotes||[]).map(row=>row.id);
    const [{data:lines,error:linesError},{data:links,error:linksError}]=await Promise.all([
      quoteIds.length?supabase.from('estimate_supplier_quote_lines').select('id,quote_id,source_takeoff_output_id,description,quoted_unit,quoted_unit_cost,source_reference').eq('company_id',companyId).in('quote_id',quoteIds).order('created_at'):{data:[],error:null},
      quoteIds.length?supabase.from('estimate_supplier_quote_access_tokens').select('id,quote_id,token,expires_at,revoked_at').eq('company_id',companyId).in('quote_id',quoteIds).order('created_at',{ascending:false}):{data:[],error:null},
    ]);
    for(const error of [linesError,linksError])if(error)throw new Error(error.message);
    const measurementById=new Map((measurements||[]).map(row=>[row.id,row]));
    const availableOutputs=(outputs||[]).filter(row=>measurementIds.has(row.measurement_id)&&row.estimate_item_type&&row.estimate_item_type!=='labor'&&row.generated_estimate_item_id&&row.production_unit?.trim());
    const outputById=new Map(availableOutputs.map(row=>[row.id,row]));
    const locked=['accepted','approved','superseded'].includes(selected.status)||Boolean(proposalCount);
    const activeLinks=(links||[]).filter(row=>!row.revoked_at&&row.expires_at>new Date().toISOString());
    const selectedCount=availableOutputs.filter(row=>row.price_source_id&&((lines||[]).some(line=>line.id===row.price_source_id))).length;
    return <AppShell userName={userName}><div className="mx-auto flex min-h-0 w-full max-w-screen-xl flex-col gap-3 lg:h-full"><Header/>
      <div className="flex flex-wrap items-center gap-2"><Button as="a" appearance="secondary" size="small" href="/opportunities">Opportunities</Button><EstimateLinks selected={selected}/></div>
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Vendor quote summary">
        {[['Quote sets',(sets||[]).length],['Supplier responses',(quotes||[]).length],['Price lines',(lines||[]).length],['Selected outputs',selectedCount]].map(([title,value])=><div className={card} key={title}><p className="text-xs text-muted-foreground">{title}</p><strong className="mt-2 block font-mono text-2xl text-foreground">{value}</strong></div>)}
      </section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3"><div><p className="font-mono text-xs text-muted-foreground">{selected.estimate_number}-R{selected.version||0}</p><h2 className="text-xl font-semibold">{selected.name}</h2></div><Button as="a" appearance="secondary" size="small" href={`/opportunities?estimate=${encodeURIComponent(selected.id)}&tab=worksheet#pricing-coverage`}>Pricing coverage</Button></div>
      {locked?<p role="status" className="rounded-md border border-warning/30 bg-warning/10 text-warning px-4 py-3 text-sm">This estimate revision is locked. Supplier evidence remains available for review.</p>:null}
      {!locked?<section className={card}><h3 className="mb-3 text-sm font-semibold">Create quote set</h3><form action={createEstimateSupplierQuoteSet} className="grid gap-3 md:grid-cols-4"><input type="hidden" name="estimate_id" value={selected.id}/><Field label="Set name"><Input appearance="underline" className="w-full min-w-0" name="name" required placeholder="Ready-mix · Rebar"/></Field><Field label="Bid zone"><Input appearance="underline" className="w-full min-w-0" name="bid_zone" placeholder="Building A"/></Field><Field label="Scope note"><Input appearance="underline" className="w-full min-w-0" name="scope_note" placeholder="4000 psi mix"/></Field><div className="flex items-end"><Button appearance="secondary" size="small" type="submit">Create set</Button></div></form></section>:null}
      <div className="min-h-0 flex-1 space-y-3 overflow-auto border border-border bg-card p-2">
      {(sets||[]).length===0?<p className="text-sm text-muted-foreground">No supplier quote sets for this revision.</p>:(sets||[]).map(set=>{
        const setQuotes=(quotes||[]).filter(quote=>quote.quote_set_id===set.id);
        return <section key={set.id} className={`${card} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold">{set.name}</h3><p className="text-xs text-muted-foreground">{[set.bid_zone,set.scope_note,set.status].filter(Boolean).join(' · ')}</p></div><span className="font-mono text-xs text-muted-foreground">{setQuotes.length} suppliers</span></div>
          {!locked&&set.status!=='archived'?<Accordion collapsible className="border-t border-border pt-3"><AccordionItem value={`add-supplier-${set.id}`}><AccordionHeader>Add supplier response</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><form action={createEstimateSupplierQuote} className="mt-3 grid gap-3 md:grid-cols-4"><input type="hidden" name="estimate_id" value={selected.id}/><input type="hidden" name="quote_set_id" value={set.id}/><Field label="Supplier"><Input appearance="underline" className="w-full min-w-0" name="supplier_name" required/></Field><Field label="Quote number"><Input appearance="underline" className="w-full min-w-0" name="supplier_quote_number"/></Field><Field label="Quote date"><Input appearance="underline" className="w-full min-w-0" name="quote_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></Field><Field label="Expires"><Input appearance="underline" className="w-full min-w-0" name="expires_at" type="date"/></Field><input type="hidden" name="status" value="requested"/><div className="md:col-span-4"><Button appearance="secondary" size="small" type="submit">Add supplier</Button></div></form></AccordionPanel></AccordionItem></Accordion>:null}
          {setQuotes.map(quote=>{
            const quoteLines=(lines||[]).filter(line=>line.quote_id===quote.id);
            const activeLink=activeLinks.find(link=>link.quote_id===quote.id);
            const linkPath=activeLink?`/vendor-quotes/${activeLink.token}`:null;
            return <article key={quote.id} className="rounded-lg border border-border bg-secondary p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-medium">{quote.supplier_name}</h4><p className="text-xs text-muted-foreground">{quote.supplier_quote_number||'No quote number'} · {quote.status} · {quote.quote_date}{quote.expires_at?` · expires ${quote.expires_at}`:''}</p></div><span className="font-mono text-xs text-muted-foreground">{quoteLines.length} lines</span></div>
              <div className="mt-3 flex flex-wrap items-center gap-2">{linkPath?<><CopyVendorLink path={linkPath}/><Link className="text-xs text-primary underline" href={linkPath} target="_blank" rel="noreferrer">Preview supplier page</Link><form action={revokeVendorAccessLink}><input type="hidden" name="token_id" value={activeLink?.id}/><Button appearance="subtle" size="small" type="submit">Revoke link</Button></form></>:null}</div>
              {!locked&&set.status!=='archived'&&!['declined','selected'].includes(quote.status)?<Accordion collapsible className="mt-3 border-t border-border pt-3"><AccordionItem value={`supplier-link-${quote.id}`}><AccordionHeader>{linkPath?'Regenerate supplier link':'Generate supplier link'}</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><form action={createVendorAccessLink} className="mt-3 space-y-3"><input type="hidden" name="estimate_id" value={selected.id}/><input type="hidden" name="quote_id" value={quote.id}/><p className="text-xs text-muted-foreground">Choose only the resources this supplier should see. Regenerating revokes the prior link.</p><div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-border bg-card p-2 sm:grid-cols-2">{availableOutputs.map(output=><div key={output.id} className="rounded px-2 py-1 text-xs hover:bg-accent"><Checkbox name="output_id" value={output.id} defaultChecked={quoteLines.some(line=>line.source_takeoff_output_id===output.id)} label={<span>{measurementById.get(output.measurement_id)?.name||'Takeoff'} · {output.label||'Resource'} <span className="font-mono text-muted-foreground">/{output.production_unit}</span></span>}/></div>)}</div><Button appearance="secondary" size="small" type="submit" disabled={availableOutputs.length===0}>Generate private link</Button></form></AccordionPanel></AccordionItem></Accordion>:null}
              {quoteLines.length?<div className="mt-3 overflow-x-auto"><Table className="w-full min-w-[600px] text-left text-xs"><TableHeader className="border-y border-border text-muted-foreground"><TableRow><TableHeaderCell className="px-2 py-2">Resource</TableHeaderCell><TableHeaderCell className="px-2 py-2">Reference</TableHeaderCell><TableHeaderCell className="px-2 py-2 text-right">Unit price</TableHeaderCell><TableHeaderCell className="px-2 py-2 text-right">Pricing source</TableHeaderCell></TableRow></TableHeader><TableBody>{quoteLines.map((line,index)=>{const output=outputById.get(line.source_takeoff_output_id);const selectedLine=output?.price_source_id===line.id;return <TableRow key={line.id} className={`border-b border-border ${index%2?'bg-card':''}`}><TableCell className="px-2 py-2">{line.description}</TableCell><TableCell className="px-2 py-2 text-muted-foreground">{line.source_reference||'—'}</TableCell><TableCell className="px-2 py-2 text-right font-mono">{money(line.quoted_unit_cost)}/{line.quoted_unit}</TableCell><TableCell className="px-2 py-2 text-right">{selectedLine?'Selected':!locked?<form action={selectEstimateSupplierQuoteLine}><input type="hidden" name="estimate_id" value={selected.id}/><input type="hidden" name="quote_line_id" value={line.id}/><Button appearance="subtle" size="small" type="submit">Select</Button></form>:'—'}</TableCell></TableRow>;})}</TableBody></Table></div>:null}
              {!locked&&set.status!=='archived'&&quote.status!=='declined'?<Accordion collapsible className="mt-3 border-t border-border pt-3"><AccordionItem value={`office-price-${quote.id}`}><AccordionHeader>Record unit price in office</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><form action={createEstimateSupplierQuoteLine} className="mt-3 grid gap-3 md:grid-cols-4"><input type="hidden" name="estimate_id" value={selected.id}/><input type="hidden" name="quote_id" value={quote.id}/><Field label="Takeoff resource"><Select appearance="outline" className="w-full min-w-0" name="output_id" required defaultValue=""><option value="" disabled>Choose resource</option>{availableOutputs.map(output=><option key={output.id} value={output.id}>{measurementById.get(output.measurement_id)?.name||'Takeoff'} · {output.label||'Resource'} · {output.production_unit}</option>)}</Select></Field><Field label="Unit price"><Input appearance="underline" className="w-full min-w-0" name="quoted_unit_cost" type="number" min="0" step="0.0001" required/></Field><Field label="Reference"><Input appearance="underline" className="w-full min-w-0" name="source_reference"/></Field><div className="flex items-end"><Button appearance="secondary" size="small" type="submit">Add price line</Button></div></form></AccordionPanel></AccordionItem></Accordion>:null}
            </article>;
          })}
        </section>;
      })}
      </div>
    </div></AppShell>;
  }

  function Header(){return <header className="border-b border-border pb-4"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Bid Intelligence</p><h1 className="mt-1 text-2xl font-semibold text-foreground">Vendor Quotes</h1><p className="mt-1 text-sm text-muted-foreground">Collect supplier unit prices. Selection into the commercial baseline remains an office decision.</p></header>;}
  function EstimateLinks({selected}:{selected?:NonNullable<typeof estimate>}){const rows=selected&&!(estimates||[]).some(row=>row.id===selected.id)?[selected,...(estimates||[])]:estimates||[];return <form action="/vendor-quotes" method="get" className="flex min-w-0 flex-wrap items-end gap-2"><label className="grid min-w-0 gap-1 text-xs text-muted-foreground">Estimate revision<Select appearance="outline" name="estimate" defaultValue={estimateId||''} className="max-w-[320px]" required><option value="" disabled>Choose an estimate</option>{rows.map(row=><option key={row.id} value={row.id}>{row.estimate_number}-R{row.version||0} · {row.name}</option>)}</Select></label><Button appearance="secondary" size="small" type="submit">Open</Button></form>;}
}

