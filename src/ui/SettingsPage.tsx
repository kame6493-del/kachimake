// 設定(見本 kachi2_ref_08)。中身は 1.1.0 と同じ(有料プラン・上限とお知らせ・表示・データ・貯玉・規約)。上限とお知らせは別の画面へ
import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { AppData, Settings } from '../domain/types';
import { normalize, toCsv, today } from '../domain/data';
import { exportText, pickTextFile } from '../platform/files';
import { manageUrl } from '../platform/billing';
import { en } from './format';
import { ballsToYen, stock } from '../domain/stats';
import { shouldNudgeBackup } from '../domain/nudge';
import { Icon, PageHead, Seg } from './parts';

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
  /** はじめの画面をもう一度出す */
  onIntro?: () => void;
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

export function SettingsPage({ data, premium, setSettings, replaceData, onPaywall, onRestore, toast, onLimit, onCounter, onIntro, onPrivacyOptions }: Props) {
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
      <PageHead title="設定" />

      <section className="card sgroup">
        <h2>表示</h2>
        <div className="sset">
          <span className="srow-ic"><Icon name="text" size={26} /></span>
          <div className="sset-body">
            <b>文字の大きさ</b>
            <Seg label="文字の大きさ" value={String(s.fontScale)} onChange={(v) => setSettings({ ...s, fontScale: Number(v) as Settings['fontScale'] })}
              items={FONT_SIZES.map(([v, l]) => [String(v), l] as [string, string])} />
          </div>
        </div>
        <div className="sset">
          <span className="srow-ic"><Icon name="calendar" size={26} /></span>
          <div className="sset-body">
            <b>週の始まり</b>
            <Seg label="週の始まり" value={String(s.weekStart)} onChange={(v) => setSettings({ ...s, weekStart: Number(v) as 0 | 1 })} items={[['0', '日曜'], ['1', '月曜']]} />
          </div>
        </div>
        <div className="sset">
          <span className="srow-ic"><Icon name="palette" size={26} /></span>
          <div className="sset-body">
            <b>勝ちの色</b>
            <small>赤と緑の区別がしにくいときは青にできます</small>
            <Seg label="勝ちの色" value={s.winColor} onChange={(v) => setSettings({ ...s, winColor: v })} items={[['ink', '緑(いつもの色)'], ['blue', '青']]} />
          </div>
        </div>
      </section>

      <section className="card sgroup">
        <h2>通知・上限</h2>
        <Row icon="bell" title="記録のお知らせ" sub="記録を忘れた日の夜にだけお知らせします"
          right={<span className="srow-val">{s.remind.on ? s.remind.time : 'オフ'}</span>} onClick={onLimit} />
        <Row icon="target" title="負け上限" sub="今月の負けの上限と、近づいたときの表示"
          right={<span className="srow-val">{s.monthlyLimit > 0 ? en(s.monthlyLimit) : 'オフ'}</span>} onClick={onLimit} />
        <Row icon="counter" title="小役カウンター" sub="小役を数えて、設定ごとの確率を出します" onClick={onCounter} />
      </section>

      <section className="card sgroup">
        <h2>データ</h2>
        <div className="local-banner">
          <Icon name="database" size={30} className="ic-gold" />
          <span><b>すべての記録はこの端末に保存されています</b><small>サーバーには送られません。端末のバックアップ({Capacitor.getPlatform() === 'ios' ? 'iCloud' : 'Google'})を有効にしていれば、機種変更でも一緒に移ります。</small></span>
          <Icon name="shield" size={28} className="ic-gold" />
        </div>
        {nudge && (
          <p className="backup-nudge">
            {lastBackup ? `最後のバックアップから${Math.floor((Date.now() - lastBackup) / 86400000)}日たちました。` : 'まだ一度もバックアップしていません。'}
            {data.sessions.length}回ぶんの記録を守るため、書き出しておきましょう。
          </p>
        )}
        <Row icon="fileDown" title="CSV書き出し" sub="記録データをCSVファイルとして書き出します" right={!premium ? <small className="paid">完全版</small> : undefined} onClick={csv} />
        <Row icon="cloudUp" title="バックアップ" sub={lastBackup ? `前回 ${new Date(lastBackup).toLocaleDateString('ja-JP')}` : '記録をファイルに控えておきます'} onClick={backup} />
        <Row icon="cloudDown" title="復元" sub="バックアップファイルから記録を戻します" onClick={load} />
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

      {stocks.length > 0 && (
        <section className="card sgroup">
          <h2>貯玉・貯メダル</h2>
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
        <h2>プライバシー</h2>
        <Row icon="lock" title="プライバシーポリシー" href="./privacy.html" />
        <Row icon="shieldDoc" title="利用規約" href="./terms.html" />
        {onPrivacyOptions && <Row icon="info" title="広告の同意を変える" onClick={onPrivacyOptions} />}
      </section>

      <section className="card sgroup pro-group">
        <h2><Icon name="crown" size={22} className="ic-gold" />完全版の機能</h2>
        <div className="pro-tiles">
          <div><Icon name="chart" size={26} className="ic-gold" /><span><b>長い期間の分析</b><small>3か月・今年・全期間を表示</small></span></div>
          <div><Icon name="trendUp" size={26} className="ic-gold" /><span><b>場所・機種ごとの収支</b><small>どこで勝ち負けしたか</small></span></div>
          <div><Icon name="fileDown" size={26} className="ic-gold" /><span><b>CSV書き出し</b><small>全期間のデータを書き出し</small></span></div>
          <div><Icon name="gear" size={26} className="ic-gold" /><span><b>設定の推測・広告なし</b><small>小役から設定を推測</small></span></div>
        </div>
        {premium ? (
          <>
            <div className="srow static"><span className="srow-ic"><Icon name="check" size={26} /></span><span className="srow-text"><b>完全版が有効です</b><small>すべての分析・CSV・設定の推測が使えます</small></span></div>
            <Row icon="gear" title="ストアで解約・変更する" href={manageUrl} />
          </>
        ) : (
          <>
            <Row icon="crown" title="完全版の内容を見る" sub="長い期間の分析、店・機種ごとの収支、設定の推測。広告が消えます" onClick={() => onPaywall('有料プラン')} />
            <Row icon="undo" title="購入を復元" sub="機種変更・入れ直しのあとに" onClick={() => void onRestore()} />
          </>
        )}
      </section>

      <section className="card sgroup">
        <h2><Icon name="info" size={22} className="ic-gold" />アプリについて</h2>
        <div className="srow static"><span className="srow-ic"><Icon name="doc" size={24} /></span><span className="srow-text"><b>バージョン</b></span><span className="srow-val muted">{APP_VERSION}</span></div>
        {onIntro && <Row icon="help" title="はじめの画面をもう一度見る" onClick={onIntro} />}
        <Row icon="mail" title="使い方・お問い合わせ" href="./support.html" />
      </section>
      <p className="note center legal-age">パチンコ・パチスロは18歳未満、公営競技の投票は20歳未満の方は法律で禁止されています。</p>
    </div>
  );
}
