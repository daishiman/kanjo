---
graph_node_id: "arch-trends-screen-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "推移画面 — 既存の認証の内側での読取り"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "auth"]
file_path: "architecture/trends-screen-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "7339496e4012a9e647a95c39cecedb1b236b45a8a7dc10518f39c5f011370aa5"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "7339496e4012a9e647a95c39cecedb1b236b45a8a7dc10518f39c5f011370aa5", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["spec-trends-screen", "arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-security", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/web/src/pages/Classify.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/trends-screen-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:18:41Z"}
serves_goals: ["G3", "G4"]
---

# Architecture overview

推移画面 — 既存の認証の内側での読取り。正本は `system-spec/auth.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-trends-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-auth-web-trends-observed-002。/api/* に authGuard() と mustChangePasswordFence() が掛かり、GET /api/trends はその内側の analyticsRoute にある。認証はメールアドレスとパスワードの署名付きセッション Cookie (users.session_generation で即時失効)。
- Quality attribute priorities: G3・G4 に資する。doctrine は OWASP ASVS の認証・アクセス制御 (owasp-asvs): 新しい経路を足さず、既存の検査の内側に置く。
- Constraints: 単一テナント (TENANT_ID=default)。今回の変更は読取専用。

## Goals and non-goals

- Goals:
  - G3: 推移の API を既存の認証の内側に置いたまま拡張する。
  - G4: /classify の絞込は既存のログイン済み画面の検索パラメータだけで行う。
- Non-goals:
  - 新しい認証方式
  - 権限の区分
  - 共有リンクの公開

## System context and boundaries

- Users/external systems: ログイン済みの利用者だけ。
- Trust/deployment/data boundaries: 認証の境界は /api/* の手前で変わらない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| authGuard | セッション Cookie の検証 | api | packages/api・packages/web | Worker kanjo-console |
| mustChangePasswordFence | 初回のパスワード変更を強制 | api | packages/api・packages/web | Worker kanjo-console |

## Cross-cutting contracts

- Identity/access: 既存の authGuard と mustChangePasswordFence の内側に置き、データは userId で絞る (arch-trends-screen-auth)。
- Errors/resilience: データは userId で絞る。URL の検索パラメータに秘密を載せない。
- Observability/audit: 既存の requestId とエラーログに従う。推移は読取専用で、監査記録の対象になる書込みは増えない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/trends は応答フィールドの追加だけで、既存の傾向判定のフィールドと値を残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者の明細と集計。主体は利用者 1 人。脅威は未認証の読取りと他人のデータの読取りで、どちらも既存の検査で防ぐ。

#### Identity and authorization

署名付きセッション Cookie。推移の API は userId で絞った Dataset だけを読む。

#### Data and secret protection

新しい秘密は無い。URL のクエリにはカテゴリ名と取引先名だけを載せ、資格情報を載せない。

#### Application and supply-chain controls

新しい依存を足さない。

#### Detection and response

既存の認証失敗の扱いとログに従う。

#### Security verification

api のテストで未認証の GET /api/trends が 401 になることを既存の型で確認する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-AUTH-1 | 新しい認証・認可を足さない | 根拠と比較案は qa-auth-web-trends-observed-002 を参照 | qa-auth-web-trends-observed-002 の判断に従う | 本書の該当節に反映済み |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console を ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: 認証の設定変更は無い。
- Rollback trigger/procedure: テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は無いのでデータの巻き戻しは要らない。

## Risks and verification

- Risk/assumption: URL の共有でカテゴリ名や取引先名が見える → 対策: 共有はログイン済みの本人に限られ、画面を開くには認証が要ることを docs に書く
- Architecture fitness test: api のテストで未認証の GET /api/trends が 401 になることを既存の型で確認する。
- Load/failure/security validation: pnpm verify:full (test・typecheck・lint・build・視覚検査) を緑に保つ。
