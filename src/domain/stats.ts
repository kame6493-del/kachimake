import type { Kind, Session } from './types';

export const profit = (s: Session) => s.payout - s.invest;

export interface Summary {
  count: number;
  invest: number;
  payout: number;
  profit: number;
  wins: number;
  losses: number;
  /** 勝ち日数 / (勝ち+負け)。記録0件なら null */
  winRate: number | null;
  /** 回収 / 投資。投資0なら null */
  recovery: number | null;
  minutes: number;
  /** 1時間あたりの収支。時間の記録が無ければ null */
  hourly: number | null;
  best: number;
  worst: number;
}

export function summarize(list: Session[]): Summary {
  let invest = 0, payout = 0, wins = 0, losses = 0, minutes = 0, timedProfit = 0;
  let best = 0, worst = 0;
  for (const s of list) {
    invest += s.invest;
    payout += s.payout;
    const p = profit(s);
    if (p > 0) wins++;
    else if (p < 0) losses++;
    if (s.minutes > 0) {
      minutes += s.minutes;
      timedProfit += p;
    }
    if (p > best) best = p;
    if (p < worst) worst = p;
  }
  const decided = wins + losses;
  return {
    count: list.length,
    invest,
    payout,
    profit: payout - invest,
    wins,
    losses,
    winRate: decided ? wins / decided : null,
    recovery: invest > 0 ? payout / invest : null,
    minutes,
    hourly: minutes > 0 ? (timedProfit / minutes) * 60 : null,
    best,
    worst,
  };
}

/** 日付の昇順に並べ、日ごとの累計収支を返す(同じ日の記録はまとめる) */
export function cumulative(list: Session[]): { date: string; day: number; total: number }[] {
  const byDay = new Map<string, number>();
  for (const s of list) byDay.set(s.date, (byDay.get(s.date) ?? 0) + profit(s));
  const days = [...byDay.keys()].sort();
  let total = 0;
  return days.map((date) => {
    const day = byDay.get(date)!;
    total += day;
    return { date, day, total };
  });
}

export function byDate(list: Session[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of list) m.set(s.date, (m.get(s.date) ?? 0) + profit(s));
  return m;
}

export function inRange(list: Session[], from: string, to: string) {
  return list.filter((s) => s.date >= from && s.date <= to);
}

export type GroupKey = 'kind' | 'place' | 'target' | 'weekday' | 'betType';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function weekdayOf(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export interface GroupRow {
  key: string;
  label: string;
  /** 店舗・機種でまとめたときの種類。同じ「12R」でも競馬とボートは別の行にする */
  kind?: Kind;
  summary: Summary;
}

export function groupBy(list: Session[], key: GroupKey): GroupRow[] {
  const g = new Map<string, { label: string; kind?: Kind; items: Session[] }>();
  for (const s of list) {
    let label: string;
    let kind: Kind | undefined;
    if (key === 'weekday') label = WEEKDAYS[weekdayOf(s.date)];
    else if (key === 'betType') label = s.betType || '(未設定)';
    else {
      label = (s[key] as string) || '(未設定)';
      kind = s.kind;
    }
    const k = kind ? `${kind}\u0000${label}` : label;
    if (!g.has(k)) g.set(k, { label, kind, items: [] });
    g.get(k)!.items.push(s);
  }
  const rows: GroupRow[] = [...g.entries()].map(([k, v]) => ({ key: k, label: v.label, kind: v.kind, summary: summarize(v.items) }));
  if (key === 'weekday') rows.sort((a, b) => WEEKDAYS.indexOf(a.label) - WEEKDAYS.indexOf(b.label));
  else rows.sort((a, b) => b.summary.profit - a.summary.profit);
  return rows;
}

export function byKind(list: Session[]): Map<Kind, Summary> {
  const m = new Map<Kind, Session[]>();
  for (const s of list) {
    if (!m.has(s.kind)) m.set(s.kind, []);
    m.get(s.kind)!.push(s);
  }
  return new Map([...m.entries()].map(([k, v]) => [k, summarize(v)]));
}

/** 月ごとの収支(YYYY-MM → 収支)。古い順 */
export function monthly(list: Session[]): { month: string; summary: Summary }[] {
  const m = new Map<string, Session[]>();
  for (const s of list) {
    const k = s.date.slice(0, 7);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(s);
  }
  return [...m.keys()].sort().map((k) => ({ month: k, summary: summarize(m.get(k)!) }));
}

/** 今月の投資が上限に対してどこまで来たか */
export function limitStatus(list: Session[], month: string, limit: number) {
  if (limit <= 0) return null;
  const spent = list.filter((s) => s.date.startsWith(month)).reduce((a, s) => a + s.invest, 0);
  const lost = Math.max(0, -list.filter((s) => s.date.startsWith(month)).reduce((a, s) => a + profit(s), 0));
  return { spent, lost, limit, ratio: lost / limit };
}

/** 直近から数えた連勝・連敗(日ごとの収支で判定。±0 の日は数えずに飛ばす) */
export function streak(list: Session[]): { kind: 'win' | 'lose'; n: number } | null {
  const days = [...byDate(list).entries()].filter(([, p]) => p !== 0).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (days.length === 0) return null;
  const kind = days[0][1] > 0 ? 'win' : 'lose';
  let n = 0;
  for (const [, p] of days) {
    if ((p > 0 ? 'win' : 'lose') !== kind) break;
    n++;
  }
  return { kind, n };
}

/** 回収率から付ける今月の称号 */
export function title(recovery: number | null): string | null {
  if (recovery == null) return null;
  if (recovery >= 1.5) return '神回収';
  if (recovery >= 1.2) return '勝ち組';
  if (recovery >= 1.0) return 'プラス圏';
  if (recovery >= 0.8) return 'あと一歩';
  return '修行中';
}

/** 記入したときの演出の強さ */
export function hype(p: number): 'jackpot' | 'big' | 'win' | null {
  if (p >= 50000) return 'jackpot';
  if (p >= 10000) return 'big';
  if (p > 0) return 'win';
  return null;
}
