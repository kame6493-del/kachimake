# カチマケ

パチンコ・パチスロ・公営競技の収支を記録するスマホアプリ(Capacitor + React + TypeScript)。

- 設計の根拠: DESIGN.md
- 公開までの手順と残作業: RELEASE.md
- ストア掲載文: STORE-LISTING-ja.md

```
npm install
npm run dev     # ブラウザで開発(疑似購入が使える)
npm test        # 計算のテスト
npm run build   # 本番ビルド(先に dist を1ファイルずつ消す)
npm run sync    # ビルドして android/ ios/ へ反映
```
