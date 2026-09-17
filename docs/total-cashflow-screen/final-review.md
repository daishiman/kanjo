# 総収支画面 最終レビュー (SYS-TCSCREEN-P10)

branch の差分を `specs/spec-total-cashflow-screen.md` の FR・BR・スコープ外と突き合わせる。
見るのは 2 つ。**FR ごとに対応する差分があるか**と、**スコープ外へ差分が漏れていないか**。

## 1. FR と差分ファイルの対応

| FR | 差分ファイル |
|---|---|
| FR-001 画面の構成要素 | `packages/web/src/pages/analysis/TotalCashflow.tsx`、`packages/web/src/styles.css`、`packages/web/test/total-cashflow-table.dom.test.tsx` |
| FR-002 core の集計と 1 回の取得 | `packages/core/src/total-cashflow.ts`、`packages/core/src/period.ts`、`packages/api/src/routes/total-cashflow.ts`、`packages/core/test/total-cashflow-screen-rules.test.ts` (新規) |
| FR-003 3 ペインの判定作業 | `TotalCashflow.tsx`、`styles.css`、`packages/api/test/total-cashflow-verdict.integration.test.ts` |
| FR-004 除外の理由区分とメモ | `migrations/0042_total_cashflow_operations_and_exclusion_reason.sql` (新規)、`packages/api/src/db/schema.ts`、`packages/core/src/total-cashflow.ts`、`packages/api/test/total-cashflow-backup.integration.test.ts` (新規) |
| FR-005 操作履歴と取消 | `packages/api/src/routes/total-cashflow-operations.ts` (新規)、`packages/api/test/total-cashflow-operations.integration.test.ts` (新規)、`packages/api/src/store.ts` |
| FR-006 3 表のバックアップ保護 | `packages/api/src/import-lifecycle.ts`、`packages/api/src/import-active.ts`、`packages/api/src/routes/imports.ts`、`packages/api/src/canonical-mutation-fence.ts`、`packages/api/src/schema-guard.ts`、`packages/api/src/import-lifecycle-pure.test.ts` |
| FR-007 自動一致の候補一覧 | `TotalCashflow.tsx`、`packages/web/src/api.ts`、`packages/core/src/total-cashflow.ts` (`autoMatches`) |
| FR-008 規則の docs 化と check 系 | `docs/total-cashflow-screen.md`、`docs/total-cashflow-screen/*`、`packages/web/scripts/check-financial-visuals.mjs`、`packages/web/scripts/check-mobile-layout.mjs` |

対応する差分を持たない FR は無い。

## 2. スコープ外への差分: 0 件

仕様と利用者決定が「触らない」と定めた 3 点を、差分そのもので確認した。

### 2.1 サイドバー (decision-011: 確認のみ)

```
$ git status --porcelain packages/web/src/components/Layout.tsx
(出力なし)
```

**変更 0 行**。項目・並び・現在地の判定・照合バッジのいずれも触れていない。
`packages/web/src/analysis-hub.dom.test.tsx` も変更しておらず、
既存の `照合と総収支の子行に、集約応答の要確認件数をそのまま出す` がそのまま緑で通っている。

### 2.2 自動寄せの条件 (維持)

`packages/core/src/total-cashflow.ts` の第一段は変更していない。

```
// 第一段: 発生日と金額の一致だけで寄せる。支払先は見ない
const candidates = byBucket.get(bucketKey(deal.io, deal.date, deal.amount)) ?? [];
```

`git diff -U2 packages/core/src/total-cashflow.ts` の hunk 一覧にこの行は現れない。
差分が入っているのは以下だけで、いずれも寄せる条件ではなく**寄せた後の見せ方**にあたる。

| 差分箇所 | 内容 | 条件を変えるか |
|---|---|---|
| `nearCandidates` | `score` を添える / `slice` を呼び出し側へ移す | 変えない (候補の中身は同じ) |
| review ループ | BR-005 の「候補 1 件がすべて除外済みなら要確認から出す」 | **変える (仕様が要求)** |
| excluded の生成 | `reasonCode` / `memo` も返す | 変えない |
| 第二段 (利用者判断) | 変更なし | — |

