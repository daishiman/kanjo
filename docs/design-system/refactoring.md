# 予備値と重複トークン値の除去(SYS-DSFOUND-P08)

- 対象 feature: `feat-design-system-foundation`
- 対象: `packages/web/src/components/charts.ts`、`packages/web/src/styles.css`(生成ブロックの外)
- 前提: P05 で `packages/core/src/design-tokens.ts` を正本にし、`styles.css` の `design-tokens:begin 〜 end` を生成物にした
- 実施日: 2026-09-13

## 1. charts.ts の予備値

`architecture/design-system-frontend.md` が課題にしていた3点は、いずれも正本を参照する形になっている。

| 課題(移行前) | 移行後 | 確認方法 |
|---|---|---|
| `COLOR_FALLBACKS` 9色が styles.css とずれていた(biz `#2f5da8` 対 `#087f78`、ink `#1d2a2c` 対 `#15262b`、inkSoft `#51625f` 対 `#617177`、line `#dde3e1` 対 `#d7e0e2`) | `COLOR_FALLBACKS` を削除。CSS 変数を読めない環境の予備値は `@kanjo/core` の `COLOR` から取る | `grep -n "COLOR_FALLBACKS" packages/web/src -r` が 0 件 |
| `neutral #7b8784` は CSS 変数を持たず直書きだけだった | 正本 `COLOR.neutral` から `--neutral` を生成し、図も同じ変数を読む。`WITHOUT_CSS_VARIABLE` の特別扱いを削除 | styles.css 生成ブロックに `--neutral: #7b8784;` |
| `VENDOR_EXTRA_COLORS` 5色が charts.ts に直書き | 正本 `VENDOR_EXTRA_COLORS` を import。5色は背景・面に 3:1 以上をテストで確認 | `design-tokens-contrast.test.ts`「チャート系列色(追加パレットを含む)」 |
| 文字の family / size が charts.ts に直書き | `TYPOGRAPHY.fontHead` / `TYPOGRAPHY.chartFontSize` を参照 | `font-loading-contract.test.ts` |
| CSS 変数名の対応表 `CSS_VARIABLE` を手で持っていた | キー名から `--kebab-case` を導出する `cssVariable()` に置き換え、表を削除 | 13色すべてが `COLOR` のキー |

互換性: 公開している `COLORS`(ゲッター)・`vendorPalette()`・`themeColor` の読み方(初回だけ実読みし、読めない間は覚えない)は変えていない。`COLORS.net` は `accent`(ティール線)を返す。`vendorPalette()` の注意系列は塗りなので `warnFill` を使う(design-review R-13)。

`packages/web/src` の未許可なhex/rgb/hsl/CSS Color構文は0件(`node scripts/check-design-tokens.mjs` が全体を検査)。

## 2. styles.css に残っていた正本とのずれ

### 2.1 高コントラスト設定の事業色(修正)

`@media (prefers-contrast: more)` の上書きで、事業色の淡い面と濃い文字だけが事業色を青(`#2f5da8`)にしていた頃の値のまま残っていた。通常時の事業色はティール `#087f78` なので、高コントラスト設定の利用者にだけ事業の面が青く出ていた。この値は P05 で正本 `HIGH_CONTRAST_COLOR` へ移したときにそのまま転記されていた(移行前の styles.css にも同じ値がある)。

| トークン | 移行前 | 修正後 | 根拠 |
|---|---|---|---|
| `--biz-soft` | `#dbe6f8`(青, 色相 217°) | `#d3ebe8`(ティール, 173°) | 事業色 `#087f78`(176°)と同じ色相。`#087f78` との比 3.90:1 |
| `--biz-strong` | `#10294f`(紺, 216°) | `#04403c`(濃いティール, 176°) | `#d3ebe8` の上で 9.32:1(高コントラスト設定なので 7:1 を目安にした) |

再発防止: `design-tokens-contrast.test.ts` に「高コントラスト設定の事業色は通常時の事業色と同じ色相(差 10° 以内)で、濃い文字は淡い面に 7:1 以上」を追加した。修正前の値でこのテストが落ちることを確認してから値を直した。

### 2.2 生成ブロック外のトークン値の直書き(置換)

| 直書き | 置換先 | 件数 | 値の変化 |
|---|---|---|---|
| `border-radius: 8px;` | `border-radius: var(--radius);` | 37 | なし(`--radius: 8px`) |
| `.header` の `min-height: 64px;` | `min-height: var(--header-h);` | 1 | なし(`--header-h: 64px`) |

どちらのトークンも生成ブロック以外で再定義されていないので、計算値は置換前と同じ。

### 2.3 意図して残した直書き

| 直書き | 件数 | 残した理由 |
|---|---|---|
| `min-height: 44px;` | 24 | `classify-editor-contract.test.ts` などの既存の契約テストが「44px と書かれていること」を正規表現で直接検査している。置き換えるには契約テストの書き換えが要り、P08 の write scope を越える。値は `--tap-target-min: 44px` と同じなので見た目のずれは無い。次サイクルで契約テストを「`--tap-target-min` を参照し、その値が 44px」の二段に改めてから置き換える |
| `.deletion-scope-options label` の `min-height: 64px` など | 数件 | ヘッダーの高さとは意味が違い、値が偶然一致しているだけ。トークンにすると、ヘッダーを変えたときに無関係な部品まで変わってしまう |
| `220px`(`minmax(220px, 1fr)` など) | 2 | サイドバー幅とは無関係な列の最小幅 |

## 3. 検証

| コマンド | 結果 |
|---|---|
| `node scripts/check-design-tokens.mjs` | 「正本と写しが一致し、色の直書きは 0 件」exit 0 |
| `pnpm --filter @kanjo/web test` | `docs/design-system/test-run.md` に記録 |
| `pnpm lint` | 同上 |
| `pnpm --filter @kanjo/web run check:financial-figure` | 同上 |

## 4. ロールバック

`charts.ts`・`styles.css`・`design-tokens.ts`(`HIGH_CONTRAST_COLOR`)と `design-tokens-contrast.test.ts` の変更を revert すると P07 完了時点に戻る。
