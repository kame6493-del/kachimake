"""見た目を、売れている収支アプリ(MAXBET)の作りに寄せる。2026-09-30 持ち主の指示「背景が見づらい。一番売れているアプリを参考に、その感じに」。
寄せるのは配色・並べ方の型だけ。ロゴ・名前・画像・文章は写さない。
- 明るい灰色の地に白いまとまり(iOS の設定画面の形)。上に黄色の帯。勝ちは青、負けは赤。右下に黄色の丸い「+」。下のタブはアイコン付き。
- 端末がダークモードなら黒い地にする(MAXBET にもある)。
- 記入時の演出・称号・連勝・「激」は残す(パチンコ・競馬の人が喜ぶ部分)。
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

css_path = ROOT / 'src/index.css'
s = css_path.read_text(encoding='utf-8')

# 1) 色の変数
s = re.sub(r"  --paper: #0b2118;.*?--gold-grad: [^\n]*\n", """  --paper: #f2f2f7;
  --surface: #ffffff;
  --ink: #1c1c1e;
  --vermilion: #f0383b;
  --sumi-2: #8a8a8f;
  --rule: #e3e3e8;
  --field: #f2f2f7;
  --win: #1f7cf0;
  --accent: #f9b712;
  --accent-ink: #2b2100;
""", s, count=1, flags=re.S)
s = s.replace('  color-scheme: dark;\n', '  color-scheme: light;\n', 1)
s = s.replace("/* 金と赤の区別が苦手な人向け */\n.win-blue { --win: #7fb2ff; }\n", """@media (prefers-color-scheme: dark) {
  :root {
    --paper: #000000; --surface: #1c1c1e; --ink: #f2f2f7; --vermilion: #ff5047; --sumi-2: #98989e;
    --rule: #38383a; --field: #2c2c2e; --win: #4a9dff; color-scheme: dark;
  }
}
/* 帳簿と同じ黒で勝ちを出したい人向け */
.win-blue { --win: var(--ink); }
""")

# 2) 派手な仕上げの節を、明るい作りの節に置き換える
cut = s.index('/* ===== 派手な仕上げ')
s = s[:cut] + r'''/* ===== 明るい作り(売れている収支アプリの型: 灰色の地・白いまとまり・黄色の帯・青と赤) ===== */
html, body { background: var(--paper); }
main { padding-top: 0; }

/* 上の黄色い帯。年月を真ん中に、左右に矢印 */
.month-nav, .page-title {
  position: sticky; top: 0; z-index: 4; margin: 0 calc(var(--gutter) * -1) var(--s3);
  padding: calc(env(safe-area-inset-top) + 10px) var(--gutter) 10px; background: var(--accent); color: var(--accent-ink);
}
.page-title { font-family: var(--sans); font-weight: 700; letter-spacing: 0; text-align: center; font-size: 17px; }
.month-nav { justify-content: center; gap: var(--s4); }
.month-nav h1 { order: 1; font-family: var(--sans); font-weight: 700; letter-spacing: 0; margin: 0; font-size: 17px; }
.month-nav .nav-btn:first-of-type { order: 0; }
.month-nav .nav-btn:last-of-type { order: 2; }
.month-nav .nav-btn { color: var(--accent-ink); font-size: 26px; }
.month-nav .link-btn { order: 3; position: absolute; right: var(--gutter); color: var(--accent-ink); text-decoration-color: rgba(0, 0, 0, 0.3); }
.mincho { font-family: var(--sans); letter-spacing: 0; }

/* 白いまとまり */
.closing, .calendar, .day, .block, .games, .counter-item, .machine-bar, .paid-note, .reward {
  background: var(--surface);
}
.closing { border: 0; border-radius: 12px; padding: var(--s3) var(--s4); margin-bottom: 0; text-align: center; }
.closing::after { display: none; }
.closing-label { justify-content: center; }
.closing-meta { justify-content: center; }
.closing-amount { font-size: 34px; font-weight: 800; letter-spacing: -0.01em; margin: 4px 0; }
.closing-amount.plus { color: var(--win); }
.closing-amount.minus { color: var(--vermilion); }
.limit { background: var(--surface); border-radius: 12px; padding: var(--s3) var(--s4); margin-top: var(--s3); }
.limit-track { background: var(--field); border-radius: 2px; }
.limit-fill { background: var(--accent); border-radius: 2px; }

.calendar { border-radius: 12px; padding: var(--s2) var(--s2) var(--s3); border-collapse: separate; }
.calendar th { padding: 6px 0; }
.calendar th:last-child { color: var(--win); }
.calendar td, .calendar tr:last-child td, .calendar td + td { border: 0; }
.calendar td button { border-radius: 8px; }
.calendar td.sel button { background: var(--field); box-shadow: none; }
.calendar td.today .cal-day { color: #f08a00; font-weight: 800; text-decoration: none; }
.calendar td.won button { background: transparent; }
.calendar td.hot button { background: rgba(249, 183, 18, 0.18); box-shadow: none; }
.cal-amt { font-size: 10.5px; }
.hot-mark { top: 3px; right: 3px; }

.day { border-radius: 12px; padding: var(--s3) var(--s4); }
.day-head { border-bottom: 1px solid var(--rule); }
.rows li { border-bottom-color: var(--rule); }
.rows li:last-child { border-bottom: 0; }
.mark { border-radius: 4px; border-color: var(--rule); background: var(--field); color: var(--ink); }
.row:active { background: var(--field); }

.block { border-radius: 12px; padding: var(--s3) var(--s4); }
.sec { border-bottom: 1px solid var(--rule); font-size: 13px; color: var(--sumi-2); font-weight: 700; }
.analysis-grid, .settings, .home-body { gap: var(--s3); }
.home-body { margin-top: var(--s3); }
.metrics div { border-bottom-color: var(--rule); }

/* 称号と連勝 */
.rank { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 10px; background: var(--accent); color: var(--accent-ink); }
.rank.down { background: var(--field); color: var(--vermilion); }
.run { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 10px; }
.run.win { background: rgba(31, 124, 240, 0.12); color: var(--win); }
.run.lose { background: rgba(240, 56, 59, 0.1); color: var(--vermilion); }

/* 右下の黄色い丸い + */
.fab {
  width: 58px; height: 58px; display: grid; place-items: center; background: var(--accent); color: var(--accent-ink);
  font-size: 34px; font-weight: 400; line-height: 1; letter-spacing: 0; text-indent: 0;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
}
.fab:active { background: #eaa800; }
.write-inline { background: var(--accent) !important; color: var(--accent-ink) !important; }

/* 下のタブ: アイコンと文字 */
.tabbar { background: var(--surface); border-top: 1px solid var(--rule); }
.tabbar button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 10px; border-top: 0; color: var(--sumi-2); }
.tabbar button svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tabbar button.on { color: #e79c00; font-weight: 700; }
@media (min-width: 1200px) { .tabbar button { flex-direction: row; font-size: 14px; gap: 6px; } .tabbar button.on { border-bottom: 2px solid var(--accent); } }

/* 期間のタブ */
.tabs { background: var(--surface); border-radius: 10px; border-bottom: 0; padding: 0 var(--s3); }
.tabs button.on { color: var(--ink); border-bottom-color: var(--accent); }
.tabs.small { background: transparent; padding: 0; }

/* ボタン類 */
.btn, .btn.wide { background: var(--accent); color: var(--accent-ink); font-weight: 800; border-radius: 10px; }
.btn-line { border-color: var(--accent); color: var(--ink); border-radius: 10px; background: var(--surface); }
.opt { background: var(--surface); border-radius: 8px; }
.opt.on { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.steps button { background: var(--surface); border-radius: 8px; }
.link-btn { text-decoration-color: var(--rule); }
input, select, textarea { background: var(--surface); border: 1px solid var(--rule); }
.yen-input { background: var(--surface); border: 1px solid var(--rule); }
.yen-input input { border: 0; }
.result { border-bottom: 1px solid var(--rule); }
.result::after { display: none; }
.result .amount.plus { color: var(--win); }
.menu { background: var(--surface); border-radius: 12px; border-top: 0; padding: 0 var(--s4); }
.menu li:last-child { border-bottom: 0; }
.paid-note { border: 0; border-radius: 12px; }
.plan { background: var(--surface); }
.plan.on { border-color: var(--accent); }
.plan-trial { color: #e08a00; }
.sheet { background: var(--paper); }
.sheet-head { background: var(--surface); }
.sheet-body > .field, .sheet-body > .kinds, .sheet-body > .result, .sheet-body > .time-row { background: transparent; }

/* グラフ */
.chart .line-plus { stroke: var(--win); }
.chart .line-minus { stroke: var(--vermilion); }
.chart .area-plus { fill: var(--win); opacity: 0.1; }
.chart .dot { fill: var(--surface); }

/* カウンター */
.machine-bar { border-radius: 12px; padding: var(--s2) var(--s3); }
.games { border-radius: 12px; padding: var(--s3); border-bottom: 0; }
.counter-item { border-radius: 12px; }
.counter-tap { border: 1px solid var(--rule); border-radius: 12px; background: var(--surface); }
.counter-tap:active { background: rgba(249, 183, 18, 0.25); }
.counter-num { color: var(--ink); }
.counter-minus { background: var(--field); border: 0; }
.post-fill { background: var(--rule); }
.post-row.best .post-fill { background: var(--accent); }
.post-row.best { color: var(--ink); }

/* 記入したときの演出(黄色と赤で派手に) */
.celebrate {
  position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 45%, rgba(255, 214, 90, 0.55), rgba(20, 14, 0, 0.82) 62%);
  animation: fade 0.15s ease-out; cursor: pointer; overflow: hidden;
}
.celebrate.jackpot { animation: flash 0.25s steps(2) 4, fade 0.15s ease-out; }
@keyframes flash { 50% { background: radial-gradient(circle at 50% 45%, rgba(255, 70, 40, 0.6), rgba(40, 0, 0, 0.9) 65%); } }
.burst {
  position: absolute; width: 220px; height: 220px; border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0 10deg, rgba(255, 236, 160, 0.6) 10deg 20deg, transparent 20deg 40deg);
  mask: radial-gradient(circle, transparent 20%, #000 21%); -webkit-mask: radial-gradient(circle, transparent 20%, #000 21%);
  animation: burst 1.6s ease-out forwards;
}
@keyframes burst { from { transform: scale(0.3) rotate(0deg); opacity: 1; } to { transform: scale(3.2) rotate(90deg); opacity: 0; } }
.particles { position: absolute; left: 50%; top: 45%; }
.particles i {
  position: absolute; width: 9px; height: 9px; border-radius: 2px; background: #ffd23f;
  box-shadow: 0 0 8px rgba(255, 210, 63, 0.9); opacity: 0;
  animation: spark 1.2s cubic-bezier(0.1, 0.7, 0.3, 1) var(--delay) forwards;
}
.particles i:nth-child(3n) { background: #ff4a3d; box-shadow: 0 0 8px rgba(255, 74, 61, 0.9); }
.particles i:nth-child(3n + 1) { background: #4a9dff; box-shadow: 0 0 8px rgba(74, 157, 255, 0.9); }
@keyframes spark {
  0% { transform: rotate(var(--a)) translateX(0) scale(1); opacity: 1; }
  100% { transform: rotate(var(--a)) translateX(var(--d)) scale(0.4); opacity: 0; }
}
.celebrate-word {
  position: relative; font-size: 64px; font-weight: 900; line-height: 1.1;
  background: linear-gradient(180deg, #fffbe0 0%, #ffd23f 45%, #f29a00 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 16px rgba(255, 200, 40, 0.85)) drop-shadow(0 3px 0 #7a4a00);
  animation: pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1);
}
.celebrate.jackpot .celebrate-word {
  font-size: 72px; background: linear-gradient(180deg, #fff 0%, #ffd23f 35%, #ff3b1f 100%); -webkit-background-clip: text; background-clip: text;
  filter: drop-shadow(0 0 22px rgba(255, 80, 40, 0.9)) drop-shadow(0 3px 0 #5a0a00);
}
.celebrate-amount { position: relative; margin-top: 8px; font-size: 30px; font-weight: 800; color: #fff; text-shadow: 0 0 14px rgba(255, 200, 40, 0.9), 0 2px 0 rgba(0, 0, 0, 0.4); animation: pop 0.6s 0.1s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
@keyframes pop { from { transform: scale(0.2); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .burst, .particles, .celebrate.jackpot { animation: none !important; }
  .particles { display: none; }
}
'''
css_path.write_text(s, encoding='utf-8', newline='\n')

# 3) タブにアイコン、記入ボタンは「+」
app = ROOT / 'src/App.tsx'
a = app.read_text(encoding='utf-8')
a = a.replace("""const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: '記録' },
  { id: 'analysis', label: '分析' },
  { id: 'counter', label: 'カウンター' },
  { id: 'settings', label: '設定' },
];""", """const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'カレンダー', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { id: 'analysis', label: '分析', icon: 'M5 20V11M11 20V5M17 20v-7M3 20h18' },
  { id: 'counter', label: 'カウンター', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8' },
  { id: 'settings', label: '設定', icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' },
];""")
a = a.replace("""            {t.label}
          </button>""", """            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
            <span>{t.label}</span>
          </button>""")
a = a.replace(""">記入</button>""", """>+</button>""")
app.write_text(a, encoding='utf-8', newline='\n')

# 4) 設定の勝ちの色の選択肢
sp = ROOT / 'src/ui/SettingsPage.tsx'
t = sp.read_text(encoding='utf-8')
t = t.replace('金(いつもの色)', '青(いつもの色)').replace('青(赤と区別しやすい)', '黒(帳簿と同じ)')
sp.write_text(t, encoding='utf-8', newline='\n')

# 5) ブラウザの上部の色・起動画面の地
(ROOT / 'index.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8').replace('content="#0f2a20"', 'content="#f9b712"'), encoding='utf-8', newline='\n')
(ROOT / 'capacitor.config.json').write_text((ROOT / 'capacitor.config.json').read_text(encoding='utf-8').replace('"backgroundColor": "#0f2a20"', '"backgroundColor": "#f2f2f7"'), encoding='utf-8', newline='\n')
ma = ROOT / 'scripts/make_assets.py'
ma.write_text(ma.read_text(encoding='utf-8').replace('PAPER = (0x0F, 0x2A, 0x20)  # 起動画面の地はアプリと同じ深緑', 'PAPER = (0xF2, 0xF2, 0xF7)  # 起動画面の地はアプリと同じ明るい灰色'), encoding='utf-8', newline='\n')
print('ok')
