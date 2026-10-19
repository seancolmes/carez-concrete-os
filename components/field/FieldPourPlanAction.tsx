import {NewPourPlanDialog} from './NewPourPlanDialog';
import {getFieldContext} from '@/lib/field/workspaceContext.server';
import {timedFieldRead} from '@/lib/field/readTiming';

export async function FieldPourPlanAction({today,primary=false}:{today:string;primary?:boolean}){
 const {supabase,profile}=await getFieldContext();
 const [{data:projects,error:projectsError},{data:sections,error:sectionsError},{data:budgets,error:budgetsError},{data:changeOrders,error:ordersError}]=await Promise.all([
    timedFieldRead('pour-options.projects',()=>supabase.from('projects').select('id,job_number,name').eq('company_id',profile.company_id).in('status',['active','on_hold']).order('job_number')),
    timedFieldRead('pour-options.sections',()=>supabase.from('project_budget_sections').select('id,budget_id,name').eq('company_id',profile.company_id).order('sort_order')),
    timedFieldRead('pour-options.budgets',()=>supabase.from('project_budgets').select('id,project_id').eq('company_id',profile.company_id).eq('status','active')),
    timedFieldRead('pour-options.change-orders',()=>supabase.rpc('carez_list_approved_change_order_references',{p_project_id:null})),
  ]);
 if(projectsError||sectionsError||budgetsError||ordersError)return <p role="status" className="max-w-56 text-xs text-muted-foreground">Pour plan options unavailable.</p>;
 const projectMap=new Map((projects||[]).map(project=>[project.id,project]));
 const budgetProject=new Map((budgets||[]).map(budget=>[budget.id,budget.project_id]));
 const projectOptions=(projects||[]).map(project=>({id:project.id,label:`${project.job_number} — ${project.name}`}));
 const scopeLinks=(sections||[]).filter(section=>budgetProject.has(section.budget_id)).map(section=>({id:section.id,label:`${projectMap.get(budgetProject.get(section.budget_id)||'')?.job_number||'Job'} — ${section.name}`}));
 const orderOptions=((changeOrders||[]) as {id:string;project_id:string;co_number:string;title:string}[]).map(order=>({id:order.id,label:`${projectMap.get(order.project_id)?.job_number||'Job'} — ${order.co_number} · ${order.title}`}));
 return <NewPourPlanDialog today={today} projects={projectOptions} scopeLinks={scopeLinks} changeOrders={orderOptions} appearance={primary?'primary':'outline'}/>;
}
