'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');return {supabase,user,companyId:p.company_id};}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const BO_RATE_PERCENT={retailing:0.471,wholesaling:0.484} as const;
type BoClassification=keyof typeof BO_RATE_PERCENT;
async function assertEstimateEditable(supabase:any,companyId:string,estimateId:string){const {data:e}=await supabase.from('estimates').select('id,status').eq('id',estimateId).eq('company_id',companyId).maybeSingle();if(!e)throw new Error('Estimate not found.');if(['accepted','approved','superseded'].includes(e.status))throw new Error('This estimate revision is locked.');const {count}=await supabase.from('proposal_presentations').select('id',{count:'exact',head:true}).eq('company_id',companyId).eq('estimate_id',estimateId);if((count||0)>0)throw new Error('This estimate revision was already issued to a customer. Create the next proposal revision before changing price or scope.');}

export async function createEstimate(fd:FormData){const {supabase,user,companyId}=await ctx();const project_id=String(fd.get('project_id')||'')||null;const requestedName=String(fd.get('name')||'').trim();const [{data:snapshot},{data:project}]=await Promise.all([supabase.rpc('capture_overhead_rate_snapshot',{p_effective_date:new Date().toISOString().slice(0,10)}),project_id?supabase.from('projects').select('job_number,name').eq('id',project_id).eq('company_id',companyId).maybeSingle():Promise.resolve({data:null})]);let opportunity=project?.job_number||null;if(!opportunity){const {data:o,error}=await supabase.rpc('next_opportunity_number');if(error||!o)throw new Error(error?.message||'Could not create opportunity number.');opportunity=o;}const name=requestedName||project?.name||`Concrete Opportunity ${opportunity}`,estimate_number=`E-${opportunity}`;const {data:estimate,error}=await supabase.from('estimates').insert({company_id:companyId,project_id,opportunity_number:opportunity,estimate_number,name,overhead_snapshot_id:snapshot?.id||null,overhead_rate_snapshot:Number(snapshot?.overhead_rate_per_productive_hour||0),created_by:user.id}).select('id').single();if(error)throw new Error(error.message);const starter=['Footings','Stem Walls','Slabs / Flatwork'];await supabase.from('estimate_sections').insert(starter.map((s,i)=>({company_id:companyId,estimate_id:estimate.id,name:s,scope_type:s==='Footings'?'footing':s==='Stem Walls'?'wall':'flatwork',sort_order:(i+1)*10})));revalidatePath('/estimates');revalidatePath('/takeoff');}

export async function addEstimateSection(fd:FormData){const estimate_id=String(fd.get('estimate_id')||''),name=String(fd.get('name')||'').trim();if(!estimate_id||!name)return;const {supabase,companyId}=await ctx();await assertEstimateEditable(supabase,companyId,estimate_id);const {error}=await supabase.from('estimate_sections').insert({company_id:companyId,estimate_id,name,scope_type:String(fd.get('scope_type')||'other'),sort_order:Date.now()%1000000});if(error)throw new Error(error.message);revalidatePath('/estimates');revalidatePath('/takeoff');}

