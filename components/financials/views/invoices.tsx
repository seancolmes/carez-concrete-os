import {financialMoney,financialNumber,completeFinancialSum} from '@/lib/financials/amount';
import {ProcurementForm} from '@/components/financials/ProcurementForm';
import {InvoiceDraftBasisFields} from '@/components/billing/InvoiceDraftBasisFields';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,Dialog,DialogTitle,DialogTrigger,Card,Input,Label,DialogBody,DialogContent,DialogSurface,Select,Checkbox} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {createInvoice,addInvoiceLine,sendInvoice,voidInvoice} from '@/app/billing/actions';

const money=financialMoney;
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const units=['LS','EA','CY','LF','SF','HR','DAY','TON','GAL'];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';
const checkboxClass='size-4 rounded border-input accent-primary';

export default async function InvoicesPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!p?.company_id)redirect('/login');if(p.role==='employee')redirect('/employee');
 const [{data:projects,error:projectsError},{data:invoices,error:invoicesError},{data:lines,error:linesError},{data:cos,error:cosError},{data:billingSources,error:billingSourceError}]=await Promise.all([
  supabase.from('projects').select('id,job_number,name').eq('company_id',p.company_id).in('status',['active','on_hold','completed']).order('job_number'),
  supabase.from('invoice_financial_summary').select('*').eq('company_id',p.company_id).order('issue_date',{ascending:false}),
  supabase.from('invoice_lines').select('*').eq('company_id',p.company_id).order('sort_order'),
  supabase.from('change_order_financial_summary').select('change_order_id,project_id,co_number,title,status,selected_sell_price').eq('company_id',p.company_id).eq('status','approved').order('requested_date'),
  supabase.from('project_external_intakes').select('project_id,retainage_percent,agreement_reference,billing_submission_day,billing_submission_channel').eq('company_id',p.company_id)
 ]);
 const lMap=new Map<string,any[]>(),projectMap=new Map((projects||[]).map((x:any)=>[x.id,x]));
 for(const l of lines||[]){const a=lMap.get(l.invoice_id)||[];a.push(l);lMap.set(l.invoice_id,a);}
 const drafts=(invoices||[]).filter((x:any)=>x.status==='draft');
 const sent=(invoices||[]).filter((x:any)=>x.status==='sent');
 const draftValue=completeFinancialSum(invoicesError?null:drafts,'invoice_total');
 const sentKnown=!invoicesError&&sent.every((x:any)=>financialNumber(x.balance_due)!==null);

 return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3">
  <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Invoices</h1><div className="flex flex-wrap gap-2"><Link className={secondaryLinkClass} href="/billing">Billing</Link>{projectsError?<span role="alert" className="text-sm text-destructive">Jobs unavailable. Try again shortly.</span>:(projects||[]).length===0?<Link className={primaryLinkClass} href="/projects">Create a job first</Link>:<Dialog><DialogTrigger><Button size="small">Create invoice</Button></DialogTrigger><DialogSurface className="pt-dialog max-h-[88vh] overflow-y-auto"><DialogBody><DialogContent><div><DialogTitle>Create invoice</DialogTitle><p>Start a draft, then add billing lines from its detail view.</p></div><ProcurementForm action={createInvoice} className="grid gap-4">
   <InvoiceDraftBasisFields projects={projects||[]} sources={billingSources||[]} unavailable={Boolean(billingSourceError)}/>
   <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="invoice-date">Invoice Date</Label><Input appearance="underline" id="invoice-date" type="date" name="issue_date" defaultValue={today()} required/></div><div className="grid gap-2"><Label htmlFor="invoice-due-date">Due Date</Label><Input appearance="underline" id="invoice-due-date" type="date" name="due_date"/></div></div>
   <div className="grid gap-2"><Label htmlFor="invoice-po">Customer PO / Reference</Label><Input appearance="underline" id="invoice-po" name="po_number"/></div>
   <div className="grid gap-2"><Label htmlFor="invoice-notes">Note</Label><Input appearance="underline" id="invoice-notes" name="notes"/></div>
   <Button type="submit" appearance="primary" className="w-fit" disabled={Boolean(billingSourceError)}>Create draft invoice</Button>
  </ProcurementForm></DialogContent></DialogBody></DialogSurface></Dialog>}</div></header>

  {!projectsError&&(projects||[]).length===0?<p className="text-sm text-muted-foreground">An active, on-hold, or completed job is required before an invoice can be drafted.</p>:null}

  <div className="grid gap-3 sm:grid-cols-3">
   <Card><div className={drafts.length?'space-y-1 text-warning':'space-y-1 text-success'}><div className="text-xs font-medium text-muted-foreground">Draft Invoices</div><div className="text-2xl font-semibold tabular-nums">{invoicesError?'Unavailable':drafts.length}</div></div></Card>
   <Card><div className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Draft Value</div><div className="text-2xl font-semibold tabular-nums">{money(draftValue)}</div></div></Card>
   <Card><div className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Sent / Open</div><div className="text-2xl font-semibold tabular-nums">{sentKnown?sent.filter((x:any)=>Number(x.balance_due)>0).length:'Unavailable'}</div></div></Card>
  </div>

  <section className="space-y-3" aria-labelledby="invoice-board"><div className="carez-section-heading"><h2 id="invoice-board">Invoice register</h2></div>
   {invoicesError?<p role="status" className="p-3 text-sm text-muted-foreground">Invoice records unavailable. This is not a confirmed empty register.</p>:(invoices||[]).length===0?<div className="border border-border"><div><h3>No invoices yet</h3><p>Create a draft invoice when work is ready to bill.</p></div></div>:<div className="space-y-2">{(invoices||[]).map((i:any)=>{
    const il=lMap.get(i.invoice_id)||[];
    const project:any=projectMap.get(i.project_id);
    const projectCOs=(cos||[]).filter((c:any)=>c.project_id===i.project_id);
    const statusClass=i.status==='sent'?'border-warning/30 bg-warning/10 text-warning':i.status==='paid'?'border-success/30 bg-success/10 text-success':i.status==='void'?'border-destructive/30 bg-destructive/10 text-destructive':'text-muted-foreground';
    return <Card key={i.invoice_id} className="gap-0 py-0"><Dialog><div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"><div className="min-w-0"><strong className="block break-words">{i.invoice_number} · {project?`${project.job_number} ${project.name}`:'Job'}</strong><p className="text-xs text-muted-foreground">{i.invoice_type.replaceAll('_',' ')} · Issued {i.issue_date} · Due {i.due_date||'not set'}</p></div><Badge appearance="outline" className={statusClass}>{i.status}</Badge><strong className="font-mono tabular-nums">{money(i.balance_due)} owed</strong><DialogTrigger><Button appearance="outline" size="small">View / Edit</Button></DialogTrigger></div><DialogSurface className="pt-dialog "><DialogBody><DialogContent><div className="flex justify-end"><DialogTrigger action="close"><Button type="button" appearance="subtle" size="small">Close</Button></DialogTrigger></div><div><DialogTitle>{i.invoice_number} · {project?project.name:'Job'}</DialogTitle><p>{i.invoice_type.replaceAll('_',' ')} · {i.status} · Invoice {i.issue_date}</p></div><div className="space-y-5 overflow-y-auto pb-6">
     <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Invoice Total</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(i.invoice_total)}</div></div>
      <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Paid</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(i.amount_paid)}</div></div>
      <div className={`rounded-lg border bg-muted/20 p-3 ${num(i.balance_due)>0&&i.status==='sent'?'border-warning/30 text-warning':'border-border'}`}><div className="text-xs font-medium text-muted-foreground">Still Owed</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(i.balance_due)}</div></div>
      <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Retainage Held</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(i.retainage_held)}</div></div>
     </div>

     {linesError?<p role="status" className="text-sm text-muted-foreground">Billing lines unavailable. Sending is disabled.</p>:il.length===0?<div className="text-sm text-muted-foreground">No billing lines yet.</div>:<div className="divide-y rounded-lg border border-border">{il.map((l:any)=><div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={l.id}><div><div className="font-medium">{l.description}</div><div className="mt-1 text-xs text-muted-foreground">{num(l.quantity).toFixed(2)} {l.unit} × {money(l.unit_price)}</div></div><strong className="tabular-nums">{money(l.line_amount)}</strong></div>)}</div>}

     {i.status==='draft'&&i.invoice_type!=='retainage_release'&&<Accordion collapsible><AccordionItem value="content" className="rounded-lg border border-border"><AccordionHeader className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Billing Line</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="border-t border-border p-3"><ProcurementForm action={addInvoiceLine} className="grid gap-4"><input type="hidden" name="invoice_id" value={i.invoice_id}/>
      <div className="grid gap-2"><Label htmlFor={`source-${i.invoice_id}`}>What Are We Billing?</Label><Select appearance="outline" id={`source-${i.invoice_id}`} className={selectClass} name="source_type" defaultValue="manual"><option value="manual">Contract Work</option><option value="change_order" disabled={Boolean(cosError)}>Approved Change Order{cosError?' · unavailable':''}</option></Select></div>
      {projectCOs.length>0&&<div className="grid gap-2"><Label htmlFor={`co-${i.invoice_id}`}>Approved Change Order</Label><Select appearance="outline" id={`co-${i.invoice_id}`} className={selectClass} name="change_order_id" defaultValue=""><option value="">None</option>{projectCOs.map((c:any)=><option key={c.change_order_id} value={c.change_order_id}>{c.co_number} — {c.title}</option>)}</Select></div>}
      <div className="grid gap-2"><Label htmlFor={`description-${i.invoice_id}`}>Description</Label><Input appearance="underline" id={`description-${i.invoice_id}`} name="description" required/></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`quantity-${i.invoice_id}`}>Quantity</Label><Input appearance="underline" id={`quantity-${i.invoice_id}`} type="number" step="0.01" name="quantity" defaultValue="1"/></div><div className="grid gap-2"><Label htmlFor={`unit-${i.invoice_id}`}>Unit</Label><Select appearance="outline" id={`unit-${i.invoice_id}`} className={selectClass} name="unit" defaultValue="LS">{units.map(u=><option key={u}>{u}</option>)}</Select></div></div>
      <div className="grid gap-2"><Label htmlFor={`price-${i.invoice_id}`}>Price</Label><Input appearance="underline" id={`price-${i.invoice_id}`} type="number" step="0.01" name="unit_price" required/></div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox className={checkboxClass}  name="taxable" defaultChecked/>Taxable work</label>
      <Button type="submit" appearance="primary" className="w-fit">Add Billing Line</Button>
     </ProcurementForm></div></AccordionPanel></AccordionItem></Accordion>}

     <div className="flex flex-wrap gap-2 border-t border-border pt-4"><Link className={secondaryLinkClass} href={`/billing/invoices/${i.invoice_id}`}>Open / Print Invoice</Link>{i.status==='draft'&&!linesError&&il.length>0&&<ProcurementForm action={sendInvoice}><input type="hidden" name="invoice_id" value={i.invoice_id}/><Button type="submit" appearance="primary">Mark Sent to Customer</Button></ProcurementForm>}{i.status==='draft'&&<ProcurementForm action={voidInvoice}><input type="hidden" name="invoice_id" value={i.invoice_id}/><Button type="submit" appearance="outline">Void Draft</Button></ProcurementForm>}</div>
    </div></DialogContent></DialogBody></DialogSurface></Dialog></Card>})}</div>}
  </section>
 </div></>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
