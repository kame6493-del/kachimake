// ストアの画面写真を撮るための見本データ。開発サーバーで ?demo=1 を付けたときだけ動く(本番ビルドには入らない)
// 店・機種・レースの名前は作り物だけを使う(実在の店名・会社名・機種名は入れない)。日付は今日から数えて作る
export function installDemo(params: URLSearchParams) {
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const kinds: [string, string[], string[]][] = [
    ['pachinko', ['駅前ホール', 'パーラー中央', 'みなと会館'], ['甘デジ 海の台', 'ミドル 光の台', 'ライトミドル']],
    ['slot', ['駅前ホール', 'スロット館'], ['Aタイプ 7の台', 'AT機 夜の台', 'ノーマル機']],
    ['keiba', ['ネット投票', '場外発売所'], ['11R メイン', '9R', '12R']],
    ['keirin', ['ネット投票'], ['11R 決勝', '9R']],
    ['boat', ['ネット投票', '場外発売所'], ['12R', '10R', '8R']],
    ['auto', ['ネット投票', '北町オート'], ['第6R 一般戦', '第10R']],
  ];
  const bets = ['単勝', '馬連・2連複', '3連複', '3連単', 'ワイド・拡連複'];
  const memos = ['朝から並んだ。後半に良い流れ。', '', '', 'イベント日。粘って正解だった。', ''];
  let seed2 = 7;
  const r2 = () => ((seed2 = (seed2 * 48271) % 2147483647), seed2 / 2147483647);
  const hallExtra = (kind: string, payout: number) => {
    if (kind !== 'pachinko' && kind !== 'slot') return {};
    const rate = kind === 'slot' ? 20 : 4;
    const tags = r2() < 0.3 ? ['イベント日'] : r2() < 0.15 ? ['特定日'] : undefined;
    const saved = payout > 0 && r2() < 0.3 ? Math.round((payout * 0.3) / rate / 10) * 10 : undefined;
    return { rate, tags, saved };
  };
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const todayStr = ymd(now);
  const sessions = [];
  let id = 0;
  // 7か月前の1日から昨日まで
  for (let d = new Date(now.getFullYear(), now.getMonth() - 6, 1); ymd(d) < todayStr; d.setDate(d.getDate() + 1)) {
    if (r() < 0.55) continue;
    const [kind, places, targets] = pick(kinds);
    const race = kind === 'keiba' || kind === 'boat' || kind === 'keirin' || kind === 'auto';
    const invest = race ? Math.round((1000 + r() * 9000) / 100) * 100 : Math.round((5000 + r() * 30000) / 1000) * 1000;
    const win = r() < (race ? 0.36 : 0.45);
    const payout = win ? Math.round((invest * (1.1 + r() * (race ? 4 : 1.6))) / 100) * 100 : r() < 0.3 ? Math.round((invest * r() * 0.6) / 100) * 100 : 0;
    id++;
    sessions.push({
      id: `demo${id}`, date: ymd(d), kind, place: pick(places), target: pick(targets), invest, payout,
      minutes: race ? Math.round(r() * 90) : Math.round((90 + r() * 330) / 10) * 10,
      betType: race ? pick(bets) : undefined, memo: pick(memos), createdAt: id, updatedAt: id, ...hallExtra(kind, payout),
    });
  }
  // 見本の終盤: 3万円以上の大勝ち(激)と連勝を入れて、今月をプラスで終える
  const back = (n: number) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  const keep = sessions.filter((x) => x.date < back(7));
  const extra = [
    { date: back(6), kind: 'slot', place: '駅前ホール', target: 'Aタイプ 7の台', invest: 12000, payout: 58600, minutes: 300, rate: 20, saved: 800, tags: ['イベント日'], memo: '朝から並んだ。後半に良い流れ。' },
    { date: back(4), kind: 'keiba', place: 'ネット投票', target: '11R メイン', invest: 6000, payout: 21900, minutes: 60, betType: '3連複' },
    { date: back(2), kind: 'pachinko', place: 'パーラー中央', target: '甘デジ 海の台', invest: 15000, payout: 26500, minutes: 240, rate: 4, tags: ['特定日'] },
    { date: back(1), kind: 'slot', place: 'スロット館', target: 'AT機 夜の台', invest: 18000, payout: 34200, minutes: 350, rate: 20 },
    { date: back(1), kind: 'pachinko', place: 'みなと会館', target: 'ライトミドル', invest: 9000, payout: 4000, minutes: 120, rate: 4 },
    { date: back(3), kind: 'auto', place: '北町オート', target: '第6R 一般戦', invest: 4000, payout: 0, minutes: 40, betType: '3連単' },
    { date: back(5), kind: 'keirin', place: 'ネット投票', target: '11R 決勝', invest: 5000, payout: 11600, minutes: 30, betType: '3連複' },
  ].map((x) => { id++; return { id: `demo${id}`, memo: '', createdAt: id, updatedAt: id, betType: undefined, ...x }; });
  sessions.length = 0;
  sessions.push(...keep, ...extra);
  const counter = params.get('view') === 'counter'
    ? { machineId: 'sample', games: 3482, counts: { bell: 438, cherry: 104, bonus: 13 } }
    : null;
  localStorage.setItem('CapacitorStorage.kachimake.data.v1', JSON.stringify({
    version: 1, sessions, settings: { monthlyLimit: 60000, weekStart: 0, winColor: 'ink', fontScale: Number(params.get('font')) || 1, theme: params.get('theme') === 'dark' ? 'dark' : params.get('theme') === 'system' ? 'system' : 'light', remind: { on: true, time: '21:30' } }, machines: [], counter,
  }));
  if (params.get('premium') === '1') localStorage.setItem('kachimake.mockPremium', '1');
  else localStorage.removeItem('kachimake.mockPremium');
}
