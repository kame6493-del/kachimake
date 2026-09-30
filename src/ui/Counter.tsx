import { useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { AppData, CounterMachine, CounterState } from '../domain/types';
import { expectedSetting, observedDenom, posterior } from '../domain/bayes';
import { newId } from '../domain/data';
import { decodeMachine, encodeMachine } from '../domain/nudge';
import { shareText } from '../platform/files';

interface Props {
  data: AppData;
  premium: boolean;
  onPaywall: (why: string) => void;
  setCounter: (fn: (c: CounterState) => CounterState) => void;
  saveMachine: (m: CounterMachine) => void;
  deleteMachine: (id: string) => void;
  toast: (msg: string) => void;
}

const FREE_CUSTOM = 1;
const tap = () => Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
const denomText = (v: number | null) => (v == null ? '—' : `1/${v >= 100 ? Math.round(v) : v.toFixed(1)}`);

export function Counter({ data, premium, onPaywall, setCounter, saveMachine, deleteMachine, toast }: Props) {
  const machines = data.machines;
  const state: CounterState = data.counter && machines.some((m) => m.id === data.counter!.machineId)
    ? data.counter
    : { machineId: machines[0].id, games: 0, counts: {} };
  const machine = machines.find((m) => m.id === state.machineId)!;
  const [editing, setEditing] = useState<CounterMachine | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const update = (patch: Partial<CounterState>) => setCounter((c) => ({ ...c, ...patch }));
  const bump = (id: string, d: number) => {
    tap();
    setCounter((c) => ({ ...c, counts: { ...c.counts, [id]: Math.max(0, (c.counts[id] ?? 0) + d) } }));
  };
  const addGames = (d: number) => setCounter((c) => ({ ...c, games: Math.max(0, Math.min(99999, c.games + d)) }));

  const post = posterior(machine, state.games, state.counts);
  const exp = expectedSetting(machine, post);
  const best = post.indexOf(Math.max(...post));
  const customCount = machines.filter((m) => m.id !== 'sample').length;

  const newMachine = () => {
    if (!premium && customCount >= FREE_CUSTOM) return onPaywall('2台目以降の機種登録');
    setEditing({ id: newId(), name: '', settings: ['1', '2', '3', '4', '5', '6'], items: [{ id: newId(), name: '', denom: [0, 0, 0, 0, 0, 0] }] });
  };

  return (
    <div className="counter">
      <h1 className="mincho page-title">小役カウンター</h1>

      <div className="machine-bar">
        <select aria-label="数える機種" value={machine.id} onChange={(e) => update({ machineId: e.target.value, counts: {}, games: 0 })}>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.name || '(名前なし)'}</option>)}
        </select>
        {machine.id !== 'sample' && <button className="link-btn" onClick={() => setEditing(machine)}>編集</button>}
        {machine.id !== 'sample' && (
          <button className="link-btn" onClick={async () => {
            const r = await shareText(`${machine.name} の確率(カチマケの機種コード)
${encodeMachine(machine)}`);
            if (r === 'copied') toast('機種コードをコピーしました。LINE などに貼って渡せます');
          }}>共有</button>
        )}
        <button className="link-btn" onClick={newMachine}>機種を追加</button>
      </div>

      <section className="games" aria-label="回転数">
        <div className="games-top">
          <label className="field-label" htmlFor="games">回転数</label>
          <input id="games" inputMode="numeric" value={state.games || ''} placeholder="0"
            onChange={(e) => update({ games: Math.min(99999, Number(e.target.value.replace(/[^\d]/g, '')) || 0) })} />
          <span className="games-unit">G</span>
        </div>
        <div className="steps">
          {[1, 10, 100].map((n) => <button key={n} onClick={() => addGames(n)}>+{n}</button>)}
          <button onClick={() => addGames(-10)}>-10</button>
        </div>
      </section>

      <section className="counter-grid">
        {machine.items.map((it) => (
          <div key={it.id} className="counter-item">
            <button className="counter-tap" onClick={() => bump(it.id, 1)} aria-label={`${it.name} を1つ足す`}>
              <span className="counter-name">{it.name || '項目'}</span>
              <span className="counter-num">{state.counts[it.id] ?? 0}</span>
              <span className="counter-rate">{denomText(observedDenom(state.games, state.counts[it.id] ?? 0))}</span>
            </button>
            <button className="counter-minus" onClick={() => bump(it.id, -1)} aria-label={`${it.name} を1つ減らす`}>−</button>
          </div>
        ))}
      </section>

      <section className="block" aria-label="設定の推測">
        <h2 className="mincho sec">設定の推測</h2>
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
            <p>数えた小役から設定ごとの確率を出す計算は、有料プランで使えます。数えることと実際の確率(1/x)は無料です。</p>
            <button className="btn-line" onClick={() => onPaywall('設定の推測')}>有料プランの内容を見る</button>
          </div>
        )}
      </section>

      <div className="reset">
        {confirmReset ? (
          <div className="danger-row">
            <span>回数をすべて0に戻しますか?</span>
            <button className="danger" onClick={() => { update({ games: 0, counts: {} }); setConfirmReset(false); }}>戻す</button>
            <button className="link-btn" onClick={() => setConfirmReset(false)}>やめる</button>
          </div>
        ) : <button className="link-btn" onClick={() => setConfirmReset(true)}>回数を0に戻す</button>}
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
