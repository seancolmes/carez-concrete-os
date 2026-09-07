import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {createClient} from '@/lib/supabase/server';
import {createPayrollRun,approvePayrollRun,processPayrollRun,voidPayrollRun} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

function Metric({label,value,detail,tone='default'}:{label:string;value:string;detail?:string;tone?:'default'|'success'|'warning'}){
  return <Card size="sm"><CardContent className={`h-full space-y-1 ${tone==='success'?'text-success':tone==='warning'?'text-warning':''}`}><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="text-2xl font-semibold tabular-nums">{value}</div>{detail&&<div className="text-xs text-muted-foreground">{detail}</div>}</CardContent></Card>;
}

export default async function PayrollPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:s},{data:workers},{data:runs},{data:lines}]=await Promise.all([
    supabase.from('company_payroll_cash_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
    supabase.from('payroll_unprocessed_worker_summary').select('*').eq('company_id',p.company_id).order('worker_name'),
    supabase.from('payroll_run_financial_summary').select('*').eq('company_id',p.company_id).order('period_end',{ascending:false}),
    supabase.from('payroll_run_lines').select('*').eq('company_id',p.company_id).order('work_date'),
  ]);

  const runLines=new Map<string,any[]>();
  for(const l of lines||[]){const a=runLines.get(l.payroll_run_id)||[];a.push(l);runLines.set(l.payroll_run_id,a);}
  const funding=num(s?.total_open_payroll_requirement);
  const gross=num(s?.unprocessed_gross_wages);
  const taxes=num(s?.unprocessed_employer_payroll_taxes);
  const li=num(s?.unprocessed_li);

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payroll</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Crew Pay</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Approved employee time becomes money Carez must protect for wages, employer taxes and L&amp;I before payroll is processed.</p></header>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline'})} href="/field/review">Approve Crew Time</Link><Link className={buttonVariants({variant:'outline'})} href="/cashflow">Check Cash</Link></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Money Needed for Payroll" value={money(funding)} detail="Protected automatically in Carez cash calculations." tone={funding>0?'warning':'success'}/>
      <Metric label="Gross Wages Waiting" value={money(gross)}/>
      <Metric label="Employer Payroll Taxes" value={money(taxes)}/>
      <Metric label="L&I Cost" value={money(li)}/>
      <Metric label="Workers Waiting for Payroll" value={String((workers||[]).length)}/>
    </div>

    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><strong className="text-foreground">What this means:</strong> Carez protects gross W-2 wages plus the employer-side payroll taxes and L&amp;I created by approved field time. Owner internal labor and subcontractors stay out of W-2 payroll.</div>

    <section className="space-y-4" aria-labelledby="payroll-ready">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ready for Payroll</div><h2 id="payroll-ready" className="mt-1 text-lg font-semibold">Approved Time Not Yet Processed</h2><p className="mt-1 text-sm text-muted-foreground">This time is already real job cost. A payroll run groups it into the pay period and tracks the cash requirement.</p></div><details className="w-full rounded-lg border border-border sm:max-w-md"><summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">Create Pay Period</summary><div className="border-t border-border p-3"><form action={createPayrollRun} className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="payroll-period-start">Period Start</Label><Input id="payroll-period-start" type="date" name="period_start" required/></div><div className="grid gap-2"><Label htmlFor="payroll-period-end">Period End</Label><Input id="payroll-period-end" type="date" name="period_end" required/></div></div><div className="grid gap-2"><Label htmlFor="payroll-pay-date">Expected Pay Date</Label><Input id="payroll-pay-date" type="date" name="pay_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="payroll-note">Note</Label><Input id="payroll-note" name="notes"/></div><Button type="submit" className="w-fit">Create Pay Period</Button></form></div></details></div>

      {(workers||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No approved W-2 time waiting for payroll</EmptyTitle><EmptyDescription>Employees clock time, you approve it in Field, then it appears here.</EmptyDescription></EmptyHeader></Empty>:<div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Hours</TableHead><TableHead>Gross Wages</TableHead><TableHead>Employer Taxes</TableHead><TableHead>L&amp;I</TableHead><TableHead>Cash to Protect</TableHead></TableRow></TableHeader><TableBody>{(workers||[]).map((w:any)=><TableRow key={w.crew_member_id}><TableCell><div className="font-medium">{w.worker_name}</div><div className="mt-1 text-xs text-muted-foreground">{w.first_unprocessed_date} – {w.last_unprocessed_date}</div></TableCell><TableCell className="tabular-nums">{(num(w.regular_hours)+num(w.overtime_hours)).toFixed(2)}<div className="mt-1 text-xs text-muted-foreground">OT {num(w.overtime_hours).toFixed(2)}</div></TableCell><TableCell className="tabular-nums">{money(w.gross_wages)}</TableCell><TableCell className="tabular-nums">{money(w.employer_payroll_taxes)}</TableCell><TableCell className="tabular-nums">{money(w.employer_li)}</TableCell><TableCell className="font-semibold tabular-nums">{money(w.payroll_funding_requirement)}</TableCell></TableRow>)}</TableBody></Table></div>}
    </section>

    <section className="space-y-4" aria-labelledby="payroll-history">
      <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</div><h2 id="payroll-history" className="mt-1 text-lg font-semibold">Pay Periods</h2><p className="mt-1 text-sm text-muted-foreground">Draft → Approved funding → Processed. Mark processed only after payroll is actually run.</p></div>
      {(runs||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No pay periods yet</EmptyTitle><EmptyDescription>Created pay periods will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(runs||[]).map((r:any)=>{
        const rows=(runLines.get(r.payroll_run_id)||[]).filter((x:any)=>x.active);
        return <Card key={r.payroll_run_id}><header className="flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{r.period_start} – {r.period_end}</h3><p className="mt-1 text-sm text-muted-foreground">Pay date {r.pay_date||'not set'} · {r.worker_count} worker(s) · {r.timecard_count} timecard(s)</p></div><Badge variant="outline" className={r.status==='processed'?'border-success/30 bg-success/10 text-success':r.status==='approved'?'border-primary/30 bg-primary/10 text-primary':r.status==='void'?'border-destructive/30 bg-destructive/10 text-destructive':'text-muted-foreground'}>{r.status}</Badge></header><CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Gross Wages</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(r.gross_wages)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Employer Taxes</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(r.employer_payroll_taxes)}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">L&amp;I</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(r.employer_li)}</div></div><div className={`rounded-lg border border-border bg-muted/20 p-3 ${r.status==='processed'?'text-success':'text-primary'}`}><div className="text-xs font-medium text-muted-foreground">Cash Requirement</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(r.payroll_funding_requirement)}</div></div></div>

          {rows.length>0&&<details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Show Worker Detail</summary><div className="overflow-x-auto border-t border-border"><Table><TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Date</TableHead><TableHead>Hours</TableHead><TableHead>Gross</TableHead><TableHead>Funding</TableHead></TableRow></TableHeader><TableBody>{rows.map((x:any)=><TableRow key={x.id}><TableCell>{x.worker_name}</TableCell><TableCell>{x.work_date}</TableCell><TableCell className="tabular-nums">{(num(x.regular_hours)+num(x.overtime_hours)).toFixed(2)}</TableCell><TableCell className="tabular-nums">{money(x.gross_wages)}</TableCell><TableCell className="tabular-nums">{money(x.payroll_funding_requirement)}</TableCell></TableRow>)}</TableBody></Table></div></details>}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">{r.status==='draft'&&<form action={approvePayrollRun}><input type="hidden" name="payroll_run_id" value={r.payroll_run_id}/><Button type="submit">Approve Payroll Funding</Button></form>}{r.status==='approved'&&<details className="w-full rounded-lg border border-border sm:max-w-md"><summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">Payroll Has Been Processed</summary><div className="border-t border-border p-3"><form action={processPayrollRun} className="grid gap-3"><input type="hidden" name="payroll_run_id" value={r.payroll_run_id}/><div className="grid gap-2"><Label htmlFor={`payroll-cash-${r.payroll_run_id}`}>Actual Cash Paid (optional)</Label><Input id={`payroll-cash-${r.payroll_run_id}`} type="number" min="0" step="0.01" name="actual_cash_paid" placeholder={num(r.payroll_funding_requirement).toFixed(2)}/></div><div className="grid gap-2"><Label htmlFor={`payroll-reference-${r.payroll_run_id}`}>Payroll / Check Reference</Label><Input id={`payroll-reference-${r.payroll_run_id}`} name="reference_number"/></div><Button type="submit" className="w-fit">Mark Payroll Processed</Button></form></div></details>}{['draft','approved'].includes(r.status)&&<form action={voidPayrollRun}><input type="hidden" name="payroll_run_id" value={r.payroll_run_id}/><Button type="submit" variant="outline">Void</Button></form>}</div>
        </CardContent></Card>;
      })}</div>}
    </section>
  </div></AppShell>;
}
