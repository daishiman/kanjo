---
graph_node_id: "arch-tradeoff-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "トレードオフ — zod の上限とサーバ再計算でクライアントの計算値を信用しない"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "security"]
file_path: "architecture/tradeoff-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "8da2d2e7da29edfc641f8cf35d24f685165fe0f323749a7b78a769ac70d5274e"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "8da2d2e7da29edfc641f8cf35d24f685165fe0f323749a7b78a769ac70d5274e", "imported_at": "2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/core/src/diagnosis-detectors.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/tradeoff-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:35:02Z"}
serves_goals: ["G5"]
---
# Architecture overview

> 本書は spec から生成した領域別投影であり、規則の正本ではない。差異は `specs/spec-tradeoff-screen.md` を優先し、spec 変更後に再生成・同期する。

トレードオフ — zod の上限とサーバ再計算でクライアントの計算値を信用しない。`system-spec/security.md` は承認時入力、本書は入力検証と保存値の制約を持つ。正本は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の「API契約」。

## Context and drivers

- Business/technical context: 現行 `tradeoffSchema` (`analytics.ts:796`) は `covered` と `selected.value` を上限なしの整数で受け、`verdict` もクライアントの値を保存する (qa-tradeoff-security-web-evidence-001)。
- Quality attribute priorities: G5。OWASP ASVS 5.0.0 の入力検証。
- Constraints: zod、`bodyLimit` (`packages/api/src/index.ts:89`)、React の既定エスケープ。外部へ送信しない。

## Goals and non-goals

- Goals:
  - G5: 支出名 100・メモ 500・候補メモ 500・キー 300・金額 1〜1e8 の整数・YYYY-MM・keys 最大 50・上書き 1 回 1 候補 (qa-tradeoff-security-web-003、agent 推定・利用者未確認)。
  - G5: POST の zod から `covered`・`verdict`・`value` を外し、サーバの再計算値だけを保存する (qa-tradeoff-security-web-004 / 005)。
- Non-goals:
  - LLM・外部送信
  - `dangerouslySetInnerHTML`

## System context and boundaries

- Users/external systems: 利用者のブラウザ。
- Trust/deployment/data boundaries: クライアントは信用しない。保存値はサーバの core 計算だけ。
- Context diagram: `system-spec/index.md`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| POST の zod スキーマ | 支出の条件と keys だけを受ける | zValidator | packages/api | Worker |
| PUT の zod スキーマ | need と memo | zValidator | packages/api | Worker |
| 候補キーの照合 | 現在の候補に無ければ 422 | route | packages/api | Worker |
| 保存前の不変条件 | covered 0〜1e10 の整数 | core | packages/core | Worker |
| bodyLimit | 大きすぎる body を止める | Hono middleware | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: `architecture/tradeoff-auth.md`。
- Errors/resilience: 400 / 413 / 422 / 500 (`specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の Error contract)。
- Observability/audit: 支出名・メモ・取引先名をログに出さない。
- Configuration/secrets: N/A。
- Compatibility/versioning: POST の入力の形が変わる。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は記録と上書き。脅威は 改ざんした `covered` / `verdict` の保存、巨大な入力、他人のキーへの書き込み、メモ経由の XSS。

#### Input validation

zod で型と上限を検査する。003 の covered ±1e10 と value 0〜1e8 は入力検査ではなく保存前の不変条件へ置き換えた (qa-tradeoff-security-web-005)。

#### Identity and authorization

`user_id` で分ける。候補キーは利用者の現在の候補にあるものだけ。

#### Data and secret protection

新しい秘密情報は無い。外部へ送信しない (qa-tradeoff-decision-003)。

#### Application and supply-chain controls

新しい依存を足さない。利用者の文字列は React の既定エスケープで描画する。

#### Detection and response

既存の API エラーログの流儀で code だけを残す。

#### Security verification

api テストで 上限 +1 の 400、未知のキー 422、本文に `covered` を足しても保存値が再計算値であること、利用者の分離。DOM テストでメモの `<script>` が文字として出ること。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-tradeoff-security-web-004 | サーバの再計算値だけを保存 (agent 推定・利用者未確認) | クライアント値を範囲検査して保存 | 改ざんの余地が無い | POST で候補を作り直す |
| qa-tradeoff-security-web-005 | 範囲を保存前の不変条件にする (agent 推定・利用者未確認) | zod で ±1e10 を検査 | 受け取らない値を検査しない | core テストで守る |
| qa-tradeoff-security-web-003 | 文字数・金額・件数の上限 (agent 推定・利用者未確認) | 上限なし | 保存量を抑える | 上限の変更は zod とテストの同時更新 |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker。
- Migration sequence: zod の置き換えと POST の再計算を同じ変更で入れる。
- Rollback trigger/procedure: 分離・上限のテストが落ちたら差し戻す。

## Risks and verification

- Risk/assumption: zod が未知のキーを通す流儀でも保存値は再計算値であることをテストで固定する。
- Architecture fitness test: POST のスキーマに `covered`・`verdict`・`value` が無い。
- Load/failure/security validation: `bodyLimit` の内側。
