import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
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

 return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
   <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Retainage</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Money the customer has already been billed for but is still holding back. Release it without billing the contract or sales tax twice.</p></header>
   <Link className={buttonVariants({variant:'outline'})} href="/billing">Back to Billing</Link>
  </div>

  <div className="grid gap-3 sm:grid-cols-2">
   <Card className={total>0?'border-warning/30':''}><CardContent className={total>0?'space-y-1 text-warning':'space-y-1 text-success'}><div className="text-xs font-medium text-muted-foreground">Available to Release</div><div className="text-2xl font-semibold tabular-nums">{money(total)}</div></CardContent></Card>
   <Card><CardContent className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Invoices Holding Retainage</div><div className="text-2xl font-semibold tabular-nums">{available.length}</div></CardContent></Card>
  </div>

  <Card className="shadow-none"><CardHeader><CardTitle>Release Retainage</CardTitle><CardDescription>Creates a collection invoice for money already billed previously.</CardDescription></CardHeader><CardContent>
   {available.length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No retainage available to release</EmptyTitle><EmptyDescription>Invoices with releasable retainage will appear here.</EmptyDescription></EmptyHeader></Empty>:<form action={createRetainageRelease} className="grid gap-4">
    <div className="grid gap-2"><Label htmlFor="retainage-source">Original Invoice</Label><select id="retainage-source" className={selectClass} name="source_invoice_id" required defaultValue=""><option value="" disabled>Choose invoice</option>{available.map((x:any)=><option key={x.source_invoice_id} value={x.source_invoice_id}>{x.invoice_number} — available {money(x.available_to_release)}</option>)}</select></div>
    <div className="grid gap-2"><Label htmlFor="retainage-amount">Amount to Release</Label><Input id="retainage-amount" type="number" min="0.01" step="0.01" name="amount" required/></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="retainage-date">Invoice Date</Label><Input id="retainage-date" type="date" name="issue_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="retainage-due">Due Date</Label><Input id="retainage-due" type="date" name="due_date"/></div></div>
    <Button type="submit" className="w-fit">Create Retainage Release Invoice</Button>
   </form>}
  </CardContent></Card>

  <section className="space-y-4" aria-labelledby="retainage-by-invoice"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoices</div><h2 id="retainage-by-invoice" className="mt-1 text-lg font-semibold">Retainage by Invoice</h2></div>
   {(r||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No retainage history yet</EmptyTitle><EmptyDescription>Invoices that hold retainage will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(r||[]).map((x:any)=>{const releasable=num(x.available_to_release)>0;return <Card key={x.source_invoice_id}><header className="carez-page-heading flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{x.invoice_number}</h3><p className="mt-1 text-sm text-muted-foreground">Invoice {x.issue_date}</p></div><Badge variant="outline" className={releasable?'border-warning/30 bg-warning/10 text-warning':'border-success/30 bg-success/10 text-success'}>{releasable?'Available':'Released'}</Badge></header><CardContent><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Originally Held</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(x.retainage_held)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Already Released</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(x.retainage_released)}</div></div><div className={`rounded-lg border bg-muted/20 p-3 ${releasable?'border-warning/30 text-warning':'border-success/30 text-success'}`}><div className="text-xs font-medium text-muted-foreground">Available</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(x.available_to_release)}</div></div></div></CardContent></Card>})}</div>}
  </section>
 </div></AppShell>;
}
