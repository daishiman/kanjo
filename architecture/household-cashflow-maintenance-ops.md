---
graph_node_id: "arch-household-cashflow-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "家計収支 — 不変条件テストと仕様フィクスチャによる回帰検出"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["household-cashflow", "maintenance-ops"]
file_path: "architecture/household-cashflow-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6bc0855d54a0d2a8171fe86914b37c161e1f43eaf752e682790bf02402052dfb"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "6bc0855d54a0d2a8171fe86914b37c161e1f43eaf752e682790bf02402052dfb", "imported_at": "2026-09-18T12:24:49Z"}
created_at: "2026-09-18T12:24:49Z"
updated_at: "2026-09-18T12:24:49Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-frontend", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-auth", "arch-household-cashflow-security", "arch-household-cashflow-infrastructure"]
resource_scope: ["package.json", "docs/data-schema.md", "docs/ui-decisions.md", "scripts/check-design-tokens.mjs", "packages/core/src/household-summary.ts", "packages/web/src/pages/household/"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/household-cashflow-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:24:49Z"}
serves_goals: ["G1", "G2", "G5"]
---

# Architecture overview

家計収支 — 不変条件テストと仕様フィクスチャによる回帰検出。`system-spec/maintenance-ops.md` は承認時入力、本書はテスト・文書・回帰検出の制約を持つ。フィクスチャと受入の正本は `specs/spec-household-cashflow-screen.md` §3〜§7 / §10 / §13。

## Context and drivers

- Business/technical context: ルートの `package.json` は test (全パッケージの test と test:aux)、typecheck、lint (biome と check-design-tokens などの独自検査、security:content)、verify:full (test・typecheck・lint・build と web の check:* 群・preview:smoke) を持つ。design-system:fast は chart-series-contract や common-shell-routes の DOM テストを含む。`docs/data-schema.md` と `docs/ui-decisions.md` が集計規則と UI の決定の記録先として使われている (qa-household-maintenance-ops-web-evidence-001)。
- Quality attribute priorities: G1・G2・G5 に資する。Google SRE の operations (回帰の検出手順を既存の verify:full に載せる) と Clean Code (テストの読みやすさ) を適用する。
- Constraints: 既存の総収支・推移・マトリックス・分析ハブの数値テストを緑のまま保つ。新しい検査の仕組みを足さず既存の script に載せる。

## Goals and non-goals

- Goals:
  - G2: core の単体テストで不変条件を固定する (総収支の総合と `toBe` で一致、全月で事業 + 個人 = 家計全体、6 区分の和 = 総支出、名義別の和 = 総収入、前年欠損で `null`、振替は台帳に現れない)。
  - G1: 仕様書のフィクスチャ (計算値を含む) で画面再現を DOM テストする。
  - G5: 振替の対推定の決定論をテストで固定し、規則を `docs/data-schema.md` に明記する。
  - 回帰境界: 空は集計対象台帳行 0 件 (振替のみ・除外行のみを含む)、カテゴリ詳細は `current` / `monthTotal` / 5 件プレビューの分離、振替は選択月の全件 (抜粋なし) と循環導線なしを固定する。
- Non-goals:
  - 画像の算術が閉じない欄を期待値にすること
  - 新しい CI ジョブ・検査スクリプトの追加
  - 既存画面の数値テストの期待値の書き換え

## System context and boundaries

- Users/external systems: 開発者と CI。検査は `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm run verify:full`。
- Trust/deployment/data boundaries: テストは仕様フィクスチャだけを使い、実データを公開文書やテストへ入れない (security:content で検査)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 不変条件テスト | 5 つの不変条件・前年欠損・対推定の決定論を固定する | vitest | packages/core | CI |
| 画面の DOM テスト | 仕様フィクスチャで KPI・内訳・表・名義別・前年との比較・状態を検査する | vitest + DOM | packages/web | CI |
| owner-labels の API 統合テスト | 未認証 401・フェンス違反・表示名の 400・正常更新 200 と再取得 | vitest | packages/api | CI |
| migration 検査 | migration が既存行を書き換えないことを確かめる | テスト | packages/api | CI |
| `docs/data-schema.md` | 等式・欠損規則・6 区分の対応表・振替の対推定の規則を記す | 文書 | docs | リポジトリ |
| `docs/ui-decisions.md` | 画面の決定 (計算値を正本にした欄など) を記す | 文書 | docs | リポジトリ |

## Cross-cutting contracts

- Identity/access: N/A: 運用手順に認証の変更は無い。
- Errors/resilience: いずれかの検査が落ちたら差し戻す。
- Observability/audit: N/A: 新しい実行時の信号を追加しない。
- Configuration/secrets: N/A: テストに秘密情報を置かない。
- Compatibility/versioning: 旧 `household()` の参照が残らないことを検索で確かめる。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Operations architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Operations architecture

#### Fixture authority

期待値の正本は仕様書のフィクスチャで、画像の算術が閉じない欄は計算値を期待値にする (純収支の前年差 −¥80,000 (−9.6%)、構成比、前年比率、名義の表示名。正本は `specs/spec-household-cashflow-screen.md` §10)。金額は `toBe` の厳密一致で比べ、集計の誤りを丸めで隠さない。

#### Terminology consistency

ナビ・パンくず・`figure-guides.ts`・用語集で『家計収支』に揃え、『累計収支』が残らないことを確かめる。名義の表示は `ownerLabel` 経由だけにし、`OWNER_LABEL` の直参照が残らないことを検索で確かめる。

#### Regression scope

既存の総収支・推移・マトリックス・分析ハブの数値テストを緑のまま保つ。台帳行への名義の追加で総収支・推移の数値が変わらないことを既存テストで確かめる。lint (直書き色の検査を含む)・typecheck・初期 JS 予算を CI で通す。

#### Documentation upkeep

集計規則 (等式・欠損規則・6 区分の対応表・振替の対推定) は `docs/data-schema.md` に集め、6 区分の対応表は core の定数とテストで一致を検査する。画面の決定は `docs/ui-decisions.md` に残す。

#### Operations verification

対推定と表示名の入力規則は境界の両側をテストで固定する。境界値は仕様書と章の記録に従う (正本は `specs/spec-household-cashflow-screen.md` §6.2 / §6.3 と `system-spec/maintenance-ops.md`。その値は agent 推定・利用者未確認 (根拠 qa-household-maintenance-ops-web-003))。回帰の検出手順は既存の verify:full に載せる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-household-figure-source | 画面の再現テストは計算値を期待値にする | 画像の値を期待値にする | 期待値が算術で閉じ、`toBe` で集計の誤りを検出できる | 画像と異なる欄を仕様書 §10 に明記し続ける |
| dec-household-ledger-source | 家計全体と総収支の総合の一致をテストで固定する | 家計だけの期待値で検査する | 二重実装による数字の食い違いを検出できる | 総収支の台帳の変更が家計のテストにも効く |
| dec-household-categories | 6 区分の対応表を docs と core 定数でテストにより一致させる | docs だけに書く | 文書と実装のずれを CI で検出できる | 対応表の変更は docs と定数を同時に直す |
| qa-household-maintenance-ops-web-004 | 回帰の検出は既存の verify:full と CI に載せる | 家計専用の検査手順を別に持つ | 手順を 1 本に保ち、既存画面との回帰も同時に見られる | verify:full の実行時間が伸びる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI (`ci.yml`) と `verify:full`。
- Migration sequence: core 不変条件テスト → 対推定の決定論テスト → owner-labels の API 統合テストと migration 検査 → 画面の DOM テスト → docs の更新 → 旧 `household()` の参照検索。
- Rollback trigger/procedure: いずれかの検査が落ちたら差し戻す。期待値を緩めて緑にしない。

## Risks and verification

- Risk/assumption: 画像の値を期待値にすると算術が閉じず、実装を画像に合わせて歪める。計算値を正本にして回避する。
- Architecture fitness test: 旧 `household()` と `HouseholdData`、`OWNER_LABEL` の直参照、『累計収支』の表記が残らないこと。
- Load/failure/security validation: 既存の数値テストが緑であること。公開文書への実データ混入が `security:content` で検出されること。
