---
graph_node_id: "arch-login-v2-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "ログイン v2 — 4 入口のレート制限と列挙防止、secret と署名 Cookie、外部送信は Google と Resend だけ"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "security"]
file_path: "architecture/login-v2-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "1e7e1f3b3fc1b09c3734d93765230c03790309076ac2e52838a3fb228501f9a7"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "fbb9e67c4ceecb54ef6323259062a6d2c8d3bcf67b3fd1edeccc8bebef876336", "imported_at": "2026-09-21T14:22:03Z"}
created_at: "2026-09-21T14:22:03Z"
updated_at: "2026-09-21T14:22:03Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-ui-ux", "arch-login-v2-frontend", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-auth", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/better-auth.ts", "packages/api/src/auth-endpoints.ts", "packages/api/src/auth-rate-limit.ts", "packages/api/src/auth-audit.ts", "packages/api/src/routes/account.ts", "packages/api/src/routes/admin-users.ts", "packages/api/src/routes/status.ts", "packages/api/wrangler.jsonc", "packages/web/public/_headers", "docs/runbooks/account-login-operations.md"]
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
classification_reason: "system-spec の security 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/login-v2-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:22:03Z"}
serves_goals: ["G4", "G5", "G6"]
---

# Architecture overview

ログイン v2 — 4 入口のレート制限と列挙防止、secret と署名 Cookie、外部送信は Google と Resend だけ。`system-spec/security.md` (digest `fbb9e67c…876336`) は承認時入力、本書は不正ログイン対策・秘密の扱い・外部送信・公開情報の境界の制約を持つ。認証方式とセッションの関門そのものは `architecture/login-v2-auth.md`、旧世代の方針は `architecture/account-login-security.md`。

根拠の性質: **確定** = `qa-login-v2-security-web-003` (主たる接地根拠、user-decision) と `qa-login-v2-decision-001`〜`003`・`-005`・`-006`。**観測** = `qa-login-v2-security-web-evidence-001`・`qa-login-v2-auth-web-evidence-002`。**推定** (agent-inference、利用者未確認) = `qa-login-v2-security-web-002`・`qa-login-v2-security-web-004`。

## Context and drivers

- Business/technical context (観測、qa-login-v2-security-web-evidence-001): `packages/api/src/index.ts` の `secureHeaders` により CSP (`default-src 'self'`、`connect-src 'self'`、`form-action 'self'`、`frame-ancestors 'none'`) と `X-Frame-Options: DENY` を掛け、`packages/web/public/_headers` も同じ CSP を返す。`auth-rate-limit.ts` は IP と確定済みアカウントの軸を使い分け、ログイン失敗の応答はアカウントの有無で変わらない。`wrangler.jsonc` の必須 secret は `BETTER_AUTH_SECRET`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`RESEND_API_KEY` で、旧 `SESSION_SECRET` は runtime から撤去済み。
- Quality attribute priorities: G4・G5・G6 に資する。上流指針は OWASP ASVS + Secrets Management Cheat Sheet (security)。新しい 4 入口 (MFA・再送・再設定・連携確認) を既存のレート制限の表に scope として足し、同じロックの規則を当てる。CSP は `connect-src 'self'` を保ち、Google への遷移はページ遷移だけで行う (`system-spec/security.md`「上流指針」)。
- Constraints: 列挙防止 (C6)、外部送信は Google と Resend だけで業務データを送らない (C7)、secret はリポジトリ・ログ・応答に出さない (C2)。

## Goals and non-goals

- Goals (確定、qa-login-v2-security-web-003):
  - G5: ログイン・MFA コード・招待の再送・パスワード再設定の各入口に IP とアカウントの 2 軸のレート制限を掛け、応答の本文・ステータス・所要時間から利用者や招待の有無が分からないようにする。サインインのついでの自動連携はさせない。Google の認可は state・PKCE・nonce を検証する。
  - G5: 認証に要る秘密 (署名鍵、Google の OAuth クライアント、メール送信の API キー) は Workers の secret で持ち、リポジトリ・ログ・応答に出さない。
  - G4: 再設定・連携確認のトークンは 1 回限り・期限付きで、保存はハッシュだけ (doctrine security の反映)。
  - G6: 外部へ出るのは Google (認可と ID トークンの検証) と Resend (宛先メールアドレスと本文) だけ。稼働状態 API はエラー文や構成を返さない。プライバシーページに外部送信先と利用目的・保存期間を載せる。
