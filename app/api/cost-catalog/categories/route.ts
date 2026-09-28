import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

async function context(){
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();if(!user)return null;
  const {data:profile}=await db.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!profile?.company_id||profile.role==='employee')return null;
  return {db,companyId:profile.company_id};
}
const failure=(message:string,status:number)=>NextResponse.json({error:message},{status});

export async function GET(){
  const ctx=await context();if(!ctx)return failure('Access denied',403);
  const {data,error}=await ctx.db.from('cost_catalog_categories').select('id,name').eq('company_id',ctx.companyId).order('name');
  if(error&&(error.code==='42P01'||error.code==='PGRST205'))return failure('Categories are pending the local database migration',503);
  if(error)return failure('Categories could not be loaded',500);
  return NextResponse.json({data:data||[],total:data?.length||0});
}

export async function POST(request:NextRequest){
  const ctx=await context();if(!ctx)return failure('Access denied',403);
  const body=await request.json().catch(()=>null);const name=String(body?.name||'').trim();
  if(!name||name.length>80)return failure('Enter a category name of 80 characters or fewer',400);
  const {data,error}=await ctx.db.from('cost_catalog_categories').insert({company_id:ctx.companyId,name}).select('id,name').single();
  if(error)return failure(error.code==='23505'?'That category already exists':'Category could not be saved',error.code==='23505'?409:500);
  return NextResponse.json({data},{status:201});
}
