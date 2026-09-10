# 判定境界のアーキテクチャ決定 — phase requirements

生成先: `tasks/feat-mf-business-classification/sys-mfbiz-p02.md`

## Machine-readable registration fields

生成先 task の frontmatter が唯一の正本。

## 目的

単一 predicate、resolveTx 間接依存、型正本を architecture-decision に固定する。

## 背景

共通規則は `specs/spec-mf-business-classification.md` を参照。

## 前提条件

P01 のベースライン。依存IDは frontmatter の `depends_on` を参照。

## Workstream applicability

対象は frontmatter の `resource_scope` のみ。

## Architecture and deploy unit

`architecture/mf-business-*.md` を再利用し、新規deploy unitなし。

## 成果物

単一 predicate、resolveTx 間接依存、型正本を architecture-decision に固定する。

## Tracker publication and completion

tracker・状態・証跡は frontmatter で管理。

## Branch and worktree execution

共有worktreeの担当資源だけを変更。

## スコープ外

canonical spec の `scope_out` と担当資源外。

## Verification and evidence

二本目の判定経路と独立 source enum がない。

## Rollout and rollback

共通手順は `docs/mf-business-classification/runbook.md` を参照。

## Handoff

後続は成果物と frontmatter の依存辺を参照。

## 参照情報

canonical spec、共有runbook、生成先 task。
