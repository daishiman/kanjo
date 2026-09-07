---
graph_node_id: "tasks-ui-navigation-followup"
artifact_kind: "task"
title: "サイドバー動線と確認ダイアログの追補 — タスク分解"
project_id: "kanjo"
domain: "ui-ux"
status: "complete"
file_path: "tasks/ui-navigation-followup-tasks.md"
parent_feature: "feat-ui-navigation-cognitive-load"
template_id: "task"
template_version: "1.0.1"
---

# タスク分解

`feat-total-cashflow` の受入(`tasks/feat-total-cashflow/sys-tcf-p07.md`)を実データで確かめようとして見つかった2つの欠陥への対処。どちらも `feat-ui-navigation-cognitive-load` の範囲であり、P07 の宣言スコープ(`resource_scope: ["eval-log/tcf-acceptance.md"]`)の外にある。**P07 の受入判定そのものは別途残っている**(F1〜F10 は未確認のまま)。

判断の正本は `architecture/arch-ui-navigation-experience.md` の ADR-UI-005〜007、仕様は `specs/ui-navigation-cognitive-load.md` の FR-011〜013 / AC-010〜012。

## A — 支出分析のタブへサイドバーから行けるようにする

### A01 サイドバーに子行を展開する

`Layout.tsx` で `route.id === 'analysis'` のとき `ANALYSIS_TABS` を `.nav-sub` の子 `NavItem` として描く。

- 畳んだ状態は持たない。既定が「畳んだ」だと、タブの存在が画面外にあるという元の問題がそのまま残る(ADR-UI-005)。
- 子行のインデント・左罫・小さい字は `styles.css` の `.nav-sub` が持つ。`NavItem` 自体には手を入れない(sidebar/tab で共有しているため、片方の都合を持ち込むと両方が壊れる)。

### A02 親に current を立てないようにする

親 `NavItem` の `end` を `!TABBED_ROUTE_IDS.has(route.id) || subTabs !== null` で決める。子行を描いているときは親を厳密一致にする。

- 子が並んだ以上、親子とも current だと現在地が2件になる。`/tax` に `end` を入れた ADR-UI-001 と同じ原則(ADR-UI-006)。

### A03 動線をDOMで固定する

`navigation-ux.dom.test.tsx` に2件追加し、既存の icon/label 検査の母数を `APP_ROUTES.length` から `SIDEBAR_LINKS.length`(route + タブ)へ広げる。

- 「支出分析のタブがサイドバーから直接押せる」— 各タブの href を検査。
- 「タブを開いているときは、その子だけが現在地になる」— `/analysis/total-cashflow` で `[aria-current="page"]` が1件、その中身が「トータル収支」。

## B — 破壊的操作の確認を画面内へ移す

### B01 共有部品を作る

`components/ConfirmDialog.tsx` に `ConfirmDialog`(`<dialog>`・focus・busy 中の閉じ抑止)と `usePendingConfirm<T>()`(確認している間だけ「続きの操作」を預かる)を置く。既存の `use-confirm-dialog.ts` の上に乗せ、`<dialog>` の生の扱いを各画面へ散らさない。

### B02 `window.confirm` の11箇所を移行する

`pages/Ai.tsx`(レポート削除・依頼取り消し)、`pages/Cash.tsx`、`pages/Settings.tsx`、`components/Attachments.tsx`、`components/ClassificationSettings.tsx`、`components/SubVendors.tsx`、`pages/Classify.tsx`。

- 確認の中に、何が失われるか(対象名と範囲)を書く。
- トリガーと確定ボタンで語を変える(「削除」→「削除」だと、確認が出たこと自体に気づかず同じ語を押す)。

### B03 仕分け画面の未保存ガードを作り替える

`classificationLeaveDecision(currentId, nextId, dirty, busy): 'go' | 'ask' | 'blocked'` にして、続きの操作を `usePendingConfirm<{ resume: () => void }>()` に預ける。リンク遷移は常に `preventDefault()` して `useNavigate()` で自分で進む。

- `window.confirm` は同期的に真偽を返すので、そのまま `if (!confirm(...)) return;` と書けた。`<dialog>` は非同期なので、「確認が済んだら何をするか」を保持する場所が要る。これが `usePendingConfirm` の存在理由。
- 保存中(`busy`)は `'blocked'`。答えても結果が変わらない問いを出さない。

### B04 テストを実DOM契約へ移す

`classify-editor-contract.test.ts` の弱いソース文字列一致(宣言があることしか言えず、コメント本文にも一致してしまう)を削り、`classify-discard-guard.dom.test.tsx` を新設。`ai-task-collapse.dom.test.tsx` と `Attachments.dom.test.tsx` の `window.confirm` 依存アサーションを置き換える。

- `expect(confirm).not.toHaveBeenCalled()` **だけ**では足りない。確認せず素通りする実装でも通ってしまう。`findByRole('dialog')` の存在・本文・確定ボタン名と**組で**初めて契約になる。
- dialog の `textContent` はクリック**前**に読む。クリック後は React が unmount して中身が消える。

### B05 検算する

`Classify.tsx` の `requestViewChange` を一時的に「確認を挟まず即実行」へ改変し、`classify-discard-guard.dom.test.tsx` の3件が `findByRole('dialog')` で落ちることを実測してから戻した。**新しいテストが旧実装を落とすことを確かめない限り、0件の違反と0件しか調べていないは区別できない。**

## 検証

| 検査 | 結果 |
|---|---|
| `pnpm --filter @kanjo/web test` | 70ファイル / 449件 PASS |
| `pnpm run typecheck` | api / web とも PASS |
| `pnpm run lint` | 367ファイル PASS |
| `pnpm --filter @kanjo/web build` | 初期JS 107.39KiB / 予算110KiB |
| 検算(B05) | 旧実装で新DOM検査3/3が失敗することを実測 |

## 残課題

- サイドバー総高が子行5本ぶん(約140px)伸びた。ノートPCの実効高600〜700pxには収まらない。群の折りたたみは未着手(`specs/ui-navigation-cognitive-load.md` の未決事項)。
- `feat-total-cashflow` P07 の受入 F1〜F10 は未確認のまま。本追補は「確かめに行けなかった」を解消しただけで、受入判定そのものではない。
