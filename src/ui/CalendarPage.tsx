// カレンダー(見本 kachi2_ref_05): 日ごとの収支を色のマスで、行った種目を1文字で。選んだ日の合計と記録、見方
import { useMemo } from 'react';
import type { AppData, Kind, Session } from '../domain/types';
import { KINDS } from '../domain/types';
import { profit, summarize } from '../domain/stats';
import { addMonths, pad, today } from '../domain/data';
import { Icon, KindIcon, kindLetter, kindShort, Money, MonthSelect, PageHead } from './parts';
import { dateJa, en, hours, monthJa, signedEn, tone } from './format';

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
  // 日ごとの収支と、行った種目(種目の並び順)
  const days = useMemo(() => {
    const m = new Map<string, { p: number; kinds: Set<Kind> }>();
    for (const s of data.sessions) {
      if (s.date.slice(0, 7) !== month) continue;
      const c = m.get(s.date) ?? { p: 0, kinds: new Set<Kind>() };
      c.p += profit(s);
      c.kinds.add(s.kind);
      m.set(s.date, c);
    }
    return m;
  }, [data.sessions, month]);

  const [y, mo] = month.split('-').map(Number);
  const ws = data.settings.weekStart;
  const first = new Date(y, mo - 1, 1).getDay();
  const offset = (first - ws + 7) % 7;
  const count = new Date(y, mo, 0).getDate();
  const prevDays = new Date(y, mo - 1, 0).getDate();
  const cells: { d: string | null; n: number }[] = [
    ...Array.from({ length: offset }, (_, i) => ({ d: null, n: prevDays - offset + 1 + i })),
    ...Array.from({ length: count }, (_, i) => ({ d: `${month}-${pad(i + 1)}`, n: i + 1 })),
  ];
  for (let n = 1; cells.length % 7; n++) cells.push({ d: null, n });
  const heads = ws === 1 ? ['月', '火', '水', '木', '金', '土', '日'] : ['日', '月', '火', '水', '木', '金', '土'];
  const t = today();
  const sel = selected.slice(0, 7) === month ? selected : null;
  const dayList = sel ? data.sessions.filter((s) => s.date === sel) : [];
  const ds = summarize(dayList);
  const firstMonth = data.sessions.length ? data.sessions[0].date.slice(0, 7) : undefined;
  const kindOrder = KINDS.map((k) => k.id);

  return (
    <div className="page calendar-page">
      <PageHead title="カレンダー" right={<MonthSelect month={month} setMonth={setMonth} first={firstMonth} />} />

      <div className="cal-nav">
        <button className="sq-btn" aria-label="前の月" onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" size={24} /></button>
        <h2>{monthJa(month)}</h2>
        <button className="sq-btn" aria-label="次の月" onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" size={24} /></button>
      </div>

      <div className="cal" role="grid" aria-label={`${monthJa(month)}のカレンダー`}>
        <div className="cal-heads" role="row">
          {heads.map((h) => <span key={h} role="columnheader" className={h === '日' ? 'sun' : h === '土' ? 'sat' : ''}>{h}</span>)}
        </div>
        <div className="cal-cells">
          {cells.map((c, i) => {
            const col = heads[i % 7];
            const wc = col === '日' ? 'sun' : col === '土' ? 'sat' : '';
            if (!c.d) return <span key={`o${i}`} className="cc out"><span className="cc-n">{c.n}</span></span>;
            const v = days.get(c.d);
            const kinds = v ? kindOrder.filter((k) => v.kinds.has(k)) : [];
            return (
              <button key={c.d} className={`cc ${v ? tone(v.p) : 'none'} ${c.d === sel ? 'sel' : ''} ${c.d === t ? 'today' : ''}`}
                onClick={() => setSelected(c.d!)} aria-pressed={c.d === sel} aria-label={`${dateJa(c.d)}${v ? ` ${signedEn(v.p)}` : ' 記録なし'}`}>
                <span className={`cc-n ${wc}`}>{c.n}</span>
                <span className="cc-a">{v ? amt(v.p) : '–'}</span>
                {kinds.length > 0 && <span className="cc-k">{kinds.slice(0, 2).map((k) => <i key={k}>{kindLetter(k)}</i>)}</span>}
                {v && v.p >= 30000 && <span className="hot-mark" aria-hidden="true">激</span>}
              </button>
            );
          })}
        </div>
      </div>

      {sel && (
        <section className="card day-card" aria-label={`${dateJa(sel)}の合計`}>
          <div className="card-head">
            <h2 className="day-title">{sel.slice(0, 4)}年{dateJa(sel)}</h2>
            <button className="more" onClick={() => onAdd(sel)}>この日に記録する<Icon name="right" size={16} /></button>
          </div>
          <div className="day-tiles">
            <div><span><Icon name="wallet" size={22} className="ic-sub" />投資合計</span><Money n={ds.invest} signed={false} /></div>
            <div><span><Icon name="coins" size={22} className="ic-gold" />回収合計</span><Money n={ds.payout} signed={false} /></div>
            <div><span><Icon name="bars3" size={22} className="ic-gold" />収支</span><Money n={ds.profit} /></div>
          </div>
        </section>
      )}

      {sel && (
        <section className="card day-list" aria-label="この日の記録">
          <div className="card-head"><h2>この日の記録</h2><small className="muted">{dayList.length}件</small></div>
          {dayList.length === 0 ? (
            <div className="dp-empty">
              <p>この日の記録はありません</p>
              <button className="btn-line" onClick={() => onAdd(sel)}><Icon name="plus" size={18} />この日の収支を記録する</button>
            </div>
          ) : (
            <ul>
              {dayList.map((s) => (
                <li key={s.id}>
                  <button onClick={() => onOpen(s)} aria-label={`${kindShort(s.kind)} ${s.place} ${signedEn(profit(s))} の詳細`}>
                    <KindIcon kind={s.kind} size={34} />
                    <span className="dl-main"><b>{kindShort(s.kind)}</b><small>{[s.place, s.minutes ? hours(s.minutes) : ''].filter(Boolean).join('・') || s.target}</small></span>
                    <span className="dl-nums"><span><small>投資</small>{en(s.invest)}</span><span><small>回収</small>{en(s.payout)}</span></span>
                    <b className={`dl-p ${tone(profit(s))}`}>{signedEn(profit(s))}</b>
                    <Icon name="right" size={16} className="chev" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card cal-legend" aria-label="カレンダーの見方">
        <h2>カレンダーの見方</h2>
        <div>
          <span><i className="lg-dot plus" /><b>プラス収支の日</b><small>収支がプラスの日</small></span>
          <span><i className="lg-dot minus" /><b>マイナス収支の日</b><small>収支がマイナスの日</small></span>
          <span><i className="lg-dot none" /><b>記録なしの日</b><small>記録がない日</small></span>
          <span><i className="lg-k">パ</i><b>日ごとの種目</b><small>行った種目の略号</small></span>
        </div>
      </section>
    </div>
  );
}
