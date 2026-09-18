---
graph_node_id: "arch-expense-matrix-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "支出マトリックス — 新設 2 経路を既存 authGuard の内側に置く"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["expense-matrix", "auth"]
file_path: "architecture/expense-matrix-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "05843382528fb59bac01a39618d21c7d16ffc2196844f40751292a2c77f85b33"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "05843382528fb59bac01a39618d21c7d16ffc2196844f40751292a2c77f85b33", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-16T11:55:20Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-frontend", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-security", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops"]
resource_scope: ["packages/api/src/routes/analytics.ts", "packages/api/src/auth.ts", "packages/web/src/pages/analysis/Matrix.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/expense-matrix-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T11:55:20Z"}
serves_goals: ["G4", "G5"]
---

# Architecture overview

支出マトリックス — 新設 2 経路を既存 authGuard の内側に置く。`system-spec/auth.md` は承認時入力、本書は認証境界の制約を持つ。本サイクルで認証方式そのものは変更しない。

## Context and drivers

- Business/technical context: 本サイクルが追加するのは読み取り専用の集計 API とセル内訳 API のみで、利用者の識別・資格情報・セッションの扱いは増えない。既存の API はすべて同じ認証ミドルウェアの内側にある。
- Quality attribute priorities: G4・G5 に資する。OWASP ASVS の『全ての保護資源で認証を強制する』とアクセス制御 (他利用者のデータに触れない) を適用する。
- Constraints: 単独利用者の個人事業主向け。PBKDF2 は本番 Workers の上限に合わせて 100,000 回に調整済みで、本サイクルはこれに触れない。

## Goals and non-goals

- Goals:
  - G4: 新設 2 経路 (マトリックス集計・セル内訳) を既存 `/api/*` の authGuard 配下へマウントする。
  - G5: 新しい認証経路もトークンも作らず、既存のセッションと mustChangePasswordFence をそのまま通す。
- Non-goals:
  - 役割分担・複数ユーザーの権限分離の導入
  - PBKDF2 の反復回数・セッション寿命・パスワード方針の変更
  - 端末の生体認証や OS 資格情報ストアとの連携 (web のみ)

## System context and boundaries

- Users/external systems: 単独の利用者。外部 IdP を追加しない。
- Trust/deployment/data boundaries: `/analysis/matrix` と新設 API は保護対象。未ログイン時は既存のログイン画面へ送る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 既存 authGuard | セッション検証と `userId` の付与 | Hono middleware | packages/api | Worker |
| `GET /api/matrix` | authGuard 配下で集計を返す | Hono route | packages/api | Worker |
| `GET /api/matrix/cell` | authGuard 配下で明細内訳を返す | Hono route | packages/api | Worker |
| マトリックス画面 | 認証済みシェル配下のルート | react-router | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: 集計もセル内訳も `c.get('userId')` を必ず条件に含める。クエリで受け取る `key` (取引先名や勘定科目) を利用者の同定に使わない。
- Errors/resilience: 存在しない行や他利用者の範囲を指す `key` に対しては空の内訳を返し、存在の有無を応答の差から推測させない。
- Observability/audit: 認証に関する監査項目を増やさない。
- Configuration/secrets: 本サイクルは読み取り専用で資格情報を扱わない。
- Compatibility/versioning: 既存の CSV 出力の扱いも変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Authentication boundary

新設エンドポイントは既存 API と同じ場所へ足すことで保護される。認証なしで到達できる経路を作らない。セル内訳は明細そのもの (取引先・内容・金額) を返すため、この境界の内側であることが要件である。

#### Authorization model

単独利用者前提を継続し、役割や権限の分離を導入しない。認可は `userId` による行の絞り込みに一元化する。

#### Credential handling

既存の PBKDF2 (100,000 回) とセッション Cookie の方式をそのまま使う。本サイクルで資格情報の保存・検証経路に触れない。

#### Security verification

API テストで、未認証リクエストが新設 2 経路で拒否されること、`userId` の異なる範囲を指す `key` に対して空の内訳が返ることを検証する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-matrix-auth-web-004 | 単独利用者前提を継続し権限分離を導入しない | 役割ベースの閲覧制御 | 要件に無い機構を増やさず、認可を `userId` 絞りに一元化できる | 将来の複数利用者化は別サイクルの範囲 |
| qa-matrix-auth-web-003 | 新設 2 経路を既存 authGuard 配下へマウントする | 新しい認証経路を作る | 防御水準が既存と同一になり、露出の種類が増えない | 経路追加のたびにマウント位置をレビューする |
| qa-matrix-auth-web-003 | 存在しない/他利用者の key へは空の内訳を返す | 404 で区別する | 応答の差から存在の有無を推測させない | 空内訳と実データ 0 件が同じ見え方になる |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker。認証構成の変更なし。
- Migration sequence: route を authGuard 配下へマウント → `userId` 絞りの適用 → 空内訳の応答契約。
- Rollback trigger/procedure: 認証テストが落ちたら差し戻し。資格情報に触れないためデータの巻き戻しは不要。

## Risks and verification

- Risk/assumption: 新設経路をマウント位置を誤って guard の外へ置くと明細が無認証で露出する。マウント位置のテストで塞ぐ。
- Architecture fitness test: 新設 2 経路が authGuard の内側にあること。`key` が利用者の同定に使われていないこと。
- Load/failure/security validation: 未認証リクエストが 401 相当で拒否されること。既存ログインの回帰テストが緑であること。
