---
graph_node_id: "feat-ai-analysis-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "AI分析画面 (12-ai) の作り直しと依頼の段階・版・タブの導出の core 単一化"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "ai-analysis", "feature"]
file_path: "features/feat-ai-analysis-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "29d1ab19bb45bce2141681efa823c5b7313b48e93c2cef05410b67044ab4d746"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-ai-analysis-screen.md", "source_version": "0.1.11", "source_digest": "9231b2bee7b71cff6443d69a1d5256eb749122031d90f79d61636f319d161929", "imported_at": "2026-09-19T13:32:35Z"}
created_at: "2026-09-19T13:32:35Z"
updated_at: "2026-09-19T13:32:35Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-frontend", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-auth", "arch-ai-analysis-security", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops"]
resource_scope: [".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "architecture/ai-analysis-auth.md", "architecture/ai-analysis-backend.md", "architecture/ai-analysis-database.md", "architecture/ai-analysis-frontend.md", "architecture/ai-analysis-infrastructure.md", "architecture/ai-analysis-maintenance-ops.md", "architecture/ai-analysis-security.md", "architecture/ai-analysis-ui-ux.md", "design/FINAL-UI/images/12-ai.png", "docs/ai-screen", "docs/data-schema.md", "docs/design-system.md", "migrations", "package.json", "packages/api/src/ai-lifecycle.test.ts", "packages/api/src/ai/catalog.ts", "packages/api/src/ai/contract.test.ts", "packages/api/src/ai/contract.ts", "packages/api/src/ai/dataset.ts", "packages/api/src/ai/period.ts", "packages/api/src/auth.ts", "packages/api/src/db/schema.ts", "packages/api/src/index.ts", "packages/api/src/owner-domain.test.ts", "packages/api/src/routes/ai.ts", "packages/api/src/routes/improvement.ts", "packages/api/src/schema-guard.test.ts", "packages/api/src/schema-guard.ts", "packages/core/src/ai-screen.ts", "packages/core/src/index.ts", "packages/core/test/ai-screen.test.ts", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/ai-copy-log.dom.test.tsx", "packages/web/src/ai-report-archive.dom.test.tsx", "packages/web/src/ai-report-structure.dom.test.tsx", "packages/web/src/ai-task-collapse.dom.test.tsx", "packages/web/src/api.ts", "packages/web/src/chart-series-contract.test.ts", "packages/web/src/common-shell-routes.dom.test.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/ReportChart.tsx", "packages/web/src/pages/Ai.tsx", "packages/web/src/pages/ai", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/styles.css", "skills/run-kanjo-accounting-report", "specs/spec-ai-analysis-screen.md"]
purpose: "AI分析画面を、利用者 (家計と個人事業を 1 人で見る本人) が AI に分析を依頼し、進み具合を確かめ、返ってきたレポートを根拠と版つきで読んで次の行動へ移るまでを 1 画面で終えられる場にする。アプリ自身は LLM を呼ばず、外部のエージェント (Claude Code / Codex) が依頼ごとの使い捨てトークンで既存の API を呼ぶ構成を保ったまま、依頼の段階・取り消し・やり直し・版の比較・渡すデータの範囲を画面から読めるようにする。"
goal: "/ai が 12-ai.png の構成 (問いの見出し・共通の期間タブ・1.依頼 (補足指示の字数と下書き自動保存・コピー 2 種・使用するデータ)・2.実行中 (7 列の表と段階別の操作)・3.レポート (一覧と検索・JSON 取り込み・4 タブの詳細・版履歴・2 版比較・アーカイブ)・下部の選択中バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、依頼の段階と進捗・T-番号・版の説明・タブの振り分け・JSON エラーの行と位置が core の純関数 1 か所で導かれて画面と agentGuard が同じ判定を使い、cancel / retry / inventory の 3 経路と追加のみの migration 0046 で段階の記録が残り、キャンセル済みトークンが 401 で拒否され、外へ出るのは集計値だけで、大きすぎる body は読み込み前に 413 で止まり、レポート JSON 契約 v3 と skill を変えずに旧 Ai.tsx の操作を失わず分割された状態。"
scope_in: ["AI分析画面 (12-ai.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。packages/web/src/pages/Ai.tsx を packages/web/src/pages/ai/ 配下の部品 (依頼・実行中・レポート一覧・取り込み・詳細・版履歴・版比較・選択中バー) へ分割し、選択中の依頼・レポート・タブを URL の検索パラメータに持つ", "期間を共通の usePeriod (1年 / 2年 / 3年 / 任意) へ統一し旧プリセットを消す。依頼と使用するデータへ渡す from / to を同じ値にする (qa-ai-decision-001)", "packages/core の純関数: 依頼の段階と進捗の導出 (待機中 0% / 実行中 50% / 実行中 75% / 完了 100% / 失敗 / キャンセル と境界 4 件)・T-番号の整形・版の説明の導出・レポートのタブへの振り分け・JSON 取り込みエラーの行と位置の算出を 1 か所に置く", "packages/api: POST /ai/tasks/:id/cancel・POST /ai/tasks/:id/retry・GET /ai/inventory の新設と、POST / GET /ai/tasks の依頼ビュー拡張 (stage / progress / displayId / canceledAt / rejectCount)・エージェントのデータ取得 (data_fetched_at) とレポート送信 (rejected_at / reject_count)・貼り付けの変更。agentGuard はキャンセル済みも 401 で拒否する", "migration 0046 (ai_tasks へ seq / data_fetched_at / rejected_at / reject_count / canceled_at の追加と一意索引 (user_id, seq))。既存行は書き換えず、schema.ts と runtimeSchemaGuard の必須列を揃える", "エージェント経路と貼り付け経路の body 上限 (4 MiB、読み込み前に 413 payload_too_large) とキャンセル・再実行の 4KB 上限、エージェントへ渡すデータセットを集計値だけに保つ検査", "補足指示の下書きの localStorage 保存 (失敗しても入力を止めない)、下部の選択中バー、取り込み先の自動選択と無効化、レポート一覧の検索、結果待ちがあるあいだだけの一覧の取り直しと操作後の該当キーだけの invalidate", "docs/ai-screen/ の規則表 (段階・T-番号・版の説明・タブの振り分け・エラー文言) と、core の境界値テスト・API の Contract tests・DOM テスト。既存の ai-*.dom.test.tsx を新しい部品構成へ移す"]
scope_out: ["アプリからの LLM 呼び出し、依頼の自動送信、キュー・外部ストレージ・LLM の鍵の導入", "レポート JSON 契約 v3 (packages/api/src/ai/contract.ts の reportInputSchema) と skill run-kanjo-accounting-report の変更 (skills:test は緑のまま保つ)", "ヘッダー (パンくず・取引ライン・最終更新・検索) とサイドバー (月次クローズの進捗など) の変更。既存の PageShell のまま使う", "既存の依頼・レポート行の書き換え (seq が NULL の旧依頼は『旧』と作成日で出す)", "新しいログイン手段・長期トークン・secret・binding・外部サービスの登録", "web 以外のプラットフォーム (web SPA 1 系統のレスポンシブで扱う)"]
acceptance: ["S1 (G1): /ai で 12-ai.png の構成要素 (問いの見出し・期間タブ・1.依頼・2.実行中の 7 列の表・3.レポートの一覧と取り込みと詳細 4 タブと版履歴・下部の選択中バー) がすべて描画され、色・余白・部品はトークンと共通 Button 経由で、直書き色が 0 件、読込 / 空 / 失敗の各状態が DOM テストで固定されている。", "S2 (G2): 依頼の段階が記録と現在時刻から core の 1 関数で導かれ、6 条件と境界 4 件 (期限切れと受信の同時成立は完了・キャンセル後の期限切れはキャンセル・差し戻し後の再取得は 75% のまま・期限ちょうどは待機中) が toBe で固定され、画面の段階表示と agentGuard の拒否が同じ判定を使っている。", "S3 (G3): キャンセルでトークンが無効になり行はキャンセルとして残り、失敗・キャンセルの行の再実行で同じ期間と補足指示の新しい依頼が発行されて元の行が残り、結果の無い行だけが削除でき、完了の行の削除は 409 になることが API テストで確かめられている。", "S4 (G4): レポートが要約 / 根拠データ / 改善提案 / 関連リンクの 4 タブへ契約 v3 のフィクスチャどおりに振り分けられ (toEqual)、版履歴の各行に版の説明が出て、2 版比較で差が読め、選択中の依頼・レポート・タブが再読込後も URL から復元される。", "S5 (G5): GET /ai/inventory の件数が同じ期間の D1 行数と一致し、エージェントへ渡すデータセットに明細行と摘要が含まれず、契約 v3 の上限ちょうどの契約適合レポートが report と paste の両方で 413 にならず保存され、上限を 1 バイト超える body は JSON の読み込み前に 413 で止まり、migration 0046 の適用で既存行の更新が 0 件である。", "S6 (全体): verify:full・skills:test・初期 JS 予算が緑で、旧 Ai.tsx にあった操作 (コピーの記録・データセット表示・アーカイブ / 表示・削除の確認) がすべて新しい構成から実行できる。受入は実行済みの最新のテスト証跡だけで判定する。"]
architecture_refs: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-frontend", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-auth", "arch-ai-analysis-security", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "段階の導出 (core) → 依頼ビューと cancel / retry / inventory (API) → 段階の記録列 (migration 0046) → 実行中の表と選択中バーと操作 (画面) → agentGuard の拒否 (認証) が同じ段階の契約を起点に連鎖する 1 つの価値単位で、画面だけ・API だけでは『依頼から版の比較までを 1 画面で終える』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-ai-analysis-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T13:32:35Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

AI分析画面を、利用者 (家計と個人事業を 1 人で見る本人) が AI に分析を依頼し、進み具合を確かめ、返ってきたレポートを根拠と版つきで読んで次の行動へ移るまでを 1 画面で終えられる場にする。アプリ自身は LLM を呼ばず、外部のエージェント (Claude Code / Codex) が依頼ごとの使い捨てトークンで既存の API を呼ぶ構成を保ったまま、依頼の段階・取り消し・やり直し・版の比較・渡すデータの範囲を画面から読めるようにする。

規範 (要件・段階の規則・確定意思決定 qa-ai-decision-001〜009) の正本は `specs/spec-ai-analysis-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/ai が 12-ai.png の構成 (問いの見出し・共通の期間タブ・1.依頼 (補足指示の字数と下書き自動保存・コピー 2 種・使用するデータ)・2.実行中 (7 列の表と段階別の操作)・3.レポート (一覧と検索・JSON 取り込み・4 タブの詳細・版履歴・2 版比較・アーカイブ)・下部の選択中バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、依頼の段階と進捗・T-番号・版の説明・タブの振り分け・JSON エラーの行と位置が core の純関数 1 か所で導かれて画面と agentGuard が同じ判定を使い、cancel / retry / inventory の 3 経路と追加のみの migration 0046 で段階の記録が残り、キャンセル済みトークンが 401 で拒否され、外へ出るのは集計値だけで、大きすぎる body は読み込み前に 413 で止まり、レポート JSON 契約 v3 と skill を変えずに旧 Ai.tsx の操作を失わず分割された状態。

## スコープ

- スコープ内:
  - AI分析画面 (12-ai.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。packages/web/src/pages/Ai.tsx を packages/web/src/pages/ai/ 配下の部品 (依頼・実行中・レポート一覧・取り込み・詳細・版履歴・版比較・選択中バー) へ分割し、選択中の依頼・レポート・タブを URL の検索パラメータに持つ
  - 期間を共通の usePeriod (1年 / 2年 / 3年 / 任意) へ統一し旧プリセットを消す。依頼と使用するデータへ渡す from / to を同じ値にする (qa-ai-decision-001)
  - packages/core の純関数: 依頼の段階と進捗の導出 (待機中 0% / 実行中 50% / 実行中 75% / 完了 100% / 失敗 / キャンセル と境界 4 件)・T-番号の整形・版の説明の導出・レポートのタブへの振り分け・JSON 取り込みエラーの行と位置の算出を 1 か所に置く
  - packages/api: POST /ai/tasks/:id/cancel・POST /ai/tasks/:id/retry・GET /ai/inventory の新設と、POST / GET /ai/tasks の依頼ビュー拡張 (stage / progress / displayId / canceledAt / rejectCount)・エージェントのデータ取得 (data_fetched_at) とレポート送信 (rejected_at / reject_count)・貼り付けの変更。agentGuard はキャンセル済みも 401 で拒否する
  - migration 0046 (ai_tasks へ seq / data_fetched_at / rejected_at / reject_count / canceled_at の追加と一意索引 (user_id, seq))。既存行は書き換えず、schema.ts と runtimeSchemaGuard の必須列を揃える
  - エージェント経路と貼り付け経路の body 上限 (4 MiB、読み込み前に 413 payload_too_large) とキャンセル・再実行の 4KB 上限、エージェントへ渡すデータセットを集計値だけに保つ検査
  - 補足指示の下書きの localStorage 保存 (失敗しても入力を止めない)、下部の選択中バー、取り込み先の自動選択と無効化、レポート一覧の検索、結果待ちがあるあいだだけの一覧の取り直しと操作後の該当キーだけの invalidate
  - docs/ai-screen/ の規則表 (段階・T-番号・版の説明・タブの振り分け・エラー文言) と、core の境界値テスト・API の Contract tests・DOM テスト。既存の ai-*.dom.test.tsx を新しい部品構成へ移す
- スコープ外:
  - アプリからの LLM 呼び出し、依頼の自動送信、キュー・外部ストレージ・LLM の鍵の導入
  - レポート JSON 契約 v3 (packages/api/src/ai/contract.ts の reportInputSchema) と skill run-kanjo-accounting-report の変更 (skills:test は緑のまま保つ)
  - ヘッダー (パンくず・取引ライン・最終更新・検索) とサイドバー (月次クローズの進捗など) の変更。既存の PageShell のまま使う
  - 既存の依頼・レポート行の書き換え (seq が NULL の旧依頼は『旧』と作成日で出す)
  - 新しいログイン手段・長期トークン・secret・binding・外部サービスの登録
  - web 以外のプラットフォーム (web SPA 1 系統のレスポンシブで扱う)

## 受入

- [ ] S1 (G1): /ai で 12-ai.png の構成要素 (問いの見出し・期間タブ・1.依頼・2.実行中の 7 列の表・3.レポートの一覧と取り込みと詳細 4 タブと版履歴・下部の選択中バー) がすべて描画され、色・余白・部品はトークンと共通 Button 経由で、直書き色が 0 件、読込 / 空 / 失敗の各状態が DOM テストで固定されている。
- [ ] S2 (G2): 依頼の段階が記録と現在時刻から core の 1 関数で導かれ、6 条件と境界 4 件 (期限切れと受信の同時成立は完了・キャンセル後の期限切れはキャンセル・差し戻し後の再取得は 75% のまま・期限ちょうどは待機中) が toBe で固定され、画面の段階表示と agentGuard の拒否が同じ判定を使っている。
- [ ] S3 (G3): キャンセルでトークンが無効になり行はキャンセルとして残り、失敗・キャンセルの行の再実行で同じ期間と補足指示の新しい依頼が発行されて元の行が残り、結果の無い行だけが削除でき、完了の行の削除は 409 になることが API テストで確かめられている。
- [ ] S4 (G4): レポートが要約 / 根拠データ / 改善提案 / 関連リンクの 4 タブへ契約 v3 のフィクスチャどおりに振り分けられ (toEqual)、版履歴の各行に版の説明が出て、2 版比較で差が読め、選択中の依頼・レポート・タブが再読込後も URL から復元される。
- [ ] S5 (G5): GET /ai/inventory の件数が同じ期間の D1 行数と一致し、エージェントへ渡すデータセットに明細行と摘要が含まれず、契約 v3 の上限ちょうどの契約適合レポートが report と paste の両方で 413 にならず保存され、上限を 1 バイト超える body は JSON の読み込み前に 413 で止まり、migration 0046 の適用で既存行の更新が 0 件である。
- [ ] S6 (全体): verify:full・skills:test・初期 JS 予算が緑で、旧 Ai.tsx にあった操作 (コピーの記録・データセット表示・アーカイブ / 表示・削除の確認) がすべて新しい構成から実行できる。受入は実行済みの最新のテスト証跡だけで判定する。

## アーキテクチャ参照

- `architecture_refs`: `arch-ai-analysis-ui-ux`, `arch-ai-analysis-frontend`, `arch-ai-analysis-backend`, `arch-ai-analysis-database`, `arch-ai-analysis-auth`, `arch-ai-analysis-security`, `arch-ai-analysis-infrastructure`, `arch-ai-analysis-maintenance-ops`
- 領域別の制約と既存実装の是正点は各ノードの本文 (`architecture/ai-analysis-ui-ux.md`, `architecture/ai-analysis-frontend.md`, `architecture/ai-analysis-backend.md`, `architecture/ai-analysis-database.md`, `architecture/ai-analysis-auth.md`, `architecture/ai-analysis-security.md`, `architecture/ai-analysis-infrastructure.md`, `architecture/ai-analysis-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-ai-analysis-screen` (feature ノードへの依存は無い)
- 依存理由: 段階の 6 条件と優先順位・T-番号の桁・版の説明の規則・タブの振り分け・使用するデータの数え方・body 上限 4 MiB・キャンセル済みの 401 の決定が確定していないと、core の返り値型・API 応答・migration 0046 の列・テストの期待値が実装中に揺れるため。家計収支 (#62)・サブスク (#60)・診断 (#59) の各画面は main に取り込み済みで、未完了の feature に依存しない。
- 重複の不在: 既存の feature はいずれも AI分析画面の中身を scope_in に持たない。共通の usePeriod と PageShell は使うだけで構造を変えない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-ai-analysis-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-ai-analysis-screen --feature-context features/feat-ai-analysis-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-ai-analysis-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- `resource_scope` は本体ファイルに加え、Ai.tsx の import 先 (api.ts・共通部品・routeMetadata)、Ai.tsx を import するファイル (AuthenticatedApp.tsx と DOM テスト)、ai_tasks を参照するテストと runtimeSchemaGuard、反映手順の workflow まで引いた。新設予定の `packages/core/src/ai-screen.ts`・`packages/core/test/ai-screen.test.ts`・`packages/web/src/pages/ai/` は予定の置き場所であり、名前は該当 task の設計で確定する。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S6 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (本文で「agent 推定・利用者未確認」と注記した値: 段階の優先順位、T-番号の桁と採番の再試行、主な発見の選び方、下書きのキーと上限、取り直しの間隔 10 秒、body 上限 4 MiB など) は `specs/spec-ai-analysis-screen.md` の未決事項を正本とし、該当 task の契約テストで確定する。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
