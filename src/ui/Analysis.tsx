// 分析(見本 kachi2_ref_04): 期間の合計・回収率・1回あたり・最多収支の種目、収支の推移、種目別の比較と投資割合、
// 場所などごとの収支比較(完全版)、曜日別の収支、CSV書き出し(完全版)
import { useMemo, useState } from 'react';
import type { AppData, Kind, Session } from '../domain/types';

import { byKind, groupBy, inRange, summarize, weekdayOf, type GroupKey } from '../domain/stats';
import { addMonths, monthRange, today, toCsv } from '../domain/data';
import { exportText } from '../platform/files';
import { Donut, DotLine, SignedBars } from './Charts';
import { daySeries } from './Home';
import { Icon, KindIcon, KIND_COLOR, kindShort, Money, MonthSelect, PageHead, Ring, Seg } from './parts';
import { hours, pct, signedEn, tone } from './format';

type Period = 'month' | 'last3' | 'year' | 'all';
const PERIODS: [Period, string][] = [['month', '今月'], ['last3', '3か月'], ['year', '今年'], ['all', '全期間']];
type Mode = 'profit' | 'invest' | 'payout';
const MODES: [Mode, string][] = [['profit', '収支'], ['invest', '投資'], ['payout', '回収']];
const GROUPS: [Exclude<GroupKey, 'kind' | 'weekday'>, string][] = [['place', '場所'], ['target', '機種'], ['betType', '券種'], ['tag', 'タグ']];
const WEEK = ['月', '火', '水', '木', '金', '土', '日'];
const MAIN: Kind[] = ['pachinko', 'slot', 'keiba', 'keirin', 'boat', 'auto'];

const val = (s: { profit: number; invest: number; payout: number }, m: Mode) => (m === 'invest' ? s.invest : m === 'payout' ? s.payout : s.profit);

interface Props {
  data: AppData;
  month: string;
  setMonth: (m: string) => void;
  premium: boolean;
  unlockedUntil: string | null;
  onPaywall: (why: string) => void;
}

