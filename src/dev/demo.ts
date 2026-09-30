// ストアの画面写真を撮るための見本データ。開発サーバーで ?demo=1 を付けたときだけ動く(本番ビルドには入らない)
export function installDemo(params: URLSearchParams) {
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const kinds: [string, string[], string[]][] = [
    ['pachinko', ['駅前ホール', 'パーラー中央'], ['海物語', 'エヴァ', '北斗']],
    ['slot', ['駅前ホール', 'スロット館'], ['ジャグラー', 'まどマギ', 'バジリスク']],
    ['keiba', ['東京競馬場', 'ネット投票'], ['11R 毎日王冠', '9R', '12R']],
    ['boat', ['ネット投票', '多摩川'], ['12R', '10R', '8R']],
  ];
  const bets = ['単勝', '馬連・2連複', '3連複', '3連単', 'ワイド・拡連複'];
  const sessions = [];
  let id = 0;
  for (let m = 7; m <= 9; m++) {
    const days = m === 9 ? 30 : 31;
    for (let d = 1; d <= days; d++) {
      if (r() < 0.6) continue;
      const [kind, places, targets] = pick(kinds);
      const race = kind === 'keiba' || kind === 'boat';
      const invest = race ? Math.round((1000 + r() * 9000) / 100) * 100 : Math.round((5000 + r() * 30000) / 1000) * 1000;
      const win = r() < (race ? 0.33 : 0.4);
      const payout = win ? Math.round((invest * (1.1 + r() * (race ? 4 : 1.6))) / 100) * 100 : r() < 0.3 ? Math.round((invest * r() * 0.6) / 100) * 100 : 0;
      id++;
      sessions.push({
        id: `demo${id}`, date: `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, kind,
        place: pick(places), target: pick(targets), invest, payout,
        minutes: race ? Math.round(r() * 90) : Math.round((90 + r() * 330) / 10) * 10,
        betType: race ? pick(bets) : undefined, memo: '', createdAt: id, updatedAt: id,
      });
    }
  }
  // 見本の終盤: 3万円以上の大勝ち(激)と3連勝を入れて、今月をプラスで終える
  const keep = sessions.filter((x) => x.date < '2026-09-24');
  const extra = [
    { date: '2026-09-24', kind: 'slot', place: '駅前ホール', target: 'ジャグラー', invest: 12000, payout: 58600, minutes: 300 },
    { date: '2026-09-26', kind: 'keiba', place: '東京競馬場', target: '11R 毎日王冠', invest: 6000, payout: 21900, minutes: 60, betType: '3連複' },
    { date: '2026-09-28', kind: 'pachinko', place: 'パーラー中央', target: '海物語', invest: 15000, payout: 26500, minutes: 240 },
    { date: '2026-09-30', kind: 'slot', place: 'スロット館', target: 'まどマギ', invest: 18000, payout: 34200, minutes: 350 },
  ].map((x) => { id++; return { id: `demo${id}`, memo: '', createdAt: id, updatedAt: id, betType: undefined, ...x }; });
  sessions.length = 0;
  sessions.push(...keep, ...extra);
  const counter = params.get('tab') === 'counter'
    ? { machineId: 'sample', games: 3620, counts: { bell: 474, cherry: 112, bonus: 15 } }
    : null;
  localStorage.setItem('CapacitorStorage.kachimake.data.v1', JSON.stringify({
    version: 1, sessions, settings: { monthlyLimit: 60000, weekStart: 0, winColor: 'ink' }, machines: [], counter,
  }));
  if (params.get('premium') === '1') localStorage.setItem('kachimake.mockPremium', '1');
  else localStorage.removeItem('kachimake.mockPremium');
}
