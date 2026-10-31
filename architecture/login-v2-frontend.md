---
graph_node_id: "arch-login-v2-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "ログイン v2 — ログイン画面の部品分割、未認証の 5 経路、薄い認証 client と招待方式の利用者管理"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "frontend"]
file_path: "architecture/login-v2-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "dcda01de03ff3fb7ee8255b773bdca9d9daf36ec13ef40bd4428df9072b76801"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "28d907a2e1b4bd5414c34f565225b0d834e67a18c3ba02aac05329664809ab3f", "imported_at": "2026-09-21T14:22:03Z"}
created_at: "2026-09-21T14:22:03Z"
updated_at: "2026-09-21T14:22:03Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-ui-ux", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-auth", "arch-login-v2-security", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops"]
resource_scope: ["packages/web/src/App.tsx", "packages/web/src/main.tsx", "packages/web/src/pages/Login.tsx", "packages/web/src/features/auth/", "packages/web/src/pages/PasswordChange.tsx", "packages/web/src/pages/Settings.tsx", "packages/web/src/components/UserAdmin.tsx", "packages/web/src/components/Input.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/UiIcon.tsx", "packages/web/src/api.ts", "packages/web/src/api-client.ts", "packages/web/src/styles.css", "packages/web/src/account-login.dom.test.tsx", "packages/web/package.json"]
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
classification_reason: "system-spec の frontend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/login-v2-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:22:03Z"}
serves_goals: ["G1", "G3", "G4", "G6"]
---

# Architecture overview

ログイン v2 — 認証 Feature の部品分割、未認証の 5 経路、薄い認証 client と招待方式の利用者管理。`system-spec/frontend.md` (digest `28d907a2…09ab3f`) は承認時入力、本書は web の画面・経路・部品・状態の持ち方の制約を持つ。見た目と文言は `architecture/login-v2-ui-ux.md`、認証方式とセッションは `architecture/login-v2-auth.md`、旧世代は `architecture/account-login-frontend.md`。

根拠の性質: **確定** = `qa-login-v2-frontend-web-003` (主たる接地根拠、user-decision) と `qa-login-v2-decision-001`・`-004`・`-005`・`-006`。**観測** = `qa-login-v2-frontend-web-evidence-001`。**推定** (agent-inference、利用者未確認) = `qa-login-v2-frontend-web-002`・`qa-login-v2-frontend-web-006` (-006 は決定 -006 の反映後で、-005 を置き換える)。

## Context and drivers

- Business/technical context (観測、qa-login-v2-frontend-web-evidence-001): web は React 18・react-router-dom 7 (`main.tsx` の `BrowserRouter`)・TanStack Query 5。`App.tsx` は `api('/auth/me')` で認証を確かめ、未認証なら `LoginPage` を枠の外に描き、`mustChangePassword` なら `PasswordChangePage` を出す。`pages/Login.tsx` (296 行) は `fetch('/api/auth/login')` を直に呼ぶ 1 ファイル。`components/UserAdmin.tsx` は `pages/Settings.tsx` の 114 行から呼ばれ、一時パスワードの発行ボタンを持つ。共通部品は Button・ConfirmDialog・UiIcon で、Input 部品は無い。色は `packages/core/src/design-tokens.ts` 由来。better-auth は `packages/web/package.json` に無い。
- Quality attribute priorities: G1・G3・G4・G6 に資する。上流指針 (Clean Architecture) の反映として、認証の呼出し (client)・状態と遷移 (container)・表示 (view-model と表示部品) を分け、表示部品が認証ライブラリを直接知らないようにする。セッションは Cookie だけに持ち、localStorage にトークンを置かない。Google ボタンはブランド指針に沿った白地 (`system-spec/frontend.md`「上流指針」)。
- Constraints: 色は design-tokens だけ (O1 の lint 0 件)、ログイン画面はアプリ枠の外 (C5)、CSP の `connect-src 'self'` を保つ (`architecture/login-v2-security.md`)。

## Goals and non-goals

- Goals (確定、qa-login-v2-frontend-web-003):
  - G1: ログイン画面を画像の構成要素ごとの部品に分けて作り直す。
  - G3 / G4 / G6: 招待承諾・パスワード再設定・MFA (設定と入力)・ヘルプ・プライバシーを未認証で到達できる画面として加える。
  - G3 / G4: 設定画面のアカウント欄に連携と MFA の管理を置く。
  - G3: 利用者管理は招待の作成・再送・取消と状態表示に作り直し、一時パスワードの発行と初回変更の画面を撤去する。
- Non-goals:
  - アプリ枠の中の業務画面の変更
  - 自己登録の画面
  - better-auth/react の React 用 hook の採用 (推定、frontend-web-002)

## System context and boundaries

