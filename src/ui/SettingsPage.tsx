// 設定(見本 04)。中身は 1.1.0 と同じ(有料プラン・上限とお知らせ・表示・データ・貯玉・規約)。上限とお知らせは別の画面へ
import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { AppData, Settings } from '../domain/types';
import { normalize, toCsv, today } from '../domain/data';
import { exportText, pickTextFile } from '../platform/files';
import { manageUrl } from '../platform/billing';
import { en } from './format';
import { ballsToYen, stock } from '../domain/stats';
import { shouldNudgeBackup } from '../domain/nudge';
import { BrandHead, Icon } from './parts';

export const LAST_BACKUP_KEY = 'kachimake.lastBackup';
export const APP_VERSION = '1.2.0';
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
  onLimit: () => void;
  onCounter: () => void;
  /** 広告の同意を変える画面(EU などで必要なときだけ) */
  onPrivacyOptions?: () => void;
}

function Row({ icon, title, sub, right, onClick, href }: { icon: string; title: string; sub?: string; right?: React.ReactNode; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <span className="srow-ic"><Icon name={icon} size={26} /></span>
      <span className="srow-text"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {right}
      <Icon name="right" size={18} className="chev" />
    </>
  );
  return href
    ? <a className="srow" href={href} target="_blank" rel="noreferrer">{body}</a>
    : <button className="srow" onClick={onClick}>{body}</button>;
}

