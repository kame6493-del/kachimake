import { useMemo, useState } from 'react';
import { BET_TYPES, DEFAULT_TAGS, KINDS, RATES, type Kind, type Session } from '../domain/types';
import { newId } from '../domain/data';
import { ballsToYen, frequent, latest, stock, usedTags } from '../domain/stats';
import { signedYen, tone, yen } from './format';

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
const unit = (k: Kind) => (k === 'slot' ? '枚' : '玉');
const rateText = (r: number) => `${r}円`;

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

function BallField({ label, value, onChange, u, rate }: { label: string; value: string; onChange: (v: string) => void; u: string; rate: number }) {
  return (
    <label className="field ball-field">
      <span className="field-label">{label}</span>
      <span className="yen-input">
        <input inputMode="numeric" placeholder="0" value={fmt(value)} onChange={(e) => onChange(digits(e.target.value).slice(0, 7))} />
        <span className="ball-unit">{u}</span>
      </span>
      <span className="note">{toNum(value) > 0 ? `円にすると ${yen(ballsToYen(toNum(value), rate))}` : ' '}</span>
    </label>
  );
}

/** 名前の候補をボタンで出す。スマホの入力候補の一覧は押しにくいため */
function Chips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="chips">
      {items.map((x) => <button type="button" key={x} className={`chip ${x === value ? 'on' : ''}`} onClick={() => onPick(x === value ? '' : x)}>{x}</button>)}
    </div>
  );
}

