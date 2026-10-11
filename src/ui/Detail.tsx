// 記録詳細(見本 06): 1回の記録の中身、同じ店の直近30日、前後の記録、編集・複製・削除
import { useState } from 'react';
import type { AppData, Session } from '../domain/types';
import { kindInfo } from '../domain/types';
import { ballsToYen, profit, summarize } from '../domain/stats';
import { addDays } from '../domain/data';
import { neighbors, placeRecent } from '../domain/views';
import { BackHead, Icon, KindIcon, KindDot, kindShort, Money } from './parts';
import { CompactBars } from './Charts';
import { en, hours, pct, signedEn, tone, ymdJa } from './format';

interface Props {
  data: AppData;
  session: Session;
  premium: boolean;
  onBack: () => void;
  onGo: (s: Session) => void;
  onEdit: (s: Session) => void;
  onCopy: (s: Session) => void;
  onDelete: (id: string) => void;
  onPaywall: (why: string) => void;
}

export function Detail({ data, session: s, premium, onBack, onGo, onEdit, onCopy, onDelete, onPaywall }: Props) {
  const [confirm, setConfirm] = useState(false);
  const p = profit(s);
  const race = ['keiba', 'keirin', 'boat', 'auto'].includes(s.kind);
  const hall = s.kind === 'pachinko' || s.kind === 'slot';
  const unit = s.kind === 'slot' ? '枚' : '玉';
  const nb = neighbors(data.sessions, s.id);
  const recent = placeRecent(data.sessions, s);
  const rs = summarize(recent);
  // 直近30日を日ごとの棒に(記録のある日だけ)
  const byDay = new Map<string, number>();
  for (const x of recent) byDay.set(x.date, (byDay.get(x.date) ?? 0) + profit(x));
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const from = addDays(s.date, -29);
  const rows: [string, string, React.ReactNode, boolean?][] = [
    ['bars3', '種目', <><KindDot kind={s.kind} />{kindInfo(s.kind).label}</>],
    ['calendar', '日付', ymdJa(s.date)],
    ['store', race ? '場' : '場所', s.place || '—'],
    ['game', race ? 'レース' : '機種', s.target || '—'],
    ...(race && s.betType ? [['tag', '券種', s.betType] as [string, string, React.ReactNode]] : []),
    ...(hall && s.rate ? [['yen', 'レート', `1${unit} ${s.rate}円`] as [string, string, React.ReactNode]] : []),
    ['coins', race ? '購入額' : '使った額', en(s.invest)],
    ...(s.replay ? [['coins', `再プレイ`, `${s.replay.toLocaleString('ja-JP')}${unit}(${en(ballsToYen(s.replay, s.rate ?? 0))})`] as [string, string, React.ReactNode]] : []),
    ['undo', race ? '払戻' : '戻った額', en(s.payout)],
    ...(s.saved ? [['coins', s.kind === 'slot' ? '貯メダル' : '貯玉', `${s.saved.toLocaleString('ja-JP')}${unit}(${en(ballsToYen(s.saved, s.rate ?? 0))})`] as [string, string, React.ReactNode]] : []),
    ['clock', race ? '観戦時間' : '遊技時間', s.minutes ? hours(s.minutes) : '—'],
    ['memo', 'メモ', s.memo ? <span className="pre">{s.memo}</span> : '—'],
  ];

  return (
    <div className="page detail">
      <BackHead title="記録詳細" onBack={onBack} center />

      <section className="card dt-top">
        <div className="dt-left">
          <div className="dt-kind">
            <KindIcon kind={s.kind} size={48} />
            <div><b>{kindInfo(s.kind).label}</b><small>{ymdJa(s.date)}</small></div>
          </div>
          <h2>{s.place || s.target || kindShort(s.kind)}</h2>
          {s.place && s.target && <p className="dt-sub"><Icon name="game" size={16} />{s.target}</p>}
        </div>
        <div className="dt-right">
          <small>収支</small>
          <Money n={p} className="dt-big" />
          <dl><div><dt>{race ? '購入額' : '使った額'}</dt><dd>{en(s.invest)}</dd></div><div><dt>{race ? '払戻' : '戻った額'}</dt><dd>{en(s.payout)}</dd></div></dl>
        </div>
      </section>

      <section className="card dt-rows">
        {rows.map(([ic, label, val]) => (
          <div className="dt-row" key={label}>
            <Icon name={ic} />
            <span className="dt-label">{label}</span>
            <span className="dt-val">{val}</span>
          </div>
        ))}
        <div className="dt-row">
          <Icon name="tag" />
          <span className="dt-label">タグ</span>
          <span className="dt-val tag-row">{s.tags?.length ? s.tags.map((t, i) => <span key={t} className={`tag big c${i % 3}`}>{t}</span>) : '—'}</span>
        </div>
      </section>

      {s.place && (
        <section className="card dt-past" aria-label={`${s.place}の過去実績`}>
          <div className="card-head"><h2><Icon name="store" /><span className="ellipsis">{s.place}の過去実績</span></h2></div>
          {premium ? (
            <div className="past-body">
              <div className="past-left">
                <small>直近30日の収支</small>
                <Money n={rs.profit} className="past-big" />
                <div className="past-stats">
                  <div><small>勝率</small><b>{rs.winRate == null ? '—' : pct(rs.winRate, 0)}</b></div>
                  <div><small>平均収支</small><b className={tone(rs.profit)}>{rs.count ? signedEn(Math.round(rs.profit / rs.count)) : '—'}</b></div>
                  <div><small>記録数</small><b>{rs.count}回</b></div>
                </div>
              </div>
              <div className="past-chart">
                <CompactBars height={150} rows={days.map(([d, v]) => ({ label: d === days[0][0] || d === days[days.length - 1][0] ? `${Number(d.slice(5, 7))}/${Number(d.slice(8))}` : '', value: v }))} />
                <small className="note">{`${Number(from.slice(5, 7))}/${Number(from.slice(8))}〜${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8))}`}</small>
              </div>
            </div>
          ) : (
            <div className="locked">
              <p>この店での直近30日の収支・勝率は、有料プランで表示されます。</p>
              <button className="btn-line" onClick={() => onPaywall('店舗・場ごとの収支')}>有料プランの内容を見る</button>
            </div>
          )}
        </section>
      )}

      <div className="dt-nav">
        <button className="ghost-btn" disabled={!nb.older} onClick={() => nb.older && onGo(nb.older)}><Icon name="left" size={18} />前の記録</button>
        <button className="ghost-btn" disabled={!nb.newer} onClick={() => nb.newer && onGo(nb.newer)}>次の記録<Icon name="right" size={18} /></button>
      </div>
      {confirm ? (
        <div className="card danger-box">
          <p>この記録を消しますか?元に戻せません。</p>
          <div className="dt-actions">
            <button className="ghost-btn" onClick={() => setConfirm(false)}>やめる</button>
            <button className="ghost-btn red" onClick={() => onDelete(s.id)}><Icon name="trash" size={18} />消す</button>
          </div>
        </div>
      ) : (
        <div className="dt-actions">
          <button className="ghost-btn" onClick={() => onEdit(s)}><Icon name="pencil" size={18} />編集</button>
          <button className="ghost-btn" onClick={() => onCopy(s)}><Icon name="copy" size={18} />複製</button>
          <button className="ghost-btn red" onClick={() => setConfirm(true)}><Icon name="trash" size={18} />削除</button>
        </div>
      )}
    </div>
  );
}
