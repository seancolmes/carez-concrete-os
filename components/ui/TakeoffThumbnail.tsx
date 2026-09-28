import Link from 'next/link';
import {buttonVariants} from '@/components/ui/button';
import {cn} from '@/lib/utils';

type TakeoffThumbnailProps={href?:string};

export function TakeoffThumbnail({href='/takeoff'}:TakeoffThumbnailProps){
  return <div className="relative flex aspect-square min-h-40 flex-col items-center justify-center overflow-hidden border border-[#343A3F] bg-[#25292C] p-4 text-center" style={{backgroundImage:'linear-gradient(rgba(70,80,88,.28) 1px, transparent 1px),linear-gradient(90deg,rgba(70,80,88,.28) 1px,transparent 1px)',backgroundSize:'20px 20px'}}>
    <span className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#B6BEBA]">Illustrative preview</span>
    <Link href={href} className={cn(buttonVariants({size:'sm'}),'bg-[#007A52] text-white hover:bg-[#007A52]/90 dark:bg-[#009966] dark:text-[#121212] dark:hover:bg-[#009966]/90')}>View Div 03 Takeoff</Link>
    <span className="absolute bottom-3 text-[10px] text-[#B6BEBA]">Sample: Rev 3 - Architectural.pdf</span>
  </div>;
}
