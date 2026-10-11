// 記録を追加・直す(見本 kachi2_ref_02)。保存する記録の形は 1.1.0 と同じ
import { useMemo, useState } from 'react';
import { BET_TYPES, DEFAULT_TAGS, KINDS, RATES, type Kind, type Session } from '../domain/types';
import { newId } from '../domain/data';
import { ballsToYen, frequent, latest, stock, usedTags } from '../domain/stats';
import { en, tone } from './format';
import { BackHead, Icon, KindIcon, kindShort } from './parts';

interface Props {
  initial: Session | null;
  /** 複製するときの元(種目・店・機種・レート・券種・タグを写す) */
  template?: Session | null;
  /** 小役カウンターの「記録に反映」から開いたときの下書き */
  preset?: { kind: Kind; target: string; memo: string };
  date: string;
  history: Session[];
  lastKind: Kind;
  /** cont=true は「保存して続ける」(同じ店・種目のまま次を書く) */
  onSave: (s: Session, cont: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const RACE: Kind[] = ['keiba', 'keirin', 'boat', 'auto'];
const digits = (v: string) => v.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
const toNum = (v: string) => (v ? Number(v) : 0);
const fmt = (v: string) => (v ? Number(v).toLocaleString('ja-JP') : '');
const unit = (k: Kind) => (k === 'slot' ? '枚' : '玉');
type Active = 'invest' | 'payout';

function BallField({ label, value, onChange, u, rate }: { label: string; value: string; onChange: (v: string) => void; u: string; rate: number }) {
  return (
    <label className="field ball-field">
      <span className="field-label">{label}</span>
      <span className="amount-box small">
        <input inputMode="numeric" placeholder="0" value={fmt(value)} onChange={(e) => onChange(digits(e.target.value).slice(0, 7))} />
        <span>{u}</span>
      </span>
      <span className="note">{toNum(value) > 0 ? `円にすると ${en(ballsToYen(toNum(value), rate))}` : ' '}</span>
    </label>
  );
}

/** 名前の候補をボタンで出す。スマホの入力候補の一覧は押しにくいため */
function Chips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="hchips">
      {items.map((x) => (
        <button type="button" key={x} className={`chip ${x === value ? 'on' : ''}`} onClick={() => onPick(x === value ? '' : x)}>
          {x}
        </button>
      ))}
    </div>
  );
}

