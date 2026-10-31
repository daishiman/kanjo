---
graph_node_id: "arch-login-v2-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "ログイン v2 — Better Auth を同じ Worker に置き、外部は Google と Resend だけ、秘密は Workers の secret で必須にする"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "infrastructure"]
file_path: "architecture/login-v2-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f4d45a070b691744fc0dba160be78d9b2d16cfc8adab97204848860e4fc1d304"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "770103c73397f376877965f33b05edb030ab7f97ef9c92f8d4eb5a8c6070a510", "imported_at": "2026-09-21T14:22:03Z"}
created_at: "2026-09-21T14:22:03Z"
updated_at: "2026-09-21T14:22:03Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-ui-ux", "arch-login-v2-frontend", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-auth", "arch-login-v2-security", "arch-login-v2-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/index.ts", "packages/api/package.json", ".github/workflows/ci.yml", ".github/workflows/migrate.yml", ".github/workflows/deploy.yml", "migrations", "docs/cloudflare-credentials-setup.md", "docs/runbooks"]
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
classification_reason: "system-spec の infrastructure 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/login-v2-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:22:03Z"}
serves_goals: ["G2", "G3", "G6", "G7"]
---

# Architecture overview

ログイン v2 — Better Auth を同じ Worker に置き、外部は Google と Resend だけ、秘密は Workers の secret で必須にする。`system-spec/infrastructure.md` (確定セル infrastructure.web、主根拠 qa-login-v2-infrastructure-web-003) が承認時入力で、本書は実行基盤・外部サービス・secret・配信元の設定と、利用者の作業として切り出す手順の制約を持つ。仕様ノード `spec-login-v2` が本書の上流である。

凡例: 「(agent 推定・利用者未確認、根拠 qa-…)」を付けた値は正本章で `agent-inference` と宣言された実装手段で、付けていない到達点は利用者決定 (user-decision) または観測事実 (evidence) である。

## Context and drivers

- Business/technical context (観測事実、qa-login-v2-infrastructure-web-evidence-001): `packages/api/wrangler.jsonc` は Worker 名 `kanjo-console`、`compatibility_flags` に `nodejs_compat` を持ち、D1 (`kanjo-db`) と R2 (`kanjo-files`) を束ねる。配信は workers.dev で独自ドメインは無い。必須 secret は `BETTER_AUTH_SECRET`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`RESEND_API_KEY`、公開固定値は `BETTER_AUTH_URL`・検証済み `MAIL_FROM` である。CI は `.github/workflows/ci.yml`、migration は `migrate.yml`、配信は `deploy.yml`。
- 旧世代との差分: 旧世代 (`architecture/account-login-infrastructure.md`) は外部サービスを持たず、秘密はセッション署名鍵の 1 本だった。v2 は外部に Google (OIDC) と Resend を加え、旧署名鍵を Better Authの鍵へ置き換えて secret を 4 本に統一する。
- Quality attribute priorities: G2・G3・G6・G7 に資する。Worker と D1 の構成を変えず、Better Auth を同じ Worker の中に置く (qa-login-v2-infrastructure-web-003)。
- Constraints: 追加の外部サービスは Google と Resend だけ (C7)。Resend Free は月 3,000 通・日 100 通・3 ドメイン (`system-spec/00-requirements-definition.md` dec-login-v2-mail-delivery)。Google Cloud Console の OAuth 設定、Resend の送信ドメイン認証 (SPF / DKIM)、独自ドメインの用意は利用者の作業 (C2)。

## Goals and non-goals

- Goals:
  - G2: Better Auth を既存の api Worker に載せ、D1 のセッション表で動かす。`nodejs_compat` (AsyncLocalStorage) は既に有効であることを保つ。
  - G2・G3: 認証に要る秘密を Workers の secret として必須にし、Better Auth の配信元の設定を本番の配信元に合わせる。
  - G3: 招待・再設定・連携確認のメールを Resend で送れるようにし、送信ドメイン認証の手順を docs に切り出す。
  - G6: 稼働状態 API を同じ Worker に置き、外部の状況ページサービスを使わない。
  - G7: migration を先、Worker を後に配信する既存の順を守り、旧経路へ戻せるようにする。
- Non-goals:
  - Cloudflare Email Service・Cloudflare Access への認証の委任 (選ばれなかった選択肢)
  - 独自ドメインの取得・DNS 設定そのもの (手順だけを docs に書く、U7 対象外)
  - 外部の状況ページサービス (Statuspage など)
  - キュー・Durable Objects・新しいバインディングの追加
  - web 以外の platform のための配信

## System context and boundaries

