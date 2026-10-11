"""見本(ChatGPT に作らせた UI 参考画像)から、アプリで使う絵を切り出して public/img/ に置く。
python scripts/cut_ref_images.py
- 見本は ../ref_ui_2026-10-11/kachi_ref_01〜08.png(941x1672。02 だけ 1254 のアイコン)
- 種目の丸いアイコン5つ(パチンコ・スロット・競馬・競輪・ボート)… 05 の「カテゴリ別の上限設定」から。丸の外は透明
- ロゴの棒グラフ … 01 の左上。紺の地を透明に
- 盾 … 04 の「あなたの記録は、この端末にだけ」
- アイコンの元 … 02 をそのまま store-assets/source/icon-navy.png へ
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT.parent / 'ref_ui_2026-10-11'
OUT = ROOT / 'public' / 'img'
OUT.mkdir(parents=True, exist_ok=True)


def ref(n):
    return Image.open(REF / f'kachi_ref_0{n}.png').convert('RGB')


def circle_icon(im, cx, cy, name, r=18.2, size=96):
    """丸(直径 約37px。位置は見本で測った値)を丸く切って size に広げる。丸の外は透明"""
    sub = im.crop((round(cx - r - 2), round(cy - r - 2), round(cx + r + 2), round(cy + r + 2)))
    k = size / (2 * r)
    sub = sub.resize((round(sub.width * k), round(sub.height * k)), Image.LANCZOS)
    o = (sub.width - size) // 2
    sub = sub.crop((o, o, o + size, o + size))
    big = size * 4
    m = Image.new('L', (big, big), 0)
    ImageDraw.Draw(m).ellipse((6, 6, big - 7, big - 7), fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    out = sub.convert('RGBA')
    out.putalpha(m)
    out.save(OUT / f'{name}.png')
    print(name)


def key_out(im, box, name, scale=3, lo=30, hi=90):
    """地の紺を透明にする(地との色の差を不透明度にする)"""
    sub = im.crop(box)
    w, h = sub.size
    sub = sub.resize((w * scale, h * scale), Image.LANCZOS).convert('RGBA')
    px = sub.load()
    corners = [px[0, 0], px[sub.width - 1, 0], px[0, sub.height - 1], px[sub.width - 1, sub.height - 1]]
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    for y in range(sub.height):
        for x in range(sub.width):
            r, g, b, _ = px[x, y]
            d = math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
            a = max(0, min(255, int((d - lo) * 255 / (hi - lo))))
            px[x, y] = (r, g, b, a)
    bb = sub.getbbox()
    sub.crop(bb).save(OUT / f'{name}.png')
    print(name, bb)


r5 = ref(5)
for name, y in [('kind_pachinko', 852), ('kind_slot', 906.5), ('kind_keiba', 962), ('kind_keirin', 1019), ('kind_boat', 1074.5)]:
    circle_icon(r5, 201.5, y, name)

key_out(ref(1), (150, 128, 212, 192), 'logo_bars')
key_out(ref(4), (158, 238, 306, 382), 'shield', scale=2, lo=8, hi=40)

src = ROOT / 'store-assets' / 'source'
src.mkdir(parents=True, exist_ok=True)
Image.open(REF / 'kachi_ref_02.png').convert('RGB').save(src / 'icon-navy.png')
print('ok')
