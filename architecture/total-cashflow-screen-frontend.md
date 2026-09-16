---
graph_node_id: "arch-total-cashflow-screen-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "総収支画面 — API 結果の描画と操作 id の列"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "frontend"]
file_path: "architecture/total-cashflow-screen-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f6ac44f0de3cd3a14d0c91273e9de3754b1ac63771f69e874422ea1e03d8504a"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "f6ac44f0de3cd3a14d0c91273e9de3754b1ac63771f69e874422ea1e03d8504a", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["spec-total-cashflow-screen", "arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: ["packages/web/src/pages/analysis/TotalCashflow.tsx", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/period.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/charts.ts", "packages/web/test/total-cashflow-table.dom.test.tsx", "packages/web/src/analysis-tabs.dom.test.tsx", "packages/web/src/common-shell.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-screen-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T14:50:54Z"}
serves_goals: ["G1", "G2", "G5"]
---

# Architecture overview

総収支画面 — API 結果の描画と操作 id の列。正本は `system-spec/frontend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-total-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-frontend-web-tc-observed-001。packages/web は React 18 + react-router-dom 7 + TanStack Query 5 + Chart.js 4 の Vite SPA。AuthenticatedApp.tsx が /analysis/:tab を割り当て、routeMetadata.ts の ANALYSIS_TABS が 5 タブの正本。総収支は pages/analysis/TotalCashflow.tsx で queryKey ['total-cashflow', 期間 key] により GET /api/total-cashflow を読み、判定・除外の成功後に ['total-cashflow'] を invalidate する。PR #50 で分析系の更新は ['analysis-hub'] も追随させる。期間は period.tsx の usePeriod() (localStorage kanjo:period で全画面共有)。共通部品は components/Page.tsx・Button.tsx・DataTable.tsx・charts.ts、トークンは packages/core/src/design-tokens.ts が正本。サイドバー (Layout.tsx) は件数バッジ (data-testid nav-review-badge-(id)) と aria-current を持つ。
- Quality attribute priorities: G1・G2・G5 に資する。doctrine は Apple HIG (表示層を API の summary・workbench・autoMatches をそのまま描くコンポーネントに分け、画面側の状態は選択・フィルタ・折りたたみの開閉と取消に使う操作 id の列だけに限る。チャートは既存の Chart.js と系列色トークンを使い新しい色を定義しない) と Clean Architecture (ページ → TanStack Query の取得フック → API クライアントの一方向。書込み後の追随は invalidate に一本化し、キャッシュを手で書き換えない)。
- Constraints: C1: web は規則を持たず core/api に置く。 C2: トークン・Button・PageShell。 C4: 表示していないタブの API は呼ばない、ハブ invalidation を維持する。

## Goals and non-goals

- Goals:
  - G1: 1 回の取得で全ブロックを描き、KPI・前期比・3 区分・一致度・進捗を画面側で再計算しない。
  - G2: 3 ペインの表示状態と一括操作、取消の操作 id の列を画面の状態で持つ。
  - G5: ヘッダー『防衛ライン』とフッター『毎朝バックアップ』は Layout の文言だけを差し替え、サイドバーは現在地とバッジの確認に留める (qa-total-cashflow-decision-010/011)。
- Non-goals:
  - セグメント・区分・フィルタ・検索・選択の URL 保持
  - 期間選択の保存先の変更
  - 画面側でのキャッシュの手書き更新

## System context and boundaries

- Users/external systems: 利用者のブラウザ。呼出し先は総収支 API (GET 1 本と書込み 4 本) だけ。
- Trust/deployment/data boundaries: web は API の結果を表示する層で、業務規則は packages/core、永続化は packages/api が持つ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| TotalCashflow ページ | 全ブロックの配置と画面状態 (セグメント・区分・フィルタ・検索・選択・開閉・操作 id の列) | React コンポーネント | packages/web | Workers Assets の SPA |
| 総収支取得フック | queryKey ['total-cashflow', 期間 key] で GET /api/total-cashflow を読む | TanStack Query | packages/web | 同上 |
| 書込みミューテーション | 判定・除外・戻す・取消を送り、成功後に ['total-cashflow'] と ['analysis-hub'] を invalidate | TanStack Query | packages/web | 同上 |
| チャート | 月次の収入/支出の棒と純収支の折れ線を系列色で描く | Chart.js 4 と charts.ts | packages/web | 同上 |
| Layout | ヘッダー/フッター文言、サイドバーの現在地と照合バッジ | React コンポーネント | packages/web | 同上 |

## Cross-cutting contracts

- Identity/access: AuthenticatedApp.tsx 配下。未認証は既存どおりログインへ送られる。
- Errors/resilience: 取消が 409 なら操作 id の列を空にし『別の画面で新しい操作があったため取り消せません』と再読込を促す。部分成功は件数で通知し、失敗した項目は選択状態のまま残す。
- Observability/audit: N/A: 画面に実行時の信号を足さない。
- Configuration/secrets: N/A: 設定値・秘密情報を扱わない。
- Compatibility/versioning: 既存応答の months / review / matched / freeeOnly は API 側に残り、9 列月次表は開閉で残す。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

Vite SPA のクライアント描画。表示層は API の summary・series・workbench・autoMatches・lastOperation をそのまま描くコンポーネントに分ける。設計知識は Clean Architecture card の依存方向 (web が総収支の規則を持たない)。

#### Routes, screens and navigation

/analysis/total-cashflow (ANALYSIS_TABS の総収支タブ)。総合/事業/家計は URL に載せず、期間と同じくタブ内の表示状態として扱う。表示していないタブは遅延読み込みで API を呼ばない。

#### Component and design-system boundaries

PageShell/PageHeader/KpiCard/PageState/PageActions・Button (native button は data-native-control と ARIA 必須)・DataTable・charts.ts の系列色を使い、色の直書きをしない。

#### State and data flow

queryKey ['total-cashflow', 期間 key] 1 本を正本にする。セグメント・区分・フィルタ・検索・選択を切り替えても API を再取得しない。その画面を開いてから成功した書込みの operationId を新しい順の列としてページの状態で持ち、『元に戻す』は列の先頭を送り、成功したら先頭を外す。送信中はボタンを無効にする。列は再読込や画面の移動で消えるので、取消はその画面を開いている間に限られる (qa-frontend-web-tc-inference-004・qa-total-cashflow-decision-013/017)。

#### Backend integration

GET /api/total-cashflow の応答へ summary・series・workbench・autoMatches・lastOperation が加わる。一括判定は POST /total-cashflow/verdicts (最大 200 件)、除外は POST /total-cashflow/freee-exclusions に {items:[{freeeKey, reasonCode, memo?}]} または {freeeKeys[], reasonCode, memo?}、集計へ戻すは DELETE。書込みの応答は全て operationId を返す。取消は POST /total-cashflow/operations/{id}/undo で、一致しない id は 409、他人の id や存在しない id は 404。成功後は ['total-cashflow'] と ['analysis-hub'] を invalidate し、サイドバーの照合バッジと概況の要約を追随させる。出典は TanStack Query の invalidations-from-mutations (5.102.8)。

#### Performance and observability

1 回の取得で全ブロックを描き、表示状態の切替で再取得しない。N/A: 新しい計測は足さない。

#### Frontend verification

packages/web/test/total-cashflow-table.dom.test.tsx・analysis-tabs.dom.test.tsx・common-shell.dom.test.tsx を緑のまま拡張し、区分切替・フィルタ・検索・選択・右詳細・一括判定・取消の導線 (再読込後に出ない)・409 時の列の破棄を確かめる。ルート verify:full の check:thead / check:mobile-layout / check:financial-figure / check:financial-routes / check:analysis-hub を緑に保つ。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-total-cashflow-decision-004 | 操作履歴を D1 に残す | 画面のメモリ上だけで直前 1 件 | 判定・除外・戻すを記録として残せる | 取消範囲は decision-017 で画面を開いている間に限られる |
| qa-total-cashflow-decision-017 | 取り消せるのはその画面を開いている間 | 上限なし / 当日だけ | 古い判定を誤って戻す危険が小さい | 操作 id の列をページ状態で持つ |
| qa-frontend-web-tc-inference-004 | 応答加算・operationId 返却・undo の条件付き要求・queryKey 1 本と invalidate | 表示ごとの個別 API | 往復 1 回で全ブロックを描ける | inference-003 を置き換える。endpoint の形と 409 時の文言はアシスタント推定 |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドを Worker の Workers Assets で配信する。
- Migration sequence: API の加算と書込み応答の operationId → 取得フックとミューテーションの切替 → 画面ブロックと操作 id の列 → DOM テスト。
- Rollback trigger/procedure: DOM テストや check 系が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 取消の 409 を一律に列の破棄として扱うため、canonical_write_busy (再試行すれば通る) でも列が消え文言が事実と合わない。別タブで復元した後の古い id は 404 になるが画面の扱いが未記載 (completeness-findings low)。lastOperation の用途が未記載 (findings low)。
- Architecture fitness test: web に一致度・区分・前期比の計算が無いこと、書込み後の追随が invalidate だけであること。
- Load/failure/security validation: 表示状態の切替で API 呼出しが増えないこと、狭幅で横スクロールしないこと、既存 test / typecheck / lint が緑 (S6)。
