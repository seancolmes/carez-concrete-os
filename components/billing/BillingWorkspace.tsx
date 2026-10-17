'use client';

import {Fragment,useMemo,useState} from 'react';
import Link from 'next/link';
import { ChevronDownRegular as ChevronDown } from '@fluentui/react-icons';
import {Button,ProgressBar,Tab,TabList} from '@fluentui/react-components';
import {billingRowState,type BillingReadModel,type BillingRow} from '@/components/financials/views/billing-read-model';
import styles from './BillingWorkspace.module.css';

type Filter='all'|'attention';
const currency=(value:number|null,missing='Unavailable')=>value===null?missing:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);

export function BillingWorkspace({rows,summary,billingUnavailable,invoicesUnavailable,retainageUnavailable}:BillingReadModel){
  const [filter,setFilter]=useState<Filter>('all');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const visible=useMemo(()=>filter==='attention'?rows.filter(row=>billingRowState(row)!=='current'):rows,[filter,rows]);
  const metrics=[
    {label:'Work not billed',value:currency(summary.unbilled,summary.unbilledMissingContract?'Contract not recorded':'Unavailable')},
    {label:'Customers owe',value:currency(summary.owed)},
    {label:'Past due',value:currency(summary.late),tone:summary.late!==null&&summary.late>0?'warning':undefined},
    {label:'Cash collected',value:currency(summary.collected)},
    {label:'Retainage available',value:currency(summary.retainage)},
    {label:'Draft invoices',value:summary.drafts===null?'Unavailable':String(summary.drafts)},
  ];
  const toggleSelected=(projectId:string)=>setSelectedId(current=>current===projectId?null:projectId);

  return <div className={styles.workspace}>
    <header className={styles.pageHeader}><div><h1>Billing</h1></div><div className={styles.pageActions}><Link href="/financials?tab=billing&view=invoices" className={styles.primaryAction}>Create / send invoice</Link><Link href="/financials?tab=billing&view=payments">Record payment</Link></div></header>
    {(billingUnavailable||invoicesUnavailable||retainageUnavailable)&&<div role="status" className="border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">{[
      billingUnavailable?'Project billing records':null,
      invoicesUnavailable?'Invoice and past-due records':null,
      retainageUnavailable?'Retainage records':null,
    ].filter(Boolean).join(', ')} are temporarily unavailable. Affected values are marked Unavailable.</div>}
    <section className={styles.metrics} aria-label="Billing position">{metrics.map(metric=><div key={metric.label} data-tone={'tone' in metric?metric.tone:undefined}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</section>
    <section className={styles.module} aria-labelledby="billing-projects-title"><div className={styles.moduleHeader}><div><h2 id="billing-projects-title">Project billing</h2></div><small>{billingUnavailable?'Unavailable':`${rows.length} projects`}</small></div><TabList className={styles.tabs} selectedValue={filter} onTabSelect={(_,data)=>setFilter(data.value as Filter)} aria-label="Project billing filter"><Tab value="all">All projects</Tab><Tab value="attention">Needs attention</Tab></TabList><div className={styles.phoneRegister} aria-label="Project billing records">{visible.length===0?<p className="p-4 text-sm text-muted-foreground">{billingUnavailable?'Project billing records are unavailable.':filter==='attention'?'No project billing records need attention.':'No project billing records in this view.'}</p>:visible.map(row=>{const state=billingRowState(row);const expanded=selectedId===row.project_id;const id=`billing-phone-${row.project_id}`;return <article key={row.project_id} className={styles.phoneRow}><div className="space-y-2 p-3"><h3 className="break-words text-sm font-semibold">{row.name||'Unnamed project'}</h3><p className="text-xs text-muted-foreground">{row.job_number||'Job'}</p><span className={`${styles.badge} ${state==='late'?styles.badgeLate:state==='owed'?styles.badgeOwed:state==='current'?styles.badgeCurrent:''}`}>{state==='late'?'Payment late':state==='owed'?'Customer owes':state==='current'?'Current':state==='missing-contract'?'Contract not recorded':'Due status unavailable'}</span><dl className={styles.phoneAmounts}>{[
      ['Recorded contract',currency(row.recorded_contract,'Not recorded')],['Not billed',currency(row.unbilled_contract,row.recorded_contract===null?'Needs contract':'Unavailable')],['Billed',currency(row.billed_amount)],['Still owed',currency(row.outstanding_ar)],['Collected',currency(row.collected_amount)],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><Button type="button" appearance="outline" size="small" aria-expanded={expanded} aria-controls={expanded?id:undefined} onClick={()=>toggleSelected(row.project_id)}>{expanded?'Close details':'Billing details'}</Button></div>{expanded?<div id={id}><BillingDetail row={row}/></div>:null}</article>;})}</div><div className={styles.tableViewport}><table className={styles.table} aria-labelledby="billing-projects-title"><colgroup><col style={{width:230}}/><col style={{width:160}}/><col span={5} style={{width:125}}/><col style={{width:104}}/></colgroup><thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col" className={styles.numeric}>Recorded contract</th><th scope="col" className={styles.numeric}>Not billed</th><th scope="col" className={styles.numeric}>Billed</th><th scope="col" className={styles.numeric}>Still owed</th><th scope="col" className={styles.numeric}>Collected</th><th scope="col" className={styles.numeric}>Action</th></tr></thead><tbody>{visible.length===0?<tr><td colSpan={8} className={styles.empty}>{billingUnavailable?'Project billing records are unavailable.':filter==='attention'?'No project billing records need attention.':'No project billing records in this view.'}</td></tr>:visible.map(row=>{
      const expanded=selectedId===row.project_id;
      const state=billingRowState(row);
      const detailId=`billing-detail-${row.project_id}`;
      return <Fragment key={row.project_id}><tr className={styles.dataRow} data-selected={expanded} onClick={()=>toggleSelected(row.project_id)}><td><span className={styles.job}><span>{row.job_number||'Job'}</span><strong>{row.name||'Unnamed project'}</strong></span></td><td><span className={`${styles.badge} ${state==='late'?styles.badgeLate:state==='owed'?styles.badgeOwed:state==='current'?styles.badgeCurrent:''}`}>{state==='late'?'Payment late':state==='owed'?'Customer owes':state==='current'?'Current':state==='missing-contract'?'Contract not recorded':'Due status unavailable'}</span></td><td className={styles.numeric}>{currency(row.recorded_contract,'Not recorded')}</td><td className={styles.numeric}>{currency(row.unbilled_contract,row.recorded_contract===null?'Needs contract':'Unavailable')}</td><td className={styles.numeric}>{currency(row.billed_amount)}</td><td className={styles.numeric}>{currency(row.outstanding_ar)}</td><td className={styles.numeric}>{currency(row.collected_amount)}</td><td className={styles.numeric}><Button type="button" appearance="subtle" size="small" className={styles.rowAction} onClick={event=>{event.stopPropagation();toggleSelected(row.project_id);}} aria-expanded={expanded} aria-controls={expanded?detailId:undefined} aria-label={`${expanded?'Collapse':'Expand'} billing details for ${row.name||row.job_number||'project'}`}>Details <ChevronDown aria-hidden="true" fontSize={13} className={expanded?styles.chevronOpen:''}/></Button></td></tr>{expanded&&<tr><td colSpan={8} className={styles.expandedCell}><div id={detailId}><BillingDetail row={row}/></div></td></tr>}</Fragment>;
    })}</tbody></table></div></section>
  </div>;
}

function BillingDetail({row}:{row:BillingRow}){
  const recorded=row.recorded_contract;
  const billed=row.billed_amount;
  const collected=row.collected_amount;
  const billedPercent=recorded!==null&&recorded>0&&billed!==null?billed/recorded*100:null;
  const collectedPercent=billed!==null&&billed>0&&collected!==null?collected/billed*100:null;
  return <div className={styles.expanded} aria-label={`${row.name||row.job_number||'Project'} billing workspace`}>
    <div className={styles.detailGrid}>
      <section className={styles.detailSection}><h3>Contract and billing</h3><dl><div><dt>Recorded contract</dt><dd>{currency(recorded,'Not recorded')}</dd></div><div><dt>Not yet billed</dt><dd>{currency(row.unbilled_contract,recorded===null?'Needs contract':'Unavailable')}</dd></div><div><dt>Billed</dt><dd>{currency(billed)}</dd></div></dl></section>
      <section className={styles.detailSection}><h3>Financial pulse</h3><dl><div><dt>Still owed</dt><dd>{currency(row.outstanding_ar)}</dd></div><div><dt>Past due</dt><dd className={row.overdue_ar!==null&&row.overdue_ar>0?styles.pastDue:undefined}>{currency(row.overdue_ar)}</dd></div><div><dt>Cash collected</dt><dd>{currency(collected)}</dd></div></dl>{billedPercent!==null&&<div className={styles.progressBlock}><div><span>Recorded contract billed</span><span>{billedPercent.toFixed(0)}% · {currency(billed)} / {currency(recorded)}</span></div><ProgressBar aria-label="Recorded contract billed" value={Math.min(1,Math.max(0,billedPercent/100))}/></div>}{collectedPercent!==null&&<div className={styles.progressBlock}><div><span>Billed amount collected</span><span>{collectedPercent.toFixed(0)}% · {currency(collected)} / {currency(billed)}</span></div><ProgressBar aria-label="Billed amount collected" value={Math.min(1,Math.max(0,collectedPercent/100))}/></div>}</section>
      <section className={styles.detailSection}><h3>Next actions</h3><div className={styles.drawerLinks}><Link href={`/projects/${encodeURIComponent(row.project_id)}`}>Open project record</Link><Link href="/financials?tab=billing&view=invoices">Review invoices</Link><Link href="/financials?tab=billing&view=payments">Review payments</Link></div><details className={`pt-help ${styles.drawerNote}`}><summary>Amount basis</summary><p>Recorded contract, invoice totals, customer balance, and payments use their own source records. The accepted commercial baseline is tracked separately.</p></details></section>
    </div>
  </div>;
}
