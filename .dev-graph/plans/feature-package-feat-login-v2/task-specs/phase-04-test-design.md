# System task overlay: core/API/migration/DOM の失敗テスト先行作成（未解決前提条件に該当する分岐を除く）

## Machine-readable registration fields

- feature_package_id: feature-package/feat-login-v2
- owners: ["daishiman"]
- tags: ["login-v2", "p04"]
- related_nodes: ["arch-login-v2-auth", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-frontend", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops", "arch-login-v2-security", "arch-login-v2-ui-ux", "spec-login-v2"]
- parent_feature: feat-login-v2
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-login-v2/sys-login-v2-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P03でレビュー済みの契約をもとに、core・API・migration・DOM の各層で実装前に失敗する検証コードを先行作成し、P05の実装がテストにより駆動されるようにする。

## 背景

既存のpackages/api/src/account-login.test.tsとpackages/web/src/account-login.dom.test.tsxは旧kanjo_session方式の契約を固定しているため、Better Auth版の契約に書き換えてから実装しないと、実装が正しく行われたかを判定する基準がない。architecture/login-v2-maintenance-ops.mdは「追加した統合テストは旧実装に当てて落ちることを確認してから確定する」ことを推奨している。

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
本phase固有 (Entry gate): P03のレビューで是正事項が無い、または是正が反映済みであること。Open risk: K-1のMFA設定開始APIの最終形状がP02の決定に従うまでは、当該分岐のテストをpendingのまま残してよい。

## Workstream applicability

- Frontend: applicable: account-login.dom.test.tsxに画像の全構成要素と6状態の失敗テストを先行作成する
- Backend: applicable: mfa-setup.test.tsとinvitation-lifecycle.test.tsに関門とhooksの失敗テストを先行作成する
- API: applicable: account-login.test.tsをBetter Auth版契約の失敗テストに書き換える
- Data: N/A: migration自体の実装はP05の責務
- Infrastructure: N/A: 本phaseの関心外
- Security: applicable: login-rate-limit.test.tsに新入口のレート制限テストを先行作成する
- Quality: applicable: 先行テストの作成と旧実装での失敗確認が本phaseの成果物である
- Documentation: N/A: docs更新はP12の責務
- Operations: N/A: 配信・運用操作は行わない

## Architecture and deploy unit

- Architecture decisions: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: migration は追加のみ (C3)。既存行の書き換えと backfill は 0 件。migration 番号は実装時に origin/main を fetch して確定する。

## 成果物

- Produced artifacts:
- packages/api/src/account-login.test.ts
- packages/api/src/auth.test-support.ts
- packages/api/src/invitation-lifecycle.test.ts
- packages/api/src/login-rate-limit.test.ts
- packages/api/src/mfa-setup.test.ts
- packages/api/src/password-hash-workerd.test.ts
- packages/web/src/account-login.dom.test.tsx
- Consumed artifacts:
- docs/login-v2/design-decisions.md
- packages/api/src/account-login.test.ts
- packages/web/src/account-login.dom.test.tsx
- specs/spec-login-v2.md
- Write scope/touches:
- packages/api/src/account-login.test.ts
- packages/api/src/auth.test-support.ts
- packages/api/src/login-rate-limit.test.ts
- packages/api/src/password-hash-workerd.test.ts
- packages/api/src/invitation-lifecycle.test.ts
- packages/api/src/mfa-setup.test.ts
- packages/web/src/account-login.dom.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-LOGIN-V2-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-LOGIN-V2-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-LOGIN-V2-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-LOGIN-V2-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (自己登録・Google 以外のソーシャルログインと SAML・パスキーと SMS の MFA・trustDevice・複数テナント・外部の状況ページサービス・独自ドメインの DNS 設定そのもの・web 以外の platform・旧表旧列の削除・Cloudflare Access のサーバ側検証経路の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/api/src/account-login.test.ts を Better Auth 版の契約 (401/403/409・actor_user_id・保持30日/非保持12時間) に書き換え、実装前は失敗することを確認している。
- 招待の作成・再送・取消・承諾 (Google/パスワードの双方) を packages/api/src/invitation-lifecycle.test.ts に先行作成し、有効な招待の無いメールでの signUp.email と Google 新規サインインがどちらも利用者を作らないことを検証項目に含めている。
- packages/api/src/mfa-setup.test.ts に、TOTP 未設定の管理者がパスワードでのログインでも招待のパスワード登録直後でも session 行が0件であること、設定トークンでの TOTP 設定・検証成功後にセッションが発行されること、Google でログインした管理者には TOTP を求めないことの3種を先行作成している。ただし K-1 の設定開始入口の最終 API 形状が P02 の決定に従うまでは、この分岐について complete を宣言しない。
- packages/web/src/account-login.dom.test.tsx に画像の全構成要素と6状態、未認証5経路の到達性を先行作成し、実装前は失敗することを確認している。
- 旧実装 (kanjo_session の署名・世代照合・mustChangePasswordFence) に当てるとこれらのテストが落ちることを確認し、契約を緩めていないことを示している。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/api/src/account-login.test.ts
- packages/api/src/auth.test-support.ts
- packages/api/src/login-rate-limit.test.ts
- packages/api/src/password-hash-workerd.test.ts
- packages/api/src/invitation-lifecycle.test.ts
- packages/api/src/mfa-setup.test.ts
- packages/web/src/account-login.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-login-v2.md
- Architecture: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Feature: feat-login-v2
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-LOGIN-V2-P03
- Phase-specific references: 既存契約: packages/api/src/account-login.test.ts、packages/web/src/account-login.dom.test.tsx
