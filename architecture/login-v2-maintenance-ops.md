---
graph_node_id: "arch-login-v2-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "ログイン v2 — 移行と戻し・締め出しからの復旧を runbook に置き、account-login の契約テストを Better Auth 版で緑にする"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "maintenance-ops"]
file_path: "architecture/login-v2-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "9fcba90bc9dffee036f5cf79106f837776098dfd42738f59d26aab2042be0d94"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "9fcba90bc9dffee036f5cf79106f837776098dfd42738f59d26aab2042be0d94", "imported_at": "2026-09-21T14:22:03Z"}
created_at: "2026-09-21T14:22:03Z"
updated_at: "2026-09-21T14:22:03Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-ui-ux", "arch-login-v2-frontend", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-auth", "arch-login-v2-security", "arch-login-v2-infrastructure"]
resource_scope: ["package.json", "docs/runbooks/account-login-operations.md", "docs/runbooks/scripts/admin-credential-remote.sh", "docs/account-login", "scripts/seed-admin.mjs", "scripts/seed-admin.test.mjs", "packages/api/src/account-login.test.ts", "packages/api/src/login-rate-limit.test.ts", "packages/web/src/account-login.dom.test.tsx"]
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
classification_reason: "system-spec の maintenance-ops 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/login-v2-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:22:03Z"}
serves_goals: ["G2", "G3", "G5", "G7"]
---

# Architecture overview

ログイン v2 — 移行と戻し・締め出しからの復旧を runbook に置き、account-login の契約テストを Better Auth 版で緑にする。`system-spec/maintenance-ops.md` (確定セル maintenance-ops.web、主根拠 qa-login-v2-maintenance-ops-web-001) が承認時入力で、本書は運用手順の置き場所、締め出しからの復旧、テストの付け替えと追加、検証の手順の制約を持つ。仕様ノード `spec-login-v2` が本書の上流である。

凡例: 「(agent 推定・利用者未確認、根拠 qa-…)」を付けた値は正本章で `agent-inference` と宣言された実装手段で、付けていない到達点は利用者決定 (user-decision) または観測事実 (evidence) である。

## Context and drivers

- Business/technical context (観測事実、qa-login-v2-maintenance-ops-web-evidence-001): `docs/runbooks/account-login-operations.md` が現行の一時パスワードの発行と管理者の復旧の手順を持ち、`docs/account-login/` に `release-record.md` (と `spec-reflection-receipt.md`) がある。認証の契約は `packages/api/src/account-login.test.ts` と `packages/web/src/account-login.dom.test.tsx` が固定する。本書の追加観測: 本番の管理者の資格情報は `docs/runbooks/scripts/admin-credential-remote.sh` (bootstrap / reset-admin) が stdin 経由で `scripts/seed-admin.mjs` に渡して入れる。`package.json` の `test:aux` は `runbooks:test` と `seed-admin:test` を含み、`test:coverage:account-login` が api と web の account-login のカバレッジを測る。
- 旧世代との差分: 旧世代の runbook は「一時パスワードの発行」と「管理者のパスワードを seed で入れ直す」復旧で成り立っていた。v2 は一時パスワードを撤去する (qa-login-v2-decision-004) ため、runbook を招待の再送・取消へ置き換え、締め出しの復旧に「MFA 喪失」が加わる (qa-login-v2-decision-003)。
- Quality attribute priorities: G2・G3・G5・G7 に資する。既存の契約テストは緩めず、Better Auth 版で同じ契約を緑にする (qa-login-v2-maintenance-ops-web-001)。
- Constraints: 実データをテストに持ち込まない。秘密 (パスワード・secret・TOTP の秘密) を runbook の例・argv・ログに出さない (C2)。

## Goals and non-goals

- Goals:
  - G2: Better Auth への移行と戻しの手順、secret の設定手順を docs に置く。既存の account-login の契約テスト (保持 30 日・保持なし 12 時間、停止した利用者の即時失効、`/api/*` の認証ガードと admin 判定、audit_log の actor) を Better Auth 版で緑にする。
  - G3: runbook の一時パスワードの手順を招待の再送と取消の手順に置き換え、招待 (発行・承諾・再送・取消・期限切れ) の統合テストを加える。
  - G5: 管理者の MFA 必須と MFA 喪失からの復旧手順を置き、MFA (設定トークン・TOTP・復旧コード) の統合テストを加える。
  - G7: Google Cloud Console と Resend の設定手順、最後の管理者の停止・MFA 喪失からの復旧手順を docs に置く。再設定・連携・稼働状態の統合テストを加える。
