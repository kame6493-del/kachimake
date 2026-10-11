// ホーム(見本 kachi2_ref_01): 今月・今年の収支、回収率、記録件数、種目のしぼり込みと日別の推移、種目別、よく行く場所、今月の負け上限
import { useMemo, useState } from 'react';
import type { AppData, Kind } from '../domain/types';
import { groupBy, inRange, limitStatus, streak, summarize, title } from '../domain/stats';
import { monthRange, today } from '../domain/data';
import { DotLine } from './Charts';
import { Icon, KindChips, KindIcon, kindShort, Money, MonthSelect, PageHead, Ring, Seg } from './parts';
import { en, pct, signedEn, tone } from './format';

interface Props {
  data: AppData;
  month: string;
  setMonth: (m: string) => void;
  premium: boolean;
  onShare: () => void;
  onPaywall: (why: string) => void;
  onLimit: () => void;
  onHistory: (kind?: Kind) => void;
  onAnalysis: () => void;
  onCounter: () => void;
  onCalendar: () => void;
}

type Mode = 'profit' | 'total' | 'invest' | 'payout';
const MAIN_KINDS: Kind[] = ['pachinko', 'slot', 'keiba', 'keirin', 'boat', 'auto'];
/** 見本の「負け上限に近づいています」を出す割合 */
export const LIMIT_WARN = 0.8;

/** 月の日ごとの点(記録のある日だけ)。累計は月初からの合計 */
export function daySeries(list: AppData['sessions'], month: string, mode: Mode) {
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const byDay = new Map<number, { invest: number; payout: number }>();
  for (const s of list) {
    if (s.date.slice(0, 7) !== month) continue;
    const d = Number(s.date.slice(8));
    const c = byDay.get(d) ?? { invest: 0, payout: 0 };
    c.invest += s.invest;
    c.payout += s.payout;
    byDay.set(d, c);
  }
  let acc = 0;
  const points = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([d, c]) => {
    acc += c.payout - c.invest;
    const v = mode === 'total' ? acc : mode === 'invest' ? c.invest : mode === 'payout' ? c.payout : c.payout - c.invest;
    return { i: d - 1, v };
  });
  const m = Number(month.slice(5, 7));
  const ticks = [1, 5, 10, 15, 20, 25, days].map((d) => ({ i: d - 1, label: `${m}/${d}` }));
  return { slots: days, points, ticks };
}

