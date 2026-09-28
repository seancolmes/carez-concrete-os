import Link from 'next/link';
import {ArrowUpRight,CalendarDays,CheckCheck,Clock3,ShieldAlert} from 'lucide-react';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import styles from './TodaySurface.module.css';

type Attention={tone:'danger'|'warning'|'info';subject:string;issue:string;when:string;href:string;action:string};
type FieldWork={id:string;project:string;title:string;time:string;href:string};
type Operation={id:string;time:string;project:string;operation:string;status:string;tone:'success'|'blocked'|'neutral';href:string};
type PlanningJob={id:string;project:string;nextAction:string;held:boolean;href:string};
type Metric={label:string;value:string;detail:string};

export function TodaySurface({date,dateISO,weekEnd,attention,fieldWork,scheduleUnavailable,operations,planningJobs,metrics,openLeads,openProposals,proposalValue,nextFollowUp,customersOwe,expectedIn,expectedOut,cashNet}:{
  date:string;dateISO:string;weekEnd:string;attention:Attention[];fieldWork:FieldWork[];scheduleUnavailable:boolean;operations:Operation[];planningJobs:PlanningJob[];metrics:Metric[];openLeads:string;openProposals:string;proposalValue:string;nextFollowUp:string;customersOwe:string;expectedIn:string;expectedOut:string;cashNet:string;
}){
  return <div className={`${styles.surface} today-surface`}>
    <header className={styles.hero}>
      <div className={styles.heroTitle}>
        <h1>Overview</h1>
        <time dateTime={dateISO}>{date}</time>
      </div>
      <div className={styles.heroContext}><p>{attention.length?`${attention.length} item${attention.length===1?'':'s'} flagged for review`:'Review current work and source availability below'}</p><Link href="/schedule">Open schedule <ArrowUpRight aria-hidden="true" size={17}/></Link></div>
    </header>

    <div className={styles.topGrid}>
      <section aria-labelledby="today-attention-heading" className={styles.attention}>
        <div className={styles.sectionHead}><h2 id="today-attention-heading">Needs action</h2><span>{attention.length?`${attention.length} to review`:'No flagged items'}</span></div>
        {attention.length?<div className={styles.attentionList}>{attention.slice(0,8).map((item,index)=><article key={`${item.subject}-${index}`} className={styles.attentionRow}>
          <div className={styles.attentionMain}><span className={`${styles.tone} ${styles[item.tone]}`} aria-hidden="true"><ShieldAlert size={17}/></span><div><h3>{item.subject}</h3><p>{item.issue}</p></div></div>
          <div className={styles.attentionMeta}><span>{item.when}</span><Link href={item.href}>{item.action}<ArrowUpRight aria-hidden="true" size={16}/></Link></div>
        </article>)}</div>:<div className={styles.emptyLine}><CheckCheck aria-hidden="true" size={20}/><span>No items are flagged here. Upcoming work remains below.</span></div>}
      </section>

      <section aria-labelledby="today-work-heading" className={styles.field}>
        <div className={styles.sectionHead}><h2 id="today-work-heading">Field today</h2><span>{scheduleUnavailable?'Schedule unavailable':`${fieldWork.length} scheduled`}</span></div>
        {scheduleUnavailable?<p className={styles.fieldEmpty}>Schedule unavailable. <Link href="/schedule">Open Schedule</Link> to try again.</p>:fieldWork.length?<div className={styles.fieldList}>{fieldWork.map(item=><div key={item.id} className={styles.fieldRow}><CalendarDays aria-hidden="true" size={18}/><div><strong>{item.project}</strong><p>{item.title} · {item.time}</p></div><Link href={item.href} aria-label={`View ${item.project}`}><ArrowUpRight aria-hidden="true" size={18}/></Link></div>)}</div>:<div className={styles.fieldEmpty}><CalendarDays aria-hidden="true" size={20}/><p><strong>No production scheduled today.</strong><span>The field schedule is clear.</span></p><Link href="/schedule">Open Schedule <ArrowUpRight aria-hidden="true" size={16}/></Link></div>}
      </section>
    </div>

    <section aria-labelledby="today-operations-heading" className={styles.operations}>
      <div className={styles.sectionHead}><h2 id="today-operations-heading">Upcoming operations</h2><span>{scheduleUnavailable?'Schedule unavailable':`${operations.length} coming up`}</span></div>
      {scheduleUnavailable?<p className={styles.operationsEmpty}>Schedule unavailable. <Link href="/schedule">Open Schedule</Link> to try again.</p>:operations.length?<div className={styles.tableScroll}><table><thead><tr><th>When</th><th>Project</th><th>Operation</th><th>Status</th></tr></thead><tbody>{operations.map(row=><tr key={row.id}><td>{row.time}</td><td><Link href={row.href}>{row.project}</Link></td><td>{row.operation}</td><td><span className={`${styles.operationStatus} ${styles[row.tone]}`}>{row.status}</span></td></tr>)}</tbody></table></div>:<div className={styles.operationsEmpty}><Clock3 aria-hidden="true" size={19}/><span>No operations are scheduled. Plan the next work from a project.</span></div>}
      {!scheduleUnavailable&&planningJobs.length?<div className={styles.planning}><h3>Needs scheduling</h3>{planningJobs.map(job=><div key={job.id} className={styles.planningRow}><div><strong>{job.project}</strong><p>{job.nextAction}</p></div><Link href={job.href}>{job.held?'Clear hold':'Open project'} <ArrowUpRight aria-hidden="true" size={16}/></Link></div>)}</div>:null}
    </section>

    <section aria-labelledby="today-status-heading" className={styles.status}>
      <div className={styles.sectionHead}><h2 id="today-status-heading">Operating summary</h2><span>Current projects · {date} to {weekEnd}</span></div>
      <dl className={styles.metrics}>{metrics.map((metric,index)=><div key={metric.label} className={index<3?styles.metricWork:styles.metricFinance}><dt>{metric.label}</dt><dd>{metric.value}</dd><p>{metric.detail}</p></div>)}</dl>
    </section>

    <section aria-labelledby="today-business-heading" className={styles.business}>
      <div className={styles.sectionHead}><h2 id="today-business-heading">Business pulse</h2><span>Pipeline and cash</span></div>
      <Tabs defaultValue="pipeline" className={styles.tabs}><TabsList variant="line" className={styles.tabList}><TabsTrigger value="pipeline">Pipeline</TabsTrigger><TabsTrigger value="cash">Cash</TabsTrigger></TabsList>
        <TabsContent value="pipeline"><dl className={styles.businessList}><div><dt>Open leads</dt><dd>{openLeads}</dd></div><div><dt>Proposals out</dt><dd>{openProposals}</dd></div><div><dt>Proposal value</dt><dd>{proposalValue}</dd></div><div><dt>Next follow-up</dt><dd>{nextFollowUp}</dd></div></dl></TabsContent>
        <TabsContent value="cash"><dl className={styles.businessList}><div><dt>Customers owe</dt><dd>{customersOwe}</dd></div><div><dt>Expected in · 7 days</dt><dd>{expectedIn}</dd></div><div><dt>Expected out · 7 days</dt><dd>{expectedOut}</dd></div><div><dt>7-day net</dt><dd>{cashNet}</dd></div></dl></TabsContent>
      </Tabs>
    </section>
  </div>;
}
