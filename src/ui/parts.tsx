// 1.2.0 の共通部品: 線のアイコン、種目のアイコン(見本から切り出した丸い絵)、画面の見出し、月の切り替え
import type { ReactNode } from 'react';
import type { Kind } from '../domain/types';
import { kindInfo } from '../domain/types';
import { addMonths } from '../domain/data';
import { monthJa } from './format';

const P: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5',
  list: 'M7 3h7l5 5v13H7zM14 3v5h5M10 12h6M10 16h6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2',
  chart: 'M5 20V11M11 20V5M17 20v-7M3 20h18',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  right: 'M9 5l7 7-7 7',
  left: 'M15 5l-7 7 7 7',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5',
  store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  wallet: 'M3 7h16v12H3zM3 7l12-3v3M15 12h4v4h-4z',
  pie: 'M12 3v9h9A9 9 0 1 1 12 3zM15 2.5A8 8 0 0 1 21.5 9H15z',
  target: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1M12 12l8-8M17 4h3v3',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  sort: 'M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4',
  menu: 'M4 7h16M4 12h16M4 17h10',
  bars3: 'M5 20v-6M12 20V9M19 20V4',
  database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  fileDown: 'M6 3h8l4 4v14H6zM14 3v4h4M12 10v7M9 14l3 3 3-3',
  fileUp: 'M6 3h8l4 4v14H6zM14 3v4h4M12 17v-7M9 13l3-3 3 3',
  backup: 'M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 9M12 21v-8M9 16l3-3 3 3',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  text: 'M5 20 12 4l7 16M8 14h8',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1.5-2 0-3h2.5A4.5 4.5 0 0 0 21 11.5C21 6.8 17 3 12 3zM7.5 12a1 1 0 1 0 0 .1M10 8a1 1 0 1 0 0 .1M15 8a1 1 0 1 0 0 .1',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.1',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.1',
  shieldDoc: 'M7 3h7l5 5v13H7zM14 3v5h5',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5v.1',
  memo: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  pencil: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6',
  trendDown: 'M3 7l6 6 4-4 8 8M21 11v6h-6',
  dash: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12h8',
  flame: 'M12 21c-4 0-7-2.7-7-6.5 0-3.5 3-5.5 3.5-9.5 2.5 1.5 3.5 3.5 3.5 5.5 1-1 1.5-2 1.5-3.5 2.5 2 5.5 4.5 5.5 7.5 0 3.8-3 6.5-7 6.5z',
  coins: 'M12 4c4.4 0 8 1.1 8 2.5S16.4 9 12 9 4 7.9 4 6.5 7.6 4 12 4zM4 6.5v4C4 11.9 7.6 13 12 13s8-1.1 8-2.5v-4M4 10.5v4C4 15.9 7.6 17 12 17s8-1.1 8-2.5v-4M4 14.5v3C4 18.9 7.6 20 12 20s8-1.1 8-2.5v-3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  trendUp: 'M3 17l6-6 4 4 8-8M21 13V7h-6',
  counter: 'M5 3h14v18H5zM8 7h8v4H8zM8 15h.1M12 15h.1M16 15h.1M8 18h.1M12 18h.1M16 18h.1',
  check: 'M5 12l5 5L20 7',
  close: 'M6 6l12 12M18 6 6 18',
  game: 'M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.5 1.7L15 14H9l-1.5 1.7A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4zM7 11v3M5.5 12.5h3M15.5 12h.1M17.5 13.5h.1',
  backspace: 'M8 5h12v14H8l-6-7zM11 9l6 6M17 9l-6 6',
  yen: 'M6 4l6 8 6-8M12 12v8M8 13h8M8 16h8',
};

