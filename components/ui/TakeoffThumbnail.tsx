import Link from 'next/link';
import {Download,Maximize2} from 'lucide-react';
import {buttonVariants} from '@/components/ui/button';

type TakeoffThumbnailProps={href?:string;downloadHref?:string;version?:string};

export function TakeoffThumbnail({href='/takeoff',downloadHref,version='v3.2 · sample'}:TakeoffThumbnailProps){
  return <div className="group relative flex aspect-square min-h-40 flex-col items-center justify-center overflow-hidden border border-[#D4DBD7] bg-[#EFF2F0] p-4 text-center dark:border-[#343A3F] dark:bg-[#121212]" style={{backgroundImage:'linear-gradient(rgba(70,80,88,.28) 1px, transparent 1px),linear-gradient(90deg,rgba(70,80,88,.28) 1px,transparent 1px)',backgroundSize:'20px 20px'}}>
    <span className="absolute left-2 top-2 bg-black/60 px-2 py-1 text-[10px] text-white">{version}</span>
    <span className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#525C57] dark:text-[#B6BEBA]">Illustrative preview</span>
    <Link href={href} className={buttonVariants({size:'sm'})}>View Div 03 Takeoff</Link>
    <span className="absolute bottom-3 text-[10px] text-[#525C57] dark:text-[#B6BEBA]">Sample: Rev 3 - Architectural.pdf</span>
    <div className="absolute inset-x-0 bottom-0 flex translate-y-0 items-center justify-between bg-black/80 p-2 text-white opacity-100 transition-all duration-200 sm:translate-y-full sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100 motion-reduce:transition-none">
      {downloadHref?<a href={downloadHref} download className="inline-flex items-center gap-1 px-2 py-1 text-xs hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><Download className="size-3.5"/>Download</a>:<button type="button" disabled title="No document is available to download" className="inline-flex items-center gap-1 px-2 py-1 text-xs opacity-50"><Download className="size-3.5"/>Download</button>}
      <Link href={href} className="inline-flex items-center gap-1 px-2 py-1 text-xs hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><Maximize2 className="size-3.5"/>Expand</Link>
    </div>
  </div>;
}
