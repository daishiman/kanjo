---
graph_node_id: "arch-tradeoff-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "トレードオフ — 候補・必要度・試算・推奨を core の純関数に置き、POST はサーバで再計算する"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "backend"]
file_path: "architecture/tradeoff-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "bea33a5eda7582bf617c4e922dede268af508d3701b261f70dc7f23961f01164"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "bea33a5eda7582bf617c4e922dede268af508d3701b261f70dc7f23961f01164", "imported_at": "2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
resource_scope: ["packages/core/src/analysis.ts", "packages/core/src/diagnosis-detectors.ts", "packages/core/src/index.ts", "packages/api/src/routes/analytics.ts"]
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
classification_reason: "system-spec の backend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/tradeoff-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:35:02Z"}
serves_goals: ["G2", "G3", "G4", "G5"]
---
# Architecture overview

> 本書は spec から生成した領域別投影であり、規則の正本ではない。差異は `specs/spec-tradeoff-screen.md` を優先し、spec 変更後に再生成・同期する。

トレードオフ — 候補・必要度・試算・推奨を core の純関数に置き、POST はサーバで再計算する。`system-spec/backend.md` は承認時入力、本書は規則の置き場所と API の制約を持つ。規則と契約の正本は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の「ビジネスルールと検証」と「API契約」。

## Context and drivers

- Business/technical context: GET `/api/tradeoff` (`packages/api/src/routes/analytics.ts:759`) は `tradeoffCandidates` (検知器の改善案を写したもの)・`budgets`・`plans`・`review` を返し、POST (805 行) はクライアントの `covered`・`verdict` をそのまま保存する (`tradeoffSchema` 796 行)。試算の計算は core に無い。`Dataset.biz.expense` は取引先を持たないが `FreeeDeal` は `partner` と `accountNorm` を持つ (qa-tradeoff-backend-web-evidence-001)。
- Quality attribute priorities: G2〜G5。決定論と単一の正本。
- Constraints: core は依存ゼロの純関数。既存の `defenseLine`・`tradeoffCandidates`・`tradeoffReview` の数字を変えない (C5)。LLM を呼ばない。

## Goals and non-goals

- Goals:
  - G2: 試算 (年額・差額・単発の計上・防衛ラインへの影響) を core の 1 関数にする (qa-tradeoff-decision-005 / 009)。開始月は入力に取らない。
  - G3: 候補集計・推移・必要度 (qa-tradeoff-decision-010 / 011)・理由・関連ページを core に置く。
  - G4: 推奨の列挙・評価・順位・理由を core に置く (qa-tradeoff-backend-web-003、agent 推定・利用者未確認)。
  - G5: POST はサーバで再計算し、PUT で上書きを upsert する (qa-tradeoff-backend-web-004、agent 推定・利用者未確認)。
- Non-goals:
  - 候補の保存・検知器の改善案に当たった候補の必要度の引き下げ (qa-tradeoff-decision-011 で取り消し)
  - 既存関数の数字の変更

## System context and boundaries

- Users/external systems: web のみ。
- Trust/deployment/data boundaries: core は D1 を知らず、`FreeeDeal[]`・`Dataset`・上書きの配列・入力を受け取る。route が D1 を読み書きする。
- Context diagram: `system-spec/index.md`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 候補集計 | 終了月から 3 か月・科目×取引先・月額 ≥1,000・最大 50 件・推移 | 純関数 | packages/core | 同一 Worker |
| core 必要度 | catProfile の type と推移 (010)、上書き優先 | 純関数 | packages/core | 同一 Worker |
| core 理由と関連ページ | `claimPart` 正規化で claimKeys と照合、label と nextAction.to | 純関数 | packages/core | 同一 Worker |
| core 試算 | 年額・差額・verdict・covered・防衛ライン余裕・試算後 | 純関数 | packages/core | 同一 Worker |
| core 推奨 | 上位 12 件から 2〜4 件、5 段の順位、上位 4 件 | 純関数 | packages/core | 同一 Worker |
| `GET /api/tradeoff` | candidates・defense・latest | Hono route | packages/api | Worker |
| `POST /api/tradeoff` | keys の照合・再計算・1 行追加 | Hono route | packages/api | Worker |
| `PUT /api/tradeoff/candidates/:key` | 上書きの upsert / 削除 | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 既存 `/api/*` のフェンス (`architecture/tradeoff-auth.md`)。
- Errors/resilience: zod 不適合 400、未知の候補キー 422、不変条件の違反 500 で保存しない。
- Observability/audit: N/A: 新しい信号を足さない。記録の行が履歴を兼ねる。
- Configuration/secrets: N/A。
- Compatibility/versioning: POST の入力の形が変わる (呼び出し元は web だけ)。GET から `budgets`・`plans`・`review` を外す (agent 推定・利用者未確認)。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Backend architecture

