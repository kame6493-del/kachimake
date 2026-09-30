"""App Store 用の画面写真(1242x2688)を作る。

下地(GPT-image-2 で作った紙と二重線)に、見出しと実際のアプリ画面(store-assets/raw)を重ねる。
見出しは画像生成に任せず Windows の游明朝で描く(漢字が崩れないように)。
影は付けない。画面の外周は墨の細い線1本(DESIGN.md: 構造は線で作る)。
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'store-assets'
INK = (0x1B, 0x1A, 0x17)
SUMI2 = (0x6F, 0x6A, 0x5F)

SHOTS = [
    ('home', '今月いくらか、開けば分かる', '投資と回収を入れるだけ。赤字は朱、黒字は墨'),
    ('analysis', '回収率も時給も、1画面で', '累計の推移・種類ごと・店や機種ごとの収支'),
    ('counter', '数えた小役から、設定を推測', 'ホールの中でも押しやすい大きなボタン'),
]

src_bg = Image.open(A / 'screenshot-bg-1242x2688.png').convert('RGB')

# (ストア, 幅, 高さ)。Google Play は 9:16 か 16:9 だけ受け付ける
TARGETS = [('appstore', 1242, 2688), ('appstore69', 1320, 2868), ('play', 1080, 1920)]


def make(store: str, W: int, H: int):
    # 下地は幅を合わせて縮め、上から高さぶんを使う(二重線は上18%にあるので残る)
    bg = src_bg.resize((W, round(src_bg.height * W / src_bg.width)), Image.LANCZOS).crop((0, 0, W, H))
    k = W / 1242
    mincho = ImageFont.truetype('C:/Windows/Fonts/yumindb.ttf', round(76 * k))
    subf = ImageFont.truetype('C:/Windows/Fonts/YuGothM.ttc', round(40 * k))
    gray = bg.convert('L')
    rule_y = next(y for y in range(round(200 * k), H // 2) if sum(gray.getpixel((x, y)) for x in range(round(300 * k), round(900 * k), 20)) / len(range(round(300 * k), round(900 * k), 20)) < 90)
    for i, (name, head, sub) in enumerate(SHOTS, 1):
        _one(store, W, H, bg, rule_y, mincho, subf, i, name, head, sub)


def _one(store, W, H, bg, rule_y, MINCHO, SUB, i, name, head, sub):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    # 見出しは二重線の上。左端は二重線の左端(幅の約8%)にそろえる
    left = round(W * 0.08)
    d.text((left, rule_y - round(56 * W / 1242)), head, font=MINCHO, fill=INK, anchor='ls')
    d.text((left, rule_y + round(86 * W / 1242)), sub, font=SUB, fill=SUMI2, anchor='ls')

    shot = Image.open(A / 'raw' / f'{name}.png').convert('RGB')
    sw = round(W * 0.78)
    sh = round(shot.height * sw / shot.width)
    top = rule_y + round(150 * W / 1242)
    if top + sh > H - 40:  # 下にはみ出す分は、画面の下(タブの手前)を切らずに縮めて収める
        sh = H - 40 - top
        sw = round(shot.width * sh / shot.height)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    x = (W - sw) // 2
    img.paste(shot, (x, top))
    d.rectangle((x - 1, top - 1, x + sw, top + sh), outline=INK, width=2)
    out = A / f'{store}-{i}-{name}-{W}x{H}.png'
    img.save(out)
    print(out.name, 'image', shot.size)


for t in TARGETS:
    make(*t)
