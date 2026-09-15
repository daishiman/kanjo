---
graph_node_id: "arch-overview-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "概況画面改善 — O1-O5 の検査配置と切り分け手順"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "maintenance-ops"]
file_path: "architecture/overview-screen-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "5c91135a45bd3b515e85dc02da29b2f1b58ded542aa5b29a7ba6c88ca7419168"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "5814ff8f9bef10523ee781cf4b49516e1887472b3feaf30ab2693abce081228c", "imported_at": "2026-09-15T00:18:48Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-15T00:18:48Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-backend", "arch-overview-database", "arch-overview-auth", "arch-overview-security", "arch-overview-infrastructure"]
resource_scope: [".github/workflows/ci.yml", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/scripts/viewports.mjs", "packages/api/src/improvement-backup-exclusion.test.ts", "packages/web/src/common-shell-routes.dom.test.tsx", "packages/web/src/defense-forecast.dom.test.tsx", "docs"]
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
classification_reason: "system-spec の maintenance-ops 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。章の関心に合わせて subtype を infrastructure とし、architecture-infrastructure.md の節を Subtype architecture 節へ合成した。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/overview-screen-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# Architecture overview

概況画面改善 — O1-O5 の検査配置と切り分け手順。正本は `system-spec/maintenance-ops.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-overview-screen.md`。

## Context and drivers

- Business/technical context: `.github/workflows/ci.yml` は static-checks / test-core-web / test-api / build の 4 ジョブ。`packages/web/scripts/check-financial-visuals.mjs` の Overview は expectedFigures 1 で 4 幅だけを描画しており、`packages/web/scripts/viewports.mjs` の VIEWPORT_CASES (320/360/375/390/768/1280/1600/zoom200 の 8 ケース) を使っていない。`packages/api/src/improvement-backup-exclusion.test.ts` は新テーブルの入れ忘れを落とさない。Overview を描画する DOM テストは `packages/web/src/defense-forecast.dom.test.tsx` だけで、`packages/web/src/common-shell-routes.dom.test.tsx` は概況をスタブにしている。
- Quality attribute priorities: G1, G2, G3, G4 に資する。O1-O5 の各検査を落ちるべき実装で落ちる場所に置くことと、件数ずれが起きたときの切り分けの速さを最優先にする。
- Constraints: 利用者 1 名と保守エージェントで運用する。CI の headless Chrome は pointer:none (C6)。fixture は匿名・架空。

## Goals and non-goals

- Goals:
  - G1: O1 を core 単体テストに置く。
  - G2: O2 を DOM テスト (件数一致) と core 単体テスト (指紋) に、O5 を core 単体テストに置く。
  - G3: O3 を API テスト (バックアップ→全消去→復元の往復) に置く。
  - G4: O4 を描画検査に置き、Overview を VIEWPORT_CASES の 8 幅へ移す。
- Non-goals:
  - 新しい監視基盤や SLO の導入
  - 他画面の描画検査の変更

## System context and boundaries

- Users/external systems: GitHub Actions の CI と保守エージェント。
- Trust/deployment/data boundaries: 検査は CI 内で完結し、本番データを使わない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 単体テスト | O1、O2 の指紋、O5 | vitest | packages/core | CI test-core-web |
| DOM テスト | O2 の 3 か所の件数一致と同時減少、期間不変 | vitest + jsdom | packages/web | CI test-core-web |
| API テスト | O3 の往復、入力検証、冪等、401 | vitest | packages/api | CI test-api |
| 描画検査 | O4 の表示順・広幅 3列/2列・横はみ出しなしを 8 幅で観測 | check-financial-visuals.mjs | packages/web | CI build |
| 切り分け手順 | 件数ずれと幅の特定 | docs | docs | リポジトリ |

## Cross-cutting contracts

- Identity/access: N/A: 検査は認証情報を扱わない (API テストは既存のテスト用認証に従う)。
- Errors/resilience: 検査の失敗は CI のジョブ失敗で止める。
- Observability/audit: CI のジョブ結果と描画検査の screenshot を証跡にする。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存の CI ジョブ構成を変えず、検査を足すだけにする。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

CI (GitHub Actions) の 4 ジョブを使い、検査を core / DOM / API / 描画の 4 系統へ振り分ける。

#### Compute and storage

CI ランナーの中で完結する。描画検査の screenshot は既存の成果物の扱いに従う。

#### IaC and delivery

ci.yml のジョブ定義は変えず、各ジョブが実行するテストと check-financial-visuals.mjs の Overview 設定 (VIEWPORT_CASES の 8 幅、expectedFigures を図の数に合わせる) を更新する。

#### Secrets and access

N/A: 新しい秘密情報や権限を追加しない。

#### Reliability and recovery

件数ずれの切り分け手順を docs に残す: (1) API 応答の件数を確かめる、(2) React Query のキー共有 (['review-queue']) を確かめる、(3) 保留の内容指紋を確かめる。描画の崩れは screenshot のファイル名から幅を特定する方法を同じ docs に残す。

#### Infrastructure verification

O1-O5 の検査がそれぞれ旧実装 (事業のみの概況、期間に依存する件数、バックアップ対象外のテーブル、4 幅の描画、根拠なしで推奨を出す実装) で落ちることを確かめてから緑にする。

## Architecture decisions

決定本文・代替案・帰結の正本は `system-spec/00-requirements-definition.md` の決定表。本章は 4 件の決定 (dec-overview-aggregation-scope、dec-overview-legacy-elements、dec-recommendation-confidence-source、dec-review-state-storage) の帰結を検査へ写す位置だけを記録する。

## Delivery, migration and rollback

- Build/deploy topology: ci.yml の 4 ジョブを通った変更だけを deploy.yml で配信する。
- Migration sequence: 検査を先に足して旧実装で落ちることを確かめ、実装を入れて緑にする。描画検査の Overview を VIEWPORT_CASES へ移すのは作り替えと同じ PR で行う。
- Rollback trigger/procedure: 検査の緩和で緑にしない。検査が落ちたら実装側を差し戻す。

## Risks and verification

- Risk/assumption: improvement-backup-exclusion.test.ts が新テーブルの入れ忘れを検出しないため、O3 の往復テストが唯一の防壁になる。
- Architecture fitness test: 4 系統の検査が CI の既存ジョブで毎回実行されること。
- Load/failure/security validation: 描画検査で 320px の Reflow と zoom200 を含む 8 幅を通し、fixture が security:content を通ることを確かめる。
