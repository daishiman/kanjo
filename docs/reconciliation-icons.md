# 照合画面と共通シェルのアイコン対応表

照合画面 (`/analysis/reconciliation`) と共通シェルで使うアイコンを、デザインの指定 (lucide の名前) と
実装の登録名で対応づける。形状は lucide-static v1.37.0 の同名 SVG を写している。

- ナビゲーションのアイコンは `RouteIcon` (1 画面 1 アイコンの契約) に登録する。
- 操作・状態・信頼情報のアイコンは `UiIcon` に登録する。仕様では照合用のアイコンを RouteIcon に足す想定だったが、
  RouteIcon は「登録済みは必ずナビで使う」「図形の包含を許さない」契約を持つため、ナビ以外の glyph は UiIcon に分けた。
- 下の 2 つの表は `packages/web/src/route-icon-distinct.test.tsx` が読み、登録名と実装の一致を検査する。
  表を変えるときは `UiIcon.tsx` も同時に変える。

## 画面上の場所との対応

| # | 場所 | lucide 名 | 登録先 | 登録名 |
|---|---|---|---|---|
| 1 | サイドバーの照合 | git-compare-arrows | RouteIcon | `git-compare-arrows` |
| 2 | 絞り込み | sliders-horizontal | UiIcon | `sliders-horizontal` |
| 3 | KPI 事業支出 | wallet | UiIcon | `wallet` |
| 4 | KPI MFのみの支出 (対応不要) | info | UiIcon | `info` |
| 5 | KPI 要確認一致候補 | wand-sparkles | UiIcon | `wand-sparkles` |
| 6 | KPI 解消済みのリング | (アイコンではなく SVG のドーナツ) | - | - |
| 7 | 候補一覧の検索 | search | UiIcon | `search` |
| 8 | 対応キュー 要確認 | circle-alert | UiIcon | `alert` |
| 9 | 確認のみ MFのみの支出 | info | UiIcon | `info` |
| 10 | 対応キュー 金額の差異 | circle-alert | UiIcon | `alert` |
| 11 | 対応キュー 日付の近い候補 | clock | UiIcon | `clock` |
| 12 | 詳細を閉じる | x | UiIcon | `close` |
| 13 | 一致の理由 | circle-check | UiIcon | `check` |
| 14 | 元に戻す | rotate-ccw | UiIcon | `rotate-ccw` |
| 15 | ヘッダーの検索 | search | UiIcon | `search` |
| 16 | ダウンロード (書き出し) | download | UiIcon | `download` |
| 17 | ヘルプ (使い方) | circle-help | UiIcon | `help` |
| 18 | アカウント | circle-user | UiIcon | `circle-user` |
| 19 | 防衛ライン | shield-check | UiIcon | `shield-check` |
| 20 | ページ送り | chevron-left / chevron-right | UiIcon | `chevron-left` / `chevron-right` |
| 21 | フッター 外部送信しない | lock | UiIcon | `lock` |
| 22 | フッター 税務上の正本 | badge-check | UiIcon | `badge-check` |
| 23 | フッター 毎晩バックアップ | cloud | UiIcon | `cloud` |
| 24 | 改善を送る | message-circle | UiIcon | `message-circle` |

デザインの指定に無く、実装で追加したもの:

| 場所 | lucide 名 | 登録名 |
|---|---|---|
| 一致の理由で条件を満たさない行 | circle-x | `circle-x` |
| 詳細の「明細仕分けで開く」 | external-link | `external-link` |
| 月次クローズの未完了ステップ | circle | `circle` |
| サイドバーの支出分析・決算書の子へ進む印 | chevron-right | `chevron-right` |

## UiIcon の登録名一覧

登録名と lucide 名が違うものは、既存の呼び出し側の名前を保つためにそのままにしている。

| 登録名 | lucide 名 |
|---|---|
| `brand-bars` | chart-no-axes-column |
| `shield-check` | shield-check |
| `info` | info |
| `check` | circle-check |
| `alert` | circle-alert |
| `warning` | triangle-alert |
| `up` | chevron-up |
| `down` | chevron-down |
| `close` | x |
| `refresh` | refresh-ccw (既存の独自形状) |
| `search` | search |
| `download` | download |
| `help` | circle-help |
| `lock` | lock |
| `cloud` | cloud |
| `wallet` | wallet |
| `wand-sparkles` | wand-sparkles |
| `clock` | clock |
| `sliders-horizontal` | sliders-horizontal |
| `rotate-ccw` | rotate-ccw |
| `badge-check` | badge-check |
| `circle-user` | circle-user |
| `message-circle` | message-circle |
| `circle-x` | circle-x |
| `external-link` | external-link |
| `chevron-left` | chevron-left |
| `chevron-right` | chevron-right |
| `house` | house |
| `utensils` | utensils |
| `zap` | zap |
| `book-open` | book-open |
| `car` | car |
| `ellipsis` | ellipsis |
| `repeat` | repeat-2 |
| `circle` | circle |
