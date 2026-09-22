---
graph_node_id: "arch-tradeoff-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "トレードオフ — 規則を FR-09 の表と core の契約テストの期待値に 1 対 1 で置く"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "maintenance-ops"]
file_path: "architecture/tradeoff-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "e10c770f84aef936d92cf9a5beace59448148b1a1df69e7b5dc2bfdaa928614a"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "e10c770f84aef936d92cf9a5beace59448148b1a1df69e7b5dc2bfdaa928614a", "imported_at": "2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-infrastructure"]
resource_scope: ["package.json", "docs/spec-v1.1.md", "packages/core/test/tradeoff-review-contract.test.ts", "packages/core/test/diagnosis-detectors-contract.test.ts", "packages/api/src/schema-guard.test.ts", "packages/web/src/tradeoff-review.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/tradeoff-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:35:02Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---
# Architecture overview

> 本書は spec から生成した領域別投影であり、規則の正本ではない。差異は `specs/spec-tradeoff-screen.md` を優先し、spec 変更後に再生成・同期する。

トレードオフ — 規則を FR-09 の表と core の契約テストの期待値に 1 対 1 で置く。`system-spec/maintenance-ops.md` は承認時入力、本書は検証と記録の運用の制約を持つ。正本は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の「テストと受入条件」。

## Context and drivers

- Business/technical context: 既存テストは `packages/core/test/tradeoff-review-contract.test.ts`・`diagnosis-detectors-contract.test.ts`・`packages/web/src/tradeoff-review.dom.test.tsx` (突合の表示 3 件)。仕様は `docs/spec-v1.1.md` の FR-09 (P11 やりくり試算) にある (qa-tradeoff-maintenance-ops-web-evidence-001)。
- Quality attribute priorities: G1〜G5。O1〜O5 と S1〜S6 は本文を示して利用者が承認済み (qa-tradeoff-decision-012)。
- Constraints: typecheck・lint・テスト・初期 JS 予算を CI で緑にする。

## Goals and non-goals

- Goals:
  - G1〜G5: core・api・DOM のテストを足し、既存の core 契約テストを緑のまま残す (qa-tradeoff-maintenance-ops-web-001)。
  - 規則を FR-09 に表で書き、core のテストの期待値と 1 対 1 にする (qa-tradeoff-maintenance-ops-web-003、agent 推定・利用者未確認)。
- Non-goals:
  - 新しい計測基盤

## System context and boundaries

- Users/external systems: 保守者 (SH3) と CI。
- Trust/deployment/data boundaries: 期待値の正本は仕様書のフィクスチャ。画像の数値は期待値にしない。
- Context diagram: `system-spec/index.md`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 契約テスト | 試算・候補・推移・必要度・理由・推奨 | vitest | packages/core | CI |
| api テスト | 3 経路・上限・分離・復元・0050 | vitest | packages/api | CI |
| DOM テスト | 全構成要素・状態 | vitest + Testing Library | packages/web | CI |
| `docs/spec-v1.1.md` FR-09 | 規則の表 | Markdown | docs | リポジトリ |

## Cross-cutting contracts

- Identity/access: N/A。
- Errors/resilience: N/A。
- Observability/audit: テスト証跡。
- Configuration/secrets: N/A。
- Compatibility/versioning: 既存の core 契約テストを変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Operations architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Operations architecture

#### Fixture authority

期待値は O2 の 3 例と FR-09 の表。画像 (`15-tradeoff.png`) の金額・件数・取引先名はモックで期待値にしない。画像の差額の符号は誤りとして扱う (qa-tradeoff-decision-009)。

#### Documentation upkeep

FR-09 に 候補の作り方・推移・必要度 (010 / 011 と退けた案)・理由・推奨の順位・防衛ラインへの影響・開始月が計算に効かないこと を表で置く。

#### Regression scope

既存の `tradeoff-review-contract.test.ts` と `diagnosis-detectors-contract.test.ts` は緑のまま。`tradeoff-review.dom.test.tsx` は qa-tradeoff-decision-004 と両立しないため、突合の表示が無いことを確かめる形へ書き換える (agent 推定・利用者未確認)。

#### Operations verification

`verify:full` と初期 JS 予算。受入は実行済みの最新の証跡だけで判定する。

### Infrastructure architecture (運用の観点)

基盤そのものの構成は `architecture/tradeoff-infrastructure.md` が正本である。本節は検証と回帰の運用から見た制約だけを持つ。

#### Environments and topology

既存の CI (`.github/workflows/ci.yml`)。

#### Compute and storage

N/A。

#### IaC and delivery

migration の番号は 0050 を予定番号とし、マージ時点の最新 +1 に付け替える。

#### Secrets and access

N/A。

#### Reliability and recovery

テストが落ちたら差し戻す。

#### Infrastructure verification

`schema-guard.test.ts` の期待値の更新を同じ変更に含める。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-tradeoff-maintenance-ops-web-001 | 既存の core 契約テストを緑のまま残す | 置き換え | 既存の数字を守る (C5) | 新旧の関数が並ぶ |
| qa-tradeoff-maintenance-ops-web-003 | 規則を FR-09 に書く (agent 推定・利用者未確認) | 画面専用の docs | 既存の仕様書に集まる | FR-09 が長くなる |
| qa-tradeoff-decision-012 | O1〜O5 / S1〜S6 を受入の基準にする | 実装者の判断 | 利用者が本文で承認 | 基準の変更は利用者確認が要る |

## Delivery, migration and rollback

- Build/deploy topology: CI。
- Migration sequence: core テスト → api テスト → DOM テスト → docs。
- Rollback trigger/procedure: 既存テストが落ちたら差し戻す。

## Risks and verification

- Risk/assumption: 新旧どちらの実装でも通るテストを書く。旧実装 (現行 Tradeoff.tsx の月額同士の比較) で落ちることを確かめる。
- Architecture fitness test: web / api に試算の式が無い (grep)。
- Load/failure/security validation: N/A。
