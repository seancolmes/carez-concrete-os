import Link from 'next/link';
import {redirect} from 'next/navigation';
import {FileCheck2,FileText,FolderOpen,ReceiptText,Camera,Truck,ArrowRight,ScanLine,CheckCheck,UploadCloud} from 'lucide-react';
import {CarezSectionHeading,CarezExperienceEmpty} from '@/components/carez/experience';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
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

export default async function DocumentsPage(){
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
    <div className="carez-evidence-hub mx-auto flex w-full max-w-screen-2xl flex-col gap-7">
      <header className="carez-evidence-heading">
        <div><p className="carez-page-context">Field evidence</p><h1>Documents</h1><p>From the field to the record. Capture it once. Keep the proof.</p></div>
        <a href="#review-queue" className={buttonVariants({variant:'outline',size:'sm'})}><ScanLine/>{queue.length} to review<ArrowRight/></a>
      </header>

      <section className="carez-capture-surface" aria-labelledby="capture-heading">
        <CarezSectionHeading id="capture-heading" icon={<UploadCloud/>} title="Capture the evidence" description="A receipt, a concrete delivery, a site photo. Keep it with the work."/>
        <DocumentUpload companyId={companyId} projects={projectOpts} vendors={vendorOpts}/>
      </section>

      <nav className="carez-evidence-workflow" aria-label="Evidence workflow">
        <span><UploadCloud aria-hidden="true"/>Captured</span><ArrowRight aria-hidden="true"/>
        <span><ScanLine aria-hidden="true"/>Identify</span><ArrowRight aria-hidden="true"/>
        <span><FolderOpen aria-hidden="true"/>Assign job</span><ArrowRight aria-hidden="true"/>
        <span><FileCheck2 aria-hidden="true"/>Match</span><ArrowRight aria-hidden="true"/>
        <span><CheckCheck aria-hidden="true"/>Filed</span>
        <p>Identify and assign as applicable; match to the source transaction or file the evidence.</p>
      </nav>

      <div className="carez-evidence-summary" aria-label="Document summary">
        <a href="#review-queue"><ScanLine aria-hidden="true"/><strong>{queue.length}</strong> need review</a>
        <span><FolderOpen aria-hidden="true"/><strong>{missingJob.length}</strong> need a job</span>
        <a href="#filed-evidence"><FileCheck2 aria-hidden="true"/><strong>{matched.length}</strong> matched</a>
        <span><Truck aria-hidden="true"/><strong>{concrete.length}</strong> concrete tickets</span>
      </div>

      <section id="review-queue" className="carez-review-queue space-y-4" aria-labelledby="review-heading">
        <CarezSectionHeading id="review-heading" icon={<ScanLine/>} title="Review queue" description="Identify the document, assign the work, and connect the proof." action={<Badge variant="outline">{queue.length} to review</Badge>}/>
        {queue.length===0?<CarezExperienceEmpty icon={<CheckCheck/>} tone="success" title="Your review queue is clear." description="New captures will arrive here, ready to identify, assign, and match."/>:
          <div className="grid gap-4">{queue.map((d:any)=>{
            const probableBank=outgoing.filter((t:any)=>d.amount==null||Math.abs(t.amount-num(d.amount))<0.011).slice(0,20);
            const ticketLines=lines.filter((l:any)=>l.po&&(!d.project_id||l.po.project_id===d.project_id)&&(!d.vendor_id||l.po.vendor_id===d.vendor_id)&&l.po.status==='issued');
            const billOpts=(bills||[]).filter((b:any)=>(!d.project_id||b.project_id===d.project_id)&&(!d.vendor_id||b.vendor_id===d.vendor_id));
            const DocIcon=documentIcon(d.document_type);
            return <Card key={d.id} className="carez-evidence-review gap-0 py-0 shadow-none">
              <CardHeader className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="flex min-w-0 items-start gap-3"><span className="carez-document-icon"><DocIcon aria-hidden="true"/></span><div className="min-w-0"><CardTitle className="break-words">{d.title}</CardTitle><CardDescription className="mt-1">{d.document_date||'No date'} · {label(d.document_type)}{d.reference_number?` · #${d.reference_number}`:''}</CardDescription><p className="mt-2 text-xs font-medium text-warning">{!d.project_id?'Next: identify and assign, or file as company evidence':'Next: match to a source or file the document'}</p></div></div>
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Needs review</Badge>
              </CardHeader>
              <CardContent className="space-y-4 py-4">
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><div className="text-sm font-medium">{d.projects?`${d.projects.job_number} — ${d.projects.name}`:'No job assigned'}</div><div className="mt-1 text-xs text-muted-foreground">{d.vendors?.name||'No vendor'} · {money(d.amount)}</div>{d.notes&&<div className="mt-1 text-xs text-muted-foreground">{d.notes}</div>}</div>
                  {d.url&&<a className={buttonVariants({variant:'outline',size:'sm'})} href={d.url} target="_blank" rel="noreferrer">Open File</a>}
                </div>

                <div className="grid gap-2">
                  <details className={detailsClass}><summary className={summaryClass}>File / Correct Details</summary><div className="border-t border-border p-3"><form action={updateDocumentReview} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Job</Label><select name="project_id" defaultValue={d.project_id||''} className={selectClass}><option value="">Company / no job</option>{projectOpts.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></div><div className="grid gap-1.5"><Label>Vendor</Label><select name="vendor_id" defaultValue={d.vendor_id||''} className={selectClass}><option value="">None</option>{vendorOpts.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Date</Label><Input type="date" name="document_date" defaultValue={d.document_date||''}/></div><div className="grid gap-1.5"><Label>Amount</Label><Input type="number" step="0.01" min="0" name="amount" defaultValue={d.amount??''}/></div></div><div className="grid gap-1.5"><Label>Receipt / Ticket #</Label><Input name="reference_number" defaultValue={d.reference_number||''}/></div><div className="grid gap-1.5"><Label>Note</Label><Input name="notes" defaultValue={d.notes||''}/></div><input type="hidden" name="review_status" value="filed"/><div><Button type="submit" size="sm">File Document</Button></div></form></div></details>

                  {['delivery_ticket','concrete_ticket'].includes(d.document_type)&&<details className={detailsClass}><summary className={summaryClass}>Match to PO Delivery</summary><div className="space-y-3 border-t border-border p-3"><form action={createPoReceiptFromDocument} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-1.5"><Label>Issued PO Line</Label><select name="purchase_order_line_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose ordered item</option>{ticketLines.map((l:any)=><option key={l.id} value={l.id}>{l.po?.projects?.job_number} · {l.po?.po_number} · {l.description} ({num(l.quantity)} {l.unit})</option>)}</select></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Delivered Quantity</Label><Input type="number" min="0" step="0.01" name="quantity_received" required/></div><div className="grid gap-1.5"><Label>Delivery Date</Label><Input type="date" name="received_date" defaultValue={d.document_date||new Date().toISOString().slice(0,10)}/></div></div><div className="grid gap-1.5"><Label>Ticket #</Label><Input name="delivery_ticket" defaultValue={d.reference_number||''}/></div><div><Button type="submit" size="sm">Post Delivery</Button></div></form>{ticketLines.length===0&&<div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">No matching issued PO line. Correct the job/vendor or issue the PO first.</div>}</div></details>}

                  {d.document_type==='vendor_invoice'&&<details className={detailsClass}><summary className={summaryClass}>Match to Vendor Bill</summary><div className="border-t border-border p-3"><form action={matchDocumentToVendorBill} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-1.5"><Label>Vendor Bill</Label><select name="vendor_bill_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose bill</option>{billOpts.map((b:any)=><option key={b.id} value={b.id}>{b.projects?.job_number} · {b.vendors?.name} · #{b.vendor_bill_number}</option>)}</select></div><div><Button type="submit" size="sm">Attach to Bill</Button></div></form></div></details>}

                  {d.document_type==='receipt'&&<details className={detailsClass}><summary className={summaryClass}>Receipt → Job Cost</summary><div className="space-y-3 border-t border-border p-3"><form action={reconcileReceiptToJobCost} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Bank Charge</Label><select name="bank_transaction_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose charge</option>{probableBank.map((t:any)=><option key={t.id} value={t.id}>{t.transaction_date} · {t.merchant_name||t.name} · {money(t.amount)}</option>)}</select></div><div className="grid gap-1.5"><Label>Job</Label><select name="project_id" required defaultValue={d.project_id||''} className={selectClass}><option value="" disabled>Choose job</option>{projectOpts.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Cost Code</Label><select name="cost_code_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose cost code</option>{(codes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></div><div className="grid gap-1.5"><Label>Vendor</Label><select name="vendor_id" defaultValue={d.vendor_id||''} className={selectClass}><option value="">None</option>{vendorOpts.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></div></div><div className="grid gap-1.5"><Label>Description</Label><Input name="description" defaultValue={d.title}/></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remember_cost_code" className="size-4 rounded border-input accent-primary"/><span>Remember merchant → cost code</span></label><div><Button type="submit" size="sm">Match + Create Job Cost</Button></div></form>{probableBank.length===0&&<div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">No open bank charge matches this amount. Correct the amount/date or use company expense.</div>}</div></details>}

                  {d.document_type==='receipt'&&<details className={detailsClass}><summary className={summaryClass}>Receipt → Company Expense</summary><div className="border-t border-border p-3"><form action={reconcileReceiptToCompanyExpense} className="grid gap-3"><input type="hidden" name="id" value={d.id}/><div className="grid gap-1.5"><Label>Bank Charge</Label><select name="bank_transaction_id" required defaultValue="" className={selectClass}><option value="" disabled>Choose charge</option>{probableBank.map((t:any)=><option key={t.id} value={t.id}>{t.transaction_date} · {t.merchant_name||t.name} · {money(t.amount)}</option>)}</select></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Overhead Item</Label><select name="overhead_item_id" defaultValue="" className={selectClass}><option value="">Custom category</option>{(overhead||[]).map((o:any)=><option key={o.id} value={o.id}>{o.category} — {o.name}</option>)}</select></div><div className="grid gap-1.5"><Label>Custom Category</Label><Input name="category" placeholder="Fuel / Office / Insurance"/></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Business Use %</Label><Input type="number" min="0" max="100" step="1" name="business_use_percent" defaultValue="100"/></div><div className="grid gap-1.5"><Label>Description</Label><Input name="description" defaultValue={d.title}/></div></div><div><Button type="submit" size="sm">Match + Record Expense</Button></div></form></div></details>}

                  <details className={detailsClass}><summary className={summaryClass}>Ignore / Delete</summary><div className="flex flex-wrap gap-2 border-t border-border p-3"><form action={updateDocumentReview}><input type="hidden" name="id" value={d.id}/><input type="hidden" name="project_id" value={d.project_id||''}/><input type="hidden" name="vendor_id" value={d.vendor_id||''}/><input type="hidden" name="document_date" value={d.document_date||''}/><input type="hidden" name="amount" value={d.amount??''}/><input type="hidden" name="reference_number" value={d.reference_number||''}/><input type="hidden" name="notes" value={d.notes||''}/><input type="hidden" name="review_status" value="ignored"/><Button type="submit" variant="outline" size="sm">Ignore</Button></form><form action={deleteDocument}><input type="hidden" name="id" value={d.id}/><Button type="submit" variant="destructive" size="sm">Delete File</Button></form></div></details>
                </div>
              </CardContent>
            </Card>;
          })}</div>}
      </section>

      <section id="filed-evidence" className="carez-filed-evidence space-y-4" aria-labelledby="filed-heading">
        <CarezSectionHeading id="filed-heading" icon={<FolderOpen/>} title="Filed & matched" description="The evidence behind the job and source transaction, including ignored records." action={<Badge variant="outline">{archived.length} records</Badge>}/>
        {archived.length===0?<CarezExperienceEmpty icon={<FolderOpen/>} title="A place for every piece of proof." description="File or match a document from the review queue to build your evidence record." actions={<a href="#capture-heading" className={buttonVariants({variant:'outline',size:'sm'})}><UploadCloud/>Capture a document</a>}/>:
          <div className="carez-evidence-browser">
            <div className="carez-evidence-browser-head" aria-hidden="true"><span>Document / source</span><span>Job / date</span><span>Amount</span><span>State / action</span></div>
            {archived.slice(0,120).map((d:any)=>{const DocIcon=documentIcon(d.document_type);return <article key={d.id} className="carez-evidence-row">
              <div className="flex min-w-0 items-start gap-3"><span className="carez-document-icon"><DocIcon aria-hidden="true"/></span><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{d.title}</h3><p className="mt-1 text-xs text-muted-foreground">{d.vendors?.name||'No vendor'} · {label(d.document_type)}{d.reference_number?` · #${d.reference_number}`:''}</p></div></div>
              <div className="carez-evidence-job"><p className="text-xs font-medium">{d.projects?`${d.projects.job_number} — ${d.projects.name}`:'Company'}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{d.document_date||'No date'}</p></div>
              <span className="carez-evidence-amount font-mono text-sm font-semibold tabular-nums">{money(d.amount)}</span>
              <div className="carez-evidence-record-actions"><Badge variant="outline" className={d.review_status==='matched'?'border-success/30 bg-success/10 text-success':'text-muted-foreground'}>{label(d.review_status)}</Badge>{d.url?<a className={buttonVariants({variant:'ghost',size:'sm'})} aria-label={'Open '+d.title} href={d.url} target="_blank" rel="noreferrer">Open<ArrowRight/></a>:<span className="text-xs text-muted-foreground">File unavailable</span>}</div>
            </article>})}
            {archived.length>120?<p className="p-3 text-xs text-muted-foreground">Showing the 120 most recent filed records.</p>:null}
          </div>}
      </section>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"><strong>Accounting rule:</strong> <span className="text-muted-foreground">a receipt photo is evidence, not a second cost. Job-cost and company-expense workflows create the accounting record from the matched bank charge; vendor invoices attach to the existing bill; concrete tickets post received quantity against the PO.</span></div>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/banking/reconcile">Bank Reconciliation</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/procurement">Procurement</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Pour Control</Link></div>
    </div>
  </AppShell>;
}