- Non-goals:
  - 新しい監視・アラート・ダッシュボード・外部の状況ページ
  - 実際の Google と Resend を呼ぶ E2E の CI への追加
  - 独自ドメインの取得そのもの (手順の記述だけ)

## System context and boundaries

- Users/external systems: 運用者 (リポジトリの所有者) が runbook を読んで wrangler・Google Cloud Console・Resend の管理画面を操作する。開発者のローカル環境と GitHub Actions の CI。
- Trust/deployment/data boundaries: 本番 D1 への直接の書込は締め出しからの復旧に限り、runbook の専用スクリプトから行う。テストは合成データだけを使い、本番の D1・Google・Resend に触れない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `docs/runbooks/account-login-operations.md` | 一時パスワードの手順を招待の再送・取消へ置き換え、締め出し (最後の管理者の停止・MFA 喪失) からの復旧を置く | Markdown | リポジトリ | リポジトリ |
| `docs/account-login/` | 移行と戻しの手順、secret・Google Cloud Console・Resend (SPF / DKIM)・独自ドメインの設定手順、リリース記録 | Markdown | リポジトリ | リポジトリ |
| `docs/runbooks/scripts/admin-credential-remote.sh` と `scripts/seed-admin.mjs` | 本番 D1 への管理者の入れ直しと、MFA 喪失時の twoFactor 行の削除 | CLI (stdin) | 運用者 | ローカル |
| `packages/api/src/account-login.test.ts` | 既存の認証の契約を Better Auth 版で緑にする | vitest | packages/api | CI |
| API 統合テスト (追加) | 招待・再設定・連携・MFA・稼働状態 | vitest | packages/api | CI |
| `packages/web/src/account-login.dom.test.tsx` | ログイン画面と招待承諾・MFA の画面契約 | vitest + DOM | packages/web | CI |

(追加テストのファイル名は正本章に定めが無く plan で決める。本書の推定)

## Cross-cutting contracts