export function SessionForm({ initial, template, preset, date, history, lastKind, onSave, onDelete, onClose }: Props) {
  const src = initial ?? template ?? null;
  const initRate = src?.rate ?? 0;
  const [d, setD] = useState(initial?.date ?? date);
  const [kind, setKind] = useState<Kind>(src?.kind ?? preset?.kind ?? lastKind);
  const [place, setPlace] = useState(src?.place ?? '');
  const [target, setTarget] = useState(src?.target ?? preset?.target ?? '');
  // 投資・回収の欄は現金だけ。貯玉の分は下の欄で足す
  const [invest, setInvest] = useState(initial ? String(initial.invest - ballsToYen(initial.replay ?? 0, initRate) || '') : '');
  const [payout, setPayout] = useState(initial ? String(initial.payout - ballsToYen(initial.saved ?? 0, initRate) || '') : '');
  const [rate, setRate] = useState<number>(initRate);
  const [useBalls, setUseBalls] = useState(!!(initial?.replay || initial?.saved));
  const [replay, setReplay] = useState(initial?.replay ? String(initial.replay) : '');
  const [saved, setSaved] = useState(initial?.saved ? String(initial.saved) : '');
  const [h, setH] = useState(initial ? String(Math.floor(initial.minutes / 60) || '') : '');
  const [mi, setMi] = useState(initial ? String(initial.minutes % 60 || '') : '');
  const [betType, setBetType] = useState(src?.betType ?? '');
  const [tags, setTags] = useState<string[]>(src?.tags ?? []);
  const [newTag, setNewTag] = useState('');
  const [memo, setMemo] = useState(initial?.memo ?? preset?.memo ?? '');
  const [confirmDel, setConfirmDel] = useState(false);
  const [active, setActive] = useState<Active>('invest');

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
  const last = useMemo(() => (initial || template || preset ? null : latest(history)), [history, initial, template, preset]);
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

  const save = (cont: boolean) => {
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
    }, cont);
  };

  const amountBox = (which: Active, label: string, icon: string, value: string, set: (v: string) => void) => (
    <div className={`card amount-card ${active === which ? 'active' : ''}`}>
      <div className="fc-head"><Icon name={icon} size={24} className="ic-gold" /><span>{label}</span></div>
      <label className="amount-box">
        <input inputMode="numeric" aria-label={label} placeholder="0" value={fmt(value)} onFocus={() => setActive(which)}
          onChange={(e) => set(digits(e.target.value))} />
        <span>円</span>
        {value && <button type="button" className="clear-x" aria-label={`${label}を消す`} onClick={() => set('')}><Icon name="close" size={14} /></button>}
      </label>
      <div className="steps">
        {[1000, 5000, 10000].map((n) => (
          <button type="button" key={n} aria-label={`${label}に${n.toLocaleString('ja-JP')}円足す`} onClick={() => { setActive(which); set(String(toNum(value) + n)); }}>
            {n.toLocaleString('ja-JP')}
          </button>
        ))}
      </div>
    </div>
  );
  const result = investYen === 0 && payoutYen === 0 ? null : p > 0 ? 'win' : p < 0 ? 'lose' : 'draw';

  return (
    <div className="page-layer" role="dialog" aria-modal="true" aria-label={initial ? '記録を直す' : '記録を追加'}>
      <div className="page form-page">
        <BackHead title={initial ? '記録を直す' : '記録を追加'} onBack={onClose} />

        <div className="kind-tiles" role="radiogroup" aria-label="種目">
          {KINDS.map((k) => (
            <button key={k.id} role="radio" aria-checked={kind === k.id} className={`ktile ${kind === k.id ? 'on' : ''}`} onClick={() => setKind(k.id)}>
              <KindIcon kind={k.id} size={30} /><span>{kindShort(k.id)}</span>
            </button>
          ))}
        </div>

        {last && (
          <button type="button" className="copy-last" onClick={copyLast}>
            <Icon name="copy" size={18} />
            <span>前回と同じ</span>
            <small>{[kindShort(last.kind), last.place, last.target].filter(Boolean).join('・')}</small>
          </button>
        )}

        {isHall && (
          <div className="rate-row">
            <span>レート<small>(1{unit(kind)})</small></span>
            <div className="opts">
              {rates.map((r) => (
                <button type="button" key={r} aria-pressed={effRate === r} className={`opt ${effRate === r ? 'on' : ''}`} onClick={() => setRate(r)}>{r}円</button>
              ))}
            </div>
          </div>
        )}

        <div className="form-pair">
          {amountBox('invest', isRace ? '購入額' : isHall && useBalls ? '使った額(現金)' : '使った額', 'wallet', invest, setInvest)}
          {amountBox('payout', isRace ? '払戻' : isHall && useBalls ? '戻った額(換金)' : '戻った額', 'coins', payout, setPayout)}
        </div>

        {isHall && (
          <div className="card balls">
            <button type="button" className="balls-toggle" aria-expanded={useBalls} onClick={() => setUseBalls(!useBalls)}>
              <span>貯{unit(kind) === '玉' ? '玉' : 'メダル'}を使った・貯めた</span>
              <Icon name={useBalls ? 'up' : 'down'} size={18} />
            </button>
            {stockHere && stockHere.count !== 0 && (
              <p className="note">この店の{kind === 'slot' ? '貯メダル' : '貯玉'} {stockHere.count.toLocaleString('ja-JP')}{unit(kind)}(約{en(ballsToYen(stockHere.count, stockHere.rate ?? effRate))})</p>
            )}
            {useBalls && (
              <div className="ball-grid">
                <BallField label={`再プレイした${unit(kind)}`} value={replay} onChange={setReplay} u={unit(kind)} rate={effRate} />
                <BallField label={`貯${unit(kind) === '玉' ? '玉' : 'メダル'}にした${unit(kind)}`} value={saved} onChange={setSaved} u={unit(kind)} rate={effRate} />
              </div>
            )}
          </div>
        )}

        <div className="card result-bar" aria-live="polite">
          <span>今回の収支</span>
          <b className={`money ${tone(p)}`}>{p > 0 ? '+' : p < 0 ? '-' : '±'}{Math.abs(p).toLocaleString('ja-JP')}<small>円</small></b>
        </div>

        <div className="card form-rows">
          <div className="frow">
            <span className="fr-label"><Icon name="building" size={24} />{isRace ? '場' : 'お店・場'}</span>
            <div className="fr-field">
              <input list="dl-place" value={place} placeholder={isRace ? '例: ネット投票' : '例: 駅前の店'} aria-label={isRace ? '場' : 'お店・場'} onChange={(e) => setPlace(e.target.value)} />
              <datalist id="dl-place">{suggest.place.map((x) => <option key={x} value={x} />)}</datalist>
              <Chips items={suggest.placeChips} value={place} onPick={setPlace} />
            </div>
          </div>
          <div className="frow">
            <span className="fr-label"><Icon name="counter" size={24} />{isRace ? 'レース' : '機種・レース'}</span>
            <div className="fr-field">
              <span className="clear-box">
                <input list="dl-target" value={target} placeholder={isRace ? '例: 11R' : '例: 機種名'} aria-label={isRace ? 'レース' : '機種'} onChange={(e) => setTarget(e.target.value)} />
                {target && <button type="button" aria-label="消す" onClick={() => setTarget('')}><Icon name="close" size={16} /></button>}
              </span>
              <datalist id="dl-target">{suggest.target.map((x) => <option key={x} value={x} />)}</datalist>
              <Chips items={suggest.targetChips} value={target} onPick={setTarget} />
            </div>
          </div>
          {isRace && (
            <label className="frow">
              <span className="fr-label"><Icon name="tag" size={24} />券種</span>
              <select value={betType} onChange={(e) => setBetType(e.target.value)}>
                <option value="">(未設定)</option>
                {BET_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          )}
          <label className="frow">
            <span className="fr-label"><Icon name="calendar" size={24} />日付<em className="req">必須</em></span>
            <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
          </label>
          <div className="frow">
            <span className="fr-label"><Icon name="clock" size={24} />{isRace ? '観戦時間' : '遊技時間'}</span>
            <div className="time-row">
              <input inputMode="numeric" aria-label="時間" value={h} placeholder="0" onChange={(e) => setH(digits(e.target.value).slice(0, 2))} /><span>時間</span>
              <input inputMode="numeric" aria-label="分" value={mi} placeholder="0" onChange={(e) => setMi(String(Math.min(59, toNum(digits(e.target.value).slice(0, 2)))).replace(/^0$/, ''))} /><span>分</span>
            </div>
          </div>
          <label className="frow top">
            <span className="fr-label"><Icon name="doc" size={24} />メモ</span>
            <span className="memo-box">
              <textarea rows={3} value={memo} maxLength={1000} placeholder="例) 回転数、朝イチ、イベント日 など" onChange={(e) => setMemo(e.target.value)} />
              <small>{memo.length}/1000</small>
            </span>
          </label>
          <div className="frow">
            <span className="fr-label"><Icon name="trophy" size={24} />結果</span>
            <div className="result-pick" aria-label="結果(金額から自動で決まります)">
              <span className={`rp win ${result === 'win' ? 'on' : ''}`}><Icon name="trophy" size={18} />勝ち</span>
              <span className={`rp lose ${result === 'lose' ? 'on' : ''}`}><Icon name="frown" size={18} />負け</span>
              <span className={`rp draw ${result === 'draw' ? 'on' : ''}`}><Icon name="dash" size={18} />引き分け</span>
            </div>
          </div>
          <div className="frow top">
            <span className="fr-label"><Icon name="tag" size={24} />タグ</span>
            <div className="fr-field">
              <div className="chips">
                {tagChoices.map((t) => (
                  <button type="button" key={t} aria-pressed={tags.includes(t)} className={`chip ${tags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}>{t}</button>
                ))}
              </div>
              <div className="inline nowrap">
                <input value={newTag} maxLength={20} placeholder="タグを足す(例: 7のつく日)" aria-label="新しいタグ"
                  onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                <button type="button" className="btn-line" disabled={!newTag.trim()} onClick={addTag}>足す</button>
              </div>
              <small className="note">あとから見返しやすくするためのタグです(複数選択できます)</small>
            </div>
          </div>
        </div>

        <div className="card local-note">
          <Icon name="shield" size={28} className="ic-blue-soft" />
          <p>この記録はお使いの端末の中にだけ保存されます。<br /><small>サーバーには送られず、ほかの端末からは見られません。</small></p>
        </div>

        {!valid && investYen === 0 && payoutYen === 0 && <p className="note center">使った額か戻った額のどちらかを入れると保存できます</p>}

        {initial && (
          confirmDel ? (
            <div className="danger-row">
              <span>この記録を消しますか?</span>
              <button className="danger" onClick={() => onDelete(initial.id)}>消す</button>
              <button className="link-btn" onClick={() => setConfirmDel(false)}>やめる</button>
            </div>
          ) : (
            <button className="link-btn danger-text center-block" onClick={() => setConfirmDel(true)}>この記録を消す</button>
          )
        )}
      </div>
      <div className="save-bar">
        {!initial && <button className="btn-outline-gold" disabled={!valid} onClick={() => save(true)}>保存して続ける</button>}
        <button className="btn-gold" disabled={!valid} onClick={() => save(false)}>{initial ? '直して保存' : '保存'}</button>
      </div>
    </div>
  );
}
