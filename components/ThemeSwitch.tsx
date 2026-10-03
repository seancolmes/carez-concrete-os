'use client';

import {Switch,Tooltip} from '@fluentui/react-components';
import {WeatherMoonRegular,WeatherSunnyRegular} from '@fluentui/react-icons';
import {useCarezAppearance} from '@/components/CarezAppearanceProvider';

export function ThemeSwitch(){
  const {ready,resolvedTheme,setThemePreference}=useCarezAppearance();
  return <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2" aria-label="Appearance">
    <WeatherSunnyRegular aria-hidden="true" className="size-4 text-muted-foreground"/>
    <Tooltip content={resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode'} relationship="description">
      <Switch aria-label="Use dark mode" checked={resolvedTheme==='dark'} disabled={!ready} onChange={(_,data)=>setThemePreference(data.checked?'dark':'light')}/>
    </Tooltip>
    <WeatherMoonRegular aria-hidden="true" className="size-4 text-muted-foreground"/>
  </div>;
}
