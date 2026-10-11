// 小役カウンター(見本 kachi2_ref_07)。数える中身(機種・回転数・回数)は 1.1.0 と同じ形で保存する。
// 開始時刻・メモ・直近の履歴は記録の形を変えないよう、この端末の控え(localStorage)にだけ置く
import { useEffect, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { AppData, CounterMachine, CounterState } from '../domain/types';
import { expectedSetting, observedDenom, posterior } from '../domain/bayes';
import { newId } from '../domain/data';
import { decodeMachine, encodeMachine } from '../domain/nudge';
import { shareText } from '../platform/files';
import { Icon, Seg } from './parts';

interface Props {
  data: AppData;
  premium: boolean;
  onPaywall: (why: string) => void;
  setCounter: (fn: (c: CounterState) => CounterState) => void;
  saveMachine: (m: CounterMachine) => void;
  deleteMachine: (id: string) => void;
  toast: (msg: string) => void;
  onClose: () => void;
  /** 「記録に反映」: 数えた結果をメモにして記録を追加の画面を開く */
  onRecord: (machine: string, memo: string) => void;
}

const FREE_CUSTOM = 1;
const tap = () => Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
const denomText = (v: number | null) => (v == null ? '—' : v >= 100 ? String(Math.round(v)) : v.toFixed(1));
const START_KEY = 'kachimake.counterStart';
const MEMO_KEY = 'kachimake.counterMemo';
const LOG_KEY = 'kachimake.counterLog';
type Log = { t: number; name: string; icon: string; d: number; after: number };
const rd = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const wr = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 控えが残らないだけ */ } };
const readLog = (): Log[] => { try { const v = JSON.parse(rd(LOG_KEY) ?? '[]'); return Array.isArray(v) ? v.slice(0, 50) : []; } catch { return []; } };

/** 小役の名前から見本の絵と色を選ぶ */
export function yakuLook(name: string): { img: string | null; tone: string } {
  const n = name.normalize('NFKC').toLowerCase();
  if (n.includes('ベル')) return { img: './img/yaku_bell.png', tone: 'gold' };
  if (n.includes('チェリー')) return { img: './img/yaku_cherry.png', tone: 'red' };
  if (n.includes('スイカ')) return { img: './img/yaku_suika.png', tone: 'green' };
  if (n.includes('reg') || n.includes('レギュラー')) return { img: './img/yaku_reg.png', tone: 'blue' };
  if (n.includes('big') || n.includes('ビッグ') || n.includes('ボーナス')) return { img: './img/yaku_big.png', tone: 'red' };
  return { img: null, tone: 'gold' };
}
const pad2 = (n: number) => String(n).padStart(2, '0');
const stamp = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

