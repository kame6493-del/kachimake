import { describe, expect, it } from 'vitest';
import { decodeMachine, encodeMachine, reminderDates, shouldAskReview, shouldNudgeBackup, shouldShowIntro } from './nudge';
import { ballsToYen, frequent, groupBy, latest, stock, usedTags } from './stats';
import { normalize, toCsv } from './data';
import type { CounterMachine, Session } from './types';

let seq = 0;
const s = (date: string, invest: number, payout: number, extra: Partial<Session> = {}): Session => ({
  id: String(++seq), date, kind: 'pachinko', place: '', target: '', invest, payout, minutes: 0, memo: '',
  createdAt: seq, updatedAt: seq, ...extra,
});
const DAY = 86400000;

describe('評価のお願い', () => {
  const fresh = { asked: 0, last: 0 };
  it('1万円以上の勝ちで、記入5回以上のときだけ', () => {
    expect(shouldAskReview(fresh, DAY * 100, 5, 'big')).toBe(true);
    expect(shouldAskReview(fresh, DAY * 100, 5, 'jackpot')).toBe(true);
    expect(shouldAskReview(fresh, DAY * 100, 5, 'win')).toBe(false);
    expect(shouldAskReview(fresh, DAY * 100, 4, 'big')).toBe(false);
  });
  it('前回から60日たっていなければ出さない。3回で打ち止め', () => {
    expect(shouldAskReview({ asked: 1, last: DAY * 100 }, DAY * 159, 9, 'big')).toBe(false);
    expect(shouldAskReview({ asked: 1, last: DAY * 100 }, DAY * 160, 9, 'big')).toBe(true);
    expect(shouldAskReview({ asked: 3, last: 0 }, DAY * 999, 9, 'big')).toBe(false);
  });
});

describe('無料体験の案内', () => {
  it('新しく3回目を記入したときに1回だけ。有料の人には出さない', () => {
    expect(shouldShowIntro(3, false, false)).toBe(true);
    expect(shouldShowIntro(2, false, false)).toBe(false);
    expect(shouldShowIntro(4, false, false)).toBe(false);
    expect(shouldShowIntro(3, true, false)).toBe(false);
    expect(shouldShowIntro(3, false, true)).toBe(false);
  });
});

describe('夜のお知らせの日', () => {
  it('今日記入していれば今日は出さず、明日から7日ぶん', () => {
    const d = reminderDates([s('2026-09-30', 1, 0)], '2026-09-30', 600, '21:30');
    expect(d).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']);
  });
  it('記入していなくても、時刻を過ぎていれば今日は出さない', () => {
    expect(reminderDates([], '2026-09-30', 21 * 60 + 30, '21:30', 2)).toEqual(['2026-10-01']);
    expect(reminderDates([], '2026-09-30', 21 * 60 + 29, '21:30', 2)).toEqual(['2026-09-30', '2026-10-01']);
  });
  it('月末・年末をまたぐ', () => {
    expect(reminderDates([], '2026-12-31', 0, '21:30', 2)).toEqual(['2026-12-31', '2027-01-01']);
  });
});

describe('バックアップの催促', () => {
  it('10回以上の記入があり、30日以上書き出していないとき', () => {
    expect(shouldNudgeBackup(10, 0, DAY * 40)).toBe(true);
    expect(shouldNudgeBackup(9, 0, DAY * 40)).toBe(false);
    expect(shouldNudgeBackup(10, DAY * 20, DAY * 40)).toBe(false);
  });
});

describe('機種コード', () => {
  const m: CounterMachine = { id: 'x1', name: 'ジャグ系(日本語)', settings: ['1', '2', '5', '6'], items: [{ id: 'a', name: 'ぶどう', denom: [6.49, 6.49, 6.35, 6.07] }, { id: 'b', name: 'BIG', denom: [273, 270, 260, 240] }] };
  it('書いて読むと同じ中身に戻る。id は新しく振る', () => {
    let n = 0;
    const got = decodeMachine(encodeMachine(m), () => `n${++n}`)!;
    expect(got.name).toBe(m.name);
    expect(got.settings).toEqual(m.settings);
    expect(got.items.map((i) => [i.name, i.denom])).toEqual(m.items.map((i) => [i.name, i.denom]));
    expect(got.id).not.toBe('x1');
  });
  it('LINE の文に混ざっていても拾う', () => {
    const text = `これ使って\n${encodeMachine(m)}\nよろしく`;
    expect(decodeMachine(text, () => 'z')?.name).toBe(m.name);
  });
  it('壊れたコード・確率の抜けたコードは読まない', () => {
    const code = encodeMachine(m);
    expect(decodeMachine(code.slice(0, 20), () => 'z')).toBeNull();
    expect(decodeMachine('KM1.!!!!', () => 'z')).toBeNull();
    const bad = encodeMachine({ ...m, items: [{ id: 'a', name: 'ぶどう', denom: [0, 6, 6, 6] }] });
    expect(decodeMachine(bad, () => 'z')).toBeNull();
  });
});

