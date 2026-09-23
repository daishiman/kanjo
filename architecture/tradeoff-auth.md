---
graph_node_id: "arch-tradeoff-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "トレードオフ — 既存の /api/* フェンスの内側に置き、全経路を user_id で絞る"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "auth"]
file_path: "architecture/tradeoff-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "cca5fd48cb1d938da9b371d40412023e78e6017563c1b9768f077aa650609ea8"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "cca5fd48cb1d938da9b371d40412023e78e6017563c1b9768f077aa650609ea8", "imported_at": "2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-security", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/schema-guard.ts"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec の auth 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/tradeoff-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:35:02Z"}
serves_goals: ["G5"]
---
# Architecture overview

> 本書は spec から生成した領域別投影であり、規則の正本ではない。差異は `specs/spec-tradeoff-screen.md` を優先し、spec 変更後に再生成・同期する。

トレードオフ — 既存の /api/* フェンスの内側に置き、全経路を user_id で絞る。`system-spec/auth.md` は承認時入力、本書は認証境界と認可の制約を持つ。正本は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の「認証・認可」。

## Context and drivers

- Business/technical context: `/api/*` は authGuard・mustChangePasswordFence・runtimeSchemaGuard・canonicalMutationFence の内側にあり、現行の GET / POST `/api/tradeoff` もそこに載る (qa-tradeoff-auth-web-evidence-001)。
- Quality attribute priorities: G5。利用者の分離。
- Constraints: 新しい認証方式を作らない (qa-tradeoff-auth-web-001)。

## Goals and non-goals

- Goals:
  - G5: GET・POST・PUT の 3 経路を既存フェンスの内側に置き、全クエリを `c.get('userId')` で絞る。
- Non-goals:
  - 新しい権限区分・共有・長期トークン

## System context and boundaries

- Users/external systems: Cookie のセッションを持つ利用者。
- Trust/deployment/data boundaries: 認可はフェンスと `user_id` の絞り込みだけで、route の中に個別判定を書かない。
- Context diagram: `system-spec/index.md`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| authGuard | セッション確認 | Hono middleware | packages/api | Worker |
| mustChangePasswordFence | 初期パスワードの変更強制 | Hono middleware | packages/api | Worker |
| runtimeSchemaGuard | D1 の migration 先頭の確認 | Hono middleware | packages/api | Worker |
| canonicalMutationFence | 変更系の経路の正規化 | Hono middleware | packages/api | Worker |
| tradeoff の 3 経路 | `user_id` での絞り込み | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: `c.get('userId')`。
- Errors/resilience: 未認証は 401。他の利用者の候補キーは現在の候補に無いので 422。
- Observability/audit: N/A。
- Configuration/secrets: N/A。
- Compatibility/versioning: 既存のフェンスの順序を変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は試算の記録と上書き (家計・事業の支出の傾向)。脅威は他の利用者の記録・上書きの読み書き。

#### Authentication boundary

既存の Cookie セッション。3 経路とも `/api/*` 配下に置く。

#### Identity and authorization

`user_id` の一致する行だけを読み書きする。PUT は `(user_id, candidate_key)` で行を分ける (qa-tradeoff-security-web-004)。

#### Data and secret protection

新しい秘密情報は無い。

#### Application and supply-chain controls

新しい依存を足さない。

#### Detection and response

既存の API エラーログの流儀。

#### Security verification

api テストで 未認証 401、利用者 A の上書き・記録が利用者 B に見えない、B が A の候補キーで PUT すると 422 を確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-tradeoff-auth-web-001 | 既存フェンスの内側に置く | 経路ごとの認可判定 | 判定が 1 か所に集まる | フェンスの変更が全経路に効く |
| qa-tradeoff-security-web-004 | 候補キーを利用者の現在の候補で検証 (agent 推定・利用者未確認) | キーの形だけ検査 | 他人のキーを書けない | PUT でも候補を作る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker。
- Migration sequence: 経路の追加だけ。
- Rollback trigger/procedure: 分離のテストが落ちたら差し戻す。

## Risks and verification

- Risk/assumption: 新しい route をフェンスの外に登録してしまう。`analyticsRoute` の配下に置き、未認証 401 のテストで確かめる。
- Architecture fitness test: 3 経路のクエリすべてに `user_id` 条件がある。
- Load/failure/security validation: `architecture/tradeoff-security.md`。
