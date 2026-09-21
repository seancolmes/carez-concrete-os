export const NAVIGATION_PREFERENCE_VERSION = 1;
export const MAX_DESKTOP_PINNED_DESTINATIONS = 5;
export const MAX_RECENT_DESTINATIONS = 8;
export const MAX_RECENT_PROJECTS = 6;

export type NavigationDomainId =
  | 'today'
  | 'preconstruction'
  | 'estimating'
  | 'projects'
  | 'field'
  | 'finance'
  | 'documents'
  | 'system';

export type NavigationIconKey =
  | 'home'
  | 'reports'
  | 'users'
  | 'inbox'
  | 'trending'
  | 'ruler'
  | 'calculator'
  | 'file'
  | 'shield'
  | 'library'
  | 'gauge'
  | 'briefcase'
  | 'clipboard-check'
  | 'calendar'
  | 'list-checks'
  | 'package'
  | 'clipboard-list'
  | 'hammer'
  | 'hard-hat'
  | 'key'
  | 'wrench'
  | 'receipt-text'
  | 'wallet'
  | 'credit-card'
  | 'landmark'
  | 'banknote'
  | 'receipt'
  | 'sliders'
  | 'shopping-cart'
  | 'settings';

export type NavigationDestination = {
  id: string;
  href: string;
  label: string;
  hint: string;
  domain: NavigationDomainId;
  icon: NavigationIconKey;
};

export type NavigationGroup = {
  id: NavigationDomainId;
  label: string;
  destinationIds: readonly string[];
};

export type NavigationPreference = {
  version: typeof NAVIGATION_PREFERENCE_VERSION;
  pinnedIds: string[];
};

export type ProjectRouteContext = {
  projectId: string;
  workspace: 'project-overview' | 'job-setup';
  workspaceLabel: 'Overview' | 'Job setup';
};

