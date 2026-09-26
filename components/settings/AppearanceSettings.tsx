'use client';

import { useCarezAppearance } from '@/components/carez/appearance-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AppearanceSettings() {
  const {
    ready,
    densityPreference,
    setDensityPreference,
  } = useCarezAppearance();

  return <div className="divide-y rounded-md border bg-surface-panel">
    <div className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="text-sm font-medium">Theme</div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Steam Sleek V28 — dark steel surfaces, compact chrome, and cyan controls.</p>
      </div>
      <span className="text-sm font-medium text-foreground">Steam Sleek V28</span>
    </div>

    <div className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="text-sm font-medium">Density</div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Sets your baseline spacing. Specialist workspaces may enforce safe density limits.</p>
      </div>
      <Select value={densityPreference} onValueChange={value => {
        if (value === 'default' || value === 'compact' || value === 'comfortable') setDensityPreference(value);
      }}>
        <SelectTrigger className="w-full" disabled={!ready} aria-label="Carez density"><SelectValue /></SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="default">Workspace default</SelectItem>
          <SelectItem value="compact">Compact</SelectItem>
          <SelectItem value="comfortable">Comfortable</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>;
}
