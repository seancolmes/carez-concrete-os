'use client';

import { useState } from 'react';
import styles from './LoginSpatialBlueprint.module.css';

const stages = [
  { label: 'Plan', note: 'Start with a clear scope.' },
  { label: 'Dimensions', note: 'Every dimension has a place.' },
  { label: 'Concrete', note: 'See the work take shape.' },
  { label: 'Control', note: 'Carry the scope into the field.' },
];

/** Illustrative geometry only. No project data, records or quantity engine. */
export function LoginSpatialBlueprint() {
  const [stage, setStage] = useState(2);
  return <div className={styles.blueprint} data-stage={stage}>
    <div className={styles.caption}><span>Carez / Spatial workspace</span><span>Illustrative scope</span></div>
    <svg className={styles.drawing} viewBox="0 0 640 340" role="img" aria-label={`${stages[stage].label}: an illustrative concrete foundation developed from plan linework`}>
      <g className={styles.grid} fill="none">
        {[0,1,2,3,4,5,6,7,8].map(i=><path key={i} d={`M ${64+i*40} ${156-i*18} l 256 116 M ${64+i*32} ${156+i*14.5} l 320 -144`}/>)}
      </g>
      <g className={styles.datumLines} fill="none">
        <path d="M 32 156 H 608 M 320 14 V 316" />
        <circle cx="320" cy="156" r="5" />
        <path d="M 64 150 V 162 M 58 156 H 70 M 576 150 V 162 M 570 156 H 582"/>
      </g>
      <g className={styles.plan} fill="none">
        <path d="M 136 166 L 328 80 L 520 166 L 328 252 Z" />
        <path d="M 160 166 L 328 91 L 496 166 L 328 241 Z" />
        <path d="M 232 123 L 424 209 M 232 209 L 424 123" strokeDasharray="5 5" />
      </g>
      <g className={styles.sides}>
        <path className={styles.faceLeft} d="M 136 102 L 328 188 V 252 L 136 166 Z" />
        <path className={styles.faceRight} d="M 328 188 L 520 102 V 166 L 328 252 Z" />
      </g>
      <g className={styles.top}>
        <path className={styles.slab} d="M 136 166 L 328 80 L 520 166 L 328 252 Z" />
        <path className={styles.topLine} d="M 160 166 L 328 91 L 496 166 L 328 241 Z M 232 123 L 424 209 M 232 209 L 424 123" fill="none" />
      </g>
      <g className={styles.dimensions} fill="none">
        <path d="M 121 177 L 313 263 M 117 170 L 125 184 M 309 256 L 317 270 M 343 263 L 535 177 M 339 256 L 347 270 M 531 170 L 539 184" />
        <path d="M 542 102 V 166 M 536 102 H 548 M 536 166 H 548" />
      </g>
      <g className={styles.dimensionText}><text x="208" y="246" transform="rotate(24 208 246)">Length</text><text x="447" y="238" transform="rotate(-24 447 238)">Width</text><text x="556" y="138">Depth</text></g>
      <g className={styles.control} fill="none">
        <path d="M 424 146 L 476 55 H 582" />
        <circle cx="424" cy="146" r="5" />
        <rect x="464" y="24" width="136" height="32" rx="3" />
        <path d="m 477 40 4 4 8 -9" />
        <text x="497" y="44">Scope connected</text>
      </g>
      <text className={styles.axisLabel} x="42" y="146">A</text>
      <text className={styles.axisLabel} x="583" y="146">B</text>
      <text className={styles.axisLabel} x="330" y="309">Plan datum</text>
    </svg>
    <div className={styles.stages} role="group" aria-label="Explore the Carez spatial language">
      {stages.map((item,index)=><button key={item.label} type="button" aria-pressed={stage===index} onClick={()=>setStage(index)}><span>0{index+1}</span>{item.label}</button>)}
    </div>
    <p className={styles.note} aria-live="polite">{stages[stage].note}</p>
  </div>;
}
