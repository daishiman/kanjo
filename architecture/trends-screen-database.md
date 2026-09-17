---
graph_node_id: "arch-trends-screen-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "推移画面 — 既存 Dataset からの導出 (スキーマ変更なし)"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "database"]
file_path: "architecture/trends-screen-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "23c099c1af644a519c10d6769fa6baa464663b7f6e69333ccbd8284bd7699d59"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "23c099c1af644a519c10d6769fa6baa464663b7f6e69333ccbd8284bd7699d59", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["spec-trends-screen", "arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
resource_scope: ["packages/api/src/db/schema.ts", "packages/api/src/dataset.ts", "packages/core/src/period.ts"]
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
classification_reason: "system-spec の database 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/trends-screen-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:18:41Z"}
serves_goals: ["G3", "G4"]
---

# Architecture overview

推移画面 — 既存 Dataset からの導出 (スキーマ変更なし)。正本は `system-spec/database.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-trends-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-database-web-trends-observed-002。推移の系列・比較・カテゴリ行・取引先行・説明文は、loadReviewSources が D1 から読む既存の Dataset (MfTx の m・d・c・a・big・mid・inst、事業/家計の区分) と freee 系 4 表 (freee_deals・duplicate_verdicts・freee_deal_exclusions・mf_tx_exclusions) から、総収支と同じ規則で毎回導出できる (qa-trends-decision-008)。説明文は規則で生成し保存しないため、新しい表も migration も足さない (最新は 0042)。
- Quality attribute priorities: G3・G4 に資する。doctrine は Clean Architecture のデータアクセス: 読取りは loadDataset の 1 経路に限り、core には D1 を知らない配列だけを渡す (cloudflare-d1-limits の範囲内)。
- Constraints: C5: スキーマ変更が不要なら migration を足さない。

## Goals and non-goals

- Goals:
  - G3: 今回と比較期間を同じ Dataset から切り出す。
  - G4: /classify の絞込は既存の明細の列 (big・mid・c) で行い、freee 由来の行は総収支画面へ渡す。
- Non-goals:
  - 新しい表・列・索引
  - 集計値や説明文の保存
  - バックアップ対象の変更

## System context and boundaries

- Users/external systems: api の loadReviewSources (内部で loadDataset を含む) だけが D1 を読む。
- Trust/deployment/data boundaries: D1 は userId で絞って読む。書込は無い。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| loadReviewSources | D1 から Dataset と freee 系 4 表を userId で絞って読む | api | D1 (既存表) | Worker kanjo-console |
| totalCashflowReport | MF と freee の消し込み後の行を返す | core | D1 (既存表) | Worker kanjo-console |
| applyPeriod / sliceDataset | 月範囲で Dataset を切る | core | D1 (既存表) | Worker kanjo-console |

## Cross-cutting contracts

- Identity/access: 既存の authGuard と mustChangePasswordFence の内側に置き、データは userId で絞る (arch-trends-screen-auth)。
- Errors/resilience: 月は YYYY-MM の文字列で扱う。カテゴリは事業=freee の accountNorm、家計=MF の big。取引先は MF=MfTx.c、freee=FreeeDeal.partner の文字列そのもの。
- Observability/audit: 既存の requestId とエラーログに従う。推移は読取専用で、監査記録の対象になる書込みは増えない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/trends は応答フィールドの追加だけで、既存の傾向判定のフィールドと値を残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: 下記 architecture-data.md を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

明細 (MF 取込)・freee_deals・総収支の判定表 (duplicate_verdicts・freee_deal_exclusions・mf_tx_exclusions) は既存の所有のまま。推移は読むだけ。

#### Logical and physical model

物理モデルは変えない。論理モデルとして core に MetricDefinition と推移の返却型を足す。

#### Access and consistency

1 リクエストで 1 回だけ読み、同じスナップショットから今回と比較期間を作るので両者は常に一致する。

#### Lifecycle and governance

集計値を保存しないため、明細の削除や再取込はそのまま推移に反映される。

#### Migration and recovery

N/A: migration は無い。バックアップ・復元の対象表と手順は変わらない。

#### Data verification

core のテストで、行の今回合計の和が指標の期間合計と一致すること、総合=事業+家計を確認する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-DB-1 | スキーマを変えない | 根拠と比較案は qa-database-web-trends-observed-002 を参照 | qa-database-web-trends-observed-002 の判断に従う | 本書の該当節に反映済み |
| ADR-DB-2 | 説明文を保存しない | 根拠と比較案は qa-trends-decision-002 を参照 | qa-trends-decision-002 の判断に従う | 本書の該当節に反映済み |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console を ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: migration を伴わない。migrate.yml は動かない。戻すときもデータの巻き戻しは要らない。
- Rollback trigger/procedure: テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は無いのでデータの巻き戻しは要らない。

## Risks and verification

- Risk/assumption: 比較期間の追加読込 → 対策: 総収支 API と同じ 1 回の読込を再利用し D1 への問い合わせを増やさない
- Risk/assumption: 取引先の表記ゆれ → 対策: 名寄せしないことを docs に明記する (qa-trends-decision-004)
- Architecture fitness test: core のテストで、行の今回合計の和が指標の期間合計と一致すること、総合=事業+家計を確認する。
- Load/failure/security validation: pnpm verify:full (test・typecheck・lint・build・視覚検査) を緑に保つ。
