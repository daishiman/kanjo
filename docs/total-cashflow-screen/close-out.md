# 総収支画面 close-out (SYS-TCSCREEN-P13)

## 結論: 配信は未実施

P13 の受入基準は次の 2 つ。**どちらも満たしていない。**

- PR の CI が緑で default branch へ merge され、migration 0041 が本番 D1 に適用済みである
- 本番の `/analysis/total-cashflow` で KPI 3 枚と判定作業が表示される

理由は単純で、**利用者が commit / push / PR 作成を明示的に禁じている**ため。
「commit、push、PR作成はまだ行わず、変更内容と検証結果を報告してください」という指示がある。

ゲートを緑にしたので完了扱いにする、という書き方はしない。
配信していないものを配信したことにすると、この文書が後から嘘をつく。

## 現在の状態

| 項目 | 状態 |
|---|---|
| 作業ブランチ | `daishiman/総収支` (worktree) |
| HEAD | `1b16825` = `origin/main` |
| ahead / behind | 0 / 0 |
| 未コミットの変更 | 53 ファイル (+5779 / -1087) + 未追跡 20 件 |
| commit | **未実施** |
| push | **未実施** |
| PR | **未実施** |
| 本番配信 | **未実施** |

## 配信前に確認済みのこと

配信そのものは行っていないが、配信の前提になる確認は済ませた。

### 1. migration 番号の衝突がない

長い作業のあいだに main が動くと、migration 番号が別の変更と衝突する。
PR を作る直前に取り直すべきものなので、この時点での実測を残す。

```
$ git fetch origin main
$ git rev-parse HEAD origin/main
1b1682554e4b13a86006d6b23edda715ef76e7fa
1b1682554e4b13a86006d6b23edda715ef76e7fa
```

`origin/main` は作業開始時から動いていない。
`migrations/` の最新は `0040_review_snoozes_and_monthly_close_reviews.sql` で、
本 branch が足す `0041_total_cashflow_operations_and_exclusion_reason.sql` と重ならない。

> **PR を作るときは必ず `git fetch` をやり直すこと。**
> 上の実測はこの文書を書いた時点のもので、その後 main が動けば無効になる。

### 2. migration は追加のみ

`0041` は `CREATE TABLE` と `ALTER TABLE ... ADD COLUMN` だけで、
既存列の削除・型変更を含まない。本番の migration gate
(`feat-deploy-migration-gate`) と runtime schema guard を通る形になっている。

既存行への `UPDATE` は `reason_code` を `other` で埋める 1 本だけ
(`docs/total-cashflow-screen/refactoring.md` §2)。

### 3. 品質ゲート

`docs/total-cashflow-screen/test-run.md` と
`docs/total-cashflow-screen/assurance.md` に実測値を記録した。

### 4. スコープ外への差分が 0 件

`docs/total-cashflow-screen/final-review.md` §2。
サイドバー・自動寄せの条件・他 4 タブのいずれも触れていない。

## 配信するときの手順

利用者が commit / push / PR を許可した時点で、次の順に行う。

1. `git fetch origin main` をやり直し、`migrations/` の最新番号を確認する。
   `0041` が埋まっていたら採番し直す (ファイル名とテストの参照の両方)
2. `origin/main` を取り込んで衝突を解消する
3. `pnpm run verify:full` を通す
4. commit する
5. push して PR を作る。本文に `SYS-TCSCREEN-P01` .. `SYS-TCSCREEN-P13` の
   graph_node_id を記載し、default branch を対象にする
6. CI の全ジョブが緑になるのを待つ
7. merge する。deploy.yml が migration を Worker 配備より先に適用する
8. 本番の `/analysis/total-cashflow` を開き、KPI 3 枚と判定作業が出ることを確認する
9. 本書の「結論」を書き換え、上の 2 つの受入基準に実測を入れる

### PR 本文の範囲について

この worktree は複数 node ぶんの作業が溜まっている。
PR 本文の範囲は「直近のコミット」ではなく**ブランチ全体**なので、
`git log origin/main..HEAD` を先に取ってから本文を書くこと。

## dev-graph / Beads の状態

| 項目 | 状態 |
|---|---|
| epic | `kanjo-kui` (= `feat-total-cashflow-screen`) |
| 子 task | `kanjo-kui.1` .. `kanjo-kui.13` (SYS-TCSCREEN-P01..P13) |
| PR 完了方針 | `linked_pr_merged_all` |
| done への収束 | **未実施** |

`linked_pr_merged_all` は default branch への merge evidence がそろってはじめて
done になる方針なので、PR が無い現時点では P13 を done にできない。
これは仕組みとして正しい挙動で、回避しない。
