---
graph_node_id: "arch-total-cashflow-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "トータル収支 — UI/UX 構成"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "ui-ux"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-05T12:42:39Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements"]
resource_scope: ["packages/web/src/components", "packages/web/src/pages"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/total-cashflow-ui-ux.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-10-retire-tax-receipt-and-clarify-freee-only/completeness-findings.json", "evaluated_digest": "0ae53d13baeaefe134054d1bca4ca872f9bc0904ec65ff2356bddcd526c14368"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.11", "source_digest": "0ae53d13baeaefe134054d1bca4ca872f9bc0904ec65ff2356bddcd526c14368", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/ui-ux.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G1,G3,G4,G6,G7 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G1", "G3", "G4", "G6", "G7"]
---

# トータル収支 — UI/UX 構成

トータル収支一覧機能の ui-ux 領域のアーキテクチャ。要件仕様は `spec-total-cashflow-requirements` を参照する。

> 本文の正本は `system-spec/ui-ux.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G1, G3, G4, G6, G7

## Architecture overview

一覧表は 月・総収入・総支出・総収支・事業費・家計費・事業費へ寄せた件数・要確認件数・トレンド の
**9 列すべてを常時表示**する。小画面でも列を落とさない。個別明細と勘定科目別の内訳は表に常置せず、
行からのドリルダウンで見せる。

## Context and drivers

本機能は「事業と家計が一体になった実態に対し、トータルでいくらプラスマイナスなのかが読めない」
という利用者の課題から出発している。現状 `analysis.ts` の `balanceMonth()` は Money Forward 側の
収支だけを balance とし、`comparison()` は事業と家計を左右に並べる割合ビューで合算しない。
単純合算ができないのは、個人カード・口座から払った事業経費 (bizAdvance) が freee にも記帳され、
事業口座から個人口座への振替 (bizIncome) が freee 売上の再登場であるため、収入・支出の双方で
二重計上が起きるからである。

UI の駆動要因は G3 (検算可能性) である。合計だけを見せて内訳を隠すと、利用者は「なぜこの額なのか」
を自分で説明できない。9 列常時表示はこの説明可能性を画面上で保証するための構成である。

## Goals and non-goals

Goals: G1 (1 行で全体のプラスマイナスが読める) / G3 (内訳列と要確認件数で利用者が検算できる) /
G4 (要確認の可視化) / G6 (内訳へのドリルダウン) / G7 (期間切替への一貫追随)。

Non-goals: 小画面向けの列削減、判断専用画面やタブの新設、個別明細の表への常置。

## System context and boundaries

境界は表示と入口の設計まで。判断の保存規則や合計の算出規則は backend / database ノードの責務であり、
UI はそれを表示し操作の入口を提供するに留まる。

## Container and component view

- 月次一覧表コンポーネント: 9 列 + 合計行。横スクロール領域に収める。
- 行ドリルダウン: 事業側・家計側の内訳、勘定科目別内訳をここで見せる。
- 要確認件数の表示と、既存の取込明細編集画面への導線。
- 取込完了時の画面警告: 要確認が残っていればその場で出す。

## Cross-cutting contracts

- 9 列は常時表示。プラットフォーム固有の操作規約 (HIG / Material Design) にある小画面向け列削減は、
  目的適合の理由から採らない。
- 判断の入口は既存の取込明細編集画面に置く。判断専用の画面やタブを新設しない。
- 表示される数字はすべてサーバ導出値。UI はこれを加工しない。

## Subtype architecture

**frontend**: 情報優先度の方針は「合計 → 内訳 → 要確認件数 → トレンド」の順で、どれも落とさず
常置する。落とす対象は個別明細と勘定科目別内訳で、これらはドリルダウンへ送る。この方針の
具体化 (information-priority-map の生成と機械検証) は下流の生成工程の責務であり、要件段階では方針までを確定する。

## Architecture decisions

- 列構成は `qa-table-columns-001` / `appr-foundation-total-cashflow-005` で利用者が明示選択した
  「9 列すべて常時表示」。この決定は上位概念の制約へ追加され、O6 の測り方に
  「9 列すべてが常時表示されること」が加わっている。
- 異常への気付き方は `qa-anomaly-notice-001` で「取込直後に画面で警告」を利用者が選択した。

## Delivery, migration and rollback

既存の分析タブ群へ新しいタブとして追加する。既存タブの表示を変えないため、ロールバックは
当該デプロイの巻き戻しで足りる。

## Risks and verification

- リスク: 9 列は横幅が広く、狭い画面では横スクロールが常態になる。列を落とさない判断は利用者が
  承認済みだが、スクロール領域がページ本体に漏れると操作性を損なうため構造で防ぐ。
- 検証: 9 列常時表示、取込完了時の警告表示、行ドリルダウンの到達性を DOM テストで固定する。
