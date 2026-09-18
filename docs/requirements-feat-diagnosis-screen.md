---
artifact_kind: document
graph_node_id: req-feat-diagnosis-screen
title: 診断画面 (08-diagnosis) 実装要件定義
parent_feature: feat-diagnosis-screen
feature_package_id: feature-package/feat-diagnosis-screen
handoff_target: task-graph
generated_by: dev-graph/run-dev-graph-requirements@0.1.11
---

# 診断画面 (08-diagnosis) 実装要件インデックス

本書は dev-graph の引き渡し先を示す索引であり、要件本文を複製しない。正本を変更した後は dev-graph の正規手順で projection を再生成する。

## 正本

| 関心 | 正本 |
|---|---|
| 観測可能な振る舞い・API・受入条件・4 条件 | `specs/spec-diagnosis-screen.md` |
| 依存境界・所有権・ADR・migration 順序 | `architecture/arch-diagnosis-screen.md` |
| 検知器・impact・claim・健全性の算式 | `docs/diagnosis-screen.md` |
| テストへ与える架空入力と期待値 | `docs/diagnosis-screen-test-plan.md` |
| 実行済み検証の結果 | `docs/diagnosis-screen-evidence.md` |

## lineage / handoff

- feature: `features/feat-diagnosis-screen.md`
- specification: `specs/spec-diagnosis-screen.md`
- architecture: `architecture/arch-diagnosis-screen.md`
- package: `.dev-graph/plans/feature-package-feat-diagnosis-screen/`
- handoff target: `task-graph`
- handoff receipt: `.dev-graph/handoffs/task-graph-feat-diagnosis-screen.json`

## 再生成時の確認

1. migration scope が repository 直下の `migrations/` である。
2. action state の所有境界が `(user_id, action_key)` である。
3. 期間は `usePeriod` / localStorage、診断条件と選択は URL searchParams である。
4. `detectImprovements()` と `diagnosisScreen()` の責務が分離している。
5. impactBasis / claimKeys / scope / metric / query 付き nextAction が仕様から欠落していない。

FR / BR / AC / ADR / phase の対照表は、それぞれの正本と task graph から機械的に導出できるため本書では持たない。
