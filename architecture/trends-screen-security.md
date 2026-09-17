---
graph_node_id: "arch-trends-screen-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "推移画面 — クエリの検証と出力の安全"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "security"]
file_path: "architecture/trends-screen-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "86e202cbbe0cfebf5e1eb0c4a89dc7c5c2d2cc1a104eeb70b23d9f3991c32b5e"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "86e202cbbe0cfebf5e1eb0c4a89dc7c5c2d2cc1a104eeb70b23d9f3991c32b5e", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["spec-trends-screen", "arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
resource_scope: ["packages/api/src/routes/analytics.ts", "packages/api/src/index.ts", "packages/core/src/trend-metrics.ts", "packages/web/src/pages/analysis/Trends.tsx", "packages/web/src/pages/Classify.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/trends-screen-security.md"}]
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

推移画面 — クエリの検証と出力の安全。正本は `system-spec/security.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-trends-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-security-web-trends-observed-002。新しいクエリ (scope・metric・compare・month、/classify の category・payee) はすべて許可値の列挙または YYYY-MM 形式で検証する。CSP は index.ts の secureHeaders (script-src 'self'、frame-ancestors 'none') のまま。
- Quality attribute priorities: G3・G4 に資する。doctrine は OWASP ASVS の入力検証と出力エンコード (owasp-asvs)。
- Constraints: C3: 取込データを外部送信しない。説明文は規則で作る。

## Goals and non-goals

- Goals:
  - G3: 指標 id を辞書引きだけで解決し、任意のキーを評価しない。
  - G4: 取引先名を React のテキストとして描画し、/classify の payee は完全一致だけで絞る。
- Non-goals:
  - 新しい書込み経路
  - 外部の AI や API への送信

## System context and boundaries

- Users/external systems: ログイン済みの利用者。
- Trust/deployment/data boundaries: 入力はクエリだけ。出力は JSON と React の描画だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| クエリ検証 | 列挙・形式・辞書引き | api | packages/api・packages/web | Worker kanjo-console |
| 描画 | テキストとして表示 | web | packages/api・packages/web | Worker kanjo-console |

## Cross-cutting contracts

- Identity/access: 既存の authGuard と mustChangePasswordFence の内側に置き、データは userId で絞る (arch-trends-screen-auth)。
- Errors/resilience: 未知の scope・compare と形式違反の month は既定値へ倒し、400 は未登録の metric だけ (qa-trends-decision-011)。
- Observability/audit: 既存の requestId とエラーログに従う。推移は読取専用で、監査記録の対象になる書込みは増えない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/trends は応答フィールドの追加だけで、既存の傾向判定のフィールドと値を残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は明細の内容 (取引先名) と金額。脅威は細工したクエリによる任意のキー参照と、取引先名に含まれる文字列による表示の改ざん。

#### Identity and authorization

既存の認証の内側 (arch-trends-screen-auth) で、userId で絞る。

#### Data and secret protection

明細を外部へ送らない。エラー応答とログに取引先名を出さない。

#### Application and supply-chain controls

指標は Object.hasOwn で登録表を引き、プロトタイプのキーを解決しない。取引先名は innerHTML を使わずテキストで描画する。payee は正規表現や部分一致に使わず完全一致だけで比較する。新しい依存は足さない。

#### Detection and response

読取専用で canonicalMutationFence と監査ログの対象になる書込は増えない。既存のエラーログに従う。

#### Security verification

api のテストで未登録 metric (constructor や __proto__ を含む) が 400 になること、web のテストで取引先名がテキストとして表示されることを確認する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-SEC-1 | 指標は登録表の辞書引きだけで解決する | 根拠と比較案は qa-security-web-trends-observed-002 を参照 | qa-security-web-trends-observed-002 の判断に従う | 本書の該当節に反映済み |
| ADR-SEC-2 | 説明文は規則で作り外部へ送らない | 根拠と比較案は qa-trends-decision-002 を参照 | qa-trends-decision-002 の判断に従う | 本書の該当節に反映済み |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console を ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: CSP とヘッダーの設定は変えない。
- Rollback trigger/procedure: テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は無いのでデータの巻き戻しは要らない。

## Risks and verification

- Risk/assumption: プロトタイプのキーによる指標の誤解決 → 対策: 所有プロパティだけを引くテスト
- Risk/assumption: 取引先名による表示の改ざん → 対策: テキスト描画のテスト
- Architecture fitness test: api のテストで未登録 metric (constructor や __proto__ を含む) が 400 になること、web のテストで取引先名がテキストとして表示されることを確認する。
- Load/failure/security validation: pnpm verify:full (test・typecheck・lint・build・視覚検査) を緑に保つ。
