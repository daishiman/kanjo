---
graph_node_id: "SYS-UINAV-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "利用・運用文書の更新"
project_id: "feature-package-feat-ui-navigation-cognitive-load"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ui-navigation","cognitive-load","accessibility"]
file_path: "tasks/feat-ui-navigation-cognitive-load/SYS-UINAV-P12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-29T15:48:08Z","origin_kind":"system-dev-planner","source_digest":"be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd","source_path":".dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/task-specs/phase-12-documentation-operations.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-08-29T15:48:08Z"
updated_at: "2026-08-29T15:48:08Z"
depends_on: ["SYS-UINAV-P11"]
related_nodes: ["spec-ui-navigation-cognitive-load","arch-ui-navigation-experience","arch-ui-navigation-frontend"]
resource_scope: ["docs/ui-navigation-guidelines.md"]
purpose: "利用・運用文書の更新の完了状態と検証可能な証跡を確定する。"
goal: "ナビゲーションの追加、active 判定、アイコン選択、編集面の安全性を将来も維持できる簡潔な指針へ残す。"
scope_in: ["docs/ui-navigation-guidelines.md"]
scope_out: ["会計計算、API、データ、認証、インフラの契約変更","commit、push、Pull Request作成、本番deploy"]
acceptance: ["ナビゲーションの追加、active 判定、アイコン選択、編集面の安全性を将来も維持できる簡潔な指針へ残す。","対象成果物が feature の受入条件と architecture の境界に一致し、実データや秘密情報を含まない。","検証結果と未解決事項が task の証跡へ記録され、高重大度の未解決指摘がない。"]
architecture_refs: ["arch-ui-navigation-experience","arch-ui-navigation-frontend"]
parent_feature: "feat-ui-navigation-cognitive-load"
feature_package_id: "feature-package/feat-ui-navigation-cognitive-load"
phase_ref: "P12"
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-ui-navigation-cognitive-load/SYS-UINAV-P12.md","confidence":1}]
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

# 利用・運用文書の更新

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/task-specs/phase-12-documentation-operations.md` はこれを生成したstaging snapshotで、promotion後の更新は本書だけに入れる(`source_lineage.source_digest`はpromotion時点の対応を示すもので、以後の同期は保証されない)。

## 目的

ナビゲーションの追加、active 判定、アイコン選択、編集面の安全性を将来も維持できる簡潔な指針へ残す。

## 背景

`feat-ui-navigation-cognitive-load` の exact-13 package における P12。確定仕様、共通ナビゲーション設計、task-graph handoff を同じ source digest で参照し、現在地・情報優先度・編集安全性を一貫して改善する。

## 対応する要求 (source of truth: `specs/ui-navigation-cognitive-load.md`)

- FR:
  - `FR-002`: 17 routeに意味の異なるiconと可視label
  - `FR-005`: 目的・重要状態・主操作を優先し補足を段階表示
- AC:
  - `AC-002`: 17 routeすべてにiconと可視label
  - `AC-004`: 全17ページで目的・主操作・重要警告が初期表示から失われない
- 補足: 運用ガイドと判断記録の更新
- 充足状況の最新はfeature `features/feat-ui-navigation-cognitive-load.md` の受入節を見る。

## 入力と前提条件

- 入力: `.dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/task-specs/phase-12-documentation-operations.md`
- 前提: `SYS-UINAV-P11` の完了
- Source digest: `sha256:be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd`

## 出力と成果物

- 生成または更新: `docs/ui-navigation-guidelines.md`

## 依存関係

- `depends_on`: `SYS-UINAV-P11`
- ブロッカー: 依存 task 未完了、worktree lease 競合、readiness の stale 化、高重大度 finding

## 実装対象

- frontend: N/A: この phase では変更しない。
- backend: N/A: この phase では変更しない。
- api: N/A: この phase では変更しない。
- data: N/A: この phase では変更しない。
- infrastructure: N/A: この phase では変更しない。
- security: N/A: この phase では変更しない。
- quality: N/A: この phase では変更しない。
- documentation: 該当。task inventory の担当境界として成果物と検証を扱う。
- operations: 該当。task inventory の担当境界として成果物と検証を扱う。

## Write scope と競合制約

- `touches`: `docs/ui-navigation-guidelines.md`
- 排他資源: `SYS-UINAV-P12`
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
- PR linkage requirement: PR本文へ beads識別子と `dev-graph: SYS-UINAV-P12` を記載する
- Closed without merge: active を維持する
- Local reconciliation: `/dev-graph sync` が authority へ収束させる

## 実行手順

1. 依存 task と requirements snapshot の digest を確認する。
2. worktree lease を取得し write scope 内だけを変更する。
3. acceptance と verification を実行し、匿名化した証跡を残す。
4. 高重大度 finding が0であることを確認し、後続 task へ handoff する。

## 受入条件

- [ ] ナビゲーションの追加、active 判定、アイコン選択、編集面の安全性を将来も維持できる簡潔な指針へ残す。
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
- 次に利用するノード: `SYS-UINAV-P13`
- 完了条件: acceptance と verification が全て PASS、高重大度 finding 0、必要証跡が追跡可能

## 実装で確定した結果(2026-08-30)

> 本節は**追記**である。上の記述は着手時点の要求として保持し、ここには実装で確定した結果だけを足す。

**画面数の読み替え**: 本文中の「17 route」「全17ページ」は、`/analysis/:tab` への統合後は
**15 route + 支出分析3タブ = 18単位**として読む。統合の理由は `docs/ui-decisions.md` の
「決定の更新(2026-08-30 / ウェーブ4)」、更新後の契約は `specs/ui-navigation-cognitive-load.md` が持つ。

### 更新した文書

| 文書 | 反映内容 |
|---|---|
| `docs/spec-v1.1.md` | §4.1 の P2/P3/P14 を `/analysis/:tab` のタブへ、ルート数と画面単位の関係を注記、§10.1 を15route+3タブ・画面検索・行高の2段構えへ |
| `specs/ui-navigation-cognitive-load.md` | 画面単位の定義、`FR-008`〜`FR-010`(画面検索・タブ・説明文の保持)、`BR-004`/`BR-005`、`AC-007`〜`AC-009`、互換性へリダイレクト、未決事項に未実施2点 |
| `docs/ui-navigation-guidelines.md` | 行高の根拠(2.5.5 と 2.5.8)、強調を増やさない規準、`taskDetail` と画面検索の追加手順、「画面を束ねるとき」の節、リリース前チェック3件、検証方式の記述 |
| `docs/ui-decisions.md` | 「決定の更新(2026-08-30 / ウェーブ4)」— 統合の判断、サブスク分析を統合しない理由、旧URL、タブ状態、説明文を消さない約束(ウェーブ4担当が更新済み) |
| `features/feat-ui-navigation-cognitive-load.context.json` | goal / scope_in / acceptance を18単位・画面検索・リダイレクトへ更新 |
| `tasks/feat-ui-navigation-cognitive-load/SYS-UINAV-P01〜P13.md` | 各フェーズへ本節を追記 |
| `docs/product/elegant-review-uiux/T5-spec-reflection-receipt.md` | 層ごとの判定と未解決事項(新規) |

`system-spec/` は影響なしと判定した(理由は受領書に記載)。
