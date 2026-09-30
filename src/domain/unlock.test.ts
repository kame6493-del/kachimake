import { describe, expect, it } from 'vitest';
import { REWARD_DAILY_LIMIT, dailyLeft, extendUnlock, parseDaily, spendDaily } from './unlock';

const H = 3600_000;

describe('extendUnlock', () => {
  it('期限切れなら今から24時間', () => {
    expect(extendUnlock(1000, 0)).toBe(1000 + 24 * H);
  });
  it('残りがあれば足す', () => {
    expect(extendUnlock(0, 10 * H)).toBe(34 * H);
  });
  it('先の期限は48時間まで', () => {
    expect(extendUnlock(0, 40 * H)).toBe(48 * H);
  });
});

describe('daily', () => {
  it('日付が変われば回数は戻る', () => {
    expect(dailyLeft({ day: '2026-09-29', count: 5 }, '2026-09-30')).toBe(REWARD_DAILY_LIMIT);
  });
  it('使うと減り、0より下にはならない', () => {
    let rec = null;
    for (let i = 0; i < REWARD_DAILY_LIMIT + 2; i++) rec = spendDaily(rec, '2026-09-30');
    expect(dailyLeft(rec, '2026-09-30')).toBe(0);
  });
  it('壊れた保存値は無かったことにする', () => {
    expect(parseDaily('{')).toBeNull();
    expect(parseDaily('{"day":1}')).toBeNull();
    expect(parseDaily(null)).toBeNull();
  });
});
