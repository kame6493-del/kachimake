// 記録(見本 kachi2_ref_03): 探す・種目でしぼる・月と並べ方・1行ずつの記録。行を左へずらすと編集・削除
import { useMemo, useRef, useState } from 'react';
import type { AppData, Kind, Session } from '../domain/types';
import { KINDS } from '../domain/types';
import { inRange, profit, summarize } from '../domain/stats';
import { monthRange } from '../domain/data';
import { places, searchSessions, type HistoryQuery, type ResultFilter, type SortKey } from '../domain/views';
import { Icon, KindChips, KindIcon, KIND_COLOR, kindShort, MonthSelect } from './parts';
import { en, signedEn, tone } from './format';

const SORTS: [SortKey, string][] = [['new', '新しい順'], ['old', '古い順'], ['best', '収支が多い順'], ['worst', '収支が少ない順']];
const num = (n: number) => n.toLocaleString('ja-JP');
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '±') + num(Math.abs(n));

interface Props {
  data: AppData;
  month: string;
  setMonth: (m: string) => void;
  kind: Kind | 'all';
  setKind: (k: Kind | 'all') => void;
  onOpen: (s: Session) => void;
  onEdit: (s: Session) => void;
  onDelete: (id: string) => void;
}

/** 1行。左へずらすと 編集・削除 が出る(削除は2回押す) */
function Row({ s, onOpen, onEdit, onDelete, open, setOpen }: { s: Session; onOpen: () => void; onEdit: () => void; onDelete: () => void; open: boolean; setOpen: (v: boolean) => void }) {
  const start = useRef<{ x: number; y: number; dx: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [sure, setSure] = useState(false);
  const p = profit(s);
  const [, mo, d] = s.date.split('-').map(Number);
  const w = '日月火水木金土'[new Date(s.date + 'T00:00:00').getDay()];
  const shift = start.current ? dx : open ? -150 : 0;
  return (
    <li className={`hrow ${open ? 'open' : ''}`}>
      <div className="hrow-acts">
        <button className="act-edit" onClick={() => { setOpen(false); onEdit(); }}><Icon name="pencil" size={20} />編集</button>
        <button className="act-del" onClick={() => (sure ? onDelete() : setSure(true))}><Icon name="trash" size={20} />{sure ? '消す' : '削除'}</button>
      </div>
      <button className="hrow-main" style={{ transform: `translateX(${shift}px)` }}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, dx: open ? -150 : 0 }; setDx(open ? -150 : 0); }}
        onPointerMove={(e) => {
          const st = start.current;
          if (!st) return;
          const mx = e.clientX - st.x;
          if (Math.abs(e.clientY - st.y) > 18 && Math.abs(mx) < 12) { start.current = null; return; }
          setDx(Math.max(-170, Math.min(0, st.dx + mx)));
        }}
        onPointerUp={() => {
          const st = start.current;
          start.current = null;
          if (!st) return;
          const moved = Math.abs(dx - st.dx) > 8;
          if (moved) { setOpen(dx < -60); setSure(false); }
          if (!moved) { if (open) setOpen(false); else onOpen(); }
        }}
        onPointerCancel={() => { start.current = null; setDx(0); }}
        onClick={(e) => { if (e.detail === 0) onOpen(); }}
        aria-label={`${s.date} ${s.place || kindShort(s.kind)} ${signedEn(p)} の詳細`}>
        <span className="h-date"><b>{mo}/{d}</b><small>{w}</small></span>
        <KindIcon kind={s.kind} size={34} />
        <span className="h-main">
          <span className="h-badge" style={{ color: KIND_COLOR[s.kind], borderColor: KIND_COLOR[s.kind] }}>{kindShort(s.kind)}</span>
          <b>{s.place || kindShort(s.kind)}</b>
          {s.target && <small>{s.target}{s.betType ? ` ${s.betType}` : ''}</small>}
        </span>
        <span className="h-col"><small>投資</small>{num(s.invest)}</span>
        <span className="h-col"><small>回収</small>{num(s.payout)}</span>
        <span className={`h-col h-p ${tone(p)}`}><small>収支</small>{sgn(p)}</span>
        <Icon name="right" size={16} className="chev" />
      </button>
    </li>
  );
}