describe('貯玉・印・候補', () => {
  it('店ごとに 貯めた - 再プレイ を数え、最後のレートを持つ', () => {
    const list = [
      s('2026-09-01', 10000, 20000, { place: '駅前', saved: 2500, rate: 4 }),
      s('2026-09-05', 8000, 0, { place: '駅前', replay: 1000, rate: 4 }),
      s('2026-09-06', 0, 5000, { kind: 'slot', place: '駅前', saved: 250, rate: 20 }),
      s('2026-09-07', 0, 5000, { place: '', saved: 999, rate: 4 }),
      s('2026-09-08', 100, 0, { kind: 'keiba', place: '駅前', saved: 50 }),
    ];
    const r = stock(list);
    expect(r).toHaveLength(2);
    expect(r.find((x) => x.kind === 'pachinko')).toMatchObject({ place: '駅前', count: 1500, rate: 4 });
    expect(r.find((x) => x.kind === 'slot')).toMatchObject({ count: 250, rate: 20 });
    expect(ballsToYen(1500, 4)).toBe(6000);
    expect(ballsToYen(3, 0.5)).toBe(2);
  });
  it('印ごとの収支: 印が2つの回は両方に入り、印なしは最後', () => {
    const list = [s('2026-09-01', 0, 1000, { tags: ['イベント日', '新台'] }), s('2026-09-02', 500, 0, { tags: ['イベント日'] }), s('2026-09-03', 0, 9000)];
    const rows = groupBy(list, 'tag');
    expect(rows.map((r) => r.label)).toEqual(['新台', 'イベント日', '(印なし)']);
    expect(rows[1].summary.profit).toBe(500);
    expect(usedTags(list)).toEqual(['イベント日', '新台']);
  });
  it('よく使う名前は回数順、同数なら最近の方。種類ごと', () => {
    const list = [s('2026-09-01', 1, 0, { place: 'A' }), s('2026-09-02', 1, 0, { place: 'B' }), s('2026-09-03', 1, 0, { place: 'A' }), s('2026-09-04', 1, 0, { place: 'C' }), s('2026-09-05', 1, 0, { kind: 'slot', place: 'Z' })];
    expect(frequent(list, 'pachinko', 'place')).toEqual(['A', 'C', 'B']);
    expect(frequent(list, 'slot', 'place')).toEqual(['Z']);
  });
  it('いちばん最近の記入は、日付が同じなら後から書いた方', () => {
    const a = s('2026-09-05', 1, 0);
    const b = s('2026-09-05', 1, 0);
    expect(latest([b, a, s('2026-09-01', 1, 0)])?.id).toBe(b.id);
    expect(latest([])).toBeNull();
  });
});

describe('新しい項目の読み込み', () => {
  it('レート・玉・印は正しいときだけ残す。古いバックアップはそのまま読める', () => {
    const { data } = normalize({
      sessions: [
        { date: '2026-09-01', kind: 'slot', invest: 1, payout: 0, rate: 20, replay: 30, saved: -5, tags: ['イベント日', 'イベント日', '', 3] },
        { date: '2026-09-02', kind: 'pachinko', invest: 1, payout: 0, rate: 'x', tags: 'イベント日' },
      ],
      settings: { fontScale: 2, remind: { on: true, time: '25:00' } },
    });
    expect(data.sessions[0]).toMatchObject({ rate: 20, replay: 30, tags: ['イベント日'] });
    expect(data.sessions[0].saved).toBeUndefined();
    expect(data.sessions[1].rate).toBeUndefined();
    expect(data.sessions[1].tags).toBeUndefined();
    expect(data.settings.fontScale).toBe(1);
    expect(data.settings.remind).toEqual({ on: true, time: '21:30' });
  });
  it('CSV にレート・玉・印の列が入る', () => {
    const csv = toCsv([s('2026-09-01', 4000, 0, { rate: 4, replay: 1000, tags: ['特定日'] })]);
    expect(csv.split('\r\n')[1]).toContain(',4,1000,,特定日,');
  });
});
