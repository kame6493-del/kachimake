/**
 * App Review 用の画面録画で流す自動操作。VITE_REVIEW_TOUR=1 で作ったビルドだけで動く(製品版には入らない)。
 * 持ち主が iPhone を持っていないので、CI のシミュレーターでこれを流しながら録画する(.github/workflows/ios-review-video.yml)。
 * 起動 → 勝ちを1件記入(演出)→ 負けを1件記入(競馬)→ カレンダー → 分析(鍵の付いた期間 → 有料プラン)
 * → 小役カウンター → 設定 → 有料プランの購入画面。押した所に赤い丸を出す。広告は待たない・押さない。
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tapMark(el: Element) {
  const r = el.getBoundingClientRect();
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'fixed', left: `${r.left + r.width / 2 - 22}px`, top: `${r.top + r.height / 2 - 22}px`,
    width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(210,64,42,0.35)',
    border: '2px solid rgba(210,64,42,0.8)', zIndex: '99999', pointerEvents: 'none', transition: 'opacity .6s, transform .6s',
  });
  document.body.appendChild(dot);
  requestAnimationFrame(() => { dot.style.transform = 'scale(1.4)'; dot.style.opacity = '0'; });
  setTimeout(() => dot.remove(), 700);
}

const visible = (b: HTMLElement) => b.offsetParent !== null || getComputedStyle(b).position === 'fixed';

async function find(pred: (b: HTMLElement) => boolean, wait = 6000, root: ParentNode = document): Promise<HTMLElement | null> {
  const end = Date.now() + wait;
  while (Date.now() < end) {
    const el = [...root.querySelectorAll<HTMLElement>('button, a')].find((b) => visible(b) && !(b as HTMLButtonElement).disabled && pred(b));
    if (el) return el;
    await sleep(200);
  }
  return null;
}

async function tapEl(el: HTMLElement, pause = 1500) {
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await sleep(500);
  tapMark(el);
  await sleep(250);
  el.click();
  await sleep(pause);
}

async function tap(pred: (b: HTMLElement) => boolean, pause = 1500, root: ParentNode = document) {
  const el = await find(pred, 6000, root);
  if (!el) return false;
  await tapEl(el, pause);
  return true;
}

const norm = (s: string) => s.replace(/\s+/g, '');
const text = (s: string) => (b: HTMLElement) => norm(b.innerText).includes(norm(s));
const exact = (s: string) => (b: HTMLElement) => norm(b.innerText) === norm(s);
const label = (s: string) => (b: HTMLElement) => b.getAttribute('aria-label') === s;

/** React の入力欄に1文字ずつ打つ(値の setter を通して input を起こす) */
async function type(input: HTMLInputElement | null, value: string) {
  if (!input) return;
  input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await sleep(500);
  tapMark(input);
  input.focus();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  for (let i = 1; i <= value.length; i++) {
    set.call(input, value.slice(0, i));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(140);
  }
  input.blur();
  await sleep(600);
}

const sheet = () => document.querySelector<HTMLElement>('.sheet');

async function scrollEl(el: HTMLElement | Window, to: number, ms = 1600) {
  const from = el === window ? window.scrollY : (el as HTMLElement).scrollTop;
  const steps = 30;
  for (let k = 1; k <= steps; k++) {
    const y = from + ((to - from) * k) / steps;
    if (el === window) window.scrollTo(0, y); else (el as HTMLElement).scrollTop = y;
    await sleep(ms / steps);
  }
}

/** 開いているシートの中身を下まで見せる */
async function scrollSheet(ms = 2200) {
  const body = document.querySelector<HTMLElement>('.sheet .sheet-body') ?? sheet();
  if (!body) return;
  const box = body.scrollHeight > body.clientHeight ? body : sheet()!;
  await scrollEl(box, box.scrollHeight, ms);
}

/** 3回目の記入の後などに案内の有料プランが開いていたら「あとで」で閉じる */
async function closePaywallIfOpen() {
  const pw = document.querySelector<HTMLElement>('.sheet.paywall');
  if (pw) await tap((b) => exact('あとで')(b) || exact('閉じる')(b), 1200, pw);
}

/** 1件記入する */
async function writeEntry(kind: string, invest: number[], payout: number[], place: string, target: string) {
  if (!(await tap(label('収支を記入'), 1500))) await tap(exact('記入'), 1500);
  const s = sheet();
  if (!s) return;
  await tap(exact(kind), 900, s);
  const fields = [...s.querySelectorAll<HTMLElement>('.field')].filter((f) => f.querySelector('.steps'));
  const [inv, pay] = fields;
  for (const n of invest) await tap(exact(`+${n.toLocaleString()}`), 600, inv);
  for (const n of payout) await tap(exact(`+${n.toLocaleString()}`), 600, pay);
  await type(s.querySelector<HTMLInputElement>('input[list="dl-place"]'), place);
  await type(s.querySelector<HTMLInputElement>('input[list="dl-target"]'), target);
  const hours = s.querySelector<HTMLInputElement>('input[aria-label="時間"]');
  await type(hours, '3');
  await scrollEl(s.querySelector<HTMLElement>('.sheet-body') ?? s, 0, 800);
  await tap(exact('記入する'), 2600, s);
}

export async function runReviewTour() {
  // 起動直後のカレンダーを見せる(iOS ではこの間に広告のトラッキング許可のダイアログが出ることがある)
  await sleep(9000);

  // 1件目: パチンコで勝ち(投資 ¥10,000 → 回収 ¥25,000)。「大勝!」の演出が出る
  await writeEntry('パチンコ', [10000], [10000, 10000, 5000], '駅前店', '海物語');
  await sleep(2500);
  // 2件目: 競馬で負け(購入 ¥6,000 → 払戻 ¥0)
  await writeEntry('競馬', [5000, 1000], [], '東京競馬場', '11R');
  await sleep(1500);
  await closePaywallIfOpen();

  // カレンダーの日を押して記入を見せる
  await scrollEl(window, 600, 1500); await sleep(1500); await scrollEl(window, 0, 1000);

  // 分析(今月は無料)→ 鍵の付いた期間「3か月」で有料プランの案内
  await tap(text('分析'), 2500, document.querySelector('.tabbar') ?? document);
  await scrollEl(window, document.body.scrollHeight, 2500); await sleep(1500); await scrollEl(window, 0, 1200);
  if (await tap(exact('3か月'), 2500)) {
    await scrollSheet(1800); await sleep(1500);
    await closePaywallIfOpen();
  }

  // 小役カウンター
  await tap(text('カウンター'), 2000, document.querySelector('.tabbar') ?? document);
  for (let i = 0; i < 3; i++) await tap(exact('+100'), 500);
  const items = [...document.querySelectorAll<HTMLElement>('.counter-tap')];
  for (const k of [0, 0, 1, 0, 1]) if (items[k]) await tapEl(items[k], 450);
  await scrollEl(window, document.body.scrollHeight, 1500); await sleep(1500); await scrollEl(window, 0, 800);

  // 設定 → 有料プラン → 内容と料金を見る(購入画面)
  await tap(text('設定'), 2500, document.querySelector('.tabbar') ?? document);
  await tap(text('内容と料金を見る'), 3500);
  await scrollSheet(2500);
  await sleep(2500);
  // 購入ボタン(シミュレーターでストアの商品が取れたときだけ押せる)。広告を見るボタンは押さない
  const pw = document.querySelector<HTMLElement>('.sheet.paywall');
  if (pw) await tap((b) => b.classList.contains('btn') && b.classList.contains('wide'), 8000, pw);
  await sleep(8000);
}
