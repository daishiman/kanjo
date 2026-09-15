---
graph_node_id: "arch-account-login-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "アカウントログイン — 認証機構"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "auth"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: ["spec-account-login"]
related_nodes: ["arch-account-login-security", "arch-account-login-database", "arch-account-login-backend"]
resource_scope: ["packages/api/src/auth.ts", "packages/api/src/routes", "packages/api/src/index.ts"]
purpose: "認証主体を共有パスワードから利用者アカウントへ移し、セッションが誰のものか特定できるようにする。"
goal: "パスワードを復元不能な形で保存し、セッション Cookie から利用者を特定でき、利用者単位で即時失効できる状態にする。"
scope_in: ["PBKDF2-HMAC-SHA256 によるパスワード保存", "利用者 ID・有効期限・世代を署名する Cookie", "2段階のセッション有効期限", "session_generation による一括失効", "AUTH_PASSWORD 経路の廃止"]
scope_out: ["外部 IdP / SSO の UI 露出", "自己サインアップ", "メール送信によるパスワードリセット", "多要素認証"]
acceptance: ["平文または可逆暗号でパスワードを保持するカラムが0件である", "利用者識別子を改ざんした Cookie が /api/* で401になる", "保持ON=30日 / OFF=12時間で Set-Cookie の maxAge が切り替わる", "パスワード変更後に旧 Cookie が無効になる"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/account-login-auth.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "56d9ee91d50a0a2ce12f4e68e1dde3470320695429fe03b7fe70f0c04c8b2740"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "43035607c89c41af2dfa49dbfe617dba686597e7bc4b7331c46ab3b5b003c0b7", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "認証機構の構造決定であり、実装差分ではなく境界と契約を定めるため architecture として取り込む。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/account-login-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G1, G2]
---

# アカウントログイン — 認証機構

規範は `specs/spec-account-login.md`、内容の正本は `system-spec/auth.md`。本書は構造と境界だけを保持し、本文を複製しない。

## Architecture overview

資格情報はメールアドレス (前後空白除去 + 小文字化 + 一意制約) とパスワードの組。パスワードは PBKDF2-HMAC-SHA256 (WebCrypto、反復 100,000 (本番 Workers の WebCrypto が受け付ける上限)、16 byte 以上のランダム salt) を、アルゴリズム・反復・salt を含む自己記述フォーマットで保存する。セッションは Cookie の署名 payload に「利用者 ID . 有効期限 . 世代」の3要素を載せ HMAC-SHA256 で署名する。

## Context and drivers

現行の `verifySessionCookie` は `exp` のみを署名対象としており、Cookie から利用者を識別できない。`authGuard` は `userId` を `'default'` に固定している。この2点が「誰の操作か特定できない」という現行の構造的欠落であり、本章の駆動要因である。

## Goals and non-goals

- Goal: 復元不能なパスワード保存、利用者を特定できるセッション、利用者単位の即時失効。
- Non-goal: 多要素認証、外部 IdP の UI 露出、自己サインアップ、メール送信による自動リセット。

## System context and boundaries

境界は `packages/api/src/auth.ts` の認証境界そのもの。`/api/*` の適用範囲と 401/503 の応答契約は現行のまま維持し、既存 20 画面の呼出しを壊さない。Cloudflare Access 経路はサーバ側の実装を残すが、ログイン画面の UI からは除去する。

## Container and component view

- パスワード検証 (WebCrypto PBKDF2)
- セッション発行 / 検証 (HMAC-SHA256 署名、3要素 payload)
- `authGuard` (共有tenantを `userId`、実利用者を `actor` として分離)
- 世代照合 (DB の `session_generation` と payload の世代の一致検査)

## Cross-cutting contracts

Cookie 属性は HttpOnly + Secure + SameSite=Strict を必須とし、JavaScript から読めるセッション表現を持たない。有効期限は「保持しない = 12 時間」「保持する = 30 日」の2段。失効は (a) ログアウト、(b) パスワード変更/再発行、(c) 管理者による停止 のいずれでも即時に効く。

## Subtype architecture

**security**: 認証情報の保護が本章の主責務。鍵導出のコスト係数 (反復 100,000) は、本番 Workers の WebCrypto が PBKDF2 に課す上限 (100,000 超は NotSupportedError) に合わせる。ハッシュ形式を自己記述にすることで、将来のパラメータ更新をログイン時の段階的再ハッシュで吸収できる。

## Architecture decisions

1. セッション payload に世代を含める — セッション表を持たずに一括失効を実現するため。状態を DB の1カラムに集約でき、Workers の実行モデルと整合する。
2. 旧形式 Cookie は二段で無効化する — 署名 payload の要素数不一致による拒否と、SESSION_SECRET のローテーション。片方だけでは実装分岐ミスや形式混在の余地が残る。
3. 自己サインアップを持たない — 招待制のみとし、認証面の攻撃対象を増やさない。

## Delivery, migration and rollback

切替時に全利用者が再ログインとなる。これは意図した挙動であり、共有パスワードで発行された「誰のものか特定できないセッション」を新体系へ持ち越さないことを保証する。rollback は `AUTH_PASSWORD` 経路の復活を意味するため行わず、前方修正のみとする。

## Risks and verification

- リスク: 反復回数が Workers の CPU 制限に触れる → ログインの実測時間で検証する。
- リスク: 旧形式 Cookie の受理 → 3要素でない payload を投入する契約テストで検証する。
- 検証: 利用者識別子を改ざんした Cookie が 401 になること、保持 ON/OFF で maxAge が2段階になることをテストで固定する。
