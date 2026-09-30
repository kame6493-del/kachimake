import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { InAppReview } from '@capacitor-community/in-app-review';
import { LocalNotifications } from '@capacitor/local-notifications';

const native = Capacitor.isNativePlatform();

/** カウンターを開いている間は画面を消さない。ブラウザでは Wake Lock を使う */
let lock: { release: () => Promise<void> } | null = null;
export async function keepAwake(on: boolean) {
  try {
    if (native) {
      await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
      return;
    }
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (on && wl && !lock) lock = await wl.request('screen');
    if (!on && lock) { await lock.release(); lock = null; }
  } catch {
    // 画面が消えるだけで、数えた回数は失われない
  }
}

/** ストアの評価の画面(OS が出す物。出すかどうかも OS が決める) */
export async function askReview() {
  if (!native) return;
  try { await InAppReview.requestReview(); } catch { /* 出なくても困らない */ }
}

const REMIND_BASE = 7000;

/** お知らせの許可を求める。許可されたら true */
export async function allowNotifications(): Promise<boolean> {
  if (!native) return true;
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  } catch {
    return false;
  }
}

/** 夜のお知らせを日ごとに置き直す。dates が空なら全部取り消す */
export async function scheduleReminders(dates: string[], time: string) {
  if (!native) return;
  try {
    const pending = await LocalNotifications.getPending();
    const mine = pending.notifications.filter((n) => n.id >= REMIND_BASE && n.id < REMIND_BASE + 100);
    if (mine.length) await LocalNotifications.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
    if (dates.length === 0) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
    const [h, m] = time.split(':').map(Number);
    await LocalNotifications.schedule({
      notifications: dates.map((d, i) => {
        const [y, mo, da] = d.split('-').map(Number);
        return {
          id: REMIND_BASE + i,
          title: '今日の収支、記入しましたか?',
          body: '打った日・買った日は、忘れないうちに30秒で記入できます',
          schedule: { at: new Date(y, mo - 1, da, h, m), allowWhileIdle: true },
          smallIcon: 'ic_stat_notify',
          iconColor: '#F9B712',
        };
      }),
    });
  } catch (e) {
    console.error('[kachimake] reminders', e);
  }
}
