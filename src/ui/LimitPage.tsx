// 負け上限(見本 kachi2_ref_06)。中身は 1.1.0 の「月の負けの上限」と「記録のお知らせ」。
// 上限はホームで知らせる(端末の通知は出さない)。種目別の上限・通知の割合の選択は記録の形を変えないと持てないので作らない
import { useState } from 'react';
import type { AppData, Settings } from '../domain/types';
import { limitStatus } from '../domain/stats';
import { today } from '../domain/data';
import { allowNotifications } from '../platform/native';
import { BackHead, Icon, Switch } from './parts';
import { LIMIT_WARN } from './Home';

const PRESETS = [20000, 50000, 80000, 100000, 150000];

export function LimitPage({ data, setSettings, toast, onBack }: { data: AppData; setSettings: (s: Settings) => void; toast: (m: string) => void; onBack: () => void }) {
  const s = data.settings;
  const [limit, setLimit] = useState(s.monthlyLimit ? String(s.monthlyLimit) : '');
  const on = s.monthlyLimit > 0;
  const month = today().slice(0, 7);
  const st = limitStatus(data.sessions, month, s.monthlyLimit);
  const lost = st?.lost ?? 0;
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const ratio = on ? lost / s.monthlyLimit : 0;
  const shown = on ? s.monthlyLimit : Number(limit) || 80000;

  const saveLimit = (v: number) => {
    const n = Math.max(0, Math.min(99_999_999, v));
    setLimit(n ? String(n) : '');
    setSettings({ ...s, monthlyLimit: n });
  };
  const toggleLimit = () => (on ? saveLimit(0) : saveLimit(Number(limit) || 80000));

  const toggleRemind = async () => {
    if (s.remind.on) return setSettings({ ...s, remind: { ...s.remind, on: false } });
    if (!(await allowNotifications())) return toast('お知らせが許可されていません。端末の設定から許可してください');
    setSettings({ ...s, remind: { ...s.remind, on: true } });
    toast(`毎日 ${s.remind.time} にお知らせします(記録した日は出ません)`);
  };

  return (
    <div className="page limit-page">
      <BackHead title="負け上限" label={false} onBack={onBack}
        sub={'使いすぎを防ぎ、無理のない範囲で楽しむための設定です。\n設定した金額に近づくと、ホームでお知らせします。'} />

      <section className="card lp-toggle">
        <div><b>今月の負け上限を設定する</b><small>オンにすると、設定した金額に近づいたときにお知らせします。</small></div>
        <Switch on={on} onClick={toggleLimit} label="今月の負け上限を設定する" />
      </section>

      <section className="card">
        <div className="card-head"><h2><label htmlFor="limit">今月の負け上限額</label></h2><Icon name="pencil" size={22} className="ic-gold" /></div>
        <div className="lp-amount">
          <span className="amount-box big">
            <input id="limit" inputMode="numeric" value={limit ? Number(limit).toLocaleString('ja-JP') : ''} placeholder="0"
              onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} onBlur={() => saveLimit(Number(limit) || 0)} />
            <span>円</span>
          </span>
          <div className="presets">
            {PRESETS.map((v) => (
              <button key={v} className={on && s.monthlyLimit === v ? 'on' : ''} aria-pressed={on && s.monthlyLimit === v} onClick={() => saveLimit(v)}>{v.toLocaleString('ja-JP')}</button>
            ))}
            <button className={on && !PRESETS.includes(s.monthlyLimit) ? 'on' : ''} onClick={() => document.getElementById('limit')?.focus()}>その他</button>
          </div>
        </div>
      </section>

      <section className="card lp-now">
        <div className="card-head"><h2>現在の状況</h2><small className="muted">{y}年{m}月1日 〜 {m}月{last}日</small></div>
        <div className="lc-bar big"><i className={ratio >= LIMIT_WARN ? 'warn' : ''} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
        <div className="lp-nums">
          <div><small>現在の損失額</small><b className="minus">{lost.toLocaleString('ja-JP')}<small>円</small></b></div>
          <div className="r"><small>{ratio >= 1 ? '上限を超えた額' : '上限まであと'}</small><b>{(on ? Math.abs(s.monthlyLimit - lost) : 0).toLocaleString('ja-JP')}<small>円</small></b><span className="muted">({on ? Math.round(ratio * 100) : 0}%)</span></div>
        </div>
        {!on && <p className="note">上限がオフのあいだは数えません。</p>}
      </section>

      <section className="card sgroup">
        <h2>通知の設定</h2>
        <div className="srow static">
          <span className="srow-ic"><Icon name="bell" size={26} /></span>
          <span className="srow-text"><b>上限のお知らせ</b><small>使った額が上限の80%に近づくと、ホームでお知らせします。</small></span>
          <span className="srow-val">80%</span>
        </div>
        <div className="srow static">
          <span className="srow-ic"><Icon name="clock" size={26} /></span>
          <span className="srow-text"><b>記録のお知らせ</b><small>記録を忘れた日の夜にだけ、端末にお知らせを出します。</small></span>
          <Switch on={s.remind.on} onClick={() => void toggleRemind()} label="記録のお知らせ" />
        </div>
        <label className="srow static">
          <span className="srow-ic"><Icon name="moon" size={26} /></span>
          <span className="srow-text"><b>お知らせの時刻</b><small>その日に記録していれば出ません。</small></span>
          <input type="time" className="time-in" value={s.remind.time} aria-label="お知らせの時刻"
            onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && setSettings({ ...s, remind: { ...s.remind, time: e.target.value } })} />
        </label>
      </section>

      <section className="card notice-sample">
        <div className="ns-top"><span>お知らせの表示例</span><small>ホームに出る表示</small></div>
        <div className="ns-body">
          <span className="alert-dot big" aria-hidden="true">!</span>
          <div>
            <b>今月の負け上限に近づいています</b>
            <p>現在の損失額は {Math.round(shown * LIMIT_WARN).toLocaleString('ja-JP')} 円です。<br />設定した上限額 {shown.toLocaleString('ja-JP')} 円の {LIMIT_WARN * 100}% に達しました。<br />一度、遊び方を見直してみましょう。</p>
          </div>
        </div>
      </section>

      <button className="btn-gold wide" onClick={() => { saveLimit(Number(limit) || 0); toast('設定を保存しました'); onBack(); }}>設定を保存する</button>
    </div>
  );
}
