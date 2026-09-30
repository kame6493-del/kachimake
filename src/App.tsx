import { useCallback, useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import type { AppData, CounterMachine, CounterState, Session, Settings } from './domain/types';
import { emptyData, today } from './domain/data';
import { loadData, saveData } from './platform/storage';
import { loadBilling, purchase, restore, type BillingState, type Plan } from './platform/billing';
import { adsMock, initAds, removeBanner, setBanner, showPrivacyOptions, showReward, type AdsState } from './platform/ads';
import { dailyLeft, extendUnlock, parseDaily, spendDaily } from './domain/unlock';
import { Capacitor } from '@capacitor/core';
import { Home } from './ui/Home';
import { Analysis } from './ui/Analysis';
import { Counter } from './ui/Counter';
import { SettingsPage } from './ui/SettingsPage';
import { SessionForm } from './ui/SessionForm';
import { Celebrate, type Hype } from './ui/Celebrate';
import { hype } from './domain/stats';
import { Paywall } from './ui/Paywall';

type Tab = 'home' | 'analysis' | 'counter' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: '記録' },
  { id: 'analysis', label: '分析' },
  { id: 'counter', label: 'カウンター' },
  { id: 'settings', label: '設定' },
];

const UNLOCK_KEY = 'kachimake.unlockUntil';
const DAILY_KEY = 'kachimake.rewardDaily';
const readLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* この回だけ有効 */ } };
const untilText = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** バナーの下端の位置: 下のタブの高さ。Android は画面の下端が基準なので、ナビゲーションバーの分も足す */
function bannerMargin() {
  const TAB = 52;
  if (Capacitor.getPlatform() !== 'android') return TAB;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden';
  document.body.appendChild(probe);
  const inset = probe.offsetHeight;
  probe.remove();
  return TAB + inset;
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [billing, setBilling] = useState<BillingState>({ status: 'unavailable', reason: '読み込み中' });
  const [tab, setTab] = useState<Tab>(() => {
    const t = import.meta.env.DEV ? new URLSearchParams(location.search).get('tab') : null;
    return t === 'analysis' || t === 'counter' || t === 'settings' ? t : 'home';
  });
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selected, setSelected] = useState(today());
  const [form, setForm] = useState<{ session: Session | null; date: string } | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const [ads, setAds] = useState<AdsState>({ allowed: false, privacyOptions: false });
  const [adHeight, setAdHeight] = useState(0);
  const [unlockUntil, setUnlockUntil] = useState(() => Number(readLocal(UNLOCK_KEY)) || 0);
  const [now, setNow] = useState(() => Date.now());
  const [rewardBusy, setRewardBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<{ kind: Hype; amount: number } | null>(() => {
    // 開発時だけ: ?celebrate=jackpot などで演出を撮影できる
    const c = import.meta.env.DEV ? new URLSearchParams(location.search).get('celebrate') : null;
    return c === 'jackpot' || c === 'big' || c === 'win' ? { kind: c, amount: c === 'jackpot' ? 58600 : c === 'big' ? 16200 : 3500 } : null;
  });
  const endCelebrate = useCallback(() => setCelebrate(null), []);

  useEffect(() => {
    loadData().then(setData).catch(() => setData(emptyData()));
    loadBilling().then(setBilling);
    void initAds().then(setAds);
  }, []);

  const premium = billing.status === 'ready' && billing.premium;
  // 有料の機能を使えるか: 有料プラン、またはリワード広告の期限内
  const access = premium || unlockUntil > now;

  // 期限が来たら画面を描き直す
  useEffect(() => {
    if (unlockUntil <= Date.now()) return;
    const t = window.setTimeout(() => setNow(Date.now()), unlockUntil - Date.now() + 500);
    return () => window.clearTimeout(t);
  }, [unlockUntil]);

  // バナーは分析と設定だけ。シートが開いている間は隠す(ネイティブの広告はシートの上に重なるため)
  const bannerVisible = ads.allowed && !premium && !!data && (tab === 'analysis' || tab === 'settings') && !form && !paywall;
  useEffect(() => {
    void setBanner(bannerVisible, bannerMargin(), setAdHeight);
  }, [bannerVisible]);
  useEffect(() => {
    if (premium) { void removeBanner(); setAdHeight(0); }
  }, [premium]);
  useEffect(() => {
    document.documentElement.style.setProperty('--ad-h', `${adHeight}px`);
  }, [adHeight]);

  // Android の「戻る」: 開いているシートを先に閉じる。何も開いていなければ記録へ、記録ならアプリを背面へ
  const back = useRef<() => void>(() => {});
  back.current = () => {
    if (paywall) setPaywall(null);
    else if (form) setForm(null);
    else if (tab !== 'home') setTab('home');
    else void NativeApp.minimizeApp();
  };
  useEffect(() => {
    const h = NativeApp.addListener('backButton', () => back.current());
    return () => { void h.then((x) => x.remove()); };
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  // 書き込みは必ず直前の値から計算する。連打で前の回数を上書きして消さないため
  const mutate = useCallback((fn: (d: AppData) => AppData) => setData((prev) => (prev ? fn(prev) : prev)), []);
  const commit = useCallback((next: AppData) => setData(next), []);

  // 保存は状態が変わった後に1回。読み込んだ直後の1回は書かない
  const loaded = useRef<AppData | null>(null);
  useEffect(() => {
    if (!data) return;
    if (loaded.current === null) { loaded.current = data; return; }
    void saveData(data);
  }, [data]);

  if (!data) return <div className="boot" aria-busy="true"><span>記入を読み込んでいます</span></div>;

  const upsert = (s: Session) => {
    const exists = data.sessions.some((x) => x.id === s.id);
    mutate((d) => {
      const has = d.sessions.some((x) => x.id === s.id);
      const sessions = has ? d.sessions.map((x) => (x.id === s.id ? s : x)) : [...d.sessions, s];
      sessions.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
      return { ...d, sessions };
    });
    setForm(null);
    setSelected(s.date);
    setMonth(s.date.slice(0, 7));
    // 新しく記入した勝ちだけ演出する(直したときや負けの記入では出さない)
    const h = exists ? null : hype(s.payout - s.invest);
    if (h) setCelebrate({ kind: h, amount: s.payout - s.invest });
    else toast(exists ? '直しました' : '記入しました');
  };
  const remove = (id: string) => {
    mutate((d) => ({ ...d, sessions: d.sessions.filter((x) => x.id !== id) }));
    setForm(null);
    toast('消しました');
  };
  const setSettings = (settings: Settings) => mutate((d) => ({ ...d, settings }));
  const setCounter = (fn: (c: CounterState) => CounterState) => mutate((d) => {
    const cur = d.counter && d.machines.some((m) => m.id === d.counter!.machineId)
      ? d.counter
      : { machineId: d.machines[0].id, games: 0, counts: {} };
    return { ...d, counter: fn(cur) };
  });
  const saveMachine = (m: CounterMachine) => {
    mutate((d) => ({
      ...d,
      machines: d.machines.some((x) => x.id === m.id) ? d.machines.map((x) => (x.id === m.id ? m : x)) : [...d.machines, m],
    }));
  };
  const deleteMachine = (id: string) => mutate((d) => ({
    ...d,
    machines: d.machines.filter((m) => m.id !== id),
    counter: d.counter?.machineId === id ? null : d.counter,
  }));

  const refreshBilling = async () => setBilling(await loadBilling());
  const buy = async (p: Plan) => {
    if (await purchase(p)) {
      await refreshBilling();
      setPaywall(null);
      toast('有料プランが有効になりました');
    }
  };
  const doRestore = async () => {
    try {
      const ok = await restore();
      await refreshBilling();
      if (ok) setPaywall(null);
      toast(ok ? '購入を復元しました' : '復元できる購入はありませんでした');
    } catch {
      toast('復元できませんでした。通信を確かめてください');
    }
  };

  const rewardLeft = dailyLeft(parseDaily(readLocal(DAILY_KEY)), today());
  const watchReward = async () => {
    if (rewardBusy) return;
    if (rewardLeft <= 0) return toast('今日の分は使い切りました。明日また見られます');
    setRewardBusy(true);
    try {
      const r = await showReward();
      if (r === 'rewarded') {
        const until = extendUnlock(Date.now(), unlockUntil);
        writeLocal(UNLOCK_KEY, String(until));
        writeLocal(DAILY_KEY, JSON.stringify(spendDaily(parseDaily(readLocal(DAILY_KEY)), today())));
        setUnlockUntil(until);
        setNow(Date.now());
        setPaywall(null);
        toast(`${untilText(until)}まで、有料の分析が使えます`);
      } else if (r === 'closed') {
        toast('最後まで見ると使えるようになります');
      } else {
        toast('いまは広告を用意できませんでした。時間をおいてください');
      }
    } finally {
      setRewardBusy(false);
    }
  };

  const lastKind = data.sessions.length ? [...data.sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0].kind : 'pachinko';

  return (
    <div className={`app win-${data.settings.winColor}`}>
      <main>
        {tab === 'home' && (
          <Home data={data} month={month} setMonth={setMonth} selected={selected} setSelected={setSelected}
            onEdit={(s) => setForm({ session: s, date: s.date })} onAdd={(d) => setForm({ session: null, date: d })} />
        )}
        {tab === 'analysis' && <Analysis data={data} premium={access} unlockedUntil={!premium && access ? untilText(unlockUntil) : null} onPaywall={setPaywall} />}
        {tab === 'counter' && (
          <Counter data={data} premium={access} onPaywall={setPaywall} setCounter={setCounter}
            saveMachine={saveMachine} deleteMachine={deleteMachine} />
        )}
        {tab === 'settings' && (
          <SettingsPage data={data} premium={premium} setSettings={setSettings} replaceData={commit}
            onPaywall={setPaywall} onRestore={doRestore} toast={toast}
            onPrivacyOptions={ads.privacyOptions ? () => void showPrivacyOptions() : undefined} />
        )}
      </main>

      {adsMock && bannerVisible && <div className="ad-mock" aria-hidden="true">広告(開発用の見本)</div>}

      {tab === 'home' && (
        <button className="fab" aria-label="収支を記入" onClick={() => setForm({ session: null, date: selected })}>記入</button>
      )}

      <nav className="tabbar" aria-label="画面の切り替え">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {form && (
        <SessionForm initial={form.session} date={form.date} history={data.sessions} lastKind={lastKind}
          onSave={upsert} onDelete={remove} onClose={() => setForm(null)} />
      )}
      {paywall && (
        <Paywall why={paywall} billing={billing} onBuy={buy} onRestore={doRestore} onClose={() => setPaywall(null)}
          reward={ads.allowed && !premium ? { left: rewardLeft, busy: rewardBusy, onWatch: watchReward } : null} />
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      {celebrate && <Celebrate kind={celebrate.kind} amount={celebrate.amount} onDone={endCelebrate} />}
    </div>
  );
}
