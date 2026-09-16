---
graph_node_id: "arch-reconciliation-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "照合画面 — 書込の許可リスト検証と取込との排他"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation", "security"]
file_path: "architecture/reconciliation-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "27d6303e5cf656d4286fa719941c7b912ad1f654de52595c7aeab9d15232ce25"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "27d6303e5cf656d4286fa719941c7b912ad1f654de52595c7aeab9d15232ce25", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/routes/total-cashflow.ts", "packages/web/src/pages/analysis/Reconciliation.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/reconciliation-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G3"]
---

# Architecture overview

照合画面 — 書込の許可リスト検証と取込との排他。`system-spec/security.md` は承認時入力、本書は security 制約を持つ。現行の機能仕様の正本は `specs/spec-reconciliation.md`。

## Context and drivers

- Business/technical context: index.ts は secureHeaders と requestId を全体に掛ける。書込系 route は zValidator で入力を検証する (総収支 verdicts は最大 200 件)。canonical-mutation-fence.ts の CANONICAL_MUTATION_ROUTES は取込 (POST /api/imports・/api/restore) と重なる書込を acquireImportWriter で排他し 409 canonical_write_busy を返すが、POST /api/total-cashflow/verdicts と freee-exclusions は対象外。照合は利用者本人の取引内容・金額を扱い外部サービスへ送らない (qa-security-web-rc-observed-001)。
- Quality attribute priorities: G3 に資する。Secure by Design の『入力を許可リストで検証する』『書込の競合を安全側に倒す』を適用する。OWASP Authorization Cheat Sheet を出典とする。
- Constraints: 外部送信しない方針を維持する。検索語は web の状態に留める。

## Goals and non-goals

- Goals:
  - G3: 照合の書込 (判断・除外・取消・月次レビュー完了) を許可リストで検証し、取込と重なる書込を 409 で拒否する。総収支 verdicts も同じ扱いに揃える。
- Non-goals:
  - 認証方式の変更 (auth 章)
  - 新しい検知・監視基盤の追加

## System context and boundaries

- Users/external systems: 利用者 1 名。取込 (imports / restore) が同じ D1 を書く並行の書き手。外部サービスへの送信は無い。
- Trust/deployment/data boundaries: 入力は zValidator の境界で一度だけ検証する。検索語と絞り込みは URL にもサーバーにも送らない。取引内容は React のテキストとして描画し innerHTML を使わない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| secureHeaders / requestId | 全体のセキュリティヘッダーと相関 ID | Hono middleware | packages/api | Worker |
| zValidator (照合 actions) | action の列挙・件数 1〜200・tx id と freee key の形を検証する | Hono validator | packages/api | Worker |
| canonicalMutationFence | 取込と重なる書込を 409 canonical_write_busy で拒否する | Hono middleware / CANONICAL_MUTATION_ROUTES | packages/api | Worker |
| 照合画面の描画 | 取引内容をテキストとして描画し、検索語を外へ出さない | React | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: auth 章の配置に従う。
- Errors/resilience: 入力検証違反は 400、取込との競合は 409 canonical_write_busy で、画面は『取込中のため保存できませんでした』と出し再試行できる。
- Observability/audit: 既存 requestId を使う。
- Configuration/secrets: N/A: 秘密情報を追加しない。
- Compatibility/versioning: POST /api/total-cashflow/verdicts と freee-exclusions も取込中は 409 を返すようになる。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者本人の取引内容・金額・照合判断。脅威は不正な入力による意図しない書込、取込中の書込で判断が消えかけの明細に結ばれること、取引内容がアクセスログや共有 URL に残ること、摘要文字列による表示の注入。

#### Identity and authorization

auth 章 (arch-reconciliation-auth) の配置に従い、本章では追加の認可判断を持たない。

#### Data and secret protection

外部サービスへ送信しない (画像フッター『取込データは外部送信しません』)。検索語は URL・サーバーへ送らない。

#### Application and supply-chain controls

POST /api/reconciliation/actions は zValidator で action を same / different / exclude-mf / exclude-freee の列挙に限り、件数 1〜200・tx id と freee key の形を検証する。照合の書込系 API を CANONICAL_MUTATION_ROUTES に加え、総収支 verdicts も揃える (qa-security-web-rc-decision-009)。取引内容は innerHTML を使わずテキストとして描画する。

#### Detection and response

N/A: 新しい検知を追加しない。409 は利用者に再試行を促す。

#### Security verification

API 統合テストで 201 件・列挙外 action・id 形式不正が 400、取込と重なった書込が 409 になることを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-security-web-rc-decision-009 | 照合の書込系を canonicalMutationFence の対象に追加し総収支 verdicts も揃える | 現行どおり排他しない | 取込で消えかけの明細に判断が結ばれる事態を防ぐ | 取込中は保存できず再試行が要る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker の middleware 設定と route を更新して配信する。
- Migration sequence: CANONICAL_MUTATION_ROUTES に照合書込と総収支 verdicts を追加 → zValidator のスキーマ → 統合テスト → 画面の 409 表示。
- Rollback trigger/procedure: 409 の誤発火や検証漏れのテスト失敗で PR を差し戻す。

## Risks and verification

- Risk/assumption: 総収支 verdicts の挙動が変わるため、total-cashflow-verdict の統合テストの追随が要る。
- Architecture fitness test: 照合の全書込 route が CANONICAL_MUTATION_ROUTES に含まれること。取引内容の描画に innerHTML が無いこと。
- Load/failure/security validation: 検索語がネットワーク要求に含まれないこと。
