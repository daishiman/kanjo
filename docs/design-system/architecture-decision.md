# 設計決定記録(SYS-DSFOUND-P02)

- 対象 feature: `feat-design-system-foundation`
- 前提: `docs/design-system/requirements-baseline.md`(P01)
- 整合確認先: `architecture/design-system-frontend.md`(Dependency Rule)、`architecture/design-system-backend.md`(packages/core の依存ゼロ)

本書は3つの決定を記録する。各決定の「根拠の出どころ」欄は、決定がエージェントの推定か、利用者の選択かを区別する。

## 決定一覧

| id | 決定 | 根拠の出どころ | 状態 |
|---|---|---|---|
| `dec-design-token-source` | トークン正本は `packages/core/src/design-tokens.ts`。styles.css と charts.ts はその写し | system-spec 確定意思決定(承認 `appr-foundation-design-system-002`) | confirmed |
| `dec-border-color-roles` | 装飾罫線は `#d7e0e2`、部品の枠は 3:1 以上の派生色 | system-spec 確定意思決定(同上) | confirmed |
| `dec-chart-series-contrast` | 系列色を暗くして 3:1 に余裕を持たせる(収入 `#428ce6`、支出 `#e2606d`) | **利用者の選択**(2026-09-13T11:06:08Z、選択肢「余裕をもって暗くする (Recommended)」) | confirmed |

補足(同じ体裁で記録する、それ以前の利用者選択):

| 時刻 | 選択肢 | 反映先 |
|---|---|---|
| 2026-09-13T04:36:20Z | 役割で分ける (Recommended) | 注意色の塗り用と文字用の分離(BR-002) |
| 2026-09-13T04:54:53Z | coreのTSを正本に (Recommended) / 今回は対象外で記録 | `dec-design-token-source` / レポート配色の移行を対象外に |
| 2026-09-13T07:48:34Z | 役割で2つに分ける (Recommended) | `dec-border-color-roles` |

---

## dec-design-token-source: トークン正本の配置と依存方向

### 決定

1. 正本は `packages/core/src/design-tokens.ts`。依存ゼロの TypeScript の readonly 定数で、色・文字・余白・角丸・影・動き・寸法を持つ。
2. `packages/web/src/styles.css` の `:root` は正本から**生成**した写しとし、`/* design-tokens:begin */` 〜 `/* design-tokens:end */` のマーカーで囲む。手書き部分(`var()` を組み合わせる派生値、`scroll-padding-top` など)はマーカーの外に置く。
3. `packages/web/src/components/charts.ts` は実行時に `getComputedStyle` で CSS 変数を読む経路を**維持**し、読めないときの予備値だけを正本から import する。
4. 写しのずれは `scripts/check-design-tokens.mjs` が検出し、`pnpm lint` に組み込む。`--write` を付けると styles.css の生成ブロックを書き戻す。

### 依存方向

```
packages/core/src/design-tokens.ts   (正本・依存ゼロ)
        │ import
        ├──> packages/web/src/components/charts.ts   (予備値)
        ├──> packages/web/src/**/*.ts(x)              (canvas 描画などCSSが届かない箇所)
        └──> scripts/check-design-tokens.mjs          (検査)
                     │ tokensを渡す
                     └──> scripts/design-token-css.mjs (CSS媒体adapter)
                                  │ 生成
                                  └──> packages/web/src/styles.css (:root の写し)
```

import の向きは web → core、値の流れは core → web の一方向で、core は web を知らない。`architecture/design-system-frontend.md` の Dependency Rule(表示技術に依存しない値は core)と一致する。

`scripts/check-design-tokens.mjs` は正本の `.ts` を Node 22.18 以降の型除去(既定有効)で直接 import する。そのため `design-tokens.ts` は他モジュールを import しない単独ファイルにする(`packages/core/src/index.ts` は `.js` 拡張子の import を含み node から直接読めない)。CI は setup-node の `22`(最新 22.x)で条件を満たす。高コントラスト用の上書き(`@media (prefers-contrast: more)` の `:root`)も正本から生成し、生成ブロック内に置く。

### 採らなかった案

- styles.css の `:root` を正本に維持し、予備値のずれを lint で塞ぐ案。CSS 解析なしに FR-001 / FR-004 のテストを書けず、次サイクルのレポート配色移行で同じ値を import できないため採らない。

### 互換性

- 既存の CSS 変数名は**名前を変えない**。値だけを正本へ寄せる。維持する名前は `packages/core/test/design-tokens.test.ts` が生成規則との包含関係で検査する。
- charts.ts の公開要素(`COLORS`、`vendorPalette`、`chartAnimation`、`baseChartOptions`、`yenTick`、`stackedTotals`、`stackTotalLabels`)は維持し、`COLORS` へ `income` / `expense` / `net` を**追加**する。
- `COLORS.biz` の予備値は `#2f5da8`(青)から `#087f78`(ティール)に変わる。予備値は CSS 変数を読めない環境(jsdom・CSS 適用前)だけで使われ、ブラウザでは既に `--biz: #087f78` が効いているため、画面の見た目は変わらない。
- `vendorPalette` の注意系列は塗り(棒)なので、文字用の `warn` ではなく `warnFill` を使う。
- 判別に使うチャート系列は `chartSeriesColor()` の不透明色を使う。帯・面・heatmap の透明色だけ `chartDecorativeFill()` を通し、consumer は16進 alpha suffix を直接連結しない。

---

## dec-border-color-roles: 境界色の役割分離

### 背景

