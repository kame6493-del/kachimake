import { useEffect, useMemo, useRef, useState } from 'react';
import { shortYen, signedEn as signedYen, monthJa, dateJa } from './format';

const H = 180;
const PAD = { l: 48, r: 12, t: 12, b: 24 };

/** 置き場所の実際の幅を測る。図を拡大縮小せず、その幅で描き直すため(文字の大きさがどの画面でも同じになる) */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 0.5) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v));
  return out;
}

/** 累計収支の折れ線。0 より上を勝ち色、下を負け色で塗る */
export function CumulativeChart({ points }: { points: { date: string; total: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth<HTMLElement>();
  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const vals = points.map((p) => p.total);
    const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
    const min = ticks[0], max = ticks[ticks.length - 1];
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v: number) => PAD.t + (1 - (v - min) / (max - min || 1)) * ih;
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join('');
    const area = `${line}L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
    return { ticks, x, y, line, area, zero: y(0) };
  }, [points, W]);

  if (!geo) return <figure className="chart" ref={box}><div className="chart-empty">記入すると、ここに累計の推移が出ます</div></figure>;
  const last = points[points.length - 1];
  const sel = hover != null ? points[hover] : last;
  const id = `clip${points.length}`;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const iw = W - PAD.l - PAD.r;
    const i = Math.round(((px - PAD.l) / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <figure className="chart" ref={box}>
      <figcaption className="chart-cap">
        <span>{hover != null ? dateJa(sel.date) : '最後の記入の時点'}</span>
        <strong className={sel.total >= 0 ? 'plus' : 'minus'}>{signedYen(sel.total)}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`累計収支 ${signedYen(last.total)}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove}>
        <defs>
          <clipPath id={`${id}a`}><rect x="0" y="0" width={W} height={geo.zero} /></clipPath>
          <clipPath id={`${id}b`}><rect x="0" y={geo.zero} width={W} height={H - geo.zero} /></clipPath>
        </defs>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
            <text x={PAD.l - 6} y={geo.y(t) + 3.5} className="tick" textAnchor="end">{shortYen(t)}</text>
          </g>
        ))}
        {/* 深緑の地に赤を半透明で重ねると茶色になるので、負けの側は面を塗らず、線の色で分ける */}
        <path d={geo.area} className="area-plus" clipPath={`url(#${id}a)`} />
        <path d={geo.line} className="line line-plus" fill="none" clipPath={`url(#${id}a)`} />
        <path d={geo.line} className="line line-minus" fill="none" clipPath={`url(#${id}b)`} />
        {hover != null && (
          <g>
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={H - PAD.b} className="cursor" />
            <circle cx={geo.x(hover)} cy={geo.y(points[hover].total)} r="4" className="dot" />
          </g>
        )}
        <text x={PAD.l} y={H - 6} className="tick">{dateJa(points[0].date)}</text>
        {points.length > 1 && <text x={W - PAD.r} y={H - 6} className="tick" textAnchor="end">{dateJa(last.date)}</text>}
      </svg>
    </figure>
  );
}

