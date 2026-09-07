import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';
import {Users,FileSearch,ShoppingCart,Truck,ReceiptText,CreditCard} from 'lucide-react';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);

export default async function ProcurementPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:vendors},{data:quotes},{data:pos},{data:bills},{data:receipts},{data:ap}]=await Promise.all([
    supabase.from('vendors').select('id,active').eq('company_id',p.company_id),
    supabase.from('vendor_quote_financial_summary').select('vendor_quote_id,status,total_cost').eq('company_id',p.company_id),
    supabase.from('purchase_order_financial_summary').select('purchase_order_id,status,open_commitment').eq('company_id',p.company_id),
    supabase.from('vendor_bill_financial_summary').select('vendor_bill_id,status,total_cost').eq('company_id',p.company_id),
    supabase.from('purchase_order_receipts').select('id,received_date').eq('company_id',p.company_id),
    supabase.from('company_ap_summary').select('*').eq('company_id',p.company_id).maybeSingle()
  ]);

  const openPO=(pos||[]).filter((x:any)=>x.status==='issued');
  const draftPO=(pos||[]).filter((x:any)=>x.status==='draft');
  const commit=openPO.reduce((s:number,x:any)=>s+num(x.open_commitment),0);
  const quoteReview=(quotes||[]).filter((x:any)=>x.status==='received').length;
  const draftBills=(bills||[]).filter((x:any)=>x.status==='draft').length;
  const activeVendors=(vendors||[]).filter((v:any)=>v.active).length;

  const workflow=[
    {href:'/procurement/vendors',title:'1. Vendors',copy:'Who supplies Carez',icon:Users},
    {href:'/procurement/quotes',title:'2. Get Pricing',copy:'Record supplier quotes',icon:FileSearch},
    {href:'/procurement/orders',title:'3. Purchase Orders',copy:'Commit the material order',icon:ShoppingCart},
    {href:'/procurement/orders',title:'4. Deliveries',copy:'Record tickets and quantities received',icon:Truck},
    {href:'/procurement/bills',title:'5. Vendor Bills',copy:'Post the real job cost',icon:ReceiptText},
    {href:'/payables',title:'6. Pay Vendor',copy:'Pay what Carez owes',icon:CreditCard},
  ];

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procurement</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Purchasing</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Get pricing, order material, track deliveries, enter the vendor bill, then pay it. Each step stays tied to the job.</p></header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Card size="sm"><CardContent className={cn('h-full space-y-1',quoteReview?'text-warning':'text-success')}><div className="text-xs font-medium text-muted-foreground">Prices to Review</div><div className="text-2xl font-semibold tabular-nums">{quoteReview}</div><div className="text-xs text-muted-foreground">Vendor quotes waiting for a decision.</div></CardContent></Card>
      <Card size="sm"><CardContent className={cn('h-full space-y-1',draftPO.length?'text-warning':'text-success')}><div className="text-xs font-medium text-muted-foreground">Draft Orders</div><div className="text-2xl font-semibold tabular-nums">{draftPO.length}</div><div className="text-xs text-muted-foreground">Not committed until issued.</div></CardContent></Card>
      <Card size="sm"><CardContent className={cn('h-full space-y-1',openPO.length?'text-warning':'text-success')}><div className="text-xs font-medium text-muted-foreground">Open Orders</div><div className="text-2xl font-semibold tabular-nums">{openPO.length}</div><div className="text-xs text-muted-foreground">Issued POs waiting to be fully billed or closed.</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Money Already Ordered</div><div className="text-2xl font-semibold tabular-nums">{money(commit)}</div><div className="text-xs text-muted-foreground">Open PO commitment.</div></CardContent></Card>
      <Card size="sm"><CardContent className={cn('h-full space-y-1',draftBills?'text-warning':'text-success')}><div className="text-xs font-medium text-muted-foreground">Bills to Review</div><div className="text-2xl font-semibold tabular-nums">{draftBills}</div><div className="text-xs text-muted-foreground">Vendor bills not yet posted as job cost.</div></CardContent></Card>
      <Card size="sm"><CardContent className={cn('h-full space-y-1',num(ap?.open_ap)>0?'text-warning':'text-success')}><div className="text-xs font-medium text-muted-foreground">Bills We Owe</div><div className="text-2xl font-semibold tabular-nums">{money(ap?.open_ap)}</div><div className="text-xs text-muted-foreground">Posted vendor bills still unpaid.</div></CardContent></Card>
    </div>

    <section className="space-y-4" aria-labelledby="procurement-workflow-title"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflow</div><h2 id="procurement-workflow-title" className="mt-1 text-lg font-semibold">Buy Material Without Losing the Paper Trail</h2><p className="mt-1 text-sm text-muted-foreground">Use the step that matches where the purchase is right now.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{workflow.map(({href,title,copy,icon:Icon})=><Link key={`${href}-${title}`} href={href} className="group rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors group-hover:text-foreground"><Icon size={17}/></span><span><span className="block font-medium">{title}</span><span className="mt-1 block text-sm text-muted-foreground">{copy}</span></span></div></Link>)}</div></section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card><CardContent className="space-y-4"><div><div className="font-semibold">Supplier Setup</div><p className="mt-1 text-sm text-muted-foreground">{activeVendors} active vendors</p></div><p className="text-sm text-muted-foreground">Concrete plants, rebar shops, lumber/building suppliers, pumps, rentals, trucking and subcontractors live in one directory.</p><Link className={buttonVariants()} href="/procurement/vendors">Open Vendors</Link></CardContent></Card>
      <Card><CardContent className="space-y-4"><div><div className="font-semibold">Recent Deliveries</div><p className="mt-1 text-sm text-muted-foreground">{(receipts||[]).length} delivery receipt record(s)</p></div><p className="text-sm text-muted-foreground">Delivery tickets stay connected to the purchase order so quantity received can be checked against quantity ordered.</p><Link className={buttonVariants()} href="/procurement/orders">Open Orders & Deliveries</Link></CardContent></Card>
    </section>
  </div></AppShell>;
}
