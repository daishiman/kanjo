---
graph_node_id: "feat-cash-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "現金入力画面 (17-cash) の作り直しと合計・絞り込み・入力経路の導出の core 単一化、論理削除と元に戻す"
project_id: "kanjo"
domain: "cash"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "cash-screen", "feature"]
file_path: "features/feat-cash-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "1221f8ca97807d3e6c114b97768bd0b8a92ceba1ada8a80325cbdfffb8152c5b"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-cash-screen.md", "source_version": "0.1.11", "source_digest": "8f4fcded525bc397055a816b7d4f8536abca946e7b8ccc3799714e951e0f93ed", "imported_at": "2026-09-21T23:02:14Z"}
created_at: "2026-09-21T23:02:14Z"
updated_at: "2026-09-21T23:02:14Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-backend", "arch-cash-database", "arch-cash-auth", "arch-cash-security", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
resource_scope: [".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "architecture/cash-auth.md", "architecture/cash-backend.md", "architecture/cash-database.md", "architecture/cash-frontend.md", "architecture/cash-infrastructure.md", "architecture/cash-maintenance-ops.md", "architecture/cash-security.md", "architecture/cash-ui-ux.md", "design/FINAL-UI/images/17-cash.png", "migrations", "package.json", "packages/api/src/audit-log.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/cash-lifecycle.test.ts", "packages/api/src/db/schema.ts", "packages/api/src/deletion-lifecycle.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/index.ts", "packages/api/src/routes/cash.ts", "packages/api/src/routes/imports.ts", "packages/api/src/routes/settings.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/schema-guard.test.ts", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/api/src/transit-lifecycle.test.ts", "packages/core/src/cash-screen.ts", "packages/core/src/cash.ts", "packages/core/src/dataset.ts", "packages/core/src/deletion.ts", "packages/core/src/index.ts", "packages/core/test/cash-contract.test.ts", "packages/core/test/cash-screen.test.ts", "packages/core/test/deletion-scope-contract.test.ts", "packages/web/package.json", "packages/web/scripts", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/api.ts", "packages/web/src/backup-restore.dom.test.tsx", "packages/web/src/cash-duplicate.dom.test.tsx", "packages/web/src/cash-transit-regression.test.ts", "packages/web/src/common-shell-routes.dom.test.tsx", "packages/web/src/pages/Cash.tsx", "packages/web/src/pages/cash", "packages/web/src/routeMetadata.ts", "packages/web/src/settings-restore.dom.test.tsx", "packages/web/src/styles.css", "specs/spec-cash-screen.md"]
purpose: "現金入力画面を、利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、銀行・カードの取込に乗らない現金の支払い・受け取りと交通費を外出から戻ったその場で入力し、同じ画面で一覧と合計を見て訂正まで済ませられる場にする。入力途中の離脱と誤削除で記録が欠けないこと (下書きの自動保存と、論理削除による元に戻す) を通じて、集計・月次クローズ・AI分析の入力である台帳から現金の欠けを無くす。"
goal: "/cash が 17-cash.png の構成 (問いの見出し・共通の期間と対象期間カード・通常入力 / 交通費入力のタブ・入力 2 枚・現金明細の一覧 (月送り・検索・4 種の絞り込み・詳細検索・収入 / 支出 / 差額の合計・選択・ページング)・インラインの削除確認と元に戻すトースト・空状態・下部固定の追加バー) を領収書欄だけ除いてトークンと共通部品で描画し、合計・絞り込み・ページング・入力経路・交通費合計・入力検証が core の cash-screen 1 か所で導かれて API と web が写すだけになり、追加のみの migration 0052 と削除・復元・一括削除・一括復元の経路で削除した明細が同じ id のまま戻り、削除中の行が cash_entries を読む全経路 5 本から外れ (JSON 復元の件数判定だけは例外、qa-cash-decision-009)、30 日後に夜間処理で完全に消え、他の利用者の行は 404、不正な入力は 400 になり、旧 Cash.tsx の操作を失わず分割された状態。"
scope_in: ["現金入力画面 (17-cash.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。packages/web/src/pages/Cash.tsx を packages/web/src/pages/cash/ 配下 (画面本体・view-model・下書き・通常入力・交通費入力・一覧・削除確認・ResultNotices・空状態・下部固定バー) へ分割し、選択中のタブ・月・絞り込み・ページを URL に保つ (I1)", "通常入力と交通費入力の 2 タブ。交通費は出発駅・到着駅の入替、往復の自動計算、業務の目的 (固定選択肢＋その他)", "一覧の月送り (共通の期間の範囲内)、キーワード検索、収支・カテゴリ・担当者・入力経路の絞り込み、詳細検索 (金額と日付の範囲)、収入 / 支出 / 差額の合計、選択と一括削除、ページング", "packages/core/src/cash-screen.ts の純関数 (合計・絞り込み・ページング・入力経路・交通費合計・入力検証) (I2)", "追加のみの migration 0052 (cash_entries への owner・transit_purpose・deleted_at と索引)。schema.ts と runtimeSchemaGuard の期待 migration を 0052 へ進める (I3)", "API: DELETE /api/cash-entries/:id の論理削除化、POST /api/cash-entries/:id/restore・POST /api/cash-entries/bulk-delete・POST /api/cash-entries/bulk-restore の新設、GET / POST / PUT の変更、cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) への deleted_at IS NULL と JSON 復元の件数の例外 (qa-cash-decision-009) (I3)", "夜間 scheduled 処理 (0 18 * * *) への完全消去 job の相乗りと、計画上限 SCHEDULED_D1_QUERY_PLAN_MAX を 47→49 へ上げること (qa-cash-decision-008)。cron は guard の外で動くため Migrate→Deploy の順序で守る", "下書きのブラウザ内自動保存と保存時刻の表示、インラインの削除確認と削除完了トーストの『元に戻す』、画面内だけのサンプル表示、下部固定の追加バー (I4 / I5)", "入力検証 (名義・業務の目的・カテゴリの候補、文字数、金額の範囲) を core と API の zod で揃え、他の利用者の行を 404 にする (I6)", "core・API・DOM テストと、web の check:cash-screen の verify:full への組み込み"]
scope_out: ["領収書ファイルの保存。以前の廃止決定を維持し、欄の代わりに freee への保管を案内する (qa-cash-decision-001)", "取込 (MF / freee) の現金明細を一覧に混ぜること (qa-cash-decision-004)", "共通シェル (パンくず・取引ライン・最終更新・検索・サイドバーの月次クローズ・フッター) の変更。既存の PageShell / Layout のまま使う", "担当者の自由登録と管理画面 (qa-cash-decision-002)。表示名は既存の名義ラベル (owner_labels) の設定に従う", "モバイル・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)", "既存の cash_entries の行と、集計結果 (cashToDeal / cashToTx) の書き換え", "税務判断 (税務上の正本は freee)"]
acceptance: ["S1 (G1): /cash で 17-cash.png の構成要素 (領収書欄を除く) がすべて描画され、色・余白・部品はトークンと共通部品経由で、直書き色の lint が 0 件、読込 / 空 / 失敗の各状態が DOM テストで固定されている。", "S2 (G2): 削除した現金明細が『元に戻す』(単体と一括) で同じ id のまま一覧に戻り、削除中は一覧・合計・取引・集計・バックアップ・取込時の設定スナップショット・科目使用状況のどこにも現れず (JSON 復元の件数判定だけ例外)、30 日の期限が 29 日と 31 日の境界値で固定され、入力途中の内容が再読込後に復元される。", "S3 (G3): 合計・絞り込み・ページング・入力経路・交通費合計・入力検証が core の cash-screen だけで計算され、API と web はその結果を写すだけであることが core の境界値テストと API の Contract tests で固定されている。", "S4 (G4): 他の利用者の明細の取得・変更・削除・復元・一括削除・一括復元が 404 になり (一括は 1 件でも他人の id を含めば何も変えない)、不正な入力 (実在しない日付、範囲外の金額、候補外の名義・カテゴリ・業務の目的、長すぎる文字列) が 400 になり、削除中の行の PUT も 404 になる。", "S5 (全体): migration 0052 の適用で既存行の更新が 0 件、夜間予算テストが total === PLAN_MAX (49) を固定し、verify:full・skills:test・初期 JS 予算が緑で、旧 Cash.tsx にあった操作がすべて新しい構成から実行できる。受入は実行済みの最新のテスト証跡だけで判定する。"]
architecture_refs: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-backend", "arch-cash-database", "arch-cash-auth", "arch-cash-security", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "入力経路と合計・絞り込みの導出 (core) → 論理削除・復元・一括の経路と全読取経路の条件 (API) → owner / transit_purpose / deleted_at の列 (migration 0052) → 夜間の完全消去 (cron) → 入力 2 枚・一覧・削除確認・元に戻す (画面) が、同じ『削除中の行を読まない』契約と同じ core の判定を起点に連鎖する 1 つの価値単位で、画面だけ・API だけでは『入力から訂正までを 1 画面で終え、記録が欠けない』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-cash-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T23:02:14Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# 目的

現金入力画面を、利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、銀行・カードの取込に乗らない現金の支払い・受け取りと交通費を外出から戻ったその場で入力し、同じ画面で一覧と合計を見て訂正まで済ませられる場にする。入力途中の離脱と誤削除で記録が欠けないこと (下書きの自動保存と、論理削除による元に戻す) を通じて、集計・月次クローズ・AI分析の入力である台帳から現金の欠けを無くす。

規範 (要件・業務規則・確定意思決定 qa-cash-decision-001〜010) の正本は `specs/spec-cash-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/cash が 17-cash.png の構成 (問いの見出し・共通の期間と対象期間カード・通常入力 / 交通費入力のタブ・入力 2 枚・現金明細の一覧 (月送り・検索・4 種の絞り込み・詳細検索・収入 / 支出 / 差額の合計・選択・ページング)・インラインの削除確認と元に戻すトースト・空状態・下部固定の追加バー) を領収書欄だけ除いてトークンと共通部品で描画し、合計・絞り込み・ページング・入力経路・交通費合計・入力検証が core の cash-screen 1 か所で導かれて API と web が写すだけになり、追加のみの migration 0052 と削除・復元・一括削除・一括復元の経路で削除した明細が同じ id のまま戻り、削除中の行が cash_entries を読む全経路 5 本から外れ (JSON 復元の件数判定だけは例外、qa-cash-decision-009)、30 日後に夜間処理で完全に消え、他の利用者の行は 404、不正な入力は 400 になり、旧 Cash.tsx の操作を失わず分割された状態。

## スコープ

- スコープ内:
  - 現金入力画面 (17-cash.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。packages/web/src/pages/Cash.tsx を packages/web/src/pages/cash/ 配下 (画面本体・view-model・下書き・通常入力・交通費入力・一覧・削除確認・ResultNotices・空状態・下部固定バー) へ分割し、選択中のタブ・月・絞り込み・ページを URL に保つ (I1)
  - 通常入力と交通費入力の 2 タブ。交通費は出発駅・到着駅の入替、往復の自動計算、業務の目的 (固定選択肢＋その他)
  - 一覧の月送り (共通の期間の範囲内)、キーワード検索、収支・カテゴリ・担当者・入力経路の絞り込み、詳細検索 (金額と日付の範囲)、収入 / 支出 / 差額の合計、選択と一括削除、ページング
  - packages/core/src/cash-screen.ts の純関数 (合計・絞り込み・ページング・入力経路・交通費合計・入力検証) (I2)
  - 追加のみの migration 0052 (cash_entries への owner・transit_purpose・deleted_at と索引)。schema.ts と runtimeSchemaGuard の期待 migration を 0052 へ進める (I3)
  - API: DELETE /api/cash-entries/:id の論理削除化、POST /api/cash-entries/:id/restore・POST /api/cash-entries/bulk-delete・POST /api/cash-entries/bulk-restore の新設、GET / POST / PUT の変更、cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) への deleted_at IS NULL と JSON 復元の件数の例外 (qa-cash-decision-009) (I3)
  - 夜間 scheduled 処理 (0 18 * * *) への完全消去 job の相乗りと、計画上限 SCHEDULED_D1_QUERY_PLAN_MAX を 47→49 へ上げること (qa-cash-decision-008)。cron は guard の外で動くため Migrate→Deploy の順序で守る
  - 下書きのブラウザ内自動保存と保存時刻の表示、インラインの削除確認と削除完了トーストの『元に戻す』、画面内だけのサンプル表示、下部固定の追加バー (I4 / I5)
  - 入力検証 (名義・業務の目的・カテゴリの候補、文字数、金額の範囲) を core と API の zod で揃え、他の利用者の行を 404 にする (I6)
  - core・API・DOM テストと、web の check:cash-screen の verify:full への組み込み
- スコープ外:
  - 領収書ファイルの保存。以前の廃止決定を維持し、欄の代わりに freee への保管を案内する (qa-cash-decision-001)
  - 取込 (MF / freee) の現金明細を一覧に混ぜること (qa-cash-decision-004)
  - 共通シェル (パンくず・取引ライン・最終更新・検索・サイドバーの月次クローズ・フッター) の変更。既存の PageShell / Layout のまま使う
  - 担当者の自由登録と管理画面 (qa-cash-decision-002)。表示名は既存の名義ラベル (owner_labels) の設定に従う
  - モバイル・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)
  - 既存の cash_entries の行と、集計結果 (cashToDeal / cashToTx) の書き換え
  - 税務判断 (税務上の正本は freee)

## 受入

- [ ] S1 (G1): /cash で 17-cash.png の構成要素 (領収書欄を除く) がすべて描画され、色・余白・部品はトークンと共通部品経由で、直書き色の lint が 0 件、読込 / 空 / 失敗の各状態が DOM テストで固定されている。
- [ ] S2 (G2): 削除した現金明細が『元に戻す』(単体と一括) で同じ id のまま一覧に戻り、削除中は一覧・合計・取引・集計・バックアップ・取込時の設定スナップショット・科目使用状況のどこにも現れず (JSON 復元の件数判定だけ例外)、30 日の期限が 29 日と 31 日の境界値で固定され、入力途中の内容が再読込後に復元される。
- [ ] S3 (G3): 合計・絞り込み・ページング・入力経路・交通費合計・入力検証が core の cash-screen だけで計算され、API と web はその結果を写すだけであることが core の境界値テストと API の Contract tests で固定されている。
- [ ] S4 (G4): 他の利用者の明細の取得・変更・削除・復元・一括削除・一括復元が 404 になり (一括は 1 件でも他人の id を含めば何も変えない)、不正な入力 (実在しない日付、範囲外の金額、候補外の名義・カテゴリ・業務の目的、長すぎる文字列) が 400 になり、削除中の行の PUT も 404 になる。
- [ ] S5 (全体): migration 0052 の適用で既存行の更新が 0 件、夜間予算テストが total === PLAN_MAX (49) を固定し、verify:full・skills:test・初期 JS 予算が緑で、旧 Cash.tsx にあった操作がすべて新しい構成から実行できる。受入は実行済みの最新のテスト証跡だけで判定する。

## アーキテクチャ参照

- `architecture_refs`: `arch-cash-ui-ux`, `arch-cash-frontend`, `arch-cash-backend`, `arch-cash-database`, `arch-cash-auth`, `arch-cash-security`, `arch-cash-infrastructure`, `arch-cash-maintenance-ops`
- 領域別の制約と既存実装の是正点は各ノードの本文 (`architecture/cash-ui-ux.md`, `architecture/cash-frontend.md`, `architecture/cash-backend.md`, `architecture/cash-database.md`, `architecture/cash-auth.md`, `architecture/cash-security.md`, `architecture/cash-infrastructure.md`, `architecture/cash-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-cash-screen` (feature ノードへの依存は無い)
- 依存理由: 入力経路の導き方・合計と絞り込みの規則・論理削除と 30 日の完全消去・JSON 復元の件数の例外・夜間予算 49・入力検証の上限の決定が確定していないと、core の返り値型・API 応答・migration 0052 の列・テストの期待値が実装中に揺れるため。AI分析 (#66)・明細仕分け (#65)・決算書 (#64)・家計収支 (#62) の各画面は main に取り込み済みで、未完了の feature に依存しない。
- 重複の不在: 既存の feature はいずれも現金入力画面の中身を scope_in に持たない。feature-retire-tax-receipt-and-clarify-freee-only は領収書の廃止を完了済みで、本 feature はその決定を維持するだけで再実装しない。共通の usePeriod と PageShell は使うだけで構造を変えない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-cash-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-cash-screen --feature-context features/feat-cash-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-cash-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- `resource_scope` は本体ファイルに加え、Cash.tsx の import 先 (api.ts・routeMetadata・styles.css)、Cash.tsx を import するファイル (AuthenticatedApp.tsx と DOM テスト)、cash_entries を読む全経路 (store.ts・routes/imports.ts・routes/settings.ts) とそのテスト、runtimeSchemaGuard、夜間予算、反映手順の workflow まで引いた。新設予定の `packages/core/src/cash-screen.ts`・`packages/core/test/cash-screen.test.ts`・`packages/web/src/pages/cash/` は予定の置き場所であり、名前は該当 task の設計で確定する。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S5 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (本文で「agent 推定・利用者未確認」と注記した値: 業務の目的の保存形、下書きのキーと上限、ownerLabel(null) の表示、交通費カードの細部など) は `specs/spec-cash-screen.md` の未決事項を正本とし、該当 task の契約テストで確定する。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
