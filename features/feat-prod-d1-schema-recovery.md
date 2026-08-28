---
graph_node_id: "feat-prod-d1-schema-recovery"
artifact_kind: "feature"
artifact_subtypes: []
title: "本番 D1 スキーマ復旧 (承認済み pending manifest の適用)"
project_id: "kanjo"
domain: "data"
status: "draft"
owners: []
tags: ["server-error-recovery"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-27T05:10:00Z"
updated_at: "2026-08-27T05:10:00Z"
depends_on: []
related_nodes: ["arch-d1-schema-lifecycle"]
resource_scope: ["docs/runbooks"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-prod-d1-schema-recovery.md"
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
purpose: "事故時に本番 D1 の未適用マイグレーション 0006〜0014 により、データ取込と取込履歴が同時に 500 を返し記帳業務が停止した。実行時点の remote list と repository head から適用対象を再確定し、稼働の回復と既存データの保全を同時に成立させる。"
goal: "承認済み pending manifest の適用後、同じ repository head / ordered migrations digest に対する未適用件数が 0 になり、取込・取込履歴・夜間バックアップが正常化し、適用前後で行の減少が 0 であることを突合で確認できている。"
scope_in: ["適用直前の全件ダンプ取得", "remote list と repository head の突合", "人間承認済み pending manifest", "MigrateをAPPLYで実行するincident checklist", "適用前後の行数突合", "ダンプの安全な削除", "復旧後の動作確認"]
scope_out: ["マイグレーションファイル自体の内容変更", "スキーマ再設計", "CI への検査ゲート追加", "実行時の乖離検知", "D1 以外への移行"]
acceptance: ["適用直前のダンプが取得され主要テーブルの行数が基準値として記録されている", "repository head・ordered migrations digest・remote applied head・ordered pending files・captured_at・approved_atを持つmanifestが人間承認され適用直前の再取得結果と一致している", "wrangler d1 migrations list --remote の未適用件数が 0 である", "適用後の主要テーブル行数が基準値と比べて減少していない", "POST /api/imports と GET /api/imports が本番で正常応答を返す", "夜間 cron バックアップが成功し R2 に当日分のスナップショットが存在する", "取得したダンプが作業完了後に削除されている", "本番への適用コマンドはユーザーが実行しその事実が作業記録に残っている"]
architecture_refs: ["arch-d1-schema-lifecycle"]
---

# 目的

本番の収支統合管理アプリで、データ取込と取込履歴が同時に「サーバーエラーが発生しました」を返し、記帳業務が止まっている。原因は本番 D1 の `d1_migrations` が `0005_sub_vendors.sql` までしか記録しておらず、`0006`〜`0014` が未適用のまま Worker だけが先行デプロイされたことである。コードが要求する `import_runs` / `import_writer_claims` / `import_active_targets` / `cash_entries` / `attachments` / `restored_monthly_agg` / `password_login_rate_limits` が本番に存在しない。加えて夜間 cron バックアップも `cash_entries` 等を参照するため毎晩失敗し続けており、放置すれば「バックアップがある」という前提そのものが崩れたまま時間が過ぎる。

## 到達状態

作業開始時と適用直前の remote list と repository head から確定した承認済み pending manifest が本番 D1 へ順序どおり適用され、同じ repository head / ordered migrations digest に対する未適用件数が 0 になっている。データ取込と取込履歴が正常応答を返し、夜間 cron バックアップが成功へ転じている。適用前後で既存行が 1 行も失われていないことを、適用直前に取得したダンプの行数と突合して確認できている。

## スコープ

- スコープ内: 適用直前の `wrangler d1 export --remote` による全件ダンプ取得、remote list と repository head の突合、人間承認済み pending manifest の確定、`Migrate` を `APPLY` で実行する薄い incident checklist、適用前後の行数突合、ダンプの安全な削除、復旧後の取込・取込履歴・夜間バックアップの動作確認。
- スコープ外: マイグレーションファイル自体の内容変更、スキーマの再設計、CI への検査ゲート追加 (`feat-deploy-migration-gate` の責務)、実行時の乖離検知 (`feat-runtime-schema-guard` の責務)、D1 以外への移行。

## 受入

- [ ] 適用直前のダンプがローカルに取得され、主要テーブルの行数が基準値として記録されている
- [ ] repository head / ordered migrations digest / remote applied head / ordered pending files / captured_at / approved_at を持つ manifest が人間承認され、適用直前の再取得結果と一致している
- [ ] `wrangler d1 migrations list kanjo-db --remote` の未適用件数が 0 である
- [ ] 適用後の主要テーブル行数が基準値と比べて減少していない (減少 0 行)
- [ ] `POST /api/imports` と `GET /api/imports` が本番で正常応答を返す
- [ ] 夜間 cron バックアップが成功し、R2 に当日分のスナップショットが存在する
- [ ] 取得したダンプが作業完了後に削除されている
- [ ] 本番への適用コマンドはユーザーが実行し、その事実が作業記録に残っている

## アーキテクチャ参照

- `architecture_refs`: `arch-d1-schema-lifecycle`

## 文書責務

- 恒久 policy と通常の D1 変更手順の SSOT は `docs/ci-cd-operations.md`。
- `docs/runbooks/prod-d1-schema-recovery.md` は当該 incident の baseline、承認済み pending manifest、行数突合、証跡へのリンクだけを持つ。通常手順を複製しない。

## 機能間依存

- `depends_on`: (なし — 本 feature が復旧の起点)
- 依存理由: 本番が壊れている現状では、他のどの恒久対策よりも先に稼働の回復が要る。検査ゲート (`feat-deploy-migration-gate`) を先に入れると、未適用が残っている間はすべてのデプロイが停止してしまう。

## Handoff

- per-feature planning: ready 時に `run-system-dev-plan` を `--feature-id feat-prod-d1-schema-recovery` と repo 相対 `--feature-context features/feat-prod-d1-schema-recovery.context.json` で起動する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-prod-d1-schema-recovery` と共通 `feature_package_id` で C02 経由 atomic 登録する (expected/applied = 13)。
- 完了 rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が上記受入 8 件を満たす場合だけ done とする。**本番への適用コマンドの実行者はユーザーであり、AI は手順提示と検証に留まる (ADR D1-migration-gate)。**