export function Counter({ data, premium, onPaywall, setCounter, saveMachine, deleteMachine, toast, onClose, onRecord }: Props) {
  const machines = data.machines;
  const state: CounterState = data.counter && machines.some((m) => m.id === data.counter!.machineId)
    ? data.counter
    : { machineId: machines[0].id, games: 0, counts: {} };
  const machine = machines.find((m) => m.id === state.machineId)!;
  const [editing, setEditing] = useState<CounterMachine | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [view, setView] = useState<'denom' | 'rate'>('denom');
  const [memo, setMemo] = useState(() => rd(MEMO_KEY) ?? '');
  const [log, setLog] = useState<Log[]>(readLog);
  const [allLog, setAllLog] = useState(false);
  const [start, setStart] = useState(() => Number(rd(START_KEY)) || 0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const begin = () => {
    if (start) return;
    const t = Date.now();
    setStart(t);
    wr(START_KEY, String(t));
  };
  const addLog = (name: string, icon: string, d: number, after: number) => {
    const next = [{ t: Date.now(), name, icon, d, after }, ...log].slice(0, 50);
    setLog(next);
    wr(LOG_KEY, JSON.stringify(next));
  };
  const update = (patch: Partial<CounterState>) => setCounter((c) => ({ ...c, ...patch }));
  const bump = (id: string, name: string, d: number) => {
    tap();
    begin();
    const after = Math.max(0, (state.counts[id] ?? 0) + d);
    setCounter((c) => ({ ...c, counts: { ...c.counts, [id]: Math.max(0, (c.counts[id] ?? 0) + d) } }));
    addLog(name, id, d, after);
  };
  const addGames = (d: number) => {
    begin();
    const after = Math.max(0, Math.min(99999, state.games + d));
    setCounter((c) => ({ ...c, games: Math.max(0, Math.min(99999, c.games + d)) }));
    addLog('総回転数', 'games', d, after);
  };
  const resetAll = () => {
    update({ games: 0, counts: {} });
    setStart(0); wr(START_KEY, null);
    setLog([]); wr(LOG_KEY, null);
    setConfirmReset(false);
  };

  const post = posterior(machine, state.games, state.counts);
  const exp = expectedSetting(machine, post);
  const best = post.indexOf(Math.max(...post));
  const customCount = machines.filter((m) => m.id !== 'sample').length;
  const elapsed = start ? Math.max(0, Math.floor((now - start) / 60000)) : 0;
  const items = machine.items;
  const rem = items.length % 3;
  const span = (i: number) => (rem === 2 && i >= items.length - 2 ? 3 : rem === 1 && i === items.length - 1 ? 6 : 2);

  const newMachine = () => {
    if (!premium && customCount >= FREE_CUSTOM) return onPaywall('2台目以降の機種登録');
    setEditing({ id: newId(), name: '', settings: ['1', '2', '3', '4', '5', '6'], items: [{ id: newId(), name: '', denom: [0, 0, 0, 0, 0, 0] }] });
  };
  const record = () => {
    const lines = [`総回転数 ${state.games.toLocaleString('ja-JP')}G`, items.map((it) => `${it.name} ${state.counts[it.id] ?? 0}`).join(' / ')];
    if (memo.trim()) lines.push(memo.trim());
    onRecord(machine.id === 'sample' ? '' : machine.name, lines.join('\n'));
  };

  return (
    <div className="page counter">
      <header className="page-head">
        <h1 className="ph-title"><img src="./img/logo_bars.png" alt="" width={30} height={31} />小役カウンター</h1>
        <div className="ph-right">
          <label className="ms-pill machine-pill">
            <span>{machine.name || '(名前なし)'}</span>
            <Icon name="down" size={18} />
            <select aria-label="数える機種" value={machine.id} onChange={(e) => update({ machineId: e.target.value, counts: {}, games: 0 })}>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name || '(名前なし)'}</option>)}
            </select>
          </label>
          <button className="icon-btn" aria-label="機種の登録・共有" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="gear" size={26} className="ic-gold" /></button>
        </div>
      </header>

      {menu && (
        <div className="card machine-menu">
          <button className="btn-line sm" onClick={() => { setMenu(false); newMachine(); }}><Icon name="plus" size={16} />機種を追加</button>
          {machine.id !== 'sample' && <button className="btn-line sm" onClick={() => { setMenu(false); setEditing(machine); }}><Icon name="pencil" size={16} />編集</button>}
          {machine.id !== 'sample' && (
            <button className="btn-line sm" onClick={async () => {
              setMenu(false);
              const r = await shareText(`${machine.name} の確率(カチマケの機種コード)\n${encodeMachine(machine)}`);
              if (r === 'copied') toast('機種コードをコピーしました。LINE などに貼って渡せます');
            }}><Icon name="share" size={16} />共有</button>
          )}
        </div>
      )}

      <div className="ct-info">
        <div><Icon name="clock" size={24} /><span><small>開始時刻</small>{start ? `${new Date(start).getFullYear()}/${pad2(new Date(start).getMonth() + 1)}/${pad2(new Date(start).getDate())} ${pad2(new Date(start).getHours())}:${pad2(new Date(start).getMinutes())}` : '—'}</span></div>
        <div><Icon name="timer" size={24} /><span><small>経過時間</small>{start ? `${Math.floor(elapsed / 60)}時間 ${elapsed % 60}分` : '—'}</span></div>
        <div><Icon name="doc" size={24} className="ic-gold" /><span><small>総ゲーム数</small>{state.games.toLocaleString('ja-JP')} G</span></div>
      </div>

      <section className="card ct-games" aria-label="総回転数">
        <div className="ct-games-top">
          <label htmlFor="games">総回転数</label>
          <button className="btn-dark sm" onClick={() => setConfirmReset(true)}><Icon name="reset" size={18} />リセット</button>
        </div>
        <input id="games" className="ct-big" inputMode="numeric" value={state.games ? state.games.toLocaleString('ja-JP') : '0'}
          onChange={(e) => { begin(); update({ games: Math.min(99999, Number(e.target.value.replace(/[^\d]/g, '')) || 0) }); }} />
        <div className="ct-steps">
          {[1, 10, 50, 100].map((n) => <button key={n} className="btn-gold" onClick={() => addGames(n)}>+{n}</button>)}
        </div>
      </section>

      <section className="ct-items">
        {items.map((it, i) => {
          const look = yakuLook(it.name);
          return (
            <div key={it.id} className="card ct-item" style={{ gridColumn: `span ${span(i)}` }}>
              <div className="ct-item-top">
                {look.img ? <img src={look.img} alt="" /> : <span className="ct-noimg" aria-hidden="true">{(it.name || '項')[0]}</span>}
                <span className="ct-name">{it.name || '項目'}</span>
              </div>
              <b className="ct-num">{(state.counts[it.id] ?? 0).toLocaleString('ja-JP')}</b>
              <div className="ct-pm">
                <button className="btn-dark" onClick={() => bump(it.id, it.name, -1)} aria-label={`${it.name} を1つ減らす`}><Icon name="minus" size={26} /></button>
                <button className={`ct-plus ${look.tone}`} onClick={() => bump(it.id, it.name, 1)} aria-label={`${it.name} を1つ足す`}><Icon name="plus" size={26} /></button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card" aria-label="出現確率">
        <div className="card-head">
          <h2>出現確率<small>(総回転数から算出)</small></h2>
          <Seg label="出し方" value={view} onChange={setView} items={[['denom', '確率'], ['rate', '出現率']]} />
        </div>
        <div className="ct-probs">
          {items.map((it) => {
            const c = state.counts[it.id] ?? 0;
            const look = yakuLook(it.name);
            return (
              <div key={it.id}>
                <small>{it.name}</small>
                {view === 'denom'
                  ? <b className={`t-${look.tone}`}><span>1/</span>{denomText(observedDenom(state.games, c))}</b>
                  : <b className={`t-${look.tone}`}>{state.games ? ((c / state.games) * 100).toFixed(1) : '—'}<span>%</span></b>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" aria-label="メモ">
        <div className="card-head"><h2><Icon name="doc" size={22} className="ic-gold" />メモ</h2></div>
        <span className="memo-box">
          <textarea rows={2} value={memo} maxLength={200} placeholder="メモを入力…" onChange={(e) => { setMemo(e.target.value); wr(MEMO_KEY, e.target.value); }} />
          <small>{memo.length}/200</small>
        </span>
      </section>

      <section className="card" aria-label="直近のカウント履歴">
        <div className="card-head">
          <h2><Icon name="history" size={22} className="ic-gold" />直近のカウント履歴</h2>
          {log.length > 5 && <button className="more" onClick={() => setAllLog(!allLog)}>{allLog ? '閉じる' : 'すべて見る'}<Icon name={allLog ? 'up' : 'right'} size={16} /></button>}
        </div>
        {log.length === 0 ? <p className="empty-line">数えると、ここに履歴が出ます</p> : (
          <ul className="ct-log">
            {(allLog ? log : log.slice(0, 5)).map((l, i) => {
              const look = l.icon === 'games' ? null : yakuLook(l.name);
              return (
                <li key={`${l.t}-${i}`}>
                  <span className="muted">{stamp(l.t)}</span>
                  <span className="cl-ic">{look?.img ? <img src={look.img} alt="" /> : <Icon name="reset" size={18} />}</span>
                  <span>{l.name}</span>
                  <b className={l.d > 0 ? 'plus' : 'minus'}>{l.d > 0 ? '+' : ''}{l.d}</b>
                  <span className="muted">→</span>
                  <span className="cl-after">{l.after.toLocaleString('ja-JP')}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card" aria-label="設定の推測">
        <div className="card-head"><h2>設定の推測</h2></div>
        {premium ? (
          <>
            {state.games === 0 ? <p className="empty-line">回転数と小役を数えると、設定ごとの確率が出ます</p> : (
              <>
                <div className="post">
                  {machine.settings.map((s, i) => (
                    <div key={s} className={`post-row ${i === best ? 'best' : ''}`}>
                      <span className="post-label">設定{s}</span>
                      <span className="post-track"><span className="post-fill" style={{ width: `${post[i] * 100}%` }} /></span>
                      <span className="post-val">{(post[i] * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                {exp != null && <p className="expect">設定の期待値 <strong>{exp.toFixed(2)}</strong></p>}
              </>
            )}
            <p className="note">数えた回数と、登録した確率だけから計算した推測です。実際の設定を保証するものではありません。</p>
          </>
        ) : (
          <div className="paid-note">
            <p>数えた小役から設定ごとの確率を出す計算は、完全版で使えます。数えることと実際の確率(1/x)は無料です。</p>
            <button className="btn-line" onClick={() => onPaywall('設定の推測')}>完全版の内容を見る</button>
          </div>
        )}
      </section>

      {confirmReset && (
        <div className="card danger-row">
          <span>回数・開始時刻・履歴をすべて0に戻しますか?</span>
          <button className="danger" onClick={resetAll}>戻す</button>
          <button className="link-btn" onClick={() => setConfirmReset(false)}>やめる</button>
        </div>
      )}

      <div className="ct-bottom">
        <button className="btn-dark" onClick={() => setConfirmReset(true)}><Icon name="reset" size={22} />リセット</button>
        <button className="btn-gold" onClick={record}><Icon name="bars3" size={22} />記録に反映</button>
        <button className="btn-red" onClick={onClose}><Icon name="stop" size={20} />終了</button>
      </div>

      {editing && (
        <MachineEditor
          machine={editing}
          onClose={() => setEditing(null)}
          onSave={(m) => { saveMachine(m); update({ machineId: m.id, counts: {}, games: 0 }); setEditing(null); }}
          onDelete={machines.some((m) => m.id === editing.id) ? () => { deleteMachine(editing.id); setEditing(null); } : undefined}
        />
      )}
    </div>
  );
}

function MachineEditor({ machine, onClose, onSave, onDelete }: {
  machine: CounterMachine; onClose: () => void; onSave: (m: CounterMachine) => void; onDelete?: () => void;
}) {
  const [m, setM] = useState<CounterMachine>(structuredClone(machine));
  const [raw, setRaw] = useState<Record<string, string[]>>(() => rawOf(machine));
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(false);
  const isNew = !onDelete;
  const readCode = (v: string) => {
    setCode(v);
    if (!v.trim()) return setCodeErr(false);
    const got = decodeMachine(v, newId);
    setCodeErr(!got);
    if (got) {
      const next = { ...got, id: machine.id };
      setM(next);
      setRaw(rawOf(next));
    }
  };
  const n = m.settings.length;

  const setCount = (c: number) => {
    const settings = Array.from({ length: c }, (_, i) => String(i + 1));
    setM({ ...m, settings, items: m.items.map((it) => ({ ...it, denom: settings.map((_, i) => it.denom[i] ?? 0) })) });
    setRaw(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, settings.map((_, i) => v[i] ?? '')])));
  };
  const setItem = (id: string, patch: Partial<CounterMachine['items'][number]>) =>
    setM({ ...m, items: m.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const setDenom = (id: string, i: number, v: string) => {
    const clean = v.replace(/[^\d.]/g, '').slice(0, 8);
    const arr = [...(raw[id] ?? Array(n).fill(''))];
    arr[i] = clean;
    setRaw({ ...raw, [id]: arr });
    const it = m.items.find((x) => x.id === id)!;
    const denom = [...it.denom];
    const num = Number(clean);
    denom[i] = Number.isFinite(num) && num > 1 ? num : 0;
    setItem(id, { denom });
  };
  const addItem = () => {
    const id = newId();
    setM({ ...m, items: [...m.items, { id, name: '', denom: Array(n).fill(0) }] });
    setRaw({ ...raw, [id]: Array(n).fill('') });
  };
  const valid = m.name.trim() && m.items.length > 0 && m.items.every((it) => it.name.trim() && it.denom.every((d) => d > 1));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="機種の登録" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="link-btn" onClick={onClose}>閉じる</button>
          <h2 className="mincho">機種の登録</h2>
          <button className="btn" disabled={!valid} onClick={() => onSave({ ...m, name: m.name.trim(), items: m.items.map((it) => ({ ...it, name: it.name.trim() })) })}>保存</button>
        </div>
        <div className="sheet-body">
          {isNew && (
            <label className="field">
              <span className="field-label">人からもらった機種コードを貼る(なければ下に手で入れる)</span>
              <textarea rows={2} value={code} placeholder="KM1. から始まる文字" onChange={(e) => readCode(e.target.value)} />
              {codeErr && <span className="note danger-text">読めないコードでした。最初から最後まで貼ってください</span>}
              {!codeErr && code.trim() && <span className="note">読み込みました。中身を確かめて保存してください</span>}
            </label>
          )}
          <label className="field">
            <span className="field-label">機種名</span>
            <input value={m.name} maxLength={60} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="例: よく打つ台" />
          </label>
          <div className="field">
            <span className="field-label">設定の数</span>
            <div className="opts">
              {[2, 3, 4, 5, 6].map((c) => <button key={c} aria-pressed={n === c} className={`opt ${n === c ? 'on' : ''}`} onClick={() => setCount(c)}>{c}段階</button>)}
            </div>
          </div>
          <p className="note">確率は 1/x の x を入れます(例: 1/7.5 なら 7.5)。数値は雑誌や公式の解析を見て入れてください。</p>
          {m.items.map((it) => (
            <div key={it.id} className="item-edit">
              <div className="item-edit-head">
                <input className="item-name" value={it.name} maxLength={30} placeholder="項目名(例: ベル)" onChange={(e) => setItem(it.id, { name: e.target.value })} />
                {m.items.length > 1 && <button className="link-btn danger-text" onClick={() => setM({ ...m, items: m.items.filter((x) => x.id !== it.id) })}>削除</button>}
              </div>
              <div className="denoms" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                {m.settings.map((s, i) => (
                  <label key={s}>
                    <span>設定{s}</span>
                    <input inputMode="decimal" value={raw[it.id]?.[i] ?? ''} placeholder="x" onChange={(e) => setDenom(it.id, i, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          {m.items.length < 12 && <button className="link-btn" onClick={addItem}>項目を足す</button>}
          {onDelete && <button className="link-btn danger-text" onClick={onDelete}>この機種を消す</button>}
        </div>
      </div>
    </div>
  );
}

const rawOf = (m: CounterMachine) => Object.fromEntries(m.items.map((it) => [it.id, it.denom.map((v) => (v > 1 ? String(v) : ''))]));
