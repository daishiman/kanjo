---
graph_node_id: "arch-account-login-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "アカウントログイン — 配信構成と secret"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "infrastructure", "cloudflare"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: ["spec-account-login"]
related_nodes: ["arch-account-login-auth", "arch-account-login-maintenance-ops", "arch-account-login-database"]
resource_scope: ["wrangler.toml", "packages/api/src/index.ts"]
purpose: "現行の Cloudflare 配信構成を変えずに、認証に必要な secret と定期処理だけを整える。"
goal: "新しい binding を増やさず、SESSION_SECRET を必須のまま維持し、AUTH_PASSWORD を廃止した状態にする。"
scope_in: ["既存 binding (D1 / R2 / static assets) の維持", "SESSION_SECRET の必須化とローテーション手順", "AUTH_PASSWORD の required からの除外と廃止", "既存 cron への掃除処理の相乗り"]
scope_out: ["メール送信基盤 (Email binding / 外部 API キー) の追加", "新しい cron の追加", "新しい binding の追加", "配信構成の変更"]
acceptance: ["新規 binding が0件である", "新規 cron が0件である", "required secret から AUTH_PASSWORD が消え SESSION_SECRET が残る", "assets の run_worker_first が /api/* のまま維持される"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/account-login-infrastructure.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "094e408fda263ff476a090903dffb3d0e0a7eb9a1ebb1d7c9d059985f245cd98"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "23f70c2c85cd7bdc7b57862201134c1098d11907a38033b417b59a59daa96dd3", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "配信構成と secret の境界を定めるため architecture / infrastructure subtype として取り込む。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/account-login-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G5, G2]
---

# アカウントログイン — 配信構成と secret

規範は `specs/spec-account-login.md`、内容の正本は `system-spec/infrastructure.md`。

## Architecture overview

配信構成は現行のまま維持する: Cloudflare Workers (`kanjo-console`) + D1 (DB) + R2 (FILES) + static assets。assets の `run_worker_first` は `/api/*` のまま。新しい binding は追加しない。

## Context and drivers

メール送信基盤を導入しないという境界が、インフラ面の追加をゼロに保っている。パスワードリセットを自動化する設計を選べば Email binding か外部 API キーが必要になり、secret と障害点が増える。管理者運用を選んだことでこの増加を回避している。

## Goals and non-goals

- Goal: 構成不変のまま、必要な secret と掃除処理だけを整える。
- Non-goal: メール送信基盤、新 binding、新 cron、配信構成の変更。

## System context and boundaries

境界は `wrangler.toml` の binding 定義と secret 一覧。`SESSION_SECRET` を必須のまま維持し、`AUTH_PASSWORD` を required から外して廃止する。

## Container and component view

- Workers (`kanjo-console`): API と static assets の配信
- D1 (`kanjo-db`): 利用者・一時パスワード・rate limit・audit_log
- R2 (FILES): 既存用途のみ (資格情報は一切置かない)
- cron (`0 18 * * *`): 既存処理に相乗りして期限切れの一時パスワードと rate limit 行を掃除

## Cross-cutting contracts

`SESSION_SECRET` のローテーションは全セッションの失効を意味する。これは切替時の意図した挙動であると同時に、運用手順として明示すべき副作用である。

## Subtype architecture

**infrastructure**: 定期処理を新設せず既存 cron に相乗りさせる。掃除対象 (期限切れの一時パスワード / rate limit 行) はいずれも遅延に耐えるため、専用スケジュールを持つ必要がない。実行単位を増やさないことが、Workers 構成での運用コストを一定に保つ。

## Architecture decisions

1. 新 binding を作らない — メール送信基盤を持たない方針の直接の帰結。
2. `SESSION_SECRET` のローテーションを切替手順に組み込む — 旧形式 Cookie の無効化は署名 payload の変更だけでは担保しきれないため。

## Delivery, migration and rollback

デプロイ順序は migration 適用 → 初期管理者作成 → `SESSION_SECRET` ローテーション → `AUTH_PASSWORD` 削除。ローテーション時点で全利用者が再ログインとなる。

## Risks and verification

- リスク: `AUTH_PASSWORD` の削除漏れにより共有パスワード経路が残る → コードベースの参照0件を検証する。
- 検証: 新規 binding・新規 cron が0件であること、`run_worker_first` が `/api/*` のままであることを確認する。
