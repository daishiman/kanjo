---
graph_node_id: "arch-total-cashflow-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "トータル収支 — 運用と異常への気付き方"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "maintenance-ops"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-05T12:42:39Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements"]
resource_scope: ["scripts", "migrations"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/total-cashflow-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-10-retire-tax-receipt-and-clarify-freee-only/completeness-findings.json", "evaluated_digest": "7f916ede6073bf90e8501649a140e54c570fcce61d09d6da14315aaf0fd7f529"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.11", "source_digest": "7f916ede6073bf90e8501649a140e54c570fcce61d09d6da14315aaf0fd7f529", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/maintenance-ops.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G4,G7 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G4", "G7"]
---

# トータル収支 — 運用と異常への気付き方

トータル収支一覧機能の maintenance-ops 領域のアーキテクチャ。要件仕様は `spec-total-cashflow-requirements` を参照する。

> 本文の正本は `system-spec/maintenance-ops.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G4, G7

## Architecture overview

要確認明細の放置と集計の異常には、CSV 取込の完了時点で気付かせる。取込完了時に要確認が残っていれば
その場で画面に警告を出す。メール・push・外部監視といった通知基盤は追加しない。

## Context and drivers

本機能は「事業と家計が一体になった実態に対し、トータルでいくらプラスマイナスなのかが読めない」
という利用者の課題から出発している。現状 `analysis.ts` の `balanceMonth()` は Money Forward 側の
収支だけを balance とし、`comparison()` は事業と家計を左右に並べる割合ビューで合算しない。
単純合算ができないのは、個人カード・口座から払った事業経費 (bizAdvance) が freee にも記帳され、
事業口座から個人口座への振替 (bizIncome) が freee 売上の再登場であるため、収入・支出の双方で
二重計上が起きるからである。

運用側の駆動要因は「要確認が黙って家計費へ紛れ込まないこと」(U5 成功基準) である。放置に気付く
仕組みが無ければ、要確認は件数として存在しても実質的に無視され、合計は静かに歪む。

## Goals and non-goals

Goals: G4 (要確認が理由付きで列挙され、判断が再適用される) / G7 (期間切替でも一貫)。

Non-goals: メール・push・外部監視といった通知基盤の追加、OS メジャー更新への追随サイクル、
ストア審査を含むリリース列 (第三者の審査に依存する工程を持たない)。

## System context and boundaries

運用は既存の deploy と日次 cron (`0 18 * * *` UTC) のみ。本機能は新しい定常作業を追加しない。

## Container and component view

- 取込完了時の画面警告: 要確認が残っている場合にその場で出す。既存の取込フローの終端に置く。
- 既存の日次 cron: D1→R2 バックアップ (30 日保持)。本機能のために変更しない。
- 既存 `audit-log.ts`: `DuplicateVerdict` の変更を追跡可能にする。

## Cross-cutting contracts

- 異常の通知経路は画面 1 本に閉じる。利用者が単独であるため、本人が操作している瞬間に見せるのが
  最も確実に届く。非同期の通知基盤は届いたかどうかの確認自体が新たな運用になる。
- 復旧手段は既存のまま。本機能のために新しい復旧経路を作らない。

## Subtype architecture

**infrastructure**: 運用の設計は「新しい定常作業を作らないこと」で成り立っている。集計を保存しない
選択がバッチ監視を不要にし、通知基盤を持たない選択が通知の到達確認を不要にしている。どちらも
単独運用者にとって実行され続ける運用だけを残すための判断である。

## Architecture decisions

- `qa-anomaly-notice-001` で利用者が「取込直後に画面で警告」を明示選択した。これは、アシスタントが
  利用者確認を経ずに書いていた「監視アラートの追加は行わない」という記述の訂正にあたる
  (通知基盤を増やさない点は一致するが、取込完了時点の画面警告は行う)。この決定は上位概念の制約へ
  追加され、O6 の測り方に「取込完了時に要確認が残っている場合に画面へ警告が出ること」が加わっている。

## Delivery, migration and rollback

既存 deploy 一経路。運用手順の追加を伴わないため、ロールバックは当該デプロイの巻き戻しで足りる。

## Risks and verification

- リスク: 画面警告は利用者がその画面を見ている瞬間にしか届かない。取込直後という最も注意が向いて
  いる時点に置くことでこれを緩和するが、見落とした場合の再通知は無い (要確認件数は一覧表に常時出る)。
- 検証: 取込完了時に要確認が残っている場合に画面へ警告が出ることをテストで固定する。
