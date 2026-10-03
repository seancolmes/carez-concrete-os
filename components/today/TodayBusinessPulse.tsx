import Link from 'next/link';
import type {OverviewMetric} from './TodaySurface';

type Props={metrics:OverviewMetric[];action:{title:string;detail:string;href:string;label:string}|null};

export function TodayBusinessPulse({metrics,action}:Props){
  return <section aria-labelledby="today-commercial-heading" className="pb-3 lg:min-h-[150px]">
    <h2 id="today-commercial-heading" className="border-b border-border pb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Commercial / financial</h2>
    <div className="grid grid-cols-2 border-b border-border sm:grid-cols-3 xl:grid-cols-5">{metrics.map((metric,index)=><Link key={metric.label} href={metric.href} className={`min-h-[86px] min-w-0 border-border px-4 py-4 outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${index%2===0?'border-r':''} ${index===1||index===3?'sm:border-r':''} ${index===2?'sm:border-r-0 xl:border-r':''} ${index===4?'xl:border-r-0':''} ${index<4?'border-b xl:border-b-0':''} ${index===3?'sm:border-b-0':''}`} aria-label={`${metric.label}: ${metric.value}. ${metric.detail}`}><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</span><strong className="mt-1 block truncate font-mono text-[22px] font-semibold leading-tight tabular-nums">{metric.value}</strong><span className="block truncate text-xs text-muted-foreground">{metric.detail}</span></Link>)}</div>
    {action?<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"><div><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Next commercial action</span><p className="mt-1 text-sm font-semibold">{action.title}</p><p className="text-xs text-muted-foreground">{action.detail}</p></div><Link href={action.href} className="text-xs font-semibold hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{action.label} →</Link></div>:<p className="py-3 text-xs text-muted-foreground">No recorded commercial action is due right now.</p>}
  </section>;
}
