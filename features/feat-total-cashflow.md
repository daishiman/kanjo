---
graph_node_id: "feat-total-cashflow"
artifact_kind: "feature"
artifact_subtypes: []
title: "トータル収支一覧 (事業+家計の合算)"
project_id: "kanjo"
domain: "total-cashflow"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "macro-feature", "web"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T13:20:00Z"
updated_at: "2026-09-05T21:07:31Z"
depends_on: []
related_nodes: []
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations", "packages/api/wrangler.jsonc", "scripts"]
purpose: "個人事業主として事業と家計が一体になっている実態に対し、freee (事業帳簿) と Money Forward (家計) へ分かれて記録された収入・支出が、二重計上を含んだまま別々の数字として出ているため、「今月トータルでいくらプラスマイナスなのか」「費用が増えているのか減っているのか」が判断できない。重複を明細単位で消し込んだうえで 1 つの一覧表に束ね、消し込みの根拠ごと確認できる状態を作る。"
goal: "月ごとのトータル収入・トータル支出・トータル収支と、事業側/家計側の内訳、支出トレンドの判定 (増加/減少/横ばい/判定不可) を 1 つの一覧表で確認でき、合計が 事業費 (freee 正) + 家計費 (MF 残余) として利用者の手で検算でき、自動で寄せられなかった重複候補は要確認として理由付きで列挙され、一度下した「同じ/違う」の判断が次回以降の取込へ再適用される状態。"
scope_in: ["MF 日付 == freee 発生日 かつ 金額一致 の支出を「事業で使う費用」として freee を正に事業側へ一度だけ計上する消し込み", "消し込み後の月次トータル収入・トータル支出・トータル収支の算出と、事業側/家計側の内訳保持", "MF の分類が事業・副業の収入を事業収入、それ以外を家計収入として集計する収入側の合算", "自動で寄せられなかった重複候補の要確認キューと、利用者の同じ/違う判定の永続化・次回取込への再適用", "収入側の要確認判定で「同じ」とされた明細を家計収入から事業収入へ移す反映", "既存 trend.ts と同一統計基準 (Mann-Kendall / Theil-Sen) によるトータル支出のトレンド判定", "期間切替時に合算・消し込み・トレンド判定が同じ規則で再計算される一覧表 UI (web)", "事業側へ寄せた金額と件数の一覧表内での明示 (利用者による検算根拠)"]
scope_out: ["mobile / tablet / desktop 各プラットフォーム向けの実装 (対象は web のみ)", "freee / Money Forward からの新規 API 連携取込経路の追加 (既存の取込パイプラインを入力とする)", "税務申告書類の生成・提出 (別 feature の責務)", "明細の分割 (transaction-splits) の新規仕様変更", "口座単位の残高照合や銀行 API 直接接続"]
acceptance: ["月次一覧表に トータル収入 / トータル支出 / トータル収支 の 3 列が表示され、総支出 == 事業費 + 家計費 および 総収入 == 事業収入 + 家計収入 が全ての表示月で成立する", "MF 日付 == freee 発生日 かつ 金額一致 の支出について、freee 側 1 件だけが事業費に計上され、同一金額の MF 側明細が家計費に残らない", "一覧表に 事業側へ寄せた金額と件数 が表示され、その値が消し込み対象明細の実数と一致する", "金額または日付が一致しない重複候補が要確認として理由付きで列挙され、0 件のときは 0 件と明示される", "要確認明細に「同じ」判定を下した後、同じ入力を再取込しても判定が保持され、集計結果が変わらない", "収入側の要確認明細を「同じ」と判定すると、その明細が家計収入から事業収入へ移り、総収入は不変である", "トータル支出のトレンド判定が trend.ts と同じ Mann-Kendall / Theil-Sen で計算され、同一データに対し既存の事業単独トレンドと同じ統計手続きを踏んだ結果を返す", "期間を切り替えて再計算した各月の値が、別の期間指定で同じ月を含めたときの値と一致する", "月次一覧表の 9 列 (月・総収入・総支出・総収支・事業費・家計費・事業費へ寄せた件数・要確認件数・トレンド) が画面幅にかかわらず 1 列も欠けずに表示され、横スクロールは表領域の内側だけで発生しページ本体は横スクロールしない", "CSV 取込の完了時点で要確認が 1 件以上残っている場合に画面へ警告が表示され、0 件のときは警告が表示されない (qa-anomaly-notice-001)"]
architecture_refs: ["spec-total-cashflow-requirements", "arch-total-cashflow-backend", "arch-total-cashflow-database", "arch-total-cashflow-frontend", "arch-total-cashflow-ui-ux", "arch-total-cashflow-auth", "arch-total-cashflow-security", "arch-total-cashflow-infrastructure", "arch-total-cashflow-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-total-cashflow.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/completeness-findings-r7.json", "evaluated_digest": "5c09c96c9e8beec154d8ec3b7b595130486284cc31e670fff3074e7119422527"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.11", "source_digest": "5c09c96c9e8beec154d8ec3b7b595130486284cc31e670fff3074e7119422527", "imported_at": "2026-09-05T13:20:00Z"}
classification_confidence: 1.0
classification_reason: "確定済み要件定義書 (U1-U9) の全体が 1 つの利用者価値 — 事業と家計を合算したトータル収支の一覧表 — に収束しており、G1-G7 は互いに前提を共有して単独では成立しない(消し込みなしに合計は出せず、合計なしにトレンドは判定できない)。よって macro 層では分割せず 1 feature とする。分割候補は無く確信度 1.0。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-total-cashflow.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T13:20:00Z"}
---

