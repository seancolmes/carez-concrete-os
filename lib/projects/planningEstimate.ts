/** A project-linked estimate without a lead is job planning, not a new bid. */
export function isStandaloneProjectPlan(estimate:{lead_id?:string|null;project_id?:string|null}|null|undefined):boolean{
 return Boolean(estimate?.project_id&&!estimate.lead_id);
}
