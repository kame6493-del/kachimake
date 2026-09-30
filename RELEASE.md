# カチマケ 公開までの状態と手順

2026-09-30 21:40 時点。

## 済んだこと

### アプリ
- 記入・分析・小役カウンター・有料プラン(RevenueCat)・広告(AdMob バナー+リワード)
- テスト 26 件、iOS はクラウド Mac で署名なしのコンパイルが成功
- 公開用の署名鍵(カチマケ専用): `%LOCALAPPDATA%\KachimakeBuild\signing\`。パスワードは DPAPI で暗号化。PC を替える前にこのフォルダごと控える
- 署名済み AAB: `releases/kachimake-release.aab`(バージョンコード 2)

### Google Play(アプリ ID 4972528434268094575、パッケージ jp.kachimake.app)
- 内部テストに 2 (1.0.0) を公開済み。テスター: kame6493@gmail.com
- 参加リンク: https://play.google.com/apps/internaltest/4700174068659233412
- ストア掲載(名前・説明・アイコン・横長画像・画面写真3枚)、カテゴリ「ファイナンス」、連絡先
- アプリのコンテンツ 10 件すべて申告済み(レーティングは IARC 18 歳以上、対象年齢 18 歳以上)

### AdMob(パブリッシャー pub-9843093495011329)
| | アプリ ID | バナー | リワード |
|---|---|---|---|
| Android | ~9205361542 | /2713028828 | /9888811265 |
| iOS | ~7516789630 | /7262647924 | /5074544844 |
- `ads-config.json` に入れてある。`useTestAds: true`(本物の ID でもテスト広告が出る)。本番公開の前に false にして作り直す
- app-ads.txt: https://kame6493-del.github.io/app-ads.txt

### 公開ページ(GitHub Pages)
- https://kame6493-del.github.io/kachimake-site/ (サポート・プライバシーポリシー・利用規約)

### GitHub
- 非公開: kame6493-del/kachimake(アプリのコード。iOS のクラウドビルドもここ)
- 公開: kame6493-del/kachimake-site、kame6493-del/kame6493-del.github.io

## 持ち主がやること(順番どおり)

1. 内部テストで動作確認: スマホで上の参加リンクを開いて入れる。記入・分析・広告(テスト広告)・リワードを試す
2. Play の「Google Payments 販売アカウント」を作る(Play Console →「Google Play で収益化する」→ 販売アカウントをセットアップ)。銀行口座などお金の情報なので本人が入れる
3. RevenueCat のアカウントを作る(https://app.revenuecat.com)。作れたら知らせる → Claude がプロジェクト・アプリ・entitlement `premium`・Offering を作る
4. Play の商品(販売アカウントの後): Claude が `kachimake_monthly`(¥400)・`kachimake_annual`(¥3,000)を 7 日無料で作る
5. RevenueCat と Play をつなぐ「サービスアカウントの JSON」を Google Cloud で作って RevenueCat に上げる(鍵なので本人)
6. クローズドテスト: 新しい個人アカウントは、12 人以上が 14 日続けて参加しないと本番を申請できない。テスターのメールアドレスを集める
7. iOS: Apple Developer Program が有効なら、App Store Connect にアプリ(Bundle ID `jp.kachimake.app`)を作り、GitHub の kachimake リポジトリにシークレット4つ(ASC_KEY_ID / ASC_ISSUER_ID / APPLE_TEAM_ID / ASC_KEY_P8_BASE64)を入れる。DIAMOND NINE で作った App Store Connect の API キーをそのまま使える

## 作り直すとき

```
npm run sync                                   # ビルドして android/ios へ反映
powershell -File scripts/build-android.ps1     # 署名済み AAB(versionCode は android/app/build.gradle)
python scripts/make_assets.py                  # アイコン・起動画面・ストア画像
python scripts/make_screenshots.py             # 画面写真(先に dev-frame.html?demo=1 で raw を撮る)
```

## 注意

- この環境の Node は `fs.rmSync` / `cpSync` の再帰処理で exit 127 のまま無言で落ちる。`npm run build` は `scripts/clean-dist.mjs` で先に dist を消す
- プロジェクトのパスに日本語があると Gradle が止まる。build-android.ps1 は subst K: で組む
- 本番公開の前に `useTestAds` を false にする(しないと本番でもテスト広告のまま、収益が出ない)
