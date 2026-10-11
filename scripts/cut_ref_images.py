"""見本(ChatGPT に作らせた UI 参考画像・黒と金)から、アプリで使う絵を切り出して public/img/ に置く。
python scripts/cut_ref_images.py
- 見本は ../ref_ui_2026-10-11b/kachi2_ref_01〜10.png(941x1672。10 だけ 1254 の正方形のアイコン「勝」)
- 種目のアイコン6つ … 03「記録」の一覧(パチンコ・競馬・スロット・オート・ボート)と 05 の「この日の記録」(競輪)。地の黒を透明に
- ロゴの棒と「カチマケ」の金の文字 … 09 はじめの画面の左上
- はじめの画面の金の棒の景色 … 09 の右上(文字の無い所だけ)
- 小役の絵(ベル・チェリー・スイカ・赤7・青7)… 07 小役カウンター
- 小役カウンターの「123」… 09 の下の丸
- アイコンの元 … 10 をそのまま store-assets/source/icon-gold.png へ
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT.parent / 'ref_ui_2026-10-11b'
OUT = ROOT / 'public' / 'img'
OUT.mkdir(parents=True, exist_ok=True)


def ref(n):
    return Image.open(REF / f'kachi2_ref_{n:02d}.png').convert('RGB')


def key_out(im, box, name, scale=3, lo=26, hi=80, bg=None):
    """地の黒を透明にする(地との色の差を不透明度にする)。四隅の色を地とみなす"""
    sub = im.crop(box)
    w, h = sub.size
    sub = sub.resize((w * scale, h * scale), Image.LANCZOS).convert('RGBA')
    px = sub.load()
    if bg is None:
        corners = [px[0, 0], px[sub.width - 1, 0], px[0, sub.height - 1], px[sub.width - 1, sub.height - 1]]
        bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    for y in range(sub.height):
        for x in range(sub.width):
            r, g, b, _ = px[x, y]
            d = math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
            a = max(0, min(255, int((d - lo) * 255 / (hi - lo))))
            px[x, y] = (r, g, b, a)
    bb = sub.getbbox()
    sub = sub.crop(bb)
    sub.save(OUT / f'{name}.png')
    print(name, sub.size)


def circle(im, cx, cy, r, name, size=192):
    """丸く切って size に広げる。丸の外は透明"""
    sub = im.crop((round(cx - r), round(cy - r), round(cx + r), round(cy + r))).resize((size, size), Image.LANCZOS)
    big = size * 4
    m = Image.new('L', (big, big), 0)
    ImageDraw.Draw(m).ellipse((4, 4, big - 5, big - 5), fill=255)
    out = sub.convert('RGBA')
    out.putalpha(m.resize((size, size), Image.LANCZOS))
    out.save(OUT / f'{name}.png')
    print(name)


# 種目(03 の一覧の絵は約50px。競輪だけ 05 から)
r3 = ref(3)
for name, (cx, cy) in {
    'kind_pachinko': (227, 390), 'kind_keiba': (225, 500), 'kind_slot': (226, 617),
    'kind_auto': (226, 740), 'kind_boat': (227, 856),
}.items():
    key_out(r3, (cx - 34, cy - 34, cx + 34, cy + 34), name)
key_out(ref(5), (119, 1225, 172, 1277), 'kind_keirin')

# ロゴ(棒+カチマケの文字)と棒だけ
r9 = ref(9)
key_out(r9, (166, 150, 566, 245), 'logo_word', scale=2, lo=30, hi=110)
key_out(r9, (166, 150, 258, 245), 'logo_bars', scale=2, lo=30, hi=110)
# 景色(文字の無い右側。左の端は CSS でぼかして地に溶かす)
r9.crop((606, 150, 857, 505)).resize((502, 710), Image.LANCZOS).save(OUT / 'intro_scene.jpg', quality=90)
print('intro_scene')
circle(r9, 177, 1263, 56, 'counter_123')

# 小役
r7 = ref(7)
for name, box in {
    'yaku_bell': (112, 516, 172, 572), 'yaku_cherry': (370, 514, 430, 572), 'yaku_suika': (617, 516, 680, 572),
    'yaku_big': (116, 718, 200, 782), 'yaku_reg': (493, 718, 577, 782),
}.items():
    key_out(r7, box, name)

src = ROOT / 'store-assets' / 'source'
src.mkdir(parents=True, exist_ok=True)
Image.open(REF / 'kachi2_ref_10.png').convert('RGB').save(src / 'icon-gold.png')
print('ok')
