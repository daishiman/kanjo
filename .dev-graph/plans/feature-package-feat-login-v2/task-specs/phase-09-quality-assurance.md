# System task overlay: レート制限・列挙防止・CSP・secret 非出力・JS バンドル予算の保証確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-login-v2
- owners: ["daishiman"]
- tags: ["login-v2", "p09"]
- related_nodes: ["arch-login-v2-auth", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-frontend", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops", "arch-login-v2-security", "arch-login-v2-ui-ux", "spec-login-v2"]
- parent_feature: feat-login-v2
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-login-v2/sys-login-v2-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

レート制限・列挙防止・CSP・secret非出力・JSバンドル予算といった非機能要件が実装後も満たされていることを保証確認する。

## 背景

architecture/login-v2-security.mdは4入口 (ログイン・MFAコード・招待再送・パスワード再設定・MFA設定) へのレート制限拡張と列挙防止、secretの非出力を求めており、architecture/login-v2-frontend.mdはJSバンドル予算の維持を求めている。実装完了後にこれらが崩れていないことを個別に保証確認する必要がある。

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
本phase固有 (Entry gate): P07の受入検証でS5 (レート制限)・S6 (稼働状態) がPASSしていること。

## Workstream applicability

- Frontend: applicable: JSバンドル予算 (build:bundle/js-budget) の保証確認を行う
- Backend: N/A: バックエンドのレート制限確認はSecurityに含める
- API: N/A: APIのレート制限確認はSecurityに含める
- Data: N/A: 本phaseの関心外
- Infrastructure: N/A: 本phaseの関心外
- Security: applicable: レート制限・列挙防止・CSP・secret非出力・SameSite=Laxの保証確認を行う
- Quality: applicable: 保証確認の記録が本phaseの成果物である
- Documentation: applicable: 保証確認結果をdocs/login-v2/design-decisions.mdに記録する
- Operations: N/A: 配信・運用操作は行わない

## Architecture and deploy unit

- Architecture decisions: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Deploy unit/environment: N/A: 保証確認の記録のみで配布物を持たない
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
- PR body contract: dev-graph graph_node_id SYS-LOGIN-V2-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-LOGIN-V2-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-LOGIN-V2-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-LOGIN-V2-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (自己登録・Google 以外のソーシャルログインと SAML・パスキーと SMS の MFA・trustDevice・複数テナント・外部の状況ページサービス・独自ドメインの DNS 設定そのもの・web 以外の platform・旧表旧列の削除・Cloudflare Access のサーバ側検証経路の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- ログイン・MFAコード・招待再送・パスワード再設定・MFA設定の各入口にIPとアカウントの2軸レート制限 (15分に5回失敗で15分ロック) が効き、他利用者を阻害しないことを確認して記録している。
- 再送依頼・再設定依頼の応答が宛先の有無で本文・ステータス・所要時間とも変わらないことを確認して記録している。
- CSP (connect-src 'self'・form-action 'self'・frame-ancestors 'none') が広がっていないこと、BETTER_AUTH_SECRET・GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET・RESEND_API_KEYがログ・応答に出力されないことを確認して記録している。
- dont_remember Cookieおよびセッション Cookie が Secure・HttpOnly・SameSite=Lax であることを確認して記録している (SameSite=Lax への変更は前提条件として P01 で明記済み)。
- packages/web の build:bundle と js-budget が既存予算内であることを確認して記録している。
- Automated commands:
- pnpm --filter @kanjo/web build:bundle
- pnpm --filter @kanjo/web js-budget
- Required evidence:
- docs/login-v2/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-login-v2.md
- Architecture: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Feature: feat-login-v2
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-LOGIN-V2-P08
- Phase-specific references: architecture/login-v2-security.md、architecture/login-v2-frontend.md
