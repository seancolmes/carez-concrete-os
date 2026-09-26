export type CarezThemePreference = 'light' | 'dark' | 'system';
export type CarezResolvedTheme = 'light' | 'dark';
export type CarezDensityPreference = 'default' | 'compact' | 'comfortable';

export const CAREZ_THEME_STORAGE_KEY = 'carez.theme';
export const CAREZ_DENSITY_STORAGE_KEY = 'carez.density';
export const CAREZ_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function normalizeThemePreference(_value: unknown): CarezThemePreference {
  return 'light';
}

export function normalizeDensityPreference(value: unknown): CarezDensityPreference {
  return value === 'compact' || value === 'comfortable' || value === 'default' ? value : 'default';
}

export function resolveThemePreference(_preference: CarezThemePreference, _prefersDark: boolean): CarezResolvedTheme {
  return 'light';
}

export const CAREZ_APPEARANCE_BOOT_SCRIPT = `(() => {
  const root = document.documentElement;
  const themePreference = 'light';
  let densityPreference = 'default';

  try {
    const storedDensity = localStorage.getItem('${CAREZ_DENSITY_STORAGE_KEY}');
    if (storedDensity === 'default' || storedDensity === 'compact' || storedDensity === 'comfortable') densityPreference = storedDensity;
  } catch {}

  const resolvedTheme = 'light';

  root.dataset.themePreference = themePreference;
  root.dataset.theme = resolvedTheme;
  root.dataset.density = densityPreference;
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
})();`;
