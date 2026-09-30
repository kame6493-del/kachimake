import { useEffect } from 'react';
import { signedYen } from './format';

export type Hype = 'jackpot' | 'big' | 'win';

const WORD: Record<Hype, string> = { jackpot: '激アツ!!', big: '大勝!', win: '勝ち!' };
const PARTICLES: Record<Hype, number> = { jackpot: 36, big: 24, win: 14 };

/** 勝ちを記入したときの演出。押すか約1.6秒で消える。動きを減らす設定の端末では粒を出さない */
export function Celebrate({ kind, amount, onDone }: { kind: Hype; amount: number; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, kind === 'jackpot' ? 2200 : 1600);
    return () => window.clearTimeout(t);
  }, [kind, onDone]);

  const n = PARTICLES[kind];
  return (
    <div className={`celebrate ${kind}`} role="status" aria-live="assertive" onClick={onDone}>
      <div className="burst" aria-hidden="true" />
      <div className="particles" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => {
          const angle = (360 / n) * i + (i % 3) * 7;
          const dist = 110 + ((i * 37) % 90);
          return <i key={i} style={{ '--a': `${angle}deg`, '--d': `${dist}px`, '--delay': `${(i % 5) * 40}ms` } as React.CSSProperties} />;
        })}
      </div>
      <div className="celebrate-word">{WORD[kind]}</div>
      <div className="celebrate-amount">{signedYen(amount)}</div>
    </div>
  );
}
