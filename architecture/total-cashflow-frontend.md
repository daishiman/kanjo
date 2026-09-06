---
graph_node_id: "arch-total-cashflow-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "トータル収支 — フロントエンド構成"
project_id: "kanjo"
domain: "frontend"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "frontend"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-06T00:18:57Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements"]
resource_scope: ["packages/web/src"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/total-cashflow-frontend.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/completeness-findings-r7.json", "evaluated_digest": "6d9a3099e81f6ccae5e93105dd5b41d485bcc4a57a9c478239b8f6e694ddacb2"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.11", "source_digest": "6d9a3099e81f6ccae5e93105dd5b41d485bcc4a57a9c478239b8f6e694ddacb2", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/frontend.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G1,G4,G5,G6,G7 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G1", "G4", "G5", "G6", "G7"]
---

# トータル収支 — フロントエンド構成

トータル収支一覧機能の frontend 領域のアーキテクチャ。要件仕様は `spec-total-cashflow-requirements` を参照する。

> 本文の正本は `system-spec/frontend.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G1, G4, G5, G6, G7

## Architecture overview

既存構成を踏襲する。React + react-router-dom による SPA (クライアントサイドレンダリング) で、
Vite でビルドした静的アセットを Cloudflare Workers の ASSETS バインディング経由で配信し、
`not_found_handling: single-page-application` でルーティングを解決する。SSR は導入しない。

## Context and drivers

本機能は「事業と家計が一体になった実態に対し、トータルでいくらプラスマイナスなのかが読めない」
という利用者の課題から出発している。現状 `analysis.ts` の `balanceMonth()` は Money Forward 側の
収支だけを balance とし、`comparison()` は事業と家計を左右に並べる割合ビューで合算しない。
単純合算ができないのは、個人カード・口座から払った事業経費 (bizAdvance) が freee にも記帳され、
事業口座から個人口座への振替 (bizIncome) が freee 売上の再登場であるため、収入・支出の双方で
二重計上が起きるからである。

フロント側の駆動要因は「画面に出る数字を 1 つの真実に固定すること」である。クライアントで合計を
再計算すると、サーバの導出値との差が利用者には検出できない形で生じうる。

## Goals and non-goals

Goals: G1 (一覧表の表示) / G4 (要確認の判断入口) / G5 (トレンド表示) / G6 (内訳へのドリルダウン) /
G7 (期間切替への追随)。

Non-goals: SSR の導入、新しい可視化ライブラリの追加、判断専用画面の新設、クライアント側での合計再計算。

## System context and boundaries

境界は「サーバ導出値を表示し、判断を mutation として送るところまで」。合計の計算責務はサーバ側に
あり、フロントは持たない。判断の入口は既存の取込明細編集画面に置き、新しい画面を作らない。

## Container and component view

- 分析タブ群への新しいタブ: 月次一覧表と要確認件数を表示する。
- 既存の取込明細編集画面: 「同じ/違う」判断の UI をここへ組み込む。
- `@tanstack/react-query`: サーバ状態を集約する既存方針に従い、月次トータル収支と要確認一覧を
  1 つのクエリキーで取得する。
- 既存 `chart.js` / `react-chartjs-2`: トレンドやグラフを添える場合に用いる。新規ライブラリは追加しない。

## Cross-cutting contracts

- 判断は mutation として送り、成功時に当該クエリを無効化して再取得する。これにより判断の反映と
  合計の再計算が UI 上で一貫する。
- クライアント側で合計を再計算せず、必ずサーバ導出値を単一の真実とする。
- 期間切替は既存の期間 UI と `core/src/period.ts` による Dataset スライスにそのまま追随させる。

## Subtype architecture

**frontend**: 一覧表は 9 列で横幅が広くなるため、表自体を横スクロール可能な領域に収め、ページ本体が
横スクロールしない構造にする。列を落とす対応は取らない (9 列常時表示は利用者承認済み)。

## Architecture decisions

本ノード固有の意思決定レコードは持たない。表示基準は `dec-trend-method-001` (判定語 `TrendDirection`
の共有) と ui-ux ノードの列構成決定に従属する。状態管理・レンダリング方式は既存方針の踏襲であり、
新たな選択肢比較を要する論点ではないと確定している (`qa-frontend-web-001`)。

## Delivery, migration and rollback

Vite ビルド → Workers ASSETS 配信という既存経路のまま。新しいタブの追加であり既存タブの意味を
変えないため、ロールバックは当該デプロイの巻き戻しで足りる。

## Risks and verification

- リスク: `TREND_MIN_MONTHS` 未満の期間ではトレンド列が常に「判定不可」となる。何も表示されない
  ように見える挙動を UI 側で明示する必要がある。
- 検証: 9 列すべてが常時表示されること、期間切替に追随すること、判断後に一覧表の数字が更新される
  ことを DOM テストで固定する。CI の headless Chrome は `pointer: none` であるため、
  `@media (pointer: fine)` に依存した表示条件を書かない (否定形の 2 段で書く)。

## P02 表示境界の確定 (dev-graph 所有)

上の本文は取込元の章の引用である。ここから下は dev-graph が P02 (`SYS-TCF-P02`) で確定させた
表示側の境界であり、引用元を書き換えずに追記している。

### 一覧表が受け取る形

フロントは `monthlyTotalCashflow` (`packages/core/src/total-cashflow.ts`) が導出した月次行を
サーバ経由でそのまま受け取り、9 列を写して表示する。列は 月 / 総収入 / 総支出 / 総収支 /
事業費 / 家計費 / 事業費へ寄せた件数 / 要確認件数 / トレンド。

クライアントでの再計算は加算 1 つも行わない。`総収支 = 総収入 − 総支出` のような自明な式であっても
フロントで計算しない。フロントが 1 箇所でも計算を持つと、サーバ導出値との差が生じたときに
どちらが正しいかを利用者が判断できず、G3 (検算可能性) が壊れる。

### 期間切替の経路

期間切替は既存の期間 UI が `PeriodQuery` を更新し、サーバ側で `resolvePeriodQuery` → `applyPeriod`
により `Dataset` を切り、切った Dataset を分析関数へ渡す経路に追随する。フロントは期間を
`@tanstack/react-query` のクエリキーの一部として持ち、期間が変われば別のキーとして再取得する。
分析関数へ期間引数を渡す経路はフロント側にも作らない。

### 判断の反映

「同じ/違う」判断は既存の取込明細編集画面から mutation として送る。成功時に月次トータル収支の
クエリを無効化して再取得し、一覧表の数字と要確認件数を同時に更新する。判断の直後だけ画面上の
内訳が動き総額が動かないことは正しい挙動で、支出は当該 MF 明細が家計費から事業費へ、収入は
当該 MF 入金が家計収入から事業収入へ移るだけである。総額が動いて見えた場合は消し込み側の欠陥で
あり、UI 側で辻褄を合わせない。

### トレンド列の表示

トレンド列は `trendDirection` が返す `TrendDirection` の 4 値をそのまま表示する。記帳月数が
`TREND_MIN_MONTHS` (6) 未満の期間では「判定不可」を明示的に描画し、空欄にしない。空欄は
「傾向が無い」と「判定できるだけの月数が無い」を利用者が区別できず、短い期間を選んだ利用者に
不具合と誤読させる。
