---
graph_node_id: "tasks-transaction-split-readability"
artifact_kind: "task"
title: "明細の分割記帳と科目の可読性 — タスク分解"
project_id: "kanjo"
domain: "accounting-records"
status: "complete"
file_path: "tasks/transaction-split-readability-tasks.md"
parent_feature: "feat-transaction-split-readability"
template_id: "task"
template_version: "1.0.1"
---

# タスク分解

`specs/transaction-splits.md` を実装単位に割ったもの。上から順に依存する。

## Slice 0 — 境界(core純関数)

### T01 コア — 分割の型と検証

- 変更: `packages/core/src/splits.ts`, `packages/core/src/index.ts`
- 内容: `TxSplitLine`、行数2〜50、整数・正数・科目必須、合計一致検証、
  最大剰余法による割合→金額変換(`splitByRatio`)。
- 受入: TS-1 / TS-2 / TS-3 / TS-4。端数のある割合でも合計が親と一致する。
- 証拠: `packages/core/test/splits-contract.test.ts`
- 依存: なし

### T02 コア — 投影(applySplits)

- 変更: `packages/core/src/splits.ts`, `packages/core/src/dataset.ts`
- 内容: 親1行を内訳N行へ置き換え、`projectedEdit` に `cls`/`big`/`mid` を載せる。
  名義・メモは親から引き継ぐ。符号は親から復元する。
  `projectAccountingDataset` = `structuredClone` → `applySplits` → `recomputeClassification`。
- 受入: TS-6 / TS-7 / TS-8。
- 証拠: `packages/core/test/splits-contract.test.ts`
- 依存: T01

### T03 コア — fail-closed

- 変更: `packages/core/src/splits.ts`
- 内容: 合計不一致・親金額変動・`line_id`重複・`identity_stable=0` で内訳を出さず、
  親の金額のまま数える。`splitProjection.state` を返して要確認を可視化する。
- 受入: TS-9 / TS-10。
- 証拠: `packages/core/test/splits-contract.test.ts`
- 依存: T02

## Slice 1 — 永続とAPI

### T04 データ — tx_splits

- 変更: `migrations/0025_tx_splits.sql`, `packages/api/src/schema-guard.ts`
- 内容: `(user_id, tx_id, seq)` / `(user_id, line_id)` の一意索引、`parent_amount` スナップショット。
  合計一致はDB制約ではなくアプリで検証する(行集合への制約はD1に置けない)。
- 受入: expand として先に適用され、`EXPECTED_D1_MIGRATION` が追従する。
- 証拠: `packages/api/src/schema-guard.test.ts`
- 依存: なし

### T05 API — 分割の保存と読み出し

- 変更: `packages/api/src/routes/`, `packages/api/src/store.ts`
- 内容: 保存前の合計検証、`loadDataset({ withSplits })` の既定 `true`、
  取込計画の下見だけ `false`。子行への quick/edit は409。
- 受入: TS-1 / TS-12。
- 証拠: `packages/api/src/split-lifecycle.test.ts`
- 依存: T03, T04

## Slice 2 — 波及先

### T06 コア — 証憑の畳み込み

- 変更: `packages/core/src/receipts.ts`
- 内容: 子行を `splitProjection.parentTxId` へ畳み、棚卸しの `accounts` に内訳の科目を併記。
- 受入: TS-11 / A7。
- 証拠: `packages/core/test/receipts-contract.test.ts`
- 依存: T02

### T07 コア — 他ページの集計への波及を検査で固定

- 変更: `packages/core/test/splits-contract.test.ts`
- 内容: 家計の科目別・名義別・事業立替・合計不一致時のふるまいを、投影後の
  `Dataset` に対して直接検査する。「画面では分かれているのに家計簿は未分類のまま」を検出する。
- 受入: A3 / A4 / A5 / A6。
- 依存: T02, T03

## Slice 3 — 画面

### T08 Web — 分割エディタ

- 変更: `packages/web/src/components/SplitEditor.tsx`
- 内容: 金額/割合の2入力、残額(あと¥X / ¥Xはみ出し)の常時表示、
  保存可否の即時判定。表を `.scroll-x` ではなく `.split-lines` で囲む。
- 受入: TS-U1 / TS-U3。
- 依存: T05

### T09 Web — 科目パネルを浮かせない

- 変更: `packages/web/src/styles.css`
- 内容: `.split-editor .cat-panel { position: static }`、科目列を480pxで先に確保、
  `.cat-picker` を `flex-wrap` に。狭幅の `stack-sm` 契約は維持する。
- 受入: TS-U2 / TS-U4 / TS-U5。
- 判断の背景: `docs/ui-decisions.md`「決定の更新(2026-08-30 / feat-transaction-split-readability)」
- 依存: T08

### T10 検査 — 実描画でパネルの切れを固定

- 変更: `packages/web/scripts/check-mobile-layout.mjs`
- 内容: 不変条件9を追加。分割エディタを開いた状態で、**分割エディタ内部の** `overflow` 祖先が
  パネルを切っていないことを headless Chrome で測る。外側の明細一覧は意図したスクロール領域なので除外する。
- 受入: A8 / A9。
- 証拠: `packages/web/src/mobile-layout-render.test.ts`
- 依存: T09

## Slice 4 — 反映と受領

### T11 ドキュメント反映

- 変更: `docs/spec-v1.1.md`(FR-12)、`docs/data-schema.md`、`docs/ui-decisions.md`、
  `specs/transaction-splits.md`、`architecture/arch-transaction-split-projection.md`、
  `features/feat-transaction-split-readability.md` + `.context.json`、本ファイル。
- 受入: FR-12 のリンク先が実在し、合流先の一覧が投影の実装と一致する。
- 依存: T07, T10

### T12 CI — wrangler types の一本化

- 変更: `packages/api/package.json`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
  `docs/ci-cd-operations.md`
- 内容: `typecheck` が `wrangler types` を内包し、workflow 側の個別ステップを外す。
  生成物 `worker-configuration.d.ts` は gitignore のまま、手元でも CI と同じ手順で通る。
- 受入: `pnpm typecheck` が生成物なしの状態から単独で通る。
- 依存: なし

# 受入証拠台帳

| 受入 | 証拠 | 状態 |
|---|---|---|
| A1 合計不一致は保存されない | `packages/api/src/split-lifecycle.test.ts` | PASS |
| A2 端数配分でも合計一致 | `packages/core/test/splits-contract.test.ts` | PASS |
| A3 家計の科目別が内訳で積まれる | 同上「他ページの集計への波及」 | PASS |
| A4 名義を親から引き継ぐ | 同上 | PASS |
| A5 事業内訳が事業立替へ | 同上 | PASS |
| A6 不一致は親の金額のまま | 同上 | PASS |
| A7 証憑棚卸しの畳み込み | `packages/core/test/receipts-contract.test.ts` | PASS |
| A8 パネルが切られない(実描画) | `check-mobile-layout.mjs` 不変条件9 | PASS |
| A9 狭幅のタップ領域 | 同上 | PASS |
| 品質ゲート | `pnpm lint` / `pnpm typecheck` / core 454 passed・web 296 passed・api exit0 | PASS |

# 残課題

- seed データは360行すべて `identity_stable = 1` のため、「ID なし・添付不可」の状態を
  手元で再現できない。TS-9 の `identity_unstable` 経路は単体検査だけで担保している。
