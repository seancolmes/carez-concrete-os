import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {Card,CardContent} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createRetainageRelease} from '../actions';

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

 return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3">
  <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Retainage</h1><div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/billing">Billing</Link>{available.length>0?<Dialog><DialogTrigger render={<Button size="sm"/>}>Release retainage</DialogTrigger><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Release retainage</DialogTitle><DialogDescription>Create a collection invoice for money already billed. The contract and sales tax are not billed twice.</DialogDescription></DialogHeader><form action={createRetainageRelease} className="grid gap-4">
    <div className="grid gap-2"><Label htmlFor="retainage-source">Original Invoice</Label><select id="retainage-source" className={selectClass} name="source_invoice_id" required defaultValue=""><option value="" disabled>Choose invoice</option>{available.map((x:any)=><option key={x.source_invoice_id} value={x.source_invoice_id}>{x.invoice_number} — available {money(x.available_to_release)}</option>)}</select></div>
    <div className="grid gap-2"><Label htmlFor="retainage-amount">Amount to Release</Label><Input id="retainage-amount" type="number" min="0.01" step="0.01" name="amount" required/></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="retainage-date">Invoice Date</Label><Input id="retainage-date" type="date" name="issue_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="retainage-due">Due Date</Label><Input id="retainage-due" type="date" name="due_date"/></div></div>
    <Button type="submit" className="w-fit">Create retainage release invoice</Button>
   </form></DialogContent></Dialog>:null}</div></header>

  <div className="grid gap-3 sm:grid-cols-2">
   <Card className={total>0?'border-warning/30':''}><CardContent className={total>0?'space-y-1 text-warning':'space-y-1'}><div className="text-xs font-medium text-muted-foreground">Available to release</div><div className="text-2xl font-semibold tabular-nums">{money(total)}</div></CardContent></Card>
   <Card><CardContent className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Invoices Holding Retainage</div><div className="text-2xl font-semibold tabular-nums">{available.length}</div></CardContent></Card>
  </div>

  <section className="space-y-3" aria-labelledby="retainage-by-invoice"><div className="carez-section-heading"><h2 id="retainage-by-invoice">Retainage by invoice</h2></div>
   {(r||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No retainage history yet</EmptyTitle><EmptyDescription>Invoices that hold retainage will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-2">{(r||[]).map((x:any)=>{const releasable=num(x.available_to_release)>0;return <Card key={x.source_invoice_id} className="gap-0 py-0"><Sheet><div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"><div><strong className="block">{x.invoice_number}</strong><span className="text-xs text-muted-foreground">Invoice {x.issue_date}</span></div><Badge variant="outline" className={releasable?'border-warning/30 bg-warning/10 text-warning':'text-muted-foreground'}>{releasable?'Available':'Released'}</Badge><strong className="font-mono tabular-nums">{money(x.available_to_release)}</strong><SheetTrigger render={<Button variant="outline" size="sm"/>}>View details</SheetTrigger></div><SheetContent className="w-full sm:max-w-xl"><SheetHeader><SheetTitle>{x.invoice_number}</SheetTitle><SheetDescription>Retainage from invoice {x.issue_date}</SheetDescription></SheetHeader><div className="grid gap-0 border-y border-border text-sm"><div className="flex justify-between gap-3 border-b border-border p-3"><span>Originally held</span><strong className="font-mono tabular-nums">{money(x.retainage_held)}</strong></div><div className="flex justify-between gap-3 border-b border-border p-3"><span>Already released</span><strong className="font-mono tabular-nums">{money(x.retainage_released)}</strong></div><div className="flex justify-between gap-3 p-3"><span>Available</span><strong className="font-mono tabular-nums">{money(x.available_to_release)}</strong></div></div></SheetContent></Sheet></Card>})}</div>}
  </section>
 </div></AppShell>;
}
