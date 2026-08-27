import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { updateOverheadItem, updateOverheadPlan } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const annualize=(item:any)=>{
  const amount=num(item.amount);const use=num(item.business_use_percent)/100;
  const factor=item.frequency==='weekly'?52:item.frequency==='quarterly'?4:item.frequency==='annual'?1:12;
  return item.active===false?0:amount*factor*use;
};

export default async function OverheadPage(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).maybeSingle();
  if(!profile?.company_id)redirect('/settings');
  const [{data:company},{data:items}]=await Promise.all([
    supabase.from('companies').select('target_margin_percent,planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate').eq('id',profile.company_id).single(),
    supabase.from('overhead_items').select('*').eq('company_id',profile.company_id).order('sort_order')
  ]);
  const regularAnnual=(items||[]).reduce((s,i)=>s+annualize(i),0);
  const ownerFieldValue=num(company?.owner_planned_field_hours_annual)*num(company?.owner_field_rate);
  const ownerMgmt=Math.max(0,num(company?.owner_compensation_target_annual)-ownerFieldValue);
  const totalAnnual=regularAnnual+ownerMgmt;
  const totalMonthly=totalAnnual/12;
  const productive=num(company?.planned_productive_hours_annual);
  const ohPerHour=productive>0?totalAnnual/productive:0;
  const scenarios=[1600,2160,3000,4000,5000];
  const grouped=new Map<string,any[]>();for(const item of items||[]){const arr=grouped.get(item.category)||[];arr.push(item);grouped.set(item.category,arr);}

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <h1 className="page-title">Overhead</h1><p className="subtitle">What Carez must recover before profit. Direct labor and direct job costs are intentionally excluded.</p>
    <div className="grid grid4">
      <div className="card"><div className="label">Annual Overhead</div><div className="value">{money(totalAnnual)}</div></div>
      <div className="card"><div className="label">Monthly Requirement</div><div className="value">{money(totalMonthly)}</div></div>
      <div className="card"><div className="label">Planned Productive Hours</div><div className="value">{productive.toFixed(0)}</div></div>
      <div className="card"><div className="label">OH / Productive Hr</div><div className="value">{money(ohPerHour)}</div></div>
    </div>

    <div className="alert warn section"><strong>Planning model:</strong> owner management overhead is calculated as annual owner compensation target minus planned owner field labor value. Owner field labor remains a direct project cost.</div>

    <div className="split section">
      <div className="card"><div className="title">Owner & Pricing Plan</div><form action={updateOverheadPlan} className="form" style={{marginTop:12}}>
        <div className="grid grid2"><label className="field"><span>Target Margin %</span><input name="target_margin_percent" type="number" min="0" max="80" step="0.1" defaultValue={num(company?.target_margin_percent)}/></label><label className="field"><span>Planned Productive Hours / Year</span><input name="planned_productive_hours_annual" type="number" min="1" step="1" defaultValue={productive}/></label></div>
        <div className="grid grid2"><label className="field"><span>Owner Compensation Target / Year</span><input name="owner_compensation_target_annual" type="number" min="0" step="100" defaultValue={num(company?.owner_compensation_target_annual)}/></label><label className="field"><span>Owner Field Internal Rate / Hr</span><input name="owner_field_rate" type="number" min="0" step="0.01" defaultValue={num(company?.owner_field_rate)}/></label></div>
        <label className="field"><span>Planned Owner Field Hours / Year</span><input name="owner_planned_field_hours_annual" type="number" min="0" step="1" defaultValue={num(company?.owner_planned_field_hours_annual)}/></label>
        <button className="button">Save Overhead Plan</button>
      </form>
      <div className="list section"><div className="row"><span>Non-owner company + fleet overhead</span><strong>{money(regularAnnual)}</strong></div><div className="row"><span>Owner field labor value (direct cost)</span><strong>{money(ownerFieldValue)}</strong></div><div className="row"><span>Owner management allowance (overhead)</span><strong>{money(ownerMgmt)}</strong></div><div className="row"><span>Total annual overhead</span><strong>{money(totalAnnual)}</strong></div></div>
      </div>
      <div className="card"><div className="title">Capacity Scenarios</div><p className="subtitle">Same overhead spread across different levels of productive field hours.</p><div className="list">{scenarios.map(h=><div className="row" key={h}><span>{h.toLocaleString()} productive hr/year{h===2160?' · Base':''}</span><strong>{money(totalAnnual/h)}/hr</strong></div>)}</div></div>
    </div>

    <div className="card section"><div className="title">Overhead Items</div><p className="subtitle">Edit the amount or business-use percentage when a real cost changes. Annualized values update automatically.</p></div>
    {[...grouped.entries()].map(([category,rows])=><div className="card section" key={category}><div className="title">{category}</div><div className="list">{rows.map((i:any)=><form action={updateOverheadItem} className="row" key={i.id} style={{alignItems:'end'}}><input type="hidden" name="id" value={i.id}/><div style={{flex:1}}><div className="title">{i.name}</div><div className="meta">{i.frequency} · {i.item_type} · annualized {money(annualize(i))}</div></div><label className="field" style={{width:120}}><span>Amount</span><input name="amount" type="number" step="0.01" min="0" defaultValue={num(i.amount)}/></label><label className="field" style={{width:110}}><span>Business %</span><input name="business_use_percent" type="number" step="1" min="0" max="100" defaultValue={num(i.business_use_percent)}/></label><label className="field" style={{width:65}}><span>Active</span><input name="active" type="checkbox" defaultChecked={i.active}/></label><button className="button secondary">Save</button></form>)}</div></div>)}
  </AppShell>;
}
