const nf = new Intl.NumberFormat('ja-JP');

export const yen = (n: number) => `${n < 0 ? '-' : ''}¥${nf.format(Math.abs(Math.round(n)))}`;
/** 収支は必ず符号を付ける(0 は ±0) */
export const signedYen = (n: number) => (n > 0 ? `+${yen(n)}` : n < 0 ? yen(n) : '±¥0');
/** カレンダーのマスに入る短い表記 +1.2万 / -8,000 */
export function shortYen(n: number) {
  const a = Math.abs(n);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  if (a >= 100000) return `${sign}${Math.round(a / 10000)}万`;
  if (a >= 10000) return `${sign}${(a / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return `${sign}${nf.format(a)}`;
}
export const pct = (v: number | null, digits = 1) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`);
export const hours = (min: number) => (min <= 0 ? '—' : min < 60 ? `${min}分` : `${Math.floor(min / 60)}時間${min % 60 ? `${min % 60}分` : ''}`);
export const tone = (n: number) => (n > 0 ? 'plus' : n < 0 ? 'minus' : 'zero');

export function dateJa(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const w = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日(${w})`;
}
export const monthJa = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
};

/** 1.2.0 の画面の金額は「12,000円」(見本の書き方)。シェア画像などは今までどおり ¥ */
export const en = (n: number) => `${n < 0 ? '-' : ''}${nf.format(Math.abs(Math.round(n)))}円`;
export const signedEn = (n: number) => (n > 0 ? `+${en(n)}` : n < 0 ? en(n) : '±0円');
/** 10/21(火) */
export function mdw(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}/${d}(${'日月火水木金土'[new Date(y, m - 1, d).getDay()]})`;
}
/** 2026年10月21日(火) */
export function ymdJa(date: string) {
  return `${date.slice(0, 4)}年${dateJa(date)}`;
}
/** グラフの目盛り 10万 / -5万 / 0 */
export function manYen(n: number) {
  if (n === 0) return '0';
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 10000) return `${s}${(a / 10000).toFixed(a % 10000 ? 1 : 0)}万`;
  return `${s}${nf.format(a)}`;
}
