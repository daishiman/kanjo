---
graph_node_id: "arch-subscriptions-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "サブスク画面 — 入力は許可リストで閉じ、外部取得と HTML 描画の経路を作らない"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "security"]
file_path: "architecture/subscriptions-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6567f6d8c87bcbb896e448870b953cebeee86e94308a5b547775c066b8b464de"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "6567f6d8c87bcbb896e448870b953cebeee86e94308a5b547775c066b8b464de", "imported_at": "2026-09-18T07:04:09Z"}
created_at: "2026-09-18T07:04:09Z"
updated_at: "2026-09-18T07:04:09Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-ui-ux", "arch-subscriptions-frontend", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-auth", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops"]
resource_scope: ["packages/api/src/routes/subs.ts", "packages/api/src/routes/analytics.ts", "packages/web/src/pages/Subscriptions.tsx", "packages/web/src/components/SubVendors.tsx", "packages/web/scripts/check-financial-visuals.mjs"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:04:09Z"}
serves_goals: ["G4", "G5"]
---
# Architecture overview

サブスク画面 — 入力は許可リストで閉じ、外部取得と HTML 描画の経路を作らない。`system-spec/security.md` は承認時入力、本書は security 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-subscriptions-screen.md`。

## Context and drivers

- Business/technical context: 既存の入力検証は `packages/api/src/routes/subs.ts:28-32` の Zod — `name` は 1〜60 文字、`aliases` は各 1〜60 文字で 20 件まで、`accounts` は各 1〜60 文字で 30 件まで。候補除外の `partner` は 1〜120 文字 (:180)。条件式は Drizzle の束縛 (`eq` / `and`) で組まれ、文字列連結は無い。本サイクルは、取引名・金額を含む詳細 (GET /api/subscriptions/vendors/:key)、利用者が選んだ取引名を別名に加える統合 (POST /api/sub-vendors/:id/aliases)、見直し判断 (POST / DELETE /api/subscriptions/review-decisions)、カテゴリ (PUT /api/sub-vendors/:id) を足すため、入力経路と出力経路がどちらも増える。参照画像にはサービスのロゴが描かれているが、ロゴは取得も表示もしない。現行の `packages/web/src/pages/Subscriptions.tsx` と `packages/web/src/components/SubVendors.tsx` に外部画像や `dangerouslySetInnerHTML` は無い (Subscriptions.tsx:238 の `role="img"` はチャートの canvas)。
- Quality attribute priorities: G4・G5 に資する。OWASP ASVS (Secure by Design) の入力検証 (許可リスト)、出力エンコーディング、機微情報の露出防止、外部への送信の最小化を適用する。
- Constraints: 依存を増やさない (既存の Zod と Drizzle で満たす)。web のみ。外部 AI・ロゴ取得の経路を作らない。

## Goals and non-goals

- Goals:
  - G4: 集計 API は集計値だけを返し、明細は詳細 API から上限つきで返す (spec §13)。
  - G5: 旧 UI の操作を新しい部品へ移しても、入力検証と出力の扱いを弱めない。
- Non-goals:
  - 認証・セッションの変更 (`architecture/subscriptions-auth.md`)
  - 監査ログ基盤の追加

## System context and boundaries

- Users/external systems: 外部送信なし。取引データ・ベンダー名をアプリの外へ出さない (ロゴ取得・外部 AI を呼ばない)。
- Trust/deployment/data boundaries: 信頼できない入力は URL パス (`:id` / `:key`)・クエリ (期間)・JSON 本文 (category / aliases / vendorKey / decision)。出力の信頼境界は JSON 応答とブラウザ DOM の 2 つ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Zod 許可リスト | vendorKey・aliases・decision・category・期間の検証 | zValidator | packages/api | Worker |
| Drizzle 束縛 | 条件式の組み立て (文字列連結を使わない) | ORM | packages/api | Worker |
| 集計 API の応答 | 集計値のみ (明細行を含めない) | JSON | packages/api | Worker |
| 詳細 API の応答 | 取引名・直近 3 件と件数・データソース別件数・取引履歴 (上限つき) | JSON | packages/api | Worker |
| 画面の描画 | React のテキストとしてだけ描く | JSX | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: `architecture/subscriptions-auth.md` に従い、全読み書きを userId で絞る。
- Errors/resilience: 許可リスト違反は 400。エラー本文に SQL・スタック・内部パスを含めない。
- Observability/audit: 監査ログに明細金額・取引先名を書かない。
- Configuration/secrets: 新しい秘密情報を持たない。
- Compatibility/versioning: 既存経路の検証は aliases の上限を除いて緩めない。aliases は利用者決定 (2026-09-18) により全経路で 50 件 × 各 100 文字へ揃える (既存 PUT / POST の 20 件 × 60 文字から広げる)。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Input validation

Zod の許可リストで閉じる — `vendorKey` は長さ上限つき、`aliases` は 1〜50 件・各 1〜100 文字、`decision` は `confirmed` / `dismissed` の列挙、`category` は辞書の列挙か 1〜20 文字。`:id` は整数でなければ 400。期間クエリは既存の検証を使う。

#### Output protection

画面は React のテキストとしてだけ描き、取引名・ベンダー名・理由文を HTML として解釈させない。理由文は core の定型文に数値を差し込むだけで、利用者入力を書式に使わない。

#### Data exposure control

GET /api/subscriptions は集計値のみを返し、明細は GET /api/subscriptions/vendors/:key から、選んだベンダーの分だけ上限つきで返す。ロゴ取得・外部 AI の経路を作らず、ベンダー名を第三者へ送らない。

#### Dependency and supply chain

依存を追加しない。ロゴ用の外部画像ホストや CDN を許可リストに足さない。

#### Security verification

API テストで許可リスト違反 (列挙外の decision、長すぎる vendorKey、51 件の aliases、101 文字の別名、長すぎる category、整数でない `:id`) が 400 になること。DOM テストと check-financial-visuals でロゴ画像要素が 0 件であること。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-subs-security-web-004 | Zod の許可リストで vendorKey / aliases / decision / category を閉じる | 型だけの検証 | 想定外の値を保存前に落とす | 上限値を docs とテストに書く |
| qa-subs-security-web-004 | React のテキストとしてだけ描き、外部 AI・ロゴ取得の経路を作らない | ロゴ取得 / AI 理由文 | 取引データを外へ出さず、描画での注入を防ぐ | ロゴの位置は空ける (ui-ux) |
| qa-subs-review-decision-002 | decision は confirmed / dismissed の 2 値の列挙 | 自由文字列 / adopted を含む | 保存される値を 2 つに閉じる | 列挙外は 400 |
| dec-subs-review-candidate | 理由文は core の定型文 + 数値の差し込み | AI 生成 | 出力の内容を決定論にし、外部送信を無くす | 文の追加は core の変更 |
| dec-subs-category | category は辞書の列挙か 1〜20 文字 | 無制限 | 保存と表示の長さを閉じる | 辞書外のカテゴリ名も短く保つ |
| dec-subs-coverage / dec-subs-kpi-definition | 集計 API は集計値のみを返す | 明細を同梱 | 一覧表示に明細は要らず、露出を減らす | 明細は詳細 API から |
| dec-subs-persistence | 保存は既存表の延長と判断表で、全て userId で絞る | 新しい保存基盤 | 既存の束縛と絞りをそのまま使う | — |
| dec-subs-legacy-ui / dec-subs-fixture-authority | 旧 UI の移設でも検証を緩めず、画像の数値やロゴを取り込まない | 画像をそのまま再現 | ロゴ 0 件を検査に足す | check-financial-visuals のモック更新 |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と web ビルド。依存追加なし。
- Migration sequence: 許可リスト (新設経路と PUT の category) → 詳細 API の上限 → 画面の描画確認 → ロゴ 0 件の検査。
- Improvement (既存実装の是正): 統合 API の aliases は 1〜50 件・各 1〜100 文字だが、既存の PUT /sub-vendors/:id と POST /sub-vendors の aliases は 20 件・各 60 文字 (`subs.ts:29`)。統合で 21 件目を足したベンダーを PUT で保存し直すと 400 になるため、同じ変更で上限を 50 件 × 各 100 文字へ揃える (利用者決定 2026-09-18)。上限値を固定している既存テストも同じ変更で更新する。
- Rollback trigger/procedure: セキュリティ関連テストが落ちたら差し戻し。検証の追加だけなのでデータの巻き戻しは不要。

## Risks and verification

- Risk/assumption: aliases の上限を 50 件 × 120 文字 (`SUB_VENDOR_NAME_MAX`) へ広げると、1 ベンダーの別名の照合回数が増える。照合はベンダー数 × 別名数の線形で、上限 50 なら既存の明細件数の計算量に埋もれる。
- Risk/assumption: 詳細 API の取引履歴に上限が無いと、1 ベンダーの明細が多いときに応答が肥大する。上限つきで返し、件数は別に返す。
- Architecture fitness test: 条件式に文字列連結が無いこと。`dangerouslySetInnerHTML` と外部画像 URL が本画面に無いこと。集計 API の応答に明細行が含まれないこと。
- Load/failure/security validation: 許可リスト違反の 400、ロゴ画像要素 0 件、エラー本文に内部情報が無いこと。集計と詳細の応答が `private, no-store` であること (P10 で追加)。
