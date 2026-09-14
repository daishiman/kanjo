---
graph_node_id: "arch-account-login-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "アカウントログイン — セキュリティ方針"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: ["spec-account-login"]
related_nodes: ["arch-account-login-auth", "arch-account-login-backend", "arch-account-login-maintenance-ops"]
resource_scope: ["packages/api/src/auth.ts", "packages/api/src/routes", "packages/api/src/lib"]
purpose: "認証周りの攻撃面 (列挙・総当たり・権限昇格・締め出し) を設計として塞ぐ。"
goal: "アカウントの存否を漏らさず、総当たりを抑止し、admin 権限をサーバ側で強制し、監査を actor 付きで残す状態にする。"
scope_in: ["列挙防止 (応答本文・ステータス・所要時間の不区別)", "メールアドレス単位 + 送信元単位の rate limit", "パスワード強度 (12文字以上・明白な弱パスワード拒否)", "role の2値 (admin/member) とサーバ側 403", "一時パスワードの使い捨て・期限・ハッシュ保存", "audit_log への actor 付き記録"]
scope_out: ["細粒度の権限行列 (画面別・操作別)", "多要素認証", "パスワード履歴の保持", "同時セッション数の上限"]
acceptance: ["未登録メールと誤パスワードで応答本文・ステータス・所要時間が区別できない", "送信元・accountの両軸で分散攻撃を制限する", "管理系 API が admin 以外に403を返す", "最後の有効な admin を停止・降格する操作が拒否される", "audit_log に平文パスワード・一時パスワード・セッション署名が含まれない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/account-login-security.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "d3aad80a2759d6f3a71b65c9211452c0cbbf30a75481100bfbabc0ef62246b77"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "87a4c141bbe1788454f85970f6b8c1756203b93c4d853a1a25bc23a1dd7a1299", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "攻撃面と防御の配置を定める横断方針であり、実装単位ではないため architecture として取り込む。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/account-login-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G2, G1, G3]
---

# アカウントログイン — セキュリティ方針

規範は `specs/spec-account-login.md`、内容の正本は `system-spec/security.md`。

## Architecture overview

7つの防御を配置する: 列挙防止、総当たり対策、パスワード強度、role によるサーバ側認可、一時パスワードの使い捨て化、監査記録、Cookie 属性の強制。いずれも「UI で隠す」ではなくサーバ側で成立させる。

## Context and drivers

現行の rate limit は共有パスワード単位でしか効かず、利用者ごとの試行を分離できない。また `userId` が固定であるため、監査ログに actor を書けない。利用者アカウントの導入は、この2つを同時に解ける位置にある。

## Goals and non-goals

- Goal: 存否を漏らさない、総当たりを抑える、権限をサーバで強制する、締め出しを防ぐ、監査を残す。
- Non-goal: 細粒度の権限行列、多要素認証、パスワード履歴、同時セッション上限。

## System context and boundaries

境界は `/api/auth/*` と `/api/admin/*`。UI でのメニュー非表示は補助であり、権限判定の正本はサーバ側の 403 とする。

## Container and component view

- 応答整形 (存否によらず同一の本文・ステータス・所要時間)
- rate limit ストア (メールアドレス単位 + 送信元単位)
- パスワード強度判定 (12文字以上・明白な弱パスワードの拒否)
- 認可ミドルウェア (admin 限定エンドポイント)
- 監査記録 (`audit_log` への actor 付き追記)

## Cross-cutting contracts

- 認証失敗時はパスワード検証を常に実行し、アカウント不在でも所要時間差を作らない。
- 公開された `/api/auth/*` の JSON body は16KiBで打ち切り、資格情報の検証やDB接続より前に413を返す。
- 全応答へrequest IDを付け、未捕捉例外は同じIDだけをクライアントへ返す。秘密・SQL・スタックは応答へ出さない。
- Cookie は HttpOnly/Secure/SameSite=Strict を必須とする。
- 監査記録に平文パスワード・一時パスワード・セッション署名を含めない。

## Subtype architecture

**security**: 防御の重心を「履歴や上限で縛る」ではなく「失効を確実にする」側へ置いた。パスワード履歴を保持しないのは、履歴そのものが漏洩時の資産となり、利用者の他サービスの資格情報を推測させる材料になるため。同時セッション上限を設けないのは、正規利用者を締め出す一方で攻撃者は先行セッションを維持でき、防御として非対称に弱いため。

## Architecture decisions

1. 現行と同一のパスワードのみ拒否し、過去世代の履歴は保存しない (利用者決定 `qa-security-web-003`)。
2. 同時セッション数に上限を設けない。封じ込めは `session_generation` の一括失効で行う (利用者決定 `qa-security-web-003`)。
3. 最後の有効な admin を失う操作をサーバ側で拒否する — 締め出しは復旧コストが最も高い失敗モードのため。

## Delivery, migration and rollback

rate limit のキー拡張は migration を伴う。既存の設定経路 (`PASSWORD_LOGIN_*` override) を踏襲するため、窓・上限・ロック秒の運用値は据え置きで切り替えられる。

## Risks and verification

- リスク: 応答時間差による列挙 → 不在時もパスワード検証を実行して検証する。
- リスク: admin の全滅 → 停止・降格の各操作に対する原子的な拒否テストで固定する。
- リスク: 巨大な認証bodyと調査不能な500 → 16KiB上限、request IDと汎用エラー応答の契約テストで固定する。
- 検証: ロックアウトが対象メールに限定されること、管理系 API が member に 403 を返すことをテストで固定する。
