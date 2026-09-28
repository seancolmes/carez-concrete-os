import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

async function context(){
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return null;
  const {data:profile}=await db.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!profile?.company_id||profile.role==='employee')return null;
  return {db,companyId:profile.company_id};
}

const failure=(message:string,status:number)=>NextResponse.json({error:message},{status});

export async function GET(request:NextRequest){
  const ctx=await context();if(!ctx)return failure('Access denied',403);
  const page=Math.max(1,Number(request.nextUrl.searchParams.get('page'))||1);
  const size=Math.min(100,Math.max(1,Number(request.nextUrl.searchParams.get('size'))||20));
  const search=(request.nextUrl.searchParams.get('search')||'').trim().slice(0,100);
  const category=request.nextUrl.searchParams.get('category');
  if(category&&category!=='uncategorized'&&!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(category))return failure('Invalid category',400);
  const order=request.nextUrl.searchParams.get('order')==='desc'?false:true;
  let query=ctx.db.from('cost_catalog_items').select('id,name,description,default_unit,default_unit_cost,cost_code_id,category_id,vendor_name,sku,active,cost_codes(code,name)',{count:'exact'}).eq('company_id',ctx.companyId);
  if(search)query=query.ilike('name',`%${search.replace(/[%_]/g,'')}%`);
  if(category==='uncategorized')query=query.is('category_id',null);
  else if(category&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(category))query=query.eq('category_id',category);
  const {data,count,error}=await query.order('name',{ascending:order}).range((page-1)*size,page*size-1);
  if(error?.code==='42703'&&!category){
    let legacy=ctx.db.from('cost_catalog_items').select('id,name,description,default_unit,default_unit_cost,cost_code_id,vendor_name,sku,active,cost_codes(code,name)',{count:'exact'}).eq('company_id',ctx.companyId);
    if(search)legacy=legacy.ilike('name',`%${search.replace(/[%_]/g,'')}%`);
    const old=await legacy.order('name',{ascending:order}).range((page-1)*size,page*size-1);
    if(!old.error)return NextResponse.json({data:(old.data||[]).map(item=>({...item,category_id:null})),total:old.count||0});
  }
  if(error)return failure('Catalog could not be loaded',500);
  return NextResponse.json({data:data||[],total:count||0});
}

export async function POST(request:NextRequest){
  const ctx=await context();if(!ctx)return failure('Access denied',403);
  const body=await request.json().catch(()=>null);
  const name=String(body?.name||'').trim();const costCodeId=String(body?.cost_code_id||'');
  const unit=String(body?.default_unit||'EA').trim();
  const categoryId=String(body?.category_id||'')||null;
  const rawCost=body?.default_unit_cost;
  const cost=rawCost===''||rawCost==null?null:Number(rawCost);
  if(!name||name.length>160||!costCodeId||!unit||unit.length>12||cost!==null&&(!Number.isFinite(cost)||cost<0))return failure('Check the name, cost code, unit and cost',400);
  const {data:code}=await ctx.db.from('cost_codes').select('id').eq('id',costCodeId).eq('company_id',ctx.companyId).eq('active',true).single();
  if(!code)return failure('Choose an active company cost code',400);
  if(categoryId){const {data:category}=await ctx.db.from('cost_catalog_categories').select('id').eq('id',categoryId).eq('company_id',ctx.companyId).single();if(!category)return failure('Choose a company category',400);}
  const payload={company_id:ctx.companyId,cost_code_id:costCodeId,name,description:String(body?.description||'').trim()||null,default_unit:unit,default_unit_cost:cost,vendor_name:String(body?.vendor_name||'').trim()||null,sku:String(body?.sku||'').trim()||null,active:true};
  let {data,error}=await ctx.db.from('cost_catalog_items').insert({...payload,category_id:categoryId}).select('id,name,description,default_unit,default_unit_cost,cost_code_id,category_id,vendor_name,sku,active').single();
  if((error?.code==='42703'||error?.code==='PGRST204')&&!categoryId){const legacy=await ctx.db.from('cost_catalog_items').insert(payload).select('id,name,description,default_unit,default_unit_cost,cost_code_id,vendor_name,sku,active').single();data=legacy.data?{...legacy.data,category_id:null}:null;error=legacy.error;}
  if(error)return failure(error.code==='23505'?'A catalog item with this name already exists':'Catalog item could not be saved',error.code==='23505'?409:500);
  return NextResponse.json({data},{status:201});
}

export async function PATCH(request:NextRequest){
  const ctx=await context();if(!ctx)return failure('Access denied',403);
  const body=await request.json().catch(()=>null);const id=String(body?.id||'');
  const name=String(body?.name||'').trim();const costCodeId=String(body?.cost_code_id||'');const unit=String(body?.default_unit||'').trim();
  const categoryId=String(body?.category_id||'')||null;
  const rawCost=body?.default_unit_cost;const cost=rawCost===''||rawCost==null?null:Number(rawCost);
  if(!id||!name||name.length>160||!costCodeId||!unit||unit.length>12||cost!==null&&(!Number.isFinite(cost)||cost<0))return failure('Check the name, cost code, unit and cost',400);
  const {data:code}=await ctx.db.from('cost_codes').select('id').eq('id',costCodeId).eq('company_id',ctx.companyId).eq('active',true).single();
  if(!code)return failure('Choose an active company cost code',400);
  if(categoryId){const {data:category}=await ctx.db.from('cost_catalog_categories').select('id').eq('id',categoryId).eq('company_id',ctx.companyId).single();if(!category)return failure('Choose a company category',400);}
  const payload={cost_code_id:costCodeId,name,description:String(body?.description||'').trim()||null,default_unit:unit,default_unit_cost:cost,vendor_name:String(body?.vendor_name||'').trim()||null,sku:String(body?.sku||'').trim()||null,active:body?.active!==false,updated_at:new Date().toISOString()};
  let {data,error}=await ctx.db.from('cost_catalog_items').update({...payload,category_id:categoryId}).eq('id',id).eq('company_id',ctx.companyId).select('id,name,description,default_unit,default_unit_cost,cost_code_id,category_id,vendor_name,sku,active').single();
  if((error?.code==='42703'||error?.code==='PGRST204')&&!categoryId){const legacy=await ctx.db.from('cost_catalog_items').update(payload).eq('id',id).eq('company_id',ctx.companyId).select('id,name,description,default_unit,default_unit_cost,cost_code_id,vendor_name,sku,active').single();data=legacy.data?{...legacy.data,category_id:null}:null;error=legacy.error;}
  if(error||!data)return failure(error?.code==='23505'?'A catalog item with this name already exists':'Catalog item could not be updated',error?.code==='23505'?409:500);
  return NextResponse.json({data});
}