export function SessionForm({ initial, date, history, lastKind, onSave, onDelete, onClose }: Props) {
  const initRate = initial?.rate ?? 0;
  const [d, setD] = useState(initial?.date ?? date);
  const [kind, setKind] = useState<Kind>(initial?.kind ?? lastKind);
  const [place, setPlace] = useState(initial?.place ?? '');
  const [target, setTarget] = useState(initial?.target ?? '');
  // 投資・回収の欄は現金だけ。貯玉の分は下の欄で足す
  const [invest, setInvest] = useState(initial ? String(initial.invest - ballsToYen(initial.replay ?? 0, initRate) || '') : '');
  const [payout, setPayout] = useState(initial ? String(initial.payout - ballsToYen(initial.saved ?? 0, initRate) || '') : '');
  const [rate, setRate] = useState<number>(initRate);
  const [useBalls, setUseBalls] = useState(!!(initial?.replay || initial?.saved));
  const [replay, setReplay] = useState(initial?.replay ? String(initial.replay) : '');
  const [saved, setSaved] = useState(initial?.saved ? String(initial.saved) : '');
  const [h, setH] = useState(initial ? String(Math.floor(initial.minutes / 60) || '') : '');
  const [mi, setMi] = useState(initial ? String(initial.minutes % 60 || '') : '');
  const [betType, setBetType] = useState(initial?.betType ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [newTag, setNewTag] = useState('');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [confirmDel, setConfirmDel] = useState(false);

  const isRace = RACE.includes(kind);
  const isHall = kind === 'pachinko' || kind === 'slot';
  const rates = isHall ? RATES[kind] : [];
  const effRate = isHall ? (rate || rates[0]) : 0;

  // 同じ種類で過去に使った名前を、よく使う順に候補として出す
  const suggest = useMemo(() => {
    const count = (key: 'place' | 'target') => {
      const m = new Map<string, number>();
      for (const s of history) if (s.kind === kind && s[key]) m.set(s[key], (m.get(s[key]) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 30);
    };
    return { place: count('place'), target: count('target'), placeChips: frequent(history, kind, 'place'), targetChips: frequent(history, kind, 'target') };
  }, [history, kind]);
  const tagChoices = useMemo(() => [...new Set([...usedTags(history), ...DEFAULT_TAGS, ...tags])].slice(0, 14), [history, tags]);
  const last = useMemo(() => (initial ? null : latest(history)), [history, initial]);
  // この店の貯玉(直している記入の分は除いて数える)
  const stockHere = useMemo(() => {
    if (!isHall || !place.trim()) return null;
    const others = history.filter((s) => s.id !== initial?.id);
    return stock(others).find((r) => r.kind === kind && r.place === place.trim()) ?? null;
  }, [history, initial, isHall, kind, place]);

  const investYen = toNum(invest) + (isHall && useBalls ? ballsToYen(toNum(replay), effRate) : 0);
  const payoutYen = toNum(payout) + (isHall && useBalls ? ballsToYen(toNum(saved), effRate) : 0);
  const p = payoutYen - investYen;
  const minutes = Math.min(24 * 60, toNum(h) * 60 + toNum(mi));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(d) && (investYen > 0 || payoutYen > 0);

  const copyLast = () => {
    if (!last) return;
    setKind(last.kind);
    setPlace(last.place);
    setTarget(last.target);
    setBetType(last.betType ?? '');
    setRate(last.rate ?? 0);
  };
  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(0, 10)));
  const addTag = () => {
    const t = newTag.trim().slice(0, 20);
    if (t && !tags.includes(t)) setTags([...tags, t].slice(0, 10));
    setNewTag('');
  };

  const save = () => {
    if (!valid) return;
    const now = Date.now();
    const balls = isHall && useBalls;
    onSave({
      id: initial?.id ?? newId(),
      date: d,
      kind,
      place: place.trim().slice(0, 80),
      target: target.trim().slice(0, 80),
      invest: investYen,
      payout: payoutYen,
      minutes,
      betType: isRace && betType ? betType : undefined,
      memo: memo.trim().slice(0, 1000),
      rate: isHall && (rate || balls) ? effRate : undefined,
      replay: balls && toNum(replay) > 0 ? toNum(replay) : undefined,
      saved: balls && toNum(saved) > 0 ? toNum(saved) : undefined,
      tags: tags.length ? tags : undefined,
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
          {last && (
            <button type="button" className="copy-last" onClick={copyLast}>
              <span>前回と同じ</span>
              <small>{[KINDS.find((k) => k.id === last.kind)?.label, last.place, last.target].filter(Boolean).join('・')}</small>
            </button>
          )}

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

          {isHall && (
            <div className="field">
              <span className="field-label">レート(1{unit(kind)}あたり)</span>
              <div className="opts">
                {rates.map((r) => (
                  <button type="button" key={r} aria-pressed={effRate === r} className={`opt ${effRate === r ? 'on' : ''}`} onClick={() => setRate(r)}>{rateText(r)}</button>
                ))}
              </div>
            </div>
          )}

          <AmountField label={isRace ? '購入額' : isHall && useBalls ? '投資(現金)' : '投資'} value={invest} onChange={setInvest} />
          <AmountField label={isRace ? '払戻' : isHall && useBalls ? '回収(換金した額)' : '回収'} value={payout} onChange={setPayout} />

          {isHall && (
            <div className="balls">
              <button type="button" className="balls-toggle" aria-expanded={useBalls} onClick={() => setUseBalls(!useBalls)}>
                <span>貯{unit(kind) === '玉' ? '玉' : 'メダル'}を使った・貯めた</span>
                <span aria-hidden="true">{useBalls ? '−' : '+'}</span>
              </button>
              {stockHere && stockHere.count !== 0 && (
                <p className="note">この店の{kind === 'slot' ? '貯メダル' : '貯玉'} {stockHere.count.toLocaleString('ja-JP')}{unit(kind)}(約{yen(ballsToYen(stockHere.count, stockHere.rate ?? effRate))})</p>
              )}
              {useBalls && (
                <div className="ball-grid">
                  <BallField label={`再プレイした${unit(kind)}`} value={replay} onChange={setReplay} u={unit(kind)} rate={effRate} />
                  <BallField label={`貯${unit(kind) === '玉' ? '玉' : 'メダル'}にした${unit(kind)}`} value={saved} onChange={setSaved} u={unit(kind)} rate={effRate} />
                </div>
              )}
            </div>
          )}

          <div className="result" aria-live="polite">
            <span>収支{isHall && useBalls && (toNum(replay) > 0 || toNum(saved) > 0) ? '(玉も円にして計算)' : ''}</span>
            <strong className={`amount ${tone(p)}`}>{signedYen(p)}</strong>
          </div>
          {!valid && investYen === 0 && payoutYen === 0 && <p className="note">投資か回収のどちらかを入れると記入できます</p>}

          <div className="field">
            <label className="field">
              <span className="field-label">{isRace ? '場' : '店舗'}</span>
              <input list="dl-place" value={place} placeholder={isRace ? '例: 東京競馬場' : '例: 駅前店'} onChange={(e) => setPlace(e.target.value)} />
            </label>
            <datalist id="dl-place">{suggest.place.map((x) => <option key={x} value={x} />)}</datalist>
            <Chips items={suggest.placeChips} value={place} onPick={setPlace} />
          </div>

          <div className="field">
            <label className="field">
              <span className="field-label">{isRace ? 'レース' : '機種'}</span>
              <input list="dl-target" value={target} placeholder={isRace ? '例: 11R 天皇賞' : '例: 機種名'} onChange={(e) => setTarget(e.target.value)} />
            </label>
            <datalist id="dl-target">{suggest.target.map((x) => <option key={x} value={x} />)}</datalist>
            <Chips items={suggest.targetChips} value={target} onPick={setTarget} />
          </div>

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

          <div className="field">
            <span className="field-label">印(イベント日など。分析で印ごとの収支が見られます)</span>
            <div className="chips">
              {tagChoices.map((t) => (
                <button type="button" key={t} aria-pressed={tags.includes(t)} className={`chip ${tags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}>{t}</button>
              ))}
            </div>
            <div className="inline nowrap">
              <input value={newTag} maxLength={20} placeholder="印を足す(例: 7のつく日)" aria-label="新しい印"
                onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              <button type="button" className="btn-line" disabled={!newTag.trim()} onClick={addTag}>足す</button>
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
