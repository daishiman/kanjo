---
graph_node_id: "arch-login-v2-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "ログイン v2 — 画像どおりの単一カラムと 6 状態、同じカード型の招待承諾・再設定・MFA・連携画面"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "ui-ux"]
file_path: "architecture/login-v2-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "e545b6aa295a014f262afcf43c74efac12673144bbea00fa80c33d9d17ed56e5"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "a37523cc7be348e2f6da5cda7ed9ba854b5998c0c32b24e61a0a6c2360703d04", "imported_at": "2026-09-21T14:22:03Z"}
created_at: "2026-09-21T14:22:03Z"
updated_at: "2026-09-21T14:22:03Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-frontend", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-auth", "arch-login-v2-security", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Login.tsx", "packages/web/src/features/auth/", "packages/web/src/styles.css", "packages/web/src/components/Button.tsx", "packages/web/src/components/UiIcon.tsx", "packages/web/src/components/UserAdmin.tsx", "packages/web/src/pages/Settings.tsx", "packages/core/src/design-tokens.ts", "docs/design-system.md", "docs/ui-decisions.md", "design/FINAL-UI/images/01-login-v2.png"]
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
classification_reason: "system-spec の ui-ux 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/login-v2-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:22:03Z"}
serves_goals: ["G1", "G3", "G4", "G5", "G6"]
---

# Architecture overview

ログイン v2 — 画像どおりの単一カラムと 6 状態、同じ認証 Feature 内のカード型招待承諾・再設定・MFA・連携画面。`system-spec/ui-ux.md` (digest `a37523cc…03d04`) は承認時入力、本書は画面構成・操作の流れ・表示の約束の制約を持つ。目標の見た目の正本は `design/FINAL-UI/images/01-login-v2.png`、旧世代の画面構成は `architecture/account-login-ui-ux.md`。

根拠の性質: **確定** = `qa-login-v2-ui-ux-web-001` (主たる接地根拠、user-decision。画像・承認 appr-foundation-login-v2-001・決定 -001〜-004 からの書き起こし) と `qa-login-v2-decision-001`・`-003`・`-004`。**観測** = `qa-login-v2-ui-ux-web-evidence-001`。**推定** (agent-inference、利用者未確認) = `qa-login-v2-ui-ux-web-002`。

## Context and drivers

- Business/technical context (観測、qa-login-v2-ui-ux-web-evidence-001): `packages/web/src/pages/Login.tsx` (296 行) はロゴの無い 1 枚のカードに、メールアドレス・パスワード・保持のチェック・ログインボタンを置くだけで、Google ボタン・区切り・再設定リンク・招待の案内・連携の案内・安心 3 項目・フッターは無い。`styles.css` の 2506 行目以降に `.login-wrap` / `.login-page` / `.login-main` / `.login-card` がある。`App.tsx` は未認証なら Login を枠 (サイドバー・ヘッダー) の外に描く。『パスワードをお忘れの方』は現状、管理者への連絡を案内するモーダルだけ (U2)。
- Quality attribute priorities: G1・G3・G4・G5・G6 に資する。初見の人 (SH3) がログイン前に『何が守られるか』『いま動いているか』『困ったらどこを見るか』を確かめられること。上流指針 (presentation) の反映として、パスワードの表示切替・保持のチェック・稼働表示を色だけで伝えず文言を併記し (WCAG 2.2 SC 1.4.1)、ロック中と MFA 入力は aria-live で読み上げ、送信中はボタンを無効にして二重送信を防ぐ (`system-spec/ui-ux.md`「上流指針」)。
- Constraints: 色は design-tokens 由来だけ、共通部品 (Button・ConfirmDialog・UiIcon) を使う。ログイン画面はアプリ枠の外 (C5)。失敗と受付の文言から利用者や招待の有無が分からないこと (C6)。

## Goals and non-goals

