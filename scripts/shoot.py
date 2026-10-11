"""開発サーバー(npx vite --port 5191)の見本データで主な画面を撮る。python scripts/shoot.py [出力先] [ポート]
headless Edge(Playwright の msedge)で 390x844・3倍。完全版にして撮る(値段の出る画面は撮らない)。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'store-assets' / 'raw'
PORT = sys.argv[2] if len(sys.argv) > 2 else '5191'
OUT.mkdir(parents=True, exist_ok=True)
BASE = f'http://localhost:{PORT}/?demo=1&premium=1'

SHOTS = [
    ('home', '&tab=home', None),
    ('history', '&tab=history', None),
    ('calendar', '&tab=calendar', None),
    ('detail', '&view=detail', None),
    ('form', '&sheet=form', 'form'),
    ('settings', '&tab=settings', None),
    ('limit', '&view=limit', None),
    ('analysis', '&tab=analysis', None),
    ('counter', '&view=counter', None),
    ('celebrate', '&celebrate=jackpot', None),
]


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, locale='ja-JP', color_scheme='dark')
        pg = ctx.new_page()
        for name, q, special in SHOTS:
            pg.goto(BASE + q)
            pg.wait_for_selector('.app')
            if special == 'form':
                # 見本の入力: 種目・金額・店・機種・タグ
                pg.click('.kind-pick .kchip:has-text("パチンコ")')
                pg.click('.amount-card >> nth=0 >> button:has-text("+10,000")')
                pg.click('.amount-card >> nth=0 >> button:has-text("+10,000")')
                pg.click('.amount-card >> nth=1 >> input')
                for k in ['4', '8', '0', '0', '0']:
                    pg.click(f'.kp-grid button:text-is("{k}")')
                pg.click('.hchips .chip >> nth=0')
                pg.click('.hchips >> nth=1 >> .chip >> nth=0')
                pg.evaluate("document.activeElement && document.activeElement.blur(); document.querySelector('.page-layer').scrollTo(0, 0)")
            pg.wait_for_timeout(500)
            pg.screenshot(path=str(OUT / f'{name}.png'))
            if name in ('home', 'history', 'calendar', 'settings', 'detail', 'form', 'analysis', 'limit'):
                pg.screenshot(path=str(OUT / f'{name}_full.png'), full_page=True)
            print(name)
        b.close()


if __name__ == '__main__':
    main()
