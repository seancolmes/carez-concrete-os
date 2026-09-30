'use client';

import {useCarezAppearance} from '@/components/CarezAppearanceProvider';
import {Select} from '@fluentui/react-components';

export function AppearanceSettings() {
  const {ready,themePreference,setThemePreference}=useCarezAppearance();

  return <div className="rounded-md border border-border bg-card">
    <div className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="text-sm font-medium text-foreground">Workspace theme</div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Choose dark, light, or follow your device setting.</p>
      </div>
      <Select appearance="outline" className="w-full" value={themePreference} disabled={!ready} aria-label="Workspace theme" onChange={event=>{
        const value=event.target.value;
        if(value==='light'||value==='dark'||value==='system')setThemePreference(value);
      }}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">Use device setting</option>
      </Select>
    </div>
  </div>;
}
