import {redirect} from 'next/navigation';
import Link from 'next/link';
import {FilePlus2,HandCoins,ReceiptText,Settings2} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);

function Metric({label,value,help,tone='default'}:{label:string;value:string;help?:string;tone?:'default'|'success'|'warning'|'danger'}){
  return <Card className={cn('gap-2 py-4 shadow-none',tone==='warning'&&'border-warning/30',tone==='danger'&&'border-destructive/25')}><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={cn('font-mono text-xl font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-warning',tone==='danger'&&'text-destructive')}>{value}</CardTitle></CardHeader>{help?<CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent>:null}</Card>;
}

const workflow=[
  {href:'/billing/invoices',label:'Create / send invoice',copy:'Bill contract or change-order work',Icon:FilePlus2},
  {href:'/billing/payments',label:'Collect payment',copy:'Record checks, ACH and customer deposits',Icon:HandCoins},
  {href:'/billing/retainage',label:'Release retainage',copy:'Collect money already withheld',Icon:ReceiptText},
  {href:'/billing/setup',label:'Billing setup',copy:'Customer info, tax rates and invoice terms',Icon:Settings2},
] as const;

export default async function BillingPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!p?.company_id)redirect('/login');if(p.role==='employee')redirect('/employee');
  const [{data:billing},{data:invoices},{data:retainage}]=await Promise.all([
    supabase.from('project_billing_summary').select('*'),
    supabase.from('invoice_financial_summary').select('*').eq('company_id',p.company_id),
    supabase.from('retainage_available_summary').select('*').eq('company_id',p.company_id),
  ]);
  const owed=(billing||[]).reduce((s:number,x:any)=>s+num(x.outstanding_ar),0),late=(billing||[]).reduce((s:number,x:any)=>s+num(x.overdue_ar),0),unbilled=(billing||[]).reduce((s:number,x:any)=>s+num(x.unbilled_contract),0),collected=(billing||[]).reduce((s:number,x:any)=>s+num(x.cash_collected),0),ret=(retainage||[]).reduce((s:number,x:any)=>s+num(x.available_to_release),0),drafts=(invoices||[]).filter((x:any)=>x.status==='draft').length;

  return <AppShell userName={p.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Finance</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Billing</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Bill the customer, see what they still owe, collect the money, and keep retainage from getting forgotten.</p></header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Work not yet billed" value={money(unbilled)} help="Authorized value not invoiced yet." tone={unbilled>0?'warning':'default'}/>
        <Metric label="Customers owe" value={money(owed)} tone={owed>0?'warning':'success'}/>
        <Metric label="Past due" value={money(late)} help="Needs follow-up." tone={late>0?'danger':'success'}/>
        <Metric label="Cash collected" value={money(collected)} tone="success"/>
        <Metric label="Retainage available" value={money(ret)} tone={ret>0?'warning':'default'}/>
        <Metric label="Draft invoices" value={String(drafts)} tone={drafts?'warning':'default'}/>
      </section>

      <section className="space-y-4"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflow</p><h2 className="mt-1 text-lg font-semibold">From work performed to money in the bank</h2></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{workflow.map(({href,label,copy,Icon},index)=><Link href={href} key={href}><Card className="h-full gap-3 py-4 shadow-none transition-colors hover:bg-muted/40"><CardHeader className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3 px-4"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="size-4"/></span><div><p className="mb-1 text-[10px] font-medium text-muted-foreground">STEP {index+1}</p><CardTitle className="text-sm">{label}</CardTitle><CardDescription className="mt-1 text-xs leading-5">{copy}</CardDescription></div></CardHeader></Card></Link>)}</div></section>

      <section className="space-y-4">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jobs</p><h2 className="mt-1 text-lg font-semibold">Where the money stands</h2><p className="mt-1 text-sm text-muted-foreground">Authorized contract value, billing progress, receivables, and cash collected by job.</p></div>
        {(billing||[]).length===0?<Empty className="min-h-56 border bg-muted/20"><EmptyHeader><EmptyMedia variant="icon"><ReceiptText/></EmptyMedia><EmptyTitle>No project billing yet</EmptyTitle><EmptyDescription>Project billing records will appear here once invoices are issued against awarded work.</EmptyDescription></EmptyHeader></Empty>:
          <Card className="overflow-hidden py-0 shadow-none"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Job</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Authorized</TableHead><TableHead className="text-right">Not billed</TableHead><TableHead className="text-right">Billed</TableHead><TableHead className="text-right">Still owed</TableHead><TableHead className="text-right">Collected</TableHead></TableRow></TableHeader><TableBody>{(billing||[]).map((row:any)=>{const overdue=num(row.overdue_ar),outstanding=num(row.outstanding_ar);return <TableRow key={row.project_id}><TableCell><Link href={`/projects/${row.project_id}`} className="font-medium hover:text-primary">{row.job_number} — {row.name}</Link></TableCell><TableCell><Badge variant={overdue>0?'destructive':outstanding>0?'default':'secondary'} className={!outstanding?'bg-success/10 text-success':''}>{overdue>0?'Payment late':outstanding>0?'Customer owes':'Current'}</Badge></TableCell><TableCell className="text-right font-mono tabular-nums">{money(row.authorized_contract)}</TableCell><TableCell className="text-right font-mono tabular-nums">{money(row.unbilled_contract)}</TableCell><TableCell className="text-right font-mono tabular-nums">{money(row.billed_contract)}</TableCell><TableCell className={cn('text-right font-mono font-medium tabular-nums',overdue>0&&'text-destructive',outstanding>0&&!overdue&&'text-warning')}>{money(row.outstanding_ar)}</TableCell><TableCell className="text-right font-mono tabular-nums text-success">{money(row.cash_collected)}</TableCell></TableRow>})}</TableBody></Table></div></Card>}
      </section>
    </div>
  </AppShell>;
}
