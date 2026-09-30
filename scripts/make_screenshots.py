"""App Store 用の画面写真(1242x2688)を作る。

下地(GPT-image-2 で作った紙と二重線)に、見出しと実際のアプリ画面(store-assets/raw)を重ねる。
見出しは画像生成に任せず Windows の游明朝で描く(漢字が崩れないように)。
影は付けない。画面の外周は墨の細い線1本(DESIGN.md: 構造は線で作る)。
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'store-assets'
INK = (0x1C, 0x1C, 0x1E)  # 見出しは黒(売れている収支アプリの型: 黄色の地に太い黒文字)
SUMI2 = (0x3A, 0x2E, 0x00)

SHOTS = [
    ('home', 'カレンダーで収支がひと目で', '投資と回収を入れるだけ。称号と連勝も出る'),
    ('analysis', '回収率も時給もまとめて分析', '累計の推移・種類ごと・店や機種ごとの収支'),
    ('counter', '小役を数えて設定を推測', 'ホールの中でも押しやすい大きなボタン'),
    ('celebrate', '勝った日は派手に祝う', '1万円以上で「大勝!」、5万円以上で「激アツ!!」'),
]

def turf_bg(W: int, H: int) -> Image.Image:
    """黄色一色の下地(売れている収支アプリのストア画像の型)"""
    return Image.new('RGB', (W, H), (0xF9, 0xB7, 0x12))

# (ストア, 幅, 高さ)。Google Play は 9:16 か 16:9 だけ受け付ける
TARGETS = [('appstore', 1242, 2688), ('appstore69', 1320, 2868), ('play', 1080, 1920)]


def make(store: str, W: int, H: int):
    # 下地は幅を合わせて縮め、上から高さぶんを使う(二重線は上18%にあるので残る)
    bg = turf_bg(W, H)
    k = W / 1242
    mincho = ImageFont.truetype('C:/Windows/Fonts/YuGothB.ttc', round(80 * k))
    subf = ImageFont.truetype('C:/Windows/Fonts/YuGothB.ttc', round(42 * k))
    rule_y = round(H * 0.18)
    for i, (name, head, sub) in enumerate(SHOTS, 1):
        _one(store, W, H, bg, rule_y, mincho, subf, i, name, head, sub)


def _one(store, W, H, bg, rule_y, MINCHO, SUB, i, name, head, sub):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    # 見出しは二重線の上。左端は二重線の左端(幅の約8%)にそろえる
    d.text((W // 2, rule_y - round(40 * W / 1242)), head, font=MINCHO, fill=INK, anchor='ms')
    d.text((W // 2, rule_y + round(70 * W / 1242)), sub, font=SUB, fill=SUMI2, anchor='ms')

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
    # 画面の外周は黒い太めの角丸(スマホの枠に見えるように)
    d.rounded_rectangle((x - 14, top - 14, x + sw + 13, top + sh + 13), radius=round(48 * W / 1242), outline=INK, width=round(14 * W / 1242))
    out = A / f'{store}-{i}-{name}-{W}x{H}.png'
    img.save(out)
    print(out.name, 'image', shot.size)


for t in TARGETS:
    make(*t)