export function Home({ data, month, setMonth, premium, onShare, onPaywall, onLimit, onHistory, onAnalysis, onCounter, onCalendar }: Props) {
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [mode, setMode] = useState<Mode>('profit');
  const all = data.sessions;
  const { from, to } = monthRange(month);
  const year = month.slice(0, 4);
  const monthAll = useMemo(() => inRange(all, from, to), [all, from, to]);
  const sum = summarize(monthAll);
  const ysum = summarize(inRange(all, `${year}-01-01`, `${year}-12-31`));
  const draws = sum.count - sum.wins - sum.losses;
  const isThisMonth = month === today().slice(0, 7);
  const m = Number(month.slice(5));
  const mLabel = isThisMonth ? '今月' : `${m}月`;
  const run = useMemo(() => streak(all), [all]);
  const rank = title(sum.recovery);
  const extra = all.some((s) => s.kind === 'other') ? (['other'] as Kind[]) : [];
  const chartList = kind === 'all' ? monthAll : monthAll.filter((s) => s.kind === kind);
  const series = daySeries(chartList, month, mode);

  // 種目別: 見本どおり6種目をいつも並べる。棒は一番大きい額に対する割合
  const kinds = [...MAIN_KINDS, ...extra].map((k) => ({ k, s: summarize(monthAll.filter((x) => x.kind === k)) }));
  const maxAbs = Math.max(1, ...kinds.map((r) => Math.abs(r.s.profit)));
  // よく行く場所: 回数の多い順に4つ
  const places = useMemo(() => groupBy(monthAll, 'place').filter((r) => r.label !== '(未設定)')
    .sort((a, b) => b.summary.count - a.summary.count).slice(0, 4), [monthAll]);
  const limit = limitStatus(all, month, data.settings.monthlyLimit);
  const first = all.length ? all[0].date.slice(0, 7) : undefined;

  return (
    <div className="page home">
      <PageHead title="カチマケ" brand right={<MonthSelect month={month} setMonth={setMonth} first={first} onCalendar={onCalendar} />} />

      <div className="grid2">
        <section className="card stat" aria-label={`${mLabel}の収支`}>
          <div className="stat-head"><span>{mLabel}の収支</span><Icon name="wallet" className="ic-gold" /></div>
          <Money n={sum.profit} className="stat-big" />
          <dl className="stat-meta"><div><dt>投資</dt><dd>{en(sum.invest)}</dd></div><div><dt>回収</dt><dd>{en(sum.payout)}</dd></div></dl>
        </section>
        <section className="card stat" aria-label={`${year}年の収支`}>
          <div className="stat-head"><span>{year === today().slice(0, 4) ? '今年' : `${year}年`}の収支</span><Icon name="bars3" className="ic-gold" /></div>
          <Money n={ysum.profit} className="stat-big" />
          <dl className="stat-meta"><div><dt>投資</dt><dd>{en(ysum.invest)}</dd></div><div><dt>回収</dt><dd>{en(ysum.payout)}</dd></div></dl>
        </section>
        <section className="card stat" aria-label={`${mLabel}の回収率`}>
          <div className="stat-head"><span>{mLabel}の回収率</span><Icon name="target" className="ic-gold" /></div>
          <div className="stat-ring">
            <b className="stat-pct">{sum.recovery == null ? '—' : (sum.recovery * 100).toFixed(1)}<small>%</small></b>
            <Ring ratio={sum.recovery} size={62} />
          </div>
        </section>
        <section className="card stat" aria-label="記録件数">
          <div className="stat-head"><span>記録件数</span><Icon name="doc" className="ic-gold" /></div>
          <b className="stat-count">{sum.count}<small>件</small></b>
          <p className="stat-wl"><span>勝ち {sum.wins}件</span><span>負け {sum.losses}件</span><span>引分 {draws}件</span></p>
        </section>
      </div>

      <KindChips kinds={[...MAIN_KINDS, ...extra]} value={kind} onChange={setKind} />

      <section className="card" aria-label="日別収支の推移">
        <div className="card-head">
          <h2>日別収支の推移</h2>
          <Seg label="グラフの中身" value={mode} onChange={setMode} items={[['profit', '収支'], ['total', '累計'], ['invest', '投資'], ['payout', '回収']]} />
        </div>
        <DotLine {...series} />
      </section>

      <section className="card" aria-label="種目別">
        <div className="card-head">
          <h2>種目別</h2>
          <button className="more" onClick={onAnalysis}>詳細を見る<Icon name="right" size={16} /></button>
        </div>
        <div className="kind-grid">
          {kinds.map(({ k, s }) => (
            <button key={k} className="kind-row" onClick={() => onHistory(k)} aria-label={`${kindShort(k)} ${signedEn(s.profit)} の記録を見る`}>
              <KindIcon kind={k} size={30} />
              <span className="kr-body">
                <span className="kr-top"><b>{kindShort(k)}</b><em className={tone(s.profit)}>{signedEn(s.profit)}</em></span>
                <span className="kr-bar"><i className={tone(s.profit)} style={{ width: `${(Math.abs(s.profit) / maxAbs) * 100}%` }} /></span>
              </span>
              <Icon name="right" size={16} className="chev" />
            </button>
          ))}
        </div>
      </section>

      <div className="home-pair">
        <section className="card places" aria-label="よく行く場所">
          <div className="card-head">
            <h2>よく行く場所</h2>
            <button className="more" onClick={onAnalysis}>詳細を見る<Icon name="right" size={16} /></button>
          </div>
          {places.length === 0 ? <p className="empty-line">店・場を入れた記録がまだありません</p> : (
            <ul>
              {places.map((r) => (
                <li key={r.key}>
                  {r.kind ? <KindIcon kind={r.kind} size={22} /> : <Icon name="building" size={22} />}
                  <span className="pl-name">{r.label}</span>
                  {premium
                    ? <em className={tone(r.summary.profit)}>{signedEn(r.summary.profit)}</em>
                    : <button className="pl-lock" onClick={() => onPaywall('店舗・場ごとの収支')}>完全版</button>}
                  <small>{r.summary.count}件</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card limit-card" aria-label={`${mLabel}の負け上限`}>
          <div className="card-head">
            <h2>{mLabel}の負け上限</h2>
            <button className="icon-btn" onClick={onLimit} aria-label="負け上限の設定"><Icon name="gear" size={22} className="ic-gold" /></button>
          </div>
          {limit ? (
            <>
              <Money n={limit.limit} signed={false} className="lc-amount" />
              <div className="lc-bar"><i className={limit.ratio >= LIMIT_WARN ? 'warn' : ''} style={{ width: `${Math.min(100, limit.ratio * 100)}%` }} /></div>
              <div className="lc-nums"><span>現在 <b>{en(limit.lost)}</b></span><span>{limit.ratio >= 1 ? `超過 ${en(limit.lost - limit.limit)}` : `残り ${en(limit.limit - limit.lost)}`}</span></div>
              {limit.ratio >= LIMIT_WARN && (
                <button className="lc-alert" onClick={onLimit}>
                  <span className="alert-dot" aria-hidden="true">!</span>
                  <span><b>{limit.ratio >= 1 ? '負け上限を超えました' : '負け上限に近づいています'}</b><small>無理のない範囲で楽しみましょう</small></span>
                  <Icon name="right" size={16} />
                </button>
              )}
            </>
          ) : (
            <div className="lc-off">
              <p>月の負けの上限を決めておくと、近づいたときにここでお知らせします。</p>
              <button className="btn-line" onClick={onLimit}>上限を決める</button>
            </div>
          )}
        </section>
      </div>

      <div className="home-foot">
        {sum.count > 0 && (
          <p className="hf-meta">
            <span>{sum.wins}勝{sum.losses}敗・回収率 {pct(sum.recovery, 0)}</span>
            {rank && <span className="rank">{rank}</span>}
            {isThisMonth && run && run.n >= 2 && <span className={`run ${run.kind}`}>{run.n}{run.kind === 'win' ? '連勝中' : '連敗中'}</span>}
          </p>
        )}
        <div className="hf-btns">
          <button className="btn-line" onClick={onCounter}><img src="./img/counter_123.png" alt="" width={26} height={26} />小役カウンター</button>
          {sum.count > 0 && <button className="btn-line" onClick={onShare}><Icon name="share" size={18} />{mLabel}をシェア</button>}
        </div>
      </div>
    </div>
  );
}
