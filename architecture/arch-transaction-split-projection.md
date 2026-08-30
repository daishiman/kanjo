---
graph_node_id: "arch-transaction-split-projection"
artifact_kind: "architecture"
artifact_subtypes: ["backend", "frontend", "data"]
title: "明細の分割記帳を投影で解く境界"
project_id: "kanjo"
domain: "backend"
status: "draft"
owners: []
tags: ["splits", "classify", "projection"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-30T00:00:00Z"
updated_at: "2026-08-30T00:00:00Z"
depends_on: []
related_nodes: ["feat-transaction-split-readability", "arch-tax-preparation-boundary"]
resource_scope: ["architecture/arch-transaction-split-projection.md"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-transaction-split-projection.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "manual-review", "evidence_ref": "tasks/transaction-split-readability-tasks.md", "evaluated_digest": null}
source_lineage: {"origin_kind": "manual", "source_plugin": null, "source_path": "specs/transaction-splits.md", "source_version": "1.1", "source_digest": null, "imported_at": "2026-08-30T00:00:00Z"}
classification_confidence: 1.0
classification_reason: "1明細をN行へ置き換える操作が、集計・証憑・申告・取込の4経路をまたぐ横断契約であるためアーキテクチャ層。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": ["tasks/transaction-split-readability-tasks.md"]}
implementation_readiness: {"status": "ready", "missing_sections": [], "checked_at": "2026-08-30T00:00:00Z"}
purpose: "1件の明細を内訳N行へ分ける操作を、保存済みデータの書き換えではなく読み出し時の投影として閉じる。"
goal: "分割の有無が集計・証憑・申告・取込のどこにどう届くかが1箇所で決まり、内訳が壊れているときは銀行の記録側へ倒れる。"
scope_in: ["tx_splitsの永続境界", "projectAccountingDatasetによる投影点", "fail-closedの判定条件", "証憑の添付先", "分割エディタの表示境界"]
scope_out: ["freee帳簿への書き戻し", "内訳ごとの証憑添付", "identity_stable=0の明細の分割"]
---

# 解く問題

銀行の明細は「10万円 引き落とし」の1行しか持たない。中身が電気代・携帯・税金の混在なら、
何にいくら使ったかはどこにも残らない。後から人が割るしかない。

だが割った瞬間、**同じ支出について2つの記録**ができる。銀行が言う1行と、人が入れたN行。
この2つが食い違ったとき、どちらを集計に使うかが決まっていないと、二重計上か計上漏れが
静かに起きる。分割の設計とは、この優先順位を1箇所に固定することである。

# 決定

## D1. 内訳は保存データを書き換えず、読み出し時に投影する

`tx_splits` は親取引とは別テーブルに置き、正規化された明細(`tx`)には触れない。
集計は `projectAccountingDataset()` が `structuredClone` → `applySplits` →
`recomputeClassification` の順に走り、**親1行を内訳N行へ置き換える**。

- 却下案: 取込時に明細そのものをN行へ分解して保存する
  → 再取込のたびに人の入力が消えるか、重複する。銀行の記録が人の入力に汚染される。

投影点が1つなので、「どの画面に分割が届くか」は投影を通るかどうかだけで決まる。
API側は `loadDataset({ withSplits })` の既定を `true` にし、raw canonical が要る
取込計画の下見だけが明示的に `false` を渡す。

## D2. 子行は既存の手動編集の枠に入れる

子行は `projectedEdit` に `cls`/`big`/`mid` を持ち、`resolveTx` が
`t.projectedEdit ?? edits[t.id]` の順で読む。分割専用の仕分け経路を作らない。

- 理由: 仕分けの解決順序(ルール・手動編集・既定)はすでに1本ある。分割のために
  2本目を通すと、「なぜこの科目になったか」の説明が経路ごとに分岐する。

## D3. 食い違ったら銀行の記録へ倒す(fail-closed)

合計不一致・親金額の変動・`line_id`重複・`identity_stable=0` のいずれかで、
**内訳を集計へ出さず親の金額のまま数える**。そのうえで `splitProjection.state` を
画面へ返し、要確認であることを見せる。

- 却下案: 差額を「未分類」の内訳として自動で足す
  → 人の入力ミスが自動で埋め立てられ、間違いに気づく機会が消える。
- 却下案: 不整合な内訳を黙って隠す
  → 直せない不整合が画面から見えなくなる。倒すことと隠すことは違う。

## D4. 証憑は親取引に1件だけ

領収書は物理的に1枚なので、添付先も1つにする。`receipts.ts` は
`splitProjection.kind === 'split'` の子行を `parentTxId` へ畳み、棚卸しの
`accounts` には内訳の科目をすべて並べる。

- 却下案: 内訳ごとに添付できるようにする
  → 領収書1枚に対して添付先がN個できる。どれが正かが決まらない。

## D5. 事業科目別へは合流させない

確定申告書の科目別金額は freee 帳簿(`data.biz.categories`)が正本である。
MF側の分割は **事業立替の合計**までを持ち、事業の科目別内訳へは流さない。

- 理由: 同じ支出が freee と MF の両方から科目別へ入ると二重計上になる。
  正本を2つ持たない、という `arch-tax-preparation-boundary` の D3 と同じ立場。

## D6. 分割エディタでは科目パネルを浮かせない

`CategoryPicker` の `.cat-panel` は全画面共通で `position: absolute` だが、
**浮かせた要素は最も近いスクロール祖先で切られる**。分割の表は明細一覧の
スクロール枠の内側に展開されるため、460pxのパネルが2〜3行ぶんの小窓になっていた。

分割エディタ内だけ `position: static` にし、行の高さが伸びる副作用を受け入れる。
表の内側にスクロール枠(`overflow`)を作らないこと自体が契約であり、
`packages/web/scripts/check-mobile-layout.mjs` の不変条件9が実描画で固定する。

- 却下案: portal で body 直下へ出す
  → 位置追従と閉じ判定を自前で持つことになる。CSS だけで済む問題に状態を足さない。

# 影響

- `migrations/0025_tx_splits.sql`(expand)、`(user_id, tx_id, seq)` / `(user_id, line_id)` の一意索引
- 合計一致はDB制約ではなくアプリで検証する(行集合に対する制約はD1に置けない)
- 子行への quick/edit は 409 で拒否し、責務を分割エディタへ集約する
- `docs/data-schema.md`「明細の分割記帳(tx_splits)の投影先」に合流先の一覧を持つ

# 検証

`tasks/transaction-split-readability-tasks.md` の受入証拠台帳を正とする。
規範詳細は `specs/transaction-splits.md`。
