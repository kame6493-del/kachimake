import { DEFAULT_SETTINGS, KINDS, type AppData, type CounterMachine, type Kind, type Session } from './types';
import { SAMPLE_MACHINE } from './bayes';

export const emptyData = (): AppData => ({
  version: 1,
  sessions: [],
  settings: { ...DEFAULT_SETTINGS },
  machines: [SAMPLE_MACHINE],
  counter: null,
});

const isKind = (k: unknown): k is Kind => KINDS.some((x) => x.id === k);
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 読み込んだ JSON(古い版・壊れた物・他人が作った物)を安全な形に直す。直せない記録は捨てる */
export function normalize(raw: unknown): { data: AppData; dropped: number } {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return { data: base, dropped: 0 };
  const r = raw as Record<string, unknown>;
  let dropped = 0;
  const sessions: Session[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(r.sessions) ? r.sessions : []) {
    if (!x || typeof x !== 'object') { dropped++; continue; }
    const s = x as Record<string, unknown>;
    if (typeof s.date !== 'string' || !DATE.test(s.date) || !isKind(s.kind)) { dropped++; continue; }
    let id = str(s.id, 64) || newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    sessions.push({
      id,
      date: s.date,
      kind: s.kind,
      place: str(s.place, 80),
      target: str(s.target, 80),
      invest: num(s.invest),
      payout: num(s.payout),
      minutes: Math.min(num(s.minutes), 24 * 60),
      betType: str(s.betType, 40) || undefined,
      memo: str(s.memo, 1000),
      createdAt: num(s.createdAt) || Date.now(),
      updatedAt: num(s.updatedAt) || Date.now(),
    });
  }
  const st = (r.settings ?? {}) as Record<string, unknown>;
  const settings = {
    monthlyLimit: num(st.monthlyLimit),
    weekStart: st.weekStart === 1 ? 1 : 0,
    winColor: st.winColor === 'blue' ? 'blue' : 'ink',
  } as AppData['settings'];
  const machines: CounterMachine[] = [];
  for (const m of Array.isArray(r.machines) ? r.machines : []) {
    const mm = m as Partial<CounterMachine>;
    if (!mm || typeof mm.name !== 'string' || !Array.isArray(mm.settings) || !Array.isArray(mm.items)) continue;
    const settingsList = mm.settings.map((x) => str(x, 10)).filter(Boolean);
    if (settingsList.length < 2) continue;
    machines.push({
      id: str(mm.id, 64) || newId(),
      name: str(mm.name, 60),
      settings: settingsList,
      items: mm.items
        .filter((it) => it && typeof it.name === 'string' && Array.isArray(it.denom))
        .map((it) => ({
          id: str(it.id, 64) || newId(),
          name: str(it.name, 30),
          denom: settingsList.map((_, i) => {
            const v = Number(it.denom[i]);
            return Number.isFinite(v) && v > 1 ? v : 0;
          }),
        })),
    });
  }
  if (!machines.some((m) => m.id === SAMPLE_MACHINE.id)) machines.unshift(SAMPLE_MACHINE);
  const c = r.counter as AppData['counter'];
  const counter =
    c && typeof c === 'object' && machines.some((m) => m.id === c.machineId)
      ? { machineId: c.machineId, games: num(c.games), counts: Object.fromEntries(Object.entries(c.counts ?? {}).map(([k, v]) => [k, num(v)])) }
      : null;
  sessions.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  return { data: { version: 1, sessions, settings, machines, counter }, dropped };
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const ym = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function addMonths(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  return ym(new Date(y, m - 1 + delta, 1));
}

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

export function addDays(date: string, delta: number) {
  const [y, m, d] = date.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + delta));
}

/** 表計算ソフト用。数式として解釈される先頭文字は無害化する */
export function toCsv(list: Session[]) {
  const esc = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s) && typeof v === 'string') s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['日付', '種類', '店舗・場', '機種・レース', '券種', '投資', '回収', '収支', '時間(分)', 'メモ'];
  const rows = list.map((s) => [
    s.date, KINDS.find((k) => k.id === s.kind)!.label, s.place, s.target, s.betType ?? '',
    s.invest, s.payout, s.payout - s.invest, s.minutes, s.memo,
  ].map(esc).join(','));
  return '﻿' + [head.join(','), ...rows].join('\r\n');
}
