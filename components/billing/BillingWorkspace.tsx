'use client';

import {Fragment,useMemo,useState} from 'react';
import Link from 'next/link';
import { ChevronDownRegular as ChevronDown } from '@fluentui/react-icons';
import {Button,ProgressBar,Tab,TabList} from '@fluentui/react-components';
import styles from './BillingWorkspace.module.css';

export type BillingRow={
  project_id:string;
  job_number:string|null;
  name:string|null;
  authorized_contract:number|null;
  unbilled_contract:number|null;
  billed_contract:number|null;
  outstanding_ar:number|null;
  overdue_ar:number|null;
  cash_collected:number|null;
};

type Summary={unbilled:number;owed:number;late:number;collected:number;retainage:number;drafts:number};
type Filter='all'|'attention';
const currency=(value:number|null|undefined)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));

export function BillingWorkspace({rows,summary}:{rows:BillingRow[];summary:Summary}){
  const [filter,setFilter]=useState<Filter>('all');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const visible=useMemo(()=>filter==='attention'?rows.filter(row=>Number(row.outstanding_ar||0)>0||Number(row.overdue_ar||0)>0):rows,[filter,rows]);
  const metrics=[
    {label:'Work not billed',value:currency(summary.unbilled)},
    {label:'Customers owe',value:currency(summary.owed)},
    {label:'Past due',value:currency(summary.late),tone:summary.late>0?'warning':undefined},
    {label:'Cash collected',value:currency(summary.collected)},
    {label:'Retainage available',value:currency(summary.retainage)},
    {label:'Draft invoices',value:String(summary.drafts)},
  ];
  const toggleSelected=(projectId:string)=>setSelectedId(current=>current===projectId?null:projectId);

  return <div className={styles.workspace}>
    <header className={styles.pageHeader}><div><h1>Billing</h1></div><div className={styles.pageActions}><Link href="/financials?tab=billing&view=invoices" className={styles.primaryAction}>Create / send invoice</Link><Link href="/financials?tab=billing&view=payments">Record payment</Link></div></header>
    <section className={styles.metrics} aria-label="Billing position">{metrics.map(metric=><div key={metric.label} data-tone={'tone' in metric?metric.tone:undefined}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</section>
    <section className={styles.module} aria-labelledby="billing-projects-title"><div className={styles.moduleHeader}><div><h2 id="billing-projects-title">Project billing</h2></div><small>{rows.length} projects</small></div><TabList className={styles.tabs} selectedValue={filter} onTabSelect={(_,data)=>setFilter(data.value as Filter)} aria-label="Project billing filter"><Tab value="all">All projects</Tab><Tab value="attention">Needs attention</Tab></TabList><div className={styles.tableViewport}><table className={styles.table} aria-labelledby="billing-projects-title"><colgroup><col style={{width:230}}/><col style={{width:110}}/><col span={5} style={{width:115}}/><col style={{width:104}}/></colgroup><thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col" className={styles.numeric}>Authorized</th><th scope="col" className={styles.numeric}>Not billed</th><th scope="col" className={styles.numeric}>Billed</th><th scope="col" className={styles.numeric}>Still owed</th><th scope="col" className={styles.numeric}>Collected</th><th scope="col" className={styles.numeric}>Action</th></tr></thead><tbody>{visible.length===0?<tr><td colSpan={8} className={styles.empty}>No project billing records in this view.</td></tr>:visible.map(row=>{
      const expanded=selectedId===row.project_id;
      const overdue=Number(row.overdue_ar||0),owed=Number(row.outstanding_ar||0);
      const detailId=`billing-detail-${row.project_id}`;
      return <Fragment key={row.project_id}><tr className={styles.dataRow} data-selected={expanded} onClick={()=>toggleSelected(row.project_id)}><td><span className={styles.job}><span>{row.job_number||'Job'}</span><strong>{row.name||'Unnamed project'}</strong></span></td><td><span className={`${styles.badge} ${overdue>0?styles.badgeLate:owed>0?styles.badgeOwed:styles.badgeCurrent}`}>{overdue>0?'Payment late':owed>0?'Customer owes':'Current'}</span></td><td className={styles.numeric}>{currency(row.authorized_contract)}</td><td className={styles.numeric}>{currency(row.unbilled_contract)}</td><td className={styles.numeric}>{currency(row.billed_contract)}</td><td className={styles.numeric}>{currency(row.outstanding_ar)}</td><td className={styles.numeric}>{currency(row.cash_collected)}</td><td className={styles.numeric}><Button type="button" appearance="subtle" size="small" className={styles.rowAction} onClick={event=>{event.stopPropagation();toggleSelected(row.project_id);}} aria-expanded={expanded} aria-controls={expanded?detailId:undefined} aria-label={`${expanded?'Collapse':'Expand'} billing details for ${row.name||row.job_number||'project'}`}>Details <ChevronDown aria-hidden="true" fontSize={13} className={expanded?styles.chevronOpen:''}/></Button></td></tr>{expanded&&<tr><td colSpan={8} className={styles.expandedCell}><div id={detailId}><BillingDetail row={row}/></div></td></tr>}</Fragment>;
    })}</tbody></table></div></section>
  </div>;
}

function BillingDetail({row}:{row:BillingRow}){
  const authorized=Number(row.authorized_contract||0);
  const billed=Number(row.billed_contract||0);
  const collected=Number(row.cash_collected||0);
  const billedPercent=authorized>0?billed/authorized*100:null;
  const collectedPercent=billed>0?collected/billed*100:null;
  return <div className={styles.expanded} aria-label={`${row.name||row.job_number||'Project'} billing workspace`}>
    <div className={styles.detailGrid}>
      <section className={styles.detailSection}><h3>Contract and billing</h3><dl><div><dt>Authorized contract</dt><dd>{currency(row.authorized_contract)}</dd></div><div><dt>Not yet billed</dt><dd>{currency(row.unbilled_contract)}</dd></div><div><dt>Billed</dt><dd>{currency(row.billed_contract)}</dd></div></dl></section>
      <section className={styles.detailSection}><h3>Financial pulse</h3><dl><div><dt>Still owed</dt><dd>{currency(row.outstanding_ar)}</dd></div><div><dt>Past due</dt><dd className={Number(row.overdue_ar||0)>0?styles.pastDue:undefined}>{currency(row.overdue_ar)}</dd></div><div><dt>Cash collected</dt><dd>{currency(row.cash_collected)}</dd></div></dl>{billedPercent!==null&&<div className={styles.progressBlock}><div><span>Contract billed</span><span>{billedPercent.toFixed(0)}% · {currency(billed)} / {currency(authorized)}</span></div><ProgressBar aria-label="Contract billed" value={Math.min(1,Math.max(0,billedPercent/100))}/></div>}{collectedPercent!==null&&<div className={styles.progressBlock}><div><span>Billed amount collected</span><span>{collectedPercent.toFixed(0)}% · {currency(collected)} / {currency(billed)}</span></div><ProgressBar aria-label="Billed amount collected" value={Math.min(1,Math.max(0,collectedPercent/100))}/></div>}</section>
      <section className={styles.detailSection}><h3>Next actions</h3><div className={styles.drawerLinks}><Link href={`/projects/${encodeURIComponent(row.project_id)}`}>Open project record</Link><Link href="/financials?tab=billing&view=invoices">Review invoices</Link><Link href="/financials?tab=billing&view=payments">Review payments</Link></div><p className={styles.drawerNote}>These values come from the authoritative billing summary. Edit invoices and payments in their owning workflows.</p></section>
    </div>
  </div>;
}
