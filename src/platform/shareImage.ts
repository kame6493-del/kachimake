import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { signedYen } from '../ui/format';

/** シェア画像に載せる中身 */
export interface ShareCard {
  /** 上の小さい見出し(例: 2026年9月の収支 / 9月24日 パチスロ) */
  head: string;
  amount: number;
  /** 大きな金額の上に出す一言(例: 激アツ!! / 勝ち組) */
  badge?: string;
  /** 金額の下の行(例: 12勝8敗・回収率 118%) */
  lines: string[];
  /** 金額を隠す(「+¥」だけ見せる人向け) */
  hideAmount?: boolean;
}

const W = 1080;
const H = 1350;
const FONT = '"Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", Meiryo, sans-serif';

/** 黄色の地に黒い太字。アプリ名を下に入れて、見た人が探せるようにする */
export function drawCard(card: ShareCard): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const plus = card.amount > 0;

  g.fillStyle = '#f9b712';
  g.fillRect(0, 0, W, H);
  // 放射の線(勝ちのときだけ)
  if (plus) {
    g.save();
    g.translate(W / 2, 560);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 24; i++) {
      g.rotate((Math.PI * 2) / 24);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-60, -1100);
      g.lineTo(60, -1100);
      g.closePath();
      if (i % 2 === 0) g.fill();
    }
    g.restore();
  }

  // 白いまとまり
  const x = 70, y = 250, w = W - 140, h = 640;
  g.fillStyle = '#ffffff';
  roundRect(g, x, y, w, h, 36);
  g.fill();

  g.textAlign = 'center';
  g.fillStyle = '#1c1c1e';
  g.font = `800 60px ${FONT}`;
  g.fillText(fit(g, card.head, W - 160), W / 2, 170);

  if (card.badge) {
    g.font = `900 52px ${FONT}`;
    const bw = g.measureText(card.badge).width + 64;
    g.fillStyle = plus ? '#1c1c1e' : '#8a8a8f';
    roundRect(g, (W - bw) / 2, y + 60, bw, 84, 42);
    g.fill();
    g.fillStyle = '#f9b712';
    g.fillText(card.badge, W / 2, y + 122);
  }

  const amountText = card.hideAmount ? (plus ? '+¥ ???' : card.amount < 0 ? '-¥ ???' : '±¥0') : signedYen(card.amount);
  g.fillStyle = plus ? '#1f7cf0' : card.amount < 0 ? '#f0383b' : '#8a8a8f';
  let size = 190;
  g.font = `900 ${size}px ${FONT}`;
  while (g.measureText(amountText).width > w - 80 && size > 80) {
    size -= 6;
    g.font = `900 ${size}px ${FONT}`;
  }
  g.fillText(amountText, W / 2, y + 250 + size * 0.75);

  g.fillStyle = '#48484a';
  g.font = `700 46px ${FONT}`;
  card.lines.slice(0, 2).forEach((l, i) => g.fillText(fit(g, l, w - 80), W / 2, y + 520 + i * 64));

  // 下: アプリ名
  g.fillStyle = '#1c1c1e';
  g.font = `900 92px ${FONT}`;
  g.fillText('カチマケ', W / 2, H - 230);
  g.font = `700 40px ${FONT}`;
  g.fillText('パチンコ・スロット・競馬の収支を30秒で記録', W / 2, H - 160);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.font = `600 32px ${FONT}`;
  g.fillText('#カチマケ', W / 2, H - 100);
  return c;
}

function fit(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export const SHARE_TEXT = '#カチマケ で収支を記録中';

/** 端末では共有シートへ(X・LINE・保存を選べる)。ブラウザでは共有できれば共有、無理ならダウンロード */
export async function shareCard(card: ShareCard): Promise<'shared' | 'saved' | 'failed'> {
  const canvas = drawCard(card);
  const dataUrl = canvas.toDataURL('image/png');
  try {
    if (Capacitor.isNativePlatform()) {
      const name = `kachimake-${Date.now()}.png`;
      const { uri } = await Filesystem.writeFile({ path: name, data: dataUrl.split(',')[1], directory: Directory.Cache });
      await Share.share({ text: SHARE_TEXT, files: [uri] });
      return 'shared';
    }
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'kachimake.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text: SHARE_TEXT });
      return 'shared';
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'kachimake.png';
    a.click();
    return 'saved';
  } catch (e) {
    // 共有シートを閉じただけでも例外になる端末がある
    if (String(e).match(/cancel/i)) return 'shared';
    console.error('[kachimake] share', e);
    return 'failed';
  }
}
