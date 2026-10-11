// カレンダー(見本 08): 月の収支と勝ち負けの日数、種目のしぼり込み、日ごとの収支、選んだ日の記録
import { useMemo, useState } from 'react';
import type { AppData, Kind, Session } from '../domain/types';
import { KINDS } from '../domain/types';
import { byDate, inRange, profit, summarize } from '../domain/stats';
import { monthRange, pad, today } from '../domain/data';
import { dayRecord } from '../domain/views';
import { BrandHead, Icon, KindChips, KindIcon, KIND_COLOR, kindShort, Money, MonthPill } from './parts';
import { dateJa, en, monthJa, pct, signedEn, tone } from './format';

interface Props {
  data: AppData;
  month: string;
  setMonth: (m: string) => void;
  selected: string;
  setSelected: (d: string) => void;
  onOpen: (s: Session) => void;
  onAdd: (date: string) => void;
}

const amt = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '±') + Math.abs(n).toLocaleString('ja-JP');

export function CalendarPage({ data, month, setMonth, selected, setSelected, onOpen, onAdd }: Props) {
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const list = useMemo(() => (kind === 'all' ? data.sessions : data.sessions.filter((s) => s.kind === kind)), [data.sessions, kind]);
  const { from, to } = monthRange(month);
  const monthList = useMemo(() => inRange(list, from, to), [list, from, to]);
  const sum = summarize(monthList);
  const rec = dayRecord(monthList);
  const daily = useMemo(() => byDate(monthList), [monthList]);
  const usedKinds = KINDS.map((k) => k.id).filter((k) => data.sessions.some((s) => s.kind === k));
  const chipKinds: Kind[] = usedKinds.length ? usedKinds : ['pachinko', 'slot', 'keiba', 'keirin', 'boat'];

  const [y, m] = month.split('-').map(Number);
  const ws = data.settings.weekStart;
  const first = new Date(y, m - 1, 1).getDay();
  const offset = (first - ws + 7) % 7;
  const days = new Date(y, m, 0).getDate();
  const prevDays = new Date(y, m - 1, 0).getDate();
  const cells: { d: string | null; n: number }[] = [
    ...Array.from({ length: offset }, (_, i) => ({ d: null, n: prevDays - offset + 1 + i })),
    ...Array.from({ length: days }, (_, i) => ({ d: `${month}-${pad(i + 1)}`, n: i + 1 })),
  ];
  for (let n = 1; cells.length % 7; n++) cells.push({ d: null, n });
  const heads = ws === 1 ? ['月', '火', '水', '木', '金', '土', '日'] : ['日', '月', '火', '水', '木', '金', '土'];
  const t = today();

  const dayList = list.filter((s) => s.date === selected);
  const ds = summarize(dayList);
  const memo = dayList.find((s) => s.memo.trim())?.memo.trim();

  return (
    <div className="page calendar-page">
      <BrandHead sub="遊びを、記録で味方に。" right={<MonthPill month={month} setMonth={setMonth} />} />

      <div className="cal-top">
        <section className="card cal-sum" aria-label={`${monthJa(month)}の収支`}>
          <div className="sum-head"><Icon name="calendar" className="ic-blue" />{m}月の収支</div>
          <Money n={sum.profit} className="sum-big" />
          <div className="sum-meta"><span>投資 {en(sum.invest)}</span><span>回収 {en(sum.payout)}</span></div>
        </section>
        <div className="tiles6">
          <div className="tile"><span><Icon name="trophy" size={18} className="ic-gold" />勝ち日数</span><b className="plus">{rec.win}<small>日</small></b></div>
          <div className="tile"><span><Icon name="trendDown" size={18} className="ic-red" />負け日数</span><b className="minus">{rec.lose}<small>日</small></b></div>
          <div className="tile"><span><Icon name="dash" size={18} />引き分け</span><b>{rec.draw}<small>日</small></b></div>
          <div className="tile"><span><Icon name="target" size={18} />勝率</span><b>{rec.winRate == null ? '—' : pct(rec.winRate)}</b></div>
          <div className="tile hot"><span><Icon name="flame" size={18} className="ic-gold" />連勝</span><b className="plus">{rec.bestWin}<small>日</small></b></div>
          <div className="tile"><span><Icon name="flame" size={18} className="ic-red" />連敗</span><b className="minus">{rec.bestLose}<small>日</small></b></div>
        </div>
      </div>

      <KindChips kinds={chipKinds} value={kind} onChange={setKind} allLabel="すべての種目" />

      <table className="cal" aria-label={`${monthJa(month)}のカレンダー`}>
        <thead>
          <tr>{heads.map((h) => <th key={h} scope="col" className={h === '日' ? 'sun' : h === '土' ? 'sat' : ''}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, w) => (
            <tr key={w}>
              {cells.slice(w * 7, w * 7 + 7).map((c, i) => {
                const col = heads[i];
                if (!c.d) return <td key={`e${w}${i}`} className="out"><span className="cal-n">{c.n}</span></td>;
                const v = daily.get(c.d);
                return (
                  <td key={c.d} className={`${c.d === selected ? 'sel' : ''} ${c.d === t ? 'today' : ''}`}>
                    <button onClick={() => setSelected(c.d!)} aria-pressed={c.d === selected} aria-label={`${dateJa(c.d)}${v != null ? ` ${signedEn(v)}` : ''}`}>
                      <span className={`cal-n ${col === '日' ? 'sun' : col === '土' ? 'sat' : ''}`}>{c.n}</span>
                      {v != null && <i className={`cal-dot ${tone(v)}`} aria-hidden="true" />}
                      {v != null && <span className={`cal-a ${tone(v)}`}>{amt(v)}</span>}
                      {v != null && v >= 30000 && <span className="hot-mark" aria-hidden="true">激</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cal-legend">
        <span><i className="cal-dot plus" />勝ち(プラス収支)</span>
        <span><i className="cal-dot minus" />負け(マイナス収支)</span>
        <span><i className="cal-dot zero" />引き分け</span>
      </div>

      <section className="card day-panel" aria-label={`${dateJa(selected)}の記録`}>
        <div className="grip" aria-hidden="true" />
        <div className="dp-head">
          <b>{dateJa(selected)}</b>
          {dayList.length > 0 && <span className={`badge ${tone(ds.profit)}`}>{ds.profit > 0 ? '勝ち' : ds.profit < 0 ? '負け' : '引き分け'}</span>}
          {dayList.length > 0 && <span className="dp-sum"><small>収支</small><Money n={ds.profit} /></span>}
        </div>
        {dayList.length === 0 ? (
          <div className="dp-empty">
            <p>この日の記録はありません</p>
            <button className="btn-line" onClick={() => onAdd(selected)}><Icon name="plus" size={18} />この日の収支を記録する</button>
          </div>
        ) : (
          <>
            <div className="dp-tiles">
              <div><Icon name="coins" /><span><small>投資</small>{en(ds.invest)}</span></div>
              <div><Icon name="upload" /><span><small>回収</small>{en(ds.payout)}</span></div>
              <div><Icon name="doc" /><span><small>実戦数</small>{ds.count}件</span></div>
            </div>
            <ul className="dp-list">
              {dayList.map((s) => (
                <li key={s.id}>
                  <button onClick={() => onOpen(s)} aria-label={`${kindShort(s.kind)} ${s.place} ${signedEn(profit(s))} の詳細`}>
                    <KindIcon kind={s.kind} size={34} />
                    <span className="dp-main">
                      <span><em style={{ color: KIND_COLOR[s.kind] }}>{kindShort(s.kind)}</em>{s.place}</span>
                      <small>{s.target}</small>
                    </span>
                    <b className={tone(profit(s))}>{signedEn(profit(s))}</b>
                    <Icon name="right" size={18} className="chev" />
                  </button>
                </li>
              ))}
            </ul>
            {memo && (
              <div className="dp-memo"><Icon name="memo" /><span>メモ</span><p>{memo}</p></div>
            )}
            <button className="link-add" onClick={() => onAdd(selected)}><Icon name="plus" size={16} />この日に記録を足す</button>
          </>
        )}
      </section>
    </div>
  );
}
