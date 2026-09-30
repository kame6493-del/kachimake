# カチマケ 公開までの手順

2026-09-30 時点。コード・テスト・本番ビルド・Android のデバッグ版 APK までは済み。
残りは、ストアと課金の管理画面での作業(人の手が要る)と、実機での確認。

## 済んでいること

| 項目 | 状態 |
|---|---|
| 計算のテスト(集計・累計・種類別・設定推測・読み込みの検査・CSV) | 20件すべて通過 `npm test` |
| 型チェック・本番ビルド | 通過 `npm run build` |
| ブラウザでの動作(スマホ幅390px / PC幅) | 記入→保存→集計、疑似購入→有料の表示、連打525回の取りこぼし0、空の状態、本番ビルドでエラー0 |
| Android デバッグ版 | `android/app/build/outputs/apk/debug/app-debug.apk` |
| iOS プロジェクト | `ios/` を生成済み(Mac の Xcode で開く) |

## 確かめていないこと

- 実機(Android・iPhone)での起動と、戻るボタン・触覚フィードバック・共有シート
- 実際のストア課金(RevenueCat のキーが未設定のため、いまは購入ボタンが「購入の準備中です」になる)

## 1. 課金の準備(RevenueCat)

1. RevenueCat でプロジェクトを作り、iOS と Android のアプリを登録する
2. Entitlement を `premium` の名前で1つ作る(コードの `ENTITLEMENT` と同じ名前)
3. ストアに商品を作る(自動更新サブスクリプション、同じグループ)
   | 商品ID | 期間 | 価格案 | 無料期間 |
   |---|---|---|---|
   | `kachimake_monthly` | 1か月 | ¥400 | 7日 |
   | `kachimake_annual` | 1年 | ¥3,000 | 7日 |
4. RevenueCat の Offering(current)に Monthly と Annual の Package として入れ、両方を `premium` に結びつける
5. RevenueCat の公開APIキー(iOS 用と Android 用)を `src/platform/billing.ts` の `API_KEYS` に入れる
6. `npm run sync` のあと、各ストアのテスト用アカウントで購入・復元・解約を試す

## 2. 公開前に埋める所

- `public/privacy.html` の「お問い合わせ先」(いまは「公開前に記入」)
- プライバシーポリシーと利用規約を公開 URL に置き、ストアの登録画面に入れる
- (済)アイコン・スプラッシュ・ストア画像は `store-assets/` に作成済み。元画像は GPT-image-2 製(`store-assets/source/`)。
  作り直すときは元画像を差し替えて `python scripts/make_assets.py` → `python scripts/make_screenshots.py`。
  画面写真の撮り直しは、開発サーバーで `dev-frame.html?demo=1&tab=analysis&premium=1` を開いて撮る(本番には入らない)。

## 3. Android のビルド

プロジェクトのパスに日本語があると Gradle が止まるため、一時ドライブで組み立てる。
JDK と SDK は DIAMOND NINE 用に入っている物を使う。

```powershell
$root = Join-Path $env:LOCALAPPDATA 'Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\DiamondNineBuild'
$env:JAVA_HOME = (Get-ChildItem "$root\java" -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$root\android-sdk"
subst K: "C:\Users\yuichi1\Downloads\カチマケ_2026-09-30"
Start-Process K:\kachimake\android\gradlew.bat -ArgumentList 'bundleRelease' -WorkingDirectory K:\kachimake\android -NoNewWindow -Wait
subst K: /D
```

リリース版の署名鍵は DIAMOND NINE とは別に作る(同じ鍵を使い回さない)。

## 4. 注意

- この環境の Node は `fs.rmSync` / `cpSync` の再帰処理で exit 127 のまま無言で落ちる。`npm run build` は `scripts/clean-dist.mjs` で先に dist を消してから組み立てる。
- ストアの年齢区分は「頻繁/極度のギャンブルの模擬」ではなく「ギャンブルに関する情報」に当たる。本アプリは賭けそのものを提供しない。審査では、記録のための道具であることを説明文に書く。
