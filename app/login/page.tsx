'use client';

import {useCallback,useLayoutEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AnimatePresence} from 'framer-motion';
import {ArrowRightRegular as ArrowRight} from '@fluentui/react-icons';
import {LoginForm} from '@/components/auth/LoginForm';
import {FieldFootage} from '@/components/landing/FieldFootage';
import {AnimatedLogo} from '@/components/brand/AnimatedLogo';
import {SplashScreen} from '@/components/brand/SplashScreen';
import styles from './Landing.module.css';

const steps=[
  {number:'1',title:'Measure',promise:'Know the quantity.',detail:'Keep concrete takeoff tied to the drawing, assembly, and scope it came from.'},
  {number:'2',title:'Price',promise:'Know the cost.',detail:'Turn quantities into labor, material, equipment, markup, and sell price.'},
  {number:'3',title:'Pour',promise:'Know what happened.',detail:'Connect pour schedules, crew production, truck quantities, and actual concrete placed.'},
  {number:'4',title:'Bill',promise:'Know what gets paid.',detail:'Carry completed work into progress billing, change orders, SOVs, and retainage.'},
] as const;

const capabilities=[
  {name:'Takeoff',detail:'Plan-linked concrete quantities'},
  {name:'Estimating',detail:'Labor, material, equipment + sell'},
  {name:'Scheduling',detail:'Pour windows + crew readiness'},
  {name:'Field production',detail:'Actual quantities + production'},
  {name:'Change orders',detail:'Scope changes tied to the job'},
  {name:'Billing',detail:'SOV progress + retainage'},
  {name:'Actual quantities',detail:'Estimated vs. placed'},
] as const;

