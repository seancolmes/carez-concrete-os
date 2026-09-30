import {Badge,Button,Dialog,DialogTitle,DialogTrigger,Card,Input,Label,DialogBody,DialogContent,DialogSurface,Select} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {createRetainageRelease} from '@/app/billing/actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function RetainagePage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!p?.company_id)redirect('/login');if(p.role==='employee')redirect('/employee');
 const {data:r}=await supabase.from('retainage_available_summary').select('*').eq('company_id',p.company_id).order('issue_date',{ascending:false});
 const available=(r||[]).filter((x:any)=>num(x.available_to_release)>0.009);
 const total=available.reduce((s:number,x:any)=>s+num(x.available_to_release),0);

 return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3">
  <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Retainage</h1><div className="flex flex-wrap gap-2"><Link className={secondaryLinkClass} href="/billing">Billing</Link>{available.length>0?<Dialog><DialogTrigger><Button size="small">Release retainage</Button></DialogTrigger><DialogSurface className="max-h-[88vh] overflow-y-auto sm:max-w-xl"><DialogBody><DialogContent><div><DialogTitle>Release retainage</DialogTitle><p>Create a collection invoice for money already billed. The contract and sales tax are not billed twice.</p></div><form action={createRetainageRelease} className="grid gap-4">
    <div className="grid gap-2"><Label htmlFor="retainage-source">Original Invoice</Label><Select appearance="outline" id="retainage-source" className={selectClass} name="source_invoice_id" required defaultValue=""><option value="" disabled>Choose invoice</option>{available.map((x:any)=><option key={x.source_invoice_id} value={x.source_invoice_id}>{x.invoice_number} — available {money(x.available_to_release)}</option>)}</Select></div>
    <div className="grid gap-2"><Label htmlFor="retainage-amount">Amount to Release</Label><Input appearance="underline" id="retainage-amount" type="number" min="0.01" step="0.01" name="amount" required/></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="retainage-date">Invoice Date</Label><Input appearance="underline" id="retainage-date" type="date" name="issue_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="retainage-due">Due Date</Label><Input appearance="underline" id="retainage-due" type="date" name="due_date"/></div></div>
    <Button type="submit" appearance="primary" className="w-fit">Create retainage release invoice</Button>
   </form></DialogContent></DialogBody></DialogSurface></Dialog>:null}</div></header>

  <div className="grid gap-3 sm:grid-cols-2">
   <Card className={total>0?'border-warning/30':''}><div className={total>0?'space-y-1 text-warning':'space-y-1'}><div className="text-xs font-medium text-muted-foreground">Available to release</div><div className="text-2xl font-semibold tabular-nums">{money(total)}</div></div></Card>
   <Card><div className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Invoices Holding Retainage</div><div className="text-2xl font-semibold tabular-nums">{available.length}</div></div></Card>
  </div>

  <section className="space-y-3" aria-labelledby="retainage-by-invoice"><div className="carez-section-heading"><h2 id="retainage-by-invoice">Retainage by invoice</h2></div>
   {(r||[]).length===0?<div className="border border-border"><div><h3>No retainage history yet</h3><p>Invoices that hold retainage will appear here.</p></div></div>:<div className="space-y-2">{(r||[]).map((x:any)=>{const releasable=num(x.available_to_release)>0;return <Card key={x.source_invoice_id} className="gap-0 py-0"><Dialog><div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"><div><strong className="block">{x.invoice_number}</strong><span className="text-xs text-muted-foreground">Invoice {x.issue_date}</span></div><Badge appearance="outline" className={releasable?'border-warning/30 bg-warning/10 text-warning':'text-muted-foreground'}>{releasable?'Available':'Released'}</Badge><strong className="font-mono tabular-nums">{money(x.available_to_release)}</strong><DialogTrigger><Button appearance="outline" size="small">View details</Button></DialogTrigger></div><DialogSurface className="w-full sm:max-w-xl !fixed !right-0 !top-0 !m-0 !h-dvh !max-h-dvh !rounded-none"><DialogBody><DialogContent><div className="flex justify-end"><DialogTrigger action="close"><Button type="button" appearance="subtle" size="small">Close</Button></DialogTrigger></div><div><DialogTitle>{x.invoice_number}</DialogTitle><p>Retainage from invoice {x.issue_date}</p></div><div className="grid gap-0 border-y border-border text-sm"><div className="flex justify-between gap-3 border-b border-border p-3"><span>Originally held</span><strong className="font-mono tabular-nums">{money(x.retainage_held)}</strong></div><div className="flex justify-between gap-3 border-b border-border p-3"><span>Already released</span><strong className="font-mono tabular-nums">{money(x.retainage_released)}</strong></div><div className="flex justify-between gap-3 p-3"><span>Available</span><strong className="font-mono tabular-nums">{money(x.available_to_release)}</strong></div></div></DialogContent></DialogBody></DialogSurface></Dialog></Card>})}</div>}
  </section>
 </div></>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
