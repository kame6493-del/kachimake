/** リワード広告1本で、有料の分析を何時間使えるか */
export const REWARD_HOURS = 24;
/** 1日に見られるリワード広告の上限。見続ければ有料と同じになるのを防ぐ */
export const REWARD_DAILY_LIMIT = 2;
const HOUR = 3600_000;

/** 期限の延ばし方: 残りがあれば足す。ただし先の期限は最大48時間まで */
export function extendUnlock(now: number, prevUntil: number): number {
  const base = Math.max(now, prevUntil);
  return Math.min(base + REWARD_HOURS * HOUR, now + 2 * REWARD_HOURS * HOUR);
}

export interface DailyCount { day: string; count: number }

export function parseDaily(raw: string | null): DailyCount | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DailyCount;
    return typeof v?.day === 'string' && Number.isFinite(v.count) ? v : null;
  } catch {
    return null;
  }
}

export function dailyLeft(rec: DailyCount | null, today: string, limit = REWARD_DAILY_LIMIT): number {
  if (!rec || rec.day !== today) return limit;
  return Math.max(0, limit - rec.count);
}

export function spendDaily(rec: DailyCount | null, today: string): DailyCount {
  return rec && rec.day === today ? { day: today, count: rec.count + 1 } : { day: today, count: 1 };
}
