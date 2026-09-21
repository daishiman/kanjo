---
graph_node_id: "arch-statements-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "決算書 — 恒等式と 3 状態を契約テストで固定し、既存テストを旧実装で落ちる形へ更新し、規則を docs に残す"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "maintenance-ops"]
file_path: "architecture/statements-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "342df0a3bb828c5fe8c971d23a780a99cefdb816226db5b9558dc98eaf4b0adc"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "342df0a3bb828c5fe8c971d23a780a99cefdb816226db5b9558dc98eaf4b0adc", "imported_at": "2026-09-19T23:36:20Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T23:36:20Z"
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-backend", "arch-statements-database", "arch-statements-auth", "arch-statements-security", "arch-statements-infrastructure"]
resource_scope: ["package.json", "packages/core/test/statements-contract.test.ts", "packages/core/test/balances-contract.test.ts", "packages/api/src/balances-lifecycle.test.ts", "packages/web/src/statements-balance-sheet.dom.test.tsx", "docs/data-schema.md", "docs/ui-decisions.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/statements-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:06:39Z"}
serves_goals: ["G1", "G2", "G5"]
---

# Architecture overview

決算書画面 — 恒等式と 3 状態を契約テストで固定し、既存テストを旧実装で落ちる形へ更新し、規則を docs に残す。`system-spec/maintenance-ops.md` は承認時入力、本書は運用・保守の制約を持つ。

## Context and drivers

- Business/technical context: ルートの package.json は test・typecheck・lint (biome と check-design-tokens などの独自検査、security:content)・verify:full を持つ。決算書を固定するテストは `packages/core/test/statements-contract.test.ts`・`packages/core/test/balances-contract.test.ts`・`packages/web/src/statements-balance-sheet.dom.test.tsx` (文言『この月の負債を保存』と PUT 本文 `{month:'2026-08', lines:[{category:'借入金', amount:30000}]}` を固定)・`packages/api/src/balances-lifecycle.test.ts`・`common-shell-routes.dom.test.tsx`。
- Quality attribute priorities: G1・G2・G5 に資する。Google SRE の運用 (回帰を CI で止める)。
- Constraints: 契約を緩めて緑にしない。旧実装で落ちることを確かめる。

## Goals and non-goals

- Goals:
  - G2: 区分対応表と計算式を docs/data-schema.md とテストで固定する。
  - G1: 検算済みフィクスチャで画面を DOM テストする。
  - G5: 上限・監査・未認証を API テストで固定する。
- Non-goals:
  - 新しい CI ジョブ・監視
  - E2E ブラウザテストの新設

## System context and boundaries

- Users/external systems: 開発者と CI (GitHub Actions)。
- Trust/deployment/data boundaries: テストのフィクスチャは合成データ (実在の取引を含めない)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 契約テスト | 恒等式 (全月と合計)・前期比 (0 / 欠損で null)・未知科目は販管費・構成比・CF 原因件数・原因が無ければ可・settlementUnknown 単独で不可・unset と zero | vitest | packages/core | CI |
| API 統合テスト | 1 項目保存で他項目が残る・unset で行が消える・400 / 413 / 401 / 409・監査 1 件・source=mf 不変 | vitest | packages/api | CI |
| DOM テスト | 検算済みフィクスチャの画面・3 状態・下書き・未保存バー・nav の aria-current (1 項目だけ)・role=tab が無い・行ボタンの aria-pressed・負債 KPI の前月末比ラベルと色・現金増減 KPI に % なし | vitest + DOM | packages/web | CI |
| migration 検査 | 0046 が既存行を書き換えない | vitest | packages/api | CI |
| docs | data-schema.md (区分対応表・計算式・DDL)、ui-decisions.md (spec §8 の画像との意図的な差: 負債 KPI の前月末比と良化色・ページ内ナビ・行の選択・月次表の数値・CF の第 2 原因・監査ログ) | Markdown | docs | リポジトリ |

## Cross-cutting contracts

- Identity/access: N/A: 運用の権限は変えない。
- Errors/resilience: CI が落ちたらマージしない。
- Observability/audit: N/A: 新しい監視を足さない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存テストは新しい文言と本文形へ更新し、旧期待値を残さない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Runtime and deployment topology

N/A: 実行基盤は変えない (CI の既存ジョブで検証する)。

#### Environments and configuration

verify:full は 4175 の vite と `.dev.vars` を前提にする (既存の制約)。

#### Networking and edge

N/A: 経路を変えない。

#### Scalability and resilience

N/A: 負荷の性質を変えない。

#### Operations and recovery

回帰は CI の test・typecheck・lint・js-budget・verify:full で止める。

#### Infrastructure verification

`pnpm test`・`pnpm typecheck`・`pnpm lint`・js-budget (build:bundle 直後)・`verify:full` が緑。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-statements-image-observations-001 / qa-statements-monthly-pl-unit-001 | 数値の期待値は千円 fixture と円・万円の変換境界 (spec §6) | 画像の値を万円として扱う | 画像値は千円なら整合するが、単位ラベルと月見出しは不整合 | fixture と表示単位の検算を spec に残す |
| qa-statements-maintenance-ops-web-002 | 既存テストは更新し、旧実装で落ちることを確かめる | 旧テストを削除して新規に書く | 何を固定していたかを失わない | 更新前に旧実装で赤になることを記録する |
| qa-statements-maintenance-ops-web-002 | 区分対応表と計算式を docs/data-schema.md に置く | コードのコメントだけ | 税理士・利用者が読める場所に規則を残す | 表を変えるときは docs とテストを同時に変える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の ci.yml。
- Migration sequence: 契約テスト (赤) → core 実装 (緑) → API テスト → DOM テスト → docs。
- Rollback trigger/procedure: CI が赤ならマージしない。

## Risks and verification

- Risk/assumption: 0 件の違反と 0 件しか調べていないことを取り違える。件数を固定したテストにする。
- Architecture fitness test: statements-contract.test.ts に恒等式の全月検査があること。
- Load/failure/security validation: CI の全ジョブ。
