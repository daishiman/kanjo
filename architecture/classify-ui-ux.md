---
graph_node_id: "arch-classify-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "明細仕分け — 問いと件数から 3 カラムの確定、結果の通知までの 1 画面"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "ui-ux"]
file_path: "architecture/classify-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "7afdc6ecbca54a0a7aeb3e4498bc6a9cbe6b98c8f58cd8f1c18ca364ec711f62"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "7afdc6ecbca54a0a7aeb3e4498bc6a9cbe6b98c8f58cd8f1c18ca364ec711f62", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-frontend", "arch-classify-backend", "arch-classify-database", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-auth"]
resource_scope: ["packages/web/src/pages/classify/", "packages/web/src/pages/Classify.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/Term.tsx", "packages/web/src/glossary.ts", "docs/ui-decisions.md", "design/FINAL-UI/images/13-classify.png"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec の ui-ux 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/classify-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G1", "G3", "G4", "G5"]
---

# Architecture overview

明細仕分け — 問いと件数から 3 カラムの確定、結果の通知までの 1 画面。`system-spec/ui-ux.md` は承認時入力、本書は画面構成・操作の流れ・表示の約束の制約を持つ。目標の見た目は `design/FINAL-UI/images/13-classify.png`、逐語の正本は `specs/spec-classify-screen.md`。

## Context and drivers

- Business/technical context: 現行の仕分け画面 (`packages/web/src/pages/Classify.tsx`) は一覧と編集を持つが、分類ステータスの KPI・自動提案の信頼度と根拠・一括操作・ルールのプレビュー・保存フィルタ・履歴を持たない。共通部品は `components/Page.tsx` (`PageShell` / `PageHeader` / `PageState` / `KpiCard`)・`Button.tsx`・`ConfirmDialog.tsx`・`Term.tsx` と用語集 `glossary.ts`。画面の決定は `docs/ui-decisions.md` に残る (qa-classify-ui-ux-web-evidence-001)。
- Quality attribute priorities: G1・G3・G4・G5 に資する。1 画面で『何件残っていて、どれから確定するか』に答え、確定までの操作を短くする。
- Constraints: 分類は 3 区分 (未整理・手動変更・完了) で排他。要確認は未整理の内訳。色だけに頼らない。証憑欄を戻さない (qa-classify-decision-001)。

## Goals and non-goals

- Goals:
  - G1: 画面を (1) 問いと期間、(2) KPI 4 枚 (未整理・要確認・手動変更・完了)、(3) 絞り込み、(4) 一覧、(5) 編集パネル、(6) 一括操作バー、(7) 結果の通知 で構成する (qa-classify-ui-ux-web-003)。要確認のカードには『未整理のうち』を添え、区分が 3 つであることを読み違えさせない。
  - G3: 一覧のチェックで複数を選び、一括操作バーで区分・カテゴリを変えて保存し、明細ごとの成否を通知する。
  - G4: 一括操作バーか編集パネルからルールを作り、保存前に適用される明細と件数をプレビューで見せる。
  - G5: 保存フィルタで絞り込みを呼び出し、編集パネルで明細の履歴を見せる。
- Non-goals:
  - 証憑の添付・プレビュー (代わりに freee で管理する旨を案内する)
  - 提案の出所を『AI』と表示すること (表示は『自動提案』)
  - 他の画面の作り直し

## System context and boundaries

- Users/external systems: 家計と事業の明細を仕分ける利用者本人。
- Trust/deployment/data boundaries: 画面は API の値を表示し、件数や区分を計算しない (`architecture/classify-frontend.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| (1) 問いと期間 | 画面の問い (文言は `specs/spec-classify-screen.md`) と期間の選択 | `PageHeader` + `PeriodPicker` | packages/web | 静的配信 |
| (2) KPI 4 枚 | 未整理・要確認 (未整理のうち)・手動変更・完了の件数。押すとその分類ステータスで絞り込む | `KpiCard` | packages/web | 静的配信 |
| (3) 絞り込み | 分類ステータス・カテゴリ・所有者・支払方法・手動変更のみ・キーワード・保存フィルタ | React | packages/web | 静的配信 |
| (4) 一覧 | 日付・取引先・金額・自動提案・信頼度・分類ステータス。50 件ずつ | React | packages/web | 静的配信 |
| (5) 編集パネル | 区分・カテゴリ・所有者・支払方法・メモ・分割・提案の根拠・履歴・証憑の代わりの案内 | React | packages/web | 静的配信 |
| (6) 一括操作バー | 選択件数・一括変更・ルール化 (画面専用部品) | React | packages/web | 静的配信 |
| (7) 結果の通知 | 保存・一括保存・ルール適用の件数と失敗の明細 | React | packages/web | 静的配信 |

## Cross-cutting contracts

- Identity/access: 既存のセッションに乗る。
- Errors/resilience: 一括保存の失敗は通知に件数と明細を出し、失敗した明細を選択に残す。取込中の競合 (409) は保存できなかった旨を出して再試行を促す。
- Observability/audit: 編集パネルの履歴で、いつ・どの経路で・何が変わったかを見せる。
- Configuration/secrets: N/A: 画面に設定・秘密情報を持たない。
- Compatibility/versioning: 用語は `glossary.ts` と `Term` で揃える。既存の画面の用語 (区分・所有者・支払方法) を変えない。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/classify-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/classify-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/classify-database.md`)
- Security: N/A: 本章の関心外 (`architecture/classify-security.md`)

### Frontend architecture

#### Rendering and application pattern

- 既存の SPA の 1 画面。画面の入口がデータを読み、(1)〜(7) の部品へ渡す。判定は API から受け取る。

#### Routes, screens and navigation

- `/classify` の 1 画面で完結させ、ルール作成は画面内の `ConfirmDialog` 系のダイアログで行う。
- KPI を押すとその分類ステータスで絞り込み、行を押すと編集パネルを開く。チェックは一括選択だけに使う (agent 推定・利用者未確認、根拠 qa-classify-ui-ux-web-002)。
- ナビのバッジは未整理の件数を出し、押すと未整理で絞り込んだ仕分け画面を開く。

#### Component and design-system boundaries

- 共通部品 (`PageShell` / `PageHeader` / `KpiCard` / `Button` / `ConfirmDialog` / `Term` / `SplitEditor`) とデザイントークンを使い、画面専用の色・余白を作らない。
- 分類ステータスは色に加えて文字 (未整理・手動変更・完了) で示し、要確認は理由の文 (信頼度が低い・提案が衝突・区分と名義が矛盾) を添える。
- 提案の信頼度は数値と根拠の文で示し、表示名は『自動提案』とする。

#### State and data flow

- 並びは日付の降順、同日は取引 id の昇順 (agent 推定・利用者未確認、根拠 qa-classify-ui-ux-web-002)。
- 編集パネルの入力途中は下書きとして残り、戻ってきたら復元する。保存で消える。
- 一括保存・ルール適用の後は一覧・KPI・ナビのバッジを同時に更新する。

#### Backend integration

- 一覧・KPI・提案・根拠は `GET /api/transactions` の応答をそのまま表示する。
- ルールのプレビューは最大 50 行を表示し、件数は全体の件数を出す (agent 推定・利用者未確認、根拠 qa-classify-ui-ux-web-002)。プレビューで見せた明細と件数が適用の結果と一致する (O4)。

#### Performance and observability

- 画面幅 1024px 未満では 一覧 → 編集パネル → 絞り込み の順に縦に積み、絞り込みは折りたたんで始める (agent 推定・利用者未確認、根拠 qa-classify-ui-ux-web-002)。
- 観測信号は追加しない。

#### Frontend verification

DOM テストで、(1)〜(7) が揃うこと、KPI が 4 枚で要確認に『未整理のうち』が添えられること、KPI を押すと絞り込まれること、行を押すと編集パネルが開きチェックでは開かないこと、分類ステータスが文字でも示されること、表示名が『自動提案』であること、証憑の入力が無く freee の案内があること、1024px 未満の並び順を確かめる。`design/FINAL-UI/images/13-classify.png` と画面を目視で突き合わせる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-classify-ui-ux-web-003 | 画面を (1)〜(7) の 1 画面で構成する | 一括操作やルール作成を別画面にする | 件数を見たまま確定と結果の確認まで進める | 1 画面の部品が多くなる |
| qa-classify-decision-005 | KPI は 4 枚だが区分は 3 つで、要確認のカードに『未整理のうち』を添える | 要確認を独立の区分として見せる | KPI の和が全件になると誤読させない | 要確認のカードだけ補足の文を持つ |
| qa-classify-ui-ux-web-003 | 提案の表示名を『自動提案』にし、色だけに頼らない | 『AI 提案』と表示する / 色だけで区分を示す | 外部 LLM を使わない実装と一致し、色覚に依らず読める | 区分の文字の分だけ一覧の幅を使う |
| qa-classify-ui-ux-web-002 | 行を押すと編集パネル、チェックは一括選択だけ (agent 推定・利用者未確認) | 行を押すと選択する | 1 件の確定と複数の選択を取り違えない | チェックの当たり判定を十分に取る |
| qa-classify-decision-001 | 証憑欄の代わりに freee で管理する旨を案内する | 証憑欄を戻す | 保管責任を持たず、利用者の迷いも残さない | 編集パネルに案内の文を置く |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web の静的配信。
- Migration sequence: (1)(2) 問いと KPI → (3)(4) 絞り込みと一覧 → (5) 編集パネル → (6)(7) 一括操作と通知 → ルール作成とプレビュー → 保存フィルタと履歴 → `docs/ui-decisions.md` の更新。
- Rollback trigger/procedure: DOM テストか目視の確認で不具合が出たら web を直前版へ戻す。

## Risks and verification

- Risk/assumption: KPI が 4 枚並ぶため、4 つの和が全件になると読まれやすい。要確認のカードの補足と配置 (未整理の隣) で防ぎ、DOM テストで補足の文を固定する。
- Risk/assumption: 1024px 未満の縦積みで一覧が先頭に来るため、KPI と絞り込みを見ずに作業を始める利用者がいる。狭い幅での KPI の位置を `specs/spec-classify-screen.md` で決め、DOM テストで固定する。
- Architecture fitness test: 画面に証憑の入力要素が無いこと。『AI』の表示が無いこと。分類ステータスの表示に文字があること。
- Load/failure/security validation: 3 年分の期間でも最初の 50 件が表示されること。一括保存の部分失敗が通知と選択に反映されること。
