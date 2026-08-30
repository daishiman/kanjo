---
graph_node_id: "SYS-UINAV-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "受入条件と主要導線の確認"
project_id: "feature-package-feat-ui-navigation-cognitive-load"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ui-navigation","cognitive-load","accessibility"]
file_path: "tasks/feat-ui-navigation-cognitive-load/SYS-UINAV-P07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-29T15:48:08Z","origin_kind":"system-dev-planner","source_digest":"be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd","source_path":".dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/task-specs/phase-07-acceptance.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-08-29T15:48:08Z"
updated_at: "2026-08-29T15:48:08Z"
depends_on: ["SYS-UINAV-P06"]
related_nodes: ["spec-ui-navigation-cognitive-load","arch-ui-navigation-experience","arch-ui-navigation-frontend"]
resource_scope: [".dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/evidence/phase-07-acceptance.md"]
purpose: "受入条件と主要導線の確認の完了状態と検証可能な証跡を確定する。"
goal: "申告2画面と代表ページを実ブラウザで移動し、現在地、戻り先、主要操作が初見でも判断できることを確認する。"
scope_in: [".dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/evidence/phase-07-acceptance.md"]
scope_out: ["会計計算、API、データ、認証、インフラの契約変更","commit、push、Pull Request作成、本番deploy"]
acceptance: ["申告2画面と代表ページを実ブラウザで移動し、現在地、戻り先、主要操作が初見でも判断できることを確認する。","対象成果物が feature の受入条件と architecture の境界に一致し、実データや秘密情報を含まない。","検証結果と未解決事項が task の証跡へ記録され、高重大度の未解決指摘がない。"]
architecture_refs: ["arch-ui-navigation-experience","arch-ui-navigation-frontend"]
parent_feature: "feat-ui-navigation-cognitive-load"
feature_package_id: "feature-package/feat-ui-navigation-cognitive-load"
phase_ref: "P07"
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-ui-navigation-cognitive-load/SYS-UINAV-P07.md","confidence":1}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-29T15:41:55Z","missing_sections":[],"status":"complete"}
---