export const NAVIGATION_DESTINATIONS: readonly NavigationDestination[] = [
  {id:'today',href:'/',label:'Today',hint:'Daily operating command center',domain:'today',icon:'home'},
  {id:'reports',href:'/reports',label:'Owner reports',hint:'Company and job reporting',domain:'today',icon:'reports'},
  {id:'leads',href:'/leads',label:'Leads',hint:'Opportunities and customer follow-up',domain:'preconstruction',icon:'users'},
  {id:'lead-inbox',href:'/leads/inbox',label:'Lead inbox',hint:'Incoming bid opportunities',domain:'preconstruction',icon:'inbox'},
  {id:'bid-intelligence',href:'/bid-intelligence',label:'Bid intelligence',hint:'Pursuit and pricing intelligence',domain:'preconstruction',icon:'trending'},
  {id:'takeoff',href:'/takeoff',label:'Takeoff',hint:'Plans, conditions and quantities',domain:'estimating',icon:'ruler'},
  {id:'estimates',href:'/estimates',label:'Estimates',hint:'Scope, pricing and review',domain:'estimating',icon:'calculator'},
  {id:'proposals',href:'/proposals',label:'Proposals',hint:'Customer proposal workflow',domain:'estimating',icon:'file'},
  {id:'estimate-audit',href:'/estimates/audit',label:'Estimate audit',hint:'Scope, pricing and risk review',domain:'estimating',icon:'shield'},
  {id:'assemblies',href:'/takeoff/assemblies',label:'Assembly history',hint:'Legacy compatibility records',domain:'estimating',icon:'library'},
  {id:'production-intelligence',href:'/takeoff/intelligence',label:'Production intelligence',hint:'Actual production evidence',domain:'estimating',icon:'gauge'},
  {id:'projects',href:'/projects',label:'Projects',hint:'Active jobs and project control',domain:'projects',icon:'briefcase'},
  {id:'job-setup',href:'/job-setup',label:'Job setup',hint:'Turn accepted work into an executable job',domain:'projects',icon:'clipboard-check'},
  {id:'schedule',href:'/schedule',label:'Schedule',hint:'Who is working where and what happens next',domain:'projects',icon:'calendar'},
  {id:'look-ahead',href:'/look-ahead',label:'21-day look-ahead',hint:'Upcoming operations and blockers',domain:'projects',icon:'calendar'},
  {id:'readiness',href:'/readiness',label:'Work readiness',hint:'Prerequisites before labor starts',domain:'projects',icon:'list-checks'},
  {id:'resources',href:'/readiness/resources',label:'Materials & resources',hint:'Materials, equipment and vendors needed before start',domain:'projects',icon:'shield'},
  {id:'work-packages',href:'/production/work-packages',label:'Work packages',hint:'Physical scopes connected to quantities',domain:'projects',icon:'package'},
  {id:'scope-drift',href:'/scope-drift',label:'Scope drift',hint:'Changed or unplanned work',domain:'projects',icon:'clipboard-list'},
  {id:'change-orders',href:'/change-orders',label:'Change orders',hint:'Price and control extra work',domain:'projects',icon:'clipboard-list'},
  {id:'forecast',href:'/forecast',label:'Forecast',hint:'Where each job is headed',domain:'projects',icon:'trending'},
  {id:'field',href:'/field',label:'Field control',hint:'Time review and field control',domain:'field',icon:'hammer'},
  {id:'production',href:'/production',label:'Production',hint:'Earned quantities and actual production rates',domain:'field',icon:'gauge'},
  {id:'pour-control',href:'/pour-control',label:'Pour control',hint:'Concrete placement readiness',domain:'field',icon:'shield'},
  {id:'crew',href:'/crew',label:'Crew',hint:'Workers, rates and labor setup',domain:'field',icon:'hard-hat'},
  {id:'employee-access',href:'/crew/access',label:'Employee access',hint:'Employee clock logins and access',domain:'field',icon:'key'},
  {id:'equipment',href:'/equipment',label:'Equipment & inventory',hint:'Tools, forms and equipment',domain:'field',icon:'wrench'},
  {id:'billing',href:'/billing',label:'Billing',hint:'Invoices and customer balances',domain:'finance',icon:'receipt-text'},
  {id:'cashflow',href:'/cashflow',label:'Cashflow',hint:'Cash position and upcoming obligations',domain:'finance',icon:'wallet'},
  {id:'payables',href:'/payables',label:'Accounts payable',hint:'Bills owed to vendors',domain:'finance',icon:'credit-card'},
  {id:'banking',href:'/banking',label:'Banking',hint:'Connected accounts and activity',domain:'finance',icon:'landmark'},
  {id:'reconcile',href:'/banking/reconcile',label:'Reconcile',hint:'Match charges, deposits and documents',domain:'finance',icon:'list-checks'},
  {id:'bank-rules',href:'/banking/rules',label:'Bank rules',hint:'Banking automation rules',domain:'finance',icon:'sliders'},
  {id:'payroll',href:'/payroll',label:'Payroll',hint:'Crew payroll and labor cash needs',domain:'finance',icon:'banknote'},
  {id:'costs',href:'/costs',label:'Job costs',hint:'Actual cost by job',domain:'finance',icon:'receipt'},
  {id:'overhead',href:'/overhead',label:'Overhead',hint:'Cost to keep Carez running',domain:'finance',icon:'gauge'},
  {id:'procurement',href:'/procurement',label:'Procurement',hint:'Quotes, purchase orders and vendor control',domain:'finance',icon:'shopping-cart'},
  {id:'documents',href:'/documents',label:'Documents',hint:'Tickets, receipts, plans and job photos',domain:'documents',icon:'file'},
  {id:'settings',href:'/settings',label:'Settings',hint:'Company setup and system controls',domain:'system',icon:'settings'},
] as const;

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {id:'today',label:'Today',destinationIds:['today','reports']},
  {id:'preconstruction',label:'Preconstruction',destinationIds:['leads','lead-inbox','bid-intelligence']},
  {id:'estimating',label:'Estimating',destinationIds:['takeoff','estimates','proposals','estimate-audit','assemblies','production-intelligence']},
  {id:'projects',label:'Projects',destinationIds:['projects','job-setup','schedule','look-ahead','readiness','resources','work-packages','scope-drift','change-orders','forecast']},
  {id:'field',label:'Field',destinationIds:['field','production','pour-control','crew','employee-access','equipment']},
  {id:'finance',label:'Finance',destinationIds:['billing','cashflow','payables','banking','reconcile','bank-rules','payroll','costs','overhead','procurement']},
  {id:'documents',label:'Documents',destinationIds:['documents']},
  {id:'system',label:'System',destinationIds:['settings']},
] as const;

const destinationById = new Map(NAVIGATION_DESTINATIONS.map(destination=>[destination.id,destination]));
const knownDestinationIds = new Set(NAVIGATION_DESTINATIONS.map(destination=>destination.id));

const ROLE_DEFAULTS = {
  ownerAdmin: ['today','projects','reports','billing','documents'],
  estimator: ['today','takeoff','estimates','proposals','projects'],
  projectManager: ['today','projects','schedule','readiness','forecast'],
  fieldLeader: ['today','field','production','pour-control','documents'],
  accountingFinance: ['today','billing','cashflow','payables','costs'],
  fallback: ['today','projects','documents'],
} as const;

