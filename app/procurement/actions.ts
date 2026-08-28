'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id)throw new Error('Company profile missing');
  return {supabase,user,companyId:profile.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const txt=(v:FormDataEntryValue|null)=>String(v||'').trim()||null;
async function resetProjectPours(supabase:any,companyId:string,projectId:string){
  await supabase.from('pour_plans').update({status:'planning',updated_at:new Date().toISOString()}).eq('company_id',companyId).eq('project_id',projectId).in('status',['authorized','hold']);
}

export async function createVendor(fd:FormData){
  const name=String(fd.get('name')||'').trim();if(!name)return;
  const {supabase,companyId}=await ctx();
  const {error}=await supabase.from('vendors').insert({company_id:companyId,name,vendor_type:String(fd.get('vendor_type')||'other'),contact_name:txt(fd.get('contact_name')),email:txt(fd.get('email')),phone:txt(fd.get('phone')),address_line1:txt(fd.get('address_line1')),address_line2:txt(fd.get('address_line2')),city:txt(fd.get('city')),state:txt(fd.get('state')),postal_code:txt(fd.get('postal_code')),payment_terms:txt(fd.get('payment_terms')),account_number:txt(fd.get('account_number')),notes:txt(fd.get('notes'))});
  if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function createVendorQuote(fd:FormData){
  const projectId=String(fd.get('project_id')||''),vendorId=String(fd.get('vendor_id')||'');if(!projectId||!vendorId)return;
  const {supabase,user,companyId}=await ctx();
  const {data:number,error:numberError}=await supabase.rpc('next_company_document_number',{p_document_type:'procurement_quote'});if(numberError)throw new Error(numberError.message);
  const {error}=await supabase.from('vendor_quotes').insert({company_id:companyId,project_id:projectId,vendor_id:vendorId,internal_quote_number:number,vendor_quote_number:txt(fd.get('vendor_quote_number')),quote_date:String(fd.get('quote_date')||new Date().toISOString().slice(0,10)),expires_on:txt(fd.get('expires_on')),budget_section_id:txt(fd.get('budget_section_id')),change_order_id:txt(fd.get('change_order_id')),pour_plan_id:txt(fd.get('pour_plan_id')),notes:txt(fd.get('notes')),created_by:user.id});
  if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function addVendorQuoteLine(fd:FormData){
  const quoteId=String(fd.get('vendor_quote_id')||''),description=String(fd.get('description')||'').trim(),costCodeId=String(fd.get('cost_code_id')||'');if(!quoteId||!description||!costCodeId)return;
  const {supabase,companyId}=await ctx();
  const {data:q}=await supabase.from('vendor_quotes').select('status').eq('id',quoteId).eq('company_id',companyId).maybeSingle();if(!q||q.status!=='received')throw new Error('Only received quotes can be edited.');
  const quantity=Math.max(0,n(fd.get('quantity'))),unitCost=Math.max(0,n(fd.get('unit_cost'))),subtotal=r(quantity*unitCost),salesTax=Math.max(0,n(fd.get('sales_tax')));
  const {error}=await supabase.from('vendor_quote_lines').insert({company_id:companyId,vendor_quote_id:quoteId,cost_code_id:costCodeId,catalog_item_id:txt(fd.get('catalog_item_id')),pour_cost_item_id:txt(fd.get('pour_cost_item_id')),description,quantity,unit:String(fd.get('unit')||'EA'),unit_cost:unitCost,subtotal,sales_tax:salesTax,total_cost:r(subtotal+salesTax),notes:txt(fd.get('notes')),sort_order:Date.now()%1000000});
  if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function deleteVendorQuoteLine(fd:FormData){
  const lineId=String(fd.get('line_id')||''),quoteId=String(fd.get('vendor_quote_id')||'');if(!lineId||!quoteId)return;const {supabase,companyId}=await ctx();
  const {data:q}=await supabase.from('vendor_quotes').select('status').eq('id',quoteId).eq('company_id',companyId).maybeSingle();if(!q||q.status!=='received')throw new Error('Quote is locked.');
  await supabase.from('vendor_quote_lines').delete().eq('id',lineId).eq('company_id',companyId).eq('vendor_quote_id',quoteId);revalidatePath('/procurement');
}

export async function setVendorQuoteStatus(fd:FormData){
  const id=String(fd.get('vendor_quote_id')||''),status=String(fd.get('status')||'');if(!id||!['accepted','rejected'].includes(status))return;const {supabase,companyId}=await ctx();
  const {error}=await supabase.from('vendor_quotes').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId).eq('status','received');if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function convertQuoteToPurchaseOrder(fd:FormData){
  const id=String(fd.get('vendor_quote_id')||'');if(!id)return;const {supabase}=await ctx();const {error}=await supabase.rpc('convert_vendor_quote_to_purchase_order',{p_quote_id:id});if(error)throw new Error(error.message);revalidatePath('/procurement');revalidatePath('/pour-control');
}

export async function createPurchaseOrder(fd:FormData){
  const projectId=String(fd.get('project_id')||''),vendorId=String(fd.get('vendor_id')||'');if(!projectId||!vendorId)return;
  const {supabase,user,companyId}=await ctx();const {data:number,error:numberError}=await supabase.rpc('next_company_document_number',{p_document_type:'purchase_order'});if(numberError)throw new Error(numberError.message);
  const {error}=await supabase.from('purchase_orders').insert({company_id:companyId,project_id:projectId,vendor_id:vendorId,po_number:number,status:'draft',expected_delivery_date:txt(fd.get('expected_delivery_date')),budget_section_id:txt(fd.get('budget_section_id')),change_order_id:txt(fd.get('change_order_id')),pour_plan_id:txt(fd.get('pour_plan_id')),delivery_instructions:txt(fd.get('delivery_instructions')),terms:txt(fd.get('terms')),notes:txt(fd.get('notes')),created_by:user.id});
  if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function addPurchaseOrderLine(fd:FormData){
  const poId=String(fd.get('purchase_order_id')||''),description=String(fd.get('description')||'').trim(),costCodeId=String(fd.get('cost_code_id')||'');if(!poId||!description||!costCodeId)return;
  const {supabase,companyId}=await ctx();const {data:po}=await supabase.from('purchase_orders').select('project_id,status,pour_plan_id,budget_section_id,change_order_id').eq('id',poId).eq('company_id',companyId).maybeSingle();if(!po||po.status!=='draft')throw new Error('Only draft POs can be edited.');
  const pourCostItemId=txt(fd.get('pour_cost_item_id'));let pourPlanId=txt(fd.get('pour_plan_id'))||po.pour_plan_id;
  if(pourCostItemId){const {data:item}=await supabase.from('pour_cost_items').select('pour_plan_id').eq('id',pourCostItemId).eq('company_id',companyId).maybeSingle();if(!item)throw new Error('Pour cost item not found.');pourPlanId=item.pour_plan_id;}
  const quantity=Math.max(0,n(fd.get('quantity'))),unitCost=Math.max(0,n(fd.get('unit_cost'))),subtotal=r(quantity*unitCost),salesTax=Math.max(0,n(fd.get('sales_tax')));
  const {error}=await supabase.from('purchase_order_lines').insert({company_id:companyId,purchase_order_id:poId,cost_code_id:costCodeId,catalog_item_id:txt(fd.get('catalog_item_id')),pour_plan_id:pourPlanId,pour_cost_item_id:pourCostItemId,budget_section_id:txt(fd.get('budget_section_id'))||po.budget_section_id,change_order_id:txt(fd.get('change_order_id'))||po.change_order_id,description,quantity,unit:String(fd.get('unit')||'EA'),unit_cost:unitCost,subtotal,sales_tax:salesTax,total_cost:r(subtotal+salesTax),notes:txt(fd.get('notes')),sort_order:Date.now()%1000000});if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function deletePurchaseOrderLine(fd:FormData){
  const poId=String(fd.get('purchase_order_id')||''),lineId=String(fd.get('line_id')||'');if(!poId||!lineId)return;const {supabase,companyId}=await ctx();const {data:po}=await supabase.from('purchase_orders').select('status').eq('id',poId).eq('company_id',companyId).maybeSingle();if(!po||po.status!=='draft')throw new Error('PO is locked.');await supabase.from('purchase_order_lines').delete().eq('id',lineId).eq('company_id',companyId);revalidatePath('/procurement');
}

export async function issuePurchaseOrder(fd:FormData){
  const id=String(fd.get('purchase_order_id')||'');if(!id)return;const {supabase}=await ctx();const {error}=await supabase.rpc('issue_purchase_order',{p_po_id:id,p_issue_date:String(fd.get('issue_date')||new Date().toISOString().slice(0,10))});if(error)throw new Error(error.message);revalidatePath('/procurement');revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function closePurchaseOrder(fd:FormData){
  const id=String(fd.get('purchase_order_id')||''),status=String(fd.get('status')||'closed');if(!id||!['closed','cancelled'].includes(status))return;const {supabase,companyId}=await ctx();
  const {data:po}=await supabase.from('purchase_order_financial_summary').select('project_id,status,actual_cost').eq('purchase_order_id',id).eq('company_id',companyId).maybeSingle();if(!po)throw new Error('PO not found.');if(status==='cancelled'&&Number(po.actual_cost||0)>0)throw new Error('A PO with actual vendor costs cannot be cancelled; close it instead.');if(!['draft','issued'].includes(po.status))throw new Error('PO is already closed.');
  const {error}=await supabase.from('purchase_orders').update({status,closed_at:status==='closed'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);if(error)throw new Error(error.message);await resetProjectPours(supabase,companyId,po.project_id);revalidatePath('/procurement');revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function recordPurchaseOrderReceipt(fd:FormData){
  const poId=String(fd.get('purchase_order_id')||''),lineId=String(fd.get('purchase_order_line_id')||'');const qty=Math.max(0,n(fd.get('quantity_received')));if(!poId||!lineId||qty<=0)return;const {supabase,user,companyId}=await ctx();
  const {data:po}=await supabase.from('purchase_orders').select('status').eq('id',poId).eq('company_id',companyId).maybeSingle();if(!po||po.status!=='issued')throw new Error('Only issued POs can receive deliveries.');
  const {error}=await supabase.from('purchase_order_receipts').insert({company_id:companyId,purchase_order_id:poId,purchase_order_line_id:lineId,received_date:String(fd.get('received_date')||new Date().toISOString().slice(0,10)),quantity_received:qty,delivery_ticket:txt(fd.get('delivery_ticket')),notes:txt(fd.get('notes')),received_by:user.id});if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function createVendorBill(fd:FormData){
  let projectId=String(fd.get('project_id')||''),vendorId=String(fd.get('vendor_id')||'');const poId=txt(fd.get('purchase_order_id'));const billNumber=String(fd.get('vendor_bill_number')||'').trim();if(!billNumber)return;
  const {supabase,user,companyId}=await ctx();if(poId){const {data:po}=await supabase.from('purchase_orders').select('project_id,vendor_id,status').eq('id',poId).eq('company_id',companyId).maybeSingle();if(!po||!['issued','closed'].includes(po.status))throw new Error('Vendor bills can only be entered against an issued or closed PO.');projectId=po.project_id;vendorId=po.vendor_id;}
  if(!projectId||!vendorId)throw new Error('Project and vendor are required.');
  const {error}=await supabase.from('vendor_bills').insert({company_id:companyId,project_id:projectId,vendor_id:vendorId,purchase_order_id:poId,vendor_bill_number:billNumber,bill_date:String(fd.get('bill_date')||new Date().toISOString().slice(0,10)),due_date:txt(fd.get('due_date')),notes:txt(fd.get('notes')),created_by:user.id});if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function addVendorBillLine(fd:FormData){
  const billId=String(fd.get('vendor_bill_id')||''),descriptionInput=String(fd.get('description')||'').trim();if(!billId)return;const {supabase,companyId}=await ctx();
  const {data:bill}=await supabase.from('vendor_bills').select('project_id,purchase_order_id,status').eq('id',billId).eq('company_id',companyId).maybeSingle();if(!bill||bill.status!=='draft')throw new Error('Only draft vendor bills can be edited.');
  const poLineId=txt(fd.get('purchase_order_line_id'));let costCodeId=String(fd.get('cost_code_id')||''),catalogItemId=txt(fd.get('catalog_item_id')),budgetSectionId=txt(fd.get('budget_section_id')),changeOrderId=txt(fd.get('change_order_id')),pourPlanId=txt(fd.get('pour_plan_id')),pourCostItemId=txt(fd.get('pour_cost_item_id')),description=descriptionInput,unit=String(fd.get('unit')||'EA');
  if(poLineId){const {data:l}=await supabase.from('purchase_order_lines').select('*').eq('id',poLineId).eq('company_id',companyId).maybeSingle();if(!l)throw new Error('PO line not found.');costCodeId=l.cost_code_id;catalogItemId=l.catalog_item_id;budgetSectionId=l.budget_section_id;changeOrderId=l.change_order_id;pourPlanId=l.pour_plan_id;pourCostItemId=l.pour_cost_item_id;description=description||l.description;unit=String(fd.get('unit')||l.unit||'EA');}
  if(!costCodeId||!description)throw new Error('Cost code and description are required.');
  const quantity=Math.max(0,n(fd.get('quantity'))),unitCost=Math.max(0,n(fd.get('unit_cost'))),subtotal=r(quantity*unitCost),salesTax=Math.max(0,n(fd.get('sales_tax')));
  const {error}=await supabase.from('vendor_bill_lines').insert({company_id:companyId,vendor_bill_id:billId,purchase_order_line_id:poLineId,cost_code_id:costCodeId,catalog_item_id:catalogItemId,budget_section_id:budgetSectionId,change_order_id:changeOrderId,pour_plan_id:pourPlanId,pour_cost_item_id:pourCostItemId,description,quantity,unit,unit_cost:unitCost,subtotal,sales_tax:salesTax,total_cost:r(subtotal+salesTax),notes:txt(fd.get('notes')),sort_order:Date.now()%1000000});if(error)throw new Error(error.message);revalidatePath('/procurement');
}

export async function deleteVendorBillLine(fd:FormData){
  const billId=String(fd.get('vendor_bill_id')||''),lineId=String(fd.get('line_id')||'');if(!billId||!lineId)return;const {supabase,companyId}=await ctx();const {data:b}=await supabase.from('vendor_bills').select('status').eq('id',billId).eq('company_id',companyId).maybeSingle();if(!b||b.status!=='draft')throw new Error('Bill is locked.');await supabase.from('vendor_bill_lines').delete().eq('id',lineId).eq('company_id',companyId);revalidatePath('/procurement');
}

export async function postVendorBill(fd:FormData){
  const id=String(fd.get('vendor_bill_id')||'');if(!id)return;const {supabase}=await ctx();const {error}=await supabase.rpc('post_vendor_bill',{p_bill_id:id});if(error)throw new Error(error.message);revalidatePath('/procurement');revalidatePath('/costs');revalidatePath('/projects');revalidatePath('/forecast');revalidatePath('/pour-control');
}

export async function voidVendorBill(fd:FormData){
  const id=String(fd.get('vendor_bill_id')||'');if(!id)return;const {supabase,companyId}=await ctx();const {error}=await supabase.from('vendor_bills').update({status:'void',updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId).eq('status','draft');if(error)throw new Error(error.message);revalidatePath('/procurement');
}
