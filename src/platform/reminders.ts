// 夜のお知らせの中身を作る(Capacitor に依存しない部分。テストできるように分けた)

export const REMIND_BASE = 7000;

/**
 * 記録のお知らせは「その日の夜に出れば十分」で、秒単位の正確さは要らない。
 * isExactNotification を false にして、正確なアラームを使わない。
 * true(プラグインの既定)のままだと、Android 12 以降で予約のたびに
 * 「アラームとリマインダー」の許可画面が開いてしまう。カチマケは
 * SCHEDULE_EXACT_ALARM をマニフェストから外しているので、その画面のスイッチは灰色で押せない。
 * allowWhileIdle は残す(正確でないアラームでも省電力中に出せる。許可は要らない)。
 */
export function reminderNotifications(dates: string[], time: string) {
  const [h, m] = time.split(':').map(Number);
  return dates.map((d, i) => {
    const [y, mo, da] = d.split('-').map(Number);
    return {
      id: REMIND_BASE + i,
      title: '今日の収支、記入しましたか?',
      body: '打った日・買った日は、忘れないうちに30秒で記入できます',
      schedule: { at: new Date(y, mo - 1, da, h, m), allowWhileIdle: true },
      isExactNotification: false,
      smallIcon: 'ic_stat_notify',
      iconColor: '#F9B712',
    };
  });
}
