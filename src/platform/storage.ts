import { Preferences } from '@capacitor/preferences';
import type { AppData } from '../domain/types';
import { emptyData, normalize } from '../domain/data';

const KEY = 'kachimake.data.v1';
const BACKUP_KEY = 'kachimake.data.prev';

/**
 * 端末内に保存する。Preferences はネイティブでは UserDefaults / SharedPreferences、
 * ブラウザでは localStorage に書く(WebView の localStorage は OS に消されることがあるため使わない)。
 */
export async function loadData(): Promise<AppData> {
  const { value } = await Preferences.get({ key: KEY });
  if (!value) return emptyData();
  try {
    return normalize(JSON.parse(value)).data;
  } catch {
    // 本体が壊れていたら、1つ前の保存から戻す
    const prev = await Preferences.get({ key: BACKUP_KEY });
    try {
      return prev.value ? normalize(JSON.parse(prev.value)).data : emptyData();
    } catch {
      return emptyData();
    }
  }
}

let chain: Promise<void> = Promise.resolve();

/** 書き込みは順番に1本ずつ。前回の保存を控えに残してから上書きする */
export function saveData(data: AppData): Promise<void> {
  const json = JSON.stringify(data);
  chain = chain.then(async () => {
    const cur = await Preferences.get({ key: KEY });
    if (cur.value) await Preferences.set({ key: BACKUP_KEY, value: cur.value });
    await Preferences.set({ key: KEY, value: json });
  }).catch((e) => console.error('[kachimake] save failed', e));
  return chain;
}
