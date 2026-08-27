---
graph_node_id: "feat-deploy-migration-gate"
artifact_kind: "feature"
artifact_subtypes: []
title: "デプロイ前マイグレーション検査ゲート"
project_id: "kanjo"
domain: "infrastructure"
status: "draft"
owners: []
tags: ["server-error-recovery"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-27T05:10:00Z"
updated_at: "2026-08-27T05:10:00Z"
depends_on: ["feat-prod-d1-schema-recovery"]
related_nodes: ["arch-deploy-migration-gate"]
resource_scope: [".github/workflows"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-deploy-migration-gate.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2dde6aca87626ee77917cc4d811146bbc79d62f262391261268ee904affb1c89"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "system-spec/index.md", "source_version": "0.1.9", "source_digest": "2dde6aca87626ee77917cc4d811146bbc79d62f262391261268ee904affb1c89", "imported_at": "2026-08-27T05:10:00Z"}
classification_confidence: 1.0
classification_reason: "C14 decompose がマクロ層 (feature/architecture) として明示生成したため分類は一意。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "blocked", "missing_sections": ["system-spec/completeness-findings.json の verdict: FAIL 解消と再評価"], "checked_at": "2026-08-27T05:10:00Z"}
purpose: "deploy.yml が自動、migrate.yml が手動という非対称のため、コードだけが先行する状態が無検知で成立する。人間の注意力ではなく仕組みで再発を止める。"
goal: "乖離したままのデプロイが本番へ到達できず、判定不能時も停止し、固定の安全な案内からMigrate手動適用へ一意に進める。"
scope_in: ["deploy.yml への検査ステップ追加", "未適用判定", "fail-closed の停止処理", "Wrangler出力を再表示しない固定復旧案内", "3 状態の動作確認"]
scope_out: ["マイグレーションの自動適用", "ロールバックの自動化", "デプロイ承認フローの導入", "migrate.yml の手動運用の変更"]
acceptance: ["未適用が存在する状態で検査ステップが非ゼロ終了し wrangler deploy に到達しない", "未適用が 0 件の状態で検査ステップが通過しデプロイが完了する", "判定不能になった場合もデプロイが停止する", "停止時はWranglerのstdout/stderrを再表示せずMigrate(APPLY)後のDeploy再実行だけを案内する", "実行ログに明細内容・金額・認証診断が含まれない", "検査による D1 への読み取りが 1 デプロイあたり 1 回に収まる"]
architecture_refs: ["arch-deploy-migration-gate"]
---

# 目的

今回の障害は単発の操作ミスではなく、ワークフローの構造から生まれた。`deploy.yml` は push で自動実行される一方、`migrate.yml` は `workflow_dispatch` かつ `confirm == 'APPLY'` の手動専用であり、両者を突き合わせる仕組みがない。この非対称がある限り、「コードだけが進み、スキーマが置き去りになる」状態はいつでも再発する。人間の注意力に頼るのではなく、乖離した状態のデプロイが本番へ到達できないようにする。

## 到達状態

`deploy.yml` のデプロイ直前に検査ステップが存在し、リポジトリの `migrations/` に本番 `d1_migrations` へ未記録のファイルが 1 件でもあればデプロイが停止する。判定自体が失敗した場合も停止する (fail-closed)。停止時は Wrangler の生出力を再表示せず、Migrate workflow の手動適用へ固定文言で案内する。

## スコープ

- スコープ内: `deploy.yml` への検査ステップ追加、`wrangler d1 migrations list --remote` による未適用判定、fail-closed の停止処理、生出力を再表示しない固定復旧案内、乖離あり/なし/判定不能の 3 状態に対する動作確認。
- スコープ外: マイグレーションの自動適用 (ADR D1-migration-gate により権限はユーザーが保持)、ロールバックの自動化、デプロイ承認フローの導入、`migrate.yml` の手動運用の変更。

## 受入

- [ ] 未適用マイグレーションが存在する状態で `deploy.yml` の検査ステップが非ゼロ終了し、`wrangler deploy` に到達しない
- [ ] 未適用が 0 件の状態で検査ステップが通過し、デプロイが従来どおり完了する
- [ ] 認証やネットワークの失敗で判定不能になった場合もデプロイが停止する
- [ ] 停止時は Wrangler の stdout/stderr を再表示せず、Migrate workflow を `APPLY` で手動実行後に Deploy を再実行する一意な案内が出る
- [ ] 実行ログに明細内容・金額が含まれない
- [ ] 検査による D1 への読み取りが 1 デプロイあたり 1 回に収まる

## アーキテクチャ参照

- `architecture_refs`: `arch-deploy-migration-gate`

## 機能間依存

- `depends_on`: `feat-prod-d1-schema-recovery`
- 依存理由: 本番に承認済み pending manifest の未適用が残っている間にゲートを導入すると、すべてのデプロイが即座に停止する。復旧 (同じ repository head / ordered migrations digest に対する未適用 0 件) の達成が本 feature の前提条件である。

## 文書責務

- 恒久 policy と通常の D1 変更手順は `docs/ci-cd-operations.md` を SSOT とする。本 feature は検査ゲートの差分だけを定義し、incident runbook へ通常手順を複製しない。

## Handoff

- per-feature planning: ready 時に `run-system-dev-plan` を `--feature-id feat-deploy-migration-gate` と repo 相対 `--feature-context features/feat-deploy-migration-gate.context.json` で起動する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-deploy-migration-gate` と共通 `feature_package_id` で C02 経由 atomic 登録する (expected/applied = 13)。
- 完了 rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が上記受入 6 件を満たす場合だけ done とする。