- Users/external systems: ブラウザ → Cloudflare (静的配信と Worker) → D1。Worker → Google (認可エンドポイントと ID トークンの検証) と Resend (送信 API)。GitHub Actions が migration と配信を行う。
- Trust/deployment/data boundaries: 外部へ出るのは Google (OIDC の認可と ID トークンの検証) と Resend (宛先メールアドレスと本文) だけで、業務データ (明細・金額) は送らない (C7)。本番の D1 への書込は `migrate.yml` と Worker だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| api Worker (`kanjo-console`) | Better Auth・招待・MFA 設定・稼働状態を既存の Worker に載せる | HTTP | packages/api | Cloudflare Workers |
| D1 (`kanjo-db`) | 認証の表・招待・MFA 設定トークン | SQL | migrations | Cloudflare D1 |
| Workers secret | `BETTER_AUTH_SECRET`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`RESEND_API_KEY` | `wrangler secret` | 運用者 | Cloudflare |
| 公開固定値 | `BETTER_AUTH_URL`・Resendで検証済みの `MAIL_FROM` | GitHub Repository variables / `wrangler --var` | 運用者 | GitHub・Cloudflare |
| Google (OIDC) | 認可と ID トークンの発行 | OAuth 2.0 / OIDC | Google | 外部 |
| Resend | 招待・再設定・連携確認のメール送信 | HTTPS API | Resend | 外部 |
| `ci.yml` / `migrate.yml` / `deploy.yml` | lint・型・テスト、追加 migration の反映、配信 | GitHub Actions | リポジトリ | CI |

(secret 名は agent 推定・利用者未確認、根拠 qa-login-v2-infrastructure-web-004)

## Cross-cutting contracts

