import { describe, expect, it } from 'vitest';
import { cumulative, groupBy, limitStatus, monthly, summarize } from './stats';
import { posterior, expectedSetting, SAMPLE_MACHINE } from './bayes';
import { addDays, addMonths, monthRange, normalize, toCsv } from './data';
import type { Session } from './types';

let seq = 0;
const s = (date: string, invest: number, payout: number, extra: Partial<Session> = {}): Session => ({
  id: String(++seq), date, kind: 'pachinko', place: '', target: '', invest, payout, minutes: 0, memo: '',
  createdAt: seq, updatedAt: seq, ...extra,
});

describe('summarize', () => {
  it('空なら勝率・回収率・時給は null', () => {
    const r = summarize([]);
    expect(r.count).toBe(0);
    expect(r.winRate).toBeNull();
    expect(r.recovery).toBeNull();
    expect(r.hourly).toBeNull();
  });
  it('収支・勝率・回収率・最高最低を出す。引き分けは勝率の分母に入れない', () => {
    const r = summarize([s('2026-09-01', 10000, 25000), s('2026-09-02', 20000, 0), s('2026-09-03', 5000, 5000)]);
    expect(r.profit).toBe(-5000);
    expect(r.wins).toBe(1);
    expect(r.losses).toBe(1);
    expect(r.winRate).toBe(0.5);
    expect(r.recovery).toBeCloseTo(30000 / 35000);
    expect(r.best).toBe(15000);
    expect(r.worst).toBe(-20000);
  });
  it('時給は時間を記録した回だけで割る', () => {
    const r = summarize([s('2026-09-01', 0, 6000, { minutes: 120 }), s('2026-09-02', 50000, 0)]);
    expect(r.hourly).toBe(3000);
  });
});

describe('cumulative', () => {
  it('同じ日をまとめ、日付順に累計する(入力順に依存しない)', () => {
    const c = cumulative([s('2026-09-03', 0, 100), s('2026-09-01', 500, 0), s('2026-09-01', 0, 200)]);
    expect(c).toEqual([
      { date: '2026-09-01', day: -300, total: -300 },
      { date: '2026-09-03', day: 100, total: -200 },
    ]);
  });
});

describe('groupBy', () => {
  it('曜日は日〜土の順、それ以外は収支の多い順', () => {
    const list = [s('2026-09-27', 0, 100, { place: 'A' }), s('2026-09-28', 100, 0, { place: 'B' }), s('2026-09-26', 0, 300, { place: 'A' })];
    expect(groupBy(list, 'weekday').map((r) => r.label)).toEqual(['日', '月', '土']);
    const places = groupBy(list, 'place');
    expect(places[0]).toMatchObject({ label: 'A', kind: 'pachinko' });
    expect(places[0].summary.profit).toBe(400);
  });
  it('空欄は(未設定)にまとめる', () => {
    expect(groupBy([s('2026-09-01', 1, 0)], 'target')[0].label).toBe('(未設定)');
  });
  it('同じ名前でも種類が違えば別の行(競馬の12Rとボートの12R)', () => {
    const rows = groupBy([s('2026-09-01', 100, 0, { kind: 'keiba', target: '12R' }), s('2026-09-02', 0, 500, { kind: 'boat', target: '12R' })], 'target');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.kind).sort()).toEqual(['boat', 'keiba']);
  });
});

describe('monthly / limit', () => {
  it('月ごとに古い順', () => {
    expect(monthly([s('2026-10-01', 0, 1), s('2026-08-01', 0, 1)]).map((m) => m.month)).toEqual(['2026-08', '2026-10']);
  });
  it('上限は今月の負け額で判定。勝っている月は0', () => {
    const list = [s('2026-09-01', 30000, 0), s('2026-09-02', 0, 10000), s('2026-08-01', 90000, 0)];
    expect(limitStatus(list, '2026-09', 40000)).toMatchObject({ lost: 20000, ratio: 0.5, spent: 30000 });
    expect(limitStatus([s('2026-09-01', 0, 5000)], '2026-09', 40000)!.lost).toBe(0);
    expect(limitStatus(list, '2026-09', 0)).toBeNull();
  });
});

describe('posterior', () => {
  it('数えていなければ一様', () => {
    const p = posterior(SAMPLE_MACHINE, 0, {});
    p.forEach((v) => expect(v).toBeCloseTo(1 / 6));
  });
  it('設定6の確率どおりに出れば設定6が最も高い。合計は1', () => {
    const games = 8000;
    const counts = Object.fromEntries(SAMPLE_MACHINE.items.map((it) => [it.id, Math.round(games / it.denom[5])]));
    const p = posterior(SAMPLE_MACHINE, games, counts);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(p.indexOf(Math.max(...p))).toBe(5);
    expect(expectedSetting(SAMPLE_MACHINE, p)!).toBeGreaterThan(5);
  });
  it('設定1の確率どおりなら設定1が最も高い', () => {
    const games = 8000;
    const counts = Object.fromEntries(SAMPLE_MACHINE.items.map((it) => [it.id, Math.round(games / it.denom[0])]));
    const p = posterior(SAMPLE_MACHINE, games, counts);
    expect(p.indexOf(Math.max(...p))).toBe(0);
  });
  it('大きな回転数でも NaN にならない', () => {
    const p = posterior(SAMPLE_MACHINE, 200000, { bell: 26000, cherry: 6000, bonus: 800 });
    p.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
  it('回数が回転数を超えていても壊れない', () => {
    const p = posterior(SAMPLE_MACHINE, 10, { bell: 50 });
    p.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe('normalize', () => {
  it('壊れた記録は捨て、数値は0以上の整数に直す', () => {
    const { data, dropped } = normalize({
      sessions: [
        { date: '2026-09-01', kind: 'slot', invest: '1000', payout: -5, id: 'a' },
        { date: '9/1', kind: 'slot' },
        { date: '2026-09-02', kind: 'mahjong' },
        null,
      ],
    });
    expect(dropped).toBe(3);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({ invest: 1000, payout: 0, kind: 'slot' });
    expect(data.machines[0].id).toBe('sample');
  });
  it('重複したIDは振り直す', () => {
    const { data } = normalize({ sessions: [{ id: 'x', date: '2026-09-01', kind: 'keiba' }, { id: 'x', date: '2026-09-02', kind: 'keiba' }] });
    expect(new Set(data.sessions.map((x) => x.id)).size).toBe(2);
  });
  it('null や文字列でも空データを返す', () => {
    expect(normalize(null).data.sessions).toEqual([]);
    expect(normalize('abc').data.sessions).toEqual([]);
  });
  it('書き出し→読み込みで同じ記録に戻る', () => {
    const list = [s('2026-09-01', 1000, 3000, { kind: 'boat', betType: '3連単', memo: 'メモ', minutes: 30 })];
    const { data } = normalize(JSON.parse(JSON.stringify({ sessions: list })));
    expect(data.sessions[0]).toEqual(list[0]);
  });
});

describe('dates / csv', () => {
  it('月の加算と末日', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(monthRange('2028-02').to).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('CSV は数式になる文字を無害化し、負の収支はそのまま数値で出す', () => {
    const csv = toCsv([s('2026-09-01', 5000, 0, { memo: '=HYPERLINK("x")', place: 'A,B' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"A,B"');
    expect(csv).toContain(',-5000,');
  });
});
