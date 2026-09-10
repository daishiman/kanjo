---
graph_node_id: feature-retire-tax-receipt-and-clarify-freee-only
artifact_kind: feature
artifact_subtypes: []
title: 確定申告・領収書/証憑機能の全廃と freeeOnly 一覧の意味の是正
project_id: kanjo
domain: total-cashflow
status: active
priority: high
start_date: null
target_date: null
iteration: null
owners: [daishiman]
tags: [scope-reduction, total-cashflow, ui-correction]
file_path: features/feature-retire-tax-receipt-and-clarify-freee-only.md
template_id: feature
template_version: 1.0.0
confirmation_status: confirmed
evaluation_status: pass
confirmation_evidence:
  evaluator: dev-graph:dev-graph-integrity-auditor+repository-fact-reconciliation
  evidence_ref: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/atomic-promotion-receipt.json
  evaluated_digest: 09edb52e70a7db3e1f44d5691b79e8562b48ab84d387f69f30310e79c76ed551
source_lineage:
  origin_kind: manual
  source_plugin: null
  source_path: null
  source_version: null
  source_digest: null
  imported_at: null
created_at: 2026-09-08T07:44:24Z
updated_at: 2026-09-09T15:53:00Z
depends_on: []
related_nodes: [spec-total-cashflow-system]
resource_scope:
  - packages/core/src
  - packages/api/src
  - packages/web/src
  - migrations
purpose: 使わない機能が残っているせいで、画面にも保守にも「判断しなくてよいこと」が増え続けている。確定申告の準備と領収書/証憑の取り込みは U1 の本質的目的に一切資さないため取り除く。あわせて freeeOnly 一覧が二重登録候補に見える表示を、実際の意味である全分割の残余へ合わせる。
goal: 確定申告・領収書/証憑に関する画面・API・保存・専用テーブルがactive runtime surfaceから消え、TotalCashflow 画面の freeeOnly 一覧が「二重登録として外す」入口を持たず、恒等式 matched + freeeOnly + excluded === deals.length を保ったまま、その一覧が取込の抜け漏れを件数で確かめるための内訳であると画面から読み取れる状態。
scope_in:
  - 確定申告の準備機能 (/tax) の全廃。画面・route 定義・API・core モジュール・専用テストを含む
  - 領収書/証憑の取り込みと保管機能の全廃。証憑の登録・保管・取得・ZIP 出力・残数表示・取込元プロファイルと上書き・維持ジョブと予算枠・監査対象宣言・mutation fence 定義まで含む
  - Release AとしてDBの現行headを0038に進め、R2削除intentを共通outboxへ退避する。旧専用6テーブルはruntime/API/Drizzleから退役させるが、物理削除は将来の別変更であるRelease Bへ分離する
  - 証憑機能にのみ紐づく R2 オブジェクトの利用終了。FILES バインディング自体は改善リクエストのスクリーンショットと夜間バックアップが使用中のため残す
  - 他機能に残る証憑への参照の除去。現金の記帳の添付列、取込明細の添付件数表示、バックアップ snapshot の証憑項目、core の re-export、削除・取込ライフサイクルに組み込まれた添付の親収束処理を含む
  - 削除対象のテストに埋もれている無関係な保証の退避。夜間バックアップが R2 へ書けることの唯一の実行証跡が証憑のテスト内にあるため、削除の前に独立したテストへ切り出す
  - scheduled maintenance の D1 クエリ予算表を、専用の証憑維持ジョブを共通`r2_cleanup`へ統合した構成で再宣言する
  - 削除対象にのみ紐づくテストの削除と、残る機能のテストが緑であることの維持
  - TotalCashflow の freeeOnly 一覧から「二重登録として外す」操作を外し、見出しと説明を全分割の残余として読める表現へ変更
