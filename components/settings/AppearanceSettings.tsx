'use client';

import { useCarezAppearance } from '@/components/carez/appearance-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AppearanceSettings() {
  const {
    ready,
    themePreference,
    setThemePreference,
    densityPreference,
    setDensityPreference,
  } = useCarezAppearance();

  return <div className="divide-y rounded-md border bg-surface-panel">
    <div className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="text-sm font-medium">Theme</div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Choose light, dark, or your device setting. Both use the PourTrace color system.</p>
      </div>
      <Select value={themePreference} onValueChange={value => {
        if (value === 'light' || value === 'dark' || value === 'system') setThemePreference(value);
      }}>
        <SelectTrigger className="w-full" disabled={!ready} aria-label="Workspace theme"><SelectValue /></SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="system">Use device setting</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="text-sm font-medium">Density</div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Sets your baseline spacing. Specialist workspaces may enforce safe density limits.</p>
      </div>
      <Select value={densityPreference} onValueChange={value => {
        if (value === 'default' || value === 'compact' || value === 'comfortable') setDensityPreference(value);
      }}>
        <SelectTrigger className="w-full" disabled={!ready} aria-label="Workspace density"><SelectValue /></SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="default">Workspace default</SelectItem>
          <SelectItem value="compact">Compact</SelectItem>
          <SelectItem value="comfortable">Comfortable</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>;
}
