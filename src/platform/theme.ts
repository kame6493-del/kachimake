// 画面の配色(明るい/暗い/端末に合わせる)。<html data-theme> を切り替え、ブラウザの色・Android と iOS の上下のバーの文字色も合わせる
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import type { Settings } from '../domain/types';

export type ThemePref = Settings['theme'];
export type Theme = 'light' | 'dark';

/** 地の色(上下のバーの裏に見える色。index.css の --bg と同じ) */
export const THEME_BG: Record<Theme, string> = { light: '#f4f6f9', dark: '#0b0b0c' };
/** 起動の一瞬に前回の配色で描くための控え(index.html の小さなスクリプトが読む) */
export const THEME_KEY = 'kachimake.theme';

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === 'dark') return 'dark';
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return 'light';
}

export const systemPrefersDark = () => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
};

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[theme]);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* 次の起動の一瞬だけ既定の色になる */ }
  if (!Capacitor.isNativePlatform()) return;
  // Light = 明るい地に濃い文字・アイコン、Dark = 暗い地に白い文字・アイコン
  void SystemBars.setStyle({ style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => { /* 色が合わないだけ */ });
}
