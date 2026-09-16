# 照合画面 品質保証 (SYS-RECON-P09)

アクセシビリティ・入力検証とセキュリティ・性能 (JS 予算)・アイコンの重複検査・運用観測の観点で、実装が仕様と architecture (`architecture/reconciliation-*.md`) を満たすことを確認した記録です。
検証コマンドの一覧は [`evidence.md`](evidence.md) にまとめています。

## 1. アクセシビリティ

| 観点 | 要求 | 実装 | 確認方法 | 結果 |
|---|---|---|---|---|
| 状態を色だけで示さない | 5 状態は文字のバッジ | 候補一覧のステータス列は「未処理 / 要確認 / 照合済み / MFのみ / 除外」の文字バッジ | DOM `候補一覧は 8 列で、ステータスは文字のバッジで示す` | 適合 |
| 保存結果の読み上げ | 成功は status、失敗は alert | `Reconciliation.tsx` の結果表示に `role="status"` と `role="alert"` を 1 か所ずつ | DOM `取込と重なった 409 は保存できなかったと出し、再試行できる`、`取り消しの 409 (%s) は取込中と言わず、再試行も出さない` | 適合 |
| 選択中の行と絞り込み | 現在地は aria-current、切り替えは aria-pressed | 行の選択ボタンに `aria-current`、キューの切り替えに `aria-pressed` | DOM `行を選ぶと取引の詳細パネルに…` | 適合 |
| 一括照合の確認 | 実行前に対象件数を確かめる | 共通 `ConfirmDialog`。確定ボタンは「n件を照合する」、本文に送らない件数を出す。対象 0 件ならトリガーを無効化 | DOM `一括照合は候補のある未解消行だけを…`、`照合できる行が選択に無いときは、一括照合を押せない` | 適合 |
| 装飾アイコン | 読み上げに重ねない | svg は `aria-hidden`、ボタン名は可視ラベルか `aria-label` | `route-icon-distinct.test.tsx`、`navigation-ux.dom.test.tsx` | 適合 |
| 表の名前 | 表に説明を付ける | 候補一覧に `<caption>` | DOM `候補一覧は 8 列…` | 適合 |
| リフローとタップ領域 | 狭幅で縦積みにし、横スクロールしない | `reconciliation.css` の `@media (max-width: 1099px)` で KPI → キュー → 一覧 → 詳細 → 下段 の順に縦積み、639px 以下で絞り込みを畳む。解消率リングは 44px | `check:financial-routes` (Reconciliation を 360〜1280px と rail-zoom200)、`check:mobile-layout` | 適合 (いずれも exit 0) |

## 2. 入力検証とセキュリティ

| 観点 | 確認内容 | 結果 |
|---|---|---|
| 認証 | `GET /api/reconciliation`・`POST /api/reconciliation/actions`・`POST /api/reconciliation/actions/:id/undo` は `/api/*` の authGuard 配下 | 適合 (api `未ログインは 3 本とも 401`) |
| 本文の許可リスト | zod で `action` を 4 値の enum、`targets` を 1〜200 件、`txId` 1〜120 文字、`freeeKey` 1〜2,000 文字に制限。どちらも無い対象は拒否 | 適合 (api `201 件は 400、未知の action も 400`、`200 件ちょうどは受け付け…`) |
| 件ごとの検証 | 実在しない明細は `not_found`、候補の無い「同じ」は `no_candidate`、向き違い・±3 日の外の相手は `freee_not_pairable`、他人の鍵は `freee_not_found`、同じ明細の重複指定は `duplicate_target`。失敗した件は保存しない | 適合 (api レビュー是正の 3 件) |
| path の検証 | 取り消しの id は UUID 以外なら照会せずに 400 `invalid_action_id` | 適合 (api `他人の操作 id と存在しない id は 404、形の違う id は照会せずに 400`) |
| 利用者の境界 | 読み書きとも user_id で絞る。他人の操作の取り消しは 404、他人の freee は照合に混ざらない | 適合 (api `…他人の freee は混ざらない`) |
| 取り消しの安全 | 最新でない 409 `action_not_latest`、取消済み 409 `action_already_undone`、後から同じ行が変わっていれば 409 `action_stale`、記録が壊れていれば 409 `action_snapshot_invalid` (500 にしない) | 適合 (api 3 件) |
| 取込・復元との直列化 | 照合の 2 経路と、総収支の `POST /api/total-cashflow/verdicts`・`POST` / `DELETE /api/total-cashflow/freee-exclusions` を `CANONICAL_MUTATION_ROUTES` に登録。取込中は 409 `canonical_write_busy` | 適合 (`canonical-mutation-fence.ts`) |
| 平文の非保持 | 新表は明細本文の写しを持たず、tx_id・鍵・判断・理由だけ。長さを CHECK で制限 | 適合 ([`refactoring.md`](refactoring.md) §1) |
| SQL | Drizzle のパラメータ化のみ。1 文のバインド数は D1 上限 100 以内 (判断 12 行 / MF 除外 16 行で分割) | 適合 (api `25 件の実書き込みは文を分けて…`) |
| 外部送信とテストデータ | 新しい fetch 先・外部 SDK なし。検索語は通信に載せない。fixture とローカル seed は架空の取引先・金額のみ | 適合 (DOM `検索・ステータス・キューで絞り込み…検索語は通信に載せない`、`guard-real-data` passed) |

## 3. 性能

| 観点 | 確認内容 | 結果 |
|---|---|---|
| 初期 JS 予算 | `build:bundle` 直後に `check:js-budget`: 109.33 KiB / 110 KiB。照合画面は `/analysis/:tab` の lazy 詳細で、初期 JS に入らない | 適合 (余裕 0.67 KiB) |
| 候補探し | MF 1 件ごとに全 freee を走査せず、向きと発生日の索引で ±3 日の 7 日ぶんだけを見る。類似度は 1 組 1 回だけ計算してから並べ替える | 適合 (匿名化 fixture で結果を確認。本番相当規模の時間は未計測) |
| 再取得の範囲 | 照合の保存と取り消しの後は `['reconciliation']`・分析ハブ・`['review-queue']` を無効化する。総収支の画面からの保存も同じ 4 つを無効化する | 適合 (DOM `重複判断の保存後に分析ハブ・照合・月次クローズのキューを無効化する`) |
| 夜間 cron の予算 | 90 日の削除を cron に足さず、操作時の batch で行う。cron の D1 予算 47 / 47 は変えない | 適合 ([`design-review.md`](design-review.md) R4) |

## 4. アイコンの重複検査 (route-icon-distinct)

`packages/web/src/route-icon-distinct.test.tsx` は `docs/reconciliation-icons.md` の対応表を読み、次を検査します。いずれも `pnpm test` で pass しました。

- すべての icon が 1 つ以上の図形を描く (空の icon で「一意」を自明に満たさない)。
- 2 つの icon が同一の図形集合にならず、片方がもう片方の図形をすべて含まない。
- ナビとタブが使う icon 名はすべて登録済みで重複しない。登録済みで使われていない icon が無い。
- docs の登録名一覧が `UiIcon` の登録と一致し、場所の表の名前はすべて登録済み。

## 5. 運用観測

新しいログ出力やメトリクスは追加していません。操作の事実は `reconciliation_actions` に 90 日残ります。
件数のずれや取り消しの失敗は [`../runbooks/reconciliation-mismatch.md`](../runbooks/reconciliation-mismatch.md) の reason 表と症状表で切り分けます。

## 結論

本書の観点で未適合は 0 件です。受入判定は [`acceptance.md`](acceptance.md) を正とします。