BR-005 は仕様の明示要件なのでスコープ内。判定は**除外前の候補数**で行い、
候補 2 件のうち両方を除外したときに明細ごと一覧から消えないようにしている。

### 2.3 照合・マトリクス・推移・診断タブの中身

これら 4 タブのページファイルに差分は無い。

変更した `packages/web/scripts/check-analysis-hub-visuals.mjs`、
`packages/web/src/analysis-mutation-invalidation.dom.test.tsx`、
`packages/web/src/chart-series-contract.test.ts` はいずれも**総収支の追加に伴う追随**で、
他タブの表示や規則には触れていない。

## 3. 差分の総量

```
53 files changed, 5779 insertions(+), 1087 deletions(-)
```

未追跡の新規を含めた内訳:

| 区分 | 件数 | 主なもの |
|---|---|---|
| 実装 (core / api / web) | 15 | 上表のとおり |
| テスト | 8 | 新規 4 / 追記 4 |
| migration | 1 | `0042` (追加のみ) |
| 仕様・アーキテクチャ・task | 20 | `specs/`、`architecture/`、`features/`、`tasks/`、`system-spec/` |
| docs | 9 | `docs/total-cashflow-screen/` 一式 |
| check スクリプト | 3 | financial-visuals / mobile-layout / analysis-hub-visuals |
| サンプル・seed | 5 | `samples/*.csv` 4 本と `scripts/seed-local.mjs` |

### サンプルと seed について

`samples/sample-{mf,freee}-{2025,2026}.csv` の 4 本と `scripts/seed-local.mjs` を変更している。
これは**画面テストを行えるようにするための従属変更**。
`SUBS` の日付ずれは 1 対 1 なので候補がちょうど 1 件の「重複候補」しか作れず、
候補が 2 件以上のときに出る「要確認」を画面で一度も開けなかった。
同額・同じ向きで 3 日以内に並ぶ freee を 2 件ぶつける組 (`AMBIGUOUS`) を 1 つ足した。

投入直後の実測 (`GET /api/total-cashflow?from=2026-01&to=2026-12`):

| 区分 | 件数 |
|---|---|
| 重複候補 | 15 |
| 要確認 | 1 |
| freee 除外 | 0 |

freee 除外が 0 なのは**利用者の操作結果だから**で、seed で作るものではない。
画面で「除外する」を押すと 1 件目が入る。

中身は架空データのみで、`security:content` が exit 0 であることを確認済み。

仕様が要求した差分ではないため、不要なら取り消して構わない。

## 4. 未決のまま残した設計判断

仕様が決めておらず、実装側で決めたもの。**変更可**。

| 箇所 | 決めたこと | 根拠 |
|---|---|---|
| `compareWorkbenchRows` | 判定作業の並びを 一致度の降順 → 発生日 → id | 一致度が高い組ほど機械的に片付き、上から順に押していける。id を最後に入れているのは並びを決定的にするため |
| 除外理由の既存行 | `reason_code` を一律 `other` に寄せ、理由文からの推測をしない | `docs/total-cashflow-screen/refactoring.md` §2 |
| 表記 | 「前期比」を「前年同期比」へ統一 | 仕様の未決事項。P12 で docs 側も揃えた |

## 5. 未実施

| 項目 | 状態 | 理由 |
|---|---|---|
| commit | 未実施 | 利用者が明示的に禁じている |
| push | 未実施 | 同上 |
| PR 作成 | 未実施 | 同上 |
| 本番配信と本番での表示確認 | 未実施 | PR を経由するため |

P13 の受入基準 (PR merge と本番適用) は本 branch の範囲では満たせない。
`docs/total-cashflow-screen/close-out.md` に未実施として記録している。
