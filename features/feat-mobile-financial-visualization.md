---
graph_node_id: "feat-mobile-financial-visualization"
artifact_kind: "feature"
artifact_subtypes: []
title: "モバイル財務可視化と認知負荷の改善"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
owners: []
tags: ["mobile", "financial-visualization", "accessibility", "cognitive-load"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-30T09:35:15Z"
updated_at: '2026-08-30T12:06:04Z'
depends_on: []
related_nodes: ["spec-mobile-financial-visualization", "arch-mobile-financial-experience", "arch-mobile-financial-frontend"]
resource_scope: ["packages/web/src", "packages/web/scripts"]
purpose: "外出先や片手操作でも、財務グラフ・KPI・高密度表が消えたり読めなくなったりせず、会計に不慣れな利用者が短時間で変化・異常・次の確認先を判断できるようにする。"
goal: "360px以上のモバイル、タブレット、デスクトップ、200%相当の拡大で、全財務figureの意味情報が欠けず、結論から詳細へ一貫した順序で読めて操作できる。"
scope_in: ["packages/webの全routeにある財務chart・figure・KPI・高密度表のinventoryと改善", "Chart.js canvasのresponsive containerと0寸法防止", "結論・期間・単位・主要series・次の行動・semantic tableの同一view-model化", "ページ横overflow防止と文脈を保つ局所scrollまたはカード化", "safe-area・固定tabbar・44px操作領域・focus-visible・非色依存", "360px・375px・390px・tablet・desktop・200% zoomの匿名実Chrome回帰"]
scope_out: ["会計計算・集計定義の変更", "API・認証認可・D1・R2・Cloudflare構成の変更", "ネイティブiOSまたはAndroidアプリ化", "既に完了した共通ナビゲーションicon・route統合の再実装", "本番deploy・commit・push・PR作成", "実データを使うfixture・log・screenshot"]
acceptance: ["360px・375px・390pxで対象figureの可視数がdesktopと意味的に一致し、canvasまたは表示containerの0寸法が0件である", "documentの横あふれが0件で、高密度表の例外は見出し文脈とedge affordanceを持つ局所scroll containerに限定される", "各figureに可視見出し・結論要約・期間・単位・主要series・同一view-model由来のsemantic tableがありcanvas非依存で結論を読める", "coarse pointerの主要操作が44x44 CSS px以上で、focus-visible欠落・色だけに依存する状態・200% zoomでの情報欠落が0件である", "unit・React DOM contract・build・desktop/mobile実Chrome回帰が匿名fixtureで全PASSし、既存route・API・会計値に回帰がない"]
architecture_refs: ["arch-mobile-financial-experience", "arch-mobile-financial-frontend"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-mobile-financial-visualization.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"dev-graph-integrity-auditor","evidence_ref":".dev-graph/receipts/decompose-feat-mobile-financial-visualization.json","evaluated_digest":"d4a40ee66b91ee3cfe97510b0ff6790cfc3467266e9b8fdd6a27ec2317999ea3"}
source_lineage: {"origin_kind":"generated","source_plugin":"dev-graph","source_path":"specs/mobile-financial-visualization.md","source_version":"0.1.9","source_digest":"4cb4c416c4656537ece66fa7d3c115b26f1137ef77740b51cc78f5c3a284b9a7","imported_at":"2026-08-30T09:35:15Z"}
classification_confidence: 1.0
classification_reason: "C14 decomposeが確定specを、既存ナビゲーション改善と重複しない単一のモバイル財務可視化featureへ分解したため分類は一意。"
classification_candidates: []
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
tracker_binding: "beads"
beads_linkage:
  bd_issue_id: kanjo-dy9
  linked_at: '2026-08-30T12:06:04Z'
  sync_state: synced
  github_mirror: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"open","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status":"complete","missing_sections":[],"checked_at":"2026-08-30T09:35:15Z"}
---

# 目的

外出先や片手操作でも財務情報が消えず、会計やグラフに不慣れな利用者が「何が変わったか」「どこを確認するか」を短時間で判断できるようにする。

## 到達状態

モバイル、タブレット、デスクトップ、200%相当の拡大で同じ財務上の結論へ到達できる。各画面は結論、期間・単位、異常、次の行動、詳細値の順で読み進められ、canvasを見られない場合も同じview-modelの要約と表が判断材料を保持する。

## スコープ

- スコープ内: 全財務chart・figure・KPI・高密度表、responsive container、semantic companion、safe-area、44px操作領域、zoom・keyboard・screen reader、匿名実Chrome回帰。
- スコープ外: 会計計算、API、認証認可、永続data、Cloudflare構成、ネイティブアプリ化、完了済みナビゲーション改善の再実装、実データfixture、本番deploy・commit・push・PR。

## 受入

- [ ] 360px・375px・390pxで対象figureの可視数がdesktopと意味的に一致し、0寸法が0件である。
- [ ] document横あふれが0件で、高密度表の例外は文脈を保つ局所scrollだけである。
- [ ] 各figureに見出し・結論・期間・単位・主要series・同一view-model由来のsemantic tableがある。
- [ ] 主要操作44x44 CSS px以上、focus-visible欠落0、色だけに依存する状態0、200% zoom情報欠落0である。
- [ ] unit・DOM contract・build・desktop/mobile実Chrome回帰が匿名fixtureで全PASSする。

## アーキテクチャ参照

- `architecture_refs`: `arch-mobile-financial-experience`, `arch-mobile-financial-frontend`

## 機能間依存

- `depends_on`: なし。
- 依存理由: 確定済みspecと2つのarchitecture nodeを参照する、Web表示層だけに閉じた単一featureである。

## Handoff

- per-feature planning: `/dev-graph plan --feature-id feat-mobile-financial-visualization --feature-context features/feat-mobile-financial-visualization.context.json`
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全taskを同一`parent_feature`/`feature_package_id`でC02経由atomic登録し、expected/applied=13を必須とする。
- 完了rollup: exact 13全doneかつP07/P10/P11 evidenceがfeature acceptanceを満たす場合だけdone。
