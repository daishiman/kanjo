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
related_nodes: ["spec-mf-business-classification", "feat-mf-business-classification"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations", "packages/api/wrangler.jsonc", "scripts"]
purpose: "個人事業主として事業と家計が一体になっている実態に対し、freee (事業帳簿) と Money Forward (家計) へ分かれて記録された収入・支出が、二重計上を含んだまま別々の数字として出ているため、「今月トータルでいくらプラスマイナスなのか」「費用が増えているのか減っているのか」が判断できない。重複を明細単位で消し込んだうえで 1 つの一覧表に束ね、消し込みの根拠ごと確認できる状態を作る。"
goal: "freee 正本と MF 残余を二重計上せず月次集計し、未判断候補を合計から隔離して利用者が根拠とともに確認できる。"
scope_in: ["freee 正本による重複消し込み", "spec-mf-business-classification の resolveTx による MF 公私帰属", "未判断候補の4区分外への隔離と reviewCount/reviewAmount", "same の総額不変", "different の独立残余MF加算", "判断の永続化・再適用", "月次集計と支出トレンド", "web表示"]
scope_out: ["mobile / tablet / desktop 各プラットフォーム向けの実装 (対象は web のみ)", "freee / Money Forward からの新規 API 連携取込経路の追加 (既存の取込パイプラインを入力とする)", "税務申告書類の生成・提出 (別 feature の責務)", "明細の分割 (transaction-splits) の新規仕様変更", "口座単位の残高照合や銀行 API 直接接続"]
acceptance: ["総収入と総支出が各事業/家計内訳の和に一致する", "自動完全一致はfreee正本だけを一度計上する", "未判断候補は4区分から除外されreviewCount/reviewAmountへ隔離される", "sameはfreee正本を維持して総額不変、differentは独立残余MFとしてresolveTx区分へ加算される", "判断が再取込後も再適用される", "既存基準の支出トレンドと期間再計算が一致する", "webが検算根拠と要確認を表示する"]
architecture_refs: ["spec-total-cashflow-requirements", "arch-total-cashflow-backend", "arch-total-cashflow-database", "arch-total-cashflow-frontend", "arch-total-cashflow-ui-ux", "arch-total-cashflow-auth", "arch-total-cashflow-security", "arch-total-cashflow-infrastructure", "arch-total-cashflow-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-total-cashflow.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-10-retire-tax-receipt-and-clarify-freee-only/completeness-findings.json", "evaluated_digest": "5c09c96c9e8beec154d8ec3b7b595130486284cc31e670fff3074e7119422527"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-10-retire-tax-receipt-and-clarify-freee-only/00-requirements-definition.md", "source_version": "0.1.11", "source_digest": "5c09c96c9e8beec154d8ec3b7b595130486284cc31e670fff3074e7119422527", "imported_at": "2026-09-05T13:20:00Z"}
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

# トータル収支一覧

本 feature は freee 正本、MF 残余、重複候補を月次の読み取りモデルへ束ねる。MF 公私判定と要確認集計の現行規則は `specs/spec-mf-business-classification.md` が本 feature の旧記述を改訂する。

## 固有契約

- 自動完全一致と `verdict=same` は freee 正本だけを維持し、総額を変えない。
- `verdict=different` は候補 MF を独立した残余として `resolveTx` の事業/家計・収入/支出区分へ加算する。
- 未判断候補は4区分へ入れず、`reviewCount` / `reviewAmount` と要確認一覧へ隔離する。
- 判断後も総収入・総支出は、それぞれ事業/家計内訳の和と一致する。
- 消し込み、期間集計、既存トレンド、web表示は本 feature の責務を維持する。

スコープと受入状態は frontmatter を唯一の正本とし、本文にチェックボックスを複製しない。実装差分は子 feature `feat-mf-business-classification`、詳細な規則は `specs/spec-total-cashflow-system.md` と canonical MF spec を参照する。
