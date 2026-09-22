---
graph_node_id: "arch-budget-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "予算 — pages/budget への分割と URL・サーバ状態・端末下書きの分離"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "frontend"]
file_path: "architecture/budget-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c555b213773f5d2a3bea4d0f51d770d843672c6cf70ba55a1d50827c63badf66"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "c555b213773f5d2a3bea4d0f51d770d843672c6cf70ba55a1d50827c63badf66", "imported_at": "2026-09-21T13:59:08Z"}
created_at: "2026-09-21T13:59:08Z"
updated_at: "2026-09-21T13:59:08Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-ui-ux", "arch-budget-backend", "arch-budget-database", "arch-budget-security", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-auth"]
resource_scope: ["packages/web/src/pages/budget/", "packages/web/src/pages/Budget.tsx", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/period.tsx", "packages/web/src/api.ts", "packages/web/src/analysis-query-invalidation.ts", "packages/web/src/components/Page.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/budget-outlook.dom.test.tsx", "packages/web/src/diagnosis-next-action-receivers.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/budget-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T13:59:08Z"}
serves_goals: ["G1", "G4"]
---

# Architecture overview

予算 — pages/budget への分割と URL・サーバ状態・端末下書きの分離。`system-spec/frontend.md` は承認時入力、本書は画面の部品構成・状態の置き場所・API との接続・下書きと離脱確認の制約を持つ。画面の文言と操作の逐語の正本は `specs/spec-budget-screen.md`。

## Context and drivers

- Business/technical context: packages/web は React 18・react-router-dom 7 (`main.tsx` の `BrowserRouter`)・TanStack Query 5。現行の `packages/web/src/pages/Budget.tsx` (317 行・1 ファイル) は `useQuery(['budgets'])` で `GET /api/budgets` を、`useMutation` で `PUT /api/budgets` と `POST /api/budgets/suggest` を呼び、保存後に `invalidateAnalysisDerived` で分析系を無効化する。`usePeriod`・`PeriodPicker`・`ConfirmDialog` を使わず、下書きは React の state のみで localStorage に残らない。`routeMetadata.ts` の 116〜127 行目で `/budget` は navGroup『計画』、`AuthenticatedApp.tsx` 27 行目で lazy に読む。作り直し済みの画面は `pages/<画面>/` に分割し `pages/<画面>.tsx` は re-export 1 行を残し、表示規則は `view-model.ts` に置く (`pages/classify/`・`pages/statements/`)。下書きの前例は `pages/classify/draft.ts` (キー `kanjo:classify:draft:<id>`・30 日・try/catch) と `pages/statements/liability-draft.ts` (800ms・ログアウトで消去・beforeunload)。グラフは既存の SVG 実装 (推移・家計収支) があり、外部のグラフライブラリは入っていない。診断からの `?account=` を受けて 1 科目に絞る受け口がある (`diagnosis-next-action-receivers.dom.test.tsx` 196 行目) (qa-budget-frontend-web-evidence-001)。
- Quality attribute priorities: G1・G4 に資する。Apple HIG の presentation (部品は色を直書きせずトークンだけを使い、金額・率・符号の文字列は `view-model.ts` で作ってから描く) と Clean Architecture の application-architecture (算出は core、取得と保存と無効化は container、整形は `view-model.ts` の三層。下書きは localStorage に閉じ、問い合わせのキャッシュに入れない) を適用する。
- Constraints: 色は `packages/core/src/design-tokens.ts` 由来のトークンだけ。共通部品 (`PageHeader`・`KpiCard`・`PageState`・`Button`・`ConfirmDialog`・`PeriodPicker`) と `usePeriod` を使う。新しいグラフライブラリを足さず、初期 JS 予算 (`check-initial-js-budget`) を超えない (C2・C5)。

## Goals and non-goals

- Goals:
  - G1: `Budget.tsx` を `pages/budget/` 配下の container と画面専用の部品に分け、`pages/Budget.tsx` は互換の re-export だけを残す。web は core の計算を書き直さない (qa-budget-frontend-web-001)。
  - G1: 取得は TanStack Query で実績期間 (`usePeriod`) と予算対象の開始月を鍵に 1 本の画面用 API から受け、保存は GET の revision と dirty 行だけを PUT で送り、成功で画面と分析派生の問い合わせを無効化する。
  - G4: 入力・この値を適用・実績から提案・計画による調整を下書きとして localStorage に予算対象ごとに自動保存し、保存成功とログアウトで消し、次回に復元する。未保存の項目数は保存済みの値との差分から数え、未保存のまま画面を離れる (ルート遷移・再読込) ときは確認する。
  - G1: 予算対象の開始月と選んだ科目を URL に持ち、診断からの `?account=` を受け付ける。
- Non-goals:
  - 共通シェル (サイドバー・ヘッダ・月次クローズの進捗・フッタ) の作り直し
  - 新しいグラフ・状態管理ライブラリの追加
  - 下書きのサーバ保存・端末間の同期
  - 旧 `/api/budgets` 系の呼び出し (画面は使わない)

## System context and boundaries

- Users/external systems: ブラウザの利用者。予算画面の API (`architecture/budget-backend.md`) だけを呼ぶ。
- Trust/deployment/data boundaries: 画面は KPI・自動提案・見通しを計算しない。下書きは端末の localStorage に閉じ、保存操作でだけサーバへ送る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `BudgetPage.tsx` (container) | URL・`usePeriod`・問い合わせ・保存・無効化・下書き・離脱確認を持ち、部品へ表示用の値を渡す | React | packages/web | 静的配信 |
| `BudgetKpis` | KPI 4 枚 | React (props) | packages/web | 静的配信 |
| `BudgetMonthlyChart` | 月次の実績・予算・見通しのグラフ (SVG 自前描画) | React (props) | packages/web | 静的配信 |
| `BudgetOutlookCard` | 今後の見通し (累計) と見通しコメント | React (props) | packages/web | 静的配信 |
| `BudgetTable` | 予算一覧 (検索・実績から提案・すべてリセット・選択・入力) | React (props) | packages/web | 静的配信 |
| `BudgetAccountPanel` | 科目パネル (提案の根拠 / 関連データ、計算の詳細、計画による調整の入力、元に戻す) | React (props) | packages/web | 静的配信 |
| `BudgetGapCategories`・`BudgetImpactCard` | 過不足カテゴリの 2 タブと調整によるインパクト | React (props) | packages/web | 静的配信 |
| `BudgetSaveBar` | 未保存 N 項目・最終保存時刻・下書きの自動保存・リセット・予算を保存 | React (props) | packages/web | 静的配信 |
| `view-model.ts` | 円・万円・符号・率の書式と文言の組立て (計算はしない) | 純関数 | packages/web | 静的配信 |
| `draft.ts` | 下書きの読み書き・期限切れの破棄・全消去 | 関数 | packages/web | 静的配信 |

部品名は agent 推定・利用者未確認 (根拠 qa-budget-frontend-web-002)。

## Cross-cutting contracts

- Identity/access: API 呼出しは既存の Cookie セッションに乗る。ログアウトで予算の下書きを消す (`architecture/budget-auth.md`)。
- Errors/resilience: 読込・空 (実績 0 か月)・失敗は `PageState` で出す。保存の失敗は保存バーで知らせ、下書きを残して再保存できるようにする。localStorage が使えない環境でも画面は動く (読み書きを try/catch で包む)。
- Observability/audit: N/A: 観測信号を追加しない。
- Configuration/secrets: N/A: 追加の設定・秘密情報を持たない。
- Compatibility/versioning: `pages/Budget.tsx` の `BudgetPage` の export を保ち、`AuthenticatedApp.tsx` の lazy import を壊さない。診断からの `?account=` の受け口 (`diagnosis-next-action-receivers.dom.test.tsx`) を緑のまま保つ。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/budget-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/budget-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/budget-database.md`)
- Security: N/A: 本章の関心外 (`architecture/budget-security.md`)

### Frontend architecture

#### Rendering and application pattern

- Rendering: 既存の SPA (クライアント描画)。予算画面は既存どおり lazy route に置く。
- Pattern: container が URL・データ取得・保存・下書きを持ち、部品は `view-model.ts` が作った表示用の値を props で受ける (Container / Presentational)。KPI・一覧・グラフの一致は core と `view-model.ts` の純関数テストで固定する。

#### Routes, screens and navigation

- Routes: `/budget` を保つ。予算対象の開始月は `?start=YYYY-MM`、選んだ科目は `?account=` で持ち、期間は `usePeriod` の既存の URL 規則に従う (agent 推定・利用者未確認、根拠 qa-budget-frontend-web-002)。`?account=` に存在しない科目が来たときは科目パネルを開かず全件を表示する。
- Navigation: 予算対象の既定は実績期間の終了月の翌月から始まる 12 か月 (agent 推定・利用者未確認、根拠 qa-budget-ui-ux-web-002)。未保存のまま画面を離れるときは、再読込・タブを閉じるは `beforeunload`、アプリ内のルート遷移は確認ダイアログで止める。

#### Component and design-system boundaries

- 画面専用部品は `pages/budget/` に置き、他の画面から import しない。
- 共通部品は `PageHeader` / `PageState` / `KpiCard` / `Button` / `ConfirmDialog` / `PeriodPicker` を使い、色・余白はデザイントークンに従う。
- グラフは既存の推移・家計収支と同じ SVG の自前描画にする。差額・過不足は色だけに頼らず符号と文言を添える (`architecture/budget-ui-ux.md`)。

#### State and data flow

- URL (検索パラメータ): 予算対象の開始月・選んだ科目。期間は `usePeriod`。
- サーバ状態 (TanStack Query): 鍵は `['budget-screen', period, start]` (agent 推定・利用者未確認、根拠 qa-budget-frontend-web-002)。保存成功で `budget-screen` と分析派生 (`invalidateAnalysisDerived`) を無効化し、診断の予算カバー率・着地見込みを読み直させる。
- 端末の下書き (localStorage): キーは `kanjo:budget:draft:<userId>:<start>`、保存済み値と異なる dirty 行だけを入力停止の 800ms 後に書き、30 日を過ぎた下書きは読込時に捨てる。期間切替・unmount・pagehide は debounce 前でも同期的に退避する。保存成功で消し、ログアウトで `kanjo:budget:draft:` で始まるキーを全部消す。
- 未保存の項目数: 下書きの値と保存済みの値 (API の応答) の差分がある行を数える。この行を元に戻すは 1 行の下書きを捨て、すべてリセット / リセットは `ConfirmDialog` の確認後に予算対象の下書きを捨てる。
- 画面は KPI・自動提案・見通し・過不足・インパクトを計算しない。下書きの入力による再計算は、下書きの値を来期予算として含めた算出結果が要るため、`specs/spec-budget-screen.md` で方式 (core の関数を web から同じ入力で呼ぶか、API に下書きを渡すか) を固定する。

#### Backend integration

- `GET /api/budget-screen?period=&start=` で画面の全値と revision を読み、`PUT /api/budget-plans` で `baseSavedAt` と dirty 行だけを送る。
- 呼出しは `packages/web/src/api.ts` の既存の関数群に足し、画面から `fetch` を直接呼ばない。
- フェンスの競合 (409) と revision 競合 (409 `budget_plan_conflict`) と検証違反 (400) は保存バーの失敗として表示し、dirty 下書きは消さない。revision 競合では最新を再取得し、未編集行だけを追随させる。

#### Performance and observability

- 画面は lazy route で分割し、初回の JS の増加を予算の経路に閉じる。新しいライブラリを足さない。
- 下書きの書込は 800ms の間引きで、キー入力ごとに localStorage へ書かない。
- 観測信号は追加しない。

#### Frontend verification

`packages/web/src/pages/budget/budget.dom.test.tsx` (予定) で O1 (画像の構成要素がすべて描画され、『AI』の語が無く『自動提案』がある、読込・空・失敗) と O4 (下書きの自動保存・復元・保存成功での消去・未保存 N 項目・この行を元に戻す・すべてリセットの確認・離脱確認) を確かめる。`view-model.ts` の単体テストで書式と符号を固定する。既存の `budget-outlook.dom.test.tsx` は新しい画面に合わせて書き換え (契約は緩めない)、`diagnosis-next-action-receivers.dom.test.tsx` は緑のまま保つ。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-budget-frontend-web-001 | `pages/budget/` に container と画面専用部品を分け、`pages/Budget.tsx` は re-export だけにする | 1 ファイルのまま作り直す | 既存の作り直しと同じ配置で、部品ごとに DOM テストを書ける | 旧テストの import 先を見直す |
| qa-budget-frontend-web-001 | 算出は core、整形は `view-model.ts`、取得・保存・無効化は container に置く | 画面で合計を取り直す | KPI・一覧・グラフが core の 1 か所から出てずれない | 部品は表示用の値しか受け取らない |
| qa-budget-frontend-web-001 | 下書きは予算対象ごとに localStorage に置き、問い合わせのキャッシュに入れない | TanStack Query のキャッシュに下書きを混ぜる | サーバの状態と下書きの境界がはっきりし、未保存の件数を差分で数えられる | 端末をまたいで下書きは続かない |
| qa-budget-frontend-web-002 | 下書きのキー `kanjo:budget:draft:<userId>:<start>`・800ms・30 日 (agent 推定・利用者未確認) | 明細仕分けと同じ 1 秒 / 期限なし | 決算書の負債の下書きと同じ間引きで、利用者と期間をまたいで混ざらない | ログアウトの全消去は接頭辞で探す |
| qa-budget-frontend-web-001 | 予算対象の開始月と選んだ科目を URL に持ち、`?account=` を受け付ける | 画面の state だけに持つ | 診断から特定の科目へ直接来られ、再読込で同じ状態に戻る | 存在しない科目の扱いを決める |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web のビルド (`build:bundle` → `check:js-budget`) と静的配信。
- Migration sequence: API (`architecture/budget-backend.md`) → `pages/budget/` の部品と `view-model.ts`・`draft.ts` → `BudgetPage` の組立てと `pages/Budget.tsx` の re-export 化 → ログアウトの下書き消去 → 既存テストの書き換えと新テスト。
- Rollback trigger/procedure: DOM テスト・初期 JS 予算が落ちたら差し戻し。配信済みなら web を直前版へ戻す。直前版は旧 `/api/budgets` を使うため、API を戻さなくても動く。

## Risks and verification

- Risk/assumption: アプリは `BrowserRouter` で、react-router の `useBlocker` は data router でしか使えない。アプリ内のルート遷移の離脱確認は、共通シェルを作り直さずにどう止めるか (ナビのクリックを横取りするか、data router へ移すか) を `specs/spec-budget-screen.md` で決め、DOM テストで確かめる。
- Risk/assumption: 下書きの値を KPI・インパクトへ即座に反映する (I4) には、下書き込みの算出が要る。core の純関数を web から呼ぶと初期 JS が増え、API に下書きを送ると入力のたびに要求が出る。方式を仕様で固定し、初期 JS 予算で確かめる。
- Risk/assumption: CI の headless Chrome は `pointer: none` で、`@media (pointer: fine)` だけで書いた表示はローカルで緑・CI で赤になる。
- Architecture fitness test: `pages/budget/` の部品に KPI・自動提案・見通しの計算が無いこと。`/api/budgets` の呼出しが画面に残らないこと。色の直書きが 0 件であること (`scripts/check-design-tokens.mjs`)。
- Load/failure/security validation: localStorage が使えない環境で画面が動くこと。保存失敗後も下書きが残ること。
