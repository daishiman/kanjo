---
graph_node_id: "arch-analysis-hub-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "支出分析ハブ — focus 許可リストと URL コピーの情報保護"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub", "security"]
file_path: "architecture/analysis-hub-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-15-analysis-hub/completeness-findings.json", "evaluated_digest": "a9729ad559310400f5df9ec7f6ca4d5e89779a615300d7015a77b5cba5e1f506"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-15-analysis-hub/security.md", "source_version": "0.1.14", "source_digest": "a9729ad559310400f5df9ec7f6ca4d5e89779a615300d7015a77b5cba5e1f506", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/web/src/routeMetadata.ts", "packages/web/src/pages/Analysis.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/analysis-hub-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:23:44Z"}
serves_goals: ["G2", "G3"]
---

# Architecture overview

支出分析ハブ — focus 許可リストと URL コピーの情報保護。正本は `system-spec/security.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-analysis-hub.md`。

## Context and drivers

- Business/technical context: packages/api/src/index.ts は secureHeaders と requestId を全体に掛ける。本サイクルで新しく外から入る値は URL の ?focus= で、新しく外へ出る値はクリップボードへコピーする URL。ハブは外部サービスへ何も送信しない。コピーする URL は /analysis?focus=(タブ id) だけで、金額・取引・期間を含めない。
- Quality attribute priorities: G2 と G3 に資する。入力は許可リストで検証し不正値は既定値に落とす、出力には必要最小限の情報だけを載せる、という OWASP の入力検証と情報最小化を適用する。クリップボード書込は利用者の明示クリック時だけに行う (MDN Clipboard.writeText)。
- Constraints: C3: 表示していないタブの API は呼ばない。 期間は localStorage で共有し URL に載せない (U7 out)。

## Goals and non-goals

- Goals:
  - G2: ?focus= を ANALYSIS_TABS の id の許可リストで検証し、URL コピーで財務情報を漏らさずに同じ分析を再現できる。
  - G3: ハブ API も既存の secureHeaders・requestId と認証ゲートの内側で動き、外部送信をしない。
- Non-goals:
  - CSP・セキュリティヘッダーの変更
  - 共有リンクの発行や、他人に集計を見せる仕組み
  - 認証方式の変更 (auth 章で扱う)

## System context and boundaries

- Users/external systems: 利用者 1 名。URL を共有された相手は自分のセッションでしか集計を見られない。外部送信先は無い。
- Trust/deployment/data boundaries: 信頼しない入力は URL の focus と期間クエリ。focus は web で許可リスト検証、期間は api の resolvePeriodQuery で解釈する。クリップボードはブラウザの権限境界の外へ出る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| secureHeaders / requestId | 全応答にセキュリティヘッダーと要求 ID を付ける (変更しない) | Hono middleware | packages/api | Worker |
| focus の許可リスト検証 | ANALYSIS_TABS の id 以外を既定値に落とす | TypeScript 関数 | packages/web | web ビルド |
| URL コピー | 明示クリック時に /analysis?focus=(タブ id) を書き、成否を表示する | Clipboard API | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: ハブ API は既存の認証ゲート配下で userId に絞る。
- Errors/resilience: クリップボード書込の NotAllowedError は画面で知らせ、握りつぶさない。不正な focus は例外にせず既定値にする。
- Observability/audit: N/A: セキュリティ監査ログを追加しない。既存 requestId を使う。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存のヘッダー構成と URL 形式 (/analysis/:tab) を維持する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者の収支と取引の集計。主体は利用者と、URL を受け取った第三者。脅威は、URL やクリップボード経由の財務情報の漏えいと、細工した focus 値による想定外の描画。

#### Identity and authorization

認証・認可は auth 章に従い、本章では変えない。URL に認証情報や利用者を特定する値を載せない。

#### Data and secret protection

コピーする URL は /analysis?focus=(タブ id) のみで、金額・取引・期間を含めない。ハブは外部サービスへ送信しない。

#### Application and supply-chain controls

focus は ANALYSIS_TABS の id の許可リストで検証し、不正値は既定の分析に落とす。クリップボード書込は明示クリック時だけに行う。依存ライブラリを追加しない。

#### Detection and response

N/A: 検知・対応の仕組みを変えない。

#### Security verification

DOM テストで、不正な focus が既定値に落ちること、コピーされる URL が focus 以外のクエリを含まないこと、NotAllowedError のとき失敗が表示されることを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-analysis-hub-decision-001 | 選択中の分析を ?focus= で URL に持ち、URL コピーを置く | 転送を残し全タブ上部にハブ要素 | 再現性を得る代わりに URL を入力として扱う必要が生じる | focus の許可リスト検証とコピー内容の最小化を必須にする |

## Delivery, migration and rollback

- Build/deploy topology: 既存の ci.yml・deploy.yml で配信する。security:content などの既存検査を維持する。
- Migration sequence: routeMetadata の ANALYSIS_TABS を許可リストの正本として使い、focus 検証 → URL コピー → DOM テストの順に入れる。
- Rollback trigger/procedure: コピー URL に期間や金額が混ざる、または不正な focus で描画が崩れる兆候があれば PR を差し戻し、配信済みなら直前のビルドへ戻す。migration の巻き戻しは不要。

## Risks and verification

- Risk/assumption: 将来 focus 以外の状態を URL に足すと、期間など財務文脈が共有 URL に漏れる。URL に載せる値は focus だけという前提を保つ。
- Architecture fitness test: 許可リスト外の focus で既定の分析が選ばれ、コピー URL が /analysis?focus=(タブ id) の形だけであることを DOM テストで固定する。
- Load/failure/security validation: 既存の test / typecheck / lint と check 系を緑に保つ (S6)。