scope_out:
  - excluded (freee 内部で同じ支払が2件入っている場合の除外) の機能そのもの。対象が freee 内部の重複であり MF 重複とは別問題のため残す
  - matched 行の「二重登録として外す」と、その既定理由が消し込み理由で埋まること。利用者の指摘は freeeOnly 一覧に限られており、matched 行の是非は別途判断を要する
  - 消し込み規則・合算・トレンド判定のロジック変更
  - 現金の記帳・取込明細・未決済の機能本体
  - system-spec の確定章の変更。差分ヒアリング結果は no_spec_delta で R4-reopen を要さない
  - R2 バケットと FILES バインディングの廃止。改善リクエストのスクリーンショット保存と D1 の夜間バックアップ先として継続利用する
  - 取込原本の R2 保管と共通 retention cleanup の廃止。active・30日以内・処理中の原本を保護し、期限超過した inactive 原本だけを削除する現行ライフサイクルを維持する
  - 旧専用6テーブルの物理削除と0039の追加。cleanupのpending/retry/deadと旧`attachments`・`attachment_cleanup_jobs`の残件0を機械ゲートで確認する将来のRelease B変更が担う
  - 歴史migration・archive文書・廃止済みノードの判断履歴の削除。現行案内と区別できる注記を付けて保持する
  - "`cash_entries.receipt_waived`の削除。交通費入力の互換フィールドであり、証憑保管機能ではない"
  - 改善要望の画像添付の削除。証憑機能とは別の現行機能である
acceptance:
  - active runtime surface（route登録・API route登録・Drizzle schema・navigation・scheduled job・public export）に、廃止した確定申告・領収書/証憑機能の入口または専用定義が存在しない
  - 現行repositoryのmigration head・schema guard・local preview適用上限が0038であり、将来の0039を配布物に含めていない
  - /tax と /tax/receipts への遷移入口がサイドバーにも routeMetadata にも存在しない
  - TotalCashflow の freeeOnly 行に「二重登録として外す」操作が0件である
  - matched 行の「二重登録として外す」は従来どおり動作し、既存の除外テストが緑のままである
  - matched + freeeOnly + excluded === deals.length が全期間で成立する契約テストが緑である
  - R2 の FILES バインディングが残り、改善リクエストのスクリーンショットの既存テストが緑である
  - 夜間バックアップが scheduled 経由で backups/YYYY-MM-DD.json を書き 30 日超を削除することを、証憑機能に依存しない独立したテストが検証しており緑である
  - scheduled maintenance の D1 クエリ予算表が共通`r2_cleanup`のactive原本guardを含む7 job・46 queriesで再宣言され、実装と既存テストが一致する
  - 型検査・lint・全テストが緑で、削除により参照不能となったシンボルが0件である
  - 取込原本のactive・recent・processing保護と期限超過inactive削除、現金記帳、交通費記帳が、それぞれ証憑機能に依存しない独立した回帰テストで検証され緑である
architecture_refs: [arch-total-cashflow-system]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 0.97
classification_reason: purpose/goal/scope_in/scope_out/acceptance/architecture_refs を第一級に持つマクロ層の機能単位であり、実装手順を持たないため task 候補との margin が大きい
classification_candidates:
  - {artifact_kind: feature, confidence: 0.97, candidate_path: features/feature-retire-tax-receipt-and-clarify-freee-only.md}
  - {artifact_kind: task, confidence: 0.09, candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only.md}
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-jkw
  linked_at: 2026-09-08T10:08:57Z
  sync_state: synced
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence:
  policy: manual
  status: open
  source: null
  completed_at: null
  reconciled_at: null
  evidence_refs: []
implementation_readiness:
  status: complete
  missing_sections: []
  checked_at: 2026-09-08T07:57:20Z
---

# 目的

使わない機能が残っていることの費用は、コード量ではなく「利用者が判断しなくてよいことを判断させられる」ことにある。変更前のサイドバーにあった「申告」グループは、確定申告の準備と領収書の残りという2つの入口を常時提示していたが、いずれも本システムの本質的目的 (U1: 事業と家計を合算したトータル収支を、消し込んだ根拠ごと確認できる状態を保つ) に資さない。利用者は「念のため残す」という判断も不要であると明示した。

変更前の TotalCashflow 画面にも同じ費用が出ていた。一致にも除外にも入らない freee の残余行すべてに「二重登録として外す」ボタンが並び、残余集合そのものが二重登録候補に見えていた。現在はこの操作を外し、集合の意味をそのまま表示している。根拠は次節に記す。

# 到達状態

