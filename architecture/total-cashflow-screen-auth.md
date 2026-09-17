---
graph_node_id: "arch-total-cashflow-screen-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "総収支画面 — 既存セッション認証と user_id 単位の認可"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "auth"]
file_path: "architecture/total-cashflow-screen-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "832fa24c5786fc67f6381934b8f4658931250559581dc00dc4b0acdfc89e366b"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "832fa24c5786fc67f6381934b8f4658931250559581dc00dc4b0acdfc89e366b", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["spec-total-cashflow-screen", "arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/routes/total-cashflow.ts", "packages/web/src/AuthenticatedApp.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-screen-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T14:50:54Z"}
serves_goals: ["G2", "G4"]
---

# Architecture overview

総収支画面 — 既存セッション認証と user_id 単位の認可。正本は `system-spec/auth.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-total-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-auth-web-tc-observed-001。利用者アカウント (メールアドレス + パスワード、PR #47、PBKDF2 は PR #52 で 100,000 回) のセッションで認証する。packages/api/src/index.ts は /api/* に authGuard() と mustChangePasswordFence() を掛け、route は c.get('userId') で利用者を特定する。既存の総収支 route は全ての読取・書込を userId で絞る。画面は AuthenticatedApp.tsx 配下で、未認証は既存どおりログインへ送られる。
- Quality attribute priorities: G2 と G4 に資する。doctrine は OWASP ASVS + Secrets Management Cheat Sheet (authentication: 新しい書込み API も authGuard と初回パスワード変更の柵を通す位置にマウントし専用の認証経路を作らない / security: 認可の単位を user_id に固定し、他人の操作 id は存在の有無を返さず 404)。
- Constraints: 認証方式・セッション・レート制限は変更しない。新しい権限区分や共有機能は作らない。

## Goals and non-goals

- Goals:
  - G2: 一括判定・除外理由の一括設定を既存の認証境界の内側で提供する。
  - G4: 操作履歴の取得と取消を user_id と id の組でしか引けないようにし、他利用者の判定や履歴を取り消せなくする。
- Non-goals:
  - 認証方式・セッション・レート制限の変更
  - 権限区分・共有・代理操作

## System context and boundaries

- Users/external systems: 認証済みの利用者本人だけ。外部 IdP は無い。
- Trust/deployment/data boundaries: /api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の後が信頼境界の内側。route 内の条件は認証済み user_id のみ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| authGuard | セッションを検証し userId を載せる | Hono middleware (/api/*) | packages/api | Worker |
| mustChangePasswordFence | 初回パスワード変更前の利用を止める | Hono middleware | packages/api | Worker |
| canonicalMutationFence | 書込み (POST/DELETE) を柵の対象にする | Hono middleware | packages/api | Worker |
| 総収支 route | 読取・一括判定・除外・取消を userId で絞る | /api/total-cashflow 系 | packages/api | Worker |
| AuthenticatedApp | 未認証をログインへ送り画面を認証配下に置く | React ルート | packages/web | Workers Assets |

## Cross-cutting contracts

- Identity/access: 利用者の特定は c.get('userId') だけ。リクエスト本文の user id は受け付けない。
- Errors/resilience: 未認証は既存の authGuard の拒否と画面のログイン誘導のまま。他人の操作 id・存在しない id は 404 で区別しない。
- Observability/audit: 操作履歴が本人の判断記録になる。認証ログの追加は無い。
- Configuration/secrets: N/A: 認証の設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存のセッションと route のマウント位置をそのまま使い、互換を崩さない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者本人の明細・freee 取引・判定・除外理由・操作履歴。行為者は認証済みの本人と、未認証または他の利用者。主な脅威は他人の操作 id を送っての取消・判定の書換えと、存在確認による情報の漏れ。

#### Identity and authorization

認証は既存のセッション (PR #47、PBKDF2 は PR #52 で 100,000 回)。認可は Secure by Design card の『既定で拒否し、境界で一度だけ判定する』に従い、除外の一括設定・集計へ戻す・判定・取消を全て /api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の後にマウントする。route 内では認証済み user_id だけを条件に読み書きし、取消は操作履歴を user_id と id の両方で引く (qa-total-cashflow-decision-004)。

#### Data and secret protection

N/A: 本章は新しい秘密情報や暗号化対象を足さない。データの入力検証と出力は security 章 (`architecture/total-cashflow-screen-security.md`) が扱う。

#### Application and supply-chain controls

N/A: 認証まわりの依存ライブラリ・ビルド経路を変えない。

#### Detection and response

N/A: 認証の検知・通知を追加しない。操作履歴は本人の判断記録として残る。

#### Security verification

API 統合テストで、未認証の書込みが拒否されること、他人の操作 id の取消が 404 になり対象の行が変わらないこと、一括判定・除外が本人の userId の行だけを変えることを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-auth-web-tc-observed-001 | 既存セッション認証と userId 絞込みを踏襲 | 総収支専用の認証経路 | 境界を 1 つに保ち判定を一度にする | 新 route も同じマウント位置に置く |
| qa-total-cashflow-decision-004 | 操作履歴を D1 に残し取消を user_id と id で引く | 画面のメモリ上だけ | 本人の操作だけを取り消せる | 他人の id は 404 |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker のまま。認証の構成変更は無い。
- Migration sequence: N/A: 認証に関わる migration は無い。
- Rollback trigger/procedure: 認可漏れが見つかったら直前のビルドへ戻す。認証データは変えないので戻しで失うものは無い。

## Risks and verification

- Risk/assumption: 適用文 (Secure by Design) はアシスタント推定。新しい route のマウント位置が柵の外に出ると認可が抜ける。
- Architecture fitness test: 総収支 route が /api/* の柵の後にマウントされていること、route の全クエリが userId を条件に含むこと。
- Load/failure/security validation: 他人の id の取消・未認証の書込みの拒否を統合テストで確かめる。
