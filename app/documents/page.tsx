import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,Checkbox,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger,Input,Label,Select} from '@fluentui/react-components';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import { DocumentCheckmarkRegular as FileCheck2, DocumentTextRegular as FileText, FolderOpenRegular as FolderOpen, ReceiptRegular as ReceiptText, CameraRegular as Camera, VehicleTruckRegular as Truck, ArrowRightRegular as ArrowRight, ScanRegular as ScanLine, CheckmarkCircleRegular as CheckCheck } from '@fluentui/react-icons';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {DocumentUpload} from '@/components/documents/DocumentUpload';
import {
  createPoReceiptFromDocument,
  deleteDocument,
  matchDocumentToVendorBill,
  reconcileReceiptToCompanyExpense,
  reconcileReceiptToJobCost,
  updateDocumentReview,
} from './actions';

const money=(n:any)=>n==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const num=(n:any)=>Number(n||0);
const label=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';
const detailsClass='rounded-lg border border-border bg-background';
const summaryClass='cursor-pointer px-3 py-2.5 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted/40 motion-reduce:transition-none';
const documentIcon=(type:string)=>type==='receipt'?ReceiptText:['concrete_ticket','delivery_ticket'].includes(type)?Truck:type==='photo'?Camera:FileText;

export default async function DocumentsPage({searchParams}:{searchParams:Promise<{tab?:string}>}){
  const selectedTab=(await searchParams).tab==='filed'?'filed':'queue';
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [{data:docs},{data:projects},{data:vendors},{data:bills},{data:pos},{data:poLines},{data:bankTx},{data:codes},{data:overhead}]=await Promise.all([
    supabase.from('company_documents').select('*,projects(job_number,name),vendors(name),vendor_bills(vendor_bill_number),purchase_orders(po_number)').eq('company_id',companyId).order('created_at',{ascending:false}).limit(250),
    supabase.from('projects').select('id,job_number,name,status').eq('company_id',companyId).in('status',['active','on_hold','completed']).order('job_number'),
    supabase.from('vendors').select('id,name').eq('company_id',companyId).eq('active',true).order('name'),
    supabase.from('vendor_bills').select('id,project_id,vendor_id,vendor_bill_number,bill_date,status,projects(job_number,name),vendors(name)').eq('company_id',companyId).in('status',['draft','posted','partial','paid']).order('bill_date',{ascending:false}).limit(120),
    supabase.from('purchase_orders').select('id,project_id,vendor_id,po_number,status,projects(job_number,name),vendors(name)').eq('company_id',companyId).in('status',['issued','closed']).order('created_at',{ascending:false}).limit(120),
    supabase.from('purchase_order_lines').select('id,purchase_order_id,description,quantity,unit').eq('company_id',companyId).order('sort_order'),
    supabase.from('plaid_transactions').select('id,transaction_date,name,merchant_name,cash_amount').eq('company_id',companyId).eq('removed',false).eq('pending',false).eq('review_status','unreviewed').lt('cash_amount',0).order('transaction_date',{ascending:false}).limit(150),
    supabase.from('cost_codes').select('id,code,name').eq('company_id',companyId).eq('active',true).order('sort_order'),
    supabase.from('overhead_items').select('id,category,name').eq('company_id',companyId).eq('active',true).order('sort_order'),
  ]);

  const signed=await Promise.all((docs||[]).map(async(d:any)=>{
    if(!d.storage_path)return {...d,url:null};
    const {data}=await supabase.storage.from('carez-documents').createSignedUrl(d.storage_path,3600);
    return {...d,url:data?.signedUrl||null};
  }));
  const queue=signed.filter((d:any)=>d.review_status==='needs_review');
  const archived=signed.filter((d:any)=>d.review_status!=='needs_review');
  const missingJob=signed.filter((d:any)=>!d.project_id&&d.review_status!=='ignored');
  const matched=signed.filter((d:any)=>d.review_status==='matched');
  const concrete=signed.filter((d:any)=>d.document_type==='concrete_ticket');
  const projectOpts=(projects||[]).map((p:any)=>({id:p.id,label:`${p.job_number} — ${p.name}`}));
  const vendorOpts=(vendors||[]).map((v:any)=>({id:v.id,label:v.name}));
  const poMap=new Map((pos||[]).map((p:any)=>[p.id,p]));
  const lines=(poLines||[]).map((l:any)=>({...l,po:poMap.get(l.purchase_order_id)}));
  const outgoing=(bankTx||[]).map((t:any)=>({...t,amount:Math.abs(num(t.cash_amount))}));

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="carez-evidence-hub mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-3 lg:h-full">
      <header className="carez-page-heading flex shrink-0 flex-wrap items-center justify-between gap-3"><h1>Documents</h1><div className="flex flex-wrap items-center gap-2"><Badge appearance="outline">{queue.length} to review</Badge><Dialog><DialogTrigger><Button size="small">Capture document</Button></DialogTrigger><DialogSurface className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogBody><DialogContent><div><DialogTitle>Capture document</DialogTitle><p>Add field evidence and connect it to the right job or vendor.</p></div><DocumentUpload companyId={companyId} projects={projectOpts} vendors={vendorOpts}/></DialogContent></DialogBody></DialogSurface></Dialog></div></header>

      <div className="carez-evidence-summary" aria-label="Document summary">
        <span><ScanLine aria-hidden="true"/><strong>{queue.length}</strong> need review</span>
        <span><FolderOpen aria-hidden="true"/><strong>{missingJob.length}</strong> need a job</span>
        <span><FileCheck2 aria-hidden="true"/><strong>{matched.length}</strong> matched</span>
        <span><Truck aria-hidden="true"/><strong>{concrete.length}</strong> concrete tickets</span>
      </div>

      <div className="min-h-0 flex-1 gap-0 border border-border bg-card">
        <div role="tablist" aria-label="Document views" className="w-full shrink-0 px-2">
          <Button as="a" href="?tab=queue" role="tab" aria-selected={selectedTab==='queue'} appearance={selectedTab==='queue'?'primary':'subtle'} className="flex-none">Review queue · {queue.length}</Button>
          <Button as="a" href="?tab=filed" role="tab" aria-selected={selectedTab==='filed'} appearance={selectedTab==='filed'?'primary':'subtle'} className="flex-none">Filed & matched · {archived.length}</Button>
        </div>
      {selectedTab==='queue'?<div className="min-h-0 overflow-auto p-3">
      <section id="review-queue" className="carez-review-queue space-y-4" aria-labelledby="review-heading">
        <div className="flex items-center justify-between gap-3"><div><h2 id="review-heading" className="flex items-center gap-2 text-sm font-semibold"><ScanLine/>Review queue</h2><p className="text-xs text-muted-foreground">Identify the document, assign the work, and connect the proof.</p></div><Badge appearance="outline">{queue.length} to review</Badge></div>
        {queue.length===0?<div className="flex items-center gap-3 border border-border p-4"><CheckCheck className="text-success"/><div><h3 className="text-sm font-semibold">Your review queue is clear.</h3><p className="text-xs text-muted-foreground">New captures will arrive here, ready to identify, assign, and match.</p></div></div>:
          <div className="divide-y border border-border">{queue.map((d:any)=>{
            const probableBank=outgoing.filter((t:any)=>d.amount==null||Math.abs(t.amount-num(d.amount))<0.011).slice(0,20);
            const ticketLines=lines.filter((l:any)=>l.po&&(!d.project_id||l.po.project_id===d.project_id)&&(!d.vendor_id||l.po.vendor_id===d.vendor_id)&&l.po.status==='issued');
            const billOpts=(bills||[]).filter((b:any)=>(!d.project_id||b.project_id===d.project_id)&&(!d.vendor_id||b.vendor_id===d.vendor_id));
            const DocIcon=documentIcon(d.document_type);
            return <Dialog key={d.id}><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="flex min-w-0 items-center gap-3"><span className="carez-document-icon"><DocIcon aria-hidden="true"/></span><div className="min-w-0"><strong className="block truncate text-sm">{d.title}</strong><span className="block truncate text-xs text-muted-foreground">{d.document_date||'No date'} · {label(d.document_type)} · {d.projects?.job_number||'Company'}</span></div></div><div className="flex items-center gap-2"><strong className="font-mono text-xs tabular-nums">{money(d.amount)}</strong><Badge appearance="outline" className="border-warning/30 bg-warning/10 text-warning">Needs review</Badge><DialogTrigger><Button appearance="outline" size="small">View / Edit</Button></DialogTrigger></div></div><DialogSurface className="w-full overflow-hidden sm:max-w-3xl !fixed !right-0 !top-0 !m-0 !h-dvh !max-h-dvh !rounded-none"><DialogBody><DialogContent><div className="flex justify-end"><DialogTrigger action="close"><Button type="button" appearance="subtle" size="small">Close</Button></DialogTrigger></div><div><DialogTitle>{d.title}</DialogTitle><p>{label(d.document_type)} · {d.document_date||'No date'}</p></div><div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-6">
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><div className="text-sm font-medium">{d.projects?`${d.projects.job_number} — ${d.projects.name}`:'No job assigned'}</div><div className="mt-1 text-xs text-muted-foreground">{d.vendors?.name||'No vendor'} · {money(d.amount)}</div>{d.notes&&<div className="mt-1 text-xs text-muted-foreground">{d.notes}</div>}</div>
                  {d.url&&<a className={secondaryLinkClass} href={d.url} target="_blank" rel="noreferrer">Open File</a>}
                </div>

                <div className="grid gap-2">
                  <Accordion collapsible><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>File / Correct Details</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="border-t border-border p-3"><form action={updateDocumentReview} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Job</Label><Select appearance="outline" name="project_id" defaultValue={d.project_id||''} className={selectClass}><option value="">Company / no job</option>{projectOpts.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</Select></div><div className="grid gap-1.5"><Label>Vendor</Label><Select appearance="outline" name="vendor_id" defaultValue={d.vendor_id||''} className={selectClass}><option value="">None</option>{vendorOpts.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</Select></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Date</Label><Input appearance="underline" type="date" name="document_date" defaultValue={d.document_date||''}/></div><div className="grid gap-1.5"><Label>Amount</Label><Input appearance="underline" type="number" step="0.01" min="0" name="amount" defaultValue={d.amount??''}/></div></div><div className="grid gap-1.5"><Label>Receipt / Ticket #</Label><Input appearance="underline" name="reference_number" defaultValue={d.reference_number||''}/></div><div className="grid gap-1.5"><Label>Note</Label><Input appearance="underline" name="notes" defaultValue={d.notes||''}/></div><input type="hidden" name="review_status" value="filed"/><div><Button type="submit" appearance="primary" size="small">File Document</Button></div></form></div></AccordionPanel></AccordionItem></Accordion>

                  {['delivery_ticket','concrete_ticket'].includes(d.document_type)&&<Accordion collapsible><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>Match to PO Delivery</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="space-y-3 border-t border-border p-3"><form action={createPoReceiptFromDocument} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-1.5"><Label>Issued PO Line</Label><Select appearance="outline" name="purchase_order_line_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose ordered item</option>{ticketLines.map((l:any)=><option key={l.id} value={l.id}>{l.po?.projects?.job_number} · {l.po?.po_number} · {l.description} ({num(l.quantity)} {l.unit})</option>)}</Select></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Delivered Quantity</Label><Input appearance="underline" type="number" min="0" step="0.01" name="quantity_received" required/></div><div className="grid gap-1.5"><Label>Delivery Date</Label><Input appearance="underline" type="date" name="received_date" defaultValue={d.document_date||new Date().toISOString().slice(0,10)}/></div></div><div className="grid gap-1.5"><Label>Ticket #</Label><Input appearance="underline" name="delivery_ticket" defaultValue={d.reference_number||''}/></div><div><Button type="submit" appearance="primary" size="small">Post Delivery</Button></div></form>{ticketLines.length===0&&<div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">No matching issued PO line. Correct the job/vendor or issue the PO first.</div>}</div></AccordionPanel></AccordionItem></Accordion>}

                  {d.document_type==='vendor_invoice'&&<Accordion collapsible><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>Match to Vendor Bill</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="border-t border-border p-3"><form action={matchDocumentToVendorBill} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-1.5"><Label>Vendor Bill</Label><Select appearance="outline" name="vendor_bill_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose bill</option>{billOpts.map((b:any)=><option key={b.id} value={b.id}>{b.projects?.job_number} · {b.vendors?.name} · #{b.vendor_bill_number}</option>)}</Select></div><div><Button type="submit" appearance="primary" size="small">Attach to Bill</Button></div></form></div></AccordionPanel></AccordionItem></Accordion>}

                  {d.document_type==='receipt'&&<Accordion collapsible><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>Receipt → Job Cost</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="space-y-3 border-t border-border p-3"><form action={reconcileReceiptToJobCost} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Bank Charge</Label><Select appearance="outline" name="bank_transaction_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose charge</option>{probableBank.map((t:any)=><option key={t.id} value={t.id}>{t.transaction_date} · {t.merchant_name||t.name} · {money(t.amount)}</option>)}</Select></div><div className="grid gap-1.5"><Label>Job</Label><Select appearance="outline" name="project_id" required defaultValue={d.project_id||''} className={selectClass}><option value="" disabled>Choose job</option>{projectOpts.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</Select></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Cost Code</Label><Select appearance="outline" name="cost_code_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose cost code</option>{(codes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select></div><div className="grid gap-1.5"><Label>Vendor</Label><Select appearance="outline" name="vendor_id" defaultValue={d.vendor_id||''} className={selectClass}><option value="">None</option>{vendorOpts.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</Select></div></div><div className="grid gap-1.5"><Label>Description</Label><Input appearance="underline" name="description" defaultValue={d.title}/></div><Checkbox name="remember_cost_code" label="Remember merchant → cost code"/><div><Button type="submit" appearance="primary" size="small">Match + Create Job Cost</Button></div></form>{probableBank.length===0&&<div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">No open bank charge matches this amount. Correct the amount/date or use company expense.</div>}</div></AccordionPanel></AccordionItem></Accordion>}

                  {d.document_type==='receipt'&&<Accordion collapsible><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>Receipt → Company Expense</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="border-t border-border p-3"><form action={reconcileReceiptToCompanyExpense} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-1.5"><Label>Bank Charge</Label><Select appearance="outline" name="bank_transaction_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose charge</option>{probableBank.map((t:any)=><option key={t.id} value={t.id}>{t.transaction_date} · {t.merchant_name||t.name} · {money(t.amount)}</option>)}</Select></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Overhead Item</Label><Select appearance="outline" name="overhead_item_id" defaultValue="" className={selectClass}><option value="">Custom category</option>{(overhead||[]).map((o:any)=><option key={o.id} value={o.id}>{o.category} — {o.name}</option>)}</Select></div><div className="grid gap-1.5"><Label>Custom Category</Label><Input appearance="underline" name="category" placeholder="Fuel / Office / Insurance"/></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Business Use %</Label><Input appearance="underline" type="number" min="0" max="100" step="1" name="business_use_percent" defaultValue="100"/></div><div className="grid gap-1.5"><Label>Description</Label><Input appearance="underline" name="description" defaultValue={d.title}/></div></div><div><Button type="submit" appearance="primary" size="small">Match + Record Expense</Button></div></form></div></AccordionPanel></AccordionItem></Accordion>}

                  <Accordion collapsible><AccordionItem value="content" className={detailsClass}><AccordionHeader className={summaryClass}>Ignore / Delete</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="flex flex-wrap gap-2 border-t border-border p-3"><form action={updateDocumentReview}><input type="hidden" name="id" value={d.id}/><input type="hidden" name="project_id" value={d.project_id||''}/><input type="hidden" name="vendor_id" value={d.vendor_id||''}/><input type="hidden" name="document_date" value={d.document_date||''}/><input type="hidden" name="amount" value={d.amount??''}/><input type="hidden" name="reference_number" value={d.reference_number||''}/><input type="hidden" name="notes" value={d.notes||''}/><input type="hidden" name="review_status" value="ignored"/><Button type="submit" appearance="outline" size="small">Ignore</Button></form><form action={deleteDocument}><input type="hidden" name="id" value={d.id}/><Button type="submit" appearance="primary" size="small">Delete File</Button></form></div></AccordionPanel></AccordionItem></Accordion>
                </div>
              </div></DialogContent></DialogBody></DialogSurface></Dialog>;
          })}</div>}
      </section>
      </div>:null}

      {selectedTab==='filed'?<div className="min-h-0 overflow-auto p-3">
      <section id="filed-evidence" className="carez-filed-evidence space-y-4" aria-labelledby="filed-heading">
        <div className="flex items-center justify-between gap-3"><div><h2 id="filed-heading" className="flex items-center gap-2 text-sm font-semibold"><FolderOpen/>Filed & matched</h2><p className="text-xs text-muted-foreground">The evidence behind the job and source transaction, including ignored records.</p></div><Badge appearance="outline">{archived.length} records</Badge></div>
        {archived.length===0?<div className="flex items-center gap-3 border border-border p-4"><FolderOpen/><div><h3 className="text-sm font-semibold">A place for every piece of proof.</h3><p className="text-xs text-muted-foreground">File or match a document from the review queue to build your evidence record.</p></div></div>:
          <div className="carez-evidence-browser">
            <div className="carez-evidence-browser-head" aria-hidden="true"><span>Document / source</span><span>Job / date</span><span>Amount</span><span>State / action</span></div>
            {archived.slice(0,120).map((d:any)=>{const DocIcon=documentIcon(d.document_type);return <article key={d.id} className="carez-evidence-row">
              <div className="flex min-w-0 items-start gap-3"><span className="carez-document-icon"><DocIcon aria-hidden="true"/></span><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{d.title}</h3><p className="mt-1 text-xs text-muted-foreground">{d.vendors?.name||'No vendor'} · {label(d.document_type)}{d.reference_number?` · #${d.reference_number}`:''}</p></div></div>
              <div className="carez-evidence-job"><p className="text-xs font-medium">{d.projects?`${d.projects.job_number} — ${d.projects.name}`:'Company'}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{d.document_date||'No date'}</p></div>
              <span className="carez-evidence-amount font-mono text-sm font-semibold tabular-nums">{money(d.amount)}</span>
              <div className="carez-evidence-record-actions"><Badge appearance="outline" className={d.review_status==='matched'?'border-success/30 bg-success/10 text-success':'text-muted-foreground'}>{label(d.review_status)}</Badge>{d.url?<a className={subtleLinkClass} aria-label={'Open '+d.title} href={d.url} target="_blank" rel="noreferrer">Open<ArrowRight/></a>:<span className="text-xs text-muted-foreground">File unavailable</span>}</div>
            </article>})}
            {archived.length>120?<p className="p-3 text-xs text-muted-foreground">Showing the 120 most recent filed records.</p>:null}
          </div>}
      </section>
      </div>:null}
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"><strong>Accounting rule:</strong> <span className="text-muted-foreground">a receipt photo is evidence, not a second cost. Job-cost and company-expense workflows create the accounting record from the matched bank charge; vendor invoices attach to the existing bill; concrete tickets post received quantity against the PO.</span></div>
      <div className="flex flex-wrap gap-2"><Link className={secondaryLinkClass} href="/banking/reconcile">Bank Reconciliation</Link><Link className={secondaryLinkClass} href="/procurement">Procurement</Link><Link className={secondaryLinkClass} href="/pour-control">Pour Control</Link></div>
    </div>
  </AppShell>;
}

const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
const subtleLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm px-3 text-xs font-semibold hover:bg-accent';
