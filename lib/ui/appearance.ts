export type CarezThemePreference = 'light' | 'dark' | 'system';
export type CarezResolvedTheme = 'light' | 'dark';
export type CarezDensityPreference = 'default' | 'compact' | 'comfortable';

export const CAREZ_THEME_STORAGE_KEY = 'carez.theme';
export const CAREZ_DENSITY_STORAGE_KEY = 'carez.density';
export const CAREZ_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function normalizeThemePreference(value: unknown): CarezThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function normalizeDensityPreference(value: unknown): CarezDensityPreference {
  return value === 'compact' || value === 'comfortable' || value === 'default' ? value : 'default';
}

export function resolveThemePreference(preference: CarezThemePreference, prefersDark: boolean): CarezResolvedTheme {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
}

export const CAREZ_APPEARANCE_BOOT_SCRIPT = `(() => {
  const root = document.documentElement;
  let themePreference = 'system';
  let densityPreference = 'default';

  try {
    const storedTheme = localStorage.getItem('${CAREZ_THEME_STORAGE_KEY}');
    const storedDensity = localStorage.getItem('${CAREZ_DENSITY_STORAGE_KEY}');
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') themePreference = storedTheme;
    if (storedDensity === 'default' || storedDensity === 'compact' || storedDensity === 'comfortable') densityPreference = storedDensity;
  } catch {}

  const prefersDark = window.matchMedia('${CAREZ_THEME_MEDIA_QUERY}').matches;
  const resolvedTheme = themePreference === 'system' ? (prefersDark ? 'dark' : 'light') : themePreference;

  root.dataset.themePreference = themePreference;
  root.dataset.theme = resolvedTheme;
  root.dataset.density = densityPreference;
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
})();`;