- Users/external systems: 未認証の訪問者、招待された本人、管理者。API は同一オリジンの `/api/auth/*` と招待・再送・再設定・稼働状態のアプリ独自 API。Google へはページ遷移だけ。
- Trust/deployment/data boundaries: 認証の状態は Cookie とサーバの応答だけが正本で、web は応答の種類 (成功・MFA が要る・MFA 設定が要る・失敗・ロック) を画面状態に写すだけ。受付文言は応答の中身で変えない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 認証の呼出し (client) | サインイン・Google 認可開始・招待承諾・再送・再設定・MFA (設定と入力)・連携の薄い関数 | 関数 (置き場は Risks 参照) | packages/web | 静的配信 |
| `features/auth/` container | 状態と遷移を持ち、呼出しを TanStack の mutation で包む。認証ライブラリの型はここに閉じる | React | packages/web | 静的配信 |
| `features/auth/view-model.ts` | 状態から文言と表示の要否を作る純関数 | 関数 | packages/web | 静的配信 |
| 表示部品 | ロゴ・Google ボタン・区切り・フォーム・招待の案内・連携の案内・安心 3 項目・フッター | React | packages/web | 静的配信 |
| `components/Input.tsx` (新設) | ラベル・説明・エラー・表示切替を持つ共通の入力部品 | React | packages/web | 静的配信 |
| 未認証の画面 | `/invite/accept`・`/reset-password`・`/mfa`・`/help`・`/privacy` (推定、frontend-web-006) | 経路 | packages/web | 静的配信 |
| 設定のアカウント欄 | 連携の追加・解除 (再認証と確認メール経由) と MFA の管理 | React | packages/web | 静的配信 |
| 利用者管理 (`UserAdmin.tsx`) | 招待の作成・再送・取消と状態 (未承諾・承諾済み・期限切れ) の表示 | React | packages/web | 静的配信 |

既存実装との差分:

| 区分 | 対象 |
|---|---|
| 変える | `Login.tsx` を `features/auth/` の container・view-model・表示部品に分ける / `App.tsx` の認証確認を新しいセッション API に置き換え、`mustChangePassword` の分岐を撤去 / `UserAdmin.tsx` を招待方式に作り直す / 設定画面にアカウント欄を足す |
| 撤去 | `PasswordChange.tsx` (初回変更の画面) と一時パスワードの発行ボタン |
| 新設 | `components/Input.tsx`、未認証の 5 経路、認証の呼出し |
| 残す | React 18・react-router-dom 7・TanStack Query 5 の構成、ログイン画面を枠の外に描く配置、Button・ConfirmDialog・UiIcon と design-tokens、`api.ts` / `api-client.ts` の業務 API 呼出し |

## Cross-cutting contracts

