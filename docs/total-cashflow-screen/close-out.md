# 総収支画面 close-out (SYS-TCSCREEN-P13)

## 結論: 配信は draft PR まで。merge と本番適用は未実施

P13 の受入基準は次の 2 つ。**どちらもまだ満たしていない。**

- PR の CI が緑で default branch へ merge され、migration 0041 が本番 D1 に適用済みである
- 本番の `/analysis/total-cashflow` で KPI 3 枚と判定作業が表示される

commit / push / draft PR は実施済みだが、**merge は人の判断を待つ段階**なので
受入基準は開いたままにする。ゲートが緑だから完了扱いにする、という書き方はしない。
配信していないものを配信したことにすると、この文書が後から嘘をつく。

## 現在の状態

| 項目 | 状態 |
|---|---|
| 作業ブランチ | `daishiman/総収支` (worktree) |
| push 先 | `origin/devgraph/feat-total-cashflow-screen` |
| base branch | `main` (`origin/dev` は存在しない) |
| commit | `2e60d3e` (148 files changed, +22515 / -2155) |
| push | **実施済み** |
| draft PR | **実施済み** — https://github.com/daishiman/kanjo/pull/55 |
| CI | PR 上で確認中 |
| merge | **未実施** |
| 本番配信 | **未実施** |

`origin/main` を取り込む操作は不要だった。`git fetch origin --prune` の時点で
`origin/main` = `1b1682554e4b13a86006d6b23edda715ef76e7fa` が HEAD の親であり、
`git rev-list --left-right --count origin/main...HEAD` が `0 0` (本 commit 前) だったため。
`dev` ブランチはリモートに存在しない。

## 配信前に確認済みのこと

### 1. migration 番号の衝突がない

```
$ git fetch origin --prune
$ git rev-parse origin/main
1b1682554e4b13a86006d6b23edda715ef76e7fa
```

`migrations/` の最新は `0040_review_snoozes_and_monthly_close_reviews.sql` で、
本 branch が足す `0041_total_cashflow_operations_and_exclusion_reason.sql` と重ならない。

> **merge の直前にもう一度 `git fetch` をやり直すこと。**
> 上の実測は push 時点のもので、その後 main が動けば無効になる。

### 2. migration は追加のみ

`0041` は `CREATE TABLE` と `ALTER TABLE ... ADD COLUMN` だけで、
既存列の削除・型変更を含まない。本番の migration gate
(`feat-deploy-migration-gate`) と runtime schema guard を通る形になっている。

既存行への `UPDATE` は `reason_code` を `other` で埋める 1 本だけ
(`docs/total-cashflow-screen/refactoring.md` §2)。

### 3. 品質ゲート

`docs/total-cashflow-screen/test-run.md` と
`docs/total-cashflow-screen/assurance.md` に実測値を記録した。
配信直前の再実行でも `pnpm typecheck` / `pnpm lint` はともに exit 0。

### 4. スコープ外への差分が 0 件

`docs/total-cashflow-screen/final-review.md` §2。
サイドバー・自動寄せの条件・他 4 タブのいずれも触れていない。

### 5. 仕様・設計への反映

`docs/total-cashflow-screen/spec-reflection-receipt.md`。
**影響あり・すでに正規フローで反映済み**と判断した根拠を記録している。

## 残りの手順

1. PR #55 の CI 全ジョブが緑になるのを待つ
2. draft を外してレビュー・merge する。`deploy.yml` が migration を Worker 配備より先に適用する
3. 本番の `/analysis/total-cashflow` を開き、KPI 3 枚と判定作業が出ることを確認する
4. 本書の「結論」を書き換え、上の 2 つの受入基準に実測を入れる
5. Beads のゲート `kanjo-i8e` (PR #55 merge) が解け、`kanjo-kui.13` を close できる状態になる

## dev-graph / Beads の状態

| 項目 | 状態 |
|---|---|
| epic | `kanjo-kui` (= `feat-total-cashflow-screen`) — `in_progress` |
| 子 task | `kanjo-kui.1` .. `kanjo-kui.13` (SYS-TCSCREEN-P01..P13) — 全件 `in_progress` |
| PR 完了方針 | `linked_pr_merged_all` |
| merge ゲート | `kanjo-i8e` = `Gate: gh:pr 55` を `kanjo-kui.13` に付与済み |
| done への収束 | **未実施** |

`linked_pr_merged_all` は default branch への merge evidence がそろってはじめて
done になる方針なので、merge 前の現時点では P13 を done にできない。
これは仕組みとして正しい挙動で、回避しない。

ゲートは epic ではなく最終 phase task (`kanjo-kui.13`) に付ける。
epic は子の完了を待つ側で、ゲートを受け取る側ではない。