#### Runtime and architecture pattern

判定は core、入出力は api。必要度は上から順に 固定費×(横ばい・増加) = 高 → スポット = 低 → 減少 = 低 → それ以外 = 中 (qa-tradeoff-decision-010)。検知器に当たっても下げない (qa-tradeoff-decision-011)。退けた案: 010 (b)(c)、011 (b)(c)。

#### Domain and module boundaries

`catProfile` (`analysis.ts:57`) を再利用し閾値を複製しない。`claimPart` (`diagnosis-detectors.ts:112`) を export して正規化を 1 か所にする (qa-tradeoff-backend-web-005)。候補キーの組み立ても core の 1 関数。

#### API and service contracts

契約は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の 3 経路。`covered` は選んだ候補の月額合計 (円/月、`tradeoffReview` と同じ意味)。`verdict` は差額 ≤0 で `covered`、正で `insufficient`。差額・verdict・covered は導出値で POST では受け取らない (qa-tradeoff-backend-web-004 / 005)。

#### Data and transaction behavior

POST は 1 回の INSERT (押すたびに追加、qa-tradeoff-decision-008)。PUT は 1 文の upsert か削除。列の定義は `architecture/tradeoff-database.md`。

#### Async processing

N/A: キューや遅延処理は無い。

#### Security and resilience

保存前に `covered` を 0〜1e10 の整数で確かめる (qa-tradeoff-security-web-005)。詳細は `architecture/tradeoff-security.md`。

#### Operations and verification

core の契約テスト (O2 の 3 例、推移の境界、必要度の 4 行、推奨の決定論) と api テスト (3 経路の Contract tests)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-tradeoff-decision-010 | 固定費で横ばい・増加 = 高、スポットか減少 = 低、他は中 | (b) 固定費横ばいのみ高 / (c) 推移を見ない | 利用者の感覚に合う | catProfile の type に依存する |
| qa-tradeoff-decision-011 | 検知器で必要度を下げず理由とリンクにだけ使う | (b) 一部の検知器で 1 段下げる / (c) 全検知器で 1 段下げる | fixed_cost_review が固定費全般に当たり必要度が崩れない | 003 / 004 の引き下げ規則を取り消す |
| qa-tradeoff-backend-web-004 | POST をサーバで再計算する (agent 推定・利用者未確認) | クライアント値を保存 | 保存値が改ざんされない | POST にも期間の query が要る |
| qa-tradeoff-backend-web-005 | claimPart を export して共有 (agent 推定・利用者未確認) | 候補側で別に正規化 | 照合の食い違いが起きない | 診断の検知器のテストを緑に保つ |
| qa-tradeoff-backend-web-003 | 推奨は上位 12 件から 2〜4 件・5 段の順位 (agent 推定・利用者未確認) | 全候補の全組み合わせ | 最大 781 通りで決定論 | 13 位以下は推奨に出ない |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と packages/core のビルド。
- Migration sequence: core の関数 → migration 0050 → GET / PUT / POST の置き換え → web。
- Rollback trigger/procedure: core / api テストが落ちたら差し戻す。列と表は追加だけなので旧 Worker に戻しても壊れない。

## Risks and verification

- Risk/assumption: `defenseLine` の値がヘッダーのバッジと食い違う。`/api/defense-line` と同じ `loadScoped` と関数を使う。
- Architecture fitness test: core が D1 / Hono の型を参照しない。web / api に試算の式が無い (grep)。
- Load/failure/security validation: 組み合わせは最大 781 通りで Worker の CPU 時間に収まることを core テストで確かめる。
