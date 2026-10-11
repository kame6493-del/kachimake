// 上限設定・通知(見本 05)。中身は 1.1.0 の「月の負けの上限」と「記入のお知らせ」
import { useState } from 'react';
import type { AppData, Settings } from '../domain/types';
import { limitStatus } from '../domain/stats';
import { today } from '../domain/data';
import { allowNotifications } from '../platform/native';
import { BackHead, Icon, Switch } from './parts';
import { en } from './format';

const STEP = 5000;

export function LimitPage({ data, setSettings, toast, onBack }: { data: AppData; setSettings: (s: Settings) => void; toast: (m: string) => void; onBack: () => void }) {
  const s = data.settings;
  const [limit, setLimit] = useState(s.monthlyLimit ? String(s.monthlyLimit) : '');
  const on = s.monthlyLimit > 0;
  const month = today().slice(0, 7);
  const st = limitStatus(data.sessions, month, s.monthlyLimit);
  const lost = st?.lost ?? 0;

  const saveLimit = (v: number) => {
    const n = Math.max(0, Math.min(99_999_999, v));
    setLimit(n ? String(n) : '');
    setSettings({ ...s, monthlyLimit: n });
  };
  const toggleLimit = () => (on ? saveLimit(0) : saveLimit(Number(limit) || 50000));

  const toggleRemind = async () => {
    if (s.remind.on) return setSettings({ ...s, remind: { ...s.remind, on: false } });
    if (!(await allowNotifications())) return toast('お知らせが許可されていません。端末の設定から許可してください');
    setSettings({ ...s, remind: { ...s.remind, on: true } });
    toast(`毎日 ${s.remind.time} にお知らせします(記録した日は出ません)`);
  };

  return (
    <div className="page limit-page">
      <BackHead title="上限設定・通知" sub="使いすぎを防ぎ、計画的に遊ぶために。" onBack={onBack} />

      <section className="card lp-card">
        <div className="lp-head">
          <Icon name="database" size={30} className="ic-blue" />
          <div><b><label htmlFor="limit">月の負けの上限</label></b><small>その月の負けがこの額に近づくと、ホームでお知らせします。</small></div>
          <Switch on={on} onClick={toggleLimit} label="月の負けの上限を使う" />
        </div>
        <div className="lp-amount">
          <span className="amount-box big">
            <input id="limit" inputMode="numeric" value={limit ? Number(limit).toLocaleString('ja-JP') : ''} placeholder="0"
              onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} onBlur={() => saveLimit(Number(limit) || 0)} />
            <span>円</span>
          </span>
          <button className="sq" aria-label={`${STEP.toLocaleString()}円減らす`} onClick={() => saveLimit((Number(limit) || 0) - STEP)}><Icon name="minus" /></button>
          <button className="sq" aria-label={`${STEP.toLocaleString()}円増やす`} onClick={() => saveLimit((Number(limit) || 0) + STEP)}><Icon name="plus" /></button>
        </div>
        {on && (
          <>
            <div className="lp-now"><span>今月の負け</span><b>{en(lost)}</b><span className="muted"> / {en(s.monthlyLimit)}</span></div>
            <div className="bar-line">
              <div className="bar-track"><div className={`bar-fill ${lost >= s.monthlyLimit ? 'over' : lost >= s.monthlyLimit * 0.7 ? 'warn' : ''}`} style={{ width: `${Math.min(100, (lost / s.monthlyLimit) * 100)}%` }} /></div>
              <span>{Math.round((lost / s.monthlyLimit) * 100)}%</span>
            </div>
          </>
        )}
        <p className="note">負けは「その月の収支のマイナス分」で数えます。毎月1日に0から数え直します。0 にすると止まります。</p>
      </section>

      <section className="card lp-card">
        <div className="lp-head">
          <Icon name="bell" size={30} className="ic-blue" />
          <div><b>記録のお知らせ</b><small>記録を忘れた日の夜にだけ、お知らせを出します。その日に記録していれば出ません。</small></div>
          <Switch on={s.remind.on} onClick={() => void toggleRemind()} label="記録のお知らせ" />
        </div>
        <label className="lp-time">
          <span>お知らせの時刻</span>
          <input type="time" value={s.remind.time} aria-label="お知らせの時刻"
            onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && setSettings({ ...s, remind: { ...s.remind, time: e.target.value } })} />
        </label>
      </section>

      <section className="card lp-card">
        <div className="lp-head plain">
          <Icon name="bell" size={30} className="ic-blue" />
          <div><b>お知らせの例</b><small>このようなお知らせが届きます。</small></div>
        </div>
        <div className="notice-sample">
          <span className="ns-mark">!</span>
          <div>
            <div className="ns-top"><small>カチマケ</small><small>{s.remind.time}</small></div>
            <b>今日の収支、記入しましたか?</b>
            <p>打った日・買った日は、忘れないうちに30秒で記入できます</p>
          </div>
        </div>
      </section>
    </div>
  );
}
