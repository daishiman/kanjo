---
graph_node_id: "feat-account-login"
artifact_kind: "feature"
artifact_subtypes: []
title: "アカウントログイン (メールアドレス + パスワード)"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "auth", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:14:38Z"
updated_at: "2026-09-13T05:14:38Z"
depends_on: []
related_nodes: ["spec-account-login"]
resource_scope: ["packages/api/src", "packages/web/src", "migrations", "wrangler.toml"]
purpose: "金融明細を扱う権限を共有された1つの秘密から個人に帰属するアカウントへ移し、失効・追跡・権限限定を利用者単位で効かせられるようにする。"
goal: "利用者がメールアドレスとパスワードで本人として認証でき、管理者が設定画面から招待・停止・パスワード再発行を完結でき、既存20画面と /api/* 認証ガードの契約が壊れていない状態。"
scope_in:
  - "利用者 (user) ドメインの新設 (email / password_hash / role / status / session_generation / must_change_password)"
  - "メールアドレス + パスワードによるログインと、利用者単位で失効できるセッション"
  - "『次回からもログイン状態を保持する』(既定 ON / ON=30日・OFF=12時間)"
  - "管理者による招待・停止・一時パスワード再発行 (設定画面)"
  - "パスワードをお忘れの方の導線 (管理者へ連絡する案内ダイアログ)"
  - "参照画像 01-login.png を正とするログイン画面 (単一カラムのカード1枚・安心3項目はカード内・アイコン+ラベル併記)"
  - "audit_log による認証操作の追跡と、ログイン失敗率・ロックアウトの監視"
  - "AUTH_PASSWORD の廃止と SESSION_SECRET ローテーションを含む切替手順"
scope_out:
  - "Cloudflare Access 経由のログイン導線"
  - "自己サインアップ (利用者自身による新規登録)"
  - "メール送信基盤による自動パスワードリセット"
  - "ログイン画面のヘッダー・フッター・サイドバーの描画と、脇の情報パネル・ブランド見出し・『月次の流れ』の説明"
  - "業務データへの所有者列の追加 (監査は audit_log.actor_user_id のみ)"
  - "外部 IdP / SSO / MFA"
acceptance:
  - "未認証で保護画面へアクセスするとログイン画面へ遷移し、正しいメールアドレスとパスワードで認証が成功する"
  - "パスワードが復元不能な形 (PBKDF2-HMAC-SHA256 / 100,000 回) で保存され、平文がどこにも残らない"
  - "管理者が設定画面から利用者の追加・停止・一時パスワード再発行を完結でき、一時パスワードは発行直後の1度だけ表示される"
  - "保持 ON で30日・OFF で12時間のセッション期限となり、既定の帰結がチェックボックス脇に明示されている"
  - "ログイン画面の DOM に header/footer/nav/aside が0件でログインカードが1枚だけ置かれ、アイコンが常にテキストラベルと併記されている"
  - "member が /api/admin/* の全エンドポイントに対して 403 を受け取る"
  - "既存20画面の呼出しが 401/503 応答契約の変更なしに動作する"
  - "active runtimeと必須設定に共有パスワード認証分岐が0件である"
architecture_refs:
  - "arch-account-login-auth"
  - "arch-account-login-security"
  - "arch-account-login-database"
  - "arch-account-login-backend"
  - "arch-account-login-frontend"
  - "arch-account-login-ui-ux"
  - "arch-account-login-infrastructure"
  - "arch-account-login-maintenance-ops"
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-account-login.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "dev-graph-decompose-macro-audit", "evidence_ref": "eval-log/feat-account-login-macro-audit.json", "evaluated_digest": "d364131e74ca40ae8e85a7a48f8c86c306abec82c21175ae9510e87a2a7a8e01"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-account-login.md", "source_version": "0.1.11", "source_digest": "d2a80ba53dfa77f333d59baba10e51de83f3d3733824327a6fbebf182043a4bb", "imported_at": "2026-09-13T05:14:38Z"}
classification_confidence: 1.0
classification_reason: "purpose/goal/scope/acceptance を持つ機能単位であり、8つの architecture node を束ねるマクロ層ノードとして feature に分類する。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-account-login.md"}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5", "linked_at": "2026-09-13T07:49:39Z", "sync_state": "synced"}
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:14:38Z"}
---

# 目的

共有された1つのパスワードで全ての金融明細へ到達できる現状は、漏洩時に全データが即座に露出し、誰の操作かも追えない。権限の主体を個人へ移し、停止・追跡・限定を利用者単位で効かせられるようにする。ログイン画面の刷新は、その主体変更を利用者が最初に触れる場所として「安心して預けられる」と伝わる形に整えるためであり、見た目の改善そのものが目的ではない。

