'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Table} from 'antd';
import type {TableProps} from 'antd';
import {ChevronDown} from 'lucide-react';
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
  const columns:TableProps<BillingRow>['columns']=[
    {title:'Job',key:'job',width:230,render:(_,row)=><span className={styles.job}><span>{row.job_number||'Job'}</span><strong>{row.name||'Unnamed project'}</strong></span>},
    {title:'Status',key:'status',width:110,render:(_,row)=>{const overdue=Number(row.overdue_ar||0),owed=Number(row.outstanding_ar||0);return <span className={`${styles.badge} ${overdue>0?styles.badgeLate:owed>0?styles.badgeOwed:styles.badgeCurrent}`}>{overdue>0?'Payment late':owed>0?'Customer owes':'Current'}</span>;}},
    {title:'Authorized',dataIndex:'authorized_contract',key:'authorized',align:'right',width:115,render:currency},
    {title:'Not billed',dataIndex:'unbilled_contract',key:'unbilled',align:'right',width:115,render:currency},
    {title:'Billed',dataIndex:'billed_contract',key:'billed',align:'right',width:115,render:currency},
    {title:'Still owed',dataIndex:'outstanding_ar',key:'owed',align:'right',width:115,render:currency},
    {title:'Collected',dataIndex:'cash_collected',key:'collected',align:'right',width:115,render:currency},
    {title:'Action',key:'action',align:'right',width:104,render:(_,row)=><button type="button" className={styles.rowAction} onClick={event=>{event.stopPropagation();setSelectedId(current=>current===row.project_id?null:row.project_id);}} aria-expanded={selectedId===row.project_id} aria-label={`${selectedId===row.project_id?'Collapse':'Expand'} billing details for ${row.name||row.job_number||'project'}`}>Details <ChevronDown aria-hidden="true" size={13} className={selectedId===row.project_id?styles.chevronOpen:''}/></button>},
  ];

  return <div className={styles.workspace}>
    <header className={styles.pageHeader}><div><h1>Billing</h1></div><div className={styles.pageActions}><Link href="/financials?tab=billing&view=invoices" className={styles.primaryAction}>Create / send invoice</Link><Link href="/financials?tab=billing&view=payments">Record payment</Link></div></header>
    <section className={styles.metrics} aria-label="Billing position">{metrics.map(metric=><div key={metric.label} data-tone={'tone' in metric?metric.tone:undefined}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</section>
    <nav className={styles.workflow} aria-label="Billing workflows"><Link href="/financials?tab=billing&view=invoices">Invoices</Link><Link href="/financials?tab=billing&view=payments">Payments</Link><Link href="/financials?tab=billing&view=retainage">Retainage</Link><Link href="/financials?tab=billing&view=billing-setup">Billing setup</Link></nav>
    <section className={styles.module} aria-labelledby="billing-projects-title"><div className={styles.moduleHeader}><div><h2 id="billing-projects-title">Project billing</h2></div><small>{rows.length} projects</small></div><div className={styles.tabs} role="tablist" aria-label="Project billing filter"><button type="button" role="tab" aria-selected={filter==='all'} className={filter==='all'?styles.active:''} onClick={()=>setFilter('all')}>All projects</button><button type="button" role="tab" aria-selected={filter==='attention'} className={filter==='attention'?styles.active:''} onClick={()=>setFilter('attention')}>Needs attention</button></div><Table<BillingRow> rowKey="project_id" className={styles.table} columns={columns} dataSource={visible} size="small" pagination={false} scroll={{x:1019}} locale={{emptyText:'No project billing records in this view.'}} expandable={{expandedRowKeys:selectedId?[selectedId]:[],expandedRowRender:row=><BillingDetail row={row}/>,onExpand:(expanded,row)=>setSelectedId(expanded?row.project_id:null),expandRowByClick:true,showExpandColumn:false}}/></section>
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
      <section className={styles.detailSection}><h3>Financial pulse</h3><dl><div><dt>Still owed</dt><dd>{currency(row.outstanding_ar)}</dd></div><div><dt>Past due</dt><dd className={Number(row.overdue_ar||0)>0?styles.pastDue:undefined}>{currency(row.overdue_ar)}</dd></div><div><dt>Cash collected</dt><dd>{currency(row.cash_collected)}</dd></div></dl>{billedPercent!==null&&<div className={styles.progressBlock}><div><span>Contract billed</span><span>{billedPercent.toFixed(0)}% · {currency(billed)} / {currency(authorized)}</span></div><progress aria-label="Contract billed" max={100} value={Math.min(100,Math.max(0,billedPercent))}/></div>}{collectedPercent!==null&&<div className={styles.progressBlock}><div><span>Billed amount collected</span><span>{collectedPercent.toFixed(0)}% · {currency(collected)} / {currency(billed)}</span></div><progress aria-label="Billed amount collected" max={100} value={Math.min(100,Math.max(0,collectedPercent))}/></div>}</section>
      <section className={styles.detailSection}><h3>Next actions</h3><div className={styles.drawerLinks}><Link href={`/projects/${encodeURIComponent(row.project_id)}`}>Open project record</Link><Link href="/financials?tab=billing&view=invoices">Review invoices</Link><Link href="/financials?tab=billing&view=payments">Review payments</Link></div><p className={styles.drawerNote}>These values come from the authoritative billing summary. Edit invoices and payments in their owning workflows.</p></section>
    </div>
  </div>;
}