/** 月ごとの収支の棒 */
export function MonthlyBars({ rows }: { rows: { month: string; profit: number }[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const [box, W] = useWidth<HTMLElement>();
  if (rows.length === 0) return <figure className="chart" ref={box}><div className="chart-empty">まだ記入がありません</div></figure>;
  const vals = rows.map((r) => r.profit);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const min = ticks[0], max = ticks[ticks.length - 1];
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min || 1)) * ih;
  const slot = iw / rows.length;
  const bw = Math.min(26, slot * 0.7);
  const cur = sel != null ? rows[sel] : null;
  return (
    <figure className="chart" ref={box}>
      <figcaption className="chart-cap">
        <span>{cur ? monthJa(cur.month) : '棒を押すと金額が出ます'}</span>
        {cur && <strong className={cur.profit >= 0 ? 'plus' : 'minus'}>{signedYen(cur.profit)}</strong>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="月ごとの収支">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
            <text x={PAD.l - 6} y={y(t) + 3.5} className="tick" textAnchor="end">{shortYen(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          const top = Math.min(y(r.profit), y(0));
          const h = Math.max(1, Math.abs(y(r.profit) - y(0)));
          return (
            <g key={r.month} onPointerDown={() => setSel(i === sel ? null : i)} style={{ cursor: 'pointer' }}>
              <rect x={cx - slot / 2} y={PAD.t} width={slot} height={ih} fill="transparent" />
              <rect x={cx - bw / 2} y={top} width={bw} height={h} rx="3"
                className={`${r.profit >= 0 ? 'bar-plus' : 'bar-minus'}${sel === i ? ' bar-sel' : ''}`} />
              {(rows.length <= 12 || i % Math.ceil(rows.length / 12) === 0) && (
                <text x={cx} y={H - 6} className="tick" textAnchor="middle">{Number(r.month.slice(5))}月</text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** ホームの「月別収支の推移」: 小さな置き場所に収まる棒。0 の線の上が勝ち、下が負け */
export function CompactBars({ rows, height = 190 }: { rows: { label: string; value: number }[]; height?: number }) {
  const [box, W] = useWidth<HTMLDivElement>();
  const vals = rows.map((r) => r.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals, 1), 3);
  const min = ticks[0], max = ticks[ticks.length - 1];
  const L = 40, R = 6, T = 8, B = 22;
  const w = Math.max(160, W);
  const iw = w - L - R, ih = height - T - B;
  const y = (v: number) => T + (1 - (v - min) / (max - min || 1)) * ih;
  const slot = iw / Math.max(1, rows.length);
  const bw = Math.min(22, slot * 0.58);
  return (
    <div className="cbars" ref={box}>
      <svg viewBox={`0 0 ${w} ${height}`} width={w} height={height} role="img" aria-label="月別収支の推移">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
            <text x={L - 6} y={y(t) + 3.5} className="tick" textAnchor="end">{manYenTick(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = L + slot * i + slot / 2;
          const top = Math.min(y(r.value), y(0));
          const h = r.value === 0 ? 0 : Math.max(2, Math.abs(y(r.value) - y(0)));
          return (
            <g key={r.label + i}>
              <line x1={cx} x2={cx} y1={T} y2={T + ih} className="grid v" />
              {h > 0 && <rect x={cx - bw / 2} y={top} width={bw} height={h} rx="2" className={r.value >= 0 ? 'bar-plus' : 'bar-minus'} />}
              <text x={cx} y={height - 6} className="tick" textAnchor="middle">{r.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
const manYenTick = (n: number) => (n === 0 ? '0' : Math.abs(n) >= 10000 ? `${n / 10000}万` : n.toLocaleString('ja-JP'));

/** ドーナツ。parts の value の割合で輪を分ける */
export function Donut({ parts, size = 132, stroke = 18, children }: { parts: { color: string; value: number }[]; size?: number; stroke?: number; children?: React.ReactNode }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="donut-track" strokeWidth={stroke} />
        {total > 0 && parts.filter((p) => p.value > 0).map((p, i) => {
          const len = (p.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: p.color }} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="donut-center">{children}</div>
    </div>
  );
}

/** 見本 01・04 の「収支の推移」: 点つきの折れ線。0 より上は勝ちの色、下は負けの色で、線と面を分ける。
 *  slots はよこの目盛りの数(1か月なら日数)、points は値のある所だけ */
export function DotLine({ slots, points, ticks, height = 190 }: { slots: number; points: { i: number; v: number }[]; ticks: { i: number; label: string }[]; height?: number }) {
  const [box, W] = useWidth<HTMLDivElement>();
  const w = Math.max(240, W);
  const L = 50, R = 10, T = 10, B = 24;
  const iw = w - L - R, ih = height - T - B;
  const vals = points.map((p) => p.v);
  const yt = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals, 1), 4);
  const min = yt[0], max = yt[yt.length - 1];
  const x = (i: number) => L + (slots <= 1 ? iw / 2 : (i / (slots - 1)) * iw);
  const y = (v: number) => T + (1 - (v - min) / (max - min || 1)) * ih;
  const z = y(0);
  const line = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = points.length ? `${line}L${x(points[points.length - 1].i).toFixed(1)},${z.toFixed(1)}L${x(points[0].i).toFixed(1)},${z.toFixed(1)}Z` : '';
  const id = `dl${slots}-${points.length}-${Math.round(z)}`;
  return (
    <div className="dline" ref={box}>
      {points.length === 0 ? <div className="chart-empty">この期間の記録はありません</div> : (
        <svg viewBox={`0 0 ${w} ${height}`} width={w} height={height} role="img" aria-label="収支の推移">
          <defs>
            <clipPath id={`${id}a`}><rect x="0" y="0" width={w} height={z} /></clipPath>
            <clipPath id={`${id}b`}><rect x="0" y={z} width={w} height={height - z} /></clipPath>
            <linearGradient id={`${id}g`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--win)" stopOpacity="0.32" /><stop offset="1" stopColor="var(--win)" stopOpacity="0.02" /></linearGradient>
            <linearGradient id={`${id}r`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--minus)" stopOpacity="0.04" /><stop offset="1" stopColor="var(--minus)" stopOpacity="0.36" /></linearGradient>
          </defs>
          {yt.map((t) => (
            <g key={t}>
              <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
              <text x={L - 6} y={y(t) + 4} className="tick" textAnchor="end">{t.toLocaleString('ja-JP')}</text>
            </g>
          ))}
          {ticks.map((t) => (
            <g key={t.i}>
              <line x1={x(t.i)} x2={x(t.i)} y1={T} y2={T + ih} className="grid v" />
              <text x={x(t.i)} y={height - 6} className="tick" textAnchor={t.i >= slots - 1 && slots > 1 ? 'end' : 'middle'}>{t.label}</text>
            </g>
          ))}
          <line x1={L} x2={L} y1={T} y2={T + ih} className="axis-zero" />
          <path d={area} fill={`url(#${id}g)`} clipPath={`url(#${id}a)`} />
          <path d={area} fill={`url(#${id}r)`} clipPath={`url(#${id}b)`} />
          <path d={line} className="dl-line plus" fill="none" clipPath={`url(#${id}a)`} />
          <path d={line} className="dl-line minus" fill="none" clipPath={`url(#${id}b)`} />
          {points.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="3.6" className={`dl-dot ${p.v >= 0 ? 'plus' : 'minus'}`} />)}
        </svg>
      )}
    </div>
  );
}

/** 見本 04 の「種目別 収支比較」「曜日別 収支」: 0 の線から上下に伸びる棒。下に名前(と絵) */
export function SignedBars({ rows, height = 170, color }: { rows: { label: string; value: number; icon?: React.ReactNode }[]; height?: number; color?: 'gold' }) {
  const [box, W] = useWidth<HTMLDivElement>();
  const w = Math.max(200, W);
  const L = 50, R = 6, T = 8, B = rows.some((r) => r.icon) ? 6 : 22;
  const iw = w - L - R, ih = height - T - B;
  const vals = rows.map((r) => r.value);
  const yt = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals, 1), 4);
  const min = yt[0], max = yt[yt.length - 1];
  const y = (v: number) => T + (1 - (v - min) / (max - min || 1)) * ih;
  const slot = iw / Math.max(1, rows.length);
  const bw = Math.min(30, slot * 0.55);
  return (
    <div className="sbars" ref={box}>
      <svg viewBox={`0 0 ${w} ${height}`} width={w} height={height} role="img" aria-label={rows.map((r) => `${r.label} ${r.value.toLocaleString('ja-JP')}円`).join('、')}>
        {yt.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
            <text x={L - 6} y={y(t) + 4} className="tick" textAnchor="end">{t.toLocaleString('ja-JP')}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = L + slot * i + slot / 2;
          const h = r.value === 0 ? 0 : Math.max(2, Math.abs(y(r.value) - y(0)));
          return (
            <g key={r.label}>
              <line x1={L + slot * (i + 1)} x2={L + slot * (i + 1)} y1={T} y2={T + ih} className="grid v" />
              {h > 0 && <rect x={cx - bw / 2} y={Math.min(y(r.value), y(0))} width={bw} height={h} className={color === 'gold' ? 'bar-gold' : r.value >= 0 ? 'bar-plus' : 'bar-minus'} />}
              {!r.icon && <text x={cx} y={height - 5} className="tick" textAnchor="middle">{r.label}</text>}
            </g>
          );
        })}
      </svg>
      {rows.some((r) => r.icon) && (
        <div className="sbars-labels" style={{ paddingLeft: L, paddingRight: R }}>
          {rows.map((r) => <span key={r.label}>{r.icon}<small>{r.label}</small></span>)}
        </div>
      )}
    </div>
  );
}
