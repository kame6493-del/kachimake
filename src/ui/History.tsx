// 履歴(見本 03): 探す・しぼる・期間の収支・日ごとにまとめた記録
import { useMemo, useState } from 'react';
import type { AppData, Kind, Session } from '../domain/types';
import { KINDS } from '../domain/types';
import { inRange, profit, summarize } from '../domain/stats';
import { monthRange } from '../domain/data';
import { groupByDay, places, searchSessions, type HistoryQuery, type ResultFilter, type SortKey } from '../domain/views';
import { BrandHead, Icon, KindDot, KIND_COLOR, kindShort, Money, MonthPill } from './parts';
import { en, hours, mdw, pct, signedEn, tone } from './format';

const SORTS: [SortKey, string][] = [['new', '日付が新しい順'], ['old', '日付が古い順'], ['best', '収支が多い順'], ['worst', '収支が少ない順']];

export function History({ data, month, setMonth, onOpen }: { data: AppData; month: string; setMonth: (m: string) => void; onOpen: (s: Session) => void }) {
  const [q, setQ] = useState<HistoryQuery>({ text: '', kind: 'all', place: '', result: 'all', sort: 'new' });
  const [allTime, setAllTime] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const set = (p: Partial<HistoryQuery>) => setQ((c) => ({ ...c, ...p }));
  // 言葉で探すときは全期間から探す(「あの店はいつ行った?」を月をまたいで見つけるため)
  const wide = allTime || q.text.trim() !== '';
  const base = useMemo(() => {
    if (wide) return data.sessions;
    const { from, to } = monthRange(month);
    return inRange(data.sessions, from, to);
  }, [data.sessions, month, wide]);
  const list = useMemo(() => searchSessions(base, q), [base, q]);
  const sum = summarize(list);
  const groups = groupByDay(list);
  const placeList = useMemo(() => places(data.sessions), [data.sessions]);
  const kindList = KINDS.filter((k) => data.sessions.some((s) => s.kind === k.id));

  return (
    <div className="page history">
      <BrandHead sub="振り返って、次に活かす。" right={<MonthPill month={month} setMonth={(m) => { setAllTime(false); setMonth(m); }} />} />

      <div className="search-row">
        <label className="search">
          <Icon name="search" />
          <input type="search" value={q.text} placeholder="店舗名・機種名・メモで検索" aria-label="店舗名・機種名・メモで検索" onChange={(e) => set({ text: e.target.value })} />
        </label>
        <button className={`square-btn ${allTime ? 'on' : ''}`} aria-pressed={allTime} aria-label="全期間から探す" title="全期間から探す" onClick={() => setAllTime(!allTime)}>
          <Icon name="sliders" />
        </button>
      </div>

      <div className="filter-row">
        <label className="pill-select">
          <Icon name="layers" />
          <select value={q.kind} aria-label="種目" onChange={(e) => set({ kind: e.target.value as Kind | 'all' })}>
            <option value="all">すべての種目</option>
            {kindList.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <label className="pill-select">
          <Icon name="store" />
          <select value={q.place} aria-label="店舗・場" onChange={(e) => set({ place: e.target.value })}>
            <option value="">すべての店舗・場</option>
            {placeList.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="pill-select narrow">
          <select value={q.result} aria-label="勝ち負け" onChange={(e) => set({ result: e.target.value as ResultFilter })}>
            <option value="all">すべて</option>
            <option value="win">勝ち</option>
            <option value="lose">負け</option>
          </select>
        </label>
      </div>

      <section className="card period" aria-label="期間の収支">
        <div className="card-head"><h2><Icon name="bars3" />{wide ? '全期間' : '期間'}の収支</h2></div>
        <div className="period-cols">
          <div><small>投資</small><Money n={sum.invest} signed={false} /></div>
          <div><small>回収</small><Money n={sum.payout} signed={false} /></div>
          <div><small>収支</small><Money n={sum.profit} /></div>
          <div><small>勝率</small><b>{sum.winRate == null ? '—' : pct(sum.winRate)}</b></div>
        </div>
      </section>

      <div className="list-bar">
        <span>記録 <b>{list.length}</b>件{wide && <small>(全期間から)</small>}</span>
        <label className="pill-select sort">
          <Icon name="sort" />
          <select value={q.sort} aria-label="並べ方" onChange={(e) => set({ sort: e.target.value as SortKey })}>
            {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      {groups.length === 0 && <p className="empty-card">{data.sessions.length === 0 ? '右下の「+」から、最初の収支を記録しましょう' : '当てはまる記録はありません'}</p>}

      {groups.map((g) => {
        const gs = summarize(g.items);
        const closed = open[g.date] === false;
        return (
          <section key={g.date} className="card day-group" aria-label={`${mdw(g.date)}の記録`}>
            <button className="day-group-head" aria-expanded={!closed} onClick={() => setOpen({ ...open, [g.date]: closed })}>
              <b>{mdw(g.date)}</b>
              <span className="dg-nums"><small>投資</small>{en(gs.invest)}<small>回収</small>{en(gs.payout)}<em className={tone(gs.profit)}>{signedEn(gs.profit)}</em></span>
              <Icon name={closed ? 'down' : 'up'} size={18} />
            </button>
            {!closed && (
              <ul className="entries">
                {g.items.map((s) => {
                  const p = profit(s);
                  return (
                    <li key={s.id}>
                      <button className="entry" onClick={() => onOpen(s)} aria-label={`${s.place || kindShort(s.kind)} ${signedEn(p)} の詳細`}>
                        <span className="entry-left">{s.minutes ? hours(s.minutes) : ''}</span>
                        <span className="entry-main">
                          <span className="entry-kind" style={{ color: KIND_COLOR[s.kind] }}><KindDot kind={s.kind} />{kindShort(s.kind)}</span>
                          <b>{s.place || kindShort(s.kind)}</b>
                          {s.target && <small>{s.target}{s.betType ? `・${s.betType}` : ''}</small>}
                          {s.tags && s.tags.length > 0 && <span className="tag-row">{s.tags.map((t) => <span key={t} className="tag">{t}</span>)}</span>}
                        </span>
                        <span className="entry-col"><small>投資</small>{en(s.invest)}</span>
                        <span className="entry-col"><small>回収</small>{en(s.payout)}</span>
                        <span className={`entry-col ${tone(p)}`}><small>収支</small>{signedEn(p)}</span>
                        <Icon name="right" size={18} className="chev" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
