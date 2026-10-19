import Link from 'next/link';
import {FINANCIAL_GROUPS,AVAILABLE_FINANCIAL_VIEWS,resolveFinancialView} from '@/lib/financials/navigation';
import styles from './FinancialsWorkspace.module.css';

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
  const {group,selected}=resolveFinancialView(tab,view);
  const View=AVAILABLE_FINANCIAL_VIEWS.has(selected)?(await loaders[selected]()).default:null;

  return <section aria-label="Financial operations workspace" className="surface-card min-w-0 overflow-hidden rounded-lg">
    <nav aria-label="Financial groups" className={styles.primaryNavigation}>
      {FINANCIAL_GROUPS.map(item=>{const first=item.views.find(([id])=>AVAILABLE_FINANCIAL_VIEWS.has(id));return first?<Link key={item.id} href={`/financials?tab=${item.id}&view=${first[0]}`} prefetch={false} scroll={false} aria-label={item.label} aria-current={item.id===group.id?'true':undefined} className={`${styles.groupLink} ${item.id===group.id?styles.groupLinkActive:''}`}><span className={styles.desktopLabel}>{item.label}</span><span className={styles.phoneLabel}>{item.phoneLabel}</span></Link>:null;})}
    </nav>
    <nav aria-label={`${group.label} views`} className={styles.navigation}>
      {group.views.filter(([id])=>AVAILABLE_FINANCIAL_VIEWS.has(id)).map(([id,label])=><Link key={id} href={`/financials?tab=${group.id}&view=${id}`} prefetch={false} scroll={false} aria-current={selected===id?'page':undefined} className={`${styles.navigationLink} ${selected===id?styles.navigationLinkActive:''}`}>{label}</Link>)}
    </nav>
    {View?<>
      <div className="min-w-0 p-3 sm:p-5"><View/></div>
    </>:<div role="status" className="space-y-2 p-5 text-sm text-muted-foreground"><h2 className="text-base font-semibold text-foreground">{group.label} is not connected yet</h2><p>Financial data is unavailable for this view.</p><Link className="inline-flex text-primary underline-offset-4 hover:underline" href="/financials?tab=billing&view=billing">Open Billing & Invoices</Link></div>}
  </section>;
}