- Identity/access: 認可のテストは `architecture/login-v2-auth.md` と `architecture/login-v2-security.md` の検証項目に従う。
- Errors/resilience: 再送・再設定の依頼が有無に関わらず 202 と同じ本文を返すこと、送信失敗が応答を変えないことをテストで固定する。
- Observability/audit: 招待の発行・再送・取消、MFA の設定と解除、復旧スクリプトの操作を audit_log に残すことをテストで確かめる。復旧スクリプトの実行は release-record か runbook の記録欄に残す。
- Configuration/secrets: runbook は secret 名だけを書き、値を書かない。テストは固定の偽の secret を使う。
- Compatibility/versioning: 既存テストの期待値を変えるときは、変えた理由 (一時パスワードの撤去・Cookie 名の変更など仕様の変更) を release-record に残し、契約を緩めたのか定義を変えたのかを区別できるようにする。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/login-v2-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/login-v2-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/login-v2-database.md`)
- Security: N/A: 本章の関心外 (`architecture/login-v2-security.md`)

### Infrastructure architecture

#### Environments and topology

- Environments: ローカル (wrangler dev + vite 4175、`.dev.vars` に偽の secret) と CI と本番。`verify:full` はローカルの vite 4175 を前提にする。
- Topology: 既存のまま。

#### Compute and storage

- Compute: CI の GitHub Actions ランナー。復旧スクリプトは運用者のローカルから wrangler で本番 D1 を叩く。
- Storage: テストはメモリ上か一時的なローカル D1 を使う。

#### IaC and delivery

- IaC: N/A: 本章では基盤の定義を変えない (`architecture/login-v2-infrastructure.md`)。
- Delivery: `ci.yml` で lint・型・テスト (`test:aux` の `runbooks:test`・`seed-admin:test` を含む) を通してから `migrate.yml` と `deploy.yml` へ進む既存の順。

#### Secrets and access

- Secrets: runbook と docs は secret 名 (`BETTER_AUTH_SECRET`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`RESEND_API_KEY`) と投入手順だけを書く。復旧スクリプトはパスワードを stdin だけで受け、argv・一時ファイルに置かない既存の方針を保つ。
- Access: 本番 D1 への復旧操作は wrangler の認証を持つ運用者だけが行う。実データの持ち込みは `scripts/hooks/guard-real-data.sh` が止める。

#### Reliability and recovery

- 戻し: Better Auth の route を外し旧 `authRoute` と `authGuard` を戻す commit を revert で作り、新表は残したまま旧 `users` で動かす (agent 推定・利用者未確認、根拠 qa-login-v2-maintenance-ops-web-002)。
- 最後の管理者の停止: 管理者の資格情報を `admin-credential-remote.sh` の流れで入れ直す手順を、Better Auth の表 (user・account) に合わせて書き換える。
- MFA 喪失: `scripts/` の seed で対象管理者の twoFactor の行を消し、次回ログインで MFA の再設定をさせる (agent 推定・利用者未確認、根拠 qa-login-v2-maintenance-ops-web-002)。消した後の次回ログインは管理者の MFA 関門で MFA 設定へ回される (`architecture/login-v2-auth.md`)。
- Recovery: テストが落ちたら差し戻す。配信後の不具合は上記の戻しで旧認証へ戻す。

#### Infrastructure verification

CI で api・web のテストと lint と `test:aux` を通す。ローカルで `verify:full` を実行する。追加した統合テストは、旧実装 (一時パスワード方式) に当てて落ちることを確かめてから確定する。`seed-admin.test.mjs` に twoFactor 行の削除の経路を加え、秘密が出力に出ないことを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-login-v2-maintenance-ops-web-001 | 移行と戻し・secret・Google と Resend の設定・締め出しからの復旧の手順を docs に置く | 手順を口頭・PR 本文に留める | 運用者 1 人でも再現できる | docs の更新が実装と同じ変更に入る |
| qa-login-v2-decision-004 | runbook の一時パスワードの手順を招待の再送・取消に置き換える | 一時パスワードの手順を残す | 管理者が他人のパスワードを設定しない | 旧手順の参照を docs から除く |
| qa-login-v2-maintenance-ops-web-001 | 既存の account-login の契約テストを Better Auth 版で緑にする | 契約テストを書き直す | 移行後も同じ契約を満たすことを示せる | 旧 Cookie 名などの期待値の変更理由を記録する |
| qa-login-v2-decision-003 | 管理者の MFA 喪失の復旧手順を置く | 復旧を手順化しない | 管理者 MFA 必須でも締め出されない | 復旧が本番 D1 への直接操作になる |
| qa-login-v2-maintenance-ops-web-002 (agent 推定) | 戻しは revert で旧 route を戻し新表を残す / MFA 喪失は seed で twoFactor 行を消す | 新表を落とす migration / 管理画面での解除 | 追加のみの schema を保ち戻しが速い | 戻した後の新表のデータは旧経路から見えない |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI → Migrate → Deploy。
- Migration sequence: 契約テストの付け替え (旧実装で落ちることの確認) → 統合テストの追加 (招待・再設定・連携・MFA・稼働状態) → 実装 → docs (移行と戻し、secret、Google と Resend、締め出しの復旧) と runbook の書き換え → release-record への記録。
- Rollback trigger/procedure: CI が落ちたら差し戻す。配信後の不具合は revert の commit で旧認証へ戻し、新表は残す。Migrate が通って Deploy が止まった場合は Deploy を再実行する。

## Risks and verification

- Risk/assumption: 戻しの後は旧 `users` のパスワードで動くため、移行後に招待で加わった利用者や再設定したパスワードは旧経路に無い。戻しの手順にこの影響と、戻した後に必要な再発行を書く。
- Risk/assumption: MFA 喪失の復旧は本番 D1 への直接操作で、対象の取り違えが他の管理者の MFA を外す。対象を user id で指定し、実行前に対象の行数を確かめる手順にする。
- Risk/assumption (評価の既知課題 medium、`system-spec/completeness-findings.json` findings[0]): MFA 設定を始める入口 (`/api/auth/mfa-setup/start` 相当) が未定義、sign-in が 401 `FAILED_TO_CREATE_SESSION` のとき設定トークンを返す手段が未定、トークン消費とセッション作成 (`internalAdapter.createSession` 経由) を同じ D1 batch に置けるか未確認。plan で解決し、決まった入口ごとに統合テストを置く。`/mfa-setup/*` をレート制限の入口に加え、そのテストも加える。
- Risk/assumption: `verify:full` はローカルの vite 4175 を前提にし、ログインの 503 は `.dev.vars` 不足で起きる。Better Auth の secret を `.dev.vars` の例に加える。
- Architecture fitness test: 既存の account-login の契約テストが期待値を緩めずに緑であること。追加の統合テストの件数と対象の件数が 0 でないこと。runbook に「一時パスワード」の手順が残っていないこと。
- Load/failure/security validation: 再送・再設定の依頼が有無で同じ応答であること、送信失敗が応答を変えないこと、復旧スクリプトの出力に秘密が出ないことをテストで確かめる。
