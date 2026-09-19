import {redirect} from 'next/navigation';
import Link from 'next/link';
import {CalendarDays,Plus} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {JobsOperationsBoard,type JobsBoardMetrics,type JobsBoardRow} from '@/components/projects/JobsOperationsBoard';
import {Button,buttonVariants} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createProject} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);

export default async function ProjectsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).maybeSingle();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const companyId=profile.company_id,today=new Date().toISOString().slice(0,10);
  const [{data:projects},{data:budgets},{data:billing},{data:shifts},{data:workReady},{data:jobSetup},{data:schedule}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status,address,city,state,next_action,contract_value,created_at,customers(name)').eq('company_id',companyId).order('created_at',{ascending:false}),
    supabase.from('project_budget_actual_summary').select('*').eq('company_id',companyId),
    supabase.from('project_billing_summary').select('*'),
    supabase.from('employee_shift_sessions').select('project_id,status,clock_in_inside_geofence,clock_out_inside_geofence').eq('company_id',companyId).in('status',['active','open','submitted']),
    supabase.from('project_work_readiness_summary').select('*').eq('company_id',companyId),
    supabase.from('project_job_readiness_summary').select('*').eq('company_id',companyId),
    supabase.from('work_schedule_items').select('id,project_id,title,schedule_date,status,item_type,work_package_operation_id').eq('company_id',companyId).gte('schedule_date',today).neq('status','cancelled').order('schedule_date',{ascending:true}).limit(250),
  ]);

  const bMap=new Map((budgets||[]).map((x:any)=>[x.project_id,x]));
  const billMap=new Map((billing||[]).map((x:any)=>[x.project_id,x]));
  const readyMap=new Map((workReady||[]).map((x:any)=>[x.project_id,x]));
  const setupMap=new Map((jobSetup||[]).map((x:any)=>[x.project_id,x]));
  const fieldMap=new Map<string,{clocked:number;waiting:number;gps:number}>();
  for(const s of shifts||[]){
    const x=fieldMap.get(s.project_id)||{clocked:0,waiting:0,gps:0};
    if(['active','open'].includes(s.status))x.clocked++;
    if(s.status==='submitted')x.waiting++;
    if(s.clock_in_inside_geofence===false||s.clock_out_inside_geofence===false)x.gps++;
    fieldMap.set(s.project_id,x);
  }
  const scheduleMap=new Map<string,any>();
  for(const item of schedule||[])if(item.project_id&&!scheduleMap.has(item.project_id)&&item.item_type==='work')scheduleMap.set(item.project_id,item);

  const rows:JobsBoardRow[]=(projects||[]).map((j:any)=>{
    const b:any=bMap.get(j.id)||{},bill:any=billMap.get(j.id)||{},field=fieldMap.get(j.id)||{clocked:0,waiting:0,gps:0},wr:any=readyMap.get(j.id)||{},setup:any=setupMap.get(j.id),next=scheduleMap.get(j.id);
    const budgetUsed=num(b.budget_cost_used_percent),laborRemaining=num(b.labor_hours_remaining),overdue=num(bill.overdue_ar),blocked=num(wr.blocked_operations),ready=num(wr.ready_operations),failed=num(wr.failed_inspection_operations),openOps=num(wr.open_operations);
    const setupHold=Boolean(setup&&setup.award_setup_applies&&!setup.job_ready);
    const reasons:string[]=[];
    if(setupHold)reasons.push(setup.readiness_reason||'Job setup is not cleared');
    if(failed)reasons.push(`${failed} operation${failed===1?' has':'s have'} a failed inspection`);
    if(blocked&&ready===0)reasons.push(`${blocked} open operation${blocked===1?' is':'s are'} on hold`);
    if(overdue>0)reasons.push(`${money(overdue)} customer balance is past due`);
    if(laborRemaining<0)reasons.push(`Labor is ${Math.abs(laborRemaining).toFixed(1)} MH over budget`);
    if(budgetUsed>=100)reasons.push('Job cost has reached or exceeded budget');
    if(field.gps)reasons.push(`${field.gps} GPS exception${field.gps===1?'':'s'} need review`);
    if(field.waiting)reasons.push(`${field.waiting} timecard${field.waiting===1?'':'s'} waiting approval`);
    const hardHold=Boolean(setupHold||failed||(blocked&&ready===0));
    const attention=hardHold||overdue>0||laborRemaining<0||budgetUsed>=100||field.gps>0||field.waiting>0;
    const state:JobsBoardRow['state']=j.status==='completed'?'completed':hardHold?'hold':ready>0?'ready':openOps>0?'planning':j.status==='on_hold'?'hold':'setup';
    const nextStep=hardHold?(reasons[0]||'Clear hold before work starts'):next?.title||j.next_action||(ready>0?'Choose and schedule the next ready work package':'Build the next Work Package / schedule');
    return{id:j.id,jobNumber:j.job_number||null,name:j.name||'Unnamed job',customer:j.customers?.name||'Customer not linked',location:[j.address,j.city,j.state].filter(Boolean).join(', ')||'Address not entered',projectStatus:String(j.status||'active'),state,nextStep,scheduleDate:next?.schedule_date?String(next.schedule_date).slice(0,10):null,contractValue:num(j.contract_value),budgetUsed,laborRemaining,budgetAvailable:Boolean(b.project_id),customerOwed:num(bill.outstanding_ar),overdue,billingAvailable:Boolean(bill.project_id),readyOperations:ready,blockedOperations:blocked,openOperations:openOps,activeShifts:field.clocked,pendingTimecards:field.waiting,gpsExceptions:field.gps,reasons,attention,setupHold};
  });

  const activeRows=rows.filter(row=>row.state!=='completed');
  const metrics:JobsBoardMetrics={
    ready:activeRows.filter(row=>row.state==='ready').length,
    holds:activeRows.filter(row=>row.state==='hold').length,
    attention:activeRows.filter(row=>row.attention).length,
    fieldJobs:activeRows.filter(row=>row.activeShifts>0).length,
    activeShifts:activeRows.reduce((sum,row)=>sum+row.activeShifts,0),
    customersOwe:(billing||[]).reduce((sum:number,x:any)=>sum+Math.max(0,num(x.outstanding_ar)),0),
    overdue:(billing||[]).reduce((sum:number,x:any)=>sum+Math.max(0,num(x.overdue_ar)),0),
  };

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Projects</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">See which jobs can move, what starts next, and what is holding the field before labor or cash gets burned.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/schedule" className={buttonVariants({variant:'outline',size:'sm'})}><CalendarDays/>Schedule</Link>
          <Dialog>
            <DialogTrigger render={<Button size="sm"/>}><Plus/>New direct job</DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader><DialogTitle>Create direct job</DialogTitle><DialogDescription>Direct-job exception only. Accepted proposals create jobs automatically.</DialogDescription></DialogHeader>
              <form action={createProject} className="grid gap-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground"><strong className="text-foreground">Use this only for emergency/direct work.</strong> Normal awarded work should come through the accepted proposal workflow.</div>
                <div className="grid gap-2"><Label htmlFor="direct-name">Customer / job</Label><Input id="direct-name" name="name" required placeholder="Smith Residence · emergency slab repair"/></div>
                <div className="grid gap-2"><Label htmlFor="direct-address">Address</Label><Input id="direct-address" name="address"/></div>
                <div className="grid gap-3 sm:grid-cols-3"><div className="grid gap-2"><Label htmlFor="direct-city">City</Label><Input id="direct-city" name="city"/></div><div className="grid gap-2"><Label htmlFor="direct-state">State</Label><Input id="direct-state" name="state" defaultValue="WA"/></div><div className="grid gap-2"><Label htmlFor="direct-contract">Contract amount</Label><Input id="direct-contract" name="contract_value" inputMode="decimal"/></div></div>
                <div className="grid gap-2"><Label htmlFor="direct-next">Next physical action</Label><Input id="direct-next" name="next_action" placeholder="Layout and form driveway"/></div>
                <div className="flex justify-end"><Button type="submit">Create direct job</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <JobsOperationsBoard rows={rows} metrics={metrics}/>
    </div>
  </AppShell>;
}
