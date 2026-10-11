"""1.2.0(紺の見た目)のストア画像を作る。python scripts/make_store_v12.py
先に開発サーバー(npx vite --port 5191)を立てて python scripts/shoot.py store-assets/raw_v12 で画面を撮っておく。
- 地はアプリと同じ紺のグラデーション(生成り・ベージュの無地にしない)。見出しは白、補足は薄い青
- 値段・「無料」は入れない(完全版にして撮るので、画面にも値段や有料の札は出ない)
- 出力: store-assets/v12-play-N-*-1080x1920.png / v12-appstore-N-*-1242x2688.png / v12-appstore69-N-*-1320x2868.png
        store-assets/v12-feature-1024x500.png / v12-icon-512.png
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'store-assets'
RAW = A / 'raw_v12'
BOLD = 'C:/Windows/Fonts/YuGothB.ttc'
WHITE = (240, 245, 252)
SUB = (169, 201, 246)
TOP = (24, 40, 64)
BOTTOM = (10, 16, 26)

SHOTS = [
    ('home', '勝ち負けが、ひと目で', '今月・今年の収支、種目別、店ごとの順位'),
    ('form', '使った額と戻った額で記録', '前回と同じ・レート・貯玉・タグにも対応'),
    ('calendar', 'カレンダーで勝ち日を数える', '勝ち日数・負け日数・連勝・連敗'),
    ('history', '履歴から探して振り返る', '店舗名・機種名・メモで検索'),
    ('detail', '1回ごとの記録をくわしく', '同じ店の直近30日の成績も見られる'),
    ('analysis', '回収率も時給もまとめて', '期間・店・機種・曜日・タグごとの収支'),
    ('limit', '負けすぎを防ぐ上限', '近づいたらホームでお知らせ'),
]
TARGETS = [('play', 1080, 1920), ('appstore', 1242, 2688), ('appstore69', 1320, 2868)]


def bg(w, h):
    img = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)))
    # 上に青い光をぼかして置く
    glow = Image.new('L', (w, h), 0)
    ImageDraw.Draw(glow).ellipse((-w * 0.2, -h * 0.25, w * 1.2, h * 0.32), fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(w / 8))
    img = Image.composite(Image.new('RGB', (w, h), (60, 110, 190)), img, glow)
    return img


def centered(d, y, text, font, fill, w):
    bb = d.textbbox((0, 0), text, font=font)
    d.text(((w - (bb[2] - bb[0])) // 2 - bb[0], y), text, font=font, fill=fill)


def make(store, W, H):
    k = W / 1080
    f1 = ImageFont.truetype(BOLD, round(78 * k))
    f2 = ImageFont.truetype(BOLD, round(38 * k))
    for i, (name, head, sub) in enumerate(SHOTS, 1):
        img = bg(W, H)
        d = ImageDraw.Draw(img)
        centered(d, round(H * 0.045), head, f1, WHITE, W)
        centered(d, round(H * 0.045 + 118 * k), sub, f2, SUB, W)
        shot = Image.open(RAW / f'{name}.png').convert('RGB')
        top = round(H * 0.045 + 210 * k)
        sh = H - top - round(70 * k)
        sw = round(shot.width * sh / shot.height)
        if sw > W * 0.84:
            sw = round(W * 0.84)
            sh = round(shot.height * sw / shot.width)
        shot = shot.resize((sw, sh), Image.LANCZOS)
        x = (W - sw) // 2
        r = round(46 * k)
        # 端末の枠(黒い縁)と影
        pad = round(14 * k)
        sh_img = Image.new('L', (W, H), 0)
        ImageDraw.Draw(sh_img).rounded_rectangle((x - pad, top - pad + 20, x + sw + pad, top + sh + pad + 20), radius=r + pad, fill=150)
        sh_img = sh_img.filter(ImageFilter.GaussianBlur(30 * k))
        img = Image.composite(Image.new('RGB', (W, H), (0, 0, 0)), img, sh_img)
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((x - pad, top - pad, x + sw + pad, top + sh + pad), radius=r + pad, fill=(8, 10, 14), outline=(70, 86, 110), width=max(2, round(3 * k)))
        m = Image.new('L', (sw, sh), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=r, fill=255)
        img.paste(shot, (x, top), m)
        out = A / f'v12-{store}-{i}-{name}-{W}x{H}.png'
        img.save(out)
        print(out.name)


def feature():
    W, H = 1024, 500
    img = bg(W, H)
    icon = Image.open(A / 'icon-1024.png').convert('RGB').resize((300, 300), Image.LANCZOS)
    m = Image.new('L', (1200, 1200), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 1199, 1199), radius=264, fill=255)
    img.paste(icon, (80, 100), m.resize((300, 300), Image.LANCZOS))
    d = ImageDraw.Draw(img)
    d.text((430, 130), 'カチマケ', font=ImageFont.truetype(BOLD, 110), fill=WHITE)
    d.text((434, 280), 'パチンコ・スロット・競馬の', font=ImageFont.truetype(BOLD, 40), fill=SUB)
    d.text((434, 336), '収支を、記録で味方に。', font=ImageFont.truetype(BOLD, 40), fill=SUB)
    img.save(A / 'v12-feature-1024x500.png')
    Image.open(A / 'icon-1024.png').resize((512, 512), Image.LANCZOS).save(A / 'v12-icon-512.png')
    print('feature')


if __name__ == '__main__':
    for t in TARGETS:
        make(*t)
    feature()
