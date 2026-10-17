import {projectGoverningHold} from '../projects/projectReadiness.ts';

type SetupRow={award_setup_applies:boolean|null;job_ready:boolean|null;readiness_reason:string|null};
type WorkRow={ready_operation_count:number|null;blocked_operation_count:number|null};

export function dashboardProjectReadiness(projectId:string,setup:SetupRow|null,work:WorkRow|null){
  const setupKnown=setup!==null;
  const workKnown=work!==null;
  const hold=projectGoverningHold(projectId,setup,work);
  const readinessLabel=hold.setupHold?'Job setup hold'
    :hold.hardHold?'Work hold'
    :hold.blockedAttention?'Blocked work'
    :!setupKnown||!workKnown?'Unavailable'
    :hold.ready>0?'Ready':'No open physical work';

  return {
    ...hold,
    incomplete:!setupKnown||!workKnown,
    readinessLabel,
    readyCount:workKnown?hold.ready:null,
    blockedCount:workKnown?hold.blocked:null,
  };
}

type DashboardReadiness=ReturnType<typeof dashboardProjectReadiness>;

export function dashboardProjectAttention(projectId:string,projectStatus:string,nextAction:string|null,readiness:DashboardReadiness,todayHasLinkedHold:boolean){
  const items:{kind:'job_setup'|'blocked_work'|'project_hold';issue:string;href:string;action:string}[]=[];
  if(readiness.setupHold)items.push({kind:'job_setup',issue:readiness.reason||'Job setup is not cleared.',href:readiness.href||`/job-setup/${encodeURIComponent(projectId)}`,action:readiness.action||'Review job setup'});
  if(readiness.blockedAttention&&!todayHasLinkedHold)items.push({kind:'blocked_work',issue:readiness.blockedReason||'Open physical work is blocked.',href:readiness.blockedHref||'/field?view=work-packages',action:readiness.blockedAction||'Review blocked operations'});
  if(projectStatus==='on_hold'&&!readiness.hardHold&&!readiness.blockedAttention)items.push({kind:'project_hold',issue:nextAction||'Project is on hold',href:`/projects/${encodeURIComponent(projectId)}`,action:'Open project'});
  return items;
}

export function showDashboardPlanningPrompt(projectStatus:string,readiness:DashboardReadiness,hasScheduledWork:boolean){
  return !hasScheduledWork&&!readiness.setupHold&&!readiness.blockedAttention&&!readiness.incomplete&&projectStatus!=='on_hold';
}
