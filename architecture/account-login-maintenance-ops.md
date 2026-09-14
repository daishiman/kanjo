---
graph_node_id: "arch-account-login-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "アカウントログイン — 運用と復旧"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "maintenance-ops", "runbook"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: ["spec-account-login"]
related_nodes: ["arch-account-login-security", "arch-account-login-database", "arch-account-login-infrastructure"]
resource_scope: ["docs", "migrations", "packages/api/src/routes"]
purpose: "共有パスワードからアカウント運用へ移す手順と、締め出し時の復旧経路を定める。"
goal: "移行・日常運用・監視・秘密の取扱い・最終手段の復旧が、手順として文書化された状態にする。"
scope_in: ["初期管理者の作成と資格情報の引き渡し", "AUTH_PASSWORD の削除", "招待・停止・一時パスワード再発行の運用", "audit_log による監査", "ログイン失敗率とロックアウトの監視", "全 admin 喪失時の最終手段 runbook"]
scope_out: ["共有パスワードとアカウントの併存運用", "メール送信による自動リセット", "外部監視基盤の導入"]
acceptance: ["共有パスワードとアカウントが併存する期間が存在しない", "一時パスワードが発行直後の1度だけ表示され再表示できない", "全 admin 喪失時の復旧手順が文書化されている", "ログイン失敗率とロックアウト件数が audit_log から確認できる"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/account-login-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "5ef9ae94806e497bb6b27a66de3f6ac03540ea7a9774eea330c284bc126b2eb4"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "d52741d350e0801e4dac1a37283954761dc198d75cb95a6b85683fd1336f8373", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "運用手順と復旧経路という横断的な構造を定めるため architecture / infrastructure subtype として取り込む。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/account-login-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G3, G2]
---

# アカウントログイン — 運用と復旧

規範は `specs/spec-account-login.md`、内容の正本は `system-spec/maintenance-ops.md`。

## Architecture overview

運用は5つの局面を持つ: 移行、締め出し復旧、日常運用、監視、秘密の取扱い。いずれも管理画面と `audit_log` を軸に構成し、外部の監視基盤やメール送信に依存しない。

## Context and drivers

メール送信基盤を持たないため、パスワード再発行は必ず人間 (管理者) を経由する。この制約が運用設計の中心にあり、締め出しが起きたときの復旧経路を明示する必要を生んでいる。

## Goals and non-goals

- Goal: 移行から日常運用・復旧までを手順として閉じる。
- Non-goal: 共有パスワードとの併存、自動リセット、外部監視基盤。

## System context and boundaries

境界は管理画面 (`/api/admin/*`)、`audit_log`、および最終手段としての `wrangler d1 execute`。通常運用で DB を直接操作しない。

## Container and component view

- 移行: migration 適用と同時に初期管理者を1件作成し、資格情報を運用者へ引き渡してから `AUTH_PASSWORD` を削除する
- 日常運用: 招待・停止・一時パスワード再発行を管理画面から行う
- 監査: `audit_log` を参照する
- 監視: ログイン失敗率とロックアウト件数を `audit_log` から確認する
- 最終手段: `wrangler d1 execute` による直接のパスワードハッシュ更新

## Cross-cutting contracts

一時パスワードは発行直後の1度だけ管理画面に表示し、再表示できない。共有パスワードと利用者アカウントを併存させる期間を設けない。

## Subtype architecture

**infrastructure**: 締め出しに対して二重の備えを置く。第一は予防 (最後の有効な admin を失う操作をサーバ側で拒否する)。第二は復旧 (それでも全 admin がログイン不能になった場合の直接更新手順)。予防だけでは、拒否ロジック自体の不具合や DB の直接操作で状態が壊れた場合に回復できない。

## Architecture decisions

1. 併存期間を設けない — 併存すると最弱経路 (共有パスワード) が実効的な認証強度になり、移行の目的そのものを無効化するため。
2. 一時パスワードを再表示しない — 再表示可能な保管は、それ自体が資格情報の第二のコピーになるため。
3. 最終手段を runbook として文書化する — 締め出しは頻度が低く復旧コストが高い。手順を持たないと、発生時に場当たりの DB 操作を招く。

## Delivery, migration and rollback

切替は一方向とする。`AUTH_PASSWORD` を戻す rollback は認証強度を下げるため行わず、問題が出た場合は前方修正で対応する。

## Risks and verification

- リスク: 初期管理者の資格情報の引き渡し失敗 → 引き渡し確認を `AUTH_PASSWORD` 削除の前提条件に置く。
- リスク: 一時パスワードの紛失 → 再発行を管理画面から何度でも行える状態にしておく。
- 検証: 併存期間が存在しないこと、復旧手順が文書として存在することを確認する。
