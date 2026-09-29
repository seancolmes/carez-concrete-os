import type {ReactNode} from 'react';
import {cn} from '@/lib/utils';

const railClass='flex min-w-0 gap-2 overflow-x-auto border-b border-[#D4DBD7] bg-[#F5F7F6] px-3 py-2 dark:border-[#343A3F] dark:bg-[#121212]';

export function workspacePillClass(active:boolean){
  return cn(
    'shrink-0 rounded-lg border border-[#D4DBD7] bg-white px-3 py-1.5 text-xs font-medium text-[#525C57] shadow-sm outline-none transition-all hover:border-[#B9C3BE] hover:bg-[#EFF2F0] hover:text-[#171B19] focus-visible:border-[#007A52] focus-visible:ring-2 focus-visible:ring-[#007A52]/30 dark:border-[#343A3F] dark:bg-[#181A1B] dark:text-[#B6BEBA] dark:hover:border-[#525B62] dark:hover:bg-[#1C1F23] dark:hover:text-white dark:focus-visible:border-[#009966] dark:focus-visible:ring-[#009966]/30 motion-reduce:transition-none',
    active&&'border-[#007A52] bg-[#009966]/10 text-[#007A52] hover:border-[#007A52] hover:bg-[#009966]/10 hover:text-[#007A52] dark:border-[#009966] dark:bg-[#009966]/10 dark:text-[#009966] dark:hover:border-[#009966] dark:hover:bg-[#009966]/10 dark:hover:text-[#009966]',
  );
}

export function WorkspaceSubnav({label,children,tablist=false}:{label:string;children:ReactNode;tablist?:boolean}){
  return tablist
    ? <div role="tablist" aria-label={label} className={railClass}>{children}</div>
    : <nav aria-label={label} className={railClass}>{children}</nav>;
}
