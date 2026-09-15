---
graph_node_id: "arch-analysis-hub-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "支出分析ハブ — 判定規則の境界値テストと回帰検査"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub", "maintenance-ops"]
file_path: "architecture/analysis-hub-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "3b70d45717b2219eb2327b08c860cf16b240bacf2454fe230cb97a43eb6f5cea"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "3b70d45717b2219eb2327b08c860cf16b240bacf2454fe230cb97a43eb6f5cea", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure"]
resource_scope: ["package.json", "packages/web/package.json", ".github/workflows/ci.yml", "packages/web/scripts/check-mobile-layout.mjs", "packages/web/scripts/check-financial-visuals.mjs", "docs/ui-decisions.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/analysis-hub-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:23:44Z"}
serves_goals: ["G4"]
---

# Architecture overview

支出分析ハブ — 判定規則の境界値テストと回帰検査。正本は `system-spec/maintenance-ops.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-analysis-hub.md`。

## Context and drivers

- Business/technical context: ルートの verify:full は test → typecheck → lint → build → check:thead / check:mobile-layout / check:financial-figure / check:financial-routes → preview:smoke の順に回し、design-system:fast と lint の束がデザイン系の回帰を止める。CI は ci.yml。本サイクルはハブの判定規則 (優先度・マトリクス正常判定・改善余地・前期間比) を新設し、タブ label を短縮形に変えるため、規則の固定と既存テストの文言更新が保守の中心になる。
- Quality attribute priorities: G4 に資する。Clean Code の『規則は名前の付いた関数とテストで表す』を適用し、判定規則を docs に書いて core の境界値テストで固定する。規則を変えるとテストが落ちる状態を保守性の基準にする。
- Constraints: C1: 集計は core の純関数に置く。 C5: 保守は利用者本人とコーディングエージェント (SH2) が行う。

## Goals and non-goals

- Goals:
  - G4: 優先度・マトリクス正常判定・改善余地・前期間比の規則を docs に明記し、境界値テスト (要確認 0/1 件、未記録月 0/1、tradeoff 候補 0 件、前期間の欠け 0/1 か月) で固定する。
- Non-goals:
  - verify:full や CI の段の追加・順序変更
  - 5 タブ詳細画面のテストの作り直し
  - 実行時監視・アラートの追加

## System context and boundaries

- Users/external systems: 保守者 (SH2) と GitHub Actions。外部システムの追加は無い。
- Trust/deployment/data boundaries: 検証はローカルの pnpm と CI の ci.yml で行う。検査スクリプトは packages/web/scripts 配下にある。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 境界値テスト | ハブの判定規則を固定する | vitest | packages/core | CI |
| API 統合テスト | 認証付き 200 と期間メタを確かめる | vitest | packages/api | CI |
| DOM テスト (analysis-tabs / navigation-ux / common-shell-routes ほか) | タブ文言・バッジ・ハブ描画・focus を確かめる | vitest + DOM | packages/web | CI |
| check:mobile-layout / check:financial-routes | 狭幅レイアウトと金額表示の回帰を止める (対象に /analysis を含める) | Node スクリプト | packages/web | CI |
| docs の判定規則 | 規則の正本の説明 | Markdown | docs | リポジトリ |

## Cross-cutting contracts

- Identity/access: N/A: 保守のアクセス権を変えない。
- Errors/resilience: 規則を変えると境界値テストが落ち、文言を変えると DOM テストが落ちる。
- Observability/audit: 検証は CI のテストと check 系に置き、実行時の信号は追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存の verify:full の段と順序を維持する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

ローカルの pnpm と GitHub Actions の ci.yml。環境の追加は無い。

#### Compute and storage

N/A: 計算資源・保存先を追加しない。

#### IaC and delivery

verify:full の段 (test → typecheck → lint → build → check 系 → preview:smoke) を変えず、テストと検査対象の追加だけを行う。

#### Secrets and access

N/A: 秘密情報を扱わない。

#### Reliability and recovery

テストや check が落ちたら PR を差し戻す。規則の変更は docs とテストを同じ PR で更新する。

#### Infrastructure verification

check:financial-routes / check:mobile-layout の対象に /analysis が含まれ、狭幅でハブが横スクロールしないことを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-analysis-hub-decision-003 | 優先度・正常判定・改善余地を単純な規則で定義し docs とテストで固定する | 件数と前期間比だけにする | 規則を明文化すると保守者が判定の理由を追える | 境界値テストと docs を同時に保守する |
| qa-analysis-hub-decision-004 | 分析まわりだけ文言を短縮形に揃える | サイドバー全体も合わせる / 変えない | 更新する DOM テストを 3 つに限れる | analysis-tabs / navigation-ux / common-shell-routes を更新する |

## Delivery, migration and rollback

- Build/deploy topology: verify:full と ci.yml の既存順序のまま、新しいテストが同じ段で走る。
- Migration sequence: core の境界値テストと docs の規則 → API 統合テスト → DOM テストの新文言化と追加 → check 系の対象へ /analysis を追加。
- Rollback trigger/procedure: 既存テストが新文言以外の理由で落ちたら PR を差し戻す。スキーマ変更が無いので migration の巻き戻しは不要。

## Risks and verification

- Risk/assumption: design_applications がすべて agent-inference で、Clean Code などの適用は利用者確定ではない (completeness-findings low)。規則そのものは decision-003 を正本とする。
- Architecture fitness test: 規則の境界値を 1 つずらすと core テストが落ちること、旧文言に戻すと DOM テストが落ちること。
- Load/failure/security validation: 既存の pnpm test / typecheck / lint と check 系 (thead / mobile-layout / financial-figure / financial-routes) を緑に保つ (S6)。