- Goals:
  - G1 (確定、qa-login-v2-ui-ux-web-001): `/login` を画像どおりの単一カラムにする。上から、ロゴ (棒グラフのマークと Focus Ledger)、見出し『ログイン』と説明『登録済みの認証方法でログインしてください。』、『Google でログイン』と注記、『または』、『メールアドレスとパスワードでログイン』のメールアドレス・パスワード (表示切替)・保持のチェック (保持 30 日 / 非保持 12 時間の説明)・『ログイン』・『パスワードをお忘れの方』、『招待を受けた方』の案内と『招待メールを再送』と『アカウントはテナント管理者からの招待で作成されます。』、連携の案内 (連携時は再認証とメール確認が必要)、『安心してご利用いただくために』の 3 項目 (セキュリティ・プライバシー・お客様のデータ)、フッターの『サービス状況』(稼働表示)・『ヘルプ』・『プライバシー』。
  - G1 (確定): 状態は送信中・認証失敗・ロック中・MFA コード入力・再送受付・再設定受付の 6 つ。
  - G1 (確定): task 頻度が最も高い『既存の手段でログインする』を最上段に置き、失敗コストが高い再送・再設定・連携は下段の説明付きの入口にする。
  - G3 / G4 / G5 (確定): 招待承諾・再設定・MFA 設定・連携の画面も同じカードの型で作る。設定画面の利用者管理は招待の作成・再送・取消と状態 (未承諾・承諾済み・期限切れ) の表示に作り直す。
  - G6 (確定): フッターの『サービス状況』は稼働状態 API の値を文言で出し、『ヘルプ』『プライバシー』は未認証で開ける。
- Non-goals:
  - 自己登録 (サインアップ) の入口 (U7 out)
  - Google 以外のソーシャルログイン・パスキー・SMS の入口
  - 一時パスワードの発行と初回変更の強制の画面 (撤去する)
  - アプリ枠の中へのログイン画面の配置

## System context and boundaries

- Users/external systems: 月次を締めたい運営者兼管理者 (SH1)、招待される共同利用者 (SH2)、初見でログイン画面を開く人 (SH3)。Google へはボタンからページ遷移する。
- Trust/deployment/data boundaries: 画面は受付と失敗の文言を 1 種類ずつしか持たず、サーバの応答から利用者や招待の有無を読み分けない。稼働表示は API の状態値だけを表示する。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| ロゴ | 棒グラフのマークと Focus Ledger をカード上に置く (現行は認証後のサイドバーにしか無い) | 表示部品 | packages/web | 静的配信 |
| 見出しと説明 | 『ログイン』と『登録済みの認証方法でログインしてください。』 | 表示部品 | packages/web | 静的配信 |
| Google ボタンと注記 | 『Google でログイン』と招待先と同じメールアドレスの注記。Google のブランド指針に沿った白地 | `Button` | packages/web | 静的配信 |
| 区切り | 『または』 | 表示部品 | packages/web | 静的配信 |
| メールとパスワードのフォーム | 見出し・メールアドレス・パスワード (表示切替、文言併記)・保持のチェックと 30 日 / 12 時間の説明・『ログイン』・『パスワードをお忘れの方』 | 新設 Input + `Button` | packages/web | 静的配信 |
| 招待の案内 | 『招待を受けた方』の説明 (管理者が仮パスワードを設定しないこと)・『招待メールを再送』・作成は招待による旨 | `Button` + `UiIcon` | packages/web | 静的配信 |
| 連携の案内 | 同じメールの Google とパスワードを 1 アカウントに連携でき、再認証とメール確認が要る旨 | 表示部品 | packages/web | 静的配信 |
| 安心 3 項目 | セキュリティ (全通信の暗号化・MFA と不正ログイン対策)・プライバシー (認証と保護の用途に限る)・お客様のデータ (認証情報とテナント内データの分離) | 表示部品 + `UiIcon` | packages/web | 静的配信 |
| フッター | 『サービス状況』(稼働表示)・『ヘルプ』・『プライバシー』 | 表示部品 | packages/web | 静的配信 |
| 同じカード型の画面 | 招待承諾・パスワード再設定・MFA (設定と入力)・連携 | 表示部品 | packages/web | 静的配信 |

