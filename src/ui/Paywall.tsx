import { useState } from 'react';
import type { BillingState, Plan } from '../platform/billing';

/** 3回目の記入の後に1回だけ出す案内。why にこの値が来たら見出しを変える */
export const INTRO = '__intro';

interface Props {
  why: string;
  billing: BillingState;
  onBuy: (p: Plan) => Promise<void>;
  onRestore: () => Promise<void>;
  onClose: () => void;
  /** リワード広告で24時間使う。広告が出せないとき・有料のときは null */
  reward: { left: number; busy: boolean; onWatch: () => void } | null;
}

/** 無料と有料の比べ表。true=使える / 文字=条件付き */
const TABLE: [string, boolean | string, boolean | string][] = [
  ['記入・カレンダー', true, true],
  ['今月・先月の分析', true, true],
  ['負けの上限・シェア画像', true, true],
  ['3か月・今年・全期間の分析', false, true],
  ['店舗・機種・曜日・券種・印ごとの収支', false, true],
  ['小役カウンター', '1台まで', '制限なし'],
  ['設定の推測', false, true],
  ['CSVの書き出し', false, true],
  ['広告', 'あり', 'なし'],
];

const cell = (v: boolean | string) => (v === true ? <span className="yes" aria-label="使える">○</span> : v === false ? <span className="no" aria-label="使えない">—</span> : v);

/** 年額が月額12か月よりどれだけ安いか(整数の%) */
export function saving(plans: Plan[]): number | null {
  const a = plans.find((p) => p.period === 'annual')?.amount;
  const m = plans.find((p) => p.period === 'monthly')?.amount;
  if (!a || !m) return null;
  const r = Math.floor((1 - a / (m * 12)) * 100);
  return r > 0 ? r : null;
}

export function Paywall({ why, billing, onBuy, onRestore, onClose, reward }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const plans = billing.status === 'ready'
    ? [...billing.plans].sort((a, b) => Number(b.period === 'annual') - Number(a.period === 'annual'))
    : [];
  const [sel, setSel] = useState<string>('');
  const chosen = plans.find((p) => p.id === sel) ?? plans[0];
  const off = saving(plans);
  const trial = plans.find((p) => p.trial)?.trial;
  const intro = why === INTRO;

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : '購入できませんでした'); } finally { setBusy(false); }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet paywall" role="dialog" aria-modal="true" aria-label="有料プラン" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="link-btn" onClick={onClose}>{intro ? 'あとで' : '閉じる'}</button>
          <h2 className="mincho">有料プラン</h2>
          <span />
        </div>
        <div className="sheet-body">
          <div className="pw-hero">
            {trial && <span className="pw-trial-badge">{trial}</span>}
            <p className="pw-title">{intro ? '記入おつかれさまです' : `「${why}」は有料プランで使えます`}</p>
            <p className="pw-sub">
              {intro
                ? 'どの店・どの台・どの買い方で負けているか。3回記入した今から、全部の分析を試せます。'
                : 'どこで勝ち、どこで負けているかが、表とグラフで分かります。'}
            </p>
          </div>

          <table className="pw-table">
            <thead><tr><th scope="col" /><th scope="col">無料</th><th scope="col" className="pro">有料</th></tr></thead>
            <tbody>
              {TABLE.map(([name, free, pro]) => (
                <tr key={name}><th scope="row">{name}</th><td>{cell(free)}</td><td className="pro">{cell(pro)}</td></tr>
              ))}
            </tbody>
          </table>

          {billing.status === 'unavailable' ? (
            <p className="state-line">{billing.reason}</p>
          ) : plans.length === 0 ? (
            <p className="state-line">いま購入できるプランがありません。時間をおいて開き直してください</p>
          ) : (
            <>
              <div className="plans" role="radiogroup" aria-label="プラン">
                {plans.map((p) => (
                  <button key={p.id} role="radio" aria-checked={chosen?.id === p.id} className={`plan ${chosen?.id === p.id ? 'on' : ''}`} onClick={() => setSel(p.id)}>
                    {p.period === 'annual' && off && <span className="plan-off">{off}%おトク</span>}
                    <span className="plan-name">{p.period === 'annual' ? '年額' : p.period === 'monthly' ? '月額' : p.title}</span>
                    {p.perMonth
                      ? <><span className="plan-price">月{p.perMonth}</span><span className="plan-note">1年 {p.price} をまとめて</span></>
                      : <span className="plan-price">{p.price}{p.period === 'monthly' ? ' / 月' : ''}</span>}
                    {p.trial && <span className="plan-trial">最初の{p.trial}</span>}
                  </button>
                ))}
              </div>
              <button className="btn wide" disabled={busy || !chosen} onClick={() => chosen && run(() => onBuy(chosen))}>
                {busy ? '処理中' : chosen?.trial ? `${chosen.trial}で試す` : `${chosen?.price ?? ''}で購入する`}
              </button>
              {chosen?.trial && <p className="note center">無料期間中に解約すれば、料金はかかりません</p>}
            </>
          )}
          {err && <p className="error">{err}</p>}
          {reward && (
            <div className="reward">
              <p>買う前に試したいときは、広告を1本最後まで見ると、有料の機能を24時間使えます。</p>
              <button className="btn-line" disabled={reward.busy || reward.left <= 0} onClick={reward.onWatch}>
                {reward.busy ? '広告を読み込んでいます' : reward.left > 0 ? `広告を見て24時間使う(今日あと${reward.left}回)` : '今日の分は使い切りました'}
              </button>
            </div>
          )}
          <button className="link-btn center-block" disabled={busy} onClick={() => run(onRestore)}>購入を復元</button>
          <p className="note legal">
            購入はストアのアカウントに請求されます。無料期間の終了後と各期間の終了後は、終了の24時間前までに解約しない限り同じ料金で自動更新されます。
            解約はストアの「サブスクリプション」からいつでもできます。
          </p>
          <p className="note center"><a href="./terms.html" target="_blank" rel="noreferrer">利用規約</a> ・ <a href="./privacy.html" target="_blank" rel="noreferrer">プライバシーポリシー</a></p>
        </div>
      </div>
    </div>
  );
}