- Non-goals:
  - WAF・Bot 対策サービスなど外部の防御サービスの導入
  - 外部の状況ページサービスとの連携 (U7 out)
  - `trustDevice` による 2FA の省略 (使わない)

## System context and boundaries

- Users/external systems: 未認証の訪問者 (ログイン前の画面と公開 API)、招待された本人、管理者。外部は Google と Resend だけ。
- Trust/deployment/data boundaries: 未認証で到達できる入口は、Better Auth のハンドラ・招待の承諾と再送依頼・再設定依頼・MFA の入力と設定・稼働状態 API・`/help`・`/privacy`。これらの入口がレート制限と列挙防止の対象になる。Resend へ渡すのは宛先メールアドレスと本文だけで、明細・金額を載せない。Google へはブラウザのページ遷移で往復し、スクリプトから外部へ接続しない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| レート制限 (`auth-rate-limit.ts`) | 入口ごとに IP・確定済みアカウントの軸を分離し、`invite`・`reset`・`mfa`・`status` を同一の D1 表で制限する (推定、security-web-002) | 関数 + D1 表 | packages/api | Worker |
| 稼働状態 API のレート制限 | IP 単位で 1 分に 60 回まで (推定、security-web-002) | Hono ミドルウェア | packages/api | Worker |
| 応答の一本化 | 再送依頼・再設定依頼・ログイン失敗の本文・ステータス・所要時間を揃え、送信は応答の後に回す | route 実装 | packages/api | Worker |
| secret | `BETTER_AUTH_SECRET`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`RESEND_API_KEY` (推定、security-web-004) を必須 secret にする | wrangler secret | 運用者 | Worker |
| セキュリティヘッダ | 既存の CSP (`connect-src 'self'`・`form-action 'self'`・`frame-ancestors 'none'`) を保つ | `secureHeaders` / `_headers` | packages/api / packages/web | Worker / 静的配信 |
| 監査 | 連携の追加・解除、再設定、MFA の変更を `audit_log` に残す | `audit-log.ts` | packages/api | Worker |

既存実装との差分: CSP と `X-Frame-Options` は変えずに残す。レート制限の表と規則 (15 分に 5 回・15 分ロック) は残し、`scope_kind` を足して入口を広げる。ログイン失敗の応答の一本化は残し、再送依頼・再設定依頼にも同じ規則を当てる。必須 secret は Better Auth・Google・Resend の 4 つに統一し、旧 `SESSION_SECRET` と二重管理しない。

## Cross-cutting contracts