export async function addEstimateItem(fd:FormData){const estimate_id=String(fd.get('estimate_id')||''),section_id=String(fd.get('section_id')||'')||null,item_type=String(fd.get('item_type')||'material'),description=String(fd.get('description')||'').trim();if(!estimate_id||!description)return;const {supabase,companyId}=await ctx();await assertEstimateEditable(supabase,companyId,estimate_id);const quantity=n(fd.get('quantity')),unit=String(fd.get('unit')||'LS'),unitCost=n(fd.get('unit_cost'));const crew_member_id=String(fd.get('crew_member_id')||'')||null;const regular=n(fd.get('regular_hours')),ot=n(fd.get('overtime_hours'));let directCost=r(quantity*unitCost),baseRate:null|number=null,ssRate:null|number=null,medRate:null|number=null,futaRate:null|number=null,suiRate:null|number=null,liRate:null|number=null,sickRate:null|number=null;if(item_type==='labor'){if(!crew_member_id)throw new Error('Select a worker for labor.');const [{data:crew},{data:tax},{data:status},{data:risk}]=await Promise.all([supabase.from('crew_members').select('hourly_rate,internal_field_rate,is_owner').eq('id',crew_member_id).eq('company_id',companyId).single(),supabase.from('labor_tax_settings').select('*').eq('company_id',companyId).eq('tax_year',2026).maybeSingle(),supabase.from('employee_tax_status').select('*').eq('company_id',companyId).eq('crew_member_id',crew_member_id).eq('tax_year',2026).maybeSingle(),String(fd.get('risk_class_code')||'')?supabase.from('li_risk_classes').select('*').eq('company_id',companyId).eq('tax_year',2026).eq('code',String(fd.get('risk_class_code'))).maybeSingle():Promise.resolve({data:null})]);if(!crew)throw new Error('Worker not found');const owner=Boolean(crew.is_owner);baseRate=Number(owner?(crew.internal_field_rate??crew.hourly_rate??0):(crew.hourly_rate??0));const gross=regular*baseRate+ot*baseRate*1.5;if(owner){ssRate=0;medRate=0;futaRate=0;suiRate=0;liRate=0;sickRate=0;}else{if(!tax||!risk)throw new Error('Labor tax/L&I settings missing.');ssRate=status?.social_security_cap_reached?0:Number(tax.social_security_rate||0);medRate=Number(tax.medicare_rate||0);futaRate=status?.futa_cap_reached?0:Number(tax.futa_rate||0);suiRate=status?.wa_sui_cap_reached?0:Number(tax.wa_sui_rate||0);liRate=Number(risk.employer_rate_per_hour||0);sickRate=Number(tax.sick_leave_accrual_rate||0);}directCost=r(gross+gross*(ssRate+medRate+futaRate+suiRate)+(regular+ot)*(liRate||0)+(regular+ot)*baseRate*(sickRate||0));}const {error}=await supabase.from('estimate_items').insert({company_id:companyId,estimate_id,section_id,item_type,cost_code_id:String(fd.get('cost_code_id')||'')||null,catalog_item_id:String(fd.get('catalog_item_id')||'')||null,crew_member_id,labor_task:String(fd.get('labor_task')||'')||null,risk_class_code:String(fd.get('risk_class_code')||'')||null,description,quantity:item_type==='labor'?(regular+ot):quantity,unit:item_type==='labor'?'HR':unit,unit_cost:item_type==='labor'?(baseRate||0):unitCost,direct_cost:directCost,regular_hours:regular,overtime_hours:ot,base_hourly_rate_snapshot:baseRate,social_security_rate_snapshot:ssRate,medicare_rate_snapshot:medRate,futa_rate_snapshot:futaRate,wa_sui_rate_snapshot:suiRate,li_employer_rate_snapshot:liRate,sick_leave_accrual_rate_snapshot:sickRate,sort_order:Date.now()%1000000});if(error)throw new Error(error.message);revalidatePath('/estimates');}