export function Icon({ name, size = 22, className = '' }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg className={`ic ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  );
}

/** 種目の色。見本の「カテゴリ別の上限設定」の丸と同じ */
export const KIND_COLOR: Record<Kind, string> = {
  pachinko: '#4a8ef5', slot: '#9a64ee', keiba: '#3ec084', keirin: '#ee8e3a', boat: '#8d96a8', auto: '#d7b23c', other: '#4fb3c4',
};
const KIND_IMG: Partial<Record<Kind, string>> = {
  pachinko: './img/kind_pachinko.png', slot: './img/kind_slot.png', keiba: './img/kind_keiba.png', keirin: './img/kind_keirin.png', boat: './img/kind_boat.png',
};
/** 選ぶボタン・表の短い名前(ボートレース→ボート) */
export const kindShort = (k: Kind) => kindInfo(k).label.replace('レース', '');

/** 種目の丸いアイコン。絵の無いオート・その他は色の丸に1文字 */
export function KindIcon({ kind, size = 28 }: { kind: Kind; size?: number }) {
  const src = KIND_IMG[kind];
  if (src) return <img className="kind-ic" src={src} width={size} height={size} alt="" />;
  return (
    <span className="kind-ic kind-ic-text" style={{ width: size, height: size, background: KIND_COLOR[kind], fontSize: size * 0.42 }} aria-hidden="true">
      {kindInfo(kind).short}
    </span>
  );
}

export function KindDot({ kind }: { kind: Kind }) {
  return <span className="kind-dot" style={{ background: KIND_COLOR[kind] }} aria-hidden="true" />;
}

/** 画面の見出し: 左にロゴの棒と「カチマケ」、下に一言。右に月の切り替えなど */
export function BrandHead({ sub, right }: { sub: string; right?: ReactNode }) {
  return (
    <header className="brand-head">
      <img className="brand-logo" src="./img/logo_bars.png" alt="" width={34} height={36} />
      <div className="brand-text">
        <h1>カチマケ</h1>
        <p>{sub}</p>
      </div>
      {right && <div className="brand-right">{right}</div>}
    </header>
  );
}

/** 戻る付きの見出し(記録を追加・上限設定など、上に重なる画面) */
export function BackHead({ title, sub, onBack, right, center }: { title: string; sub?: string; onBack: () => void; right?: ReactNode; center?: boolean }) {
  return (
    <header className={`back-head ${center ? 'center' : ''}`}>
      <button className="back-btn" onClick={onBack} aria-label="戻る">
        <Icon name="left" size={26} />{center && <span>戻る</span>}
      </button>
      <div className="back-text">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right ?? (center ? <span className="back-spacer" /> : null)}
    </header>
  );
}

/** 年月と前後の矢印 */
export function MonthPill({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div className="month-pill">
      <Icon name="calendar" size={18} />
      <span className="month-pill-label">{monthJa(month)}</span>
      <button aria-label="前の月" onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" size={18} /></button>
      <button aria-label="次の月" onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" size={18} /></button>
    </div>
  );
}

/** 種目のしぼり込み(すべて+種目)。横に流れる */
export function KindChips({ kinds, value, onChange, allLabel = 'すべて' }: { kinds: Kind[]; value: Kind | 'all'; onChange: (k: Kind | 'all') => void; allLabel?: string }) {
  return (
    <div className="kind-chips" role="radiogroup" aria-label="種目">
      <button role="radio" aria-checked={value === 'all'} className={`kchip ${value === 'all' ? 'on' : ''}`} onClick={() => onChange('all')}>
        <Icon name="layers" size={18} />{allLabel}
      </button>
      {kinds.map((k) => (
        <button key={k} role="radio" aria-checked={value === k} className={`kchip ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>
          <KindIcon kind={k} size={22} />{kindShort(k)}
        </button>
      ))}
    </div>
  );
}

/** 金額: 数字は大きく、円は小さく(見本の「+32,400円」) */
export function Money({ n, signed = true, className = '' }: { n: number; signed?: boolean; className?: string }) {
  const a = Math.abs(Math.round(n)).toLocaleString('ja-JP');
  const sign = !signed ? (n < 0 ? '-' : '') : n > 0 ? '+' : n < 0 ? '-' : '±';
  const tone = !signed ? '' : n > 0 ? 'plus' : n < 0 ? 'minus' : 'zero';
  return <span className={`money ${tone} ${className}`}>{sign}{a}<small>円</small></span>;
}

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button className={`sw ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={onClick}>
      <span className="sw-knob" aria-hidden="true" />
    </button>
  );
}
