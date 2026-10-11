// はじめの画面(見本 kachi2_ref_09)。記録が1件も無い最初の起動で1回だけ出す。設定からもう一度開ける
import { Icon } from './parts';

const MINI_LINE = [6, 9, 15, 10, 8, 8, 13, 19, 17, 21, 19, 20];

export function Intro({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  return (
    <div className="page-layer intro" role="dialog" aria-modal="true" aria-label="カチマケのはじめに">
      <div className="intro-in">
        <header className="intro-hero">
          <img className="intro-scene" src="./img/intro_scene.jpg" alt="" />
          <h1><img src="./img/logo_word.png" alt="カチマケ" width={250} height={50} /></h1>
          <p className="intro-catch">落ち着いて記録、冷静に振り返る</p>
          <i className="intro-rule" aria-hidden="true" />
          <p className="intro-lead">遊技の記録をシンプルに。<br />データで自分のスタイルを見つめ直せます。</p>
        </header>

        <div className="intro-grid">
          <section className="card intro-card">
            <h2><span className="num">1</span>遊技を記録する</h2>
            <div className="ic-split">
              <p>投資・回収・メモをかんたんに記録。その日の結果をすぐに残せます。</p>
              <div className="mini-form" aria-hidden="true">
                <div><small>投資</small><b>12,000円</b><span className="mf-m">−</span></div>
                <div><small>回収</small><b>28,600円</b><span className="mf-p">+</span></div>
                <div><small>メモ</small><i /><i /></div>
              </div>
            </div>
          </section>
          <section className="card intro-card">
            <h2><span className="num">2</span>結果を分析する</h2>
            <p>日別・月別の収支や勝率を自動で集計。グラフで傾向をひと目で確認できます。</p>
            <svg className="mini-line" viewBox="0 0 120 40" aria-hidden="true">
              <path d={MINI_LINE.map((v, i) => `${i ? 'L' : 'M'}${6 + i * 10},${v + 6}`).join('')} fill="none" />
              {MINI_LINE.map((v, i) => <circle key={i} cx={6 + i * 10} cy={v + 6} r="2.2" className={v + 6 <= 18 ? 'p' : 'm'} />)}
            </svg>
          </section>
          <section className="card intro-card">
            <h2><span className="num">3</span>カレンダーで見える化</h2>
            <div className="ic-split">
              <p>記録はカレンダーで一覧表示。どの日にどれだけ遊んだか、すぐに確認できます。</p>
              <div className="mini-cal" aria-hidden="true">
                {Array.from({ length: 28 }, (_, i) => <i key={i} className={[3, 4, 9, 16, 22].includes(i) ? 'p' : [6, 12, 23].includes(i) ? 'm' : i === 18 ? 's' : ''} />)}
              </div>
            </div>
          </section>
          <section className="card intro-card">
            <h2><span className="num">4</span>月間の負け上限で使いすぎを防ぐ</h2>
            <div className="ic-split">
              <p>今月の負け上限を設定し、近づくとお知らせ。冷静に楽しむためのサポート機能です。</p>
              <span className="mini-ring" aria-hidden="true"><span className="alert-dot">!</span></span>
            </div>
          </section>
          <section className="card intro-card wide">
            <img src="./img/counter_123.png" alt="" width={72} height={72} />
            <div><h2>小役カウンター</h2><p>遊技中の小役を手軽にカウント。数えた結果はそのまま記録に残せます。</p></div>
            <span className="mini-counter" aria-hidden="true"><i>−</i><b>123</b><i>+</i></span>
          </section>
        </div>

        <button className="btn-gold wide intro-start" onClick={onStart}>はじめる<Icon name="right" size={22} /></button>
        <button className="link-btn center-block intro-later" onClick={onLater}>あとで見る</button>
      </div>
    </div>
  );
}
