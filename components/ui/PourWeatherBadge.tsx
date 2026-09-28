import {Sun,Wind} from 'lucide-react';

type PourWeatherBadgeProps={location?:string;temperature?:string;wind?:string};

export function PourWeatherBadge({location='Spanaway, WA',temperature='72°F',wind='5mph'}:PourWeatherBadgeProps){
  return <div aria-label={`Sample weather: ${location}, ${temperature}, wind ${wind}; clear to pour status is illustrative`} className="flex items-center gap-2 rounded-full border border-[#D4DBD7] bg-[#FFFFFF] px-3 py-1 text-xs text-[#525C57] dark:border-[#343A3F] dark:bg-[#1E2123] dark:text-[#B6BEBA]">
    <span className="size-1.5 shrink-0 rounded-full bg-[#009966]" aria-hidden="true"/>
    <span className="hidden font-medium sm:inline">{location}</span>
    <Sun aria-hidden="true" className="size-3.5"/>
    <span>{temperature}</span>
    <Wind aria-hidden="true" className="size-3.5"/>
    <span>{wind}</span>
    <span className="sr-only">Sample clear to pour conditions; not live weather</span>
  </div>;
}
