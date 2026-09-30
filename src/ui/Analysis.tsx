import { useMemo, useState } from 'react';
import type { AppData } from '../domain/types';
import { KINDS, kindInfo } from '../domain/types';
import { byKind, cumulative, groupBy, inRange, monthly, summarize, type GroupKey } from '../domain/stats';
import { addMonths, monthRange, today } from '../domain/data';
import { CumulativeChart, MonthlyBars } from './Charts';
import { hours, pct, signedYen, tone, yen } from './format';

type Period = 'thisMonth' | 'lastMonth' | 'last3' | 'thisYear' | 'all';
const PERIODS: { id: Period; label: string; free: boolean }[] = [
  { id: 'thisMonth', label: '今月', free: true },
  { id: 'lastMonth', label: '先月', free: true },
  { id: 'last3', label: '3か月', free: false },
  { id: 'thisYear', label: '今年', free: false },
  { id: 'all', label: '全期間', free: false },
];
const GROUPS: { id: GroupKey; label: string; head: string }[] = [
  { id: 'place', label: '店舗・場', head: '店舗・場' },
  { id: 'target', label: '機種・レース', head: '機種・レース' },
  { id: 'weekday', label: '曜日', head: '曜日' },
  { id: 'betType', label: '券種', head: '券種' },
  { id: 'tag', label: '印', head: '印' },
];

function range(p: Period): { from: string; to: string } {
  const t = today();
  const m = t.slice(0, 7);
  if (p === 'thisMonth') return monthRange(m);
  if (p === 'lastMonth') return monthRange(addMonths(m, -1));
  if (p === 'last3') return { from: monthRange(addMonths(m, -2)).from, to: monthRange(m).to };
  if (p === 'thisYear') return { from: `${t.slice(0, 4)}-01-01`, to: `${t.slice(0, 4)}-12-31` };
  return { from: '0000-01-01', to: '9999-12-31' };
}

export function Analysis({ data, premium, unlockedUntil, onPaywall }: {
  data: AppData; premium: boolean; unlockedUntil: string | null; onPaywall: (why: string) => void;
}) {
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [group, setGroup] = useState<GroupKey>('place');
  const { from, to } = range(period);
  const list = useMemo(() => inRange(data.sessions, from, to), [data.sessions, from, to]);
  const sum = summarize(list);
  const cum = useMemo(() => cumulative(list), [list]);
  const kinds = byKind(list);
  const groups = useMemo(() => groupBy(list, group), [list, group]);
  const months = useMemo(() => monthly(list).map((r) => ({ month: r.month, profit: r.summary.profit })), [list]);
  const label = PERIODS.find((p) => p.id === period)!.label;
  const g = GROUPS.find((x) => x.id === group)!;

  const pick = (p: (typeof PERIODS)[number]) => {
    if (!p.free && !premium) return onPaywall(`${p.label}の分析`);
    setPeriod(p.id);
  };

  return (
    <div className="analysis">
      <h1 className="mincho page-title">分析</h1>
      {unlockedUntil && <p className="note unlocked">広告を見たので、{unlockedUntil}まで有料の分析が使えます</p>}

      <div className="tabs" role="tablist" aria-label="期間">
        {PERIODS.map((p) => (
          <button key={p.id} role="tab" aria-selected={period === p.id} className={period === p.id ? 'on' : ''} onClick={() => pick(p)}>
            {p.label}{!p.free && !premium && <small className="paid">有料</small>}
          </button>
        ))}
      </div>

      <div className="closing">
        <div className="closing-label">{label}の収支</div>
        <div className={`closing-amount ${tone(sum.profit)}`}>{signedYen(sum.profit)}</div>
        <div className="closing-meta">{sum.count === 0 ? <span>この期間の記入はありません</span> : <span>{sum.count}回の記入</span>}</div>
      </div>

      <div className="analysis-grid">
        <section className="block chart-block" aria-label="累計の推移">
          <h2 className="mincho sec">累計の推移</h2>
          <CumulativeChart points={cum} />
        </section>

        <section className="block" aria-label="指標">
          <h2 className="mincho sec">指標</h2>
          <dl className="metrics">
            <div><dt>回収率</dt><dd>{pct(sum.recovery)}</dd></div>
            <div><dt>勝率</dt><dd>{pct(sum.winRate, 0)}<small>{sum.wins}勝{sum.losses}敗</small></dd></div>
            <div><dt>時給</dt><dd className={sum.hourly == null ? '' : tone(sum.hourly)}>{sum.hourly == null ? '—' : signedYen(sum.hourly)}<small>{hours(sum.minutes)}</small></dd></div>
            <div><dt>投資</dt><dd>{yen(sum.invest)}</dd></div>
            <div><dt>回収</dt><dd>{yen(sum.payout)}</dd></div>
            <div><dt>1回の最高</dt><dd className={tone(sum.best)}>{signedYen(sum.best)}</dd></div>
            <div><dt>1回の最低</dt><dd className={tone(sum.worst)}>{signedYen(sum.worst)}</dd></div>
          </dl>
        </section>

        <section className="block" aria-label="種類別">
          <h2 className="mincho sec">種類別</h2>
          {kinds.size === 0 ? <p className="empty-line">この期間の記入はありません</p> : (
            <table className="ledger">
              <thead><tr><th scope="col">種類</th><th scope="col">回数</th><th scope="col">回収率</th><th scope="col">収支</th></tr></thead>
              <tbody>
                {KINDS.filter((k) => kinds.has(k.id)).map((k) => {
                  const s = kinds.get(k.id)!;
                  return (
                    <tr key={k.id}>
                      <th scope="row"><span className="mark" aria-hidden="true">{k.short}</span>{k.label}</th>
                      <td>{s.count}</td><td>{pct(s.recovery, 0)}</td>
                      <td className={`amount ${tone(s.profit)}`}>{signedYen(s.profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="block" aria-label="どこで勝ち、どこで負けているか">
          <div className="sec-row">
            <h2 className="mincho sec">どこで勝ち、どこで負けているか</h2>
          </div>
          <div className="tabs small" role="tablist" aria-label="まとめ方">
            {GROUPS.map((x) => (
              <button key={x.id} role="tab" aria-selected={group === x.id} className={group === x.id ? 'on' : ''} onClick={() => setGroup(x.id)}>{x.label}</button>
            ))}
          </div>
          {premium ? (
            groups.length === 0 ? <p className="empty-line">この期間の記入はありません</p> : (
              <table className="ledger">
                <thead><tr><th scope="col">{g.head}</th><th scope="col">回数</th><th scope="col">回収率</th><th scope="col">収支</th></tr></thead>
                <tbody>
                  {groups.map((r) => (
                    <tr key={r.key}>
                      <th scope="row" className="ellipsis">
                        {r.kind && <span className="mark" title={kindInfo(r.kind).label}>{kindInfo(r.kind).short}</span>}{r.label}
                      </th><td>{r.summary.count}</td><td>{pct(r.summary.recovery, 0)}</td>
                      <td className={`amount ${tone(r.summary.profit)}`}>{signedYen(r.summary.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div className="paid-note">
              <p>{g.label}ごとの収支は、有料プランで表示されます。</p>
              <button className="btn-line" onClick={() => onPaywall(`${g.label}ごとの収支`)}>有料プランの内容を見る</button>
            </div>
          )}
        </section>

        {period !== 'thisMonth' && period !== 'lastMonth' && (
          <section className="block chart-block" aria-label="月ごとの収支">
            <h2 className="mincho sec">月ごとの収支</h2>
            <MonthlyBars rows={months} />
          </section>
        )}
      </div>
    </div>
  );
}
