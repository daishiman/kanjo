---
graph_node_id: "arch-cash-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "現金入力 — 既存のセッションのまま、新しい削除・復元・一括の経路も userId で絞り、他人の行を 404 にする"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "auth"]
file_path: "architecture/cash-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "4f3863710e7af200fe3cbc217fefc99570d6c56266d26e5ead16c5358161d73d"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "4f3863710e7af200fe3cbc217fefc99570d6c56266d26e5ead16c5358161d73d", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-backend", "arch-cash-database", "arch-cash-security", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/routes/cash.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/web/src/components/Layout.tsx", "packages/web/src/pages/cash"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/cash-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G4"]
---

# Architecture overview

現金入力 — 認証は既存のセッション (`authGuard`、Cookie は HttpOnly・Secure・SameSite=Strict) のまま変えない。新しい経路 (restore・bulk-delete・bulk-restore) も `/api/*` に置いて同じ middleware の後ろに入れ、全ての読み書きを `userId` で絞る。他人の行は存在しないものとして 404 を返す。新しい役割は作らない。`system-spec/auth.md` は承認時入力、本書は認証境界と認可の制約を持つ。

## Context and drivers

- Business/technical context: `/api/*` は `authGuard()` (`packages/api/src/index.ts:104`)・`mustChangePasswordFence()` (`:106`)・`runtimeSchemaGuard` (`:107`)・`canonicalMutationFence()` (`:108`) を通り、`cashRoute` は `:115` で載る。セッションの Cookie は `auth.ts:128-134` で HttpOnly・Secure・SameSite=Strict を付ける。現行の cash の 4 経路 (`routes/cash.ts:175-275`) は全て `c.get('userId')` を条件にする (qa-cash-auth-web-001)。
- Quality attribute priorities: G4 に資する。Secure by Design (既定で安全な境界に載せ、例外経路を作らない) を適用する (agent 推定・利用者未確認、design_applications)。上流指針は authentication と security (OWASP ASVS)。
- Constraints: 単一利用者の運用 (C3)。マルチテナントは対象外。

## Goals and non-goals

- Goals:
  - G4: 他の利用者の明細の取得・変更・削除・復元が 404 になる (S4)。一括に他人の id が 1 件でも混ざれば全体 404 で何も変えない (qa-cash-decision-006)。
- Non-goals:
  - 新しい役割・権限 (閲覧専用など)
  - 認証方式・セッション寿命の変更
  - 専用のレート制限 (現状の API に無く、本件でも足さない)

## System context and boundaries

- Users/external systems: ログイン済みの利用者。夜間の完全消去 job は scheduled から呼ばれ、利用者のセッションを持たない。
- Trust/deployment/data boundaries: 認証境界は `/api/*` の middleware。夜間 job は Worker 内部の呼び出しで、HTTP の入口を持たない (`architecture/cash-infrastructure.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `authGuard` | セッション Cookie の検証と `userId` の設定 | Hono middleware | packages/api | Worker |
| `canonicalMutationFence` | 書込経路の登録と整合 | Hono middleware | packages/api | Worker |
| `routes/cash.ts` | 全経路で `userId` を条件にする | Hono | packages/api | Worker |
| `pages/cash/draft.ts` | 下書きのキーに利用者 id を含め、ログアウトで消す | `localStorage` | packages/web | Workers Assets |

## Cross-cutting contracts

- Identity/access: `userId` はセッションからだけ取り、本文や URL の利用者 id を信用しない。
- Errors/resilience: 未ログインは既存の 401。他人の行・存在しない行・完全消去済みの行は同じ 404 `not_found` で区別しない。
- Observability/audit: N/A: 新しい監査信号を足さない。
- Configuration/secrets: 秘密情報は既存の `SESSION_SECRET` だけで、新しい secret は足さない。
- Compatibility/versioning: 既存のセッションはそのまま使える。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/cash-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者の現金明細 (金額・内容・名義・区間・業務の目的)。脅威は 他人の id を指定した取得・変更・削除・復元 (IDOR)、一括の id 配列に他人の id を混ぜること、共有端末に残った下書きの閲覧。

#### Authentication boundary

新しい 3 経路を `cashRoute` に足し、`/api/*` の middleware の後ろに置く。認証を外した経路や別の prefix を作らない。

#### Identity and authorization

全ての SELECT / UPDATE の WHERE に `user_id = userId` を入れる。一括は id 配列を `user_id = userId` かつ存在する行で数え、件数が配列の件数と一致しなければ全体 404 にする (qa-cash-decision-006)。完全消去済みの id も同じ 404 (qa-cash-backend-web-003、agent 推定・利用者未確認)。

#### Data and secret protection

下書きのキーに利用者 id を含め、ログアウト時 (`components/Layout.tsx:145`) に消す。保存するのは入力途中の項目値だけ (qa-cash-security-web-003、agent 推定・利用者未確認)。

#### Application and supply-chain controls

N/A: 新しい依存を足さない。入力検証は `architecture/cash-security.md`。

#### Detection and response

N/A: 新しい検知を足さない。404 の件数は既存のアクセスログで見る。

#### Security verification

API テストで、別利用者のセッションから GET・PUT・DELETE・restore が 404、bulk-delete / bulk-restore に他人の id を 1 件混ぜると 404 で自分の行も変わらない、未ログインで 401、を確かめる。DOM テストでログアウト後に下書きが消えることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-cash-auth-web-001 | 既存のセッションと middleware のまま、新経路も `/api/*` に置く | 新経路だけ別の認可を作る | 境界が 1 つで、取りこぼしが起きにくい | 新経路は既存の fence 登録が要る |
| qa-cash-auth-web-001 | 他人の行は 404 (403 にしない) | 403 を返す | 他人の id の存在を知らせない | 存在しない行と区別できない |
| qa-cash-decision-006 | 一括に他人の id が混ざれば全体 404 | 自分の行だけ処理する | 部分成功による誤解と取りこぼしが無い | UI は 404 で一覧を読み直す |
| qa-cash-security-web-003 | 下書きのキーに利用者 id、ログアウトで消す (agent 推定・利用者未確認) | 共通キー | 共有端末で他人の下書きが見えない | ログアウト処理に 1 行足す |

## Delivery, migration and rollback

- Build/deploy topology: 既存の Worker と web のデプロイ。
- Migration sequence: 新経路を `cashRoute` に足す → fence 登録 → 認可の API テスト → 下書きのキーとログアウト時の消去。
- Rollback trigger/procedure: 認可の API テストが 1 件でも赤なら差し戻す。

## Risks and verification

- Risk/assumption: 一括で件数の突き合わせを忘れると、他人の id を黙って無視して自分の行だけ処理してしまう。全体 404 のテストで固定する。
- Architecture fitness test: `routes/cash.ts` の全ての Drizzle 式に `s.cashEntries.userId` の条件があること (grep)。
- Load/failure/security validation: 別利用者のセッションを 2 つ作る API テストで IDOR が 0 件であること。
