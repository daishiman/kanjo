---
graph_node_id: "arch-total-cashflow-screen-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "総収支画面 — 入力の許可リスト・上限と履歴の最小化"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "security"]
file_path: "architecture/total-cashflow-screen-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c4eb8060c3032682c7822530ec9b4c39ed98dc8b67743db477681a8e0f56e9b3"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "c4eb8060c3032682c7822530ec9b4c39ed98dc8b67743db477681a8e0f56e9b3", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["spec-total-cashflow-screen", "arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/d1-limits.ts", "packages/web/src/pages/analysis/TotalCashflow.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-screen-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T14:50:54Z"}
serves_goals: ["G2", "G4"]
---

# Architecture overview

総収支画面 — 入力の許可リスト・上限と履歴の最小化。正本は `system-spec/security.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-total-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-security-web-tc-observed-001。index.ts は secureHeaders と requestId を全体に掛け、/api/* は認証と runtimeSchemaGuard・canonicalMutationFence の後にある。総収支 API は利用者本人の明細・freee 取引・判定だけを返し、外部サービスへ送らない (フッター『取込データは外部送信しません』)。入力は zod で検証し、判定は verdict を same|different の許可値、件数は最大 200、除外理由は 1〜200 字に制限している。D1 のバインド上限は d1-limits.ts の D1_MAX_BOUND_PARAMS で分割する。検索語はクエリ文字列に載せず画面内の絞り込みに留める。
- Quality attribute priorities: G2 と G4 に資する。doctrine は OWASP ASVS + Secrets Management Cheat Sheet (入力検証を reasonCode の許可リスト・memo の長さ・一括件数の上限に、出力のエスケープをメモと摘要の文字列描画に反映。操作履歴の JSON には判定と除外の値と取消に要る memo だけを入れ、摘要など他の自由文は複製しない)。
- Constraints: 外部送信を足さない。既存の secureHeaders・requestId・柵の構成を変えない。

## Goals and non-goals

- Goals:
  - G2: 一括判定・一括の理由設定の入力を許可リストと上限で検証し、超過は全体を拒否する。
  - G4: 操作履歴に保存する値を判定・除外の値と memo に限り、取消は本人の操作だけを対象にする。
- Non-goals:
  - 外部サービスへの送信・共有
  - 検索語・区分・セグメントを API へ送る設計

## System context and boundaries

- Users/external systems: 認証済みの利用者本人。外部送信先は無い。
- Trust/deployment/data boundaries: ブラウザからの入力は信頼しない。route の zod 検証が入口、D1 の CHECK 制約が最後の防壁。表示は React の文字列描画だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| secureHeaders・requestId | 全体のセキュリティヘッダと要求の識別 | Hono middleware | packages/api | Worker |
| 総収支 route の zod スキーマ | verdict・件数・reasonCode・memo の検証 | /api/total-cashflow 系 | packages/api | Worker |
| d1-limits | バインド上限に合わせた分割 | D1_MAX_BOUND_PARAMS | packages/api | Worker |
| D1 CHECK 制約 | reason_code の 5 値を DB 側でも拒否 | SQL | migrations | D1 |
| 総収支画面 | メモと摘要を文字列として描画し検索語を画面内に留める | React | packages/web | Workers Assets |

## Cross-cutting contracts

- Identity/access: 認証・認可は auth 章 (`architecture/total-cashflow-screen-auth.md`) に従う。
- Errors/resilience: 許可外の値・上限超過は 400 で全体を拒否し、一部だけ書き込まない。
- Observability/audit: requestId を既存どおり付ける。操作履歴は本人の判断記録で、自由文は memo だけ。
- Configuration/secrets: N/A: 秘密情報を追加しない。
- Compatibility/versioning: 既存の verdict 許可値・件数上限 200 を維持し、reasonCode と memo の検証を足す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者本人の明細・freee 取引・判定・除外理由とメモ・操作履歴。脅威は許可外の値や過大な一括件数による不正な書込み、メモ経由のスクリプト注入、履歴への不要な自由文の複製による露出面の拡大、検索語の URL 経由の漏れ。

#### Identity and authorization

N/A: 認証と認可は auth 章 (`architecture/total-cashflow-screen-auth.md`) が扱う。本章はその内側の入力と出力を扱う。

#### Data and secret protection

Secure by Design card の『入力を許可リストで検証し、上限で止める』を適用する。reasonCode は 5 値の許可リスト (DB の CHECK と zod の enum を同じ定数から作る)、memo は 0〜200 字、一括の件数は既存どおり最大 200 件で、超過は 400 で全体を拒否する (qa-total-cashflow-decision-003)。操作履歴の before/after には判定と除外の値だけを入れ、取引の摘要やメモ以外の自由文を複製しない (qa-total-cashflow-decision-004)。データは外部へ送らない。

#### Application and supply-chain controls

メモと摘要は React の文字列描画だけで表示し HTML として解釈しない。検索語・区分・セグメントは画面内の状態で API へ送らず、攻撃面を増やさない。依存ライブラリの追加は無い。

#### Detection and response

N/A: 新しい検知・通知は足さない。誤操作は操作履歴の前後の値と取消で戻す。

#### Security verification

API 統合テストで、許可外の reasonCode・201 字の memo・201 件の一括が 400 で全体拒否されること、操作履歴の items_json に摘要が含まれないことを確かめる。DOM テストでメモ中のタグ文字列がテキストとして表示されることを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-total-cashflow-decision-003 | 理由を 5 値の reasonCode と 0〜200 字の memo に分ける | 自由記述 1 列 | 許可リストで検証でき一括設定が安全になる | DB の CHECK と zod の enum を同じ定数から作る |
| qa-total-cashflow-decision-004 | 操作履歴を D1 に残す | 画面のメモリ上だけ | 取消に要る値だけ持てば露出面は小さい | 履歴の自由文は memo だけに限る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker のまま。セキュリティヘッダの構成は変えない。
- Migration sequence: reason_code の CHECK は database 章の migration 0041 に含まれる。検証定数を core に置いてから route と migration で使う。
- Rollback trigger/procedure: 検証漏れが見つかったら直前のビルドへ戻す。CHECK 制約は追加のみで戻しても害が無い。

## Risks and verification

- Risk/assumption: 3 表をバックアップに加えたことで、バックアップの保護 (保存先・アクセス) に本章が触れていない (findings low)。適用文はアシスタント推定。
- Architecture fitness test: reasonCode の許可値が 1 つの定数から zod と CHECK へ流れていること、描画に HTML 解釈の経路が無いこと。
- Load/failure/security validation: 境界値 (200/201 件、200/201 字) の拒否を統合テストで確かめる。出典は owasp-asvs 5.0.0。
