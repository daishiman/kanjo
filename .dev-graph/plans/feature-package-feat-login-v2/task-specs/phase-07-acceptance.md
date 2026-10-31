# System task overlay: 受入基準 S1〜S7（AT-01〜AT-15）の検証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-login-v2
- owners: ["daishiman"]
- tags: ["login-v2", "p07"]
- related_nodes: ["arch-login-v2-auth", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-frontend", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops", "arch-login-v2-security", "arch-login-v2-ui-ux", "spec-login-v2"]
- parent_feature: feat-login-v2
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-login-v2/sys-login-v2-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

goal-spec.jsonのacceptance S1〜S7とspecs/spec-login-v2.mdのAT-01〜AT-15を実装済みの状態に対して検証し、受入可否を記録する。

## 背景

goal-spec.jsonのacceptanceはS1(G1)からS7(G7)まで7項目あり、spec-login-v2.mdの§テストと受入条件はAT-01からAT-15までの具体的な検証項目を持つ。両者を突き合わせて検証することで、featureのgoalが実装で満たされたことを確認できる。

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
本phase固有 (Entry gate): P06のpnpm test/typecheck/lintが0件の失敗で記録済みであること。

## Workstream applicability

- Frontend: applicable: S1・S6に関わる画面の受入検証を行う
- Backend: N/A: バックエンドの受入検証はS2-S5に含めてQualityで扱う
- API: N/A: API受入検証はS2-S5に含めてQualityで扱う
- Data: N/A: migrationの受入検証はS2/S7に含めてQualityで扱う
- Infrastructure: N/A: 本phaseの関心外
- Security: N/A: セキュリティ受入検証はS5に含めてQualityで扱う
- Quality: applicable: S1〜S7とAT-01〜AT-15の検証・記録が本phaseの成果物である
- Documentation: N/A: docsの最終同期はP12
- Operations: N/A: 配信・運用操作は行わない

## Architecture and deploy unit

- Architecture decisions: arch-login-v2-auth, arch-login-v2-backend, arch-login-v2-database, arch-login-v2-frontend, arch-login-v2-infrastructure, arch-login-v2-maintenance-ops, arch-login-v2-security, arch-login-v2-ui-ux, spec-login-v2
- Deploy unit/environment: N/A: 検証記録のみで配布物を持たない
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
- PR body contract: dev-graph graph_node_id SYS-LOGIN-V2-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-LOGIN-V2-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-LOGIN-V2-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-LOGIN-V2-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (自己登録・Google 以外のソーシャルログインと SAML・パスキーと SMS の MFA・trustDevice・複数テナント・外部の状況ページサービス・独自ドメインの DNS 設定そのもの・web 以外の platform・旧表旧列の削除・Cloudflare Access のサーバ側検証経路の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- S1 (G1): /login の全構成要素・文言の画像完全一致・6状態・直書き色lint 0件を検証し記録している。
- S2 (G2/G7): 未認証401・停止利用者401・非管理者403・最後の管理者停止409・既存PBKDF2利用者の再設定なしログイン・kanjo_session署名経路0件を検証し記録している。
- S3 (G3): 招待経由のGoogle/パスワード登録完了、管理者がパスワードを設定する経路0件、再送依頼応答からの招待有無不可知、自己登録経路0件を検証し記録している。
- S4 (G4): 再設定完了時の既存セッション全失効、応答からの登録有無不可知、連携が再認証とメール確認を経た場合のみ成立することを検証し記録している。
- S5 (G5): TOTP未設定管理者がログインでも招待登録直後でもセッションを得ないこと、TOTP設定済み利用者はコード入力後にのみ得ること、Googleログイン管理者にTOTPを求めないこと、各入口の連続失敗ロックを検証し記録している。
- S6 (G6): 未認証での稼働状態/ヘルプ/プライバシー到達性と、稼働状態応答に内部情報が含まれないことを検証し記録している。
- S7 (G7): 既存20画面の認証ガードと契約テストが緑のまま、migrationが既存行を書き換えない、旧経路への戻し手順がdocsにあることを検証し記録している。AT-01〜AT-15の全項目を既知の逸脱・未実施・一部適合を除いてPASSとして記録している。
- Automated commands:
- pnpm test
- pnpm --filter @kanjo/web lint
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
- Dependencies: SYS-LOGIN-V2-P06
- Phase-specific references: spec-login-v2.md §テストと受入条件 (AT-01〜AT-15)
