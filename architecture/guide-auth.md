---
graph_node_id: "arch-guide-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "使い方 — /api/guide を既存の authGuard と mustChangePasswordFence の配下の /api/* に置き、userId の Dataset だけを読み、新しい権限・資格情報を作らない"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "auth"]
file_path: "architecture/guide-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6750698bc3023d6fde3c45b95ce211667ad33ca8372193ffeb5475baf684061f"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "6750698bc3023d6fde3c45b95ce211667ad33ca8372193ffeb5475baf684061f", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-backend", "arch-guide-database", "arch-guide-security", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/routes/analytics.ts", "packages/web/src/components/Layout.tsx", "packages/web/src/pages/guide"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/guide-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G4"]
---

# Architecture overview

使い方 — 新しい `GET /api/guide` を既存のセッション認証 (authGuard と mustChangePasswordFence の配下、HttpOnly・Secure・SameSite=Strict の Cookie) の `/api/*` に置き、`loadScoped` が渡す userId の Dataset だけを読む。未ログイン時の共通シェルは既存の locked 表示のまま。新しい権限や役割は作らない (単一利用者の運用、qa-guide-auth-web-001)。`system-spec/auth.md` は承認時入力、本書は認証境界と認可の置き場所の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: `/api/*` は `packages/api/src/index.ts:107` の `authGuard()` 配下で、一時パスワードの利用者は `mustChangePasswordFence` (`index.ts:109`) で業務データに触れない。セッション Cookie は HttpOnly・Secure・SameSite=Strict (`packages/api/src/auth.ts:129-131`)。AI エージェントと改善要望のエージェントは依頼ごとの使い捨てトークンで別経路 (`index.ts:101`・:103、authGuard より前) に置かれる (qa-guide-auth-web-evidence-001。evidence の記載は :106 / :108 / :100-103 で、現物は 1 行ずれている)。
- Quality attribute priorities: G4 に資する。Secure by Design の『既定で拒否し、境界で一度だけ判定する』を適用する (auth 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: OWASP ASVS (上流指針)。単一利用者の運用。web のみ。

## Goals and non-goals

- Goals:
  - G4: `/api/guide` を利用者ごとに分離し、他の利用者の数値を 1 つも返さない。
  - 一時パスワードの利用者は `/api/guide` にも届かない。
- Non-goals:
  - 新しい資格情報・トークン・権限・役割
  - 使い方画面のログイン前公開
  - AI エージェント経路の変更

## System context and boundaries

- Users/external systems: 利用者のブラウザ (セッション Cookie)。
- Trust/deployment/data boundaries: 境界は `index.ts:107` の authGuard と :109 の mustChangePasswordFence の 2 段。`/api/guide` は `analyticsRoute` (`index.ts:119`) の 1 経路としてその内側に載る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `authGuard` (`index.ts:107`) | セッション Cookie の検証、未認証を 401 | Hono middleware | packages/api | api Worker |
| `mustChangePasswordFence` (`index.ts:109`) | 一時パスワードの利用者を 403 | Hono middleware | packages/api | 同上 |
| `loadScoped` (`analytics.ts:102-123`) | `c.get('userId')` (:105) で Dataset を絞る | 関数 | packages/api | 同上 |
| 共通シェル (`Layout.tsx`) | 未ログイン時の locked 表示 | React | packages/web | Workers Assets |

## Cross-cutting contracts

- Identity/access: route の中で個別の認可判定を書かない。利用者の判定は境界の 1 回だけ。
- Errors/resilience: 未認証は 401 `unauthorized` (`auth.ts:242`)、一時パスワードは 403 `password_change_required` (`auth.ts:297`)。いずれも既存の値。
- Observability/audit: 既存の認証ログの流儀のまま。新しい監査信号は足さない。
- Configuration/secrets: N/A: 新しい秘密情報を持たない。
- Compatibility/versioning: locked 時のフッタのデータ出典は `#privacy-help` を指し、ログイン後は `/guide` へのリンク (`Layout.tsx:518`) の現行を保つ。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/guide-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者の総収支・最終更新・月次の進捗。脅威は他の利用者のセッションからの読み取りと、一時パスワードのままの業務データへの到達。

#### Authentication boundary

`/api/guide` は `/api/*` の authGuard 配下に置き、Cookie のセッションだけで通す。使い方画面のために新しい資格情報やトークンを発行しない。

#### Identity and authorization

`loadScoped` の `userId` だけで Dataset を絞る。単一利用者の運用なので役割を作らない。

#### Data and secret protection

応答は利用者自身の集計値だけ。Cookie の属性 (HttpOnly・Secure・SameSite=Strict) は変えない。

#### Application and supply-chain controls

N/A: 新しい依存を足さない。

#### Detection and response

既存の認証失敗の扱いのまま。新しい検知は足さない。

#### Security verification

API テストで、他の利用者のセッションで `/api/guide` がこの利用者の数値を 1 つも返さないこと (O5)、未認証 401、一時パスワード 403 を確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-guide-auth-web-001 | 既存のセッション認証の `/api/*` に置く | ガイド専用の認証 | 境界が 1 つで判定を書き直さない | 未ログインでは数値を出さない |
| qa-guide-auth-web-001 | `mustChangePasswordFence` の配下に置く | fence の外に置く | 一時パスワードの利用者が業務データに触れない | 403 の扱いを画面が持つ |
| qa-guide-auth-web-001 | 新しい権限・役割を作らない | 閲覧専用の役割 | 単一利用者の運用に合う | 家族の閲覧は対象外 |

## Delivery, migration and rollback

- Build/deploy topology: 既存の api Worker。
- Migration sequence: `analyticsRoute` に経路を足すだけで、境界の順序 (`index.ts:107`・:109・:110・:111) は変えない。
- Rollback trigger/procedure: 分離の API テストが赤なら差し戻す。

## Risks and verification

- Risk/assumption: `/api/guide` を `analyticsRoute` 以外の authGuard より前の位置に結線すると、未認証で届く。`analyticsRoute` の中に置くことをテストで確かめる。
- Risk/assumption: `loadScoped` を使わず直接 D1 を読むと userId の絞り込みが漏れる。`loadScoped` だけを使う。
- Architecture fitness test: 未認証の `GET /api/guide` が 401 であること。
- Load/failure/security validation: 他の利用者のセッションで数値が返らないこと (O5)。
