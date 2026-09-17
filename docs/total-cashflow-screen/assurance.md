# 総収支画面 保証の記録 (SYS-TCSCREEN-P09)

アクセシビリティ・CSP・初期 JS 予算・狭幅表示・入力境界の 5 点を、
自動で落ちる形にしたうえで実測値を残す。

## 1. アクセシビリティ (WCAG 2.2 AA)

### 色だけに頼らない表示

| 対象 | 色以外の手がかり |
|---|---|
| 判定状態 | 未判定 / 同じ / 別 / 除外 の**文字バッジ** |
| 前年同期比 | 符号 (`+` / `-`) と矢印 (`↑` / `↓`) |
| 一致度 | 数値そのもの (`72` など)。バーは補助 |

固定: `packages/web/test/total-cashflow-table.dom.test.tsx` の
`前年同期がそろっていれば差額と率を、欠けていればその旨を出す`。
色クラスではなく文字列を assert しているため、バッジを色だけの丸へ差し替えると落ちる。

### コントラスト

文字 4.5:1 / 部品 3:1 は `docs/design-system.md` のトークンが担保する。
本 branch は新しい色を定義せず、既存トークンだけを参照している
(`check-design-tokens` が新規色の直書きを検出する)。

### タップ領域

`check:mobile-layout` が判定作業の区分タブを実測する。最小 44px を下回ると落ちる。

## 2. CSP

`packages/api/src/index.test.ts` の `requiredStaticHeaders` が全応答で固定している。

```
default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self' data:;
form-action 'self'; frame-ancestors 'none'; img-src 'self' blob: data:;
object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

本画面に関わる点:

- `connect-src 'self'` — メモと摘要を外部サービスへ送る経路がそもそも塞がれている。
  「送らない実装にした」ではなく「送れない」状態。
- `script-src 'self'` — チャートは同梱の Chart.js で、CDN からは読まない。

メモと摘要は React の文字列描画だけで出しており、`dangerouslySetInnerHTML` は使っていない。

## 3. 初期 JS 予算

`check:js-budget` は `build:bundle` の**直後**に実行する。
`build:artifact` が manifest を消すため、順序を入れ替えると予算を測れない。

実測:

| 対象 | 値 |
|---|---|
| 初期チャンク `assets/index-Bkym1pfg.js` | **109.31 KiB / 上限 110 KiB** |
| `TotalCashflow-CqHP0A2n.js` (遅延) | 32.38 kB (gzip 9.64 kB) |

総収支画面は遅延チャンクへ分かれており、初期予算には乗らない。
残り 0.69 KiB しかないため、初期チャンクへ入る import を足すときは要注意。

## 4. 狭幅表示

`check:mobile-layout` に総収支の判定作業を測る節を足した (`total-cashflow-workbench`)。

見ているのは 4 つ。「横に並んでいない」だけでは足りず、
**3 列のまま幅だけ潰れた場合も top は揃う**ため、left が 1 つに収束していることも見る。

1. ペインが 3 つある
2. 3 ペインの `left` が全て同じ (= 1 列)
3. 各ペインの `scrollWidth <= clientWidth` (横に溢れていない)
4. 各ペインの幅が本体幅いっぱい

実測 (exit 0):

| 幅 | 結果 |
|---|---|
| 375px | 3 ペイン縦積み OK / 最小タップ 60px |
| 360px | 3 ペイン縦積み OK / 最小タップ 79px |
| 375px @2x | 3 ペイン縦積み OK / 最小タップ 233px |

### この節を書いたときに見つけた不具合

375px / 360px で `tcf-workbench-main` が横に溢れていた (524px > 301px)。
判定作業の表だけ `stack-sm` が付いておらず、7 列が横スクロールになっていた。

**実装を直した**: `packages/web/src/pages/analysis/TotalCashflow.tsx` の
`WORKBENCH_COLUMNS` の表を `className="data stack-sm"` へ。
同じ画面の他 3 表 (完全一致・freee のみ・除外) は元から `stack-sm` で、揃っていなかっただけ。

判定作業は行ごとに『同じ取引 / 別の取引』を押す作業なので、
最右の判定列が横スクロールの先にあると 1 件ごとに横送りが挟まる。

## 5. check:financial-routes

`packages/web/scripts/check-financial-visuals.mjs` の監査対象に
`/analysis/total-cashflow` を追加した (`additionalRoutes`)。

監査幅: 360 / 375 / 390 / 641 / 768 / 900 / 1023 / 1024 / 1280 px と `rail-zoom200`。
実測 `Total cashflow 図=1`、全幅で本体幅ぴったり。exit 0。

### この節を書いたときに見つけた不具合

最初 exit 1 になった。原因は React の key 警告:

```
Each child in a list should have a unique "key" prop.
Check the render method of WorkbenchSection. at tr
```

`<tr>` には key が付いていた。実際の原因は**テスト用 fixture を core の語彙で書いていた**こと。

- core: `ReconcileReview.mfTxId`
- API 応答: `txId` (`packages/api/src/routes/total-cashflow.ts` が境界で改名する)
- 画面が読むのは `txId`

fixture が `mfTxId` で書かれていたため `item.txId` が `undefined` になり、
key が全行 `undefined` で衝突していた。fixture を `txId` へ直して exit 0。

このスクリプトは `Runtime.consoleAPICalled` の `type==='error'` も不合格にするため、
React の警告が例外と同じ扱いで落ちる。fixture が本番と違う語彙で書かれていたことを
この仕組みが拾ったことになる。

## 6. 入力境界

`packages/api/src/routes/total-cashflow.ts` の zod スキーマ。
**400 は要求全体を拒否する**。一部だけ通して残りを黙って捨てない。

| 項目 | 境界 | 定数 |
|---|---|---|
| `reasonCode` | transfer / internal / book_only / duplicate / other の 5 語のみ (任意) | `EXCLUSION_REASON_CODES` |
| `memo` | 0〜200 字 | `EXCLUSION_MEMO_MAX` |
| `freeeKeys` | 1〜200 件 | `MAX_EXCLUSION_ITEMS` |
| 判定の一括 | 1〜200 件 | `MAX_VERDICT_ITEMS` |
| `reason` | 1〜200 字 (必須) | — |

本 phase で `packages/api/test/total-cashflow-verdict.integration.test.ts` に
境界値テスト 3 本を追加した。どれも**上限のすぐ内とすぐ外を対で**送る。

- `集計語は許可した 5 語だけを受け、知らない語は弾く` — 5 語すべて 200、
  `transfers` / `TRANSFER` / `振替` / 空文字は 400
- `メモは 200 字ちょうどまで受け、201 字は弾く` — 保存後の長さも 200 字のまま
  (受理してから黙って切る実装だと落ちる)
- `一括は 200 件ちょうどまで受け、201 件は弾く`

`reasonCode` を任意にしているのは、移行 0042 より前の画面が送る
`{freeeKey, reason}` だけの要求を弾かないため (FR-004 の互換要件)。

## 7. security:content

`bash scripts/hooks/guard-real-data.sh --scan-public-docs` が exit 0。

本 branch が追加した docs とテストに実データは無い。使っているのは:

- `samples/*.csv` の架空データ (seed 経由)
- テスト内の架空鍵 (`v1:freee:synthetic#N`、`v1:freee:whatever`)
- 架空の取引先名 (`架空クラウド` など)

## 8. 4 ゲートの結果

| ゲート | 結果 |
|---|---|
| `check:financial-routes` | exit 0 |
| `check:mobile-layout` | exit 0 |
| `check:js-budget` (`build:bundle` 直後) | exit 0 / 109.31 KiB |
| `security:content` | exit 0 |