- Identity/access: セッションは Cookie だけに持ち、web はトークンを保存しない。未認証の 5 経路は認証確認の前に経路で分けて描く。
- Errors/resilience: 応答を成功・MFA 入力が要る (`twoFactorRedirect`)・MFA 設定が要る (設定トークン)・失敗・ロックの 5 つに写す。失敗と受付の文言は 1 種類ずつ (`architecture/login-v2-ui-ux.md`)。
- Observability/audit: N/A: web に観測信号を足さない。
- Configuration/secrets: N/A: web は secret を持たない。Google のクライアント ID も API が返す認可 URL に含まれる形で、web のビルドに埋め込まない。
- Compatibility/versioning: 保持のチェックの説明文は画像の文言 (保持 30 日 / 非保持 12 時間) のまま変えず、『ブラウザを閉じるまで』は足さない (推定 frontend-web-006。追記は承認範囲外として取り消し済み)。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/login-v2-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/login-v2-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/login-v2-database.md`)
- Security: N/A: 本章の関心外 (`architecture/login-v2-security.md`)

### Frontend architecture

#### Rendering and application pattern

- 既存 SPA の CSR。呼出し → container → view-model と表示部品の 3 層にし、表示部品は認証ライブラリを直接知らない (上流指針 Clean Architecture の反映)。

#### Routes, screens and navigation

- 未認証の経路は `/login`・`/invite/accept`・`/reset-password`・`/mfa`・`/help`・`/privacy` (推定・利用者未確認、frontend-web-006)。
- パスワードのサインイン応答が MFA 設定トークンなら `/mfa` の設定 (QR、初回コード、復旧コードの表示) へ、`twoFactorRedirect` なら `/mfa` のコード入力へ進む。セッションは `/mfa` の完了まで無い前提で組む (決定 -006 の帰結、推定 frontend-web-006)。
- 一般利用者が招待をパスワードで承諾したら、メールアドレスを入れた状態でログイン画面へ戻す (`autoSignIn=false` の帰結、推定 frontend-web-006)。管理者は承諾から MFA 設定へ進む。
- Google は API が返す認可 URL へ `window.location` で移り、戻りは既存のアプリの入口で受ける (推定、frontend-web-002)。

#### Component and design-system boundaries

- 共通の Input 部品を新設し、ログイン・招待承諾・再設定・MFA・設定のアカウント欄で使い回す。
- 色は design-tokens だけ。Google ボタンはブランド指針の白地で、画面固有の CSS は `styles.css` の login 節 (2506 行目以降) を作り替える。

#### State and data flow

- サーバ状態は TanStack Query、フォームの入力と画面状態は container の局所状態に置く。localStorage に認証の情報を置かない。
- 保持のチェックは、パスワードでは `rememberMe` として、Google では認可開始 API への保持の指定として渡す (推定・利用者未確認、frontend-web-006。サーバ側の受け取りは `architecture/login-v2-auth.md`)。

#### Backend integration

- 認証の呼出しの作り方は正本の中で 2 つの推定が並ぶ。frontend-web-002 は better-auth/react を使わず `lib/auth-client.ts` の薄い関数を TanStack の mutation で包む形、より新しい frontend-web-006 は `createAuthClient` を使いその型を container に閉じる形。どちらも「表示部品が認証ライブラリを知らない」点は同じで、本書は新しい -006 を優先しつつ、置き場 (`packages/web/src/lib/` は現存しないため新設になる) は plan で決める (agent-inference)。
- 業務 API は既存の `api.ts` / `api-client.ts` のまま。稼働表示は稼働状態 API の状態値を読む。

#### Performance and observability

- ログイン画面は業務 API を呼ばない。認証の依存を足すときは既存のバンドル予算 (js-budget) の範囲に収める。
- 観測信号は追加しない。

#### Frontend verification

DOM テスト (`account-login.dom.test.tsx` を作り替え) で、画像の全構成要素と 6 状態 (送信中・認証失敗・ロック中・MFA コード入力・再送受付・再設定受付) が描画され、未認証の 5 経路が認証無しで開けることを確かめる (O1)。サインイン応答の 5 種が正しい画面へ写ること、一般利用者の招待承諾がメールアドレス入りのログイン画面へ戻ること、一時パスワードと初回変更の画面が 0 件であること、直書き色の lint が 0 件であることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-login-v2-frontend-web-003 | ログイン画面を部品に分けて作り直し、未認証の画面を加え、利用者管理を招待方式にする | 現行の 1 ファイルに足す | 画像の要素数と状態数に 1 ファイルでは追従できない | `features/auth/` を新設し `PasswordChange.tsx` を撤去 |
| qa-login-v2-decision-004 | 一時パスワードと初回変更の画面を撤去する | 併存 | 画像の『管理者が仮パスワードを設定しない』を事実にする | `App.tsx` の `mustChangePassword` 分岐が消える |
| qa-login-v2-decision-006 | MFA 設定トークンの応答で `/mfa` の設定へ進み、セッションは完了まで無い前提で組む | 仮セッションを発行して設定画面へ | 管理者の MFA を最初のセッションより前に強制する | 設定開始の入口が未定義 (Risks) |
| qa-login-v2-frontend-web-002 / -006 | 認証の呼出しを薄くし、ライブラリの型を container に閉じる (推定・利用者未確認) | 表示部品で hook を直に使う | ライブラリの交換と試験が容易 | 置き場と `createAuthClient` 採否は plan で決める |
| qa-login-v2-frontend-web-006 | 保持のチェックを Google にも効かせ、説明文は画像のまま (推定・利用者未確認) | Google は常に保持 | 手段で保持の意味が変わらない | Google ボタンより下のチェックが Google にも効く (Risks) |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web の静的配信。
- Migration sequence: Input 部品 → 認証の呼出しと container・view-model → ログイン画面の表示部品と 6 状態 → 未認証の 5 経路 → `App.tsx` の認証確認の置き換えと `PasswordChange.tsx` の撤去 → 利用者管理とアカウント欄 → DOM テスト。API 側の認証基盤の切替と同じ配信にそろえる (`architecture/login-v2-maintenance-ops.md`)。
- Rollback trigger/procedure: DOM テストか配信後の確認でログインが通らなければ、web と api を直前版へ同時に戻す。

## Risks and verification

- Risk (medium、評価の既知課題 — plan で解決する): MFA 設定を始める入口 (セッション無し管理者へ秘密鍵・`totpURI`・復旧コードを出す `/api/auth/mfa-setup/start` 相当) が未定義で、`/mfa` の設定画面の QR と復旧コードの出どころが無い。sign-in が 401 `FAILED_TO_CREATE_SESSION` を返すときに設定トークンをどう web へ返すか (応答本文か、別 API か) も未定で、web の応答の写し方がこれに依存する。トークン消費とセッション作成を同じ D1 batch にできるかも未確認 (`architecture/login-v2-auth.md`)。
- Risk (low、評価の既知課題): 保持のチェックは Google ボタンより下にあるのに Google にも効く。この結びつきは frontend-web-006 (推定) だけが決めており、利用者は未確認。
- Risk (low、評価の既知課題): `dont_remember` Cookie は Better Auth の secret で署名 (`setSignedCookie`) する必要があり、web で Cookie を書かない。G5 / O6 の「次回ログインで設定を求める」の文言は決定 -006 と未整合で、web は決定 -006 (最初のセッションより前に設定) に従う。
- Risk/assumption: frontend-web-002 と -006 の client の扱いの食い違い。-006 を優先し、plan で 1 つに決める。
- Architecture fitness test: 表示部品から認証ライブラリの import が 0 件。localStorage への認証情報の書込が 0 件。直書き色が 0 件。
- Load/failure/security validation: 認証の依存を足した後もバンドル予算を超えないこと。