# 受入条件と主要導線の確認

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/task-specs/phase-07-acceptance.md` はこれを生成したstaging snapshotで、promotion後の更新は本書だけに入れる(`source_lineage.source_digest`はpromotion時点の対応を示すもので、以後の同期は保証されない)。

## 目的

申告2画面と代表ページを実ブラウザで移動し、現在地、戻り先、主要操作が初見でも判断できることを確認する。

## 背景

`feat-ui-navigation-cognitive-load` の exact-13 package における P07。確定仕様、共通ナビゲーション設計、task-graph handoff を同じ source digest で参照し、現在地・情報優先度・編集安全性を一貫して改善する。

## 対応する要求 (source of truth: `specs/ui-navigation-cognitive-load.md`)

- FR:
  - `FR-001`: /tax/receiptsでcurrentを1件にする
  - `FR-002`: 17 routeに意味の異なるiconと可視label
  - `FR-003`: icon-label間隔・行高・group間隔を共通token化
  - `FR-004`: currentを色に依存せずaria-current=pageと形で示す
  - `FR-005`: 目的・重要状態・主操作を優先し補足を段階表示
  - `FR-006`: 通常遷移をmodalで遮らない
  - `FR-007`: 編集UIで対象・保存・取消・危険性・処理結果を識別
- AC:
  - `AC-001`: /tax/receiptsでcurrent navが1件だけ
  - `AC-002`: 17 routeすべてにiconと可視label
  - `AC-003`: currentがaria-current=pageを持ち色なしでも識別できる
  - `AC-004`: 全17ページで目的・主操作・重要警告が初期表示から失われない
  - `AC-005`: 編集surfaceで対象・保存・取消・危険性・保存結果を識別できる
  - `AC-006`: unit/DOM/build/UI contract/主要viewport visual確認がPASS
- 補足: 受入条件の充足確認。主要viewportのvisual確認を含む
- 充足状況の最新はfeature `features/feat-ui-navigation-cognitive-load.md` の受入節を見る。

## 入力と前提条件

- 入力: `.dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/task-specs/phase-07-acceptance.md`
- 前提: `SYS-UINAV-P06` の完了
- Source digest: `sha256:be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd`

## 出力と成果物

- 生成または更新: `.dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/evidence/phase-07-acceptance.md`

## 依存関係

- `depends_on`: `SYS-UINAV-P06`
- ブロッカー: 依存 task 未完了、worktree lease 競合、readiness の stale 化、高重大度 finding

## 実装対象

- frontend: 該当。task inventory の担当境界として成果物と検証を扱う。
- backend: N/A: この phase では変更しない。
- api: N/A: この phase では変更しない。
- data: N/A: この phase では変更しない。
- infrastructure: N/A: この phase では変更しない。
- security: N/A: この phase では変更しない。
- quality: 該当。task inventory の担当境界として成果物と検証を扱う。
- documentation: N/A: この phase では変更しない。
- operations: N/A: この phase では変更しない。

## Write scope と競合制約

- `touches`: `.dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/evidence/phase-07-acceptance.md`
- 排他資源: `SYS-UINAV-P07`
- 並列実行条件: 依存完了かつ resource scope と lease が競合しないこと
- branch: one-task-one-branch
- worktree lease: 実装開始時に graph_node_id を claim し、heartbeat と release を行う
- completion projection: 既定ブランチ reconciliation で done を確定する

## GitHub publication

- Mode: local_only
- Project aliases: N/A: beads が execution tracker
- Issue labels/milestone: N/A: GitHub issue は直接作成しない
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Failure policy: local task を巻き戻さず pending retry とする
- Completion policy: linked_pr_merged_all
- PR linkage requirement: PR本文へ beads識別子と `dev-graph: SYS-UINAV-P07` を記載する
- Closed without merge: active を維持する
- Local reconciliation: `/dev-graph sync` が authority へ収束させる

## 実行手順

1. 依存 task と requirements snapshot の digest を確認する。
2. worktree lease を取得し write scope 内だけを変更する。
3. acceptance と verification を実行し、匿名化した証跡を残す。
4. 高重大度 finding が0であることを確認し、後続 task へ handoff する。

## 受入条件

- [ ] 申告2画面と代表ページを実ブラウザで移動し、現在地、戻り先、主要操作が初見でも判断できることを確認する。
- [ ] 対象成果物が feature の受入条件と architecture の境界に一致し、実データや秘密情報を含まない。
- [ ] 検証結果と未解決事項が task の証跡へ記録され、高重大度の未解決指摘がない。

## 検証方法

- 自動または手動検証: task の成果物を feature 受入条件と照合する
- 自動または手動検証: 依存 phase の証跡と write scope を確認する
- 証跡: `.dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/evidence/` 配下の phase 証跡
- privacy guard: 実データ、口座明細、金額、local secret を含めない

## リスクとロールバック

- リスク: 共通UIの変更が別 route のナビゲーション、狭幅表示、キーボード操作へ回帰を生む可能性
- ロールバック: 当該 phase の文書または証跡だけを直前版へ戻す。アプリケーション状態と実データは変更しない。

## Handoff

- 実装 route: task-graph build
- 次に利用するノード: `SYS-UINAV-P08`
- 完了条件: acceptance と verification が全て PASS、高重大度 finding 0、必要証跡が追跡可能

## 実装で確定した結果(2026-08-30)

> 本節は**追記**である。上の記述は着手時点の要求として保持し、ここには実装で確定した結果だけを足す。

**画面数の読み替え**: 本文中の「17 route」「全17ページ」は、`/analysis/:tab` への統合後は
**15 route + 支出分析3タブ = 18単位**として読む。統合の理由は `docs/ui-decisions.md` の
「決定の更新(2026-08-30 / ウェーブ4)」、更新後の契約は `specs/ui-navigation-cognitive-load.md` が持つ。

### 受入の充足状況

受入8件は**すべて充足**。うち2件は「実装不要と判定」(現行実装が既に条件を満たすため無変更)。

| 受入条件 | 状態 | 根拠 |
|---|---|---|
| `/tax/receipts` の current は1件だけ | 充足 | DOM test で current 数を固定 |
| 全単位に意味の異なる icon と可視 label | 充足 | 型の exhaustive check + `route-icon-distinct.test.tsx` が図形の署名で一意性を検査。18icon、未使用0 |
| icon-label / nav-group spacing が共通token | 充足 | `scripts/check-mobile-layout.mjs` が実描画で実測 |
| current が `aria-current=page` と色以外の手掛かり | 充足 | 強調を6重→2重へ削減。左帯のコントラスト6.46:1 |
| 全単位で目的・重要状態・主操作を初期表示 | 充足 | `taskDetail` を全18単位に実装。`route-task-detail.test.tsx` が用語リンク総数53件とリンクゼロ単位0を固定 |
| 補足は段階表示、通常遷移をmodalで遮らない | 実装不要と判定 | 現行遷移にmodalは挟まっていない |
| 編集対象・保存・取消・危険性・処理結果を明示 | 実装不要と判定 | 既存 inline editor が条件を満たす |
| unit/DOM/build/UI contract/主要viewport visual確認 | 充足 | 52ファイル/296テスト + 実描画検査3本 |

### 「visual確認」の解釈

**本タスクは特定の browser runtime を指定していない**(要求は「主要viewportのvisual確認」)。
本featureは実Chrome(CDP)で実際にレンダリングし、`getBoundingClientRect` / `getComputedStyle` で
**数値として計測**する方式を採った。目視のスクリーンショット比較より再現性が高い。

### この方式でカバーできていないこと(未実施)

- **意匠の妥当性の人手レビュー**。配色や余白が「美しいか」は計測では判定できない。
- **Chrome以外のブラウザでの描画差**。検査はChromeのみ。

この2点は充足ではなく**未実施**として残す。計測で代替したとは書かない。
