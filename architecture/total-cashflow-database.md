---
graph_node_id: "arch-total-cashflow-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "トータル収支 — データ永続化構成"
project_id: "kanjo"
domain: "database"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "database"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-05T12:42:39Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements"]
resource_scope: ["migrations", "packages/api/src/db"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/total-cashflow-database.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/completeness-findings-r7.json", "evaluated_digest": "313d15d861b25509ad473928d72bd45c3f5686ec5afb8aa6472f5a1f01228d67"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.11", "source_digest": "313d15d861b25509ad473928d72bd45c3f5686ec5afb8aa6472f5a1f01228d67", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/database.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G2,G4,G7 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G2", "G4", "G7"]
---

# トータル収支 — データ永続化構成

トータル収支一覧機能の database 領域のアーキテクチャ。要件仕様は `spec-total-cashflow-requirements` を参照する。

> 本文の正本は `system-spec/database.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G2, G4, G7

## Architecture overview

既存 Cloudflare D1 (`kanjo-db`、SQLite 互換) を drizzle-orm 経由で使い、スキーマ変更は
`migrations/` の連番 SQL (現行 0000〜0009) へ追記する方式を踏襲する。本機能が新規に永続化するのは
`DuplicateVerdict` ただ 1 つで、他はすべて導出値として保存しない。

## Context and drivers

本機能は「事業と家計が一体になった実態に対し、トータルでいくらプラスマイナスなのかが読めない」
という利用者の課題から出発している。現状 `analysis.ts` の `balanceMonth()` は Money Forward 側の
収支だけを balance とし、`comparison()` は事業と家計を左右に並べる割合ビューで合算しない。
単純合算ができないのは、個人カード・口座から払った事業経費 (bizAdvance) が freee にも記帳され、
事業口座から個人口座への振替 (bizIncome) が freee 売上の再登場であるため、収入・支出の双方で
二重計上が起きるからである。

永続化の駆動要因は「何を保存しないか」の側にある。合計を保存すると canonical と乖離しうるが、
利用者にはどちらが正しいか判断する手段が無い。G3 (検算可能性) はこの乖離を構造的に許さない。

## Goals and non-goals

Goals: G2 (二重計上のない支出合計を支えるデータ基盤) / G4 (利用者判断の永続化と再適用) /
G7 (期間を切り替えても同じ規則で再計算される)。

Non-goals: 月次トータル収入・支出・収支、事業費/家計費の内訳、寄せた額と件数、トレンド判定の保存。
いずれも導出値であり専用テーブルを持たない。集計テーブルの新設は明示的に棄却されている。

## System context and boundaries

境界は「canonical テーブル群は読むだけ、書くのは `DuplicateVerdict` 1 テーブルだけ」。既存の
取込ライフサイクル (`0008_import_lifecycle.sql`) が管理する canonical のスキーマには一切触れない。

## Container and component view

- `migrations/`: `DuplicateVerdict` テーブルを作る新規連番 SQL を 1 本追加する。
- `packages/api/src/db`: drizzle スキーマ定義に当該テーブルを追加する。
- canonical テーブル群 (MF 明細・freee 取引・利用者の手当て): 読み取りのみ。

## Cross-cutting contracts

- `DuplicateVerdict` の主キーは `MfTx.idStable` (安定識別子)。識別子が不安定な明細は判断を保存しない。
- 再取込で明細が入れ替わっても `idStable` が同じなら判断が再適用される (既存ライフサイクルと同じ性質)。
- 追加テーブルのみで既存テーブルのスキーマを変更しないため後方互換を保つ。

## Subtype architecture

**data**: 保存対象を「導出できない利用者の意思」だけに絞ることが設計の核である。導出値を持たない
ことで、無効化タイミングという失敗モードそのものを設計から排除している。取込・取消・undo が
即座に合計へ反映され、再計算の仕込み漏れが原理的に起こりえない。

## Architecture decisions

- `dec-aggregation-strategy-001` = `opt-derive-on-request` (確定)。集計テーブル案 (B) と
  D1 SQL ビュー案 (C) はいずれも棄却。(B) は合計と明細の不一致が静かに起き利用者から検算不能、
  (C) は `min(n, m)` 基数規則を SQL とアプリの二箇所へ複製し「判定を 1 箇所に置く」制約に反する。

## Delivery, migration and rollback

新規連番 SQL 1 本の適用のみ。ロールバックは当該マイグレーションの逆適用で足りる。
復旧手段は既存のまま — 夜間 cron による D1→R2 バックアップ (30 日保持) と D1 time-travel を用い、
本機能のために新しい復旧経路を作らない。

## Risks and verification

- リスク: `idStable` が不安定な明細では判断を保存できない。これは黙って落とすのではなく保存要求を
  拒否して見せる方針で扱う。
- リスク: 将来データ量が D1 の 1 呼出し 1,000 クエリ枠に迫った場合は毎回導出の設計を見直す必要がある。
  上限の存在を仕様に明記済み。
- 検証: 判断が保存され再取込後も同じ明細へ再適用されることを結合テストで示す。
