import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {acceptProposal,submitProposalResponse} from './actions';
import styles from './proposal.module.css';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const date=(v:any)=>v?new Date(v).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):null;
const words=(v:any)=>String(v||'').replaceAll('_',' ');

export default async function PublicProposalPage({params,searchParams}:{params:Promise<{token:string}>,searchParams:Promise<{preview?:string}>}){
 const {token}=await params;const query=await searchParams;const preview=query?.preview==='1';
 const supabase=await createClient();
 const {data,error}=await supabase.rpc('get_public_proposal',{p_token:token});
 if(error||!data)notFound();
 if(!preview)await supabase.rpc('track_public_proposal_view',{p_token:token});

 const d:any=data,e:any=d.estimate||{},company:any=d.company||{},lead:any=d.lead||{},project:any=d.project||{},content:any=d.content||{},presentation:any=d.presentation||{};
 const sections:any[]=d.sections||[],items:any[]=d.items||[],clarifications:any[]=d.clarifications||[],options:any[]=d.options||[],acceptance:any=d.acceptance;
 const proposalNumber=d.proposal_number||`P-${String(e.estimate_number||'').replace(/^E-/,'')}-R${Number(e.version||0)}`;
 const sell=Number(d.pricing?.base_sell_price||0),customer=lead.customer_name||lead.contact_name||project.name||'Customer';
 const projectName=lead.project_name||project.name||e.name||'Concrete Project';
 const site=[project.address||lead.address,project.city||lead.city,project.state||lead.state].filter(Boolean).join(', ');
 const audience=d.audience_type||'general_contractor';
 const proposalLabel=audience==='homeowner'?'Project Proposal':audience==='commercial_owner'?'Concrete Project Proposal':'Concrete Bid Proposal';
 const priceLabel=audience==='homeowner'?'Project Investment':'Proposed Contract Amount';
 const itemsBy=new Map<string,any[]>();for(const item of items){const key=item.section_id||'none',a=itemsBy.get(key)||[];a.push(item);itemsBy.set(key,a);}
 const clarificationGroups=new Map<string,any[]>();for(const c of clarifications){const a=clarificationGroups.get(c.category)||[];a.push(c);clarificationGroups.set(c.category,a);}
 const whyCarez=String(content.why_carez||'').split(/\r?\n/).map((x:string)=>x.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
 const validThrough=date(d.valid_through),companyName=company.display_name||company.name||'Carez Concrete';
 const companyAddress=[company.address_line1,company.address_line2,company.city,company.state,company.postal_code].filter(Boolean).join(', ');
 const responseCopy:any={question:'Your question was sent to Carez.',change_requested:'Your change request was sent to Carez.',option_interest:'Carez received your interest in an alternate option.',declined:'You marked this proposal as not moving forward.'};
 const responseMessage=responseCopy[presentation.response_state];
 const active=!acceptance&&presentation.status!=='declined';

 return <main className={styles.page}>
  {preview&&<div className={styles.previewBar}>OWNER PREVIEW — views are not counted</div>}
  <div className={styles.document}>
   <header className={styles.header}>
    <div className={styles.brand}><img src={company.logo_path||'/brand/carez-wordmark.png'} alt={companyName}/><span>CONCRETE</span></div>
    <div className={styles.proposalMeta}><span>{proposalLabel}</span><strong>{proposalNumber}</strong>{validThrough&&<small>Valid through {validThrough}</small>}</div>
   </header>

   <section className={styles.hero}>
    <div className={styles.eyebrow}>Prepared for {customer}</div>
    <h1>{projectName}</h1>
    {site&&<p>{site}</p>}
    {content.customer_message&&<div className={styles.customerMessage}>{content.customer_message}</div>}
    <div className={styles.pricePanel}>
     <div><span>{priceLabel}</span><strong>{money(sell)}</strong>{content.pricing_note&&<p>{content.pricing_note}</p>}</div>
     <div className={styles.priceSide}><span>Proposal</span><b>{proposalNumber}</b>{e.expected_start_date&&<small>Anticipated start: {date(e.expected_start_date)}</small>}</div>
    </div>
   </section>

   {content.executive_summary&&<section className={styles.section}><div className={styles.sectionLabel}>Project Understanding</div><h2>What we are proposing</h2><p className={styles.prose}>{content.executive_summary}</p></section>}

   <section className={styles.section}>
    <div className={styles.sectionLabel}>Scope</div><h2>Work included</h2>
    <div className={styles.scopeStack}>
     {sections.map((sec:any)=>{const sectionItems=itemsBy.get(sec.id)||[];return <article className={styles.scopeCard} key={sec.id}>
      <div className={styles.scopeHeading}><div><h3>{sec.name}</h3><span>{words(sec.scope_type||'Concrete Work')}</span></div></div>
      <div className={styles.scopeItems}>{sectionItems.length?sectionItems.map((i:any)=><div className={styles.scopeItem} key={i.id}><span className={styles.check}>✓</span><div><strong>{i.description}</strong>{content.show_quantities!==false&&i.item_type!=='labor'&&i.quantity!==undefined&&<small>{Number(i.quantity||0).toLocaleString(undefined,{maximumFractionDigits:2})} {i.unit||''}</small>}{i.item_type==='labor'&&<small>Labor included</small>}</div></div>):<div className={styles.muted}>Scope is described by the section heading and proposal clarifications below.</div>}</div>
     </article>})}
     {(itemsBy.get('none')||[]).length>0&&<article className={styles.scopeCard}><div className={styles.scopeHeading}><div><h3>General Project Scope</h3></div></div><div className={styles.scopeItems}>{(itemsBy.get('none')||[]).map((i:any)=><div className={styles.scopeItem} key={i.id}><span className={styles.check}>✓</span><div><strong>{i.description}</strong>{content.show_quantities!==false&&i.item_type!=='labor'&&i.quantity!==undefined&&<small>{Number(i.quantity||0).toLocaleString(undefined,{maximumFractionDigits:2})} {i.unit||''}</small>}{i.item_type==='labor'&&<small>Labor included</small>}</div></div>)}</div></article>}
    </div>
   </section>

   {clarifications.length>0&&<section className={styles.section}>
    <div className={styles.sectionLabel}>Scope Clarity</div><h2>What this price is based on</h2>
    <div className={styles.clarificationGrid}>{['inclusion','exclusion','allowance','assumption','qualification'].map(category=>{const rows=clarificationGroups.get(category)||[];if(!rows.length)return null;return <div className={styles.clarificationCard} key={category}><h3>{category==='inclusion'?'Included':category==='exclusion'?'Not Included':category==='allowance'?'Allowances':category==='assumption'?'Assumptions':'Qualifications'}</h3><ul>{rows.map((r:any)=><li key={r.id}>{r.text||r.clarification_text}</li>)}</ul></div>})}</div>
   </section>}

   {(content.schedule_summary||content.payment_summary||content.warranty_summary)&&<section className={styles.section}>
    <div className={styles.sectionLabel}>Execution</div><h2>How the project will run</h2>
    <div className={styles.infoGrid}>
     {content.schedule_summary&&<div><span>Schedule</span><p>{content.schedule_summary}</p></div>}
     {content.payment_summary&&<div><span>Payment</span><p>{content.payment_summary}</p></div>}
     {content.warranty_summary&&<div><span>Warranty / workmanship</span><p>{content.warranty_summary}</p></div>}
    </div>
   </section>}

   {options.length>0&&<section className={styles.section}>
    <div className={styles.sectionLabel}>Alternates</div><h2>Options you can consider</h2><p className={styles.leadText}>These are not added to the contract unless Carez issues the applicable revised proposal or confirms the option in writing.</p>
    <div className={styles.optionGrid}>{options.map((o:any)=><article className={styles.optionCard} key={o.id}><div><span className={styles.optionTag}>Optional</span><h3>{o.name}</h3><p>{o.customer_description}</p>{o.function_quality_note&&<small>{o.function_quality_note}</small>}{o.approval_required&&<small>Approval/condition: {o.approval_required}</small>}</div><div className={styles.optionPrice}><span>{Number(o.price_change||0)===0?'No price change':Number(o.price_change||0)<0?`${money(Math.abs(Number(o.price_change)))} savings`:`+${money(o.price_change)}`}</span><strong>{money(o.option_price)}</strong><small>resulting proposal amount{o.schedule_days_change?` · ${o.schedule_days_change>0?'+':''}${o.schedule_days_change} schedule day(s)`:''}</small></div>{active&&<form action={submitProposalResponse}><input type="hidden" name="token" value={token}/><input type="hidden" name="response_type" value="option_interest"/><input type="hidden" name="option_id" value={o.id}/><input type="hidden" name="customer_name" value={lead.contact_name||customer}/><input type="hidden" name="customer_email" value={lead.email||''}/><button className={styles.secondaryButton}>Ask Carez about this option</button></form>}</article>)}</div>
   </section>}

   {whyCarez.length>0&&<section className={styles.section}><div className={styles.sectionLabel}>Carez Concrete</div><h2>Why Carez for this project</h2><div className={styles.valueGrid}>{whyCarez.map((x:string,i:number)=><div key={i}><span>✓</span><p>{x}</p></div>)}</div></section>}

   <section className={styles.section}>
    <div className={styles.sectionLabel}>Contractor</div><h2>{companyName}</h2>
    <div className={styles.contractorGrid}><div>{companyAddress&&<p>{companyAddress}</p>}{company.phone&&<p>{company.phone}</p>}{company.email&&<p>{company.email}</p>}{company.website&&<p>{company.website}</p>}</div><div>{company.contractor_license_number&&<p><span>WA Contractor License</span><strong>{company.contractor_license_number}</strong></p>}{company.ubi_number&&<p><span>UBI</span><strong>{company.ubi_number}</strong></p>}</div></div>
   </section>

   {content.terms_text&&<section className={styles.section}><details className={styles.terms}><summary>Proposal terms and conditions</summary><div className={styles.termsBody}>{content.terms_text}</div></details></section>}

   {responseMessage&&!acceptance&&<div className={presentation.response_state==='declined'?styles.noticeNeutral:styles.noticeSuccess}><strong>{responseMessage}</strong>{presentation.response_state!=='declined'&&<span>Carez can see this response in the proposal follow-up queue.</span>}</div>}

   {acceptance?<section className={styles.accepted}><span>Accepted</span><h2>Thank you, {acceptance.accepted_name}.</h2><p>{proposalNumber} was accepted on {date(acceptance.accepted_at)}. Carez has recorded the accepted scope and price as the awarded-job baseline.</p>{project?.job_number&&<strong>Carez Job {project.job_number}</strong>}</section>:presentation.status==='declined'?<section className={styles.declined}><h2>Proposal response recorded</h2><p>If circumstances change, contact {companyName} and we can reopen the conversation or issue a current proposal.</p></section>:<section className={styles.actionSection}>
    <div className={styles.sectionLabel}>Next Step</div><h2>Ready to move forward?</h2><p>Accept the exact scope and price shown in {proposalNumber}, or send Carez a question/change request before accepting.</p>
    <div className={styles.actionGrid}>
     <div className={styles.acceptBox}><h3>Accept {proposalNumber}</h3><form action={acceptProposal} className={styles.form}><input type="hidden" name="token" value={token}/><label><span>Name</span><input name="accepted_name" required defaultValue={lead.contact_name||''}/></label><label><span>Email</span><input type="email" name="accepted_email" defaultValue={lead.email||''}/></label><label><span>Note (optional)</span><textarea name="acceptance_note" rows={2}/></label><label className={styles.checkbox}><input type="checkbox" required/><span>I accept {proposalNumber} and authorize {companyName} to proceed subject to the scope and terms shown in this proposal.</span></label><button className={styles.primaryButton}>Accept Proposal</button></form></div>
     <div className={styles.responseBox}><details open={presentation.response_state==='question'}><summary>Ask a question</summary><form action={submitProposalResponse} className={styles.form}><input type="hidden" name="token" value={token}/><input type="hidden" name="response_type" value="question"/><label><span>Name</span><input name="customer_name" defaultValue={lead.contact_name||''}/></label><label><span>Email</span><input name="customer_email" type="email" defaultValue={lead.email||''}/></label><label><span>Question</span><textarea name="customer_message" required rows={3}/></label><button className={styles.secondaryButton}>Send Question</button></form></details>
      <details open={presentation.response_state==='change_requested'}><summary>Request a proposal change</summary><form action={submitProposalResponse} className={styles.form}><input type="hidden" name="token" value={token}/><input type="hidden" name="response_type" value="change_request"/><label><span>Name</span><input name="customer_name" defaultValue={lead.contact_name||''}/></label><label><span>Email</span><input name="customer_email" type="email" defaultValue={lead.email||''}/></label><label><span>What should we revise?</span><textarea name="customer_message" required rows={3}/></label><button className={styles.secondaryButton}>Request Revision</button></form></details>
      <details><summary>Not moving forward</summary><form action={submitProposalResponse} className={styles.form}><input type="hidden" name="token" value={token}/><input type="hidden" name="response_type" value="decline"/><label><span>Main reason</span><select name="decline_reason" required defaultValue=""><option value="" disabled>Choose reason</option><option value="price">Price</option><option value="schedule">Schedule / timing</option><option value="scope">Scope did not match</option><option value="selected_other_contractor">Selected another contractor</option><option value="project_cancelled">Project cancelled / postponed</option><option value="other">Other</option></select></label><label><span>Anything you want us to know? (optional)</span><textarea name="customer_message" rows={2}/></label><button className={styles.textButton}>Send Response</button></form></details>
     </div>
    </div>
   </section>}
   <footer className={styles.footer}><strong>{companyName}</strong><span>{proposalNumber}{validThrough?` · Valid through ${validThrough}`:''}</span></footer>
  </div>
 </main>;
}
