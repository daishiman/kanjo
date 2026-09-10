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
updated_at: "2026-09-06T00:18:57Z"
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
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-10-retire-tax-receipt-and-clarify-freee-only/completeness-findings.json", "evaluated_digest": "313d15d861b25509ad473928d72bd45c3f5686ec5afb8aa6472f5a1f01228d67"}
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

## P02 データモデルの確定 (dev-graph 所有)

上の本文は取込元の章の引用である。ここから下は dev-graph が P02 (`SYS-TCF-P02`) で確定させた
永続化モデルであり、引用元を書き換えずに追記している。

### 引用元の 2 点の事実誤り

- **主キーの誤り**: 本文 line 98 は「主キーは `MfTx.idStable` (安定識別子)」とするが、
  `MfTx.idStable` は `packages/core/src/types.ts:56-57` で `idStable?: boolean` と定義された
  真偽値であり、「true のときだけ MF 出力の ID 列による再取込跨ぎの同一性を保証できる」という
  **性質フラグ**である。識別子は `MfTx.id` (`types.ts:55`)。この記述のまま実装すると真偽値を
  主キーに置くことになる。
- **連番の誤り**: 本文 line 62 は「現行 0000〜0009」とするが、実際の `migrations/` は
  `0035_tx_edit_institution_and_split_owner.sql` まで存在する。新規マイグレーションは 0036 以降。

いずれも P03 の設計レビューで引用元へ差し戻す。以下の設計は実コードの実測に従う。

### `duplicate_verdicts` の定義

同一性は新規に発明せず、既存の 2 段解決 (DR-13) をそのまま使う。第一の鍵が `tx_id`、
第二が `stable_key` で、解決関数は `packages/core/src/identity.ts` の `resolveIdentity` /
`mfStableKey`。列の構成は `tx_edits` (`packages/api/src/db/schema.ts:96-124`) に揃える。

| 列 | 型 | 役割 |
|---|---|---|
| `user_id` | TEXT NOT NULL | 主キー第 1 要素 |
| `tx_id` | TEXT NOT NULL | 主キー第 2 要素。第一の鍵 |
| `verdict` | TEXT NOT NULL | `same` / `different` の 2 値 |
| `stable_key` | TEXT | 第二の鍵。重複しうるので UNIQUE にしない |
| `fingerprint_version` | INTEGER | 鍵の作り方の版。版違いは照合しない |
| `decided_at` | TEXT | 利用者が判断した時刻 |
| `updated_at` | TEXT | 最終更新時刻 |

一意キー: `PRIMARY KEY(user_id, tx_id)`。`tx_edits` (`migrations/0001_tx_edits_rules_owner.sql:18`)
と同じ形である。

### 再取込で行が増えない条件

書込は `ON CONFLICT(user_id, tx_id) DO UPDATE` の upsert 一経路に限る。これにより
同じ `tx_id` の再取込は既存行の更新になり、行は増えない。

MF が ID 列を振り直して `tx_id` が変わる場合 (`idStable` が true でない明細) は、書込前に
`resolveIdentity` を通し、`match: 'stable-key'` で返る `matchedTxId` を主キーに使って upsert する。
新しい `tx_id` で別行を作らない。ここを素通りさせると、判断を付けた明細が「消えて新しく現れた」
ように見え、同じ判断が版を跨いで二重に積まれる。`indexEditsByStableKey`
(`identity.ts:55-68`) と同じく、`stable_key` が衝突した場合は結び付けず、どちらの判断の持ち主か
決められないまま片方を選ぶことをしない。

`match: 'none'` かつ `tx_id` も不安定な明細は、判断を黙って落とさず保存要求を拒否して見せる
(本文 line 122 のリスク方針をそのまま適用する)。

### 保存しないもの

月次トータル収入・支出・収支、事業費/家計費の内訳、寄せた額と件数、トレンド判定は保存しない。
すべて要求時に導出する (`dec-aggregation-strategy-001`)。保存対象は「導出できない利用者の意思」
だけで、それが本テーブル 1 つである。
