import Link from 'next/link';
import {redirect} from 'next/navigation';
import {FileCheck2,FileText,FolderOpen,Inbox,ReceiptText} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
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
const summaryClass='cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40';

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
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="carez-page-heading">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Field evidence</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Documents, Receipts & Concrete Tickets</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Capture the photo once, then tie it to the job, PO delivery, vendor bill or bank charge it proves.</p>
      </header>

      <section className="carez-summary-ledger grid gap-px md:grid-cols-2 xl:grid-cols-4" aria-label="Document summary">
        <Metric icon={Inbox} label="Needs Review" value={queue.length} help="Receipts and tickets waiting to be handled." tone={queue.length?'warning':'success'}/>
        <Metric icon={FolderOpen} label="Need a Job" value={missingJob.length} help="Evidence not assigned to a project." tone={missingJob.length?'warning':'success'}/>
        <Metric icon={FileCheck2} label="Matched" value={matched.length} help="Connected to accounting or procurement."/>
        <Metric icon={ReceiptText} label="Concrete Tickets" value={concrete.length} help="Delivery evidence retained by pour and job."/>
      </section>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Add From Phone</CardTitle>
          <CardDescription>Photograph the receipt or ticket before it disappears into a truck, wallet or clipboard.</CardDescription>
        </CardHeader>
        <CardContent><DocumentUpload companyId={companyId} projects={projectOpts} vendors={vendorOpts}/></CardContent>
      </Card>

      <section className="space-y-4">
        <SectionHeading kicker="Inbox" title="Review Queue" description="Use the workflow that matches what the document proves."/>
        {queue.length===0?<Empty className="min-h-52 border border-border bg-muted/10"><EmptyHeader><EmptyMedia variant="icon"><Inbox/></EmptyMedia><EmptyTitle>Document inbox is clear</EmptyTitle><EmptyDescription>New receipts, invoices and tickets will land here.</EmptyDescription></EmptyHeader></Empty>:
          <div className="grid gap-4">{queue.map((d:any)=>{
            const probableBank=outgoing.filter((t:any)=>d.amount==null||Math.abs(t.amount-num(d.amount))<0.011).slice(0,20);
            const ticketLines=lines.filter((l:any)=>l.po&&(!d.project_id||l.po.project_id===d.project_id)&&(!d.vendor_id||l.po.vendor_id===d.vendor_id)&&l.po.status==='issued');
            const billOpts=(bills||[]).filter((b:any)=>(!d.project_id||b.project_id===d.project_id)&&(!d.vendor_id||b.vendor_id===d.vendor_id));
            return <Card key={d.id} className="gap-0 py-0 shadow-none">
              <CardHeader className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0"><CardTitle className="truncate">{d.title}</CardTitle><CardDescription className="mt-1">{d.document_date||'No date'} · {label(d.document_type)}{d.reference_number?` · #${d.reference_number}`:''}</CardDescription></div>
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Needs Review</Badge>
              </CardHeader>
              <CardContent className="space-y-4 py-4">
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between">
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

      <section className="space-y-4">
        <SectionHeading kicker="Archive" title="Filed & Matched" description="Evidence stays attached to the job and source transaction."/>
        {archived.length===0?<Empty className="min-h-44 border border-border bg-muted/10"><EmptyHeader><EmptyMedia variant="icon"><FileText/></EmptyMedia><EmptyTitle>No filed documents yet</EmptyTitle><EmptyDescription>Filed, matched and ignored evidence will appear here.</EmptyDescription></EmptyHeader></Empty>:
          <div className="grid gap-3 md:grid-cols-2">{archived.slice(0,120).map((d:any)=><Card key={d.id} className="gap-3 py-4 shadow-none"><CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4"><div className="min-w-0"><CardTitle className="truncate text-sm">{d.title}</CardTitle><CardDescription className="mt-1">{d.document_date||'No date'} · {label(d.document_type)} · {d.projects?`${d.projects.job_number} — ${d.projects.name}`:'Company'}</CardDescription></div><Badge variant="outline" className={d.review_status==='matched'?'border-success/30 bg-success/10 text-success':'text-muted-foreground'}>{label(d.review_status)}</Badge></CardHeader><CardContent className="flex items-center justify-between gap-3 px-4"><div className="text-xs text-muted-foreground">{d.vendors?.name||'No vendor'} · {money(d.amount)}{d.reference_number?` · #${d.reference_number}`:''}</div>{d.url&&<a className={buttonVariants({variant:'outline',size:'sm'})} href={d.url} target="_blank" rel="noreferrer">Open</a>}</CardContent></Card>)}</div>}
      </section>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"><strong>Accounting rule:</strong> <span className="text-muted-foreground">a receipt photo is evidence, not a second cost. Job-cost and company-expense workflows create the accounting record from the matched bank charge; vendor invoices attach to the existing bill; concrete tickets post received quantity against the PO.</span></div>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/banking/reconcile">Bank Reconciliation</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/procurement">Procurement</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Pour Control</Link></div>
    </div>
  </AppShell>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description:string}){
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p></div>;
}

function Metric({icon:Icon,label,value,help,tone='default'}:{icon:any;label:string;value:number;help:string;tone?:'default'|'success'|'warning'}){
  const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':'text-foreground';
  return <Card className={tone==='warning'?'gap-2 border-warning/30 py-4 shadow-none':'gap-2 py-4 shadow-none'}><CardHeader className="gap-2 px-4"><div className="flex items-center justify-between gap-3"><CardDescription className="text-xs font-medium">{label}</CardDescription><Icon className={`size-4 ${toneClass}`}/></div><CardTitle className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}
