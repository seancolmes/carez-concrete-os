import Link from 'next/link';
import styles from './FinancialsWorkspace.module.css';

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
const availableViews=new Set(['billing','invoices','payments','retainage','billing-setup','costs','catalog','work-package-financials']);

export async function FinancialsWorkspace({tab,view}:{tab?:string;view?:string}){
  const group=groups.find(item=>item.id===tab)||groups[1];
  const selected=group.views.find(item=>item[0]===view)?.[0]||group.views.find(item=>availableViews.has(item[0]))?.[0]||group.views[0][0];
  const View=availableViews.has(selected)?(await loaders[selected]()).default:null;

  return <section aria-label="Financial operations workspace" className="surface-card min-w-0 overflow-hidden rounded-xl">
    <nav aria-label="Financial views" className={styles.navigation}>
      {groups.map(item=>{const available=item.views.filter(([id])=>availableViews.has(id));return available.length?<div key={item.id} className={styles.navigationGroup}>
        <span className={styles.navigationLabel}>{item.label}</span>
        {available.map(([id,label])=><Link key={id} href={`/financials?tab=${item.id}&view=${id}`} prefetch={false} scroll={false} aria-current={item.id===group.id&&selected===id?'page':undefined} className={`${styles.navigationLink} ${item.id===group.id&&selected===id?styles.navigationLinkActive:''}`}>{label}</Link>)}
      </div>:null;})}
    </nav>
    {View?<>
      <div className="min-w-0 p-3 sm:p-5"><View/></div>
    </>:<div role="status" className="space-y-2 p-5 text-sm text-muted-foreground"><h2 className="text-base font-semibold text-foreground">{group.label} is not connected yet</h2><p>This workspace needs its source-controlled financial records and summaries before it can show reliable figures.</p><Link className="inline-flex text-primary underline-offset-4 hover:underline" href="/financials?tab=billing&view=billing">Open Billing & Invoices</Link></div>}
  </section>;
}
