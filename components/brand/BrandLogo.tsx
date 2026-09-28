import {useId} from 'react';
import {cn} from '@/lib/utils';

type BrandLogoProps={size?:'sm'|'md'|'lg';iconOnly?:boolean;className?:string};

const sizes={sm:'h-[31px] w-[128px]',md:'h-[43px] w-[178px]',lg:'h-[54px] w-[223px]'};
const viewWidth=1591;
const viewHeight=385;
const markWidth=425;

export function BrandLogo({size='md',iconOnly=false,className}:BrandLogoProps){
  const id=useId().replaceAll(':','');
  const inkMask=`pt-logo-ink-${id}`;
  const accentMask=`pt-logo-accent-${id}`;
  const markClip=`pt-logo-mark-${id}`;
  const typeClip=`pt-logo-type-${id}`;

  return <svg
    aria-label="Pourtrace home"
    role="img"
    viewBox={`0 0 ${iconOnly?markWidth:viewWidth} ${viewHeight}`}
    className={cn('pt-brand-logo',iconOnly?'aspect-[425/385] h-auto w-9':sizes[size],className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <mask id={inkMask} maskUnits="userSpaceOnUse" style={{maskType:'alpha'}}>
        <image href="/brand/pourtrace-logo-ink-mask.png" width={viewWidth} height={viewHeight}/>
      </mask>
      <mask id={accentMask} maskUnits="userSpaceOnUse" style={{maskType:'alpha'}}>
        <image href="/brand/pourtrace-logo-accent-mask.png" width={viewWidth} height={viewHeight}/>
      </mask>
      <clipPath id={markClip}><rect width={markWidth} height={viewHeight}/></clipPath>
      <clipPath id={typeClip}><rect x={markWidth} width={viewWidth-markWidth} height={viewHeight}/></clipPath>
    </defs>
    <g aria-hidden="true" clipPath={`url(#${markClip})`}>
      <g className="pt-brand-logo__mark-ink"><rect className="pt-brand-logo__ink" width={viewWidth} height={viewHeight} fill="var(--ink)" mask={`url(#${inkMask})`}/></g>
      <g className="pt-brand-logo__mark-accent"><rect className="pt-brand-logo__accent" width={viewWidth} height={viewHeight} fill="var(--logo)" mask={`url(#${accentMask})`}/></g>
    </g>
    {!iconOnly&&<g aria-hidden="true" clipPath={`url(#${typeClip})`}>
      <rect className="pt-brand-logo__ink" width={viewWidth} height={viewHeight} fill="var(--ink)" mask={`url(#${inkMask})`}/>
      <rect className="pt-brand-logo__accent" width={viewWidth} height={viewHeight} fill="var(--logo)" mask={`url(#${accentMask})`}/>
    </g>}
  </svg>;
}
