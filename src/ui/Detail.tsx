// 記録の詳細(見本 kachi2_ref_03 の下の板): 1回の記録の中身、編集・複製・削除、同じ店の直近30日
import { useState } from 'react';
import type { AppData, Session } from '../domain/types';
import { ballsToYen, profit, summarize } from '../domain/stats';
import { placeRecent } from '../domain/views';
import { Icon, KindIcon, kindShort } from './parts';
import { en, hours, pct, signedEn, tone, ymdJa } from './format';

interface Props {
  data: AppData;
  session: Session;
  premium: boolean;
  onClose: () => void;
  onEdit: (s: Session) => void;
  onCopy: (s: Session) => void;
  onDelete: (id: string) => void;
  onPaywall: (why: string) => void;
}

export function Detail({ data, session: s, premium, onClose, onEdit, onCopy, onDelete, onPaywall }: Props) {
  const [confirm, setConfirm] = useState(false);
  const p = profit(s);
  const race = ['keiba', 'keirin', 'boat', 'auto'].includes(s.kind);
  const hall = s.kind === 'pachinko' || s.kind === 'slot';
  const unit = s.kind === 'slot' ? '枚' : '玉';
  const recent = placeRecent(data.sessions, s);
  const rs = summarize(recent);
  type R = [string, string, React.ReactNode, string?];
  const rows: R[] = [
    ['layers', 'カテゴリ', <><KindIcon kind={s.kind} size={22} />{kindShort(s.kind)}</>],
    ['building', race ? '場' : '場所', s.place || '—'],
    ['game', race ? 'レース' : '機種', s.target || '—'],
    ...(race && s.betType ? [['tag', '券種', s.betType] as R] : []),
    ...(hall && s.rate ? [['yen', 'レート', `1${unit} ${s.rate}円`] as R] : []),
    ['coins', race ? '購入額' : '投資金額', en(s.invest)],
    ...(s.replay ? [['coins', '再プレイ', `${s.replay.toLocaleString('ja-JP')}${unit}(${en(ballsToYen(s.replay, s.rate ?? 0))})`] as R] : []),
    ['wallet', race ? '払戻' : '回収金額', en(s.payout)],
    ...(s.saved ? [['coins', s.kind === 'slot' ? '貯メダル' : '貯玉', `${s.saved.toLocaleString('ja-JP')}${unit}(${en(ballsToYen(s.saved, s.rate ?? 0))})`] as R] : []),
    ['bars3', '収支', signedEn(p), tone(p)],
    ...(s.minutes ? [['clock', race ? '観戦時間' : '遊技時間', hours(s.minutes)] as R] : []),
    ...(s.tags?.length ? [['tag', 'タグ', <span className="tag-row">{s.tags.map((t) => <span key={t} className="tag">{t}</span>)}</span>] as R] : []),
  ];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet detail-sheet" role="dialog" aria-modal="true" aria-label="記録の詳細" onClick={(e) => e.stopPropagation()}>
        <div className="grip" aria-hidden="true" />
        <div className="ds-head">
          <h2>記録の詳細</h2>
          <button className="close-btn" onClick={onClose} aria-label="閉じる"><Icon name="close" size={22} /></button>
        </div>
        <div className="sheet-body ds-body">
          <div className="ds-grid">
            <dl className="ds-rows">
              {rows.map(([ic, label, val, cls]) => (
                <div key={label}>
                  <dt><Icon name={ic} size={20} />{label}</dt>
                  <dd className={cls}>{val}</dd>
                </div>
              ))}
              <div className="ds-memo">
                <dt><Icon name="memo" size={20} />メモ</dt>
                <dd><p className="pre">{s.memo || '—'}</p></dd>
              </div>
            </dl>
            <div className="ds-side">
              <KindIcon kind={s.kind} size={52} />
              <p className="ds-date">{ymdJa(s.date)}</p>
              <b>{s.place || kindShort(s.kind)}</b>
              {s.target && <small>{s.target}</small>}
              <button className="btn-gold" onClick={() => onEdit(s)}><Icon name="pencil" size={20} />編集</button>
              <button className="btn-line" onClick={() => onCopy(s)}><Icon name="copy" size={20} />複製</button>
            </div>
          </div>

          {s.place && (
            premium ? (
              <p className="ds-past">
                <span>{s.place}の直近30日</span>
                <b className={tone(rs.profit)}>{signedEn(rs.profit)}</b>
                <span>勝率 {rs.winRate == null ? '—' : pct(rs.winRate, 0)}・{rs.count}回</span>
              </p>
            ) : (
              <button className="ds-past locked" onClick={() => onPaywall('店舗・場ごとの収支')}>
                <span>{s.place}の直近30日の収支は完全版で表示されます</span><Icon name="right" size={16} />
              </button>
            )
          )}

          {confirm ? (
            <div className="danger-row">
              <span>この記録を消しますか?元に戻せません。</span>
              <button className="danger" onClick={() => onDelete(s.id)}>消す</button>
              <button className="link-btn" onClick={() => setConfirm(false)}>やめる</button>
            </div>
          ) : (
            <button className="link-btn danger-text center-block" onClick={() => setConfirm(true)}><Icon name="trash" size={18} />この記録を消す</button>
          )}
        </div>
      </div>
    </div>
  );
}
