---
graph_node_id: "arch-total-cashflow-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "トータル収支 — インフラ構成と算出戦略"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "infrastructure"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-05T12:42:39Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements"]
resource_scope: ["packages/api/wrangler.jsonc"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/total-cashflow-infrastructure.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-10-retire-tax-receipt-and-clarify-freee-only/completeness-findings.json", "evaluated_digest": "2e0294fec0e238866bfe2ecffee52e662bbdc1638f3d143e86eee7149b1bdbcf"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.11", "source_digest": "2e0294fec0e238866bfe2ecffee52e662bbdc1638f3d143e86eee7149b1bdbcf", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/infrastructure.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G1,G7 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G1", "G7"]
---

# トータル収支 — インフラ構成と算出戦略

トータル収支一覧機能の infrastructure 領域のアーキテクチャ。要件仕様は `spec-total-cashflow-requirements` を参照する。

> 本文の正本は `system-spec/infrastructure.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G1, G7

## Architecture overview

インフラ構成は変えない。既存の Cloudflare Workers (`kanjo-console`) + D1 (`kanjo-db`) +
R2 (`kanjo-files`) の 1 系統に載せ、新しいスケジュール実行・新しいデータストア・新しい監視を
いずれも追加しない。月次トータル収支は要求時に canonical から毎回導出する。

## Context and drivers

本機能は「事業と家計が一体になった実態に対し、トータルでいくらプラスマイナスなのかが読めない」
という利用者の課題から出発している。現状 `analysis.ts` の `balanceMonth()` は Money Forward 側の
収支だけを balance とし、`comparison()` は事業と家計を左右に並べる割合ビューで合算しない。
単純合算ができないのは、個人カード・口座から払った事業経費 (bizAdvance) が freee にも記帳され、
事業口座から個人口座への振替 (bizIncome) が freee 売上の再登場であるため、収入・支出の双方で
二重計上が起きるからである。

インフラ側の駆動要因は「性能上の必要性が無いまま正しさを犠牲にしない」ことである。毎回導出が
成立することは、D1 の公式上限と本機能の実データ量を突き合わせて確認済みである。

## Goals and non-goals

Goals: G1 (一覧表の算出) / G7 (期間切替でも矛盾しない再計算)。

Non-goals: cron による夜間事前計算、集計テーブルの新設、D1 SQL ビューへの集計移譲、
アプリストアやインストーラによる配布経路、コード署名鍵の保管。

## System context and boundaries

配信は Cloudflare Workers への deploy 一経路に閉じる。署名鍵という長期秘密を新たに抱えない。
既存の日次 cron (`0 18 * * *` UTC) はバックアップ用途のままで、本機能の集計には関与しない。

## Container and component view

- Workers `kanjo-console`: 追加 API を含め既存の 1 Worker に載る。
- D1 `kanjo-db`: canonical と `DuplicateVerdict` を保持する。
- R2 `kanjo-files`: 既存のバックアップ先。本機能では新たな用途を持たない。

## Cross-cutting contracts

D1 の公式上限を設計制約として明示的に扱う: 1 呼出しあたりクエリ数 1,000 (Workers Paid)、
SQL 文の最大長 100KB、クエリ最大実行時間 30 秒、1 クエリのバインドパラメータ最大 100。
期間指定は範囲条件で表現し、個別 ID の列挙を避ける。

## Subtype architecture

**infrastructure**: 「増やさない」ことが構成である。集計テーブルを持たないため、取込・取消・undo の
たびに再計算を仕込む必要がなく、バッチの失敗検知・再実行手順・再計算漏れの監視という運用面が
そもそも発生しない。導出ロジックは core の純関数に置き、D1 にも Workers にも依存させない。

## Architecture decisions

- `dec-aggregation-strategy-001` = `opt-derive-on-request` (確定、`qa-decision-aggregation-002` で
  代替案 B・C を提示のうえ利用者が明示選択)。この記録は、前サイクルの `qa-infrastructure-web-001` が
  代替案を示さない Yes/No 誘導であったという独立ヒアリング監査の指摘を受けて取り直したものである。
  毎回導出の成立は公式出典 `cloudflare-d1-limits` と本機能の実データ量 (月次数十行規模) の
  突き合わせで確認済み。

## Delivery, migration and rollback

既存 deploy 一経路。インフラ構成の変更を伴わないため、ロールバックは当該デプロイの巻き戻しで足りる。

## Risks and verification

- リスク: 将来データ量が D1 の 1 呼出し 1,000 クエリ枠に迫った場合は毎回導出の設計を見直す必要がある。
  上限の存在を仕様に明記済み。
- リスク: キャッシュを持たないため、同じ月を繰り返し開くと毎回計算する。個人利用の頻度では
  問題にならないが、前提として記録しておく。
- 検証: 期間指定がバインドパラメータ上限 100 を跨がないことを、既存 `d1-limits.ts` の枠組みで固定する。