確定申告・領収書/証憑に関する画面・API・保存・専用テーブルがactive runtime surfaceから消え、TotalCashflow 画面の freeeOnly 一覧が「二重登録として外す」入口を持たず、恒等式 matched + freeeOnly + excluded === deals.length を保ったまま、その一覧が取込の抜け漏れを件数で確かめるための内訳であると画面から読み取れる状態。

freeeOnly を一律に二重登録候補と扱えない根拠は `packages/core/src/total-cashflow.ts` の定義そのものにある。

第一に、全 freee 取引は matched (一致したもの)・excluded (総額から外したもの)・freeeOnly (そのどちらにも入らない残り) の3集合へ漏れなく重複なく分けられ、その合計が取込件数と一致する。これは照合結果の集合区分であり、MF側に相手が存在しないという業務事実を断定する分類ではない。この恒等式は「取り込んだ内容に抜け漏れが無いか」に件数で答えるために置かれており、G3 (合計を利用者の手で検算できる) に直接資する。freeeOnly の金額は事業費・事業収入の合計に既に算入されており、合計から差し引かれるのは excluded だけである。

第二に、excluded が対象としているのは freee 内部の二重登録であって MF との重複ではない。`total-cashflow.ts:54-60` は「消し込み (MF との重複) とは別の問題である。消し込みは同じ支払が2つの家計簿に出ていることへの対処で、freee 側は正しい1件。こちらは freee そのものに同じ支払が2件入っている場合」と明記している。

したがって、matchedにもexcludedにも入らないというだけで二重登録とは判定できない。変更前に freeeOnly の全行へ無条件で除外操作を並べていた画面が誤りであり、現在の画面は操作を置かず「一致にも除外にも入らない残り」という残余定義だけを示す。利用者の「ここで外す対応は不要」という直観は正しい。

なお matched 行には同じ操作があり、その既定理由が消し込み理由 (`日付と金額が一致`) で埋まる。freee 内部の二重登録を外す理由として消し込み理由を既定にするのは筋が通らないが、利用者の指摘は freeeOnly 一覧に向けられており、matched 行の扱いは別途判断を要するため本 feature の範囲外とする。

# スコープ

## In

- 確定申告の準備機能 (/tax) の全廃
- 領収書/証憑の取り込みと保管機能の全廃 (登録・保管・取得・ZIP 出力・残数表示・取込元プロファイル・維持ジョブと予算枠・監査対象宣言・mutation fence 定義を含む)
- Release AとしてDBの現行headを0038に進め、R2削除intentを共通outboxへ退避する。旧専用6テーブルはruntime/API/Drizzleから退役させるが、物理削除はcleanupのpending/retry/deadと旧`attachments`・`attachment_cleanup_jobs`の残件0を機械ゲートで確認する将来の別変更（Release B）へ分離する
- 証憑機能にのみ紐づく R2 オブジェクトの利用終了 (バインディング自体は残す)
- 他機能に残る証憑への参照の除去 (現金の記帳の添付列、取込明細の添付件数表示、バックアップ snapshot の証憑項目、core の re-export、削除・取込ライフサイクルに組み込まれた添付の親収束処理)
- 削除対象のテストに埋もれている無関係な保証の退避と、専用の証憑維持ジョブを共通`r2_cleanup`へ統合した予算表の再宣言
- 削除対象にのみ紐づくテストの削除
- TotalCashflow の freeeOnly 一覧から「二重登録として外す」操作を外し、見出しと説明を全分割の残余として読める表現へ変更

スコープは能力単位で書いてある。個々のファイルまで降ろすのは plan (P01..P13) の責務であり、ここでファイルを列挙すると必ず漏れる。実際に予備調査でも `packages/core/src/index.ts` の re-export、`packages/api/src/attachment-{archive,availability,recovery}.ts`、`canonical-mutation-fence.ts`、`store.ts` のバックアップ snapshot が最初の列挙から漏れていた。

削除で最も危ういのはコードではなくテストである。夜間バックアップが R2 へ実際に書けたことを検証している唯一のアサーションは `packages/api/src/attachments-lifecycle.test.ts:907` にあり、「添付ジョブが落ちても夜間バックアップは書かれている」ことを担保している。証憑機能ごとこのファイルを消すと、無関係な機能の唯一の実行証跡が黙って消える。テストが減っても全テストは緑のままなので、受入条件を「全テストが緑」だけにしておくと検出できない。だから独立したテストへの退避を scope_in と受入条件の両方に明示している。

