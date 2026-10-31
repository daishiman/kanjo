---
graph_node_id: "feat-classify-bulk-save"
artifact_kind: "feature"
artifact_subtypes: []
title: "明細仕分け一括保存 — 一括指定と保存前の内訳、表示に左右されない選択、6 列の取引一覧、勘定科目の対応表"
project_id: "kanjo"
domain: "classify"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "bulk-save", "feature"]
file_path: "features/feat-classify-bulk-save.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "f0b0a1a8b288f5a152a1b1f2a4c3701b128753ccef2a2fc5c6c248b6c5e851b0", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-classify-bulk-save.md", "source_version": "0.1.11", "source_digest": "ac7d9e19d525eaa77f695f0915992cc40f0307671234aecfd400396e5cc73dc0", "imported_at": "2026-10-01T12:17:32Z"}
created_at: "2026-10-01T12:17:32Z"
updated_at: "2026-10-01T12:17:32Z"
depends_on: ["spec-classify-bulk-save"]
related_nodes: ["arch-classify-bulk-save-ui-ux", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-auth", "arch-classify-bulk-save-security", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops"]
resource_scope: [".github/migration-approvals.json", ".github/scripts/plan-auto-migration.test.mjs", "architecture/classify-bulk-save-auth.md", "architecture/classify-bulk-save-backend.md", "architecture/classify-bulk-save-database.md", "architecture/classify-bulk-save-frontend.md", "architecture/classify-bulk-save-infrastructure.md", "architecture/classify-bulk-save-maintenance-ops.md", "architecture/classify-bulk-save-security.md", "architecture/classify-bulk-save-ui-ux.md", "docs/classify-screen/", "docs/data-schema.md", "migrations/", "migrations/0058_tax_account_map.sql", "migrations/0059_settings_change_log_target.sql", "package.json", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/cash-lifecycle.test.ts", "packages/api/src/classify-bulk.integration.test.ts", "packages/api/src/classify-history.ts", "packages/api/src/classify-list-paging.integration.test.ts", "packages/api/src/classify-row.ts", "packages/api/src/classify-transactions-shape.test.ts", "packages/api/src/d1-limits.ts", "packages/api/src/db/schema.ts", "packages/api/src/deletion-lifecycle.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/import-active.ts", "packages/api/src/import-diff.test.ts", "packages/api/src/import-diff.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/api/src/import-lifecycle.test.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/index.test.ts", "packages/api/src/index.ts", "packages/api/src/migration-test-support.ts", "packages/api/src/routes/admin-users.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/backups.ts", "packages/api/src/routes/cash.ts", "packages/api/src/routes/classify-bulk.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/imports.ts", "packages/api/src/routes/settings-screen.ts", "packages/api/src/routes/settings.ts", "packages/api/src/routes/tax-account-map.ts", "packages/api/src/routes/vendor-memory.ts", "packages/api/src/row-transfer-lifecycle.test.ts", "packages/api/src/scheduled-maintenance-budget.test.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/schema-guard.test.ts", "packages/api/src/schema-guard.ts", "packages/api/src/split-lifecycle.test.ts", "packages/api/src/store.ts", "packages/api/src/users.ts", "packages/api/src/vendor-memory.test.ts", "packages/api/test/", "packages/core/src/cash.ts", "packages/core/src/categories.ts", "packages/core/src/classify-status.test.ts", "packages/core/src/classify-status.ts", "packages/core/src/classify.ts", "packages/core/src/design-tokens.ts", "packages/core/src/index.ts", "packages/core/src/overview.ts", "packages/core/src/settings-json.ts", "packages/core/src/settings-screen.ts", "packages/core/src/tax-accounts.ts", "packages/core/test/", "packages/web/package.json", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/scripts/viewports.mjs", "packages/web/src/api-client.ts", "packages/web/src/api.ts", "packages/web/src/components/Button.tsx", "packages/web/src/components/CategoryPicker.tsx", "packages/web/src/components/SelectionCheckbox.tsx", "packages/web/src/components/classification-invalidate.ts", "packages/web/src/pages/classify/", "packages/web/src/pages/classify/BulkActionBar.tsx", "packages/web/src/pages/classify/ClassifyPage.tsx", "packages/web/src/pages/classify/TransactionTable.tsx", "packages/web/src/pages/classify/view-model.ts", "packages/web/src/pages/settings/", "packages/web/test/import-multifile.dom.test.tsx", "scripts/seed-admin.mjs", "specs/spec-classify-bulk-save.md"]
purpose: "明細仕分け画面で選んだ明細を、提案の有無や表示中のページ・絞り込みに左右されずに、何がどの値で保存されるかを確かめたうえで一括で確定できるようにする。取込直後で取引先の記憶もルールも無い利用者でも未整理を月次クローズまで減らせるようにし、『選んだのに保存できない』『再試行を押しても何も起きない』『一覧が崩れて読めない』ことで仕分けが止まるのを無くす。"
goal: "/classify で、提案の無い明細も一括指定欄で値を決めて保存でき、保存前の内訳で保存する件数と外す件数を確かめられる。選択は URL の sel に行の key で保たれ、サーバが明細を引き直して 1 回の batch (D1 クエリ 49 本以内) で書き、再試行は write_failed の明細と要求全体の失敗 (通信の失敗・5xx・409) にだけ出る。取込直後でも『MF の分類』の提案が付き、勘定科目の対応表を設定画面で編集でき、取引一覧は 1264px でも 6 列で崩れない。lint・typecheck・test・skills:test・初期 JS 予算・verify:full は緑のまま。"
scope_in: ["一括操作バーの一括指定欄 (区分・カテゴリ大/中・所有者・支払い方法) と保存前の内訳 (00 I1)", "POST /api/transactions/bulk の拡張: サーバが明細を引き直して core で値を解決し、1 回の batch で書く (00 I2)", "GET /api/transactions/selected の新設と、一覧の応答から絞り込み後の全件を外すこと (00 I3)", "提案の最後の由来『MF の分類』『MF の分類 (対応表)』(00 I4)", "選択の保持・選べない行の理由・見出しの全選択の 50 件での停止 (00 I5)", "取引一覧の 6 列化・表示件数の選択・編集パネルの可変幅・明細仕分けの画面検査 (00 I6)", "再試行を write_failed の明細と要求全体の失敗に限ること (00 I7)", "勘定科目の対応表: 表・migration・API・設定画面・設定の変更履歴・設定の JSON とバックアップ (00 I8)", "『カテゴリなし』の予約の値 (00 I9)", "上記の認可・入力検証・履歴・テストと、画面検査の記録 (docs/classify-screen/)"]
scope_out: ["選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更", "要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更", "分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更", "絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作", "取込 (CSV の読み込み) の仕様変更、証憑の添付と保管", "モバイル・タブレット・デスクトップ専用アプリ", "Workers Paid などの有料プランへの変更"]
acceptance: ["O1 (G1): 提案の無い明細を一括指定で保存できる (測定基準は 00 U4 の O1)", "O2 (G1): 失敗の種類ごとに、再試行の有無と理由が正しく出る (測定基準は 00 U4 の O2)", "O3 (G2): 取込直後でも明細に提案が付く (測定基準は 00 U4 の O3)", "O4 (G3): 選択がページと絞り込みをまたいで保たれ、サーバが値を解決する (測定基準は 00 U4 の O4)", "O5 (G4): 1264px 幅で取引一覧が崩れない (測定基準は 00 U4 の O5)", "O6 (G5): 保存の経路が認可と入力検証を通る (測定基準は 00 U4 の O6)", "O7 (G1, G2, G3, G4, G5): 既存の品質ゲートを緑のまま保つ (測定基準は 00 U4 の O7)", "O8 (G1): 一括保存が無料枠の 1 起動の上限に収まる (測定基準は 00 U4 の O8)", "O9 (G1): 同じ要求を送り直しても二重に保存されない (測定基準は 00 U4 の O9)"]
architecture_refs: ["arch-classify-bulk-save-ui-ux", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-auth", "arch-classify-bulk-save-security", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "C14 decompose が、確定済みの spec-classify-bulk-save (system-spec の 00 と 8 章を取込済み) を 1 つの macro feature として登録したため分類は一意。13 task への分解は system-dev-planner が行う。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-classify-bulk-save.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-10-01T12:17:32Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

明細仕分け画面で選んだ明細を、提案の有無や表示中のページ・絞り込みに左右されずに、何がどの値で保存されるかを確かめたうえで一括で確定できるようにする。取込直後で取引先の記憶もルールも無い利用者でも未整理を月次クローズまで減らせるようにし、『選んだのに保存できない』『再試行を押しても何も起きない』『一覧が崩れて読めない』ことで仕分けが止まるのを無くす。

規範 (要件・業務規則・API 契約・確定意思決定) の正本は [spec-classify-bulk-save](../specs/spec-classify-bulk-save.md)。`system-spec/` は承認・収集の履歴と現行契約への入口を持つ。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/classify で、提案の無い明細も一括指定欄で値を決めて保存でき、保存前の内訳で保存する件数と外す件数を確かめられる。選択は URL の sel に行の key で保たれ、サーバが明細を引き直して 1 回の batch (D1 クエリ 49 本以内) で書き、再試行は write_failed の明細と要求全体の失敗 (通信の失敗・5xx・409) にだけ出る。取込直後でも『MF の分類』の提案が付き、勘定科目の対応表を設定画面で編集でき、取引一覧は 1264px でも 6 列で崩れない。lint・typecheck・test・skills:test・初期 JS 予算・verify:full は緑のまま。

## スコープ

spec の In 10 項目 (00 I1〜I9 と、認可・入力検証・履歴・テスト・画面検査の記録) を 1 feature で実装する。web・core・api・migration にまたがり、web 以外の platform は対象外 (qa-classify-bulk-decision-067)。 具体的な業務規則・API・保持の規則は [spec のスコープ](../specs/spec-classify-bulk-save.md#スコープ) と「機能要件」「API契約」を参照し、本書に複製しない。

作業可能な path は frontmatter の `resource_scope`。依存・実装配置の最終確認は各 task と architecture を参照する。

## 受入

- [ ] O1 (G1): 提案の無い明細を一括指定で保存できる (測定基準は 00 U4 の O1)
- [ ] O2 (G1): 失敗の種類ごとに、再試行の有無と理由が正しく出る (測定基準は 00 U4 の O2)
- [ ] O3 (G2): 取込直後でも明細に提案が付く (測定基準は 00 U4 の O3)
- [ ] O4 (G3): 選択がページと絞り込みをまたいで保たれ、サーバが値を解決する (測定基準は 00 U4 の O4)
- [ ] O5 (G4): 1264px 幅で取引一覧が崩れない (測定基準は 00 U4 の O5)
- [ ] O6 (G5): 保存の経路が認可と入力検証を通る (測定基準は 00 U4 の O6)
- [ ] O7 (G1, G2, G3, G4, G5): 既存の品質ゲートを緑のまま保つ (測定基準は 00 U4 の O7)
- [ ] O8 (G1): 一括保存が無料枠の 1 起動の上限に収まる (測定基準は 00 U4 の O8)
- [ ] O9 (G1): 同じ要求を送り直しても二重に保存されない (測定基準は 00 U4 の O9)

## アーキテクチャ参照

- `architecture_refs`: `arch-classify-bulk-save-ui-ux`, `arch-classify-bulk-save-frontend`, `arch-classify-bulk-save-backend`, `arch-classify-bulk-save-database`, `arch-classify-bulk-save-auth`, `arch-classify-bulk-save-security`, `arch-classify-bulk-save-infrastructure`, `arch-classify-bulk-save-maintenance-ops`
- 領域別の制約と既存実装の是正点は各ノードの本文 (`architecture/classify-bulk-save-ui-ux.md`, `architecture/classify-bulk-save-frontend.md`, `architecture/classify-bulk-save-backend.md`, `architecture/classify-bulk-save-database.md`, `architecture/classify-bulk-save-auth.md`, `architecture/classify-bulk-save-security.md`, `architecture/classify-bulk-save-infrastructure.md`, `architecture/classify-bulk-save-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-classify-bulk-save` (feature ノードへの依存は無い)
- 依存理由: 規範 (要件・API 契約・業務規則・確定した意思決定) は spec-classify-bulk-save にあり、architecture 8 本はその章ごとの制約である。spec が active/confirmed/pass で ready なので、本 feature は spec だけに依存する。
- 前サイクルとの関係: 前サイクルの feat-classify-screen (specs/spec-classify-screen.md) の画面骨格・KPI・絞り込み・編集パネル・分割・ルール・下書きを引き継ぎ、値の決め方・書き込みの単位・再試行・一覧の列と表示件数・一覧 API の互換だけを置き換える (spec「目的と成功状態」の前サイクルとの関係)。前サイクルの文書は書き換えない。
- 重複の不在: feat-mf-business-classification が足した MF 中項目の対応表の由来 (信頼度 70) は順位も信頼度も変えず、その後ろに由来を 1 つ足すだけである。勘定科目の対応表は新しい表で、既存の表に列を足さない。feat-classify-screen が定めた分割・ルール・下書き・編集パネルの仕様は変えない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-classify-bulk-save` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-classify-bulk-save --feature-context features/feat-classify-bulk-save.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-classify-bulk-save` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- `resource_scope` は spec の変更範囲に、spec と architecture 8 文書、architecture が変更を求めるパス、名前が変わる export の参照元とそのテスト、未決事項 5 の記録先 (`docs/data-schema.md`) を足した。根拠として読むだけのパス (画面の正本の画像・デザイン規約・実データのガードと `.gitignore`・`auth.ts`・`wrangler.jsonc`・`_headers`・CI と Deploy の定義・migration の判定 script・初期 JS 予算の検査) は入れない。ディレクトリで入れたもの (`packages/web/src/pages/classify/`・`packages/api/test/`・`packages/core/test/`・`migrations/`・`docs/classify-screen/`) の下のファイルは個別に挙げない。
- 完了 rollup: exact 13 全 done かつ受入の evidence が揃う場合だけ done にする。
- 破壊的な migration (settings_change_log の作り直し) は `.github/migration-approvals.json` に sha256 を足し、PR の merge を承認とする。
- migration の番号 (0058・0059) は、着手時に origin/main の最新番号と突き合わせて決め直す。並行するサイクルと衝突しうる。
- spec の未決事項 2・5・6・7 は実装の PR で閉じる。7 は新しい持ち主へ初期の 5 行を入れる時機を利用者に示してから入れる。
- 明細仕分けの画面検査は手元の verify:full で走り、CI では走らない。PR の前に手元で verify:full を通す。
- 一括保存の D1 クエリの本数 (50 件・100 件でどちらも 49 本以内) は API テストで数える。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
