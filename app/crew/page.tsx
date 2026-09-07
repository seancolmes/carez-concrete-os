import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/server';
import { changeCrewRate, createCrewMember, updateCrewMember } from './actions';

const today=()=>new Date().toISOString().slice(0,10);
const skills=['Formwork','Rebar','Placement','Flatwork','Broom Finish','V-Groove','China Trowel','Hard Trowel','Walls','Foundations','Curb / Gutter','Sawcutting','Layout'];
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';
const checkboxClass='size-4 rounded border-input accent-primary';

export default async function CrewPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).maybeSingle();
 if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
 const [{data:crew},{data:rates},{data:riskClasses}]=await Promise.all([
  supabase.from('crew_members').select('*').eq('company_id',profile.company_id).order('active',{ascending:false}).order('name'),
  supabase.from('crew_rate_history').select('*').eq('company_id',profile.company_id).order('effective_date',{ascending:false}),
  supabase.from('li_risk_classes').select('code,name').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code')
 ]);
 const rateMap=new Map<string,any[]>();for(const r of rates||[]){const a=rateMap.get(r.crew_member_id)||[];a.push(r);rateMap.set(r.crew_member_id,a);}
 const active=(crew||[]).filter(c=>c.active).length;
 const onCall=(crew||[]).filter(c=>c.active&&c.availability_type==='on_call').length;
 const w2=(crew||[]).filter(c=>c.active&&c.worker_type==='employee').length;

 return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Crew control</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Crew</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Workers, labor rates, field access and skills. Production quantities come from work packages, not daily math assigned to employees.</p></header><div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline'})} href="/production/work-packages">Work Packages</Link><Link className={buttonVariants({variant:'outline'})} href="/crew/access">Employee Access</Link></div></div>

  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Active Crew</div><div className="text-2xl font-semibold tabular-nums">{active}</div></CardContent></Card>
   <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">W-2 Employees</div><div className="text-2xl font-semibold tabular-nums">{w2}</div></CardContent></Card>
   <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">On-Call Bench</div><div className="text-2xl font-semibold tabular-nums">{onCall}</div></CardContent></Card>
   <Card size="sm"><CardContent className="h-full space-y-1 text-success"><div className="text-xs font-medium text-muted-foreground">Field Data Rule</div><div className="text-2xl font-semibold">Simple</div><div className="text-xs text-muted-foreground">Employees identify work and confirm completion. Carez owns the quantities and math.</div></CardContent></Card>
  </div>

  <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Add Crew Member</h2><p className="mt-1 text-sm text-muted-foreground">Employees should never need cost codes or production calculations to submit clean field time.</p></div>
   <form action={createCrewMember} className="grid gap-4">
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="crew-name">Name</Label><Input id="crew-name" name="name" required placeholder="John Smith"/></div><div className="grid gap-2"><Label htmlFor="crew-role">Role</Label><Input id="crew-role" name="role" required placeholder="Concrete Finisher"/></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="crew-worker-type">Worker Type</Label><select id="crew-worker-type" className={selectClass} name="worker_type" defaultValue="employee"><option value="employee">W-2 Employee</option><option value="owner">Owner</option><option value="subcontractor">Subcontractor</option></select></div><div className="grid gap-2"><Label htmlFor="crew-availability">Availability</Label><select id="crew-availability" className={selectClass} name="availability_type" defaultValue="regular"><option value="regular">Regular</option><option value="on_call">On-call</option></select></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="crew-hourly-rate">Base Wage / Hourly Rate</Label><Input id="crew-hourly-rate" name="hourly_rate" type="number" step="0.01" min="0" placeholder="30.00"/></div><div className="grid gap-2"><Label htmlFor="crew-owner-rate">Owner Internal Field Rate</Label><Input id="crew-owner-rate" name="internal_field_rate" type="number" step="0.01" min="0" placeholder="50.00"/></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="crew-risk">Default L&amp;I Class</Label><select id="crew-risk" className={selectClass} name="default_risk_class_code" defaultValue="0217-01"><option value="">None / review required</option>{(riskClasses||[]).map((r:any)=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="crew-start-date">Start Date</Label><Input id="crew-start-date" name="start_date" type="date" defaultValue={today()}/></div></div>
    <div className="grid gap-2"><Label htmlFor="crew-phone">Phone</Label><Input id="crew-phone" name="phone" inputMode="tel" placeholder="253-555-0123"/></div>
    <fieldset className="grid gap-2"><legend className="text-sm font-medium">Skills</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{skills.map(s=><label key={s} className="flex items-center gap-2 text-sm text-muted-foreground"><input className={checkboxClass} type="checkbox" name="skills" value={s}/>{s}</label>)}</div></fieldset>
    <Button type="submit" className="w-fit">Add Crew Member</Button>
   </form>
  </CardContent></Card>

  <section className="space-y-4" aria-labelledby="crew-members"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Roster</div><h2 id="crew-members" className="mt-1 text-lg font-semibold">Crew Members</h2></div>
   {(crew||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No crew members yet</EmptyTitle><EmptyDescription>Add the first worker above.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(crew||[]).map(c=>{const history=rateMap.get(c.id)||[];return <Card key={c.id}><header className="flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{c.name}</h3><p className="mt-1 text-sm text-muted-foreground">{c.role} · {c.worker_type==='employee'?'W-2 employee':c.worker_type} · {c.availability_type.replace('_',' ')}</p></div><Badge variant="outline" className={c.active?'border-success/30 bg-success/10 text-success':'text-muted-foreground'}>{c.active?'Active':'Inactive'}</Badge></header><CardContent className="space-y-5">
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Current Rate</div><div className="mt-1 font-semibold tabular-nums">{money(Number(c.is_owner?c.internal_field_rate:c.hourly_rate||0))}/hr</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Default L&amp;I</div><div className="mt-1 font-semibold">{c.is_owner?'Owner':(c.default_risk_class_code||'Review')}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Phone</div><div className="mt-1 font-semibold">{c.phone||'—'}</div></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Skills</div><div className="mt-1 font-semibold tabular-nums">{(c.skills||[]).length}</div></div></div>
   {(c.skills||[]).length>0&&<div className="text-sm text-muted-foreground">{(c.skills||[]).join(' · ')}</div>}

   <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Edit Worker</summary><div className="border-t border-border p-3"><form action={updateCrewMember} className="grid gap-4"><input type="hidden" name="id" value={c.id}/>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`crew-edit-name-${c.id}`}>Name</Label><Input id={`crew-edit-name-${c.id}`} name="name" defaultValue={c.name}/></div><div className="grid gap-2"><Label htmlFor={`crew-edit-role-${c.id}`}>Role</Label><Input id={`crew-edit-role-${c.id}`} name="role" defaultValue={c.role}/></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`crew-edit-type-${c.id}`}>Worker Type</Label><select id={`crew-edit-type-${c.id}`} className={selectClass} name="worker_type" defaultValue={c.worker_type}><option value="employee">W-2 Employee</option><option value="owner">Owner</option><option value="subcontractor">Subcontractor</option></select></div><div className="grid gap-2"><Label htmlFor={`crew-edit-availability-${c.id}`}>Availability</Label><select id={`crew-edit-availability-${c.id}`} className={selectClass} name="availability_type" defaultValue={c.availability_type}><option value="regular">Regular</option><option value="on_call">On-call</option></select></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`crew-edit-hourly-${c.id}`}>Current Hourly Rate</Label><Input id={`crew-edit-hourly-${c.id}`} name="hourly_rate" type="number" step="0.01" defaultValue={Number(c.hourly_rate||0)}/></div><div className="grid gap-2"><Label htmlFor={`crew-edit-owner-rate-${c.id}`}>Owner Internal Rate</Label><Input id={`crew-edit-owner-rate-${c.id}`} name="internal_field_rate" type="number" step="0.01" defaultValue={Number(c.internal_field_rate||0)}/></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`crew-edit-risk-${c.id}`}>Default L&amp;I</Label><select id={`crew-edit-risk-${c.id}`} className={selectClass} name="default_risk_class_code" defaultValue={c.default_risk_class_code||''}><option value="">None / review required</option>{(riskClasses||[]).map((r:any)=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor={`crew-edit-start-${c.id}`}>Start Date</Label><Input id={`crew-edit-start-${c.id}`} name="start_date" type="date" defaultValue={c.start_date||''}/></div></div>
    <div className="grid gap-2"><Label htmlFor={`crew-edit-phone-${c.id}`}>Phone</Label><Input id={`crew-edit-phone-${c.id}`} name="phone" defaultValue={c.phone||''}/></div>
    <fieldset className="grid gap-2"><legend className="text-sm font-medium">Skills</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{skills.map(s=><label key={s} className="flex items-center gap-2 text-sm text-muted-foreground"><input className={checkboxClass} type="checkbox" name="skills" value={s} defaultChecked={(c.skills||[]).includes(s)}/>{s}</label>)}</div></fieldset>
    <label className="flex items-center gap-2 text-sm"><input className={checkboxClass} type="checkbox" name="active" defaultChecked={c.active}/>Active / available for field entry</label><Button type="submit" variant="outline" className="w-fit">Save Worker</Button>
   </form></div></details>

   <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Change Rate / Rate History</summary><div className="space-y-4 border-t border-border p-3"><form action={changeCrewRate} className="grid gap-4"><input type="hidden" name="id" value={c.id}/><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`crew-rate-${c.id}`}>New Rate</Label><Input id={`crew-rate-${c.id}`} name="amount" type="number" min="0" step="0.01" required placeholder="35.00"/></div><div className="grid gap-2"><Label htmlFor={`crew-rate-date-${c.id}`}>Effective Date</Label><Input id={`crew-rate-date-${c.id}`} name="effective_date" type="date" defaultValue={today()} required/></div></div><Button type="submit" variant="outline" className="w-fit">Save New Rate</Button></form>
    <div className="divide-y rounded-lg border border-border">{history.length===0?<div className="px-3 py-4 text-sm text-muted-foreground">No history yet.</div>:history.map(r=><div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={r.id}><div><div className="font-medium tabular-nums">{money(Number(r.amount))}/hr</div><div className="mt-1 text-xs text-muted-foreground">Effective {r.effective_date}{r.end_date?` through ${r.end_date}`:' · current'}</div></div><Badge variant="outline" className="text-muted-foreground">{r.rate_type.replaceAll('_',' ')}</Badge></div>)}</div>
   </div></details>
  </CardContent></Card>})}</div>}
  </section>
 </div></AppShell>;
}
