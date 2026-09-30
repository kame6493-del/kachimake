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
import { hype, streak, summarize, title, inRange } from './domain/stats';
import { INTRO, Paywall } from './ui/Paywall';
import { monthRange } from './domain/data';
import { parseReview, reminderDates, shouldAskReview, shouldShowIntro } from './domain/nudge';
import { askReview, keepAwake, scheduleReminders } from './platform/native';
import { shareCard, type ShareCard } from './platform/shareImage';
import { dateJa, pct } from './ui/format';
import { kindInfo } from './domain/types';

type Tab = 'home' | 'analysis' | 'counter' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'カレンダー', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { id: 'analysis', label: '分析', icon: 'M5 20V11M11 20V5M17 20v-7M3 20h18' },
  { id: 'counter', label: 'カウンター', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8' },
  { id: 'settings', label: '設定', icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' },
];

const UNLOCK_KEY = 'kachimake.unlockUntil';
const DAILY_KEY = 'kachimake.rewardDaily';
const REVIEW_KEY = 'kachimake.review';
const INTRO_KEY = 'kachimake.introShown';
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
  // 開発時だけ: ?sheet=form / paywall / intro で画面写真を撮る
  const devSheet = import.meta.env.DEV ? new URLSearchParams(location.search).get('sheet') : null;
  const [form, setForm] = useState<{ session: Session | null; date: string } | null>(devSheet === 'form' ? { session: null, date: today() } : null);
  const [paywall, setPaywall] = useState<string | null>(devSheet === 'paywall' ? '店舗・場ごとの収支' : devSheet === 'intro' ? INTRO : null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastAct, setToastAct] = useState<{ label: string; run: () => void } | null>(null);
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
  // 演出が終わった後にすること(シェアの案内・評価のお願い・無料体験の案内)
  const afterCelebrate = useRef<(() => void) | null>(null);
  const endCelebrate = useCallback(() => {
    setCelebrate(null);
    const f = afterCelebrate.current;
    afterCelebrate.current = null;
    f?.();
  }, []);

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

  const toast = useCallback((msg: string, act?: { label: string; run: () => void }) => {
    setToastMsg(msg);
    setToastAct(act ?? null);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => { setToastMsg(''); setToastAct(null); }, act ? 6000 : 2600);
  }, []);

  // カウンターを開いている間は画面を消さない
  useEffect(() => {
    void keepAwake(tab === 'counter');
  }, [tab]);

  // 文字の大きさ
  const fontScale = data?.settings.fontScale ?? 1;
  useEffect(() => {
    document.documentElement.style.setProperty('--zoom', String(fontScale));
  }, [fontScale]);

  // 夜のお知らせ: 設定か「今日記入したか」が変わったら置き直す
  const remindOn = data?.settings.remind.on ?? false;
  const remindTime = data?.settings.remind.time ?? '21:30';
  const wroteToday = !!data?.sessions.some((s) => s.date === today());
  useEffect(() => {
    if (!data) return;
    const n = new Date();
    const dates = remindOn ? reminderDates(data.sessions.filter((s) => s.date === today()), today(), n.getHours() * 60 + n.getMinutes(), remindTime) : [];
    void scheduleReminders(dates, remindTime);
    // data.sessions 全体でなく「今日記入したか」だけで置き直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindOn, remindTime, wroteToday, !!data]);

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
    const newCount = data.sessions.length + (exists ? 0 : 1);
    const intro = !exists && billing.status === 'ready' && billing.plans.some((x) => x.trial)
      && shouldShowIntro(newCount, readLocal(INTRO_KEY) === '1', premium);
    const openIntro = () => { writeLocal(INTRO_KEY, '1'); setPaywall(INTRO); };
    if (h) {
      const review = parseReview(readLocal(REVIEW_KEY));
      const ask = shouldAskReview(review, Date.now(), newCount, h);
      afterCelebrate.current = () => {
        if (ask) {
          writeLocal(REVIEW_KEY, JSON.stringify({ asked: review.asked + 1, last: Date.now() }));
          void askReview();
        } else if (intro) {
          openIntro();
          return;
        }
        toast('この勝ちを画像で自慢できます', { label: 'シェア', run: () => void shareWin(s) });
      };
      setCelebrate({ kind: h, amount: s.payout - s.invest });
    } else {
      toast(exists ? '直しました' : '記入しました');
      if (intro) window.setTimeout(openIntro, 700);
    }
  };
  const doShare = async (card: ShareCard) => {
    const r = await shareCard(card);
    if (r === 'saved') toast('画像を保存しました');
    if (r === 'failed') toast('画像を作れませんでした');
  };
  const shareWin = (s: Session) => {
    const p = s.payout - s.invest;
    const h = hype(p);
    return doShare({
      head: `${dateJa(s.date)} ${kindInfo(s.kind).label}`,
      amount: p,
      badge: h === 'jackpot' ? '激アツ!!' : h === 'big' ? '大勝!' : '勝ち!',
      lines: [[s.target, s.place].filter(Boolean).join(' / ') || kindInfo(s.kind).label, `投資 ¥${s.invest.toLocaleString('ja-JP')} → 回収 ¥${s.payout.toLocaleString('ja-JP')}`],
    });
  };
  const shareMonth = () => {
    const { from, to } = monthRange(month);
    const sum = summarize(inRange(data.sessions, from, to));
    const run = month === today().slice(0, 7) ? streak(data.sessions) : null;
    const [y, m] = month.split('-').map(Number);
    return doShare({
      head: `${y}年${m}月の収支`,
      amount: sum.profit,
      badge: title(sum.recovery) ?? undefined,
      lines: [
        `${sum.wins}勝${sum.losses}敗・回収率 ${pct(sum.recovery, 0)}`,
        run && run.n >= 2 ? `いま${run.n}${run.kind === 'win' ? '連勝中' : '連敗中'}` : `${sum.count}回の記入`,
      ],
    });
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
            onEdit={(s) => setForm({ session: s, date: s.date })} onAdd={(d) => setForm({ session: null, date: d })} onShare={() => void shareMonth()} />
        )}
        {tab === 'analysis' && <Analysis data={data} premium={access} unlockedUntil={!premium && access ? untilText(unlockUntil) : null} onPaywall={setPaywall} />}
        {tab === 'counter' && (
          <Counter data={data} premium={access} onPaywall={setPaywall} setCounter={setCounter}
            saveMachine={saveMachine} deleteMachine={deleteMachine} toast={toast} />
        )}
        {tab === 'settings' && (
          <SettingsPage data={data} premium={premium} setSettings={setSettings} replaceData={commit}
            onPaywall={setPaywall} onRestore={doRestore} toast={toast}
            onPrivacyOptions={ads.privacyOptions ? () => void showPrivacyOptions() : undefined} />
        )}
      </main>

      {adsMock && bannerVisible && <div className="ad-mock" aria-hidden="true">広告(開発用の見本)</div>}

      {tab === 'home' && (
        <button className="fab" aria-label="収支を記入" onClick={() => setForm({ session: null, date: selected })}>+</button>
      )}

      <nav className="tabbar" aria-label="画面の切り替え">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
            <span>{t.label}</span>
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
      {toastMsg && (
        <div className={`toast ${toastAct ? 'has-act' : ''}`} role="status">
          <span>{toastMsg}</span>
          {toastAct && <button onClick={() => { const r = toastAct.run; setToastMsg(''); setToastAct(null); r(); }}>{toastAct.label}</button>}
        </div>
      )}
      {celebrate && <Celebrate kind={celebrate.kind} amount={celebrate.amount} onDone={endCelebrate} />}
    </div>
  );
}
