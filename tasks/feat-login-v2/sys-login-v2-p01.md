---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-login-v2/sys-login-v2-p01.md", "confidence": 0.95}]
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "604dd483139018d64ab786385b6e8815666d51cad511ddbc73c3c88a03e35313", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-login-v2/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-09-21T15:10:37Z"
depends_on: []
domain: "documentation"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-login-v2"
file_path: "tasks/feat-login-v2/sys-login-v2-p01.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
graph_node_id: "SYS-LOGIN-V2-P01"
implementation_readiness: {"checked_at": "2026-09-21T15:00:18Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-login-v2"
phase_ref: "P01"
priority: null
project_id: "feature-package-feat-login-v2"
pull_request_linkages: []
related_nodes: ["arch-login-v2-auth", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-frontend", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops", "arch-login-v2-security", "arch-login-v2-ui-ux", "spec-login-v2"]
resource_scope: ["docs/login-v2/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
source_lineage: {"imported_at": "2026-09-21T15:10:37Z", "origin_kind": "system-dev-planner", "source_digest": "604dd483139018d64ab786385b6e8815666d51cad511ddbc73c3c88a03e35313", "source_path": ".dev-graph/plans/feature-package-feat-login-v2/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["login-v2", "p01", "preparation"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "要件ベースライン確定と前提条件・未決事項の着手時整理（K-1・K-5・reset-token 発行者衝突・frontend-002 と -006 の優先）"
tracker_binding: "beads"
updated_at: "2026-09-21T15:10:37Z"
---

# 要件ベースライン確定と前提条件・未決事項の着手時整理（K-1・K-5・reset-token 発行者衝突・frontend-002 と -006 の優先）

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-login-v2
- owners: ["daishiman"]
- tags: ["login-v2", "p01"]
- related_nodes: ["arch-login-v2-auth", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-frontend", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops", "arch-login-v2-security", "arch-login-v2-ui-ux", "spec-login-v2"]
- parent_feature: feat-login-v2
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-login-v2/sys-login-v2-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

goal-spec.json (readiness_pin.status=complete) と features/feat-login-v2.md の Handoff 節を読み合わせ、P02 以降が同じ前提から出発できるよう、目的・成功状態・スコープ・前提条件・未解決事項をdocs/login-v2/design-decisions.mdへ着手時ベースラインとして書き写す。

## 背景

本featureはBetter Auth v1.7.5への移行、招待制の利用者作成、管理者TOTP必須化、migration 0048を伴う。system-spec-harness v0.1.14の出力(readiness_pin.status=complete)に基づくgoal-spec.jsonが本featureの正本入力であり、features/feat-login-v2.mdのHandoff節がK-1/K-4/K-5/K-6/K-7/K-9・reset-token発行者の衝突・frontend-002対-006の対立をP02以降へ引き継ぐべき前提条件として明示している。

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
本phase固有: goal-spec.jsonのopen_items (K-1/K-5/conflict-reset-token/conflict-auth-client) をそのまま書き写す段階であり、いずれの解決も本phaseでは行わない。

## Workstream applicability

- Frontend: N/A: 本phaseは文書整理のみで画面実装を行わない
- Backend: N/A: 本phaseは文書整理のみでコード変更を行わない
- API: N/A: 本phaseは文書整理のみでAPI変更を行わない
- Data: N/A: 本phaseは文書整理のみでmigration変更を行わない
- Infrastructure: N/A: 本phaseは文書整理のみで基盤変更を行わない
- Security: N/A: 本phaseは文書整理のみでsecurity実装を行わない
- Quality: applicable: goal-spec.jsonのacceptance 7項目とarchitecture_refs 9件の整合を確認記録する
- Documentation: applicable: docs/login-v2/design-decisions.mdへ着手時ベースラインを記録する
- Operations: N/A: 配信・運用操作は行わない

## Architecture and deploy unit

- Architecture decisions: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: migration は追加のみ (C3)。既存行の書き換えと backfill は 0 件。migration 番号は実装時に origin/main を fetch して確定する。

## 成果物

- Produced artifacts:
- docs/login-v2/design-decisions.md
- Consumed artifacts:
- architecture/login-v2-auth.md
- architecture/login-v2-backend.md
- architecture/login-v2-database.md
- architecture/login-v2-frontend.md
- architecture/login-v2-infrastructure.md
- architecture/login-v2-maintenance-ops.md
- architecture/login-v2-security.md
- architecture/login-v2-ui-ux.md
- features/feat-login-v2.md
- specs/spec-login-v2.md
- Write scope/touches:
- docs/login-v2/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-LOGIN-V2-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-LOGIN-V2-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-LOGIN-V2-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on ((なし。本feature内で最初のtaskである)) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (自己登録・Google 以外のソーシャルログインと SAML・パスキーと SMS の MFA・trustDevice・複数テナント・外部の状況ページサービス・独自ドメインの DNS 設定そのもの・web 以外の platform・旧表旧列の削除・Cloudflare Access のサーバ側検証経路の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- goal-spec.json の purpose・goal・scope_in・scope_out・acceptance (S1-S7)・architecture_refs の9件・readiness_pin (status=complete) を読み合わせ、docs/login-v2/design-decisions.md に着手時ベースラインとして書き写している。
- K-1 (MFA 設定を始める入口が未定義)・K-5 (CHECK 制約拡張と追加のみ migration 方針の衝突) を前提条件として明記し、それぞれの解消を P02 の責務として記録している。
- reset-token 発行者の衝突 (backend-002 の独自発行 案 対 database-004 の Better Auth 組込み verification 表利用 案) を両論併記し、P02 で一方に決定する未解決事項として記録している。
- frontend-002 (auth-client を使わず薄い関数で包む) と frontend-006 (createAuthClient を使い型を container に閉じる) の対立について、frontend-006 を優先する既定方針を記録している。
- SameSite=Lax への Cookie 変更 (推定、auth-web-007) と K-4/K-6/K-7/K-9 のうち本 feature に適用される事項を前提条件の一覧に含めている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/login-v2/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/login-v2/design-decisions.md への追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-login-v2.md
- Architecture: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Feature: feat-login-v2
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: (なし。本feature内で最初のtaskである)
- Phase-specific references: Handoff節: features/feat-login-v2.md
