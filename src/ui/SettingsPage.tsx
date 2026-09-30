import { useState } from 'react';
import type { AppData, Settings } from '../domain/types';
import { normalize, toCsv, today } from '../domain/data';
import { exportText, pickTextFile } from '../platform/files';
import { manageUrl } from '../platform/billing';
import { yen } from './format';
import { ballsToYen, stock } from '../domain/stats';
import { shouldNudgeBackup } from '../domain/nudge';
import { allowNotifications } from '../platform/native';

export const LAST_BACKUP_KEY = 'kachimake.lastBackup';
const readLast = () => { try { return Number(localStorage.getItem(LAST_BACKUP_KEY)) || 0; } catch { return 0; } };
const FONT_SIZES: [Settings['fontScale'], string][] = [[1, '標準'], [1.15, '大きい'], [1.3, 'とても大きい']];

interface Props {
  data: AppData;
  premium: boolean;
  setSettings: (s: Settings) => void;
  replaceData: (d: AppData) => void;
  onPaywall: (why: string) => void;
  onRestore: () => Promise<void>;
  toast: (msg: string) => void;
  /** 広告の同意を変える画面(EU などで必要なときだけ) */
  onPrivacyOptions?: () => void;
}

export function SettingsPage({ data, premium, setSettings, replaceData, onPaywall, onRestore, toast, onPrivacyOptions }: Props) {
  const s = data.settings;
  const [limit, setLimit] = useState(s.monthlyLimit ? String(s.monthlyLimit) : '');
  const [pending, setPending] = useState<{ data: AppData; dropped: number } | null>(null);
  const [lastBackup, setLastBackup] = useState(readLast);
  const stocks = stock(data.sessions).filter((r) => r.count !== 0);
  const nudge = shouldNudgeBackup(data.sessions.length, lastBackup, Date.now());

  const toggleRemind = async () => {
    if (s.remind.on) return setSettings({ ...s, remind: { ...s.remind, on: false } });
    if (!(await allowNotifications())) return toast('お知らせが許可されていません。端末の設定から許可してください');
    setSettings({ ...s, remind: { ...s.remind, on: true } });
    toast(`毎日 ${s.remind.time} にお知らせします(記入した日は出ません)`);
  };

  const saveLimit = () => setSettings({ ...s, monthlyLimit: Number(limit) || 0 });

  const backup = async () => {
    await exportText(`kachimake-backup-${today()}.json`, JSON.stringify(data), 'application/json');
    const now = Date.now();
    try { localStorage.setItem(LAST_BACKUP_KEY, String(now)); } catch { /* 表示が戻るだけ */ }
    setLastBackup(now);
  };
  const csv = async () => {
    if (!premium) return onPaywall('CSVで書き出し');
    await exportText(`kachimake-${today()}.csv`, toCsv(data.sessions), 'text/csv');
  };
  const load = async () => {
    const text = await pickTextFile('application/json,.json');
    if (!text) return;
    try {
      setPending(normalize(JSON.parse(text)));
    } catch {
      toast('読み込めないファイルでした');
    }
  };

  return (
    <div className="settings">
      <h1 className="mincho page-title">設定</h1>

      <section className="block">
        <h2 className="mincho sec">有料プラン</h2>
        {premium ? (
          <>
            <p>有料プランが有効です。</p>
            <a className="link-btn" href={manageUrl} target="_blank" rel="noreferrer">ストアで解約・変更する</a>
          </>
        ) : (
          <>
            <p>長い期間の分析、店舗・機種ごとの収支、設定の推測が使えて、広告が消えます。</p>
            <div className="inline">
              <button className="btn-line" onClick={() => onPaywall('有料プラン')}>内容と料金を見る</button>
              <button className="link-btn" onClick={() => onRestore()}>購入を復元</button>
            </div>
          </>
        )}
      </section>

      <section className="block">
        <h2 className="mincho sec"><label htmlFor="limit">月の負けの上限</label></h2>
        <p className="note">その月の負けがこの額に近づくと、記録の画面でお知らせします。0 にすると止まります。</p>
        <div className="inline nowrap">
          <span className="yen-input">
            <span>¥</span>
            <input id="limit" inputMode="numeric" value={limit ? Number(limit).toLocaleString('ja-JP') : ''} placeholder="0"
              onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} onBlur={saveLimit} />
          </span>
          <button className="btn" onClick={saveLimit}>上限を保存</button>
        </div>
        {s.monthlyLimit > 0 && <p className="note">いまの上限 {yen(s.monthlyLimit)}</p>}
      </section>

      <section className="block">
        <h2 className="mincho sec">記入のお知らせ</h2>
        <p className="note">記入を忘れた日の夜にだけ、お知らせを出します。その日に記入していれば出ません。</p>
        <div className="inline nowrap">
          <button className={`switch ${s.remind.on ? 'on' : ''}`} role="switch" aria-checked={s.remind.on} onClick={toggleRemind}>
            <span className="switch-knob" aria-hidden="true" />{s.remind.on ? 'お知らせする' : 'お知らせしない'}
          </button>
          <input type="time" className="time-input" aria-label="お知らせの時刻" value={s.remind.time}
            onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && setSettings({ ...s, remind: { ...s.remind, time: e.target.value } })} />
        </div>
      </section>

      {stocks.length > 0 && (
        <section className="block">
          <h2 className="mincho sec">貯玉・貯メダル</h2>
          <table className="ledger stock">
            <thead><tr><th scope="col">店舗</th><th scope="col">残り</th><th scope="col">円にすると</th></tr></thead>
            <tbody>
              {stocks.map((r) => (
                <tr key={`${r.kind}${r.place}`}>
                  <th scope="row" className="ellipsis"><span className="mark" aria-hidden="true">{r.kind === 'slot' ? 'スロ' : 'パチ'}</span>{r.place}</th>
                  <td className={r.count < 0 ? 'minus' : ''}>{r.count.toLocaleString('ja-JP')}{r.kind === 'slot' ? '枚' : '玉'}</td>
                  <td>{r.rate ? yen(ballsToYen(r.count, r.rate)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">記入の「貯玉を使った・貯めた」から数えています。店の残高と違うときは、記入を直してください。</p>
        </section>
      )}

      <section className="block">
        <h2 className="mincho sec">表示</h2>
        <div className="field">
          <span className="field-label">文字の大きさ</span>
          <div className="opts">
            {FONT_SIZES.map(([v, l]) => (
              <button key={v} aria-pressed={s.fontScale === v} className={`opt ${s.fontScale === v ? 'on' : ''}`} onClick={() => setSettings({ ...s, fontScale: v })}>{l}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">週の始まり</span>
          <div className="opts">
            {(['日曜', '月曜'] as const).map((l, i) => (
              <button key={l} aria-pressed={s.weekStart === i} className={`opt ${s.weekStart === i ? 'on' : ''}`} onClick={() => setSettings({ ...s, weekStart: i as 0 | 1 })}>{l}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">黒字(勝ち)の色</span>
          <div className="opts">
            <button aria-pressed={s.winColor === 'ink'} className={`opt ${s.winColor === 'ink' ? 'on' : ''}`} onClick={() => setSettings({ ...s, winColor: 'ink' })}>青(いつもの色)</button>
            <button aria-pressed={s.winColor === 'blue'} className={`opt ${s.winColor === 'blue' ? 'on' : ''}`} onClick={() => setSettings({ ...s, winColor: 'blue' })}>黒(帳簿と同じ)</button>
          </div>
        </div>
      </section>

      <section className="block">
        <h2 className="mincho sec">データ</h2>
        {nudge && (
          <p className="backup-nudge">
            {lastBackup ? `最後のバックアップから${Math.floor((Date.now() - lastBackup) / 86400000)}日たちました。` : 'まだ一度もバックアップしていません。'}
            {data.sessions.length}回ぶんの記入を守るため、書き出しておきましょう。
          </p>
        )}
        <p className="note">
          記入はこの端末の中に保存されます。端末のバックアップ(Android は Google、iPhone は iCloud)を有効にしていれば、機種変更のときに一緒に移ります。
          念のため、ファイルにも書き出しておけます{lastBackup ? `(前回 ${new Date(lastBackup).toLocaleDateString('ja-JP')})` : ''}。
        </p>
        <ul className="menu">
          <li><button onClick={backup}>バックアップを書き出す</button></li>
          <li><button onClick={load}>バックアップから戻す</button></li>
          <li><button onClick={csv}>CSVで書き出す{!premium && <small className="paid">有料</small>}</button></li>
        </ul>
        {pending && (
          <div className="confirm">
            <p>
              {pending.data.sessions.length}件の記録で、いまの{data.sessions.length}件を置き換えます。
              {pending.dropped > 0 && ` 読めなかった${pending.dropped}件は取り込みません。`}
            </p>
            <div className="inline">
              <button className="danger" onClick={() => { replaceData(pending.data); setPending(null); toast('バックアップから戻しました'); }}>置き換える</button>
              <button className="link-btn" onClick={() => setPending(null)}>やめる</button>
            </div>
          </div>
        )}
      </section>


      <section className="block">
        <ul className="links">
          <li><a href="./terms.html" target="_blank" rel="noreferrer">利用規約</a></li>
          <li><a href="./privacy.html" target="_blank" rel="noreferrer">プライバシーポリシー</a></li>
          {onPrivacyOptions && <li><button className="link-btn" onClick={onPrivacyOptions}>広告の同意を変える</button></li>}
        </ul>
        <p className="note">カチマケ 1.1.0 ・ パチンコ・パチスロは18歳未満、公営競技の投票は20歳未満の方は法律で禁止されています。</p>
      </section>
    </div>
  );
}
