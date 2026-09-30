import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

if (import.meta.env.DEV) {
  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') (await import('./dev/demo')).installDemo(params);
  // シェア画像の見た目を確かめる: ?card=month / win / lose
  const card = params.get('card');
  if (card) {
    const { drawCard } = await import('./platform/shareImage');
    const c = drawCard(card === 'win'
      ? { head: '9月24日(木) パチスロ', amount: 46600, badge: '大勝!', lines: ['ジャグラー / 駅前ホール', '投資 ¥12,000 → 回収 ¥58,600'] }
      : card === 'lose'
        ? { head: '2026年8月の収支', amount: -38200, badge: '修行中', lines: ['7勝11敗・回収率 81%', '18回の記入'] }
        : { head: '2026年9月の収支', amount: 51600, badge: '勝ち組', lines: ['6勝6敗・回収率 139%', 'いま5連勝中'] });
    c.style.cssText = 'width:390px;display:block';
    document.body.replaceChildren(c);
    throw new Error('card only');
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
