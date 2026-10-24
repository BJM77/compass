/**
 * Light / dark theme preference. "light" is the default; "system" follows the OS.
 * Applied as the `dark` class on <html> (Tailwind darkMode: 'class'; tokens live in globals.css).
 */
export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'compass_theme';
export const THEME_EVENT = 'compass-theme-change';

export function readThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch { return 'light'; }
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
  return false;
}

export function applyThemeClass(mode: ThemeMode) {
  const el = document.documentElement;
  const dark = resolveDark(mode);
  el.classList.toggle('dark', dark);
  el.style.colorScheme = dark ? 'dark' : 'light';
}

export function setThemeMode(mode: ThemeMode) {
  try {
    if (mode === 'light') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch { /* storage unavailable */ }
  applyThemeClass(mode);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: mode }));
}

/** Inline <head> script: set the class before first paint to avoid a light/dark flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;if(d){e.classList.add('dark');e.style.colorScheme='dark';}}catch(x){}})();`;
