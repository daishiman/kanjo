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
updated_at: "2026-09-06T00:18:57Z"
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
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-10-retire-tax-receipt-and-clarify-freee-only/completeness-findings.json", "evaluated_digest": "778e674fc0686dad4f026f0a3ecbeb663952ab43718e8594f91067dab5445a86"}
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

## P02 実装境界の確定 (dev-graph 所有)

上の本文は取込元の章の引用である。ここから下は dev-graph が P02 (`SYS-TCF-P02`) で確定させた
実装境界であり、引用元を書き換えずに追記している。根拠は本リポジトリの実コードの実測で、
参照は `file:line` で示す。

### 3 処理の層とファイル位置

各処理の住所を 1 箇所ずつ固定する。同じ判定が二箇所に現れることを設計段階で禁じる。

| 処理 | 層 | ファイル | 公開関数 |
|---|---|---|---|
| 消し込み (重複の帰属決定) | `packages/core` 純関数 | `packages/core/src/total-cashflow.ts` (新規) | `reconcileBizDuplicates` |
| 合算 (月次 9 列の導出) | `packages/core` 純関数 | 同上 | `monthlyTotalCashflow` |
| トレンド判定 | `packages/core` 既存 | `packages/core/src/trend.ts` | `mannKendall` / `theilSen` / `trendDirection` |

消し込みと合算を 1 モジュールに同居させるのは、両者が同じ読み取りモデル (canonical を書き換えない)
であり、`expense-projection.ts` と同じ置き方に揃うためである。ただし合算は消し込みの内部状態を
参照せず、`reconcileBizDuplicates` の戻り値だけを入力に取る。要確認候補の抽出 (±3 日) は
`reviewCandidates` として同モジュールに置くが、戻り値は帰属を含まず、合計を一切動かさない。
この分離が「候補抽出器は自身では帰属を変えない」という仕様上の安全性を型で支える。

### トレンド判定の再利用経路 (本文 line 100 との差異)

本文は `trend.ts` を「変更しない」としているが、方向判定 `TrendDirection` の導出は
`categoryTrends` の内部に直書きされており (`packages/core/src/trend.ts:218-219`)、公開関数が無い。
このまま「そのまま呼ぶ」を字面通りに実装すると、`n < TREND_MIN_MONTHS ? '判定不可' : mk.p <
TREND_ALPHA ? …` の三項式をトータル支出側へ複製することになり、「判定規則を 1 箇所に置く」という
本ノードの駆動要因 (U8 制約) に正面から反する。

確定: `trend.ts` に `trendDirection(series: number[]): TrendDirection` を**追加のみ**で切り出し、
`categoryTrends` はその新関数を呼ぶ形へ置き換える。既存公開関数の署名・戻り値・閾値
(`TREND_MIN_MONTHS=6` / `TREND_ALPHA=0.05`) は変えないため、本文 line 130 の「既存関数の戻り値定義を
変えないため後方互換」は保たれる。line 100 の「変更しない」は、非複製の再利用と両立しない記述として
P03 の設計レビューで引用元へ差し戻す。

### 期間の受け渡し

`monthlyTotalCashflow(data: Dataset)` は期間引数を取らない。呼び出し側が
`packages/core/src/period.ts` の `resolvePeriodQuery` → `applyPeriod` (内部で `sliceDataset`) で
切った `Dataset` を渡す。分析関数へ `from`/`to` を配る形は採らない。理由は既存設計の踏襲に加えて、
引数経路を増やすと期間を切り替えるたびに一部の設定だけが渡し漏れる失敗が起きるためで、
Dataset を切る方式ではその失敗モード自体が存在しない。

## P03 未解決事項の決着 (dev-graph 所有)

P03 (`eval-log/tcf-design-review.md`) が未解決として残した U1-U4 を、利用者判断 (2026-09-06) と
設計判断で決着させた。P04 の entry gate 「未解決の反例が 0 件」を満たすための確定である。

### U2 口座情報の使い方 — 「候補の絞り込みだけに使う」(利用者判断)

自動判定器の**肯定条件は変えない**。「MF 日付 = freee 発生日 かつ 金額一致」のままである。
加えて、口座が明らかに対応しない組を自動消し込みから外す**否定ガード**を置く。