## 到達状態

利用者がメールアドレスとパスワードで本人として認証でき、セッションが誰のものかシステム側で特定できる。パスワードは復元不能な形で保存され、セッションは利用者単位で失効できる。管理者は設定画面から利用者の追加・停止・パスワード再発行を完結でき、共有パスワードの配り直しが不要になる。ログイン画面は扱うデータの性質と保護方針を明示し、初見でも何をする場所か・何が守られるかが分かる。これらが既存20画面と `/api/*` 認証ガードの契約を壊さずに達成されている。

## スコープ

- スコープ内: 利用者ドメインの新設 / メールアドレス+パスワード認証 / ログイン状態の保持 (既定 ON・ON=30日・OFF=12時間) / 管理者による招待・停止・一時パスワード再発行 / パスワード失念時の管理者連絡導線 / 参照画像 `design/FINAL-UI/images/01-login.png` を正とするログイン画面 / audit_log による追跡と監視 / AUTH_PASSWORD 廃止と SESSION_SECRET ローテーションを含む切替
- スコープ外: Cloudflare Access 導線 / 自己サインアップ / メール送信による自動リセット / ログイン画面のヘッダー・フッター・サイドバー / 業務データへの所有者列 / 外部 IdP・SSO・MFA

## 受入

- [ ] 未認証で保護画面へアクセスするとログイン画面へ遷移し、正しいメールアドレスとパスワードで認証が成功する
- [ ] パスワードが復元不能な形 (PBKDF2-HMAC-SHA256 / 100,000 回) で保存され、平文がどこにも残らない
- [ ] 管理者が設定画面から利用者の追加・停止・一時パスワード再発行を完結でき、一時パスワードは発行直後の1度だけ表示される
- [ ] 保持 ON で30日・OFF で12時間のセッション期限となり、既定の帰結がチェックボックス脇に明示されている
- [ ] ログイン画面の DOM に header/footer/nav/aside が0件でログインカードが1枚だけ置かれ、アイコンが常にテキストラベルと併記されている
- [ ] member が `/api/admin/*` の全エンドポイントに対して 403 を受け取る
- [ ] 既存20画面の呼出しが 401/503 応答契約の変更なしに動作する
- [ ] active runtimeと必須設定に共有パスワード認証分岐が0件である

## アーキテクチャ参照

- `architecture_refs`: `arch-account-login-auth` (認証方式とセッション) / `arch-account-login-security` (脅威と防御) / `arch-account-login-database` (スキーマと移行) / `arch-account-login-backend` (API 契約とドメイン) / `arch-account-login-frontend` (画面実装と状態) / `arch-account-login-ui-ux` (画面構成と情報優先度) / `arch-account-login-infrastructure` (配信構成と secret) / `arch-account-login-maintenance-ops` (運用と復旧)
- 規範となる仕様書: `specs/spec-account-login.md` (内容は複製せず lineage 参照のみ)

## 本番反映の状況

- 2026-09-15: 本番で PBKDF2 210,000 回がログイン 500 を起こしたため 100,000 回へ下げた (#52)。既存 admin は break-glass reset で 100,000 回のハッシュへ入れ替え済み。
- 本番へ資格情報を入れる経路は `docs/runbooks/scripts/admin-credential-remote.sh` に一本化した。
- 未完了: `AUTH_PASSWORD` の削除と、所有者によるログイン・利用者追加の確認 (SYS-ACCTLOGIN-P13)。記録は `docs/account-login/release-record.md`。

## 機能間依存

- `depends_on`: (なし)
- 依存理由: 本 feature は認証主体そのものを導入する最初のマクロ機能であり、先行して完了していなければならない他の feature が存在しない。既存20画面は `/api/*` の 401/503 契約を通じてのみ本 feature に接し、その契約を変更しないため feature 間の順序制約を生まない。

## Handoff

- per-feature planning: 本 feature は `depends_on` が空のため ready。`/dev-graph plan --feature-id feat-account-login --feature-context features/feat-account-login.context.json` で system-dev-planner (`run-system-dev-plan`) へ委譲する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を `parent_feature: feat-account-login` / 共通 `feature_package_id` で C02 経由 atomic 登録 (expected/applied = 13)
- 完了 rollup: exact 13 が全て done で、P07/P10/P11 の evidence が上記の受入8件を満たす場合だけ feature を done にする