- Identity/access: Worker の認証は `architecture/login-v2-auth.md` と `architecture/login-v2-backend.md` に従う。
- Errors/resilience: Resend の送信失敗は応答に出さず (列挙防止)、利用者の再送依頼と管理者の再送で回復する。Google の障害時もパスワードでのログインは動く。
- Observability/audit: 稼働状態 API (`GET /api/status`) は D1 の `SELECT 1` の成否だけで `normal` / `degraded` を返す (agent 推定・利用者未確認、根拠 qa-login-v2-backend-web-002)。Resend と Google の到達性は状態に含めない。
- Configuration/secrets: 4 本の secret を `wrangler.jsonc` の `secrets.required` に加え、未設定の環境では配信を止める。Better Auth の `baseURL` と `trustedOrigins` を配信元に合わせる (agent 推定・利用者未確認、根拠 qa-login-v2-infrastructure-web-004)。秘密はリポジトリ・ログ・応答に出さない (C2)。
- Compatibility/versioning: Better Auth の版を固定する (C1、v1.7.5)。migration を先、Worker を後に配信する。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/login-v2-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/login-v2-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/login-v2-database.md`)
- Security: N/A: 本章の関心外 (`architecture/login-v2-security.md`)

### Infrastructure architecture

#### Environments and topology

- Environments: 本番とローカル (wrangler dev + vite)。Resend の送信元は利用者が用意する独自ドメインのサブドメイン (例: `mail.<domain>`) とし、ドメインが用意できるまではステージングだけ Resend の検証用アドレスで送る。Google の承認済みリダイレクト URI は本番とステージングの 2 つを登録する (agent 推定・利用者未確認、根拠 qa-login-v2-infrastructure-web-002)。
- Topology: 単一の Worker と単一の D1。Better Auth を別 Worker に分けない。

#### Compute and storage

- Compute: 既存の api Worker。Better Auth は `nodejs_compat` の AsyncLocalStorage を使う (qa-login-v2-infrastructure-web-004、`dec-login-v2-auth-foundation` の free 欄)。メール送信は `waitUntil` で応答の後に行う。
- Storage: 既存の D1 に認証の表・招待・MFA 設定トークンを足す。R2 は使わない。
- Capacity: Resend Free の日 100 通が招待・再設定・連携確認の合計の上限になる。入口ごとのレート制限 (`architecture/login-v2-backend.md`) で送信数も抑える。

#### IaC and delivery

- IaC: `packages/api/wrangler.jsonc` の `secrets.required` に 4 本を加え、Better Auth の依存を `packages/api/package.json` で版固定する。schema は migration の SQL で管理する。
- Delivery: `ci.yml` → `migrate.yml` (追加 migration) → `deploy.yml` (Worker と web)。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を migration と同じ変更で上げ、未適用の環境を 503 で止める。

#### Secrets and access

- Secrets: `BETTER_AUTH_SECRET`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`RESEND_API_KEY` を `wrangler secret` で本番に置く。旧 `SESSION_SECRET` は runtime と標準配信手順から撤去し、二重の認証正本を残さない。ローカルは `.dev.vars` に置き、リポジトリに入れない。`BETTER_AUTH_URL` と `MAIL_FROM` は公開固定値として配信時に渡し、未設定なら配信前またはメール送信前に fail-closed とする。
- Access: Google Cloud Console の OAuth クライアントと Resend の API キー・送信ドメインは利用者が作成し、手順を docs に切り出す (qa-login-v2-infrastructure-web-003)。本番の D1 への migration は `migrate.yml` からだけ行う。

#### Reliability and recovery

- Failure modes: Resend の障害・日次上限でメールが届かない (招待・再設定が完了しない)。Google の障害で Google ログインだけが止まる。secret の未設定で Better Auth が起動しない。D1 の障害で `GET /api/status` が `degraded` を返す。
- Recovery: Worker は直前版 (旧認証) へ戻せる。schema は追加のみなので戻さない。管理者が締め出されたときの復旧は `architecture/login-v2-maintenance-ops.md`。

#### Infrastructure verification

CI で lint・型・テストを通す。送信 API はテストで差し替え、実際の Resend と Google を CI から呼ばない。migration をローカル D1 に当てて `schema-guard` が 503 を返さないことを確かめる。`wrangler.jsonc` の `secrets.required` に 4 本があること、`nodejs_compat` が有効なことを設定の検査で確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-login-v2-infrastructure-web-003 | Better Auth を既存 Worker の中に置き、追加の外部は Google と Resend だけにする | 認証を別 Worker・外部 IdP に分ける | 運用する部品が増えず無料枠のまま動く | Worker の起動に 4 本の secret が要る |
| qa-login-v2-decision-002 | メール送信は Resend | Cloudflare Email Service / 送信の無効化 | fetch 1 本で送れ、Workers Paid とドメイン移管が要らない | 宛先が Resend へ渡る。日 100 通の上限 |
| qa-login-v2-decision-001 | Better Auth へ全面移行 | 自前 OIDC / Cloudflare Access | 画像のログイン画面を自アプリに持てる | `nodejs_compat` を保つ |
| qa-login-v2-infrastructure-web-004 (agent 推定) | `secrets.required` に 4 本を加え、`baseURL`・`trustedOrigins` を配信元に合わせる | 実行時に未設定を許す | 未設定のまま配信されない | 環境ごとに secret の投入が要る |
| qa-login-v2-infrastructure-web-002 (agent 推定) | 送信元は独自ドメインのサブドメイン、ドメイン用意まではステージングだけ検証用アドレス | workers.dev のまま本番送信 | SPF / DKIM を満たし迷惑メール判定を避ける | 独自ドメインが用意されるまで本番の招待は送れない |

## Delivery, migration and rollback

- Build/deploy topology: GitHub Actions の `ci.yml` → `migrate.yml` → `deploy.yml`。
- Migration sequence: 利用者が Google Cloud Console の OAuth クライアントと Resend の送信ドメイン認証を用意 → 4 本の secret を本番に投入 → 追加 migration を Migrate で反映 → Worker と web を Deploy。
- Rollback trigger/procedure: Deploy 後の不具合は Worker と web を旧認証の版へ戻す (新表は残す)。Migrate が通って Deploy が止まった場合は Deploy を再実行する。migration は戻さない。

## Risks and verification

- Risk/assumption: 独自ドメインが無い間は本番で招待・再設定のメールが送れず、G3・G4 が本番で成立しない。独自ドメインの用意を移行の前提条件として docs に書く。
- Risk/assumption: Resend Free の日 100 通は、再送依頼の連打や招待の一括作成で使い切りうる。入口のレート制限で抑え、超過時の挙動 (受付は同じ応答、送信だけ失敗) をテストで確かめる。
- Risk/assumption (評価の既知課題 medium、`system-spec/completeness-findings.json` findings[0]): MFA 設定を始める入口 (`/api/auth/mfa-setup/start` 相当) が未定義、sign-in が 401 `FAILED_TO_CREATE_SESSION` のとき設定トークンを返す手段が未定、トークン消費とセッション作成 (`internalAdapter.createSession` 経由) を同じ D1 batch に置けるか未確認。基盤の変更は伴わないが、同じ Worker と D1 の中で plan が解決する。`/mfa-setup/*` をレート制限の入口に加える。
- Risk/assumption: Better Auth の `baseURL` がステージングと本番で取り違えられると、Google のリダイレクトが失敗する。環境ごとの値を docs の手順に書く。
- Architecture fitness test: `wrangler.jsonc` のバインディングが増えていないこと。外部への fetch 先が Google と Resend だけであること。`secrets.required` に 4 本があること。
- Load/failure/security validation: 送信 API の差し替えで、送信失敗が応答を変えないことを確かめる。secret が応答・ログに出ないこと。
