# 証跡索引 — phase requirements

生成先: `tasks/feat-mf-business-classification/sys-mfbiz-p11.md`

## Machine-readable registration fields

生成先 task の frontmatter が唯一の正本。

## 目的

公開可能な証跡所在と不変条件を evidence に索引化する。

## 背景

共通規則は `specs/spec-mf-business-classification.md` を参照。

## 前提条件

P10 の最終判定。依存IDは frontmatter の `depends_on` を参照。

## Workstream applicability

対象は frontmatter の `resource_scope` のみ。

## Architecture and deploy unit

`architecture/mf-business-*.md` を再利用し、新規deploy unitなし。

## 成果物

公開可能な証跡所在と不変条件を evidence に索引化する。

## Tracker publication and completion

tracker・状態・証跡は frontmatter で管理。

## Branch and worktree execution

共有worktreeの担当資源だけを変更。

## スコープ外

canonical spec の `scope_out` と担当資源外。

## Verification and evidence

原本・個別値・個人パス・秘密を複製しない。

## Rollout and rollback

共通手順は `docs/mf-business-classification/runbook.md` を参照。

## Handoff

後続は成果物と frontmatter の依存辺を参照。

## 参照情報

canonical spec、共有runbook、生成先 task。
