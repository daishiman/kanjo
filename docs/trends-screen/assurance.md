# 推移画面 品質保証 (SYS-TRENDS-P09)

## 実描画 (視覚検査)

`check:financial-routes` (`packages/web/scripts/check-financial-visuals.mjs`) に Trends を加えた。
11 条件で、主要図が意味どおりの 2 枚 (`収支の推移`・`増減の要因(パレート図)`) だけ描画され、
本体の幅が画面内に収まる。新比較画面には旧傾向判定を mount せず、rolling deploy の旧 Worker fallback だけを別契約で残す。

| 条件 | 主要図 | 判定 |
|---|---|---|
| 360〜1600px の 10 幅 | 2 | 条件帯・図・表・詳細が表示され、横方向のページはみ出しなし |
| rail-zoom200 | 2 | 200% 相当でも操作と読み順を維持 |

結果: 「財務画面の実描画検査: すべて合格」。`check:thead`・`check:mobile-layout`・
`check:financial-figure`・`check:analysis-hub` も合格。

はみ出しの修正: grid の子要素は既定で `min-width: auto` のため、横スクロールの表が列幅を押し広げていた。
`.trends` に `grid-template-columns: minmax(0, 1fr)`、`.trends > *` と `.trends-main > *` に `min-width: 0` を付けた。

## 初期 JS

`build:bundle` 直後に `check:js-budget`: **109.88 KiB / 110 KiB** (合格)。
推移画面は遅延読込の chunk (`Trends-*.js` 27.31 kB / gzip 8.85 kB) で、初期 JS に入らない。上限に近いため、次の依存追加前の分割確認を backlog に残した。

## 入力の検証

| 観点 | 対応 | 証跡 |
|---|---|---|
| 未登録の metric | 400 `invalid_metric` | api `未登録の metric は 400 invalid_metric、壊れた month・未知の scope/compare は既定値で 200` |
| 形式違反の month / 未知の scope・compare | 既定値で 200 | 同上 |
| プロトタイプ汚染 | 指標は配列の完全一致で引く | core `trend-metrics-contract.test.ts` |
| 取引先名の描画 | React のテキストとして描き、`innerHTML` を使わない | `CategoryBreakdown.tsx` |

## CSP

外部の script / style / fetch を足していない。chart は既存の `components/charts.ts` 経由。
既存の CSP ヘッダーの変更は無い (`preview:smoke` 合格)。

## アクセシビリティ

- 範囲・指標・比較対象の切替と月の並びは `role="group"` + `aria-label`。
  条件部品は `Conditions.tsx` に集約し、ラベルを画面上にも表示する。
- `/classify` の絞込表示は `role="status"` (output は解除ボタンを入れられないため。理由をコメントに記載)。
- 画面の区画は `section` + 見出しで区切り、増減は符号と文字 (増/減) を併記して色だけで伝えない
  (web `指標の切替は API の metrics から作り、増減は符号と文字を併記する`)。
- `prefers-reduced-motion` の実描画検査に合格。