export function SettingsPage({ data, premium, setSettings, replaceData, onPaywall, onRestore, toast, onLimit, onCounter, onPrivacyOptions }: Props) {
  const s = data.settings;
  const [pending, setPending] = useState<{ data: AppData; dropped: number } | null>(null);
  const [lastBackup, setLastBackup] = useState(readLast);
  const stocks = stock(data.sessions).filter((r) => r.count !== 0);
  const nudge = shouldNudgeBackup(data.sessions.length, lastBackup, Date.now());

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
    <div className="page settings">
      <BrandHead sub="遊びを、記録で味方に。" right={<span className="head-title">設定</span>} />

      <section className="card privacy-card">
        <img src="./img/shield.png" alt="" width={86} height={84} />
        <div>
          <b>あなたの記録は、この端末にだけ</b>
          <p>カチマケの記録はサーバーに送られず、この端末の中にだけ保存されます。端末のバックアップ({Capacitor.getPlatform() === 'ios' ? 'iCloud' : 'Google'})を有効にしていれば、機種変更でも一緒に移ります。</p>
        </div>
      </section>

      <section className="card sgroup">
        <h2><Icon name="trophy" />有料プラン</h2>
        {premium ? (
          <>
            <div className="srow static"><span className="srow-ic"><Icon name="check" size={26} /></span><span className="srow-text"><b>有料プランが有効です</b><small>すべての分析・CSV・設定の推測が使えます</small></span></div>
            <Row icon="gear" title="ストアで解約・変更する" href={manageUrl} />
          </>
        ) : (
          <>
            <Row icon="chart" title="内容を見る" sub="長い期間の分析、店舗・機種ごとの収支、設定の推測。広告が消えます" onClick={() => onPaywall('有料プラン')} />
            <Row icon="undo" title="購入を復元" sub="機種変更・入れ直しのあとに" onClick={() => void onRestore()} />
          </>
        )}
      </section>

      <section className="card sgroup">
        <h2><Icon name="database" />データ管理</h2>
        {nudge && (
          <p className="backup-nudge">
            {lastBackup ? `最後のバックアップから${Math.floor((Date.now() - lastBackup) / 86400000)}日たちました。` : 'まだ一度もバックアップしていません。'}
            {data.sessions.length}回ぶんの記録を守るため、書き出しておきましょう。
          </p>
        )}
        <Row icon="fileDown" title="CSV書き出し" sub="収支の記録を表計算ソフト用に書き出します" right={!premium ? <small className="paid">有料</small> : undefined} onClick={csv} />
        <Row icon="backup" title="バックアップを書き出す" sub={lastBackup ? `前回 ${new Date(lastBackup).toLocaleDateString('ja-JP')}` : '記録をファイルに控えておきます'} onClick={backup} />
        <Row icon="fileUp" title="バックアップから戻す" sub="書き出したファイルから記録を戻します" onClick={load} />
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

      <section className="card sgroup">
        <h2><Icon name="bell" />上限・お知らせ</h2>
        <Row icon="target" title="上限設定・通知" sub="月の負けの上限と、記録のお知らせ"
          right={<span className="srow-val">{s.monthlyLimit > 0 ? en(s.monthlyLimit) : 'オフ'}</span>} onClick={onLimit} />
      </section>

      <section className="card sgroup">
        <h2><Icon name="monitor" />表示・外観</h2>
        <div className="sset">
          <span className="srow-ic"><Icon name="text" size={26} /></span>
          <div className="sset-body">
            <b>文字の大きさ</b>
            <div className="seg">
              {FONT_SIZES.map(([v, l]) => (
                <button key={v} aria-pressed={s.fontScale === v} className={s.fontScale === v ? 'on' : ''} onClick={() => setSettings({ ...s, fontScale: v })}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="sset">
          <span className="srow-ic"><Icon name="calendar" size={26} /></span>
          <div className="sset-body">
            <b>週の始まり</b>
            <div className="seg">
              {(['日曜', '月曜'] as const).map((l, i) => (
                <button key={l} aria-pressed={s.weekStart === i} className={s.weekStart === i ? 'on' : ''} onClick={() => setSettings({ ...s, weekStart: i as 0 | 1 })}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="sset">
          <span className="srow-ic"><Icon name="palette" size={26} /></span>
          <div className="sset-body">
            <b>勝ちの色</b>
            <small>赤と緑の区別がしにくいときは青にできます</small>
            <div className="seg">
              <button aria-pressed={s.winColor === 'ink'} className={s.winColor === 'ink' ? 'on' : ''} onClick={() => setSettings({ ...s, winColor: 'ink' })}>緑(いつもの色)</button>
              <button aria-pressed={s.winColor === 'blue'} className={s.winColor === 'blue' ? 'on' : ''} onClick={() => setSettings({ ...s, winColor: 'blue' })}>青</button>
            </div>
          </div>
        </div>
      </section>

      {stocks.length > 0 && (
        <section className="card sgroup">
          <h2><Icon name="coins" />貯玉・貯メダル</h2>
          <table className="ledger stock">
            <thead><tr><th scope="col">店舗</th><th scope="col">残り</th><th scope="col">円にすると</th></tr></thead>
            <tbody>
              {stocks.map((r) => (
                <tr key={`${r.kind}${r.place}`}>
                  <th scope="row" className="ellipsis">{r.place}<small className="muted">{r.kind === 'slot' ? ' スロ' : ' パチ'}</small></th>
                  <td className={r.count < 0 ? 'minus' : ''}>{r.count.toLocaleString('ja-JP')}{r.kind === 'slot' ? '枚' : '玉'}</td>
                  <td>{r.rate ? en(ballsToYen(r.count, r.rate)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">記録の「貯玉を使った・貯めた」から数えています。店の残高と違うときは、記録を直してください。</p>
        </section>
      )}

      <section className="card sgroup">
        <h2><Icon name="counter" />ツール</h2>
        <Row icon="counter" title="小役カウンター" sub="小役を数えて、設定ごとの確率を出します" onClick={onCounter} />
      </section>

      <section className="card sgroup">
        <h2><Icon name="help" />サポート・その他</h2>
        <Row icon="doc" title="使い方・お問い合わせ" sub="基本の使い方と、ご意見・ご要望の送り先" href="./support.html" />
        <Row icon="shieldDoc" title="利用規約" href="./terms.html" />
        <Row icon="lock" title="プライバシーポリシー" href="./privacy.html" />
        {onPrivacyOptions && <Row icon="info" title="広告の同意を変える" onClick={onPrivacyOptions} />}
        <div className="srow static"><span className="srow-ic"><Icon name="info" size={26} /></span><span className="srow-text"><b>アプリについて</b><small>カチマケ {APP_VERSION}</small></span></div>
      </section>
      <p className="note center legal-age">パチンコ・パチスロは18歳未満、公営競技の投票は20歳未満の方は法律で禁止されています。</p>
    </div>
  );
}
