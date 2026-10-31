---
graph_node_id: "arch-tradeoff-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "トレードオフ — pages/tradeoff/ へ分割し、数字は core の試算関数の結果だけを読む"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "frontend"]
file_path: "architecture/tradeoff-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "8b1f93d9cb74bac83fab5cc5db7d9f5f3320b4b55152f486e05b2939ecf2a386"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "8b1f93d9cb74bac83fab5cc5db7d9f5f3320b4b55152f486e05b2939ecf2a386", "imported_at": "2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Tradeoff.tsx", "packages/web/src/pages/tradeoff", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/api.ts", "packages/web/src/period.tsx", "packages/web/src/tradeoff-review.dom.test.tsx"]
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
classification_reason: "system-spec の frontend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/tradeoff-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:35:02Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---
# Architecture overview

> 本書は spec から生成した領域別投影であり、規則の正本ではない。差異は `specs/spec-tradeoff-screen.md` を優先し、spec 変更後に再生成・同期する。

トレードオフ — pages/tradeoff/ へ分割し、数字は core の試算関数の結果だけを読む。`system-spec/frontend.md` は承認時入力、本書は部品の分割・状態・データ取得の制約を持つ。正本は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen)。

## Context and drivers

- Business/technical context: 現行 `Tradeoff.tsx` は 1 ファイルで計算を画面内のインラインに持ち、lazy import (`AuthenticatedApp.tsx:35`) で読まれる (qa-tradeoff-frontend-web-evidence-001)。
- Quality attribute priorities: G1〜G4。Dependency Rule (core ← api ← web)。
- Constraints: React 18 + react-router-dom 7 + TanStack Query 5、`usePeriod` (`packages/web/src/period.tsx:121`)、初期 JS 予算。

## Goals and non-goals

- Goals:
  - G1: `pages/tradeoff/` へ ページ本体・新しい支出のフォーム・候補表・推奨の表・試算結果パネル・計算例・選択中バー を分ける。
  - G2: 数字は core の試算関数の結果だけを読み、画面で計算しない。
  - G3 / G4: 上書きと記録は `useMutation`、成功時に tradeoff の query だけを無効化する (qa-tradeoff-frontend-web-001)。
- Non-goals:
  - 画面での候補の集計・必要度の推定
  - lazy import の廃止

## System context and boundaries

- Users/external systems: 利用者。API は `/api/tradeoff` の 3 経路。
- Trust/deployment/data boundaries: web は core を import して試算と推奨を同期的に計算する。POST ではサーバが同じ関数で再計算するので、web の値は表示用に限る。
- Context diagram: `system-spec/index.md`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `pages/tradeoff/TradeoffPage` | query・入力と選択の状態・復元 | React | packages/web | 静的配信 |
| `NewExpenseForm` | 5 入力 | React | packages/web | 静的配信 |
| `CandidateTable` | 検索・絞込・選択・上書き | React | packages/web | 静的配信 |
| `RecommendationTable` | 推奨 4 件と理由・リンク | React | packages/web | 静的配信 |
| `SimulationPanel` / `CalcExamples` | 試算結果と計算例 | React | packages/web | 静的配信 |
| `SelectionBar` | 選択中バーと記録 | React | packages/web | 静的配信 |
| query `['tradeoff', 期間]` | GET の結果 | TanStack Query | packages/web | 静的配信 |

## Cross-cutting contracts

- Identity/access: 既存の認証済みレイアウトの内側 (`architecture/tradeoff-auth.md`)。
- Errors/resilience: 422 は query を取り直して文を出し入力を保持する。上書きの失敗は行を元の値へ戻す。
- Observability/audit: N/A。
- Configuration/secrets: N/A。
- Compatibility/versioning: `TradeoffPage` の export 名を保ち lazy import を変えない。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

ページ本体が query と画面状態を持ち、子は props だけで描画する。

#### Routes, screens and navigation

`/tradeoff` の 1 経路。関連ページは `nextAction.to` へのリンク。

#### Component and design-system boundaries

PageShell / PageHeader / PageState / PageActions、共通 Button、トークンだけ。選択中バーは SelectionBar の流儀。

#### State and data flow

入力と選択 (候補キーの集合) は `useState`。初回取得時に `latest` から復元する。試算・推奨は core の関数へ入力・選択・候補を渡して得る。開始月は計算に渡さない (`specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) FR-3)。

#### Backend integration

GET `/api/tradeoff`、PUT `/api/tradeoff/candidates/:key`、POST `/api/tradeoff`。期間は `usePeriod` の値を query に付ける。

#### Performance and observability

lazy import を維持し、初期 JS 予算を超えない。組み合わせの列挙は core 側で最大 781 通り。

#### Frontend verification

DOM テスト (全構成要素・状態・3 か所の値の一致・復元・422 の文)。`tradeoff-review.dom.test.tsx` は突合の表示が無いことを確かめる形へ書き換える (qa-tradeoff-decision-004、書き換えの判断は agent 推定・利用者未確認)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-tradeoff-frontend-web-001 | `pages/tradeoff/` へ分割する | 1 ファイルのまま拡張 | 部品ごとにテストできる | import 先が変わる |
| qa-tradeoff-frontend-web-001 | 数字は core の関数だけから読む | 画面内のインライン計算 | 3 か所の値がずれない | web が core の関数を import する |
| qa-tradeoff-frontend-web-001 | mutation 成功時に tradeoff の query だけ無効化 | 楽観的更新 | サーバの再計算値が正になる | 保存後に 1 回取り直す |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルド。
- Migration sequence: 部品の新設 → ページの置き換え → 旧実装の削除。
- Rollback trigger/procedure: DOM テスト・JS 予算が落ちたら差し戻す。

## Risks and verification

- Risk/assumption: 復元時に現在の候補に無いキーが残る。選択から外して件数を文で示す (agent 推定・利用者未確認)。
- Architecture fitness test: web に試算の式が無い (grep)。
- Load/failure/security validation: `dangerouslySetInnerHTML` を使わない (`architecture/tradeoff-security.md`)。
