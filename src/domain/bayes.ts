import type { CounterMachine } from './types';

/**
 * 小役などの出現回数から、各設定である確率を出す(事前分布は一様)。
 * 各項目は独立な二項分布とみなす: L(s) = Π p_s^k (1-p_s)^(n-k)
 * 桁あふれを避けるため対数で足してから正規化する。
 */
export function posterior(machine: CounterMachine, games: number, counts: Record<string, number>): number[] {
  const n = machine.settings.length;
  const logL = new Array(n).fill(0);
  let used = false;
  for (const item of machine.items) {
    const k = counts[item.id] ?? 0;
    if (games <= 0) continue;
    const kk = Math.min(k, games);
    used = true;
    for (let s = 0; s < n; s++) {
      const denom = item.denom[s];
      if (!(denom > 1)) continue;
      const p = 1 / denom;
      logL[s] += kk * Math.log(p) + (games - kk) * Math.log1p(-p);
    }
  }
  if (!used) return new Array(n).fill(1 / n);
  const max = Math.max(...logL);
  const w = logL.map((v) => Math.exp(v - max));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
}

/** 期待される設定(設定番号の加重平均)。設定名が数字でなければ null */
export function expectedSetting(machine: CounterMachine, post: number[]): number | null {
  const nums = machine.settings.map((s) => Number(s));
  if (nums.some((x) => !Number.isFinite(x))) return null;
  return post.reduce((a, p, i) => a + p * nums[i], 0);
}

/** 実際に出た確率を 1/x の x で返す */
export function observedDenom(games: number, count: number): number | null {
  if (count <= 0 || games <= 0) return null;
  return games / count;
}

/** 自分で数値を入れて使う例(実在機種の数値ではない) */
export const SAMPLE_MACHINE: CounterMachine = {
  id: 'sample',
  name: '練習用(架空の数値)',
  settings: ['1', '2', '3', '4', '5', '6'],
  items: [
    { id: 'bell', name: 'ベル', denom: [8.0, 7.9, 7.8, 7.6, 7.4, 7.2] },
    { id: 'cherry', name: 'チェリー', denom: [36, 35, 34, 33, 32, 30] },
    { id: 'bonus', name: 'ボーナス', denom: [300, 290, 280, 260, 245, 230] },
  ],
};