DESIGN-SYSTEM.md の境界 `#D7E0E2` は白に対して 1.34:1。WCAG 2.2 の 1.4.11(非テキストのコントラスト)は「部品を識別するのに必要な視覚情報」に 3:1 を求め、装飾だけの罫線は対象外。

### 決定

| 役割 | CSS 変数 | 値 | 使う場所 | 1.4.11 |
|---|---|---|---|---|
| 装飾罫線 | `--line` | `#d7e0e2` | 表の罫線、カードの区切り、ボタンの輪郭(※) | 対象外 |
| 部品の枠 | `--control-border` | `#7f9095` | 入力欄・選択欄・テキストエリア・チェックボックス・共通Button | 3:1 以上 |
| 部品の枠(hover) | `--control-border-hover` | `#6e8086` | 上記の hover | 3:1 以上 |

- `#7f9095` は `#d7e0e2` と同系統の青緑灰(色相 193.6°、元は 190.9°)で、背景 `#f6f8f9` に 3.12:1、面 `#ffffff` に 3.32:1。完全な同色相で最初に 3:1 を超える値は `#77959c` だが、彩度が上がり罫線より目立つため採らない(design-review R-10)。
- 共通Buttonは標準操作の境界でもあるため、通常時に`--control-border`、hover時に`--control-border-hover`を使う。ARIA固有controlとして残すnative buttonは、それぞれの塗り・選択状態・配置で識別する。
- 高コントラスト設定(`prefers-contrast: more`)では `--control-border` を `--ink-soft` 相当まで濃くする。
- 入力欄・チェックボックス・共通Buttonが識別境界に `--line` を参照していないことを、FR-004 のテストで確かめる(BR-003)。

### 状態色の塗り用と文字用(BR-002)

同じ考え方を注意色にも当てる。

| 役割 | CSS 変数 | 値 | 背景比 / 面比 |
|---|---|---|---|
| 注意の塗り(画像どおり) | `--warn-fill` | `#b97000` | 3.66 / 3.90(塗り・アイコン用。文字には使わない) |
| 注意の文字 | `--warn` | `#9a5d00` | 5.00 / 5.33 |

`#9a5d00` は `#b97000` と同じ色相 36°・彩度のまま明度を下げ、背景に 5.0:1 に達する値。4.5 ぎりぎり(`#a26200`、4.60)ではなく 5.0 で止めたのは、淡い塗り `--warn-soft`(`#fdf9ef`、5.07:1)や `--danger-soft`(`#fdf3f3`、4.90:1)の上に文字を置いても 4.5 を割らないため。危険 `#b33a3a`(5.50 / 5.86)と成功 `#247a52`(4.95 / 5.28)は画像の値のまま文字に使える。

`color-mix()` で `--warn` を混ぜた色は比を保証できない(`--line` へ 48% 混ぜた枠は面上 2.49:1、14% の地色上の文字は 4.39:1 だった)。そのため `color-mix()` は使わず、淡い塗りは `--warn-soft` などの役割トークン、注意の枠は `--warn-fill` を使う(design-review R-01 / R-02)。

---

## dec-chart-series-contrast: チャート系列色

### 背景

FINAL-UI の画像で使われている系列色は、収入 `#599AE9`(背景 2.73:1)、支出 `#EB9099`(背景 2.19:1)で、1.4.11 の 3:1 に届かない。完成度評価で「推定のまま残っている」と指摘されていた(medium)。

### 利用者の選択

利用者に次の3案を提示し、2026-09-13T11:06:08Z に **「余裕をもって暗くする (Recommended)」** が選ばれた。

| 選択肢 | 提示した内容 |
|---|---|
| 余裕をもって暗くする (Recommended) ← 選択 | 色相を変えず明るさだけ下げる。収入 `#428CE6`、支出 `#E2606D`(背景 3.22:1)。FR-004 で系列色も 3:1 検査の対象に含める |
| ぎりぎり 3:1 まで暗くする | 収入 `#4B92E7`、支出 `#E46874`(背景 3.00 / 3.02:1)。背景色が少し変わると基準を割る |
| 画像どおり維持する | `#599AE9` / `#EB9099` のまま。FR-004 の系列色検査から除外し、理由を記録する |

### 決定

| 系列 | CSS 変数 | 値 | 背景比 / 面比 | 形 |
|---|---|---|---|---|
| 収入 | `--income` | `#428ce6` | 3.22 / 3.43 | 棒 |
| 支出 | `--expense` | `#e2606d` | 3.22 / 3.43 | 棒 |
| 純収支 | `--accent` | `#087f78` | 4.57 / 4.86 | 線 |
| 中立(経費など補助系列) | `--neutral` | `#7b8784` | 3.49 / 3.72 | 棒 |

- 追加パレット(ベンダー積み上げの5色目以降)も 3:1 を検査する。現行の `#8a8a8a`(3.24)ほか5色は基準を満たすので値を維持し、正本へ移す。
- `Subscriptions.tsx` の `#c4ccc9`(1.54:1)は系列色として基準未満のため、`neutral` へ置き換える。

---

## 矛盾確認

| 確認先 | 観点 | 結果 |
|---|---|---|
| `architecture/design-system-frontend.md` | core→web 一方向、getComputedStyle 経路の維持 | 一致 |
| `architecture/design-system-backend.md` | packages/core の依存ゼロ、API・DB を変えない | 一致(新ファイルは import を持たない) |
| `architecture/design-system-database.md` | 永続化しない | 一致 |
| `specs/spec-design-system-foundation.md` 確定意思決定 | `dec-design-token-source` / `dec-border-color-roles` の採択案 | 一致 |
