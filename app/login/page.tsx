'use client';

import {useCallback,useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import Link from 'next/link';
import {Button} from '@fluentui/react-components';
import {useRouter} from 'next/navigation';
import {AnimatePresence,motion,useMotionTemplate,useMotionValue,useSpring} from 'framer-motion';
import { ArrowDownRegular as ArrowDown, ArrowRightRegular as ArrowRight, ArrowUpRightRegular as ArrowUpRight, ChevronDownRegular as ChevronDown, PersonWrenchRegular as HardHat, LayerRegular as Layers3, RulerRegular as Ruler, VehicleTruckRegular as Truck, WalletRegular as Wallet } from '@fluentui/react-icons';
import {LoginForm} from '@/components/auth/LoginForm';
import {WorkspaceLoginDialog} from '@/components/auth/WorkspaceLoginDialog';
import {FieldFootage} from '@/components/landing/FieldFootage';
import {AnimatedLogo} from '@/components/brand/AnimatedLogo';
import {SplashScreen} from '@/components/brand/SplashScreen';
import {MetricBentoTile} from '@/components/projects/MetricBentoTile';
import {CSICostCodeStrip} from '@/components/estimating/CSICostCodeStrip';
import {TakeoffThumbnail} from '@/components/takeoff/TakeoffThumbnail';
import styles from './Landing.module.css';

const heroSteps=[
  {number:'01',eyebrow:'SOURCE',name:'Plan & conditions',detail:'Scope starts at the drawing.'},
  {number:'02',eyebrow:'QUANTITY',name:'2D takeoff',detail:'Measured geometry stays traceable.'},
  {number:'03',eyebrow:'COMMERCIAL',name:'Estimate & proposal',detail:'Quantity, cost, and sell stay distinct.'},
  {number:'04',eyebrow:'EXECUTION',name:'Project & field',detail:'Readiness and production follow award.'},
] as const;

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
const calculationLogs=['> Calculating Div 03 quantities...','> Volume: 450 CY · source: 2D takeoff','> Direct cost: $45,000 · illustrative','> Estimate ready for human review'] as const;

function WorkflowWindow({step,logIndex}:{step:number;logIndex:number}){
  if(step===2)return <div className={styles.windowContent}>
    <div className={styles.windowLabel}>03 / PRICE · ILLUSTRATIVE DATA</div>
    <CSICostCodeStrip code="03 30 00" name="Cast-in-Place" actual={400} estimated={500} unit="CY" budget={1000} spent={550} animateOnMount/>
    <div className={styles.mathTerminal} aria-label="Illustrative calculation sequence">{calculationLogs.slice(0,logIndex+1).map(line=><div key={line}>{line}</div>)}<span className={styles.terminalCursor} aria-hidden="true">_</span></div>
  </div>;
  if(step===3)return <div className={styles.windowContent}><div className={styles.windowLabel}>04 / DELIVER · ILLUSTRATIVE DATA</div><MetricBentoTile title="Field active" icon={<HardHat/>} value={3} description="Illustrative active shifts"/></div>;
  if(step===4)return <div className={styles.windowContent}><div className={styles.windowLabel}>05 / ACCOUNT · ILLUSTRATIVE DATA</div><MetricBentoTile title="Customers owe" icon={<Wallet/>} value={0} prefix="$" description="Illustrative customer balance"/></div>;
  return <div className={styles.windowContent}><div className={styles.windowLabel}>{step===0?'01 / PLAN':'02 / MEASURE'} · ILLUSTRATIVE DATA</div><div className={styles.windowTakeoff}><TakeoffThumbnail/></div><p className={styles.windowHint}>{step===0?'Start with the source drawing and Concrete Conditions.':'Keep measured geometry tied to the plan revision.'}</p></div>;
}

function CapabilityCard({item}:{item:(typeof capabilities)[number]}){
  const x=useMotionValue(0);
  const y=useMotionValue(0);
  const intensity=useMotionValue(0);
  const opacity=useSpring(intensity,{stiffness:220,damping:26});
  const glow=useMotionTemplate`radial-gradient(280px circle at ${x}px ${y}px, rgba(237,237,237,.06), transparent 72%)`;
  return <motion.article onPointerEnter={()=>intensity.set(1)} onPointerLeave={()=>intensity.set(0)} onPointerMove={event=>{const bounds=event.currentTarget.getBoundingClientRect();x.set(event.clientX-bounds.left);y.set(event.clientY-bounds.top);}}>
    <motion.span className={styles.cardGlow} style={{backgroundImage:glow,opacity}} aria-hidden="true"/>
    <div className={styles.cardContent}><item.icon fontSize={22} aria-hidden="true"/><h3>{item.title}</h3><p>{item.body}</p></div>
  </motion.article>;
}

export default function LoginPage(){
  const router=useRouter();
  const heroRef=useRef<HTMLElement>(null);
  const workflowRef=useRef<HTMLElement>(null);
  const [activeStep,setActiveStep]=useState<(typeof heroSteps)[number]['number']>('02');
  const [workflowVisible,setWorkflowVisible]=useState(false);
  const [activeWorkflow,setActiveWorkflow]=useState(0);
  const [logIndex,setLogIndex]=useState(0);
  const [bootPhase,setBootPhase]=useState<'checking'|'playing'|'exiting'|'done'>('checking');
  const [loginOpen,setLoginOpen]=useState(false);
  const [learnMoreOpen,setLearnMoreOpen]=useState(false);
  const [detailsUnclipped,setDetailsUnclipped]=useState(false);
  const [heroActivity,setHeroActivity]=useState(0);
  const [idleHint,setIdleHint]=useState(false);
  const finishBoot=useCallback(()=>{
    try{sessionStorage.setItem('pourtrace-landing-boot','seen');}catch{}
    setBootPhase('exiting');
  },[learnMoreOpen]);
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

  useEffect(()=>{
    const target=workflowRef.current;
    if(!target)return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window)){
      setWorkflowVisible(true);
      return;
    }
    const observer=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){setWorkflowVisible(true);observer.disconnect();}
    },{threshold:0.15});
    observer.observe(target);
    return()=>observer.disconnect();
  },[learnMoreOpen]);

  useEffect(()=>{
    if(learnMoreOpen||loginOpen||bootPhase!=='done')return;
    const timer=window.setTimeout(()=>setIdleHint(true),5000);
    return()=>window.clearTimeout(timer);
  },[learnMoreOpen,loginOpen,bootPhase,heroActivity]);

  useEffect(()=>{
    let frame=0;
    const update=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const section=workflowRef.current;
        if(!section)return;
        const bounds=section.getBoundingClientRect();
        if(bounds.bottom<0||bounds.top>window.innerHeight)return;
        const rows=Array.from(section.querySelectorAll<HTMLElement>('[data-workflow-step]'));
        let closest=0,shortest=Infinity;
        rows.forEach((row,index)=>{const distance=Math.abs(row.getBoundingClientRect().top-window.innerHeight*.4);if(distance<shortest){closest=index;shortest=distance;}});
        setActiveWorkflow(closest);
      });
    };
    window.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update);
    update();
    return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);cancelAnimationFrame(frame);};
  },[]);

  useEffect(()=>{
    if(activeWorkflow!==2){setLogIndex(0);return;}
    setLogIndex(0);
    const timer=window.setInterval(()=>setLogIndex(index=>Math.min(index+1,calculationLogs.length-1)),230);
    return()=>window.clearInterval(timer);
  },[activeWorkflow]);

  const moveBlueprint=(event:PointerEvent<HTMLElement>)=>{
    if(event.pointerType==='touch'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const hero=heroRef.current;
    if(!hero)return;
    const bounds=hero.getBoundingClientRect();
    hero.style.setProperty('--grid-x',`${((bounds.width/2-(event.clientX-bounds.left))/bounds.width*16).toFixed(1)}px`);
    hero.style.setProperty('--grid-y',`${((bounds.height/2-(event.clientY-bounds.top))/bounds.height*16).toFixed(1)}px`);
  };
  const resetBlueprint=()=>{
    heroRef.current?.style.setProperty('--grid-x','0px');
    heroRef.current?.style.setProperty('--grid-y','0px');
  };
  const toggleLearnMore=()=>{
    setIdleHint(false);
    setDetailsUnclipped(false);
    setLearnMoreOpen(open=>!open);
  };
  const showSection=(section:'workflow'|'capabilities')=>{
    setIdleHint(false);
    setDetailsUnclipped(false);
    setLearnMoreOpen(true);
    window.setTimeout(()=>document.getElementById(section)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}),500);
  };

  return <><main className={styles.page} inert={bootPhase==='checking'||bootPhase==='playing'}>
    <header className={styles.header}>
      <Link href="/login" className={styles.wordmark} aria-label="Pourtrace home">{bootPhase==='exiting'||bootPhase==='done'?<motion.span layoutId="brand-logo" transition={{layout:{duration:0.7,ease:[0.22,1,0.36,1]}}}><AnimatedLogo idPrefix="login-navigation"/></motion.span>:<span className={styles.logoPlace}/>}</Link>
      <nav aria-label="Page navigation" className={styles.nav}><Button appearance="subtle" type="button" onClick={()=>showSection('workflow')}>How it works</Button><Button appearance="subtle" type="button" onClick={()=>showSection('capabilities')}>The platform</Button><Button appearance="subtle" type="button" className={styles.navAccess} onClick={()=>setLoginOpen(true)}><span className={styles.navStatus} aria-hidden="true"/>Workspace sign in <ArrowUpRight fontSize={15} aria-hidden="true"/></Button></nav>
    </header>

    <div className={styles.content}>
      <section ref={heroRef} className={styles.hero} data-boot-complete={bootPhase==='exiting'||bootPhase==='done'} aria-labelledby="landing-heading" onPointerMove={moveBlueprint} onPointerLeave={resetBlueprint} onClickCapture={()=>{setIdleHint(false);setHeroActivity(value=>value+1);}}>
        <div className={styles.heroCopy}>
          <h1 id="landing-heading" className="font-sans font-extrabold tracking-tight">From the drawing to the <em>day’s work.</em></h1>
          <p>Pourtrace keeps concrete takeoff, estimates, project operations, field production, and billing connected to the same job.</p>
          <div className={styles.heroActions}><Button appearance="subtle" type="button" className={styles.primaryAction} onClick={()=>setLoginOpen(true)}>Sign in to your workspace <ArrowUpRight fontSize={18} aria-hidden="true"/></Button><Button appearance="subtle" type="button" className={styles.textAction} onClick={()=>showSection('workflow')}>See the workflow <ArrowDown fontSize={17} aria-hidden="true"/></Button></div>
        </div>
        <div className={styles.heroVisual} aria-label="Illustration of a concrete job record moving from plans to field work">
          <div className={styles.visualTop}><span>Concrete job record</span><span>Drawing → field</span></div>
          <div className={styles.visualBody}><div className={styles.visualSpine} aria-hidden="true"/>
            {heroSteps.map(step=><Button appearance="subtle" key={step.number} type="button" className={`${styles.visualStep} ${activeStep===step.number?styles.visualCurrent:''}`} aria-pressed={activeStep===step.number} onMouseEnter={()=>setActiveStep(step.number)} onFocus={()=>setActiveStep(step.number)} onClick={()=>setActiveStep(step.number)}><span className={styles.visualIndex}>{step.number}</span><span className={styles.visualStepCopy}><small>{step.eyebrow}</small><strong>{step.name}</strong><span>{step.detail}</span></span>{activeStep===step.number?<ArrowRight fontSize={17} aria-hidden="true"/>:null}</Button>)}
          </div>
          <div className={`${styles.visualPreview} dark`} aria-label="Illustrative product component preview">
            <div className={styles.visualPreviewLabel}>PRODUCT COMPONENT · ILLUSTRATIVE DATA</div>
            {activeStep==='01'?<p className={styles.visualPreviewMessage}>A plan and its Concrete Conditions establish the source for measured work.</p>:null}
            {activeStep==='02'?<div className={styles.takeoffPreview}><TakeoffThumbnail/></div>:null}
            {activeStep==='03'?<div className={styles.costPreview}>
              <CSICostCodeStrip code="03 30 00" name="Cast-in-Place" actual={400} estimated={500} unit="CY" budget={1000} spent={550} animateOnMount/>
              <CSICostCodeStrip code="03 20 00" name="Reinforcing" actual={260} estimated={400} unit="LF" budget={1000} spent={1120} animateOnMount/>
              <CSICostCodeStrip code="03 10 00" name="Concrete Forming" actual={175} estimated={220} unit="SF" budget={1000} spent={820} animateOnMount/>
            </div>:null}
            {activeStep==='04'?<div className={styles.metricPreview}><MetricBentoTile title="Field active" icon={<HardHat/>} value={3} description="Illustrative active shifts"/></div>:null}
          </div>
          <div className={styles.visualBottom}>Source quantity / Direct cost / Sell</div>
        </div>
        <div className={styles.learnMoreRail}><Button appearance="subtle" type="button" className={styles.learnMoreButton} aria-expanded={learnMoreOpen} onClick={toggleLearnMore}>{learnMoreOpen?'Show less':'Learn more'}<ChevronDown fontSize={17} className={`${idleHint?styles.chevronHint:''} ${learnMoreOpen?styles.chevronOpen:''}`} aria-hidden="true"/></Button></div>
      </section>

      <AnimatePresence initial={false}>{learnMoreOpen&&<motion.div id="landing-details" key="landing-details" className={styles.detailsReveal} initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.5,ease:[0.22,1,0.36,1]}} style={{overflow:detailsUnclipped?'visible':'hidden'}} onAnimationComplete={()=>setDetailsUnclipped(true)}>
      <section ref={workflowRef} className={styles.workflow} id="workflow" aria-labelledby="workflow-heading">
        <svg className={styles.lowerBlueprint} viewBox="0 0 1200 650" aria-hidden="true" focusable="false"><path d="M0 540 L145 520 L260 468 L375 486 L490 390 L610 412 L735 292 L850 320 L975 172 L1100 205 L1200 95"/><path d="M0 610 L200 610 L200 425 L455 425 L455 235 L700 235 L700 95 L1200 95" strokeDasharray="9 14"/></svg>
        <div className={styles.sectionMeta}>THE PLATFORM</div>
        <div className={styles.sectionLead}><h2 id="workflow-heading">From takeoff to billing, without a reset.</h2><p>Plans, quantities, estimates, field work, and financials stay attached to the same project.</p></div>
        <div className={styles.workflowBody}>
          <ol className={styles.stageList}>{stages.map((stage,index)=><li key={stage.number} data-workflow-step data-active={activeWorkflow===index}><Button appearance="subtle" type="button" onMouseEnter={()=>setActiveWorkflow(index)} onFocus={()=>setActiveWorkflow(index)} onClick={()=>setActiveWorkflow(index)} aria-current={activeWorkflow===index?'step':undefined}><span>{stage.number}</span><span><strong>{stage.name}</strong><small>{stage.detail}</small></span></Button></li>)}</ol>
          <div className={styles.workflowWindowRail}><div className={`${styles.osWindow} ${styles.workflowLive}`} data-visible={workflowVisible} aria-label="Illustrative Pourtrace app window" aria-hidden={!workflowVisible}>
            <div className={styles.windowChrome}><span><i/><i/><i/></span><span>POURTRACE / JOB WORKSPACE</span></div>
            <AnimatePresence mode="wait" initial={false}><motion.div key={activeWorkflow} initial={{opacity:0,x:16,y:8}} animate={{opacity:1,x:0,y:0}} exit={{opacity:0,x:-12,y:-6}} transition={{duration:0.22}}><WorkflowWindow step={activeWorkflow} logIndex={logIndex}/></motion.div></AnimatePresence>
          </div></div>
        </div>
      </section>

      <section className={styles.capabilities} id="capabilities" aria-labelledby="capabilities-heading">
        <div className={styles.sectionMeta}>CONNECTED DATA</div>
        <div className={styles.sectionLead}><h2 id="capabilities-heading">What the team can trace.</h2><p>Each decision has a source: a drawing, an estimate, a schedule, or a field record.</p></div>
        <div className={styles.capabilityGrid}>{capabilities.map(item=><CapabilityCard key={item.title} item={item}/>)}</div>
      </section>

      <section className={styles.authority} aria-labelledby="authority-heading"><div className={styles.sectionMeta}>YOUR TEAM DECIDES</div><div className={styles.authorityCopy}><h2 id="authority-heading">The final call stays with your team.</h2><p>Pourtrace keeps source quantities, cost, pricing, and field progress visible. Your team remains responsible for scope, methods, approvals, and commercial decisions.</p></div><div className={styles.authorityImage}><FieldFootage/></div></section>

      <section className={styles.access} id="workspace-access" aria-labelledby="access-heading"><div className={styles.sectionMeta}>WORKSPACE ACCESS</div><div className={styles.accessIntro}><h2 id="access-heading">Access your company workspace.</h2><p>Use the account linked to your organization to review current project and field work.</p></div><div className={styles.formFrame}><LoginForm/></div></section>
      </motion.div>}</AnimatePresence>
    </div>
    {learnMoreOpen&&<footer className={styles.footer}><span>System status: ready <span className={styles.footerDot} aria-hidden="true"/> · Local preview</span><a href="#landing-heading">Back to top ↑</a></footer>}
  </main><WorkspaceLoginDialog open={loginOpen} onOpenChange={setLoginOpen}/><AnimatePresence onExitComplete={()=>setBootPhase('done')}>{bootPhase==='checking'||bootPhase==='playing'?<SplashScreen key="pourtrace-boot" playing={bootPhase==='playing'} onComplete={finishBoot}/>:null}</AnimatePresence></>;
}