export async function updateEstimatePricing(fd:FormData){const id=String(fd.get('estimate_id')||'');if(!id)return;const {supabase,companyId}=await ctx();await assertEstimateEditable(supabase,companyId,id);const requestedStatus=String(fd.get('status')||'draft');if(requestedStatus==='ready'){const {data:takeoff}=await supabase.from('estimate_takeoff_summary').select('active_measurements,missing_price_outputs').eq('estimate_id',id).eq('company_id',companyId).maybeSingle();if(Number(takeoff?.active_measurements||0)>0&&Number(takeoff?.missing_price_outputs||0)>0)throw new Error(`Takeoff has ${takeoff?.missing_price_outputs} unpriced output(s). Resolve current material/equipment/labor pricing before marking this estimate Ready to Send.`);}const bo=String(fd.get('bo_classification')||'retailing') as BoClassification;if(!(bo in BO_RATE_PERCENT))throw new Error('Choose a valid B&O classification.');const {data:current,error:estimateError}=await supabase.from('estimates').select('bo_classification,bo_rate_percent').eq('id',id).eq('company_id',companyId).single();if(estimateError||!current)throw new Error(estimateError?.message||'Estimate pricing snapshot not found.');const currentRate=Number(current.bo_rate_percent);const boRate=bo===current.bo_classification&&Number.isFinite(currentRate)&&currentRate>=0?currentRate:BO_RATE_PERCENT[bo];const {error}=await supabase.from('estimates').update({target_margin_percent:n(fd.get('target_margin_percent')),bo_classification:bo,bo_rate_percent:boRate,payment_processing_rate_percent:n(fd.get('payment_processing_rate_percent')),proposed_sell_price:n(fd.get('proposed_sell_price')),status:requestedStatus}).eq('id',id).eq('company_id',companyId);if(error)throw new Error(error.message);revalidatePath('/estimates');revalidatePath('/proposals');revalidatePath('/takeoff');}

const requiredEstimateNumber=(value:FormDataEntryValue|null,label:string)=>{
  const parsed=Number(String(value??'').replace(/[$,% ,]/g,''));
  if(!Number.isFinite(parsed))throw new Error(`Enter a valid ${label}.`);
  return parsed;
};

export async function updateGeneratedEstimateItemPrice(fd:FormData){
  const estimateId=String(fd.get('estimate_id')||'');
  const outputId=String(fd.get('output_id')||'');
  const unitCost=requiredEstimateNumber(fd.get('unit_cost'),'unit cost');
  if(!estimateId||!outputId||unitCost<0)throw new Error('Enter a valid generated estimate price.');
  const {supabase,companyId}=await ctx();
  await assertEstimateEditable(supabase,companyId,estimateId);
  const {data:output,error:outputError}=await supabase.from('takeoff_measurement_outputs').select('id,measurement_id,generated_estimate_item_id').eq('id',outputId).eq('company_id',companyId).maybeSingle();
  if(outputError||!output)throw new Error(outputError?.message||'Takeoff output not found.');
  const {data:measurement,error:measurementError}=await supabase.from('takeoff_measurements').select('estimate_id').eq('id',output.measurement_id).eq('company_id',companyId).maybeSingle();
  if(measurementError||!measurement||measurement.estimate_id!==estimateId)throw new Error(measurementError?.message||'Takeoff output does not belong to this estimate.');
  const {error}=await supabase.rpc('carez_update_takeoff_output_price',{p_output_id:outputId,p_unit_cost:unitCost});
  if(error)throw new Error(error.message);
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath('/estimates');
  revalidatePath('/takeoff');
}

export async function assignTakeoffMeasurementSection(fd:FormData){
  const estimateId=String(fd.get('estimate_id')||'');
  const measurementId=String(fd.get('measurement_id')||'');
  const sectionId=String(fd.get('section_id')||'')||null;
  if(!estimateId||!measurementId)throw new Error('Takeoff measurement is required.');
  const {supabase,companyId}=await ctx();
  await assertEstimateEditable(supabase,companyId,estimateId);
  const {data:measurement,error:measurementError}=await supabase.from('takeoff_measurements').select('id,estimate_id').eq('id',measurementId).eq('company_id',companyId).maybeSingle();
  if(measurementError||!measurement||measurement.estimate_id!==estimateId)throw new Error(measurementError?.message||'Takeoff measurement does not belong to this estimate.');
  if(sectionId){
    const {data:section,error:sectionError}=await supabase.from('estimate_sections').select('id').eq('id',sectionId).eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle();
    if(sectionError||!section)throw new Error(sectionError?.message||'Estimate scope section not found.');
  }
  const {error}=await supabase.rpc('carez_assign_takeoff_measurement_section',{p_measurement_id:measurementId,p_section_id:sectionId});
  if(error)throw new Error(error.message);
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath('/estimates');
  revalidatePath('/takeoff');
}