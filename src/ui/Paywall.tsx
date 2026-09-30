import { useState } from 'react';
import type { BillingState, Plan } from '../platform/billing';

interface Props {
  why: string;
  billing: BillingState;
  onBuy: (p: Plan) => Promise<void>;
  onRestore: () => Promise<void>;
  onClose: () => void;
  /** リワード広告で24時間使う。広告が出せないとき・有料のときは null */
  reward: { left: number; busy: boolean; onWatch: () => void } | null;
}

const FEATURES = [
  ['3か月・今年・全期間の分析', '累計の推移と月ごとの収支を、長い期間で見られます'],
  ['店舗・機種・曜日・券種ごとの収支', 'どの店、どの台、どの買い方で負けているかが表になります'],
  ['設定の推測', '数えた小役から、設定ごとの確率を計算します'],
  ['機種の登録数', '無料は1台まで。有料は制限なし'],
  ['CSVの書き出し', '表計算ソフトで集計し直せます'],
  ['広告なし', '分析と設定の画面の下に出る広告が消えます'],
];

export function Paywall({ why, billing, onBuy, onRestore, onClose, reward }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const plans = billing.status === 'ready'
    ? [...billing.plans].sort((a, b) => Number(b.period === 'annual') - Number(a.period === 'annual'))
    : [];
  const [sel, setSel] = useState<string>('');
  const chosen = plans.find((p) => p.id === sel) ?? plans[0];

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : '購入できませんでした'); } finally { setBusy(false); }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet paywall" role="dialog" aria-modal="true" aria-label="有料プラン" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="link-btn" onClick={onClose}>閉じる</button>
          <h2 className="mincho">有料プラン</h2>
          <span />
        </div>
        <div className="sheet-body">
          <p className="pw-why">「{why}」は有料プランで使えます。</p>
          <ul className="pw-list">
            {FEATURES.map(([t, d]) => <li key={t}><strong>{t}</strong><span>{d}</span></li>)}
          </ul>
          <p className="note">記入・カレンダー・今月と先月の分析・負けの上限・バックアップは、ずっと無料です。</p>

          {billing.status === 'unavailable' ? (
            <p className="state-line">{billing.reason}</p>
          ) : plans.length === 0 ? (
            <p className="state-line">いま購入できるプランがありません。時間をおいて開き直してください</p>
          ) : (
            <>
              <div className="plans" role="radiogroup" aria-label="プラン">
                {plans.map((p) => (
                  <button key={p.id} role="radio" aria-checked={chosen?.id === p.id} className={`plan ${chosen?.id === p.id ? 'on' : ''}`} onClick={() => setSel(p.id)}>
                    <span className="plan-name">{p.period === 'annual' ? '年額' : p.period === 'monthly' ? '月額' : p.title}</span>
                    <span className="plan-price">{p.price}{p.period === 'annual' ? ' / 年' : p.period === 'monthly' ? ' / 月' : ''}</span>
                    {p.perMonth && <span className="plan-note">月あたり {p.perMonth}</span>}
                    {p.trial && <span className="plan-trial">{p.trial}</span>}
                  </button>
                ))}
              </div>
              <button className="btn wide" disabled={busy || !chosen} onClick={() => chosen && run(() => onBuy(chosen))}>
                {busy ? '処理中' : chosen?.trial ? `${chosen.trial}で試す` : `${chosen?.price ?? ''}で購入する`}
              </button>
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
