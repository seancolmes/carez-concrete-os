import Link from 'next/link';
import {WorkspaceSubnav,workspacePillClass} from '@/components/ui/workspace-subnav';
import archetype from '@/components/ui/workspace-archetype.module.css';

const groups = [
  {id:'ledger',label:'Ledger & Cash Flow',views:[['ledger','Cash position'],['banking','Banking'],['reconcile','Reconcile'],['bank-rules','Bank rules'],['cash-accounts','Cash accounts'],['expenses','Expenses'],['reserves','Protected money'],['pour-funding','Pour funding']]},
  {id:'billing',label:'Billing & Invoices',views:[['billing','Billing'],['invoices','Invoices'],['payments','Payments'],['retainage','Retainage'],['billing-setup','Billing setup']]},
  {id:'procurement',label:'Procurement & A/P',views:[['procurement','Procurement'],['payables','Payables'],['bills','Vendor bills'],['orders','Purchase orders'],['vendors','Vendors'],['quotes','Quotes']]},
  {id:'labor',label:'Labor & Payroll',views:[['payroll','Payroll'],['costs','Job costs'],['catalog','Cost catalog'],['work-package-financials','Package financials']]},
] as const;

const loaders = {
  ledger:()=>import('./views/ledger'),
  banking:()=>import('./views/banking'),
  reconcile:()=>import('./views/reconcile'),
  'bank-rules':()=>import('./views/bank-rules'),
  'cash-accounts':()=>import('./views/cash-accounts'),
  expenses:()=>import('./views/expenses'),
  reserves:()=>import('./views/reserves'),
  'pour-funding':()=>import('@/components/field/views/dispatch'),
  billing:()=>import('./views/billing'),
  invoices:()=>import('./views/invoices'),
  payments:()=>import('./views/payments'),
  retainage:()=>import('./views/retainage'),
  'billing-setup':()=>import('./views/billing-setup'),
  procurement:()=>import('./views/procurement'),
  payables:()=>import('./views/payables'),
  bills:()=>import('./views/bills'),
  orders:()=>import('./views/orders'),
  vendors:()=>import('./views/vendors'),
  quotes:()=>import('./views/quotes'),
  payroll:()=>import('./views/payroll'),
  costs:()=>import('./views/costs'),
  catalog:()=>import('./views/catalog'),
  'work-package-financials':()=>import('@/components/field/views/work-package-financials'),
};

export async function FinancialsWorkspace({tab,view}:{tab?:string;view?:string}){
  const group=groups.find(item=>item.id===tab)||groups[0];
  const selected=group.views.find(item=>item[0]===view)?.[0]||group.views[0][0];
  const View=(await loaders[selected]()).default;

  return <section aria-label="Financial operations workspace" className={`${archetype.workspace} surface-card min-w-0 overflow-hidden rounded-xl`}>
    <WorkspaceSubnav label="Financial domains">
      {groups.map(item=><Link key={item.id} href={`/financials?tab=${item.id}&view=${item.views[0][0]}`} prefetch={false} scroll={false} aria-current={item.id===group.id?'page':undefined} className={workspacePillClass(item.id===group.id)}>{item.label}</Link>)}
    </WorkspaceSubnav>
    <WorkspaceSubnav label={`${group.label} views`}>
      {group.views.map(([id,label])=><Link key={id} href={`/financials?tab=${group.id}&view=${id}`} prefetch={false} scroll={false} aria-current={selected===id?'page':undefined} className={workspacePillClass(selected===id)}>{label}</Link>)}
    </WorkspaceSubnav>
    <div className="min-w-0 p-3 sm:p-5"><View/></div>
  </section>;
}
