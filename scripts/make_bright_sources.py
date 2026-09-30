"""1.1.0: アプリの黄色い見た目に合わせて、アイコンとフィーチャーグラフィックの元画像を作り直す。

できた source/icon-bright.png・source/feature-bright.png を make_assets.py が読む。
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'store-assets' / 'source'
FONTS = Path('C:/Windows/Fonts')
BOLD = str(FONTS / 'YuGothB.ttc')

YELLOW = (0xF9, 0xB7, 0x12)
INK = (0x1C, 0x1C, 0x1E)
BLUE = (0x1F, 0x7C, 0xF0)
RED = (0xF0, 0x38, 0x3B)


def text_center(d: ImageDraw.ImageDraw, cx: float, y: float, s: str, font, fill):
    w = d.textlength(s, font=font)
    d.text((cx - w / 2, y), s, font=font, fill=fill)


# --- アイコン: 黄色の地に黒の「勝」、下に青と赤の2本線(勝ち・負け) ---
N = 1254
icon = Image.new('RGB', (N, N), YELLOW)
d = ImageDraw.Draw(icon)
f = ImageFont.truetype(BOLD, 560)
box = d.textbbox((0, 0), '勝', font=f)
gw, gh = box[2] - box[0], box[3] - box[1]
d.text(((N - gw) / 2 - box[0], 330 - box[1]), '勝', font=f, fill=INK)
bar_w, bar_h, gap = 520, 34, 26
x0 = (N - bar_w) / 2
y0 = 330 + gh + 70
d.rounded_rectangle((x0, y0, x0 + bar_w, y0 + bar_h), radius=bar_h / 2, fill=BLUE)
d.rounded_rectangle((x0, y0 + bar_h + gap, x0 + bar_w * 0.62, y0 + bar_h * 2 + gap), radius=bar_h / 2, fill=RED)
icon.save(SRC / 'icon-bright.png')

# --- フィーチャーグラフィック 1024x500: 黄色の地、左に見出しと金額、右に白いまとまり ---
FW, FH = 1024 * 2, 500 * 2
feat = Image.new('RGB', (FW, FH), YELLOW)
d = ImageDraw.Draw(feat)
# 放射の線
cx, cy = FW * 0.74, FH * 0.5
import math
for i in range(0, 24, 2):
    a0 = math.radians(i * 15)
    a1 = math.radians(i * 15 + 7)
    R = 2000
    d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=(0xFB, 0xC8, 0x48))
d.text((96, 150), '今月、いくら勝った?', font=ImageFont.truetype(BOLD, 104), fill=INK)
d.text((90, 300), '+¥51,600', font=ImageFont.truetype(BOLD, 230), fill=BLUE)
d.text((100, 610), 'パチンコ・パチスロ・競馬・競輪・ボート・オート', font=ImageFont.truetype(BOLD, 50), fill=INK)
d.text((100, 700), '収支を30秒で記録。どこで負けているかが分かる', font=ImageFont.truetype(BOLD, 50), fill=(0x48, 0x38, 0x00))

# 右: 小さなカレンダー風のカード
card = (1420, 170, 1920, 830)
d.rounded_rectangle(card, radius=48, fill=(255, 255, 255))
f_s = ImageFont.truetype(BOLD, 40)
f_m = ImageFont.truetype(BOLD, 34)
text_center(d, (card[0] + card[2]) / 2, card[1] + 40, '9月の収支', f_s, (0x8A, 0x8A, 0x8F))
text_center(d, (card[0] + card[2]) / 2, card[1] + 100, '+¥51,600', ImageFont.truetype(BOLD, 84), BLUE)
cells = [('20', '-1.8万', RED), ('23', '+1.2万', BLUE), ('24', '+4.7万', BLUE), ('26', '+1.6万', BLUE), ('28', '+1.1万', BLUE), ('30', '+1.6万', BLUE)]
for i, (day, amt, col) in enumerate(cells):
    gx = card[0] + 40 + (i % 3) * 145
    gy = card[1] + 270 + (i // 3) * 170
    if day == '24':
        d.rounded_rectangle((gx - 6, gy - 10, gx + 136, gy + 140), radius=18, fill=(0xFE, 0xF0, 0xCC))
        d.rounded_rectangle((gx + 92, gy - 4, gx + 132, gy + 36), radius=8, fill=(0xE0, 0x2A, 0x14))
        d.text((gx + 97, gy - 2), '激', font=ImageFont.truetype(BOLD, 30), fill=(255, 255, 255))
    text_center(d, gx + 65, gy + 10, day, f_m, INK)
    text_center(d, gx + 65, gy + 70, amt, f_m, col)
feat.resize((1024, 500), Image.LANCZOS).save(SRC / 'feature-bright.png')
print('ok')
