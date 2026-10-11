"""1.2.0 のアイコン・起動画面を、見本のアイコン「勝」(store-assets/source/icon-gold.png = kachi2_ref_10)から作る。
python scripts/make_native_assets.py(先に scripts/cut_ref_images.py)
- 見本は黒い地いっぱいに金の「勝」と円・棒グラフが描かれた正方形の絵。そのまま 1024 に縮める
- store-assets/icon-1024.png / play-icon-512.png … ストア用
- Android: 旧アイコン(四角・丸)、適応アイコン(背景=板の縁の紺、前景=絵を縮めて中央)、起動画面(アプリの地の紺に絵)
- store-assets/check-adaptive-safe-zone.png … 丸・角丸で切った見え方と安全域(66dp)
- iOS の素材は触らない(1.1.0 が審査中。新しい見た目の iOS 版は結果が出てから)
"""
import glob
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
OUT = ROOT / 'store-assets'
EDGE = (20, 18, 16)
EDGE_HEX = '#141210'
APP_BG = (0x0B, 0x0B, 0x0C)
FG_SCALE = 0.72


def icon1024():
    src = Image.open(OUT / 'source' / 'icon-gold.png').convert('RGB')
    return src.resize((1024, 1024), Image.LANCZOS)


def fg_layer(icon, size):
    lay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s = round(size * FG_SCALE)
    im = icon.resize((s, s), Image.LANCZOS).convert('RGBA')
    # 絵の四角の縁を背景の色へなだらかに溶かす(縁の線が見える範囲の外にあるので念のため)
    lay.paste(im, ((size - s) // 2, (size - s) // 2), im)
    return lay


def preview(icon, shape, size=432):
    full = Image.new('RGBA', (size, size), EDGE + (255,))
    full.alpha_composite(fg_layer(icon, size))
    vis = round(size * 72 / 108)
    o = (size - vis) // 2
    v = full.crop((o, o, o + vis, o + vis))
    if shape == 'safe':
        d = ImageDraw.Draw(v)
        r = vis * 66 / 72 / 2
        c = vis / 2
        d.ellipse([c - r, c - r, c + r, c + r], outline=(230, 60, 60, 255), width=3)
        return v
    m = Image.new('L', (vis, vis), 0)
    d = ImageDraw.Draw(m)
    if shape == 'circle':
        d.ellipse([0, 0, vis - 1, vis - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, vis - 1, vis - 1], radius=round(vis * 0.22), fill=255)
    out = Image.new('RGBA', (vis, vis), (0, 0, 0, 0))
    out.paste(v, (0, 0), m)
    return out


def splash(icon, size):
    w, h = size
    bg = Image.new('RGB', size, APP_BG)
    side = round(min(w, h) * 0.42)
    im = icon.resize((side, side), Image.LANCZOS)
    m = Image.new('L', (side * 4, side * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, side * 4 - 1, side * 4 - 1], radius=round(side * 4 * 0.22), fill=255)
    bg.paste(im, ((w - side) // 2, (h - side) // 2), m.resize((side, side), Image.LANCZOS))
    return bg


if __name__ == '__main__':
    icon = icon1024()
    icon.save(OUT / 'icon-1024.png')
    icon.resize((512, 512), Image.LANCZOS).save(OUT / 'play-icon-512.png')
    for f in glob.glob(str(RES / 'mipmap-*' / '*.png')):
        size = Image.open(f).size
        name = Path(f).name
        if name == 'ic_launcher_foreground.png':
            fg_layer(icon, size[0]).save(f)
        elif name == 'ic_launcher_round.png':
            m = Image.new('L', (size[0] * 4, size[1] * 4), 0)
            ImageDraw.Draw(m).ellipse([0, 0, size[0] * 4 - 1, size[1] * 4 - 1], fill=255)
            m = m.resize(size, Image.LANCZOS)
            can = Image.new('RGBA', size, EDGE + (255,))
            s = round(size[0] * 1.12)  # 丸に切ると角が落ちるので少し大きく置き、板の中身を丸に収める
            im = icon.resize((s, s), Image.LANCZOS).convert('RGBA')
            can.alpha_composite(im, ((size[0] - s) // 2, (size[1] - s) // 2))
            can.putalpha(m)
            can.save(f)
        else:
            icon.resize(size, Image.LANCZOS).save(f)
    (RES / 'values' / 'ic_launcher_background.xml').write_text(
        f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{EDGE_HEX}</color>\n</resources>\n', encoding='utf-8')
    for f in glob.glob(str(RES / 'drawable*' / 'splash.png')):
        splash(icon, Image.open(f).size).save(f)

    tiles = [preview(icon, s) for s in ('circle', 'rounded', 'safe')]
    sheet = Image.new('RGB', (sum(t.width for t in tiles) + 160, 380), (60, 66, 76))
    x = 40
    f = ImageFont.truetype('C:/Windows/Fonts/YuGothB.ttc', 22)
    d = ImageDraw.Draw(sheet)
    for t, label in zip(tiles, ['丸', '角丸', '赤い円=安全域66dp']):
        sheet.paste(t, (x, 30), t)
        d.text((x, 330), label, font=f, fill=(255, 255, 255))
        x += t.width + 40
    sheet.save(OUT / 'check-adaptive-safe-zone.png')
    print('ok')
