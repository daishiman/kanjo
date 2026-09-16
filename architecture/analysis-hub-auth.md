---
graph_node_id: "arch-analysis-hub-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "支出分析ハブ — 認証ゲート配下のハブ API"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub", "auth"]
file_path: "architecture/analysis-hub-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-15-analysis-hub/completeness-findings.json", "evaluated_digest": "945fd8dfa54925bd0c184efd13ef39acedf43feb00a5a4634bbc21a8e264fc20"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-15-analysis-hub/auth.md", "source_version": "0.1.14", "source_digest": "945fd8dfa54925bd0c184efd13ef39acedf43feb00a5a4634bbc21a8e264fc20", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/web/src/AuthenticatedApp.tsx"]
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
classification_reason: "system-spec の auth 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/analysis-hub-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:23:44Z"}
serves_goals: ["G3"]
---

# Architecture overview

支出分析ハブ — 認証ゲート配下のハブ API。正本は `system-spec/auth.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-analysis-hub.md`。

## Context and drivers

- Business/technical context: 認証は利用者アカウント (メールアドレス + パスワード、PR #47) のセッションで、packages/api/src/index.ts が /api/* に authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence を掛ける。本サイクルは新しい集約 API GET /api/analysis/hub を足すため、そのルートがどのゲートの後ろに置かれ、誰のデータを読むかだけを確定する。認証方式・セッション・レート制限は変えない。画面は AuthenticatedApp 配下の /analysis に描画し、未認証時は既存どおりログイン画面になる。
- Quality attribute priorities: G3 に資する。Secure by Design の『境界で一度だけ判定し、既定で閉じる』を適用し、新ルートでも認可の判断を route 内に散らさず、既存ゲートと userId での絞り込みに寄せる。
- Constraints: C1: 集計は packages/core の純関数に置き、api は route adapter として読取りと受け渡しだけを持つ。 C3: 表示していないタブの API は呼ばない。ハブ API はサイドバーのバッジと共有する例外として扱う (frontend 章 decision-003)。

## Goals and non-goals

- Goals:
  - G3: ハブ表示中の呼出しを GET /api/analysis/hub の 1 本にし、既存 5 API を呼ばない。新ルートは既存の認証ゲートの後ろにマウントし、全読取りを userId で絞る。
- Non-goals:
  - 認証方式・セッション発行・パスワード変更フロー・レート制限の変更
  - 役割 (role) や共有アカウントなど、利用者本人以外に集計を見せる仕組み
  - 5 タブ詳細画面の中身の作り直し
  - ネイティブアプリ (スマートフォン・タブレット・デスクトップ)

## System context and boundaries

- Users/external systems: 利用者 1 名 (SH1) と保守エージェント (SH2)。外部システムの追加は無い。
- Trust/deployment/data boundaries: 信頼境界は /api/* のゲート列。ハブ API はその内側に置き、D1 の読取りはすべて c.get('userId') で絞る。共有された /analysis?focus=(タブ id) を他人が開いても、その人のセッションで本人のデータしか集計されない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| authGuard | 未認証の /api/* を 401 で止める (変更しない) | Hono middleware | packages/api | Worker |
| mustChangePasswordFence | 一時パスワード未変更を 403 password_change_required で止める (変更しない) | Hono middleware | packages/api | Worker |
| GET /api/analysis/hub | ゲート通過後に userId で絞った読取りを core のハブ集計へ渡す | Hono route | packages/api | Worker |
| AuthenticatedApp | 認証済みのときだけ /analysis とサイドバーのバッジ用クエリを描画する | React route | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: authGuard と mustChangePasswordFence を変えず、その後ろにハブ API をマウントする。route 内の認可判断は userId での絞り込みだけに限る。
- Errors/resilience: 未認証は既存の 401、一時パスワード未変更は既存の 403 をそのまま返す。ハブ固有の認証エラーは作らない。
- Observability/audit: N/A: 認証の監査ログや信号を追加しない。既存 requestId を使う。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存のセッションと /api/auth/* の契約を維持する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者本人の取引集計 (期間の収支・要確認件数・改善余地)。主体は唯一の利用者と保守エージェント。想定する脅威は、未認証アクセスと、共有 URL を開いた第三者が他人の集計を見ること。

#### Identity and authorization

GET /api/analysis/hub を authGuard と mustChangePasswordFence の後にマウントする。loadDataset と freee_deals・duplicate_verdicts・freee_deal_exclusions の読取りをすべて userId で絞る。web では AuthenticatedApp の配下だけにハブとバッジ用クエリを置き、未認証の画面ではクエリを張らない。

#### Data and secret protection

N/A: 秘密情報の扱いを変えない。応答は本人の集計値だけで、外部へ送信しない。

#### Application and supply-chain controls

N/A: 認証ライブラリや依存を追加しない。

#### Detection and response

N/A: 検知・対応の仕組みを変えない。

#### Security verification

認証なしで GET /api/analysis/hub が 200 を返さないこと、認証付きで 200 と期間メタを返すことを API 統合テストで確かめる (O3)。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-analysis-hub-decision-002 | core 純関数 + 集約 API GET /analysis/hub を新設し、既存ゲート配下に置く | 既存 5 API を同時に呼び、前期間比と改善余地を省く | 1 本の API に集約すると認証境界の対象ルートも 1 本で済み、C3 と衝突しない | 新ルートのゲート順と userId 絞り込みを統合テストで固定する |
| qa-frontend-web-ah-decision-003 | Layout とハブで queryKey を共有し、ハブ API を C3 の例外にする | バッジは支出分析内だけに出す | どの画面でもバッジを出すため、認証済みシェル全体からハブ API を呼ぶ | 未認証画面ではバッジ用クエリを張らないことを守る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console に GET ルートを 1 本足し、既存の ci.yml / deploy.yml の経路で配信する。
- Migration sequence: core のハブ集計関数 → api のゲート配下へのルート追加 → web のハブ画面とバッジの順に進める。認証まわりの移行作業は無い。
- Rollback trigger/procedure: 統合テストで未認証アクセスが 200 になる、または他利用者のデータが混ざる兆候があれば PR を差し戻し、配信済みなら直前のビルドへ戻す。migration が無いのでスキーマの巻き戻しは発生しない。

## Risks and verification

- Risk/assumption: ルートを /api/* のゲート列より前に登録すると認証を素通りする。マウント位置を index.ts の既存ルートと同じ層に置く前提に立つ。
- Architecture fitness test: 未認証の GET /api/analysis/hub が 401、一時パスワード未変更で 403、認証付きで 200 を返す統合テストを置き、ゲートの後ろから外すと落ちる。
- Load/failure/security validation: 既存の pnpm test / typecheck / lint と check 系を緑に保つ (S6)。
