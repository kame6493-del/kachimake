"""配色を「ターフ」(深緑の地・勝ちは金・負けは赤)に切り替える。2026-09-30 持ち主が4案から選んだ。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

css = ROOT / 'src/index.css'
s = css.read_text(encoding='utf-8')
start = s.index(':root {')
end_marker = '@media (prefers-color-scheme: dark) { .win-blue { --win: #7aa7ff; } }'
end = s.index(end_marker) + len(end_marker)
head = s[start:s.index('  --s1: 4px;')]
new_colors = """:root {
  /* ターフ: 競馬場の芝・雀卓の深緑。暗い所(ホール・夜の帰り道)で見てもまぶしくない。端末のライト/ダーク設定に関係なくこの色 */
  --paper: #0f2a20;
  --ink: #f1ebdc;
  --vermilion: #ff6f5c;
  --sumi-2: #9fb5a8;
  --rule: #25493b;
  --field: #16392c;
  --win: #e9c15b;

"""
rest = s[s.index('  --s1: 4px;'):end]
rest = rest.replace('  color-scheme: light;\n', '  color-scheme: dark;\n')
# ダークモード用の上書きと、試作の3案は不要になったので消す
rest = re.sub(r'@media \(prefers-color-scheme: dark\) \{\n  :root \{.*?\n  \}\n\}\n', '', rest, flags=re.S)
rest = re.sub(r'/\* 色の案。.*?(?=\.win-blue)', '', rest, flags=re.S)
rest = rest.replace('.win-blue { --win: #1d5fbf; }\n', '/* 金と赤の区別が苦手な人向け */\n.win-blue { --win: #7fb2ff; }\n')
rest = rest.replace(end_marker, '')
s = s[:start] + new_colors + rest + s[end:]
# グラフの負けの面: 深緑に薄い赤を重ねると茶色に見えるので、少し濃くして赤に寄せる
s = s.replace('.chart .area-minus { fill: var(--vermilion); opacity: 0.12; }', '.chart .area-minus { fill: var(--vermilion); opacity: 0.24; }')
s = s.replace('.chart .area-plus { fill: var(--win); opacity: 0.08; }', '.chart .area-plus { fill: var(--win); opacity: 0.14; }')
css.write_text(s, encoding='utf-8', newline='\n')

main = ROOT / 'src/main.tsx'
m = main.read_text(encoding='utf-8')
m = m.replace("\n  const theme = params.get('theme');\n  if (theme) document.documentElement.dataset.theme = theme;", '')
main.write_text(m, encoding='utf-8', newline='\n')

idx = ROOT / 'index.html'
h = idx.read_text(encoding='utf-8').replace('content="#101828"', 'content="#0f2a20"')
idx.write_text(h, encoding='utf-8', newline='\n')

cap = ROOT / 'capacitor.config.json'
c = cap.read_text(encoding='utf-8').replace('"backgroundColor": "#f6f4ee"', '"backgroundColor": "#0f2a20"')
cap.write_text(c, encoding='utf-8', newline='\n')

sp = ROOT / 'src/ui/SettingsPage.tsx'
t = sp.read_text(encoding='utf-8')
t = t.replace('墨(帳簿と同じ)', '金(いつもの色)').replace('青(赤と区別しやすい)', '青(赤と区別しやすい)')
sp.write_text(t, encoding='utf-8', newline='\n')

assets = ROOT / 'scripts/make_assets.py'
a = assets.read_text(encoding='utf-8').replace('PAPER = (0xF6, 0xF4, 0xEE)', 'PAPER = (0x0F, 0x2A, 0x20)  # 起動画面の地はアプリと同じ深緑')
assets.write_text(a, encoding='utf-8', newline='\n')
print('ok')