export function History({ data, month, setMonth, kind, setKind, onOpen, onEdit, onDelete }: Props) {
  const [q, setQ] = useState<Omit<HistoryQuery, 'kind'>>({ text: '', place: '', result: 'all', sort: 'new' });
  const [allTime, setAllTime] = useState(false);
  const [filters, setFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const set = (p: Partial<HistoryQuery>) => setQ((c) => ({ ...c, ...p }));
  // 言葉で探すときは全期間から探す(「あの店はいつ行った?」を月をまたいで見つけるため)
  const wide = allTime || q.text.trim() !== '';
  const base = useMemo(() => {
    if (wide) return data.sessions;
    const { from, to } = monthRange(month);
    return inRange(data.sessions, from, to);
  }, [data.sessions, month, wide]);
  const list = useMemo(() => searchSessions(base, { ...q, kind }), [base, q, kind]);
  const sum = summarize(list);
  const placeList = useMemo(() => places(data.sessions), [data.sessions]);
  const extra = KINDS.filter((k) => k.id === 'other' && data.sessions.some((s) => s.kind === 'other')).map((k) => k.id);
  const first = data.sessions.length ? data.sessions[0].date.slice(0, 7) : undefined;
  const filtered = q.place !== '' || q.result !== 'all' || allTime;

  return (
    <div className="page history">
      <header className="page-head hist-head">
        <h1 className="ph-title big">記録</h1>
        <label className="search">
          <Icon name="search" size={20} />
          <input type="search" value={q.text} placeholder="記録を検索…" aria-label="店・機種・メモで検索" onChange={(e) => set({ text: e.target.value })} />
        </label>
        <button className={`square-btn ${filters || filtered ? 'on' : ''}`} aria-expanded={filters} aria-label="しぼり込み" onClick={() => setFilters(!filters)}>
          <Icon name="sliders" />
        </button>
      </header>

      <KindChips kinds={['pachinko', 'slot', 'keiba', 'keirin', 'boat', 'auto', ...extra]} value={kind} onChange={setKind} />

      {filters && (
        <div className="card filter-panel">
          <label className="pill-select">
            <Icon name="building" size={18} />
            <select value={q.place} aria-label="店・場" onChange={(e) => set({ place: e.target.value })}>
              <option value="">すべての店・場</option>
              {placeList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="pill-select">
            <Icon name="trophy" size={18} />
            <select value={q.result} aria-label="勝ち負け" onChange={(e) => set({ result: e.target.value as ResultFilter })}>
              <option value="all">勝ちも負けも</option>
              <option value="win">勝ちだけ</option>
              <option value="lose">負けだけ</option>
            </select>
          </label>
          <button className={`chip ${allTime ? 'on' : ''}`} aria-pressed={allTime} onClick={() => setAllTime(!allTime)}>全期間から</button>
        </div>
      )}

      <div className="hist-bar">
        {wide ? <span className="pill-static"><Icon name="calendar" size={20} />全期間</span>
          : <MonthSelect month={month} setMonth={setMonth} first={first} />}
        <label className="pill-select sort">
          <Icon name="sort" size={20} />
          <select value={q.sort} aria-label="並べ方" onChange={(e) => set({ sort: e.target.value as SortKey })}>
            {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      {list.length > 0 && (
        <p className="hist-sum">{list.length}件・投資 {en(sum.invest)}・回収 {en(sum.payout)}・収支 <b className={tone(sum.profit)}>{signedEn(sum.profit)}</b></p>
      )}

      {list.length === 0 ? (
        <p className="empty-card">{data.sessions.length === 0 ? '右下の「+」から、最初の収支を記録しましょう' : '当てはまる記録はありません'}</p>
      ) : (
        <>
          <ul className="hlist">
            {list.map((s) => (
              <Row key={s.id} s={s} open={openId === s.id} setOpen={(v) => setOpenId(v ? s.id : null)}
                onOpen={() => onOpen(s)} onEdit={() => onEdit(s)} onDelete={() => { setOpenId(null); onDelete(s.id); }} />
            ))}
          </ul>
          <p className="swipe-hint"><span aria-hidden="true">⟵⟶</span>スワイプで編集・削除ができます</p>
        </>
      )}
    </div>
  );
}