export function Analysis({ data, month, setMonth, premium, unlockedUntil, onPaywall }: Props) {
  const [period, setPeriod] = useState<Period>('month');
  const [mode, setMode] = useState<Mode>('profit');
  const [kmode, setKmode] = useState<Mode>('profit');
  const [group, setGroup] = useState<(typeof GROUPS)[number][0]>('place');
  const firstMonth = data.sessions.length ? data.sessions[0].date.slice(0, 7) : month;
  const now = today().slice(0, 7);
  // 無料で見られるのは、今月と先月の1か月分(1.1.0 と同じ)
  const freeMonth = month === now || month === addMonths(now, -1);
  const locked = !premium && (period !== 'month' || !freeMonth);

  const { from, to, months } = useMemo(() => {
    if (period === 'month') return { ...monthRange(month), months: [month] };
    const start = period === 'last3' ? addMonths(month, -2) : period === 'year' ? `${month.slice(0, 4)}-01` : (firstMonth < month ? firstMonth : month);
    const ms: string[] = [];
    for (let m = start; m <= month; m = addMonths(m, 1)) ms.push(m);
    return { from: monthRange(start).from, to: monthRange(month).to, months: ms };
  }, [period, month, firstMonth]);
  const list = useMemo(() => inRange(data.sessions, from, to), [data.sessions, from, to]);
  const sum = summarize(list);
  const kinds = byKind(list);
  const kindRows = [...MAIN, ...(kinds.has('other') ? ['other' as Kind] : [])].map((k) => ({ k, s: kinds.get(k) ?? summarize([]) }));
  const best = kindRows.filter((r) => r.s.count > 0).sort((a, b) => b.s.profit - a.s.profit)[0];

  const series = period === 'month'
    ? daySeries(list, month, mode)
    : {
      slots: months.length,
      points: months.map((m, i) => ({ i, s: summarize(list.filter((x) => x.date.startsWith(m))) })).filter((r) => r.s.count > 0).map((r) => ({ i: r.i, v: val(r.s, mode) })),
      ticks: months.map((m, i) => ({ i, label: `${Number(m.slice(5))}月` })).filter((_, i, a) => a.length <= 7 || i % Math.ceil(a.length / 6) === 0 || i === a.length - 1),
    };

  const groups = useMemo(() => groupBy(list, group).slice(0, 5), [list, group]);
  const gMax = Math.max(1, ...groups.map((r) => Math.abs(r.summary.profit)));
  const week = WEEK.map((w, i) => ({ label: w, value: summarize(list.filter((s) => weekdayOf(s.date) === (i + 1) % 7)).profit }));
  const investTotal = kindRows.reduce((a, r) => a + r.s.invest, 0);

  const pick = (p: Period) => {
    if (p !== 'month' && !premium) return onPaywall(`${PERIODS.find((x) => x[0] === p)![1]}の分析`);
    setPeriod(p);
  };
  const csv = async () => {
    if (!premium) return onPaywall('CSVで書き出し');
    await exportText(`kachimake-${today()}.csv`, toCsv(list as Session[]), 'text/csv');
  };

  return (
    <div className="page analysis">
      <PageHead title="分析" right={<MonthSelect month={month} setMonth={setMonth} first={firstMonth} />} />
      <div className="center-seg"><Seg label="期間" value={period} onChange={pick} items={PERIODS.map(([p, l]) => [p, p === 'month' && month !== now ? `${Number(month.slice(5))}月` : l] as [Period, string])} /></div>
      {unlockedUntil && <p className="note unlocked">広告を見たので、{unlockedUntil}まで完全版の分析が使えます</p>}

      {locked ? (
        <div className="card locked-card">
          <p>{freeMonth ? 'この期間の分析' : `${Number(month.slice(5))}月の分析`}は完全版で使えます。無料では今月と先月の分析が見られます。</p>
          <button className="btn-gold" onClick={() => onPaywall(freeMonth ? '長い期間の分析' : '過去の月の分析')}>完全版の内容を見る</button>
        </div>
      ) : (
        <>
          <div className="grid4">
            <section className="card stat sm">
              <div className="stat-head"><span>合計収支</span><Icon name="bars3" className="ic-gold" /></div>
              <Money n={sum.profit} className="stat-big" />
              <dl className="stat-meta"><div><dt>投資</dt><dd>{sum.invest.toLocaleString('ja-JP')}円</dd></div><div><dt>回収</dt><dd>{sum.payout.toLocaleString('ja-JP')}円</dd></div></dl>
            </section>
            <section className="card stat sm">
              <div className="stat-head"><span>回収率</span><Icon name="target" className="ic-gold" /></div>
              <b className="stat-pct">{sum.recovery == null ? '—' : (sum.recovery * 100).toFixed(1)}<small>%</small></b>
              <div className="ring-c"><Ring ratio={sum.recovery} size={52} /></div>
            </section>
            <section className="card stat sm">
              <div className="stat-head"><span>1回あたりの収支</span></div>
              {sum.count ? <Money n={Math.round(sum.profit / sum.count)} className="stat-big" /> : <b className="stat-big">—</b>}
              <p className="stat-wl"><span>総回数 {sum.count}回</span></p>
            </section>
            <section className="card stat sm">
              <div className="stat-head"><span>最多収支の種目</span><Icon name="crown" className="ic-gold" /></div>
              {best ? <><span className="best-kind"><KindIcon kind={best.k} size={26} />{kindShort(best.k)}</span><Money n={best.s.profit} className="stat-big" /></> : <b className="stat-big">—</b>}
            </section>
          </div>

          <section className="card" aria-label="収支の推移">
            <div className="card-head">
              <h2>{period === 'month' ? '月間' : '期間'}収支の推移</h2>
              <Seg label="グラフの中身" value={mode} onChange={setMode} items={MODES} />
            </div>
            <DotLine {...series} />
          </section>

          <div className="pair">
            <section className="card" aria-label="種目別 収支比較">
              <div className="card-head wrap">
                <h2><Icon name="pin" size={20} />種目別<small>収支比較</small></h2>
                <Seg label="比べる中身" value={kmode} onChange={setKmode} items={MODES} />
              </div>
              <SignedBars height={150} color={kmode === 'profit' ? undefined : 'gold'}
                rows={kindRows.map((r) => ({ label: kindShort(r.k), value: val(r.s, kmode), icon: <KindIcon kind={r.k} size={22} /> }))} />
            </section>
            <section className="card" aria-label="投資割合(種目別)">
              <div className="card-head"><h2><Icon name="clock" size={20} />投資割合<small>(種目別)</small></h2></div>
              <div className="donut-row">
                <Donut size={132} stroke={22} parts={kindRows.map((r) => ({ color: KIND_COLOR[r.k], value: r.s.invest }))}>
                  <span>総投資</span><strong>{investTotal.toLocaleString('ja-JP')}<small>円</small></strong>
                </Donut>
                <ul className="legend">
                  {kindRows.filter((r) => r.s.invest > 0).map((r) => (
                    <li key={r.k}><i style={{ background: KIND_COLOR[r.k] }} /><span>{kindShort(r.k)}</span><b>{pct(investTotal ? r.s.invest / investTotal : null)}</b></li>
                  ))}
                  {investTotal === 0 && <li className="muted">記録がありません</li>}
                </ul>
              </div>
            </section>
          </div>

          <section className="card" aria-label="ごとの収支比較">
            <div className="card-head wrap">
              <h2><Icon name="pin" size={20} />{GROUPS.find((g) => g[0] === group)![1]}別<small>収支比較</small></h2>
              <Seg label="まとめ方" value={group} onChange={setGroup} items={GROUPS} />
            </div>
            {!premium ? (
              <div className="paid-note">
                <p>どこで勝ち、どこで負けているかの順位は、完全版で表示されます。</p>
                <button className="btn-line" onClick={() => onPaywall('店舗・機種・券種・タグごとの収支')}>完全版の内容を見る</button>
              </div>
            ) : groups.length === 0 ? <p className="empty-line">この期間の記録はありません</p> : (
              <ol className="rank-list">
                {groups.map((r, i) => (
                  <li key={r.key}>
                    <span className="rk-no">{i + 1}</span>
                    <span className="rk-name">{r.kind && <KindIcon kind={r.kind} size={18} />}{r.label}</span>
                    <span className="rk-bar"><i className={tone(r.summary.profit)} style={{ width: `${(Math.abs(r.summary.profit) / gMax) * 100}%` }} /></span>
                    <b className={tone(r.summary.profit)}>{signedEn(r.summary.profit)}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card" aria-label="曜日別 収支">
            <div className="card-head">
              <h2><Icon name="calendar" size={20} />曜日別<small>収支</small></h2>
              <button className="btn-line sm" onClick={() => void csv()}><Icon name="fileDown" size={18} />CSV書き出し</button>
            </div>
            <SignedBars rows={week} height={150} />
          </section>

          <section className="card" aria-label="そのほかの指標">
            <div className="card-head"><h2>そのほかの指標</h2></div>
            <dl className="metrics">
              <div><dt>勝率</dt><dd>{pct(sum.winRate, 0)}<small>{sum.wins}勝{sum.losses}敗</small></dd></div>
              <div><dt>時給</dt><dd className={sum.hourly == null ? '' : tone(sum.hourly)}>{sum.hourly == null ? '—' : signedEn(Math.round(sum.hourly))}<small>{hours(sum.minutes)}</small></dd></div>
              <div><dt>1回の最高</dt><dd className={tone(sum.best)}>{signedEn(sum.best)}</dd></div>
              <div><dt>1回の最低</dt><dd className={tone(sum.worst)}>{signedEn(sum.worst)}</dd></div>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
