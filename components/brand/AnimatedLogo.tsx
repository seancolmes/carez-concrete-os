import {useId} from 'react';
import {motion} from 'framer-motion';
import {BrandLogo} from '@/components/brand/BrandLogo';
import styles from './AnimatedLogo.module.css';

export function AnimatedLogo({size='md',draw=false}:{size?:'md'|'lg';draw?:boolean}){
  const id=useId().replaceAll(':','');
  const accentMask=`landing-logo-accent-${id}`;
  const revealMask=`landing-logo-reveal-${id}`;

  return <span className={styles.logo} data-size={size} data-drawing={draw}>
    <BrandLogo size="md"/>
    {draw?<svg className={styles.trace} viewBox="0 0 1591 385" aria-hidden="true" focusable="false">
      <defs>
        <mask id={accentMask} maskUnits="userSpaceOnUse" style={{maskType:'alpha'}}>
          <image href="/brand/pourtrace-logo-accent-mask.png" width="1591" height="385"/>
        </mask>
        <mask id={revealMask} maskUnits="userSpaceOnUse">
          <motion.path d="M72 68 L370 123 L333 349" fill="none" stroke="white" strokeWidth="90" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={700} initial={{strokeDashoffset:700}} animate={{strokeDashoffset:0}} transition={{duration:1.5,ease:[0.4,0,0.2,1]}}/>
        </mask>
      </defs>
      <g mask={`url(#${revealMask})`}><rect width="425" height="385" fill="var(--logo)" mask={`url(#${accentMask})`}/></g>
    </svg>:null}
  </span>;
}
