---
graph_node_id: "spec-account-login"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "メールアドレス + パスワードによるアカウントログイン仕様"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "auth", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: []
related_nodes: ["arch-account-login-auth", "arch-account-login-security", "arch-account-login-database", "arch-account-login-backend", "arch-account-login-frontend", "arch-account-login-ui-ux", "arch-account-login-infrastructure", "arch-account-login-maintenance-ops"]
architecture_refs: ["arch-account-login-auth", "arch-account-login-security", "arch-account-login-database", "arch-account-login-backend", "arch-account-login-frontend", "arch-account-login-ui-ux", "arch-account-login-infrastructure", "arch-account-login-maintenance-ops"]
resource_scope: ["packages/api/src", "packages/web/src", "migrations"]
purpose: "共有パスワードによる単一認証を廃し、利用者ごとのアカウントで本人を特定できる認証基盤へ移す。"
goal: "メールアドレスとパスワードでログインでき、セッションが誰のものか特定でき、漏洩時に利用者単位で失効できる状態にする。"
scope_in: ["users テーブルの新設とパスワードの鍵導出保存", "利用者識別子を含むセッション Cookie", "ログイン状態の保持 (2段階の有効期限)", "管理者による招待・停止・一時パスワード発行", "migration適用後のbootstrap seedによる初回管理者作成と共有パスワード認証経路の撤去", "参照UI (01-login.png) に基づくログイン画面の全面改修"]
scope_out: ["自己サインアップ", "メール送信基盤の導入と自動パスワードリセット", "外部 IdP / SSO の UI 露出", "細粒度の権限ロール設計 (画面別・操作別の権限行列)", "業務データへの行単位所有者列の追加", "web 以外の platform への配布"]
acceptance: ["平文パスワードを保持するカラムが0件である", "利用者識別子を改ざんした Cookie が /api/* で401になる", "保持ON/OFFで Set-Cookie の maxAge が2段階に切り替わる", "未登録メールと誤パスワードで応答本文・ステータス・所要時間が区別できない", "ログイン画面の DOM に header/footer/nav/aside が0件である", "active runtimeと必須設定に共有パスワード認証分岐が0件である"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/spec-account-login.md"
template_id: "specification"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "49745f7499f967ab22c628c0b9c74169fb14f2b3c24128cd68150c668ef16075"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "c41ea2f8ec942cb1771d82edaad7fc8c0a134b065b666cfac9778091aefdc6a2", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "上位概念 U1-U9 の正本であり、機能横断の規範を定める単一仕様書のため specification として specs/ へ置く。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-account-login.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G1, G2, G3, G4, G5]
---

# メールアドレス + パスワードによるアカウントログイン仕様

内容の正本は `system-spec/` (system-spec-harness 0.1.14 が生成した確定章) であり、本書はそれを dev-graph へ取り込むための規範の索引である。各節は正本の該当章を指し、本文を複製しない。

## 目的と成功状態

現行は `AUTH_PASSWORD` による共有パスワードで、`authGuard` が `userId` を `'default'` に固定している。誰が操作したかをシステムが特定できず、資格情報の失効も一括でしか行えない。本サイクルの成功状態は、利用者がメールアドレスとパスワードで本人として認証でき、セッションが誰のものか特定でき、漏洩時に利用者単位で失効できることである。正本: `system-spec/00-requirements-definition.md` (U1-U3)。

## スコープ

frontmatter の `scope_in` / `scope_out` を規範とする。特に、メール送信基盤を導入しないためパスワード再発行は自動化せず管理者運用とすること、業務データへ行単位の所有者列を追加しないことの2点が、本サイクルの境界を決めている。正本: `system-spec/00-requirements-definition.md` (U7)。

## 用語と主体

- **利用者 (user)**: 認証と監査の主体。`admin` と `member` の2 role のみを持つ。
- **セッション世代 (session_generation)**: 利用者ごとの整数。Cookie の署名 payload に含め、不一致を無効とする一括失効の機構。
- **一時パスワード**: 管理者が発行する使い捨ての資格情報。72 時間有効で、最初のログイン成功で原子的に消費し、そのセッションでパスワード変更を強制する。

## ユースケースとユーザーフロー

ログイン / ログアウト / パスワード変更 (強制含む) / 管理者による招待・停止・role 変更・一時パスワード再発行。自己サインアップは存在しない。正本: `system-spec/backend.md`、`system-spec/ui-ux.md`。

## 機能要件

U9 の I1-I15 を機能要件の正本とする (`system-spec/00-requirements-definition.md`)。各技術章がそれを `serves_goals` で受け、章内の確定内容として具体化している。

## 非機能要件

- パスワードは PBKDF2-HMAC-SHA256 (反復 210,000 以上、16 byte 以上の salt) で保存し、平文・可逆暗号を禁じる。
- 認証失敗の応答は、アカウント存否で本文・ステータス・所要時間を区別しない。
- ログイン rate limit はメールアドレス単位 + 送信元単位で課す。

正本: `system-spec/auth.md`、`system-spec/security.md`。

## UI・状態遷移

参照画像 `design/FINAL-UI/images/01-login.png` を正とし、中央にログインカードを1枚だけ置く単一カラム構成。安心3項目はカードの中に収める。ヘッダー・フッター・サイドバーは描画せず、脇の情報パネル・ブランド見出し・『月次の流れ』の説明といった「枠に見える要素」も置かない。Cloudflare Access の導線は UI から除去する (サーバ側実装は残す)。狭幅でも同じ単一カラムのまま横スクロールを生じさせない。正本: `system-spec/ui-ux.md`。
安心3項目の意味は、全通信の暗号化と業界標準に基づく保護、ログイン情報を認証と保護の用途に限ること、通常は外部送信せずAI分析時だけ明細を含まない集計データを24時間の使い捨て経路で渡すことに固定する。

## ビジネスルールと検証

- 最後の有効な admin を停止・降格する操作はサーバ側で原子的に拒否する。
- パスワードは最低 12 文字。現行と同一値への変更を拒否し、過去世代の履歴は保存しない。
- 同時セッション数に上限を設けない。封じ込めは `session_generation` の一括失効で行う。

正本: `system-spec/security.md`。

## API契約

`POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/me` / `POST /api/auth/password`、および admin 限定の `GET|POST /api/admin/users` / `PATCH /api/admin/users/:id` / `POST /api/admin/users/:id/password-reset`。利用者の退出運用は監査主体を保持できる停止・再開へ一本化し、物理DELETEは提供しない。入力検証は zod、エラー形状は現行の `{ error: { code, message } }` を踏襲する。未捕捉500だけは任意の `requestId` を加え、全応答の同名headerと運用ログを結ぶ。正本: `system-spec/backend.md`。

## データモデル

`users` の新設、`password_login_rate_limits` の送信元・account独立キーへの拡張、`audit_log.actor_user_id` の追加 (既存行は NULL 許容)。現在の一時資格情報は `users.password_hash` と `temporary_password_expires_at` の同じ行を唯一の正本とし、重複する履歴表を持たない。パスワードハッシュは D1 にのみ置き R2/KV へ複製しない。正本: `system-spec/database.md`。

## 認証・認可

セッションは HttpOnly + Secure + SameSite=Strict の Cookie に「利用者 ID . 有効期限 . 世代」を載せ HMAC-SHA256 で署名する。有効期限は保持しない=12 時間 / 保持する=30 日。`authGuard` は共有業務tenantを `userId='default'`、実利用者を `actor` として別contextへ設定する。権限判定の正本はサーバ側の 403 であり、UI での非表示は補助に過ぎない。正本: `system-spec/auth.md`、`system-spec/security.md`。

## エラー・例外・回復

認証失敗は「メールアドレスまたはパスワードが正しくありません。」の単一文言を入力直下に `role=alert` で提示する。公開認証endpointのJSON bodyは16KiBで打ち切り、過大時はDB処理前に413を返す。壊れたJSON・型不正・schema上限超過は共通の`{ error: { code, message } }` 400に畳む。認証セッション失効の401はログイン画面へ戻し、パスワード変更時の現在パスワード相違はフォーム内で回復させる。全 admin がログイン不能になった場合の最終手段はrunbookのbreak-glass resetを使う。正本: `system-spec/ui-ux.md`、`system-spec/maintenance-ops.md`。

## イベント・非同期処理

新規の非同期処理は導入しない。既存 cron (`0 18 * * *`) に相乗りして、期限切れの一時パスワードとレート制限行を掃除する。正本: `system-spec/infrastructure.md`。

## 可観測性

`audit_log` へ認証・管理操作を記録する。未認証のログイン失敗は`actor_user_id=NULL`、登録済み対象は`scope=account:<id>`としてactorとtargetを分離する。記録に平文パスワード・一時パスワード・セッション署名を含めない。ログイン失敗率とロックアウト件数を audit_log から確認できる状態にする。正本: `system-spec/security.md`、`system-spec/maintenance-ops.md`。

## 互換性・移行・リリース

0039はusersを追加するだけでなく、rate limit変更とaudit_log再構築を含む前方migrationである。適用後にbootstrap seedで初期adminを1件作成し、新Workerのログインと管理画面を確認してから`AUTH_PASSWORD`を削除する。切替時にSESSION_SECRETをローテーションする。障害時はreverse migrationや旧Worker単体rollbackを行わず、適用前復元点+互換アプリまたはforward-fixとする。正本: `system-spec/database.md`、`system-spec/auth.md`、`system-spec/maintenance-ops.md`。

## テストと受入条件

frontmatter の `acceptance` を判定点とする。各章の「受入条件 (Delta の判定点)」表が、目標 O1-O8 ごとの観測点を規範として持つ。

## 未決事項

- 将来「誰の明細か」を分ける必要が生じた時点で、所有者モデルは別サイクルとして設計する。
