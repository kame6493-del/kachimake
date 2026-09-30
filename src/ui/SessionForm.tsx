import { useMemo, useState } from 'react';
import { BET_TYPES, KINDS, type Kind, type Session } from '../domain/types';
import { newId } from '../domain/data';
import { signedYen, tone } from './format';

interface Props {
  initial: Session | null;
  date: string;
  history: Session[];
  lastKind: Kind;
  onSave: (s: Session) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const RACE: Kind[] = ['keiba', 'keirin', 'boat', 'auto'];
const digits = (v: string) => v.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
const toNum = (v: string) => (v ? Number(v) : 0);
const fmt = (v: string) => (v ? Number(v).toLocaleString('ja-JP') : '');

function AmountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const add = (n: number) => onChange(String(toNum(value) + n));
  return (
    <div className="field">
      <label>
        <span className="field-label">{label}</span>
        <span className="yen-input">
          <span>¥</span>
          <input inputMode="numeric" enterKeyHint="next" placeholder="0" value={fmt(value)} onChange={(e) => onChange(digits(e.target.value))} />
        </span>
      </label>
      <div className="steps">
        {[1000, 5000, 10000].map((n) => <button type="button" key={n} onClick={() => add(n)}>+{n.toLocaleString()}</button>)}
        <button type="button" className="clear" onClick={() => onChange('')}>0にする</button>
      </div>
    </div>
  );
}

export function SessionForm({ initial, date, history, lastKind, onSave, onDelete, onClose }: Props) {
  const [d, setD] = useState(initial?.date ?? date);
  const [kind, setKind] = useState<Kind>(initial?.kind ?? lastKind);
  const [place, setPlace] = useState(initial?.place ?? '');
  const [target, setTarget] = useState(initial?.target ?? '');
  const [invest, setInvest] = useState(initial ? String(initial.invest || '') : '');
  const [payout, setPayout] = useState(initial ? String(initial.payout || '') : '');
  const [h, setH] = useState(initial ? String(Math.floor(initial.minutes / 60) || '') : '');
  const [mi, setMi] = useState(initial ? String(initial.minutes % 60 || '') : '');
  const [betType, setBetType] = useState(initial?.betType ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [confirmDel, setConfirmDel] = useState(false);

  // 同じ種類で過去に使った名前を、よく使う順に候補として出す
  const suggest = useMemo(() => {
    const count = (key: 'place' | 'target') => {
      const m = new Map<string, number>();
      for (const s of history) if (s.kind === kind && s[key]) m.set(s[key], (m.get(s[key]) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 30);
    };
    return { place: count('place'), target: count('target') };
  }, [history, kind]);

  const p = toNum(payout) - toNum(invest);
  const minutes = Math.min(24 * 60, toNum(h) * 60 + toNum(mi));
  const isRace = RACE.includes(kind);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(d) && (toNum(invest) > 0 || toNum(payout) > 0);

  const save = () => {
    if (!valid) return;
    const now = Date.now();
    onSave({
      id: initial?.id ?? newId(),
      date: d,
      kind,
      place: place.trim().slice(0, 80),
      target: target.trim().slice(0, 80),
      invest: toNum(invest),
      payout: toNum(payout),
      minutes,
      betType: isRace && betType ? betType : undefined,
      memo: memo.trim().slice(0, 1000),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={initial ? '記入を直す' : '収支を記入'} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="link-btn" onClick={onClose}>閉じる</button>
          <h2 className="mincho">{initial ? '記入を直す' : '収支を記入'}</h2>
          <button className="btn" disabled={!valid} onClick={save}>{initial ? '直して保存' : '記入する'}</button>
        </div>

        <div className="sheet-body">
          <div className="kinds" role="radiogroup" aria-label="種類">
            {KINDS.map((k) => (
              <button key={k.id} role="radio" aria-checked={kind === k.id} className={`opt ${kind === k.id ? 'on' : ''}`} onClick={() => setKind(k.id)}>
                {k.label.replace('レース', '')}
              </button>
            ))}
          </div>

          <label className="field">
            <span className="field-label">日付</span>
            <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
          </label>

          <AmountField label={isRace ? '購入額' : '投資'} value={invest} onChange={setInvest} />
          <AmountField label={isRace ? '払戻' : '回収'} value={payout} onChange={setPayout} />

          <div className="result" aria-live="polite">
            <span>収支</span>
            <strong className={`amount ${tone(p)}`}>{signedYen(p)}</strong>
          </div>
          {!valid && (toNum(invest) === 0 && toNum(payout) === 0) && <p className="note">投資か回収のどちらかを入れると記入できます</p>}

          <label className="field">
            <span className="field-label">{isRace ? '場' : '店舗'}</span>
            <input list="dl-place" value={place} placeholder={isRace ? '例: 東京競馬場' : '例: 駅前店'} onChange={(e) => setPlace(e.target.value)} />
            <datalist id="dl-place">{suggest.place.map((x) => <option key={x} value={x} />)}</datalist>
          </label>

          <label className="field">
            <span className="field-label">{isRace ? 'レース' : '機種'}</span>
            <input list="dl-target" value={target} placeholder={isRace ? '例: 11R 天皇賞' : '例: 機種名'} onChange={(e) => setTarget(e.target.value)} />
            <datalist id="dl-target">{suggest.target.map((x) => <option key={x} value={x} />)}</datalist>
          </label>

          {isRace && (
            <label className="field">
              <span className="field-label">券種</span>
              <select value={betType} onChange={(e) => setBetType(e.target.value)}>
                <option value="">(未設定)</option>
                {BET_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          )}

          <div className="field">
            <span className="field-label">{isRace ? '観戦時間' : '遊技時間'}</span>
            <div className="time-row">
              <input inputMode="numeric" aria-label="時間" value={h} placeholder="0" onChange={(e) => setH(digits(e.target.value).slice(0, 2))} /><span>時間</span>
              <input inputMode="numeric" aria-label="分" value={mi} placeholder="0" onChange={(e) => setMi(String(Math.min(59, toNum(digits(e.target.value).slice(0, 2)))).replace(/^0$/, ''))} /><span>分</span>
            </div>
          </div>

          <label className="field">
            <span className="field-label">メモ</span>
            <textarea rows={2} value={memo} placeholder="気づいたこと" onChange={(e) => setMemo(e.target.value)} />
          </label>

          {initial && (
            confirmDel ? (
              <div className="danger-row">
                <span>この記入を消しますか?</span>
                <button className="danger" onClick={() => onDelete(initial.id)}>消す</button>
                <button className="link-btn" onClick={() => setConfirmDel(false)}>やめる</button>
              </div>
            ) : (
              <button className="link-btn danger-text" onClick={() => setConfirmDel(true)}>この記入を消す</button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
