import { describe, expect, it } from 'vitest';
import { dayRecord, groupByDay, lastMonths, neighbors, newestFirst, placeRecent, places, searchSessions, type HistoryQuery } from './views';
import type { Session } from './types';

let seq = 0;
const s = (date: string, invest: number, payout: number, extra: Partial<Session> = {}): Session => ({
  id: String(++seq), date, kind: 'pachinko', place: '', target: '', invest, payout, minutes: 0, memo: '',
  createdAt: seq, updatedAt: seq, ...extra,
});
const q = (p: Partial<HistoryQuery> = {}): HistoryQuery => ({ text: '', kind: 'all', place: '', result: 'all', sort: 'new', ...p });

describe('views', () => {
  it('新しい順: 日付、同じ日なら後から書いた方が先', () => {
    const a = s('2026-10-01', 1, 0), b = s('2026-10-02', 1, 0), c = s('2026-10-02', 1, 0);
    expect(newestFirst([a, b, c]).map((x) => x.id)).toEqual([c.id, b.id, a.id]);
  });
  it('直近の月を古い順に並べる(年をまたぐ)', () => {
    expect(lastMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('日ごとの勝ち負けと最長の連勝・連敗。同じ日は合算し、±0 の日で連続が切れる', () => {
    const r = dayRecord([
      s('2026-10-01', 1000, 2000), s('2026-10-02', 1000, 3000), s('2026-10-02', 5000, 0),
      s('2026-10-03', 1000, 0), s('2026-10-04', 1000, 1000), s('2026-10-05', 1000, 2000),
      s('2026-10-06', 1000, 2000), s('2026-10-07', 1000, 2000),
    ]);
    expect([r.win, r.lose, r.draw, r.days]).toEqual([4, 2, 1, 7]);
    expect(r.bestWin).toBe(3);
    expect(r.bestLose).toBe(2);
    expect(r.winRate).toBeCloseTo(4 / 6);
  });
  it('記録が無ければ勝率は null', () => {
    expect(dayRecord([]).winRate).toBeNull();
  });
  it('検索: 店舗・機種・メモ・タグを全角半角を問わず探し、勝ち負け・種類・店で絞る', () => {
    const a = s('2026-10-01', 1000, 5000, { place: '駅前ホール', target: 'ＡタイプＸ', tags: ['イベント日'] });
    const b = s('2026-10-02', 1000, 0, { place: '駅前ホール', memo: '朝から並んだ' });
    const c = s('2026-10-03', 1000, 0, { kind: 'keiba', place: 'ネット投票' });
    const all = [a, b, c];
    expect(searchSessions(all, q({ text: 'aタイプx' })).map((x) => x.id)).toEqual([a.id]);
    expect(searchSessions(all, q({ text: 'イベント' })).map((x) => x.id)).toEqual([a.id]);
    expect(searchSessions(all, q({ text: '駅前 朝' })).map((x) => x.id)).toEqual([b.id]);
    expect(searchSessions(all, q({ result: 'lose' })).map((x) => x.id)).toEqual([c.id, b.id]);
    expect(searchSessions(all, q({ kind: 'keiba' })).map((x) => x.id)).toEqual([c.id]);
    expect(searchSessions(all, q({ place: '駅前ホール', sort: 'old' })).map((x) => x.id)).toEqual([a.id, b.id]);
    expect(searchSessions(all, q({ sort: 'best' }))[0].id).toBe(a.id);
  });
  it('同じ日の記録を並べた順のまままとめる', () => {
    const list = newestFirst([s('2026-10-01', 1, 0), s('2026-10-02', 1, 0), s('2026-10-02', 1, 0)]);
    expect(groupByDay(list).map((g) => [g.date, g.items.length])).toEqual([['2026-10-02', 2], ['2026-10-01', 1]]);
  });
  it('店の一覧は多い順で、空の名前は入れない', () => {
    expect(places([s('2026-10-01', 1, 0, { place: 'A' }), s('2026-10-01', 1, 0, { place: 'B' }), s('2026-10-02', 1, 0, { place: 'B' }), s('2026-10-02', 1, 0)])).toEqual(['B', 'A']);
  });
  it('過去実績: 同じ店・同じ種類の、その日までの30日', () => {
    const base = s('2026-10-20', 1, 0, { place: 'A' });
    const list = [
      base,
      s('2026-09-21', 1, 0, { place: 'A' }), s('2026-09-20', 1, 0, { place: 'A' }),
      s('2026-10-21', 1, 0, { place: 'A' }), s('2026-10-10', 1, 0, { place: 'A', kind: 'slot' }), s('2026-10-10', 1, 0, { place: 'B' }),
    ];
    expect(placeRecent(list, base).length).toBe(2);
    expect(placeRecent(list, s('2026-10-20', 1, 0))).toEqual([]);
  });
  it('前の記録・次の記録', () => {
    const a = s('2026-10-01', 1, 0), b = s('2026-10-02', 1, 0), c = s('2026-10-03', 1, 0);
    expect(neighbors([a, b, c], b.id)).toEqual({ older: a, newer: c });
    expect(neighbors([a, b, c], 'x')).toEqual({ older: null, newer: null });
  });
});
