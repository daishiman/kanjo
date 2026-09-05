---
graph_node_id: "arch-total-cashflow-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "トータル収支 — バックエンド構成"
project_id: "kanjo"
domain: "backend"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "backend"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-05T12:42:39Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements"]
resource_scope: ["packages/api/src", "packages/core/src"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/total-cashflow-backend.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/completeness-findings-r7.json", "evaluated_digest": "778e674fc0686dad4f026f0a3ecbeb663952ab43718e8594f91067dab5445a86"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.11", "source_digest": "778e674fc0686dad4f026f0a3ecbeb663952ab43718e8594f91067dab5445a86", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/backend.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G1,G2,G3,G5,G6 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G1", "G2", "G3", "G5", "G6"]
---

# トータル収支 — バックエンド構成

トータル収支一覧機能の backend 領域のアーキテクチャ。要件仕様は `spec-total-cashflow-requirements` を参照する。

> 本文の正本は `system-spec/backend.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G1, G2, G3, G5, G6

## Architecture overview

月次トータル収支の導出を `packages/core` の純関数として置き、`packages/api` の Hono ルートが
それを呼んで JSON で返す。集計結果は保存せず、要求のたびに canonical から導出する
(dec-aggregation-strategy-001)。トレンド判定は既存 `packages/core/src/trend.ts` の
Mann-Kendall / Theil-Sen をそのまま呼ぶ (dec-trend-method-001)。

## Context and drivers

本機能は「事業と家計が一体になった実態に対し、トータルでいくらプラスマイナスなのかが読めない」
という利用者の課題から出発している。現状 `analysis.ts` の `balanceMonth()` は Money Forward 側の
収支だけを balance とし、`comparison()` は事業と家計を左右に並べる割合ビューで合算しない。
単純合算ができないのは、個人カード・口座から払った事業経費 (bizAdvance) が freee にも記帳され、
事業口座から個人口座への振替 (bizIncome) が freee 売上の再登場であるため、収入・支出の双方で
二重計上が起きるからである。

バックエンドの駆動要因は、判定規則を 1 箇所に閉じ込めること (U8 制約) と、合計が利用者の手で
検算できること (G3) の 2 つである。どちらも「導出値を canonical と二重に持たない」設計から従う。

## Goals and non-goals

Goals: G1 (トータル 3 値の算出) / G2 (二重計上のない支出合計) / G3 (検算可能な内訳の提示) /
G5 (トータル支出のトレンド判定) / G6 (合算後も内訳を保持)。

Non-goals: 集計テーブルの新設、cron による事前計算、D1 の SQL ビューへの集計移譲。いずれも
検討のうえ棄却されている (前二者は検算可能性を壊し、後者は判定規則を二箇所へ複製するため)。
既存 `trend.ts` / `analysis.ts` の公開関数の意味変更も non-goal (追加のみ)。

## System context and boundaries

上流は既存の取込パイプライン (`import-pipeline.ts`) が書いた canonical。下流は web の分析タブ。
本ノードの境界は「canonical を読み、導出値を返す」ところまでで、canonical への書込は行わない。
唯一の書込面は `DuplicateVerdict` の upsert で、既存 `canonical-mutation-fence.ts` と同じ方針で
正本更新経路と分離する。

## Container and component view

- `packages/core`: 月次トータル収支の導出関数 (純関数)、重複判定器、要確認候補抽出器。
  既存 `expense-projection.ts` と同じく canonical を書き換えない読み取りモデルとして置く。
- `packages/api/src/routes`: 期間を範囲条件で受ける読み取りルートと、`DuplicateVerdict` の
  upsert ルート。いずれも `/api/*` 配下で既存認証ゲートの内側。
- `packages/core/src/trend.ts`: 既存。トータル支出系列を渡して判定を得るだけで、変更しない。

## Cross-cutting contracts

- 恒等式 `総支出 = 事業費 + 家計費` / `総収入 = 事業収入 + 家計収入` を、利用者判断の前後いずれでも保つ。
- 帰属を動かせるのは自動判定器 (MF 日付 = freee 発生日 かつ 金額一致) と利用者の明示判断のみ。
  候補抽出器 (±3 日) は合計を一切動かさない。
- 除外は freee 側の件数を上限 (`min(n, m)`) とし、freee に存在しない分の MF 明細を消さない。
- 期間は `core/src/period.ts` で切った Dataset を渡す。分析関数へ期間引数を配らない既存設計を崩さない。

## Subtype architecture

**backend**: 導出ロジックを core の純関数に置き、D1 にも Workers にも依存させない。ルートは
薄い変換層に留める。これにより判定規則を単体テストで直接固定でき、ロックインも生じない。

**api**: 読み取り 1 系統 + `DuplicateVerdict` upsert 1 系統。入出力は zod スキーマで検証し、
明細識別子は `MfTx.idStable` に限定する。期間指定は範囲条件で表現し、個別 ID の列挙を避ける
(D1 の 1 クエリあたりバインドパラメータ上限 100 を跨がないため)。API 契約そのものは
specification ノード `spec-total-cashflow-requirements` の「API契約」節が正本である。

## Architecture decisions

- `dec-trend-method-001` = `opt-mk-ts` (確定)。既存 `trend.ts` の Mann-Kendall + Theil-Sen に
  合わせる。一次根拠は外部文献ではなく本リポジトリの内部整合性 — 同一画面にカテゴリ別トレンドが
  並ぶため、判定基準・閾値・判定語を揃えないと表示が矛盾する。
- `dec-aggregation-strategy-001` = `opt-derive-on-request` (確定)。要求時に毎回導出する。

## Delivery, migration and rollback

既存 Workers への deploy 一経路。core への関数追加と routes への 2 ルート追加のみで、既存関数の
戻り値定義を変えないため後方互換。ロールバックは当該デプロイの巻き戻しで足り、データ移行を伴わない
(唯一のスキーマ追加は database ノード側の 1 マイグレーション)。

## Risks and verification

- リスク: 支払先を見ない判定のため、同額・同発生日の無関係な支出が事業費として扱われうる。
  既知の限界として仕様に明記済み (利用者判断で受容)。
- リスク: 期間を極端に長く取ると 1 リクエストあたりの計算量が増える。D1 の 1 呼出し 1,000 クエリ枠に
  迫るようなら設計を見直す。個人事業の月次数十行規模では当面到達しない。
- 検証: 恒等式・`min(n, m)` 基数・自動付替 0 件 (±3 日照合) を契約テストで固定する。各テストは
  旧実装に対して RED になることを先に確認する。