- Identity/access: 連携は再認証と確認メールを経たときだけ (`architecture/login-v2-auth.md`)。`disableImplicitLinking=true` は、確認済みメールの Google アカウントを持つだけの者が既存アカウントへ入る経路を閉じ、連携を ASVS の再認証の要件に合わせるため (推定、security-web-004)。
- Errors/resilience: ロック中は既存と同じ応答で知らせ、他の利用者を阻害しない (O6)。再送依頼・再設定依頼は宛先の有無で応答を変えない (C6)。
- Observability/audit: 稼働状態 API は `normal` / `degraded` などの状態値だけを返し、エラー文・構成を含めない (O7)。ログに secret とトークンの平文を出さない。
- Configuration/secrets: 上表の 4 secret を wrangler secret で持ち、リポジトリ・ログ・応答に出さない。`dont_remember` Cookie は Better Auth の secret で署名する (評価の low。`architecture/login-v2-auth.md`)。
- Compatibility/versioning: CSP を広げない。Google の認可開始は API が返す認可 URL へのページ遷移で行う (`architecture/login-v2-frontend.md`)。スクリプトから Google や Resend へ接続しないので `connect-src 'self'` のままにできる。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/login-v2-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/login-v2-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/login-v2-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/login-v2-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- Protected assets/data classification: 認証情報 (パスワードハッシュ・セッション・連携・TOTP 秘密鍵と復旧コード)、各種トークン、認証の secret。これらの先にある金融明細。利用者・招待の有無そのものも守る情報とする (列挙防止)。
- Actors/adversaries/abuse cases: パスワードの総当たりとリスト型攻撃、MFA コードの総当たり、再送・再設定の大量依頼による利用者の有無の推測と送信枠 (Resend Free の日 100 通) の枯渇、自動連携による乗っ取り、D1 の漏えいからのトークン再現、稼働状態 API からの構成の推測、メールへの業務データの混入。
- Trust boundaries/data flows: ブラウザ → 未認証の入口 (レート制限・応答の一本化) → Better Auth / アプリ独自 API → D1 (ハッシュだけ)。応答の後に Resend へ送信する。Google はページ遷移。

#### Identity and authorization

- Authentication/session/federation: Google の認可は state・PKCE・nonce を検証し、`email_verified` と招待済みメールの一致を必須にする (O3)。自動連携はさせない。TOTP は管理者必須・一般任意で、`trustDevice` は使わない (security-web-004: 管理者の必須を信頼端末の 30 日で素通りさせないため)。
- Authorization model and deny-by-default rules: 管理者の MFA 関門は許可側で書き、今後増える経路も既定で拒否する (`architecture/login-v2-auth.md`)。
- Tenant/resource ownership enforcement: 単一テナント。認証の表は業務データの表と分け、業務データの表から参照しない。

#### Data and secret protection

- Encryption in transit/at rest/key ownership: HTTPS (HSTS は `_headers` の既存値)。Cookie は Secure・HttpOnly・SameSite=Lax。
- Secret source/rotation/redaction: トークンの保存はハッシュに限り、漏えいしても D1 の中身から招待や再設定を再現できないようにする (`system-spec/security.md`「適用された設計知識」、推定)。secret の設定と入れ替えの手順は `architecture/login-v2-maintenance-ops.md`。
- Retention/deletion/privacy requests: プライバシーページに外部送信先 (Google・メール送信事業者) と利用目的・保存期間を載せる (G6 / O7)。宛先メールアドレスが Resend へ渡ることを明記する (dec-login-v2-mail-delivery の注意)。

#### Application and supply-chain controls

- Input/output validation and injection defenses: 未認証の入口は既存の公開 JSON の本文上限 (`public-validation.ts` と index.ts の公開 endpoint の上限) に乗せる。応答の本文・ステータス・所要時間を揃える。
- Dependency/artifact provenance/signing/SBOM: Better Auth を固定版で入れる。メール送信は `sendMail` の 1 関数に閉じ (推定、backend-web-004)、外部送信の出口を 1 か所にする。
- CI/CD branch/review/environment protections: 既存の CI と secret スキャンに従う。

#### Detection and response

- Audit events/security telemetry/alerts: 連携の追加・解除、MFA の有効化・無効化、再設定の完了を `audit_log` に残す (O5)。ロックの発生は既存のレート制限表に残る。
- Incident response/revocation/recovery: 停止・再設定の完了で、その利用者の全セッションを削除する。secret 漏えい時は secret を入れ替え、全セッションを失効させる手順を runbook に置く。
- Vulnerability handling and SLA: 既存の運用に従う。

#### Security verification