既存実装との差分: 現行のカード・メール欄・パスワード欄・保持のチェック・ログインボタンと、アプリ枠の外に描く配置は残す。保持のチェックの説明文は画像の文言 (保持 30 日 / 非保持 12 時間) のままにする (ブラウザを閉じるまでの追記は承認範囲外として取り消し済み、`architecture/login-v2-frontend.md`)。それ以外の構成要素 (ロゴ・Google・区切り・再設定・招待・連携・安心 3 項目・フッター) と 6 状態を加える。管理者連絡のモーダルは再設定依頼の入口に置き換える。設定画面の一時パスワード発行ボタン (`UserAdmin.tsx`) と初回変更の画面は撤去する。

## Cross-cutting contracts

- Identity/access: 未認証で描く。ログイン成功後は既存どおりアプリ枠へ入る。
- Errors/resilience: 認証失敗は 1 種類の文言で、利用者の有無・停止・誤パスワードを区別しない。ロック中は再試行まで待つ旨を出す。再送受付・再設定受付は同じ文言を 1 種類だけ持ち、宛先の有無で変えない (推定、ui-ux-web-002)。
- Observability/audit: N/A: 画面に観測信号を足さない。操作の記録はサーバの監査 (`architecture/login-v2-auth.md`)。
- Configuration/secrets: N/A: 画面に設定・秘密情報を持たない。
- Compatibility/versioning: 用語は既存の画面と揃える。ブランド名 Focus Ledger はサイドバーと同じ表記。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/login-v2-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/login-v2-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/login-v2-database.md`)
- Security: N/A: 本章の関心外 (`architecture/login-v2-security.md`)

### Frontend architecture

#### Rendering and application pattern

- 既存 SPA の未認証の画面群。ログイン画面は 1 枚のカードの単一カラムで、状態に応じてカード内の表示だけを切り替える。部品の分け方は `architecture/login-v2-frontend.md`。

#### Routes, screens and navigation

- `/login` を入口に、招待承諾・再設定・MFA (設定と入力)・ヘルプ・プライバシーを未認証で開ける画面として持つ。経路名は `architecture/login-v2-frontend.md`。
- 上から『既存の手段でログインする』→ 再設定 → 招待 → 連携 → 安心 3 項目 → フッターの順。失敗コストの高い入口ほど下段に説明付きで置く (確定、ui-ux-web-001)。
- パスワードでのログインで MFA が要るときは MFA コード入力の状態へ進み、TOTP 未設定の管理者は MFA 設定の画面へ進む (決定 -005 / -006 の画面側の帰結。遷移の手段は `architecture/login-v2-frontend.md`)。

#### Component and design-system boundaries

- 色・余白は design-tokens と共通部品だけで組み、直書き色を持たない (O1 の lint 0 件)。Google ボタンだけはブランド指針の白地 (frontend 章の上流指針)。
- パスワードの表示切替・保持のチェック・稼働表示は文言を併記し、色だけで伝えない。
- 狭い画面 (幅 480px 未満) ではカードの左右余白を 16px にし、安心 3 項目は縦積みにする (推定・利用者未確認、ui-ux-web-002)。

#### State and data flow

- 6 状態: 送信中 (ボタンを無効化)・認証失敗・ロック中 (aria-live)・MFA コード入力 (aria-live)・再送受付・再設定受付。
- MFA コード欄は 6 桁の数字入力 (`inputmode=numeric`、`autocomplete=one-time-code`) とし、復旧コードの入力へ切り替えるリンクを下に置く (推定・利用者未確認、ui-ux-web-002)。
- MFA 設定の画面は QR と初回コードの入力、復旧コードの表示を持つ。そのデータの出どころ (設定を始める API) は未定義 (Risks 参照)。

#### Backend integration

- 稼働表示は稼働状態 API の状態値 (`normal` / `degraded` など) を『正常』などの文言に変えて出す。エラー文を画面に出さない (O7)。
- 保持のチェックはパスワードと Google の両方に効く (手段は `architecture/login-v2-frontend.md`)。

#### Performance and observability

- ログイン画面は業務 API を呼ばない (未認証で業務 API を叩く経路を作らない現行の方針を保つ)。
- 観測信号は追加しない。

#### Frontend verification

DOM テストで、画像の全構成要素 (ロゴ・見出しと説明・Google ボタンと注記・区切り・メールとパスワード欄と表示切替・保持のチェックと 30 日 / 12 時間の説明・ログインボタン・再設定リンク・招待の案内と再送ボタン・連携の案内・安心 3 項目・フッター 3 リンクと稼働表示) が描画され、6 状態のテストが緑であることを確かめる (O1)。再送受付と再設定受付の文言が 1 種類であること、直書き色の lint が 0 件であることを確かめる。`design/FINAL-UI/images/01-login-v2.png` と画面を目視で突き合わせる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-login-v2-ui-ux-web-001 | 画像どおりの単一カラムで、頻度の高いログインを最上段、再送・再設定・連携を下段の説明付きの入口にする | 2 カラムで案内と入力を分ける / 再送や連携を別画面だけにする | 迷わずログインでき、失敗コストの高い操作は説明を読んでから始まる | カードが縦に長くなる |
| qa-login-v2-ui-ux-web-001 | 失敗と受付の文言から利用者や招待の有無が分からないようにする | 状況ごとに詳しい文言を出す | 列挙防止 (C6) と画面が一致する | 利用者は届かない理由を画面で知れず、ヘルプで補う |
| qa-login-v2-decision-004 | 『管理者が仮パスワードを設定することはありません』を事実にし、一時パスワードの画面を撤去する | 一時パスワードと併存 | 画像の文言と一致する | 設定画面の利用者管理を招待方式に作り直す |
| qa-login-v2-decision-003 | 『MFA と不正ログイン対策で保護』を事実にするため MFA の入力・設定の画面を持つ | MFA を作らず文言を変える | 画像の説明を事実にする | MFA 設定の画面が要る |
| qa-login-v2-ui-ux-web-002 | 480px 未満の余白 16px と縦積み、6 桁の MFA 欄と復旧コードへの切替、受付文言 1 種類 (推定・利用者未確認) | 値を決めずに実装に任せる | 実装の決定論を保つ | 利用者の確認が無い値として扱う |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web の静的配信。
- Migration sequence: カードとロゴ・見出し → Google ボタンと区切り → フォームと 6 状態 → 招待・連携の案内と安心 3 項目 → フッターと稼働表示・ヘルプ・プライバシー → 招待承諾・再設定・MFA・連携の画面 → 設定画面の利用者管理の作り直し → `docs/ui-decisions.md` の更新。
- Rollback trigger/procedure: DOM テストか目視で不具合が出たら web を直前版へ戻す。認証基盤の切替と同時に戻す必要があるときは `architecture/login-v2-maintenance-ops.md` の戻し手順に従う。

## Risks and verification

- Risk (medium、評価の既知課題 — plan で解決する): MFA 設定の画面 (QR と復旧コードの表示) は、セッションの無い管理者へ秘密鍵・`totpURI`・復旧コードを出す入口 (`/api/auth/mfa-setup/start` 相当) を前提にするが、その入口が未定義。sign-in が 401 `FAILED_TO_CREATE_SESSION` のときに設定トークンを画面へ返す手段と、トークン消費とセッション作成の D1 batch 可否も未確認。画面はこの入口が決まるまで設定画面のデータを持てない (`architecture/login-v2-auth.md`)。
- Risk (low、評価の既知課題): 保持のチェックは画像ではメールとパスワードの欄の下にあるが、その上の Google ボタンにも効く。先に Google を押した利用者はチェックを見ないまま保持なし (12 時間) になる。この結びつきは frontend の推定 (frontend-web-006) だけが決めており、利用者は見ていない。画面での示し方は必要なら 1 問確かめる。
- Risk (low、評価の既知課題): G5 / O6 の「次回ログインで設定を求める」の文言が決定 -006 と未整合。画面は決定 -006 に従い、招待の登録直後の管理者も MFA 設定の画面へ進める。
- Risk/assumption: ロゴがカード上に加わり縦に長くなるため、狭い画面でログインボタンが初期表示から外れる。480px 未満の値で DOM テストを固定する。
- Architecture fitness test: 一時パスワードと初回変更の画面が 0 件。直書き色が 0 件。受付文言が 1 種類。
- Load/failure/security validation: 稼働状態 API が失敗しても画面が描画され、内部の詳細を出さないこと。
