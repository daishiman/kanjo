---
graph_node_id: "arch-household-cashflow-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "家計収支 — 表示名とクエリの zod 許可リストと外部送信なし"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["household-cashflow", "security"]
file_path: "architecture/household-cashflow-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "b6a0a70a0aa6c4be9670003a387dc7ab359b9df4fc8b5da5eddcbef130867dd2"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "b6a0a70a0aa6c4be9670003a387dc7ab359b9df4fc8b5da5eddcbef130867dd2", "imported_at": "2026-09-18T12:24:49Z"}
created_at: "2026-09-18T12:24:49Z"
updated_at: "2026-09-18T12:24:49Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-frontend", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-auth", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops"]
resource_scope: ["packages/api/src/routes/settings.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/web/src/pages/household/", "scripts/hooks/guard-real-data.sh"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/household-cashflow-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:24:49Z"}
serves_goals: ["G4", "G5"]
---

# Architecture overview

家計収支 — 表示名とクエリの zod 許可リストと外部送信なし。`system-spec/security.md` は承認時入力、本書は入力検証・出力の無害化・データ露出の制約を持つ。入力規則と契約の正本は `specs/spec-household-cashflow-screen.md` §6.3 / §11。

## Context and drivers

- Business/technical context: settingsRoute の `PUT /classification` は `zValidator('json', classificationSchema)` で institutionOwners を検証している (`packages/api/src/routes/settings.ts:654-661`)。一方、家計の `GET /api/household` は専用の zod 検証を持たない (`analytics.ts:528-531`)。`pnpm run security:content` (`scripts/hooks/guard-real-data.sh --scan-public-docs`) が lint に組み込まれ、公開文書への実データ混入を検査している。フッターは『取込データは外部送信しません』を掲げる (qa-household-security-web-evidence-001)。
- Quality attribute priorities: G4・G5 に資する。OWASP ASVS の security (入力検証・出力の無害化・外部送信なし) を適用する。
- Constraints: 新しい入力は名義ラベルの表示名と家計 API のクエリだけ。更新系は既存の `canonicalMutationFence` の内側に置く。

## Goals and non-goals

- Goals:
  - G4: 名義ラベルの表示名を zod の許可リスト (長さ・使える文字・名義間の重複) で検証し、違反は 400 とフィールド別のエラーで返す。D1 の CHECK 制約でも長さを守る。
  - G5: 振替の対推定は表示だけにし、データを書き換えない。
- Non-goals:
  - 明細や表示名の外部サービスへの送信
  - 表示名の HTML 描画 (`dangerouslySetInnerHTML`)
  - 新しい監査ログや暗号化方式の追加

## System context and boundaries

- Users/external systems: ログイン済みの利用者本人。外部送信先は無い。
- Trust/deployment/data boundaries: 信頼しない入力は PUT 本文とクエリ (`month`・`key`・期間)。応答は利用者本人のデータだけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| owner-labels の zod スキーマ | 4 キー必須、表示名の長さ・文字種・重複を検証し、違反はフィールド別の 400 | zValidator | packages/api | Worker |
| 家計クエリの zod スキーマ | `month` の書式と期間内、`key` の 6 区分 enum、期間パラメータ | zValidator | packages/api | Worker |
| `owner_labels` の CHECK | owner の 4 値と label の長さを DB でも守る | D1 制約 | D1 | D1 |
| web の描画 | 表示名・取引先名・内容を React の既定のエスケープで描く | JSX | packages/web | web ビルド |
| ダイアログの入力検証 | サーバと同じ規則でフィールドエラーを出し、違反は送信しない | フォーム | packages/web | web ビルド |
| security:content | 公開文書への実データ混入を lint で検査する | npm script | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: 4 経路は既存の認証・フェンスの内側 (`architecture/household-cashflow-auth.md`)。
- Errors/resilience: 違反は 400 とフィールド別のエラー。エラー応答に内部の SQL・スタック・ファイルパスを含めない。
- Observability/audit: 監査やログに明細の金額・取引先・表示名を書き足さない。
- Configuration/secrets: 新しい秘密情報を持たない。
- Compatibility/versioning: 既存の `classificationSchema` の検証は変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Input validation

表示名は前後の空白を除いたうえで、長さ・制御文字・4 名義の間の重複を zod で検証する。具体の上限と拒否する文字の範囲は仕様書の入力規則に従う (正本は `specs/spec-household-cashflow-screen.md` §6.3。その値は agent 推定・利用者未確認 (根拠 qa-household-security-web-003))。家計のクエリは `month` を `YYYY-MM` の書式で受け期間外は 400、`key` は 6 区分の enum で受ける。

#### Output protection

表示名・取引先名・内容は React の既定のエスケープで描画し、`dangerouslySetInnerHTML` を使わない。表示名はサーバが `ownerLabel` で付けた値だけを描く。

#### Data exposure control

応答は利用者本人のデータだけで、明細の内容・取引先はこれまでどおり画面に出すが外部へ送信しない。振替の対推定は表示だけで、明細や名義を書き換えない。更新系は `canonicalMutationFence` の内側に置く。

#### Dependency and supply chain

新しい外部依存を足さない。検証は既存の zod と Hono の zod-validator で行う。

#### Security verification

API 統合テストで表示名の長さ超過・制御文字・重複・4 キー欠落が 400 になり、正常更新が 200 になること。家計クエリの `month` 書式違反・期間外と `key` の enum 外が 400 になること。web に `dangerouslySetInnerHTML` が無いこと。`security:content` が緑であること。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-household-security-web-004 | 表示名は zod の許可リストで検証し、D1 の CHECK でも長さを守る | サーバで検証せず画面の入力制限だけにする | 画面を経ない要求も同じ規則で止まり、DB に規則外の値が残らない | 規則を変えるときは zod・CHECK・ダイアログの 3 か所を揃える |
| qa-household-security-web-004 | 家計 API のクエリも zod で enum と書式を検証する | 現行どおり検証なし | 期間外の月や未知の区分を 400 で明示的に拒める | 既存の `GET /api/household` の呼び出しに検証が加わる |
| dec-household-owner-model | 利用者が変えられるのは表示名だけで、内部値は変えない | 内部値ごと編集可能にする | 検証対象が表示用の文字列に限られ、既存の規則・明細を壊さない | 表示名は必ずエスケープして描く |
| dec-household-transfer-pairs | 振替の対推定は表示だけにし、データを書き換えない | 推定結果を明細へ保存する | 推定の誤りがデータを汚さない | 推定は要求ごとにやり直す |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と web ビルド。
- Migration sequence: `owner_labels` の CHECK (database 章) → owner-labels の zod スキーマ → 家計クエリの zod スキーマ → ダイアログの入力検証 → API 統合テスト。
- Rollback trigger/procedure: 検証テストが落ちたら差し戻し、配信済みなら Worker を直前版へ戻す。

## Risks and verification

- Risk/assumption: 画面とサーバで入力規則が食い違うと、画面では通るがサーバで 400 になる。同じ規則を両方に置き、境界値をテストで固定する。
- Architecture fitness test: 更新系の経路が `canonicalMutationFence` の内側にあること。表示名を HTML として描く箇所が無いこと。
- Load/failure/security validation: 公開文書への実データ混入が `security:content` で検出されること。外部送信のコードが増えていないこと。
