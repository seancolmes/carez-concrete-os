import {Progress} from '@/components/ui/progress';
import {cn} from '@/lib/utils';

type CSICostCodeStripProps={
  code?:string;
  name?:string;
  completed?:number;
  total?:number;
  unit?:string;
  variance?:number;
};

export function CSICostCodeStrip({code='03 30 00',name='Cast-in-Place',completed=400,total=500,unit='CY',variance=450}:CSICostCodeStripProps){
  const progress=total>0?Math.min(100,Math.max(0,completed/total*100)):0;
  return <div className="flex h-10 min-w-0 items-center gap-3 border-b border-[#D4DBD7] text-xs dark:border-[#343A3F]">
    <span className="shrink-0 border border-[#D4DBD7] px-1.5 py-0.5 font-mono text-[10px] text-[#525C57] dark:border-[#343A3F] dark:text-[#B6BEBA]">[{code}]</span>
    <span className="min-w-0 flex-1 truncate font-medium text-[#171B19] dark:text-[#F4F6F5]">{name}</span>
    <div className="w-24 shrink-0 sm:w-28"><Progress aria-label={`${name}: ${completed} of ${total} ${unit}`} value={progress}/><span className="font-mono text-[10px] text-[#7B8580] dark:text-[#7C8580]">{completed} / {total} {unit}</span></div>
    <span className={cn('shrink-0 font-mono tabular-nums',variance>=0?'text-[#347A46] dark:text-[#6DBB77]':'text-[#B84558] dark:text-[#E06B74]')}>{variance>=0?'+':'−'}${Math.abs(variance).toLocaleString('en-US')}</span>
  </div>;
}
