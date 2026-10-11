// 1.2.0 の画面(ホーム・履歴・カレンダー・記録詳細)で使う集計。記録の形は変えず、読むだけ
import type { Kind, Session } from './types';
import { profit } from './stats';
import { addDays, addMonths } from './data';

/** 新しい順(日付、同じ日なら後から書いた方が先) */
export function newestFirst(list: Session[]): Session[] {
  return [...list].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}

/** month を最後にした n か月(古い順) */
export function lastMonths(month: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1));
}

/** 日ごとの勝ち・負け・引き分けの日数と、その期間の中での最長の連勝・連敗(記録のある日だけを順に見る) */
export function dayRecord(list: Session[]) {
  const m = new Map<string, number>();
  for (const s of list) m.set(s.date, (m.get(s.date) ?? 0) + profit(s));
  const days = [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let win = 0, lose = 0, draw = 0, bestWin = 0, bestLose = 0, curW = 0, curL = 0;
  for (const [, p] of days) {
    if (p > 0) { win++; curW++; curL = 0; }
    else if (p < 0) { lose++; curL++; curW = 0; }
    else { draw++; curW = 0; curL = 0; }
    bestWin = Math.max(bestWin, curW);
    bestLose = Math.max(bestLose, curL);
  }
  return { win, lose, draw, days: days.length, winRate: win + lose ? win / (win + lose) : null, bestWin, bestLose };
}

export type SortKey = 'new' | 'old' | 'best' | 'worst';
export type ResultFilter = 'all' | 'win' | 'lose';

export interface HistoryQuery {
  text: string;
  kind: Kind | 'all';
  place: string;
  result: ResultFilter;
  sort: SortKey;
}

/** 店舗名・機種名・メモ・タグ・券種で探す(大文字小文字・全角半角の英数を区別しない) */
const norm = (s: string) => s.normalize('NFKC').toLowerCase();
export function searchSessions(list: Session[], q: HistoryQuery): Session[] {
  const words = norm(q.text).split(/\s+/).filter(Boolean);
  const out = list.filter((s) => {
    if (q.kind !== 'all' && s.kind !== q.kind) return false;
    if (q.place && s.place !== q.place) return false;
    const p = profit(s);
    if (q.result === 'win' && p <= 0) return false;
    if (q.result === 'lose' && p >= 0) return false;
    if (words.length) {
      const hay = norm([s.place, s.target, s.memo, s.betType ?? '', ...(s.tags ?? [])].join(' '));
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  if (q.sort === 'old') return [...out].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  if (q.sort === 'best') return [...out].sort((a, b) => profit(b) - profit(a));
  if (q.sort === 'worst') return [...out].sort((a, b) => profit(a) - profit(b));
  return newestFirst(out);
}

/** 並べた順のまま、同じ日の記録をまとめる */
export function groupByDay(list: Session[]): { date: string; items: Session[] }[] {
  const out: { date: string; items: Session[] }[] = [];
  for (const s of list) {
    const last = out[out.length - 1];
    if (last && last.date === s.date) last.items.push(s);
    else out.push({ date: s.date, items: [s] });
  }
  return out;
}

/** 使ったことのある店舗・場(多い順) */
export function places(list: Session[]): string[] {
  const m = new Map<string, number>();
  for (const s of list) if (s.place) m.set(s.place, (m.get(s.place) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/** 同じ店・同じ種類の、date までの直近 days 日の記録(記録詳細の「過去実績」) */
export function placeRecent(list: Session[], s: Session, days = 30): Session[] {
  if (!s.place) return [];
  const from = addDays(s.date, -(days - 1));
  return list.filter((x) => x.place === s.place && x.kind === s.kind && x.date >= from && x.date <= s.date);
}

/** 記録詳細の「前の記録」「次の記録」。新しい順に並べたときの隣 */
export function neighbors(list: Session[], id: string): { older: Session | null; newer: Session | null } {
  const sorted = newestFirst(list);
  const i = sorted.findIndex((x) => x.id === id);
  if (i < 0) return { older: null, newer: null };
  return { older: sorted[i + 1] ?? null, newer: sorted[i - 1] ?? null };
}
