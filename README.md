# 買い物上手

欲しいものを登録して、買ったあとの満足度（3日後・1週間後・2週間後・1ヶ月後・3ヶ月後・半年後・1年後）を記録し、自分の買い物の精度を振り返るAndroidアプリ。プレゼントの記録・予定・候補の管理もできます。

## インストール・アップデート
1. `main` に push すると GitHub Actions が APK を作り、[Releases](../../releases) に添付します。
2. スマホで最新の Release を開き、`.apk` をタップしてインストール。
3. 2回目以降は上書きインストールでOK（同じ鍵で署名しているのでデータは残ります）。アプリの「設定 → アップデートを確認」からも新しい版を開けます。

> `app/kaimono.keystore` は上書きアップデートに必要な署名鍵です。消したり作り直したりしないでください（作り直すと一度アンインストールが必要になり、データが消えます）。

## 構成
| 場所 | 中身 |
|---|---|
| `app/src/main/assets/index.html` | 画面の入れ物 |
| `app/src/main/assets/js/core.js` | データ形式・日付計算・通知予定の作成・共通部品 |
| `app/src/main/assets/js/shop.js` | 欲しいもの・買ったもの・満足度の記録 |
| `app/src/main/assets/js/stats.js` | 振り返り |
| `app/src/main/assets/js/gift.js` | プレゼント（予定・候補・あげたもの・人） |
| `app/src/main/assets/js/settings.js` | 設定・バックアップ・アップデート確認 |
| `app/src/main/assets/js/app.js` | 起動・タブ・通知から開いたときの移動 |
| `app/src/main/assets/css/app.css` | 見た目（ダークモード対応） |
| `app/src/main/java/.../MainActivity.kt` | 画面を表示する入れ物と、JavaScriptから呼べる機能（`window.Native`） |
| `app/src/main/java/.../Store.kt` | データの保存（`data.json`）と毎日の自動バックアップ |
| `app/src/main/java/.../Reminder.kt` | 毎日決まった時刻に通知を出すしくみ |
| `app/src/main/java/.../Net.kt` | 商品ページからの名前・値段・画像の取得、アップデート確認 |

### アップデートしやすくするための決まりごと
- **機能の追加はほぼ JavaScript だけで済む**ようにしてあります。データは画面側が作ったJSONを丸ごと保存し、通知も「いつ・何を出すか」の一覧を画面側が作ってネイティブ側に渡すだけです。
- **データ形式を変えるとき**は `core.js` の `migrate()` に既定値や変換を足し、必要なら `SCHEMA` を上げます。古いデータも自動で新しい形にそろいます。
- バージョン番号は GitHub Actions の実行番号（`v12` なら versionCode 12）。push するたびに自動で上がります。
- コミットメッセージが Release の説明になり、アプリのアップデート画面に表示されます。

## ブラウザで画面を確認する
`app/src/main/assets/index.html` をそのままブラウザで開くと、データを localStorage に保存する形で動きます（通知・URL取得などアプリ専用の機能は除く）。
