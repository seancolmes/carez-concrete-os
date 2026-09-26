'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  CAREZ_DENSITY_STORAGE_KEY,
  CAREZ_THEME_MEDIA_QUERY,
  CAREZ_THEME_STORAGE_KEY,
  type CarezDensityPreference,
  type CarezResolvedTheme,
  type CarezThemePreference,
  normalizeDensityPreference,
  normalizeThemePreference,
  resolveThemePreference,
} from '@/lib/ui/appearance';

type CarezAppearanceContextValue = {
  ready: boolean;
  themePreference: CarezThemePreference;
  resolvedTheme: CarezResolvedTheme;
  densityPreference: CarezDensityPreference;
  setThemePreference: (next: CarezThemePreference) => void;
  setDensityPreference: (next: CarezDensityPreference) => void;
};

const CarezAppearanceContext = createContext<CarezAppearanceContextValue | null>(null);

function readStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch {}
}

function applyTheme(preference: CarezThemePreference, prefersDark: boolean): CarezResolvedTheme {
  const resolved = resolveThemePreference(preference, prefersDark);
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  return resolved;
}

function applyDensity(preference: CarezDensityPreference) {
  document.documentElement.dataset.density = preference;
}

export function CarezAppearanceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [themePreference, setThemePreference] = useState<CarezThemePreference>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<CarezResolvedTheme>('dark');
  const [densityPreference, setDensityPreference] = useState<CarezDensityPreference>('default');

  useEffect(() => {
    const root = document.documentElement;
    const initialTheme = normalizeThemePreference(root.dataset.themePreference ?? readStorage(CAREZ_THEME_STORAGE_KEY));
    const initialDensity = normalizeDensityPreference(root.dataset.density ?? readStorage(CAREZ_DENSITY_STORAGE_KEY));
    const media = window.matchMedia(CAREZ_THEME_MEDIA_QUERY);
    setThemePreference(initialTheme);
    setDensityPreference(initialDensity);
    setResolvedTheme(resolveThemePreference(initialTheme, media.matches));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia(CAREZ_THEME_MEDIA_QUERY);
    const update = () => {
      setResolvedTheme(applyTheme(themePreference, media.matches));
      writeStorage(CAREZ_THEME_STORAGE_KEY, themePreference);
    };
    update();
    if (themePreference !== 'system') return;
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [ready, themePreference]);

  useEffect(() => {
    if (!ready) return;
    applyDensity(densityPreference);
    writeStorage(CAREZ_DENSITY_STORAGE_KEY, densityPreference);
  }, [densityPreference, ready]);

  const value = useMemo<CarezAppearanceContextValue>(() => ({
    ready,
    themePreference,
    resolvedTheme,
    densityPreference,
    setThemePreference,
    setDensityPreference,
  }), [densityPreference, ready, resolvedTheme, themePreference]);

  return <CarezAppearanceContext.Provider value={value}>{children}</CarezAppearanceContext.Provider>;
}

export function useCarezAppearance() {
  const value = useContext(CarezAppearanceContext);
  if (!value) throw new Error('useCarezAppearance must be used inside CarezAppearanceProvider');
  return value;
}