## Out

- excluded (freee 内部の二重登録を外す) の機能そのもの。対象が別問題であり、残さないと freee 側の重複が事業費を膨らませたままになる
- matched 行の「二重登録として外す」と既定理由の妥当性。別途判断を要する
- 消し込み規則・合算・トレンド判定のロジック変更
- 現金の記帳・取込明細・未決済の機能本体
- system-spec の確定章の変更。差分ヒアリングの結論は no_spec_delta である
- R2 バケットと FILES バインディングの廃止。改善リクエストのスクリーンショットと D1 の夜間バックアップが同じバインディングを使っているため、証憑と一緒に消すと無関係な機能が壊れる
- 取込原本の R2 保管と共通 retention cleanup の廃止。証憑と同じ R2 を使うが、active・30日以内・処理中を保護し、期限超過 inactive だけを削除する独立した現行ライフサイクルである
- 旧専用6テーブルの物理削除と0039の追加。cleanupのpending/retry/deadと旧`attachments`・`attachment_cleanup_jobs`の残件0を機械ゲートで確認する将来のRelease B変更が担う
- 歴史migration・archive文書・廃止済みノードの判断履歴の削除。これらは現行案内と区別できる注記を付けて保持する
- `cash_entries.receipt_waived`の削除。交通費入力の互換フィールドであり、証憑保管機能ではない
- 改善要望の画像添付の削除。証憑機能とは別の現行機能である

# 受入

- active runtime surface（`APP_ROUTES` / `ROUTE_COMPONENTS`、API route登録、`db/schema.ts`、navigation、scheduled job、public export）に、廃止した確定申告・領収書/証憑機能の入口または専用定義が存在しない。Release Aで物理D1に残り得る互換テーブル、歴史migration・archive・retired/superseded文書、交通費互換の`receiptWaived`、改善要望の画像添付、後始末中の共通`r2_cleanup`にある`retired_attachment` purposeはこの検査の対象外とする
- 現行repositoryのmigration head・schema guard・local preview適用上限が0038であり、将来の0039を配布物に含めていない
- /tax と /tax/receipts への遷移入口がサイドバーにも routeMetadata にも存在しない
- TotalCashflow の freeeOnly 行に「二重登録として外す」操作が0件である
- matched 行の「二重登録として外す」は従来どおり動作し、既存の除外テストが緑のままである
- matched + freeeOnly + excluded === deals.length が全期間で成立する契約テストが緑である
- R2 の FILES バインディングが残り、改善リクエストのスクリーンショットの既存テストが緑である
- 夜間バックアップが scheduled 経由で `backups/YYYY-MM-DD.json` を書き 30 日超を削除することを、証憑機能に依存しない独立したテストが検証しており緑である
- scheduled maintenance の D1 クエリ予算表が共通`r2_cleanup`のactive原本guardを含む7 job・46 queriesで再宣言され、実装と既存テストが一致する
- 型検査・lint・全テストが緑で、削除により参照不能となったシンボルが0件である
- 取込原本のactive・recent・processing保護と期限超過inactive削除、現金記帳、交通費記帳が、それぞれ証憑機能に依存しない独立した回帰テストで検証され緑である

# アーキテクチャ参照

- `arch-total-cashflow-system` — 7つの確定技術章の projection。本 feature が触る層の境界 (core は D1 も Workers も知らない、Hono の route は入出力変換のみ) と、テーブル削除が従うマイグレーション方式を持つ。
- 関連: `spec-total-cashflow-system` — 恒等式と帰属規則の仕様。本 feature は規則を変更せず、規則が保たれていることを削除後も示す責任を負う。

# 機能間依存

なし。本 feature は既存機能の範囲縮小と表示是正であり、他の feature の完了を前提としない。`depends_on` は空である。

# Handoff

本 feature は macro 層の成果物であり、P01..P13 の13 task specs は external plugin system-dev-planner が `/dev-graph plan --feature-id feature-retire-tax-receipt-and-clarify-freee-only --feature-context features/feature-retire-tax-receipt-and-clarify-freee-only.context.json` で生成する。dev-graph 側では phase task を生成しない。tracker_binding は beads であり、bd issue と blocks 辺への投影は sync が担う。