```
accountsConflict(mf: MfTx, freee: FreeeDeal): boolean
  a = normalizeAccount(mf.inst)              // packages/core/src/types.ts:71
  b = normalizeAccount(freee.settleAccount)  // packages/core/src/types.ts:202
  if a === '' or b === '': return false      // 情報が無い側があればガードしない
  if a.includes(b) or b.includes(a): return false
  return true
```

`normalizeAccount` は NFKC 正規化 → 空白除去 → 「銀行 / 支店 / 普通 / 当座 / 口座 / カード」の
語を除去 → 小文字化。表記ゆれで取りこぼすより、対応しうる組を残す側へ倒す (包含判定・fail-open)。

ガードが true の組は事業費へ寄せず、理由「口座不一致」を付けて要確認一覧へ回す。要確認は帰属を
変えないため、`総支出 = 事業費 + 家計費` はガードの有無にかかわらず成立する。壊れるのは自動化率
だけで、数字の整合ではない。

これは仕様本文 line 146-147 の「支払先を用いない」と字面が異なる。肯定条件に支払先を加えたのでは
なく、否定ガードとして使う点が差分である。引用元への差し戻しは D4 として下に記録する。

### U1 寄せる行の全順序

同じ (金額, 発生日) の束の中で、どの行を寄せるかを次の全順序で決める。

- MF 側: `stable_key` 昇順 → 同値なら `tx_id` 昇順 (`packages/core/src/fingerprint.ts:80-81`)
- freee 側: `id` 昇順

突き合わせは freee 側を外側に回し、各 freee 行に対して `accountsConflict` が false な未使用の
MF 行のうち順序が最小のものを取る貪欲法とする。最大マッチングは採らない。束の大きさが 1-3 件の
規模では差が出ず、貪欲法の方が「なぜこの行が選ばれたか」を利用者へ説明できるためである。

**貪欲法が最大マッチングより少なく組む場合がありうる**。そのとき余った freee 行は要確認へ出る。
黙って誤った帰属になるのではなく、見える形で残る側の失敗にしている。

`idStable` が false の明細では `tx_id` に取込時の行番号が入る (`packages/core/src/parsers/mf.ts:64`)
ため、再取込で順序が変わりうる。同一束内の行は定義上同額なので 9 列の値は不変で、動くのは
ドリルダウンの行同一性だけである。この保証範囲の差を UI 側で偽装しない。

### U3 MF の `m` と `d` の月が一致する不変条件

現行の取込経路では `m` も `d` も同じセル `r[ci.dt]` から作られる
(`packages/core/src/parsers/mf.ts:54` と `:77`) ため常に一致する。照合日 `mfDate` は
`${tx.m}-${日}` で作る (`packages/core/src/expense-projection.ts:79-80`) ので、この一致が崩れた
入力元を将来足すと自動判定器が静かに壊れる。

確定: 請求月で束ねるなど `m` と `d` の月が食い違いうる取込元を追加する場合は、`mfDate` の導出を
`d` 側の月を採る形へ改める。この依存を P04 のテストで固定する (月が食い違う入力に対する検査)。

### U4 既存 `buildExpenseProjection` との矛盾 — 「既存照合を新しい規則へ寄せる」(利用者判断)

既存の支出照合は `date + amount + purpose + 支払先` を鍵にし、両側がちょうど 1 件のときだけ
照合する (`packages/core/src/expense-projection.ts:129-130` / `:176`)。新しい規則は
`date + amount` の束に対する `min(n, m)` である。同じ入力に 0 件と 2 件という違う答えが出る。

確定: **既存の支出照合を新しい規則へ寄せ、判定を 1 本にする**。`reconcileBizDuplicates` を
唯一の判定器とし、`buildExpenseProjection` はその戻り値を読む側へ変える。既存の厳しい鍵は
上の口座否定ガードへ役割を移す (purpose は鍵から外す)。

既存の受入テストは新しい期待値へ移行する。移行は P08 の責務として切り出し、P05 では
`reconcileBizDuplicates` の追加と `buildExpenseProjection` の委譲までを行う。

### D4 引用元への差し戻し (P03 の D1-D3 に追加)

- D4: 仕様本文 line 146-147 の「支払先を用いない」は、否定ガードとしての口座利用を許す形へ
  改める必要がある。肯定条件は変わらないため既知の限界の記述も併せて更新する。