function normalizedRole(role: string | null | undefined){
  return (role||'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
}

export function getRoleDefaultDestinationIds(role: string | null | undefined): string[] {
  const value=normalizedRole(role);
  if(['owner','admin','administrator','owner admin'].includes(value))return [...ROLE_DEFAULTS.ownerAdmin];
  if(['estimator','estimating'].includes(value))return [...ROLE_DEFAULTS.estimator];
  if(['project manager','projectmanager','pm'].includes(value))return [...ROLE_DEFAULTS.projectManager];
  if(['foreman','superintendent','super','foreman superintendent'].includes(value))return [...ROLE_DEFAULTS.fieldLeader];
  if(['accounting','finance','accounting finance','bookkeeper','controller'].includes(value))return [...ROLE_DEFAULTS.accountingFinance];
  return [...ROLE_DEFAULTS.fallback];
}

export function getDestinationById(id: string): NavigationDestination | null {
  return destinationById.get(id)||null;
}

export function matchesDestinationPath(pathname: string, href: string): boolean {
  if(href==='/')return pathname==='/';
  return pathname===href||pathname.startsWith(`${href}/`);
}

export function resolveActiveDestination(pathname: string): NavigationDestination | null {
  return [...NAVIGATION_DESTINATIONS]
    .sort((a,b)=>b.href.length-a.href.length)
    .find(destination=>matchesDestinationPath(pathname,destination.href))||null;
}

export function normalizePinnedDestinationIds(value: unknown): string[] {
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  const result:string[]=[];
  for(const candidate of value){
    if(typeof candidate!=='string'||seen.has(candidate)||!knownDestinationIds.has(candidate))continue;
    seen.add(candidate);
    result.push(candidate);
    if(result.length===MAX_DESKTOP_PINNED_DESTINATIONS)break;
  }
  return result;
}

export function resetNavigationPreference(role: string | null | undefined): NavigationPreference {
  return {version:NAVIGATION_PREFERENCE_VERSION,pinnedIds:getRoleDefaultDestinationIds(role)};
}

export function normalizeNavigationPreference(value: unknown,role: string | null | undefined): NavigationPreference {
  if(!value||typeof value!=='object')return resetNavigationPreference(role);
  const candidate=value as {version?:unknown;pinnedIds?:unknown};
  if(candidate.version!==NAVIGATION_PREFERENCE_VERSION)return resetNavigationPreference(role);
  const pinnedIds=normalizePinnedDestinationIds(candidate.pinnedIds);
  return pinnedIds.length?{version:NAVIGATION_PREFERENCE_VERSION,pinnedIds}:resetNavigationPreference(role);
}

export function togglePinnedDestination(pinnedIds: readonly string[],destinationId: string): string[] {
  const current=normalizePinnedDestinationIds(pinnedIds);
  if(!knownDestinationIds.has(destinationId))return current;
  if(current.includes(destinationId)){
    if(current.length===1)return current;
    return current.filter(id=>id!==destinationId);
  }
  if(current.length>=MAX_DESKTOP_PINNED_DESTINATIONS)return current;
  return [...current,destinationId];
}

export function movePinnedDestination(pinnedIds: readonly string[],destinationId: string,direction: -1|1): string[] {
  const current=normalizePinnedDestinationIds(pinnedIds);
  const index=current.indexOf(destinationId);
  const target=index+direction;
  if(index<0||target<0||target>=current.length)return current;
  const next=[...current];
  [next[index],next[target]]=[next[target],next[index]];
  return next;
}

export function navigationPreferenceStorageKey(userId: string,companyId: string): string {
  return `carez.navigation.v${NAVIGATION_PREFERENCE_VERSION}:${companyId}:${userId}`;
}

export function recentDestinationsStorageKey(userId: string,companyId: string): string {
  return `carez.navigation.recent.v${NAVIGATION_PREFERENCE_VERSION}:${companyId}:${userId}`;
}

export function recentProjectsStorageKey(userId: string,companyId: string): string {
  return `carez.projects.recent.v${NAVIGATION_PREFERENCE_VERSION}:${companyId}:${userId}`;
}

export function normalizeRecentDestinationIds(value: unknown): string[] {
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  const result:string[]=[];
  for(const candidate of value){
    if(typeof candidate!=='string'||seen.has(candidate)||!knownDestinationIds.has(candidate))continue;
    seen.add(candidate);
    result.push(candidate);
    if(result.length===MAX_RECENT_DESTINATIONS)break;
  }
  return result;
}

export function normalizeRecentProjectIds(value: unknown): string[] {
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  const result:string[]=[];
  for(const candidate of value){
    if(typeof candidate!=='string'||!candidate.trim()||seen.has(candidate))continue;
    seen.add(candidate);
    result.push(candidate);
    if(result.length===MAX_RECENT_PROJECTS)break;
  }
  return result;
}

export function prependRecentId(ids: readonly string[],id: string,max: number): string[] {
  if(!id)return [...ids].slice(0,max);
  return [id,...ids.filter(candidate=>candidate!==id)].slice(0,max);
}

export function resolveProjectRoute(pathname: string): ProjectRouteContext | null {
  const project=pathname.match(/^\/projects\/([^/]+)\/?$/);
  if(project)return {projectId:decodeURIComponent(project[1]),workspace:'project-overview',workspaceLabel:'Overview'};
  const jobSetup=pathname.match(/^\/job-setup\/([^/]+)\/?$/);
  if(jobSetup)return {projectId:decodeURIComponent(jobSetup[1]),workspace:'job-setup',workspaceLabel:'Job setup'};
  return null;
}

export function buildProjectSwitchHref(pathname: string,newProjectId: string): string {
  const encoded=encodeURIComponent(newProjectId);
  const context=resolveProjectRoute(pathname);
  if(context?.workspace==='project-overview')return `/projects/${encoded}`;
  if(context?.workspace==='job-setup')return `/job-setup/${encoded}`;
  return `/projects/${encoded}`;
}
