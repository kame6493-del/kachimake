"""GPT-image-2 で作った3枚から、ストアとネイティブ用の画像を全部作る。

- iOS: AppIcon 1024 / スプラッシュ
- Android: 旧来アイコン(四角・丸)、アダプティブアイコンの前景(判子まで安全範囲に収める)、スプラッシュ
- ストア: Google Play アイコン 512、フィーチャーグラフィック 1024x500、画面写真の下地 1242x2688
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'store-assets' / 'source'
OUT = ROOT / 'store-assets'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
IOS = ROOT / 'ios' / 'App' / 'App' / 'Assets.xcassets'

PAPER = (0x0F, 0x2A, 0x20)  # 起動画面の地はアプリと同じ深緑

icon = Image.open(SRC / 'icon.png').convert('RGB')
feature = Image.open(SRC / 'feature.png').convert('RGB')
shot_bg = Image.open(SRC / 'screenshot-bg.png').convert('RGB')

# 地の色は四隅の近くから取る(生成画像はわずかにムラがあるので中央値)
W = icon.width
samples = [icon.getpixel((x, y)) for x in (20, W - 21) for y in (20, W - 21)] + [icon.getpixel((W // 2, 30))]
INK = tuple(sorted(c[i] for c in samples)[len(samples) // 2] for i in range(3))


def art_on_transparent(img: Image.Image) -> Image.Image:
    """墨の地を透明にして、文字・線・判子だけを残す(地との色の差をそのまま不透明度に使う)"""
    rgba = img.convert('RGBA')
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = px[x, y]
            d = math.sqrt((r - INK[0]) ** 2 + (g - INK[1]) ** 2 + (b - INK[2]) ** 2)
            a = max(0, min(255, int((d - 18) * 255 / 60)))
            px[x, y] = (r, g, b, a)
    return rgba


art = art_on_transparent(icon)


def composed(size: int, scale: float, bg=INK, transparent=False) -> Image.Image:
    """絵の中心(元画像の中心)を保ったまま scale 倍にして、size 四方に置く"""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0) if transparent else bg + (255,))
    s = max(1, round(size * scale))
    a = art.resize((s, s), Image.LANCZOS)
    canvas.alpha_composite(a, ((size - s) // 2, (size - s) // 2))
    return canvas


def content_radius() -> float:
    """元画像の中心から、絵のいちばん遠い画素までの距離(画像幅に対する比)"""
    alpha = art.split()[3]
    bbox = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    c = W / 2
    corners = [(bbox[0], bbox[1]), (bbox[2], bbox[1]), (bbox[0], bbox[3]), (bbox[2], bbox[3])]
    return max(math.hypot(x - c, y - c) for x, y in corners) / W


R = content_radius()
print(f'地の色 #{INK[0]:02X}{INK[1]:02X}{INK[2]:02X}  絵の最遠点 {R:.3f}')

# --- iOS / App Store / Google Play の四角いアイコン(OS が角を丸める。判子は内側に残る) ---
full_1024 = icon.resize((1024, 1024), Image.LANCZOS)
full_1024.save(IOS / 'AppIcon.appiconset' / 'AppIcon-512@2x.png')
full_1024.save(OUT / 'icon-1024.png')
icon.resize((512, 512), Image.LANCZOS).save(OUT / 'play-icon-512.png')

# --- Android 旧来アイコン(API 25 以下)。丸い版は円に収まるように縮める ---
LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for d, px in LEGACY.items():
    composed(px, 0.9).convert('RGB').save(RES / f'mipmap-{d}' / 'ic_launcher.png')
    round_img = composed(px, min(1.0, 0.46 / R))
    mask = Image.new('L', (px, px), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, px - 1, px - 1), fill=255)
    round_img.putalpha(mask)
    round_img.save(RES / f'mipmap-{d}' / 'ic_launcher_round.png')

# --- Android アダプティブアイコン: 前景 108dp のうち、どの形に切られても残るのは中心の直径 66dp ---
SAFE = 33 / 108
fg_scale = SAFE / R
ADAPT = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for d, px in ADAPT.items():
    composed(px, fg_scale, transparent=True).save(RES / f'mipmap-{d}' / 'ic_launcher_foreground.png')
bg_xml = RES / 'values' / 'ic_launcher_background.xml'
bg_xml.write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    f'    <color name="ic_launcher_background">#{INK[0]:02X}{INK[1]:02X}{INK[2]:02X}</color>\n</resources>\n',
    encoding='utf-8')

# --- スプラッシュ: 紙の地に、墨の四角いアイコンを小さく置く(Capacitor のロゴを出さない) ---
def splash(w: int, h: int) -> Image.Image:
    img = Image.new('RGB', (w, h), PAPER)
    s = round(min(w, h) * 0.22)
    img.paste(icon.resize((s, s), Image.LANCZOS), ((w - s) // 2, (h - s) // 2))
    return img


count = 0
for p in RES.glob('drawable*/splash.png'):
    w, h = Image.open(p).size
    splash(w, h).save(p)
    count += 1
for p in (IOS / 'Splash.imageset').glob('*.png'):
    w, h = Image.open(p).size
    splash(w, h).save(p)
    count += 1
print(f'スプラッシュ {count}枚')

# --- ストア用 ---
feature.resize((1024, 500), Image.LANCZOS).save(OUT / 'play-feature-1024x500.png')
shot_bg.resize((1242, 2688), Image.LANCZOS).save(OUT / 'screenshot-bg-1242x2688.png')

# 安全範囲の検査図: 前景を円(66dp)と重ね、はみ出しを目で見られるようにする
check = composed(432, fg_scale, bg=(90, 90, 90))
dr = ImageDraw.Draw(check)
r = 432 * SAFE
dr.ellipse((216 - r, 216 - r, 216 + r, 216 + r), outline=(255, 0, 255), width=2)
check.convert('RGB').save(OUT / 'check-adaptive-safe-zone.png')
print(json.dumps({'fg_scale': round(fg_scale, 3), 'round_scale': round(min(1.0, 0.46 / R), 3)}))
