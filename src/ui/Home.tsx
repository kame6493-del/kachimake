// ホーム(見本 01): 今月と今年の収支、種目のしぼり込み、月別の推移と種目別、店別の勝ち負け、負けの上限、最近の記録
import { useMemo, useState } from 'react';
import type { AppData, Kind, Session } from '../domain/types';
import { KINDS } from '../domain/types';
import { byKind, groupBy, inRange, limitStatus, profit, streak, summarize, title } from '../domain/stats';
import { monthRange, today } from '../domain/data';
import { lastMonths, newestFirst } from '../domain/views';
import { CompactBars, Donut } from './Charts';
import { BrandHead, Icon, KindChips, KindDot, KIND_COLOR, kindShort, Money, MonthPill } from './parts';
import { en, mdw, pct, signedEn, tone } from './format';

interface Props {
  data: AppData;
  month: string;
  setMonth: (m: string) => void;
  premium: boolean;
  onOpen: (s: Session) => void;
  onShare: () => void;
  onPaywall: (why: string) => void;
  onLimit: () => void;
  onHistory: () => void;
  onAnalysis: () => void;
  onCounter: () => void;
}

export function Home({ data, month, setMonth, premium, onOpen, onShare, onPaywall, onLimit, onHistory, onAnalysis, onCounter }: Props) {
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const all = data.sessions;
  const list = useMemo(() => (kind === 'all' ? all : all.filter((s) => s.kind === kind)), [all, kind]);
  const { from, to } = monthRange(month);
  const year = month.slice(0, 4);
  const monthList = useMemo(() => inRange(list, from, to), [list, from, to]);
  const sum = summarize(monthList);
  const ysum = summarize(inRange(list, `${year}-01-01`, `${year}-12-31`));
  const allMonth = inRange(all, from, to);
  const rank = title(summarize(allMonth).recovery);
  const run = useMemo(() => streak(all), [all]);
  const isThisMonth = month === today().slice(0, 7);
  const usedKinds = KINDS.map((k) => k.id).filter((k) => all.some((s) => s.kind === k));
  const chipKinds: Kind[] = usedKinds.length ? usedKinds : ['pachinko', 'slot', 'keiba', 'keirin', 'boat'];

  const bars = lastMonths(month, 7).map((m) => ({
    label: `${Number(m.slice(5))}月`,
    value: summarize(inRange(list, monthRange(m).from, monthRange(m).to)).profit,
  }));
  const kinds = byKind(allMonth);
  const kindRows = KINDS.filter((k) => kinds.has(k.id)).map((k) => ({ kind: k.id, s: kinds.get(k.id)! }));
  const ranking = useMemo(() => groupBy(monthList, 'place').filter((r) => r.label !== '(未設定)').slice(0, 5), [monthList]);
  const limit = limitStatus(all, month, data.settings.monthlyLimit);
  const recent = newestFirst(list).slice(0, 3);
  const m = Number(month.slice(5));

  return (
    <div className="page home">
      <BrandHead sub="遊びを、記録で味方に。" right={<MonthPill month={month} setMonth={setMonth} />} />

      <div className="sum-pair">
        <section className="card sum-card" aria-label={`${m}月の収支`}>
          <div className="sum-head"><Icon name="wallet" className="ic-blue" />{isThisMonth ? '今月' : `${m}月`}の収支</div>
          <Money n={sum.profit} className="sum-big" />
          <div className="sum-meta"><span>投資 {en(sum.invest)}</span><span>回収 {en(sum.payout)}</span></div>
        </section>
        <section className="card sum-card" aria-label={`${year}年の収支`}>
          <div className="sum-head"><Icon name="bars3" className="ic-blue" />{year === today().slice(0, 4) ? '今年' : `${year}年`}の収支</div>
          <Money n={ysum.profit} className="sum-big" />
          <div className="sum-meta"><span>投資 {en(ysum.invest)}</span><span>回収 {en(ysum.payout)}</span></div>
        </section>
      </div>

      {sum.count > 0 && (
        <div className="month-strip">
          <span>{sum.wins}勝{sum.losses}敗</span>
          <span>回収率 {pct(sum.recovery, 0)}</span>
          {kind === 'all' && rank && <span className={`rank ${summarize(allMonth).profit >= 0 ? 'up' : 'down'}`}>{rank}</span>}
          {kind === 'all' && isThisMonth && run && run.n >= 2 && <span className={`run ${run.kind}`}>{run.n}{run.kind === 'win' ? '連勝中' : '連敗中'}</span>}
          <button className="share-btn" onClick={onShare} aria-label={`${m}月の収支を画像でシェア`}><Icon name="share" size={15} />シェア</button>
        </div>
      )}

      <KindChips kinds={chipKinds} value={kind} onChange={setKind} />

      <div className="chart-pair">
        <section className="card" aria-label="月別収支の推移">
          <div className="card-head">
            <h2><Icon name="bars3" />月別収支の推移</h2>
            <button className="more" onClick={onAnalysis}>詳細<Icon name="right" size={16} /></button>
          </div>
          <CompactBars rows={bars} />
        </section>
        <section className="card kinds-card" aria-label="種目別の収支">
          <div className="card-head"><h2><Icon name="pie" />種目別の収支</h2></div>
          <Donut parts={kindRows.map((r) => ({ color: KIND_COLOR[r.kind], value: r.s.invest }))}>
            <span>合計</span>
            <strong className={tone(summarize(allMonth).profit)}>{signedEn(summarize(allMonth).profit)}</strong>
          </Donut>
          <ul className="legend">
            {kindRows.length === 0 && <li className="muted">まだ記録がありません</li>}
            {kindRows.map((r) => (
              <li key={r.kind}><KindDot kind={r.kind} /><span>{kindShort(r.kind)}</span><b className={tone(r.s.profit)}>{signedEn(r.s.profit)}</b></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card" aria-label="店別・種目別の勝ち負け">
        <div className="card-head">
          <h2><Icon name="store" />店別・種目別の勝ち負け{isThisMonth ? '(今月)' : `(${m}月)`}</h2>
          <button className="more" onClick={onAnalysis}>詳細<Icon name="right" size={16} /></button>
        </div>
        {!premium ? (
          <div className="locked">
            <p>どの店で勝ち、どこで負けているかの順位は、有料プランで表示されます。</p>
            <button className="btn-line" onClick={() => onPaywall('店舗・場ごとの収支')}>有料プランの内容を見る</button>
          </div>
        ) : ranking.length === 0 ? <p className="empty-line">店舗・場を入れた記録がまだありません</p> : (
          <table className="rank-table">
            <thead><tr><th scope="col">順位</th><th scope="col">店名</th><th scope="col">種目</th><th scope="col">収支</th></tr></thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.key}>
                  <td><span className={`rank-no r${i + 1}`}>{i + 1}</span></td>
                  <th scope="row" className="ellipsis">{r.label}</th>
                  <td>{r.kind && <span className="kind-tag" style={{ color: KIND_COLOR[r.kind] }}><i style={{ background: KIND_COLOR[r.kind] }} />{kindShort(r.kind)}</span>}</td>
                  <td className={`num ${tone(r.summary.profit)}`}>{signedEn(r.summary.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-label="負けの上限">
        <div className="card-head">
          <h2><Icon name="target" />{isThisMonth ? '今月' : `${m}月`}の負けの上限</h2>
          <button className="more" onClick={onLimit}>設定<Icon name="right" size={16} /></button>
        </div>
        {limit ? (
          <div className="limit-row">
            <div className="limit-main">
              <div className="limit-nums"><b>{limit.lost.toLocaleString('ja-JP')}<small>円</small></b><span> / {en(limit.limit)}</span></div>
              <div className="bar-line">
                <div className="bar-track"><div className={`bar-fill ${limit.ratio >= 1 ? 'over' : limit.ratio >= 0.7 ? 'warn' : ''}`} style={{ width: `${Math.min(100, limit.ratio * 100)}%` }} /></div>
                <span>{Math.round(limit.ratio * 100)}%</span>
              </div>
            </div>
            <div className={`limit-alert ${limit.ratio >= 1 ? 'over' : ''}`}>
              <span aria-hidden="true">!</span>
              {limit.ratio >= 1 ? <p>上限を<br />超えました</p> : <p>上限まで<br />あと {en(limit.limit - limit.lost)}</p>}
            </div>
          </div>
        ) : (
          <p className="note">月の負けの上限を決めておくと、近づいたときにここでお知らせします。</p>
        )}
      </section>

      <section className="card" aria-label="最近の記録">
        <div className="card-head">
          <h2><Icon name="doc" />最近の記録</h2>
          <button className="more" onClick={onHistory}>すべて見る<Icon name="right" size={16} /></button>
        </div>
        {recent.length === 0 ? <p className="empty-line">右下の「+」から、最初の収支を記録しましょう</p> : (
          <ul className="recent">
            {recent.map((s) => (
              <li key={s.id}>
                <button onClick={() => onOpen(s)} aria-label={`${mdw(s.date)} ${s.place || kindShort(s.kind)} ${signedEn(profit(s))}`}>
                  <span className="r-date">{mdw(s.date)}</span>
                  <span className="r-main"><b>{s.place || kindShort(s.kind)}</b><small>{s.target || kindShort(s.kind)}</small></span>
                  <span className="r-col"><small>投資</small>{en(s.invest)}</span>
                  <span className="r-col"><small>回収</small>{en(s.payout)}</span>
                  <span className={`r-col r-p ${tone(profit(s))}`}><small>収支</small>{signedEn(profit(s))}</span>
                  <Icon name="right" size={18} className="chev" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="card tool-link" onClick={onCounter}>
        <Icon name="counter" className="ic-blue" />
        <span><b>小役カウンター</b><small>ホールで小役を数えて、設定を推測します</small></span>
        <Icon name="right" size={18} className="chev" />
      </button>
    </div>
  );
}
