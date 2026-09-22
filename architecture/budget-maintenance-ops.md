---
graph_node_id: "arch-budget-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "予算 — 式と整合を core の単体テストで固定し旧実装で落ちる検算を受入の根拠にする"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "maintenance-ops"]
file_path: "architecture/budget-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "8cfbe5fbed898db6065b9c6529a6018d9e1ac7edeb7bbb5c1c7b05306cf48019"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "8cfbe5fbed898db6065b9c6529a6018d9e1ac7edeb7bbb5c1c7b05306cf48019", "imported_at": "2026-09-21T13:59:08Z"}
created_at: "2026-09-21T13:59:08Z"
updated_at: "2026-09-21T13:59:08Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-ui-ux", "arch-budget-frontend", "arch-budget-backend", "arch-budget-database", "arch-budget-security", "arch-budget-infrastructure", "arch-budget-auth"]
resource_scope: ["package.json", "packages/core/test", "packages/core/test/budget-outlook-contract.test.ts", "packages/web/src/budget-outlook.dom.test.tsx", "packages/web/src/diagnosis-next-action-receivers.dom.test.tsx", "packages/web/src/pages/budget/", "docs/data-schema.md", "docs/ui-decisions.md", "docs/budget-screen/", "docs/runbooks/prod-d1-schema-recovery.md", "scripts/check-design-tokens.mjs"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/budget-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T13:59:08Z"}
serves_goals: ["G2", "G4", "G5"]
---

# Architecture overview

予算 — 式と整合を core の単体テストで固定し旧実装で落ちる検算を受入の根拠にする。`system-spec/maintenance-ops.md` は承認時入力、本書はテストの置き場所・検証の手順・文書の更新の制約を持つ。

## Context and drivers

- Business/technical context: 予算の既存テストは core の `packages/core/test/budget-outlook-contract.test.ts` (年間予算 = 月次予算 × 12、着地 = 実績累計 + 直近 3 か月平均 × 残り月数、未設定科目の扱い) と web の `packages/web/src/budget-outlook.dom.test.tsx` (着地見込みの表示・スマホのカード化・下書きでの組み替え) の 2 本。診断から予算へ渡る導線は `packages/web/src/diagnosis-next-action-receivers.dom.test.tsx` が `budgets` の応答形で固定している。`package.json` の `lint` はデザイントークン検査 (`scripts/check-design-tokens.mjs`) を含み、`verify:full` はローカルの vite (4175) を前提にする。文書は `docs/data-schema.md` と `docs/ui-decisions.md`、D1 の本番復旧は `docs/runbooks/prod-d1-schema-recovery.md`。
- Quality attribute priorities: G2・G4・G5 に資する。Google SRE の operations (画面仕様・設計・設計判断・証跡を既存の作り直しと同じ配置に置き、予算の式を変えるときに読む場所を 1 つに絞る。migration は既存の Migrate の手順書に従い独自の運用手順を足さない) を適用する。本章での適用は Test pyramid とし、式と整合は core の単体テスト、保存と認可は API 統合テスト、画面の構成と編集は DOM テストに置く。既知の逸脱・未実施・一部適合は受入 PASS に数えない (qa-budget-maintenance-ops-web-001)。
- Constraints: 実データをテストに持ち込まない (`scripts/hooks/guard-real-data.sh`)。既存の診断・概要・家計収支・総収支・決算書・明細仕分けの数値テストを緑のまま保つ。緑にするために契約を緩めない。

## Goals and non-goals

- Goals:
  - G2: KPI の各式 (年間収入予算・年間支出予算・予算純収支・防衛ライン余裕 = 年間収入予算 − defenseLine の月額 × 12)、一覧の合計 = KPI = グラフの年合計、自動提案の各項と千円丸め、見通しの月次と累計、過不足の差額、調整によるインパクト、保存行の無い期間の初期値 (既存月額 × 12) を core の単体テストで固定する (qa-budget-decision-001, 004)。
  - G4: 画像の構成要素・下書きの復元と消去・未保存件数・この行を元に戻す・リセットの確認・離脱確認・診断からの `?account=` を DOM テストで確かめる。
  - G5: 期間ごとの保存と上書き・未認証・フェンス・不正値・利用者の区切り・migration が既存行を書き換えないことを API テストで確かめ、既存の他画面の数値テストを緑のまま保つ。
- Non-goals:
  - 新しい監視・アラート・ダッシュボード
  - E2E の実ブラウザ試験の追加 (既存の DOM テストと `verify:full` の範囲に留める)
  - 独自の migration 運用手順

## System context and boundaries

- Users/external systems: 開発者のローカル環境と GitHub Actions の CI。
- Trust/deployment/data boundaries: テストは合成データだけを使う。本番の D1 に触れない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `packages/core/test/budget-screen.test.ts` (予定) | KPI・自動提案・見通し・過不足・インパクト・初期値・一致の単体テスト | vitest | packages/core | CI |
| `packages/api/src/budget-screen.integration.test.ts` (予定) | 期間ごとの保存と上書き・401・フェンス・400・利用者の区切り・migration の非破壊の統合テスト | vitest | packages/api | CI |
| `packages/web/src/pages/budget/budget.dom.test.tsx` (予定) | 画面の構成・下書き・未保存件数・元に戻す・リセット確認・離脱確認・`?account=` の DOM テスト | vitest + DOM | packages/web | CI |
| 既存の予算テスト 2 本 | `budget-outlook-contract.test.ts` と `budget-outlook.dom.test.tsx` を新しい画面と読み出し関数へ書き換える (契約は緩めない) | vitest | packages/core / packages/web | CI |
| 文書 | `specs/spec-budget-screen.md`・`architecture/budget-*.md`・`docs/budget-screen/design-decisions.md` (予定)・`docs/data-schema.md`・`docs/ui-decisions.md` | Markdown | リポジトリ | リポジトリ |

(テストと文書のパス、既存 2 本の書き換えは agent 推定・利用者未確認、根拠 qa-budget-maintenance-ops-web-002)

## Cross-cutting contracts

- Identity/access: 認可のテストは `architecture/budget-auth.md` の検証項目に従う。
- Errors/resilience: 401・400・409 (フェンス競合) と行数上限の応答をテストで固定する。
- Observability/audit: N/A: 新しい運用信号を追加しない。
- Configuration/secrets: N/A: テストに秘密情報を使わない。
- Compatibility/versioning: 既存テストの期待値を変えるときは、変えた理由 (保存単位を月額から予算対象の年額へ変えた決定 dec-budget-storage-unit) を文書に残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/budget-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/budget-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/budget-database.md`)
- Security: N/A: 本章の関心外 (`architecture/budget-security.md`)

### Infrastructure architecture

#### Environments and topology

- Environments: ローカル (wrangler dev + vite 4175) と CI。`verify:full` はローカルの vite を前提にする。
- Topology: 既存のまま。

#### Compute and storage

- Compute: CI の GitHub Actions ランナー。
- Storage: テストはメモリ上か一時的なローカル D1 を使う。

#### IaC and delivery

- IaC: N/A: 基盤の定義を変えない。
- Delivery: `ci.yml` で lint (デザイントークン検査を含む)・typecheck・テスト・初期 JS 予算を通してから `migrate.yml` と `deploy.yml` へ進む既存の順。migration の本番反映は既存の Migrate の手順書と `docs/runbooks/prod-d1-schema-recovery.md` に従う。

#### Secrets and access

- Secrets: N/A: テストと文書に秘密情報を使わない。
- Access: 実データの持ち込みは `scripts/hooks/guard-real-data.sh` が止める。

#### Reliability and recovery

- 回帰の検出: 新しいテストは確定前に旧実装 (現行の `Budget.tsx` と月額の `budgets`) に当てて落ちることを確かめる。落ちるべき観点は、収入の行が無いこと・防衛ライン余裕が無いこと・予算対象の期間を持たないこと (agent 推定・利用者未確認、根拠 qa-budget-maintenance-ops-web-002)。落ちないテストは条件を見直す。件数を固定する検査は、対象の件数が 0 でないことも併せて確かめる。
- Recovery: テストが落ちたら差し戻す。式を変えるときは仕様を先に直す。

#### Infrastructure verification

CI で core・API・DOM のテストと lint・typecheck・初期 JS 予算を通す。ローカルで `verify:full` を実行する。追加した各テストが旧実装で落ちたことを記録してから確定する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-budget-maintenance-ops-web-001 | KPI の式と一覧・KPI・グラフの一致を core の単体テストで固定する | 画面の DOM テストだけで確かめる | 式の違反を最も小さい単位で見つけられる | core のテストが予算の式の正本を映す |
| qa-budget-maintenance-ops-web-001 | 既知の逸脱・未実施・一部適合は受入 PASS に数えない | 一部適合を条件付き PASS とする | 受入の判定が曖昧にならない | 未実施の観点は残作業として明示する |
| qa-budget-maintenance-ops-web-002 | テスト 3 本と文書の配置を既存の作り直しと同じ形にする (agent 推定・利用者未確認) | 既存の予算テストに追記する | 予算の新しい契約の置き場所が明確になる | 既存 2 本との重複を整理する |
| qa-budget-maintenance-ops-web-002 | テストは旧実装で落ちることを確かめてから確定する (agent 推定・利用者未確認) | 新実装で緑になれば確定する | 何も調べていない緑を防ぐ | 旧実装に当てる手順が 1 つ増える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI → Migrate → Deploy。
- Migration sequence: core の単体テスト (旧実装で落ちることの確認) → core の実装 → API 統合テスト → migration と API の実装 → DOM テスト → 画面の実装 → 既存テストの書き換え → 文書の更新 (`docs/data-schema.md` に新表と列、`docs/ui-decisions.md` と `docs/budget-screen/design-decisions.md` に画面の決定)。
- Rollback trigger/procedure: CI が落ちたら差し戻す。配信後の不具合は Worker と web を直前版へ戻す。migration は追加のみなので戻さない。

## Risks and verification

- Risk/assumption: 既存の `budget-outlook-contract.test.ts` は年間予算 = 月次予算 × 12 と直近 3 か月平均の着地を固定している。予算対象の年額へ変えると期待値の一部が変わるが、変えた理由を文書に残さないと契約を緩めたのか定義を変えたのか区別できない。
- Risk/assumption: `diagnosis-next-action-receivers.dom.test.tsx` は `budgets` の応答形を直接使う。画面の取得を変えるとこのテストのモックも変わるため、診断の予算カバー率が同じ値であることを別途確かめる。
- Risk/assumption: `verify:full` はローカルの vite 4175 を前提にし、起動していないと接続拒否で落ちる。CI とローカルで実行の前提を分けて記録する。
- Architecture fitness test: 追加テストの件数と対象の科目数が 0 でないこと。一覧の和 = KPI = グラフの年合計が同じテストで確かめられていること。
- Load/failure/security validation: 3 年分の固定データでの core と API のテストが CI の時間内に収まること。
