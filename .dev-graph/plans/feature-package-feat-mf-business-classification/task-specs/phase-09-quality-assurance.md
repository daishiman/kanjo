# 品質保証レビュー — phase requirements

生成先: `tasks/feat-mf-business-classification/sys-mfbiz-p09.md`

## Machine-readable registration fields

生成先 task の frontmatter が唯一の正本。

## 目的

契約・実装・検証の対応を assurance に記録する。

## 背景

共通規則は `specs/spec-mf-business-classification.md` を参照。

## 前提条件

P08 の収束済み実装。依存IDは frontmatter の `depends_on` を参照。

## Workstream applicability

対象は frontmatter の `resource_scope` のみ。

## Architecture and deploy unit

`architecture/mf-business-*.md` を再利用し、新規deploy unitなし。

## 成果物

契約・実装・検証の対応を assurance に記録する。

## Tracker publication and completion

tracker・状態・証跡は frontmatter で管理。

## Branch and worktree execution

共有worktreeの担当資源だけを変更。

## スコープ外

canonical spec の `scope_out` と担当資源外。

## Verification and evidence

矛盾、漏れ、表現、依存の4条件を検査できる。

## Rollout and rollback

共通手順は `docs/mf-business-classification/runbook.md` を参照。

## Handoff

後続は成果物と frontmatter の依存辺を参照。

## 参照情報

canonical spec、共有runbook、生成先 task。
