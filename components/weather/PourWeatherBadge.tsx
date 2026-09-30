import {WeatherSunnyRegular,WeatherSquallsRegular} from '@fluentui/react-icons';

type PourWeatherBadgeProps={location?:string;temperature?:string;wind?:string};

export function PourWeatherBadge({location='Spanaway, WA',temperature='72°F',wind='5mph'}:PourWeatherBadgeProps){
  return <div aria-label={`Sample weather: ${location}, ${temperature}, wind ${wind}; clear to pour status is illustrative`} className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
    <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true"/>
    <span className="hidden font-medium sm:inline">{location}</span>
    <WeatherSunnyRegular aria-hidden="true" className="size-3.5"/>
    <span>{temperature}</span>
    <WeatherSquallsRegular aria-hidden="true" className="size-3.5"/>
    <span>{wind}</span>
    <span className="sr-only">Sample clear to pour conditions; not live weather</span>
  </div>;
}
