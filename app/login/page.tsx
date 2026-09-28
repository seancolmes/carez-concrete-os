'use client';

import {useEffect} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowDown,ArrowRight,ArrowUpRight,Layers3,Ruler,Truck,Wallet} from 'lucide-react';
import {LoginForm} from '@/components/auth/LoginForm';
import styles from './Landing.module.css';

const stages=[
  {number:'01',name:'Plan',detail:'Read the drawings and Concrete Conditions.'},
  {number:'02',name:'Measure',detail:'Keep the 2D takeoff tied to its source.'},
  {number:'03',name:'Price',detail:'Build the estimate and proposal from the scope.'},
  {number:'04',name:'Deliver',detail:'Carry awarded work into field production.'},
  {number:'05',name:'Account',detail:'Follow cost, changes, and billing through closeout.'},
];
const capabilities=[
  {icon:Ruler,title:'Takeoff with a source',body:'Measure from plans, retain the geometry, and bring concrete scope into the estimate.'},
  {icon:Layers3,title:'A continuous project record',body:'Move from opportunity to award and production without losing the decisions that shaped the work.'},
  {icon:Truck,title:'Field work in context',body:'Connect schedules, readiness, crews, and recorded production to the project they belong to.'},
  {icon:Wallet,title:'Commercial clarity',body:'Keep quantities, direct cost, sell, changes, and billing distinct as the job moves forward.'},
];

export default function LoginPage(){
  const router=useRouter();
  useEffect(()=>{
    let active=true;
    void fetch('/api/auth/workspace-readiness',{cache:'no-store',credentials:'same-origin'}).then(async response=>{
      if(!active||!response.ok)return;
      const data=await response.json() as {destination?:string};
      if(active)router.replace(data.destination||'/');
    }).catch(()=>{});
    return()=>{active=false;};
  },[router]);

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/login" className={styles.wordmark} aria-label="Pourtrace home"><span className={styles.mark} aria-hidden="true"><span/><span/><span/></span><span>Pourtrace</span></Link>
      <nav aria-label="Page navigation" className={styles.nav}><a href="#workflow">How it works</a><a href="#capabilities">The platform</a><a className={styles.navAccess} href="#workspace-access">Workspace sign in <ArrowUpRight size={15} aria-hidden="true"/></a></nav>
    </header>

    <div className={styles.content}>
      <section className={styles.hero} aria-labelledby="landing-heading">
        <div className={styles.heroCopy}>
          <h1 id="landing-heading">From the drawing to the <em>day’s work.</em></h1>
          <p>Pourtrace keeps concrete takeoff, estimates, project operations, field production, and billing connected to the same job.</p>
          <div className={styles.heroActions}><a className={styles.primaryAction} href="#workspace-access">Sign in to your workspace <ArrowUpRight size={18} aria-hidden="true"/></a><a className={styles.textAction} href="#workflow">See the workflow <ArrowDown size={17} aria-hidden="true"/></a></div>
        </div>
        <div className={styles.heroVisual} aria-label="Illustration of a concrete job record moving from plans to field work">
          <div className={styles.visualTop}><span>CONCRETE JOB RECORD</span><span>DRAWING → FIELD</span></div>
          <div className={styles.visualBody}><div className={styles.visualSpine} aria-hidden="true"/>
            <div className={styles.visualStep}><span className={styles.visualIndex}>01</span><div><small>SOURCE</small><strong>Plan &amp; conditions</strong><span>Scope starts at the drawing.</span></div></div>
            <div className={styles.visualStep}><span className={styles.visualIndex}>02</span><div><small>QUANTITY</small><strong>2D takeoff</strong><span>Measured geometry stays traceable.</span></div></div>
            <div className={styles.visualStep}><span className={styles.visualIndex}>03</span><div><small>COMMERCIAL</small><strong>Estimate &amp; proposal</strong><span>Quantity, cost, and sell stay distinct.</span></div></div>
            <div className={`${styles.visualStep} ${styles.visualCurrent}`}><span className={styles.visualIndex}>04</span><div><small>EXECUTION</small><strong>Project &amp; field</strong><span>Readiness and production follow award.</span></div><ArrowRight size={17} aria-hidden="true"/></div>
          </div>
          <div className={styles.visualBottom}>SOURCE QUANTITY / DIRECT COST / SELL</div>
        </div>
      </section>

      <section className={styles.workflow} id="workflow" aria-labelledby="workflow-heading">
        <div className={styles.sectionLead}><h2 id="workflow-heading">From takeoff to billing, without a reset.</h2><p>Plans, quantities, estimates, field work, and financials stay attached to the same project.</p></div>
        <ol className={styles.stageList}>{stages.map(stage=><li key={stage.number}><span>{stage.number}</span><div><h3>{stage.name}</h3><p>{stage.detail}</p></div></li>)}</ol>
      </section>

      <section className={styles.capabilities} id="capabilities" aria-labelledby="capabilities-heading">
        <div className={styles.sectionLead}><h2 id="capabilities-heading">What the team can trace.</h2><p>Each decision has a source: a drawing, an estimate, a schedule, or a field record.</p></div>
        <div className={styles.capabilityGrid}>{capabilities.map(item=><article key={item.title}><item.icon size={22} strokeWidth={1.6} aria-hidden="true"/><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
      </section>

      <section className={styles.authority} aria-labelledby="authority-heading"><h2 id="authority-heading">The final call stays with your team.</h2><p>Pourtrace keeps source quantities, cost, pricing, and field progress visible. Your team remains responsible for scope, methods, approvals, and commercial decisions.</p></section>

      <section className={styles.access} id="workspace-access" aria-labelledby="access-heading"><div className={styles.accessIntro}><h2 id="access-heading">Access your company workspace.</h2><p>Use the account linked to your organization to review current project and field work.</p></div><div className={styles.formFrame}><LoginForm/></div></section>
    </div>
    <footer className={styles.footer}><span>Pourtrace</span><a href="#landing-heading">Back to top ↑</a></footer>
  </main>;
}
