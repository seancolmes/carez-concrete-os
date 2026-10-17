export type CarezThemePreference = 'light';
export type CarezResolvedTheme = 'light';
export type CarezDensityPreference = 'default' | 'compact' | 'comfortable';
export const CAREZ_THEME_STORAGE_KEY = 'carez.theme';
export const CAREZ_DENSITY_STORAGE_KEY = 'carez.density';

/** Old saved choices cannot restore a retired theme. */
export function normalizeThemePreference(_value:unknown):CarezThemePreference{return 'light';}
export function resolveThemePreference(_preference:unknown,_prefersDark?:boolean):CarezResolvedTheme{return 'light';}
export function normalizeDensityPreference(value:unknown):CarezDensityPreference{
  return value==='compact'||value==='comfortable'||value==='default'?value:'default';
}

export const CAREZ_APPEARANCE_BOOT_SCRIPT = `(() => {
  const root = document.documentElement;
  let densityPreference = 'default';
  try {
    const stored = localStorage.getItem('${CAREZ_DENSITY_STORAGE_KEY}');
    if (stored === 'default' || stored === 'compact' || stored === 'comfortable') densityPreference = stored;
  } catch {}
  root.dataset.themePreference = 'light';
  root.dataset.theme = 'light';
  root.dataset.density = densityPreference;
  root.classList.toggle('dark', false);
  root.style.colorScheme = 'only light';
})();`;
