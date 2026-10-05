"""録画用の自動操作(src/dev/reviewTour.ts)が最後まで進むかを手元のブラウザで確かめる。
先に録画用ビルドを作って配る: VITE_REVIEW_TOUR=1 npm run build → npx vite preview --port 5251 --strictPort
python scripts/check_review_tour.py → 通った画面の見出しを順に出し、tmp_review/review_tour_check.webm に録画を残す(コミットしない)
ブラウザでは課金も広告も動かないので、購入画面は「購入の準備中です」と出るのが正しい"""
import os
import time
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tmp_review")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 393, "height": 852}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        record_video_dir=OUT, record_video_size={"width": 393, "height": 852})
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto("http://localhost:5251/")
    seen = []
    t0 = time.time()
    reached = None
    while time.time() - t0 < 150:
        txt = pg.evaluate("(document.querySelector('.sheet h2, h1')||document.body).innerText + ' | ' + document.body.innerText.slice(0,50).replace(/\\s+/g,' ')")
        if not seen or seen[-1] != txt:
            seen.append(txt)
            print(round(time.time() - t0), txt)
        if reached is None and pg.evaluate("!!document.querySelector('.sheet.paywall') && [...document.querySelectorAll('.tabbar button.on')].some(b=>b.innerText.includes('設定'))"):
            reached = round(time.time() - t0)
            print("paywall from settings at", reached, "s")
        if reached is not None and time.time() - t0 > reached + 12:
            break
        time.sleep(1)
    n = pg.evaluate("JSON.parse(localStorage.getItem('kachimake.data')||'null')")
    path = pg.video.path()
    ctx.close()
    b.close()
    os.replace(path, os.path.join(OUT, "review_tour_check.webm"))
    print("errors", errors)
    print("RESULT", "OK" if reached else "STUCK", reached)
