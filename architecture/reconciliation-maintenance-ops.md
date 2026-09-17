---
graph_node_id: "arch-reconciliation-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "照合画面 — 判定規則の境界値テストと回帰検査"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation", "maintenance-ops"]
file_path: "architecture/reconciliation-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-16-reconciliation/completeness-findings.json", "evaluated_digest": "8d99018c173d997d4371e57fbea80afd8d66a3ea442d85b108d2e1db7dbcdc1c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-16-reconciliation/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "8d99018c173d997d4371e57fbea80afd8d66a3ea442d85b108d2e1db7dbcdc1c", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-infrastructure"]
resource_scope: ["package.json", "packages/web/package.json", ".github/workflows/ci.yml", "packages/web/scripts/check-mobile-layout.mjs", "packages/web/scripts/check-financial-visuals.mjs", "docs/data-schema.md", "packages/core/test/expense-projection.test.ts", "packages/api/test/total-cashflow-verdict.integration.test.ts", "packages/web/src/reconciliation.dom.test.tsx", "packages/web/src/route-icon-distinct.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/reconciliation-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G2", "G4", "G5"]
---

# Architecture overview

照合画面 — 判定規則の境界値テストと回帰検査。`system-spec/archive/2026-09-16-reconciliation/maintenance-ops.md` は承認時入力、本書は運用制約を持つ。現行の機能仕様の正本は `specs/spec-reconciliation.md`。

## Context and drivers

- Business/technical context: ルート package.json の verify:full は pnpm test → typecheck → lint → build → web の check:thead / check:mobile-layout / check:financial-figure / check:financial-routes / check:analysis-hub → preview:smoke。lint は biome・check-glossary・check-design-tokens・check-design-system-document-contract・check-graph-lineage 等を束ねる。更新対象のテストは reconciliation.dom.test.tsx・analysis-tabs / analysis-hub / analysis-navigation の DOM テスト・route-icon-distinct.test.tsx・core expense-projection.test.ts・api total-cashflow-verdict.integration.test.ts・shell 系 DOM テスト。docs/data-schema.md:120-124 の自動照合・要確認の記述は一致度規則とキュー分類を入れた時点で古くなる。e2e テストは無い (qa-maintenance-ops-web-rc-observed-001)。
- Quality attribute priorities: G2・G4・G5 に資する。Clean Code の『規則は名前と境界値テストで読めるようにする』を適用し、規則を変えるとテストが落ちる状態を保守の停止条件にする。
- Constraints: 利用者 1 名が保守し、コーディングエージェントが実装する (C5)。

## Goals and non-goals

- Goals:
  - G2: 一致度・キュー 4 分類・ステータス・解消率 (分母 0)・月次クローズの自動 3 ステップを、docs の文言と同じ名前の core テストで境界ごとに固定する。
  - G4: サイドバー文言変更に伴う DOM テストと docs/data-schema.md を同じ変更で更新する (qa-reconciliation-decision-004)。
  - G5: route-icon-distinct テストを維持する。
- Non-goals:
  - e2e テスト基盤の新設
  - 新しい CI ワークフローの追加

## System context and boundaries

- Users/external systems: 保守者 (利用者とコーディングエージェント) と GitHub Actions。
- Trust/deployment/data boundaries: 検査はリポジトリ内のテストと check 系スクリプトで完結する。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core reconciliation テスト | 内容類似の値・しきい値境界・キュー条件の各辺・内容点を固定する | vitest | packages/core | CI |
| API 統合テスト | 照合操作・取消・一括上限・月次レビュー | vitest | packages/api | CI |
| web DOM テスト | 照合画面・タブ・ハブ・ナビゲーション・shell・アイコン重複 | vitest + DOM | packages/web | CI |
| check:financial-routes / check:mobile-layout | /analysis/reconciliation を含めて狭幅の横スクロールを検査する | node スクリプト | packages/web | CI |
| docs/data-schema.md | 一致度・キュー・ステータス・月次クローズ判定と Dice の限界を記す | Markdown | docs | リポジトリ |

## Cross-cutting contracts

- Identity/access: N/A: 検査に認証情報を追加しない。
- Errors/resilience: verify:full のいずれかが落ちたら変更を止める。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存ルートと旧 URL のテストを緑に保つ (S4)。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

ローカルと GitHub Actions の CI で同じ verify:full を回す。

#### Compute and storage

N/A: 検査のための計算資源・ストレージを追加しない。

#### IaC and delivery

check:financial-routes / check:mobile-layout の対象に /analysis/reconciliation を含める。既存 ci.yml の経路を使う。

#### Secrets and access

N/A: 秘密情報を追加しない。

#### Reliability and recovery

推定 qa-maintenance-ops-web-rc-inference-003 に基づき core テストで固定する: (1) 内容類似の値 = 同一文字列 1.0、共通 bigram 無し 0 (Amazon.co.jp とアマゾンは 0 で、カナと英字の表記違いを拾わない限界を docs/data-schema.md に明記)、ヤマト運輸 / ヤマト運輸株式会社 0.67、東京電力 / 東京ガス 0.33。(2) しきい値の境界 = ちょうど 0.5 は『似ている』、0.5 未満は『似ていない』を、金額の差異キューへの所属と一致の理由の内容行のチェック有無の両方で確認。(3) 日付差 3 日と 4 日、金額一致と不一致を組み合わせ、金額の差異キューの条件 (±3 日かつ類似 0.5 以上かつ金額不一致) の各辺を 1 つずつ外すと所属が外れること。(4) 内容点が 内容類似×20 の連続値であること (0.67 → 13.4 点の扱いは実装時に丸め規則を docs に書いて固定)。

#### Infrastructure verification

pnpm test / typecheck / lint と packages/web の check 系が全て緑 (S6)。規則を変えると core テストが落ちること。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-reconciliation-decision-003 | 一致度を単純な加点規則にし docs とテストで固定する | 一致度を出さない | 規則を名前と境界値で読める | 規則変更時にテストと docs を同時に直す |
| qa-reconciliation-decision-004 | サイドバー文言もバッジも揃える | バッジだけ / 照合子行だけ | 画像と一致させる | shell 系・タブ系 DOM テストの文言を更新する |

## Delivery, migration and rollback

- Build/deploy topology: 既存 ci.yml。
- Migration sequence: docs/data-schema.md の規則更新 → core 境界値テスト → API 統合テスト → DOM テスト更新 → check 系の対象追加。
- Rollback trigger/procedure: verify:full が落ちたら変更を差し戻す。

## Risks and verification

- Risk/assumption: 固定値の選定はアシスタントの推定 (inference-003)。丸め規則・Dice の重複 bigram の数え方・0.5 ちょうどの比較方法は実装時に決める (completeness-findings low)。
- Architecture fitness test: docs に書いた規則名と core テスト名が対応していること。
- Load/failure/security validation: e2e が無いため、画像との差は DOM テストと check:financial-routes / check:mobile-layout で検査する。
