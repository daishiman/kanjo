---
graph_node_id: "arch-trends-screen-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "推移画面 — 規則の文書化と検証の運用"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "maintenance-ops"]
file_path: "architecture/trends-screen-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "3c906ccdb9d21f270fdda80194bab35a91d2140e5e46ea119c92798dd2e63aea"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "3c906ccdb9d21f270fdda80194bab35a91d2140e5e46ea119c92798dd2e63aea", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["spec-trends-screen", "arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-infrastructure"]
resource_scope: ["docs/trends-screen.md", "packages/core/test/trend-contract.test.ts", "packages/core/test/trend-comparison.test.ts", "packages/web/src/pages/analysis/trends-scope.dom.test.tsx", "packages/web/src/pages/analysis/trends-screen.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/trends-screen-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:18:41Z"}
serves_goals: ["G5"]
---

# Architecture overview

推移画面 — 規則の文書化と検証の運用。正本は `system-spec/maintenance-ops.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-trends-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-maintenance-ops-web-trends-observed-002。計算規則 (増減額・増減率・構成比・寄与度・最大変化月・比較期間・説明文・数値の出所・要確認の明細を含めない規則・傾向の判定の基準・口座が空の行の扱い) を docs/trends-screen.md に表で書き、core の境界値テストと web の DOM テストで固定する。検証は pnpm verify:full。
- Quality attribute priorities: G5 に資する。doctrine は Google SRE の運用の単純さ: 規則を 1 か所 (docs) に書き、テストで破れを検出する。
- Constraints: C4: 既存テストを壊さない。期待値を更新する場合は理由をテストに残す。

## Goals and non-goals

- Goals:
  - G5: 規則表と境界値テストを揃え、指標の追加手順を docs に書く。
- Non-goals:
  - runbook の変更 (D1 の変更が無いため)
  - 監視の追加

## System context and boundaries

- Users/external systems: 保守者 (SH2)。
- Trust/deployment/data boundaries: docs と tests だけを増やす。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| docs/trends-screen.md | 規則表・指標の追加手順・URL の条件 | docs | リポジトリ (wrangler.jsonc・workflows) | Cloudflare Workers / GitHub Actions |
| core のテスト | 境界値と恒等式 | vitest | リポジトリ (wrangler.jsonc・workflows) | Cloudflare Workers / GitHub Actions |
| web のテスト | 画面構成と遷移 | vitest + jsdom | リポジトリ (wrangler.jsonc・workflows) | Cloudflare Workers / GitHub Actions |

## Cross-cutting contracts

- Identity/access: 既存の authGuard と mustChangePasswordFence の内側に置き、データは userId で絞る (arch-trends-screen-auth)。
- Errors/resilience: docs の規則表と core の定数名を一致させる。
- Observability/audit: 既存の requestId とエラーログに従う。推移は読取専用で、監査記録の対象になる書込みは増えない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/trends は応答フィールドの追加だけで、既存の傾向判定のフィールドと値を残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

ローカルの pnpm と CI。

#### Compute and storage

N/A: 運用上の計算資源やストレージの追加は無い。

#### IaC and delivery

pnpm verify:full (test・typecheck・lint・build・check:financial-figure などの視覚検査・preview:smoke) を通してから配信する。

#### Secrets and access

N/A: 新しい秘密は無い。

#### Reliability and recovery

D1 の変更が無いのでバックアップ・復元の手順と runbook は変わらない。

#### Infrastructure verification

既存の trend-contract.test.ts と trends-scope.dom.test.tsx が通り、新しい境界値テスト (要確認 0 件と 1 件以上・口座が空の freee 行を含む) が通ること。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-OPS-1 | 規則は docs の表とテストの両方で固定する | 根拠と比較案は qa-maintenance-ops-web-trends-observed-002 を参照 | qa-maintenance-ops-web-trends-observed-002 の判断に従う | 本書の該当節に反映済み |
| ADR-OPS-2 | 要確認の明細・傾向の判定の基準・口座が空の行の規則も docs の表に入れる | 根拠と比較案は qa-trends-decision-012〜014 を参照 | qa-trends-decision-012〜014 の判断に従う | 本書の該当節に反映済み |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console を ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: docs とテストはコードと同じ変更で入れる。
- Rollback trigger/procedure: テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は無いのでデータの巻き戻しは要らない。

## Risks and verification

- Risk/assumption: docs とコードのずれ → 対策: docs の規則表の各行に対応するテスト名を書く
- Risk/assumption: 既存テストの期待値の無断更新 → 対策: 更新理由をテストに残す
- Architecture fitness test: 既存の trend-contract.test.ts と trends-scope.dom.test.tsx が通り、新しい境界値テスト (要確認 0 件と 1 件以上・口座が空の freee 行を含む) が通ること。
- Load/failure/security validation: pnpm verify:full (test・typecheck・lint・build・視覚検査) を緑に保つ。