API 統合テストで、ログイン・MFA・再送・再設定の各入口で連続失敗がロックされ、他の利用者を阻害しないこと (O6)。再送依頼と再設定依頼の応答が、宛先の有無で本文・ステータス・所要時間とも変わらないこと (C6)。未認証で稼働状態 API が 200 と状態値だけを返し、エラー文や構成を含まないこと (O7)。state / PKCE / nonce の不一致が拒否されること (O3)。D1 のどの列にもトークンと復旧コードの平文が現れないこと (O4 / O6)。CSP の `connect-src` と `form-action` が `'self'` のままであること。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-login-v2-security-web-003 | 4 入口に IP とアカウントの 2 軸のレート制限を掛け、応答から有無を推測できなくする | ログインだけに掛ける | 新しい入口が総当たりと列挙の穴にならない | 既存の表に `scope_kind` を足す |
| qa-login-v2-security-web-002 | 新入口の値は既存と同じ 15 分に 5 回・15 分ロック、稼働状態 API は IP 単位 1 分 60 回 (推定・利用者未確認) | 入口ごとに別の値 | 規則を 1 つに保てる | 値の見直しは実運用の失敗件数で行う |
| qa-login-v2-security-web-003 | 外部送信は Google と Resend だけで、業務データを送らない | メールに明細の要約を載せる | 送信先を最小にする | メール本文は定型の文とリンクだけ |
| qa-login-v2-decision-002 | メール送信は Resend (外部 API) | Cloudflare Email Service (AI 推奨) / 送信無効化 | 無料枠と fetch 1 本で足りる | 宛先が外部事業者へ渡ることをプライバシーに明記し、API キーを secret で持つ |
| qa-login-v2-security-web-004 | secret 名を 4 つにし、`disableImplicitLinking=true`、`trustDevice` 不使用 (推定) | 既定の自動連携 / 信頼端末 | 乗っ取りと MFA 素通りの経路を閉じる | 連携は `linkSocial` だけ。TOTP 設定済みの利用者は毎回コードを入れる |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と静的配信。CSP とヘッダは変えない。
- Migration sequence: secret の登録 (wrangler secret) → レート制限の `scope_kind` 拡張 → 新入口の実装と応答の一本化 → 監査 action の追加 → 稼働状態 API とプライバシーページ → 列挙防止とロックのテスト。
- Rollback trigger/procedure: 列挙防止かロックのテストが落ちたら差し戻す。配信済みなら Worker を直前版へ戻す。レート制限表への追加は既存の行に影響しない。

## Risks and verification

- Risk (medium、評価の既知課題 — plan で解決する): MFA 設定を始める入口 (セッション無し管理者へ秘密鍵・`totpURI`・復旧コードを出す `/api/auth/mfa-setup/start` 相当) が未定義で、sign-in が 401 `FAILED_TO_CREATE_SESSION` を返すときに設定トークンを返す手段も未定、トークン消費とセッション作成を同じ D1 batch に置けるかも未確認。本章の関心としては、`/api/auth/mfa-setup/*` をレート制限の入口 (O6) に加え、トークン無しの start・complete、トークンの 2 回目の使用、TOTP 検証の失敗がそれぞれ 401 かロックになるテストを置く (評価の修正案)。詳細は `architecture/login-v2-auth.md`。
- Risk (low、評価の既知課題): `dont_remember` Cookie は Better Auth の secret で署名 (`setSignedCookie`) しないと戻りの処理が読まず、保持なしが効かない。署名無しの Cookie を受け入れる実装にしない。
- Risk (low、評価の既知課題): G5 / O6 の「次回ログインで設定を求める」の文言が決定 -006 と未整合。O6 のロックと MFA のテストには招待の登録直後の経路も含める。
- Risk/assumption: 再送・再設定の応答を送信の完了まで待つと、所要時間で宛先の有無が漏れる。送信は応答の後に回す (`system-spec/security.md`「適用された設計知識」、推定)。
- Risk/assumption: Resend Free の日 100 通を再送の大量依頼で使い切られると、本物の招待と再設定が届かない。アカウント軸のロックで同じ宛先への連続依頼を止める。
- Architecture fitness test: 未認証の入口のうちレート制限の無いものが 0 件 (稼働状態 API を含む)。応答や監査の本文に secret・トークンの平文が 0 件。
- Load/failure/security validation: ロック中でも他の利用者のログインが通ること。稼働状態 API が内部エラー時にも状態値だけを返すこと。