export default function LoginPage(){
  const router=useRouter();
  const [bootPhase,setBootPhase]=useState<'checking'|'playing'|'exiting'|'done'>('checking');
  const finishBoot=useCallback(()=>{
    try{sessionStorage.setItem('pourtrace-landing-boot','seen');}catch{}
    setBootPhase('exiting');
  },[]);

  useLayoutEffect(()=>{
    let active=true;
    let skip=false;
    try{skip=sessionStorage.getItem('pourtrace-landing-boot')==='seen';}catch{}
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)skip=true;
    if(skip)setBootPhase('done');
    void fetch('/api/auth/workspace-readiness',{cache:'no-store',credentials:'same-origin'}).then(async response=>{
      if(!active)return;
      if(!response.ok){if(!skip)setBootPhase('playing');return;}
      const data=await response.json() as {destination?:string};
      if(active)router.replace(data.destination||'/');
    }).catch(()=>{if(active&&!skip)setBootPhase('playing');});
    return()=>{active=false;};
  },[router]);

  return <>
    <main className={styles.page} inert={bootPhase==='checking'||bootPhase==='playing'}>
      <header className={styles.header}>
        <Link href="/login" className={styles.wordmark} aria-label="Pourtrace home">
          {bootPhase==='exiting'||bootPhase==='done'?<AnimatedLogo idPrefix="login-navigation"/>:<span className={styles.logoPlace}/>}
        </Link>
        <nav aria-label="Page navigation" className={styles.nav}>
          <Link href="#platform" className={styles.navLink}>How it works <ArrowRight fontSize={16} aria-hidden="true"/></Link>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="landing-heading">
        <FieldFootage/>
        <div className={styles.heroShade} aria-hidden="true"/>
        <div className={styles.heroInner}>
          <div className={styles.loginPanel}><LoginForm idPrefix="landing"/></div>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><span className={styles.eyebrowRule}/> From Takeoff To Closeout</span>
            <h1 id="landing-heading">Run concrete. Not spreadsheets.</h1>
            <p>One operating system for takeoffs, estimates, pour schedules, field production, quantities, and job financials.</p>
            <Link href="#platform" className={styles.exploreLink}>See how PourTrace works <ArrowRight fontSize={18} aria-hidden="true"/></Link>
          </div>
        </div>
      </section>

      <section id="platform" className={styles.platform} aria-labelledby="platform-heading">
        <div className={styles.platformIntro}>
          <span className={styles.sectionKicker}>The flow</span>
          <h2 id="platform-heading">What you bid.<br/>What you pour.<br/>What you bill.</h2>
          <p>PourTrace carries the same quantities from plan takeoff through estimating, field production, and billing—so the office and field stay on the same numbers.</p>
        </div>
        <ol className={styles.stepList}>{steps.map(step=><li key={step.number}>
          <span className={styles.stepNumber}>{step.number}</span>
          <div><h3>{step.title}</h3><strong>{step.promise}</strong><p>{step.detail}</p></div>
        </li>)}</ol>
      </section>

      <section className={styles.productProof} aria-labelledby="product-proof-heading">
        <div className={styles.productProofIntro}>
          <span className={styles.sectionKicker}>Estimating + field</span>
          <h2 id="product-proof-heading">The field works from the same numbers you estimated.</h2>
          <p>Quantities don&apos;t disappear into spreadsheets when the project leaves preconstruction.</p>
        </div>
        <figure className={styles.productFrame}>
          <div className={styles.productWindow} aria-hidden="true">
            <div className={styles.productTitlebar}>
              <span className={styles.productMark}>P</span>
              <span>PourTrace</span>
              <span className={styles.productTitleDivider}/>
              <span className={styles.productTitleMuted}>Project workspace</span>
              <span className={styles.productWindowLabel}>ILLUSTRATIVE PREVIEW</span>
            </div>
            <div className={styles.productToolbar}>
              <div><span className={styles.productCrumb}>Sample job</span><span className={styles.productCrumbDivider}>/</span><strong>Quantity record</strong></div>
              <div className={styles.productToolbarMeta}><span className={styles.productLiveDot}/>Drawing → estimate → field → bill</div>
            </div>
            <div className={styles.productWorkspace}>
              <div className={styles.productDrawingPane}>
                <div className={styles.productPaneHeading}><span>01 / SOURCE DRAWING</span><span>FOUNDATION PLAN</span></div>
                <div className={styles.productDrawing}>
                  <svg viewBox="0 0 500 330" role="presentation" focusable="false">
                    <defs><pattern id="proof-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#344653" strokeWidth=".55"/></pattern></defs>
                    <rect width="500" height="330" fill="url(#proof-grid)"/>
                    <g fill="none" stroke="#728D9D" strokeWidth="2"><path d="M62 62H405V265H62Z"/><path d="M126 62V265M337 62V265M62 139H405M62 221H405"/><path d="M126 139H337V221H126Z"/></g>
                    <g fill="none" stroke="#E97832" strokeWidth="3"><path d="M126 139H337V221H126Z"/><path d="M118 131h16m-8-8v16M329 131h16m-8-8v16M118 213h16m-8-8v16M329 213h16m-8-8v16"/></g>
                    <g fill="#A8ADB0" fontFamily="monospace" fontSize="10"><text x="62" y="48">A</text><text x="397" y="48">D</text><text x="42" y="142">2</text><text x="42" y="265">4</text><text x="190" y="186" fill="#F2F0EA">S-01 · SLAB</text></g>
                  </svg>
                  <span className={styles.productDrawingTag}>S-01 · Slab on grade</span>
                </div>
                <div className={styles.productDrawingFoot}><span>TAKEOFF SOURCE</span><strong>Plan A-101 · Rev 3</strong></div>
              </div>
              <div className={styles.productDataPane}>
                <div className={styles.productPaneHeading}><span>02 / CONNECTED QUANTITIES</span><span>ONE JOB RECORD</span></div>
                <div className={styles.productScope}><span className={styles.productScopeCode}>S-01</span><div><strong>Slab on grade</strong><span>Measured from plan · Assembly linked</span></div></div>
                <div className={styles.productQuantity}><span>PLAN QUANTITY</span><strong>128.4 <small>CY</small></strong></div>
                <div className={styles.productStageList}>
                  <div><span>ESTIMATE</span><strong>128.4 CY</strong><small>Cost + sell from measured scope</small></div>
                  <div><span>FIELD</span><strong>126.0 CY</strong><small>Actual placed quantity recorded</small></div>
                  <div><span>BILLING</span><strong>Linked</strong><small>Completed work follows the SOV</small></div>
                </div>
              </div>
            </div>
          </div>
          <figcaption>Illustrative preview of a connected PourTrace job record.</figcaption>
        </figure>
      </section>

      <section className={styles.capabilities} aria-labelledby="capabilities-heading">
        <div className={styles.capabilitiesIntro}>
          <span className={styles.sectionKicker}>Built for concrete</span>
          <h2 id="capabilities-heading">The tools behind the job.</h2>
        </div>
        <ul className={styles.capabilityList}>{capabilities.map(capability=><li key={capability.name}><strong>{capability.name}</strong><span>{capability.detail}</span></li>)}</ul>
      </section>
    </main>
    <AnimatePresence onExitComplete={()=>setBootPhase('done')}>{bootPhase==='checking'||bootPhase==='playing'?<SplashScreen key="pourtrace-boot" playing={bootPhase==='playing'} onComplete={finishBoot}/>:null}</AnimatePresence>
  </>;
}
