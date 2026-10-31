---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-login-v2/sys-login-v2-p05.md", "confidence": 0.95}]
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "604dd483139018d64ab786385b6e8815666d51cad511ddbc73c3c88a03e35313", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-login-v2/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-09-21T15:10:37Z"
depends_on: ["SYS-LOGIN-V2-P04"]
domain: "backend"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-login-v2"
file_path: "tasks/feat-login-v2/sys-login-v2-p05.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
graph_node_id: "SYS-LOGIN-V2-P05"
implementation_readiness: {"checked_at": "2026-09-21T15:00:18Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-login-v2"
phase_ref: "P05"
priority: null
project_id: "feature-package-feat-login-v2"
pull_request_linkages: []
related_nodes: ["arch-login-v2-auth", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-frontend", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops", "arch-login-v2-security", "arch-login-v2-ui-ux", "spec-login-v2"]
resource_scope: ["packages/api/src/auth.ts", "packages/api/src/routes/auth.ts", "packages/api/src/routes/admin-users.ts", "packages/api/src/routes/invitations.ts", "packages/api/src/mfa-setup.ts", "packages/api/src/users.ts", "packages/api/src/login-rate-limit.ts", "packages/api/src/audit-log.ts", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/public-validation.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/index.ts", "packages/api/wrangler.jsonc", "packages/api/package.json", "packages/core/src/invitation.ts", "packages/core/src/index.ts", "packages/core/src/exports.ts", "packages/core/src/types.ts", "migrations/0048_better_auth.sql", "packages/web/src/pages/Login.tsx", "packages/web/src/features/auth/", "packages/web/src/pages/PasswordChange.tsx", "packages/web/src/pages/Settings.tsx", "packages/web/src/components/UserAdmin.tsx", "packages/web/src/components/Input.tsx", "packages/web/src/App.tsx", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/api.ts", "packages/web/src/api-client.ts", "packages/web/src/styles.css", "packages/web/src/routeMetadata.ts", "packages/web/package.json"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
source_lineage: {"imported_at": "2026-09-21T15:10:37Z", "origin_kind": "system-dev-planner", "source_digest": "604dd483139018d64ab786385b6e8815666d51cad511ddbc73c3c88a03e35313", "source_path": ".dev-graph/plans/feature-package-feat-login-v2/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["login-v2", "p05", "mutation"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "Better Auth 導入・招待/MFA設定/再設定/連携 API・migration 0048・ログイン画面群の最終実装"
tracker_binding: "beads"
updated_at: "2026-09-21T15:10:37Z"
---

# Better Auth 導入・招待/MFA設定/再設定/連携 API・migration 0048・ログイン画面群の最終実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-login-v2
- owners: ["daishiman"]
- tags: ["login-v2", "p05"]
- related_nodes: ["arch-login-v2-auth", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-frontend", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops", "arch-login-v2-security", "arch-login-v2-ui-ux", "spec-login-v2"]
- parent_feature: feat-login-v2
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-login-v2/sys-login-v2-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04の失敗テストが全て緑になるまで、Better Auth v1.7.5の導入・招待とMFA設定と再設定と連携のAPI・migration 0048・ログイン画面群を実装し、旧kanjo_session方式とmustChangePasswordFenceを撤去する。

## 背景

architecture/login-v2-backend.mdのContainer and component viewとAPI and service contractsが実装対象の関数・route・hooksの一覧を与えており、architecture/login-v2-database.mdのLogical and physical modelがmigration 0048の表構成を、architecture/login-v2-frontend.mdとarchitecture/login-v2-ui-ux.mdが画面構成と6状態を、それぞれ実装の正本として与えている。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Entry gate: staging run run-feat-login-v2-20260921T1447Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- K-1 (medium、system-spec/completeness-findings.json findings[0]・features/feat-login-v2.md Handoff K-1 正本): TOTP 未設定の管理者が設定トークンで TOTP の設定を始める入口が無い。better-auth 1.7.0 の /two-factor/enable は sessionMiddleware を要するため使えず、POST /api/auth/mfa-setup/start 相当をアプリ側に新設する必要がある。session.create.before が拒否すると /sign-in/email は FAILED_TO_CREATE_SESSION (401) を投げるため、設定トークンを応答へ載せる手段 (APIError の本文か hooks.after) が未確定。mfa_setup_token の消費・twoFactorEnabled=true・セッション作成 (internalAdapter.createSession 経由) を同じ D1 batch に置けるかも未確認であり、P02 で解決する。
- K-5 (low、features/feat-login-v2.md Handoff K-5 正本): password_login_rate_limits.scope_kind と audit_log.action の CHECK 制約は 0039 migration で固定されており、新しい scope_kind・action を追加するには CHECK の拡張 (=表の再構築) が要る。migration 0048 の「追加のみ」方針 (C3) と字面で衝突するため、0034・0039 の前例どおり値を変えずに再構築するか、新しい表を足すかを P02 で決定する。
- reset-token 発行者の衝突 (features/feat-login-v2.md Handoff「正本内の食い違い」正本): パスワード再設定トークンの発行元が backend-002 (独自発行) と database-004 (Better Auth 組込みの verification 表を使う) とで正本内で食い違っており、P02 でどちらか一方に決定し記録する。
- frontend-002 対 frontend-006 (features/feat-login-v2.md Handoff 正本): 認証呼出しの作り方が frontend-web-002 (lib/auth-client.ts の薄い関数) と frontend-web-006 (createAuthClient を container に閉じる) とで食い違っており、後発の frontend-web-006 を優先する。
- SameSite=Lax への Cookie 変更 (agent 推定、auth-web-007 根拠): 旧 Strict から Lax へ変わる (Google OAuth の戻りに必要)。旧仕様のテストの期待値をこの変更に合わせて更新する。
- K-4 (low、Google の dont_remember Cookie は Better Auth の secret で setSignedCookie により署名しないと戻りの処理が読めない): 認可開始の hooks.before で署名する実装が要る。
- K-6 (low、招待の消費と利用者作成の「同じ D1 batch」は Better Auth のアダプタ経由の作成のため確認が要る): パスワードは作成→条件付き UPDATE→0 行なら作成を消す、Google は user.create.after で条件付き UPDATE、の順序で整合を保つ。
- K-7 (low、復旧コードのハッシュ保存可否は 2FA plugin の docs に記述が無い): 固定版 v1.7.5 で D1 の実際の保存形式を確認し、ハッシュにできなければアプリ側で生成と照合を書く。
- K-9 (low、fetched-references の better-auth はリリースページ1件のみ): 実装前に hooks・databaseHooks・twoFactor・accountLinking・setSignedCookie の各 API を固定版 v1.7.5 のソースか docs で確認し、テストに固定する。
本phase固有 (Entry gate): P04の失敗テストが作成済みで、旧実装に当てて失敗することを確認済みであること。Blocker: K-1のAPI形状とK-5のmigration再構築方式がP02で未確定のまま実装を開始しない。

## Workstream applicability

- Frontend: applicable: features/auth/・Input.tsx・App.tsx・PasswordChange.tsx撤去などログイン画面群を実装する
- Backend: applicable: auth.ts・関門(session.create.before/user.create.before)・mfa-setup.tsを実装する
- API: applicable: routes/auth.ts・routes/invitations.ts・routes/admin-users.tsを実装する
- Data: applicable: migrations/0048_better_auth.sqlとdb/schema.ts・schema-guard.tsを実装する
- Infrastructure: N/A: binding・配信構成は据え置き (architecture/login-v2-infrastructure.mdはWorker内実装を指示)
- Security: applicable: login-rate-limit.tsの新入口拡張とcanonical-mutation-fence.ts登録を実装する
- Quality: applicable: P04の失敗テストが全て緑になることを確認する
- Documentation: N/A: docsの最終同期はP12
- Operations: N/A: 運用手順はP12/P13の責務

## Architecture and deploy unit

- Architecture decisions: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Deploy unit/environment: web ビルドと Worker と D1 migration（0048 の追加のみ、番号は着手時に origin/main を fetch して確定する）
- Compatibility/migration/backfill: migration は追加のみ (C3)。既存行の書き換えと backfill は 0 件。migration 番号は実装時に origin/main を fetch して確定する。

## 成果物

- Produced artifacts:
- migrations/0048_better_auth.sql
- packages/api/package.json
- packages/api/src/audit-log.ts
- packages/api/src/auth.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/db/schema.ts
- packages/api/src/index.ts
- packages/api/src/login-rate-limit.ts
- packages/api/src/mfa-setup.ts
- packages/api/src/public-validation.ts
- packages/api/src/routes/admin-users.ts
- packages/api/src/routes/auth.ts
- packages/api/src/routes/invitations.ts
- packages/api/src/schema-guard.ts
- packages/api/src/users.ts
- packages/api/wrangler.jsonc
- packages/core/src/exports.ts
- packages/core/src/index.ts
- packages/core/src/invitation.ts
- packages/core/src/types.ts
- packages/web/package.json
- packages/web/src/App.tsx
- packages/web/src/AuthenticatedApp.tsx
- packages/web/src/api-client.ts
- packages/web/src/api.ts
- packages/web/src/components/Input.tsx
- packages/web/src/components/UserAdmin.tsx
- packages/web/src/pages/Login.tsx
- packages/web/src/pages/PasswordChange.tsx
- packages/web/src/pages/Settings.tsx
- packages/web/src/features/auth/
- packages/web/src/routeMetadata.ts
- packages/web/src/styles.css
- Consumed artifacts:
- docs/login-v2/design-decisions.md
- Write scope/touches:
- packages/api/src/auth.ts
- packages/api/src/routes/auth.ts
- packages/api/src/routes/admin-users.ts
- packages/api/src/routes/invitations.ts
- packages/api/src/mfa-setup.ts
- packages/api/src/users.ts
- packages/api/src/login-rate-limit.ts
- packages/api/src/audit-log.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/public-validation.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/index.ts
- packages/api/wrangler.jsonc
- packages/api/package.json
- packages/core/src/invitation.ts
- packages/core/src/index.ts
- packages/core/src/exports.ts
- packages/core/src/types.ts
- migrations/0048_better_auth.sql
- packages/web/src/pages/Login.tsx
- packages/web/src/features/auth/
- packages/web/src/pages/PasswordChange.tsx
- packages/web/src/pages/Settings.tsx
- packages/web/src/components/UserAdmin.tsx
- packages/web/src/components/Input.tsx
- packages/web/src/App.tsx
- packages/web/src/AuthenticatedApp.tsx
- packages/web/src/api.ts
- packages/web/src/api-client.ts
- packages/web/src/styles.css
- packages/web/src/routeMetadata.ts
- packages/web/package.json

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-LOGIN-V2-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-LOGIN-V2-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-LOGIN-V2-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-LOGIN-V2-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (自己登録・Google 以外のソーシャルログインと SAML・パスキーと SMS の MFA・trustDevice・複数テナント・外部の状況ページサービス・独自ドメインの DNS 設定そのもの・web 以外の platform・旧表旧列の削除・Cloudflare Access のサーバ側検証経路の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- P04 の失敗テストが全て緑になる（K-1 に依拠する分岐は P02 の決定どおりの API 形状で解消し、その他の分岐は pending を残さない）。
- Better Auth v1.7.5 を packages/api/package.json に固定し、emailAndPassword・Google (OIDC)・twoFactor (TOTP+復旧コード)・アカウント連携を設定する。既存 pbkdf2-sha256$ 形式を emailAndPassword.password.verify で読み、再設定を強いない。
- databaseHooks.user.create.before で招待の無いメールの作成を拒否し、databaseHooks.session.create.before で TOTP 未設定の管理者のセッション作成を許可側 (/callback/google と MFA 設定完了処理のみ許可) で絞り、保持なしセッションの expiresAt を12時間にする。
- 招待 (作成・一覧・再送・取消・承諾)・POST /api/auth/mfa-setup/start・POST /api/auth/mfa-setup/complete・再設定依頼/再設定・連携の各 API を authGuard → runtimeSchemaGuard → canonicalMutationFence の既存順序の外側 (未認証入口) または内側 (認証必須操作) に正しく配置する。mustChangePasswordFence は撤去する。
- migration 0048 が user/session/account/verification/twoFactor・invitations・mfa_setup_token を追加のみで作成し、既存 users を INSERT ... SELECT ... WHERE NOT EXISTS で複写し、旧表・旧列を削除しない。
- /login が画像の全構成要素と6状態を描画し、/invite/accept・/reset-password・/mfa・/help・/privacy が未認証で到達できる。PasswordChange.tsx と一時パスワード発行ボタンを撤去する。
- kanjo_session の署名・verifySession・clearSession・session_generation による一括失効・mustChangePasswordFence の参照が実装から0件になる。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/api/src/auth.ts
- packages/api/src/routes/auth.ts
- packages/api/src/routes/admin-users.ts
- packages/api/src/routes/invitations.ts
- packages/api/src/mfa-setup.ts
- packages/api/src/users.ts
- packages/api/src/login-rate-limit.ts
- packages/api/src/audit-log.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/public-validation.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/index.ts
- packages/api/wrangler.jsonc
- packages/api/package.json
- packages/core/src/invitation.ts
- packages/core/src/index.ts
- packages/core/src/exports.ts
- packages/core/src/types.ts
- migrations/0048_better_auth.sql
- packages/web/src/pages/Login.tsx
- packages/web/src/features/auth/
- packages/web/src/pages/PasswordChange.tsx
- packages/web/src/pages/Settings.tsx
- packages/web/src/components/UserAdmin.tsx
- packages/web/src/components/Input.tsx
- packages/web/src/App.tsx
- packages/web/src/AuthenticatedApp.tsx
- packages/web/src/api.ts
- packages/web/src/api-client.ts
- packages/web/src/styles.css
- packages/web/src/routeMetadata.ts
- packages/web/package.json

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。migration 0048 は追加のみの表で既存行を書き換えないため、表が残っても既存 users 版の Worker は動く。配信済みなら直前のビルドへ戻し、新表の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-login-v2.md
- Architecture: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Feature: feat-login-v2
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-LOGIN-V2-P04
- Phase-specific references: 全architecture 8件、spec-login-v2.md 全節
