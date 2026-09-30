import { useMemo } from 'react';
import type { AppData, Session } from '../domain/types';
import { kindInfo } from '../domain/types';
import { byDate, inRange, limitStatus, profit, streak, summarize, title } from '../domain/stats';
import { addMonths, monthRange, pad, today } from '../domain/data';
import { dateJa, hours, monthJa, pct, shortYen, signedYen, tone, yen } from './format';

interface Props {
  data: AppData;
  month: string;
  setMonth: (m: string) => void;
  selected: string;
  setSelected: (d: string) => void;
  onEdit: (s: Session) => void;
  onAdd: (date: string) => void;
}

export function Home({ data, month, setMonth, selected, setSelected, onEdit, onAdd }: Props) {
  const { from, to } = monthRange(month);
  const monthList = useMemo(() => inRange(data.sessions, from, to), [data.sessions, from, to]);
  const sum = useMemo(() => summarize(monthList), [monthList]);
  const rank = title(sum.recovery);
  const run = useMemo(() => streak(data.sessions), [data.sessions]);
  const daily = useMemo(() => byDate(monthList), [monthList]);
  const limit = limitStatus(data.sessions, month, data.settings.monthlyLimit);
  const dayList = data.sessions.filter((s) => s.date === selected);
  const daySum = dayList.reduce((a, s) => a + profit(s), 0);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const offset = (first - data.settings.weekStart + 7) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const heads = data.settings.weekStart === 1 ? ['月', '火', '水', '木', '金', '土', '日'] : ['日', '月', '火', '水', '木', '金', '土'];
  const t = today();
  const isThisMonth = month === t.slice(0, 7);

  return (
    <div className="home">
      <header className="ledger-head">
        <div className="month-nav">
          <h1 className="mincho">{monthJa(month)}</h1>
          <button className="nav-btn" aria-label="前の月" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
          <button className="nav-btn" aria-label="次の月" onClick={() => setMonth(addMonths(month, 1))}>›</button>
          {!isThisMonth && <button className="link-btn" onClick={() => { setMonth(t.slice(0, 7)); setSelected(t); }}>今月へ</button>}
          <button className="write-inline" onClick={() => onAdd(selected)}>記入</button>
        </div>

        <div className="closing">
          <div className="closing-label">
            <span>{m}月の収支</span>
            {rank && <span className={`rank ${sum.profit >= 0 ? 'up' : 'down'}`}>{rank}</span>}
            {isThisMonth && run && run.n >= 2 && <span className={`run ${run.kind}`}>{run.n}{run.kind === 'win' ? '連勝中' : '連敗中'}</span>}
          </div>
          <div className={`closing-amount ${tone(sum.profit)}`}>{signedYen(sum.profit)}</div>
          <div className="closing-meta">
            {sum.count === 0 ? <span>まだ記入がありません</span> : (
              <>
                <span>{sum.wins}勝{sum.losses}敗</span>
                <span>回収率 {pct(sum.recovery, 0)}</span>
                {sum.hourly != null && <span>時給 {signedYen(sum.hourly)}</span>}
              </>
            )}
          </div>
        </div>

        {limit && (
          <div className={`limit ${limit.ratio >= 1 ? 'over' : ''}`}>
            <div className="limit-text">
              {limit.ratio >= 1
                ? <>負けが上限 {yen(limit.limit)} を超えました</>
                : <>負けの上限 {yen(limit.limit)}<span className="muted"> あと {yen(Math.max(0, limit.limit - limit.lost))}</span></>}
            </div>
            <div className="limit-track" role="meter" aria-valuemin={0} aria-valuemax={limit.limit} aria-valuenow={limit.lost} aria-label="負けの上限に対する今月の負け">
              <div className="limit-fill" style={{ width: `${Math.min(100, limit.ratio * 100)}%` }} />
            </div>
          </div>
        )}
      </header>

      <div className="home-body">
        <table className="calendar" aria-label={`${monthJa(month)}のカレンダー`}>
          <thead>
            <tr>{heads.map((h) => <th key={h} scope="col" className={h === '日' ? 'sun' : ''}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, w) => (
              <tr key={w}>
                {cells.slice(w * 7, w * 7 + 7).map((d, i) =>
                  d ? (
                    <td key={d} className={`${d === selected ? 'sel' : ''} ${d === t ? 'today' : ''} ${(daily.get(d) ?? 0) >= 30000 ? 'hot' : (daily.get(d) ?? 0) > 0 ? 'won' : ''}`}>
                      <button onClick={() => setSelected(d)} aria-pressed={d === selected}
                        aria-label={`${dateJa(d)}${daily.has(d) ? ` ${signedYen(daily.get(d)!)}` : ''}`}>
                        <span className="cal-day">{Number(d.slice(8))}</span>
                        {(daily.get(d) ?? 0) >= 30000 && <span className="hot-mark" aria-hidden="true">激</span>}
                        <span className={`cal-amt ${daily.has(d) ? tone(daily.get(d)!) : ''}`}>{daily.has(d) ? shortYen(daily.get(d)!) : ''}</span>
                      </button>
                    </td>
                  ) : <td key={`e${w}${i}`} className="blank" />,
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <section className="day" aria-label={`${dateJa(selected)}の記入`}>
          <div className="day-head">
            <h2 className="mincho">{dateJa(selected)}</h2>
            {dayList.length > 0 && <span className={`day-sum ${tone(daySum)}`}>{signedYen(daySum)}</span>}
          </div>
          {dayList.length === 0 ? (
            <div className="day-empty">
              <p>この日の記入はありません</p>
              <button className="link-btn" onClick={() => onAdd(selected)}>この日の収支を記入する</button>
            </div>
          ) : (
            <ul className="rows">
              {dayList.map((s) => {
                const k = kindInfo(s.kind);
                const p = profit(s);
                const sub = [s.target ? s.place : '', s.betType, s.minutes ? hours(s.minutes) : '', `投資 ${yen(s.invest)}`].filter(Boolean).join('・');
                return (
                  <li key={s.id}>
                    <button className="row" onClick={() => onEdit(s)} aria-label={`${k.label} ${s.target || s.place} ${signedYen(p)} を編集`}>
                      <span className="mark" title={k.label}>{k.short}</span>
                      <span className="row-main">
                        <span className="row-title">{s.target || s.place || k.label}</span>
                        <span className="row-sub">{sub}</span>
                      </span>
                      <span className={`amount ${tone(p)}`}>{signedYen(p)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
