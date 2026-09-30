import type { CounterMachine, Session } from './types';
import { addDays } from './data';
import { normalize } from './data';

/** 評価のお願い: 大勝ちの直後、記入が5回以上、前回から60日以上、生涯3回まで */
export interface ReviewState { asked: number; last: number }
export const REVIEW_MIN_SESSIONS = 5;
export const REVIEW_GAP_DAYS = 60;
export const REVIEW_MAX = 3;

export function shouldAskReview(st: ReviewState, now: number, sessions: number, hype: 'jackpot' | 'big' | 'win' | null) {
  if (hype !== 'big' && hype !== 'jackpot') return false;
  if (sessions < REVIEW_MIN_SESSIONS || st.asked >= REVIEW_MAX) return false;
  return now - st.last >= REVIEW_GAP_DAYS * 86400000;
}

export function parseReview(raw: string | null): ReviewState {
  try {
    const v = JSON.parse(raw ?? '');
    return { asked: Number(v.asked) || 0, last: Number(v.last) || 0 };
  } catch {
    return { asked: 0, last: 0 };
  }
}

/** 無料体験の案内は、新しく3回目を記入したときに1回だけ */
export const INTRO_AT = 3;
export const shouldShowIntro = (newCount: number, shown: boolean, premium: boolean) => !premium && !shown && newCount === INTRO_AT;

/**
 * 夜のお知らせを出す日。今日から days 日ぶん。
 * 今日すでに記入していれば今日は出さない。時刻を過ぎた今日も出さない。
 */
export function reminderDates(sessions: Session[], today: string, nowMinutes: number, time: string, days = 7): string[] {
  const [h, m] = time.split(':').map(Number);
  const at = h * 60 + m;
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    if (i === 0 && (nowMinutes >= at || sessions.some((s) => s.date === today))) continue;
    out.push(d);
  }
  return out;
}

/** バックアップを促すか: 記入が10回以上あって、最後の書き出しから30日以上(一度も無いときも) */
export const shouldNudgeBackup = (sessions: number, lastBackup: number, now: number) =>
  sessions >= 10 && now - lastBackup >= 30 * 86400000;

/** 機種の確率を人に渡すための文字列。「KM1.」の後ろは JSON を base64url にしたもの */
const PREFIX = 'KM1.';

export function encodeMachine(m: CounterMachine): string {
  const body = { n: m.name, s: m.settings, i: m.items.map((it) => [it.name, it.denom]) };
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 文章の中に混ざっていても拾う。読めなければ null。id は毎回新しく振る */
export function decodeMachine(text: string, newId: () => string): CounterMachine | null {
  const hit = text.match(/KM1\.([A-Za-z0-9_-]{8,20000})/);
  if (!hit) return null;
  try {
    const b64 = hit[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const body = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    const raw = {
      machines: [{
        id: newId(), name: body.n, settings: body.s,
        items: (Array.isArray(body.i) ? body.i : []).map((x: unknown) => Array.isArray(x) ? { id: newId(), name: x[0], denom: x[1] } : null).filter(Boolean),
      }],
    };
    const m = normalize(raw).data.machines.find((x) => x.id !== 'sample');
    if (!m || !m.name || m.items.length === 0 || m.items.some((it) => !it.name || it.denom.some((d) => !(d > 1)))) return null;
    return m;
  } catch {
    return null;
  }
}