# 目的

個人事業主として事業と家計が一体になっている実態に対し、freee (事業帳簿) と Money Forward (家計) へ分かれて記録された収入・支出が、二重計上を含んだまま別々の数字として出ているため、「今月トータルでいくらプラスマイナスなのか」「費用が増えているのか減っているのか」が判断できない。重複を明細単位で消し込んだうえで 1 つの一覧表に束ね、消し込みの根拠ごと確認できる状態を作る。

## 到達状態

月ごとのトータル収入・トータル支出・トータル収支と、事業側/家計側の内訳、支出トレンドの判定 (増加/減少/横ばい/判定不可) を 1 つの一覧表で確認でき、合計が 事業費 (freee 正) + 家計費 (MF 残余) として利用者の手で検算でき、自動で寄せられなかった重複候補は要確認として理由付きで列挙され、一度下した「同じ/違う」の判断が次回以降の取込へ再適用される状態。

## スコープ

- スコープ内:
  - MF 日付 == freee 発生日 かつ 金額一致 の支出を「事業で使う費用」として freee を正に事業側へ一度だけ計上する消し込み
  - 消し込み後の月次トータル収入・トータル支出・トータル収支の算出と、事業側/家計側の内訳保持
  - MF の分類が事業・副業の収入を事業収入、それ以外を家計収入として集計する収入側の合算
  - 自動で寄せられなかった重複候補の要確認キューと、利用者の同じ/違う判定の永続化・次回取込への再適用
  - 収入側の要確認判定で「同じ」とされた明細を家計収入から事業収入へ移す反映
  - 既存 trend.ts と同一統計基準 (Mann-Kendall / Theil-Sen) によるトータル支出のトレンド判定
  - 期間切替時に合算・消し込み・トレンド判定が同じ規則で再計算される一覧表 UI (web)
  - 事業側へ寄せた金額と件数の一覧表内での明示 (利用者による検算根拠)
- スコープ外:
  - mobile / tablet / desktop 各プラットフォーム向けの実装 (対象は web のみ)
  - freee / Money Forward からの新規 API 連携取込経路の追加 (既存の取込パイプラインを入力とする)
  - 税務申告書類の生成・提出 (別 feature の責務)
  - 明細の分割 (transaction-splits) の新規仕様変更
  - 口座単位の残高照合や銀行 API 直接接続

## 受入

- [ ] 月次一覧表に トータル収入 / トータル支出 / トータル収支 の 3 列が表示され、総支出 == 事業費 + 家計費 および 総収入 == 事業収入 + 家計収入 が全ての表示月で成立する
- [ ] MF 日付 == freee 発生日 かつ 金額一致 の支出について、freee 側 1 件だけが事業費に計上され、同一金額の MF 側明細が家計費に残らない
- [ ] 一覧表に 事業側へ寄せた金額と件数 が表示され、その値が消し込み対象明細の実数と一致する
- [ ] 金額または日付が一致しない重複候補が要確認として理由付きで列挙され、0 件のときは 0 件と明示される
- [ ] 要確認明細に「同じ」判定を下した後、同じ入力を再取込しても判定が保持され、集計結果が変わらない
- [ ] 収入側の要確認明細を「同じ」と判定すると、その明細が家計収入から事業収入へ移り、総収入は不変である
- [ ] トータル支出のトレンド判定が trend.ts と同じ Mann-Kendall / Theil-Sen で計算され、同一データに対し既存の事業単独トレンドと同じ統計手続きを踏んだ結果を返す
- [ ] 期間を切り替えて再計算した各月の値が、別の期間指定で同じ月を含めたときの値と一致する
- [ ] 月次一覧表の 9 列 (月・総収入・総支出・総収支・事業費・家計費・事業費へ寄せた件数・要確認件数・トレンド) が画面幅にかかわらず 1 列も欠けずに表示され、横スクロールは表領域の内側だけで発生しページ本体は横スクロールしない
- [ ] CSV 取込の完了時点で要確認が 1 件以上残っている場合に画面へ警告が表示され、0 件のときは警告が表示されない (qa-anomaly-notice-001)

## アーキテクチャ参照

`architecture_refs` (本文は複製せず参照のみ。正本は `system-spec/`):

- `spec-total-cashflow-requirements`
- `arch-total-cashflow-backend`
- `arch-total-cashflow-database`
- `arch-total-cashflow-frontend`
- `arch-total-cashflow-ui-ux`
- `arch-total-cashflow-auth`
- `arch-total-cashflow-security`
- `arch-total-cashflow-infrastructure`
- `arch-total-cashflow-maintenance-ops`

## 機能間依存

- `depends_on`: なし (本 feature が macro 層の最初の 1 件)
- 依存理由: G1-G7 は互いに前提を共有し単独では成立しないため 1 feature に収める。
  先行して満たすべき別 feature は無く、ready 状態である。

## 触れる範囲

- `packages/core/src`
- `packages/api/src`
- `packages/web/src`
- `migrations`
- `packages/api/wrangler.jsonc`
- `scripts`

## Handoff

- per-feature planning: ready のため `run-system-dev-plan` を `--feature-id feat-total-cashflow` と
  `--feature-context features/feat-total-cashflow.context.json` で起動する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature=feat-total-cashflow` / 共通 `feature_package_id` で C02 経由 atomic 登録。
  expected/applied=13 必須。
- 完了 rollup: exact 13 全 done かつ P07/P10/P11 の evidence が上記「受入」を満たす場合だけ done。
