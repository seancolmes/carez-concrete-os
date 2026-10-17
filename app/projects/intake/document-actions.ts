'use server';
import {retainedSourceScope} from '@/lib/projects/retainedSourceScope';
import {registerVerifiedSource} from '@/lib/documents/sourceRegistration.server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
export async function registerRetainedSource(fd:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in before saving source documents.');
 const {data:profile,error:profileError}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(profileError||!profile?.company_id||!['owner','office'].includes(profile.role))throw new Error('Owner or office access required.');
 const type=String(fd.get('document_type')||'');const scope=retainedSourceScope(type,String(fd.get('visibility')||(['w9','tax'].includes(type)?'office_private':'job')),String(fd.get('project_id')||'')||null);const {privateFile}=scope;const path=String(fd.get('storage_path')||'');
 if(!path.startsWith(`${profile.company_id}/${privateFile?'office-private':'sources'}/`)||path.includes('..'))throw new Error('Source path does not match its privacy scope.');
 const filename=String(fd.get('original_filename')||''),projectId=scope.projectId;
 const data=await registerVerifiedSource(supabase,user.id,{companyId:profile.company_id,path,privateFile,format:String(fd.get('storage_format')||'single'),requiresPdf:type==='plan',filename,values:{p_visibility:scope.visibility,p_project_id:projectId,p_mime:type==='plan'?'application/pdf':String(fd.get('mime_type')||'application/octet-stream'),p_type:type,p_title:String(fd.get('title')||''),p_filename:filename,p_source_reference:String(fd.get('source_reference')||''),p_revision_label:String(fd.get('revision_label')||''),p_supersedes_id:String(fd.get('supersedes_id')||'')||null}});
 if(projectId)revalidatePath(`/projects/${projectId}`);revalidatePath('/documents');revalidatePath('/documents/vault');return{duplicate:data.storage_path!==path,unusedPath:data.storage_path!==path?path:null};
}
export async function openExternalJobTakeoff(fd:FormData){
 const supabase=await createClient();const {data,error}=await supabase.rpc('carez_open_external_job_takeoff',{p_project_id:String(fd.get('project_id')||''),p_document_id:String(fd.get('document_id')||'')});
 if(error||!data)throw new Error(error?.message||'Plan workspace unavailable.');redirect(`/takeoff/${data}`);
}
