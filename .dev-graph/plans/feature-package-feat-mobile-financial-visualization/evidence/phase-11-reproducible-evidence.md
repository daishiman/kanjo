# P11 Reproducible anonymous evidence

- Task: `SYS-MOBFIN-P11`
- Result: **PASS**
- Source/test digest:
  `7eb4f647552b06eb6b88d6d44b6ac963416992dd00530a26fd0fabe0e120c717`
  - **過去の値 (消さずに残す)**: 第1世代 `6bb30856604f1dd065d78f707fd45771942a40ce00a15f5dd501f8aca144080a`（算出方法・対象ファイル集合が記録されておらず、以降の値とは**比較できない**）／第2世代 `866cee535cba13facc6494a449021036dd240f96ed5e12b2b1fa84933b4d999e`（`source-digest.mjs` 導入後の実計算値。M03 実装で対象3ファイルが変わったため第3世代へ）。digest は working tree のスナップショットであり、対象15ファイルが変われば動くのが正常。値そのものを追うのではなく、`mobile-viewport-results.json` の `digestInputs` でその値が何を測ったかを見ること。詳細は `phase-11-reproducible-evidence.md` の Addendum。
- Environment: macOS arm64, Node.js v22.21.1, pnpm 10.9.0
- Chrome path: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Chrome version: 151.0.7922.174
- Evidence run: started `2026-08-30T16:03:26.444Z`, completed
  `2026-08-30T16:03:36.763Z`

The digest covers the feature production source, contract tests, and both Chrome
inspection scripts. Documentation and evidence files are intentionally excluded so
this report can be written after verification without invalidating the tested code.

## Fixed commands and results

| Command | Exit | Actual result |
|---|---:|---|
| `pnpm --filter @kanjo/web test` | 0 | 55 files / 304 tests PASS in 272.30 s |
| `pnpm --filter @kanjo/web build` | 0 | Vite built 180 modules; initial JS 104.55 KiB / 110 KiB |
| `pnpm --filter @kanjo/web typecheck` | 0 | TypeScript errors 0 |
| `pnpm lint` | 0 | Biome checked 278 files and repository consistency checks passed |
| `node packages/web/scripts/check-mobile-financial-layout.mjs --output-dir=.dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence` <br>**このコマンド行は 2026-08-31 に変わった。当時は末尾に `--source-digest=6bb3085…` を付けていたが、この引数は廃止され、渡すと例外で終了する**（値を無視する実装だと、この行をそのまま再実行した人には成功に見えて JSON に別の値が入るため）。digest は `packages/web/scripts/source-digest.mjs` が実行時に算出する。 | 0 | 8/8 viewport conditions PASS; JSON and screenshots regenerated。**訂正 (2026-08-31): 実体は 3/3 conditions** (`320` / `375` / `reduced-motion`)。`mobile-viewport-results.json` は**再生成済み** (`schemaVersion: 3`、`measurements` は `320` / `375` / `reduced-motion` の 3 件)。`screenshots/` 直下の旧 8 枚 (`200pct-equivalent.png` を含む) は 2026-08-31 に**削除済み**で、現在は JSON が参照する 3 枚 (`320.png` / `375.png` / `reduced-motion.png`) だけが残る。詳細は `phase-07-acceptance.md` の「Addendum (2026-08-31) — 証跡の訂正」 |
| `git diff --check` | 0 | whitespace errors 0 |

The required `test && build` acceptance is satisfied because both exact commands
completed successfully against the same source/test digest. No result from a timed
out or interrupted invocation is represented as PASS.

## Viewport, route, expected, and actual

The machine-readable authority is
[`mobile-viewport-results.json`](./mobile-viewport-results.json). It records each
viewport's timestamp, dimensions, expected constraints, measured values, exit
status, and the source digest above.

| Route set | Viewports | Expected | Actual |
|---|---|---|---|
| `/analysis/matrix`, `/statements` | 320 reflow, 360, 375, 390, 768, 1280, 1600, 200%-equivalent | required financial figures visible; heading, conclusion, period, unit, series, action, and semantic table present; chart box and bitmap non-zero; document overflow <= 1 px | PASS at every condition |
| `/`, `/analysis/trends`, `/subscriptions`, `/household`, imported anonymous AI report | 360, 375, 390, 1280 | actual React/Chart.js route; every figure has the same seven meaning elements, non-zero canvas geometry and bitmap, exact table, and document overflow <= 1 px | PASS at every route/viewport |
| `/subscriptions` high-cardinality anonymous fixture | 360, 375, 390, 1280 | canvas has at most seven datasets; its labels exactly equal the non-canvas series list; exact table retains all 20 named vendors plus `その他` | PASS; 7 summary datasets and 21 exact series |

Generated screenshots contain deterministic fictitious values only:

- `screenshots/320-reflow.png`
- `screenshots/360-mobile.png`
- `screenshots/375-mobile.png`
- `screenshots/390-mobile.png`
- `screenshots/768-tablet.png`
- `screenshots/1280-desktop.png`
- `screenshots/1600-wide.png`
- `screenshots/200pct-equivalent.png`

## Privacy and reproducibility audit

```sh
rg -n "data/|dev.vars|token|secret" \
  .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence
```

At P11 execution time the scan found only two pre-existing human-readable boundary
statements: P01 says real data and secrets are prohibited, and P10 says the feature
diff for data/infrastructure was zero. P11-P13 documentation subsequently adds the
command itself and local-only credential boundary instructions. The final scan has
16 prose matches, all of which are names or prohibitions; none contains a credential
value. There are no tokens, production logs, personal data, or real-account
screenshots in the bundle. All visual inputs are anonymous in-memory fixtures. No
`data/` file or `packages/api/.dev.vars` was read into or copied into evidence, and
no remote service was mutated.

P12 handoff gate: **OPEN**.

## Addendum (2026-08-31) — source/test digest: 値・対象・算出手段の三点セット

### 正本は記述ではなくコード

以前この節には算出コマンドを文章として書いていた。それは廃止する。
**算出方法の正本は `packages/web/scripts/source-digest.mjs` である。**

| 何を知りたいか | どこを見るか |
|---|---|
| 値 | `mobile-viewport-results.json` の `sourceDigest` = `866cee535cba13facc6494a449021036dd240f96ed5e12b2b1fa84933b4d999e` |
| 何を対象に測ったか | 同 JSON の `digestInputs.sources` — 対象15ファイルの相対パスと個別 sha256 |
| どう算出したか | 同 JSON の `digestInputs.method` / `algorithm` / `root`（実行時の値として出力）と、正本コード `packages/web/scripts/source-digest.mjs` の `DIGEST_SOURCES` / `DIGEST_METHOD` |

対象15ファイルは、旧14ファイルに `source-digest.mjs` 自身を加えたもの。
**指紋の作り方が変われば指紋も動くべき**なので自己参照している。

### 独立検算 (2026-08-31)

`digestInputs.method` の説明文だけを読んで別実装（Python）で再計算し、
`866cee53…` が一致することを確認した。相手のスクリプトは呼んでいない
（呼べば「同じコードが同じ値を出す」ことしか言えないため）。
`digestInputs.sources` 15件の個別ハッシュも全件 working tree と一致。

### `--source-digest=` は廃止された

digest は外から渡すラベルではなく、スクリプトが算出する測定値になった。
`--source-digest=` を渡すと**例外で終了する**。無視する実装にしなかったのは、
本ファイルの旧コマンド行をそのまま再実行した人に成功と見え、
JSON に別の値が入ってしまうためである。
対象ファイルが読めない場合と `DIGEST_SOURCES` が空の場合も例外（EXIT=9）。

### commit との関係 — 限界を消さず機械可読にした

`digestInputs.commit` に以下が入る。

| 欄 | 今回の値 |
|---|---|
| `sha` | `6b98b32e99100a29ca9e6ad567a26f2f596c2867` |
| `sourcesMatchCommit` | **`false`** |
| `uncommittedSources` | 15中 **14ファイル**（フェーズ3の変更が未コミットのため） |

digest を commit へ固定する設計は採らなかった。固定すると、未コミット状態では
**digest が実際に測ったソースを指さなくなる**からである。
代わりに「この digest は commit で再現できない。理由はこの14ファイルが未コミットだから」と
証跡の読み手が**機械的に言える**形にした。
**コミット後に再生成すれば `sourcesMatchCommit` は `true` になる。**

### digest の世代 — 値が動くのは正常

digest は **working tree のスナップショット**である。対象15ファイルのどれかが変われば値も変わる。
**値そのものを追いかけるのではなく、`digestInputs` でその値が何を測ったかを見ること。**

| 世代 | 値 | 何が起きたか | 対象と算出手段の記録 |
|---|---|---|---|
| 第1世代 | `6bb30856604f1dd065d78f707fd45771942a40ce00a15f5dd501f8aca144080a` | 当時の記録。`--source-digest=` で外から渡したラベル | **無し**。以降の値と比較できない |
| 第2世代 | `866cee535cba13facc6494a449021036dd240f96ed5e12b2b1fa84933b4d999e` | `source-digest.mjs` 導入後の最初の実計算値 | `digestInputs` に同梱 |
| 第3世代 | `7eb4f647552b06eb6b88d6d44b6ac963416992dd00530a26fd0fabe0e120c717` | **現行**。M03 (`次の行動` の重複解消) で対象3ファイルが変わった | `digestInputs` に同梱 |

第2→第3の変化は異常ではなく、この設計が意図どおり動いている実例である。
M03 で `FinancialCharts.tsx` / `figure-view-model.ts` /
`mobile-financial-visualization.dom.test.tsx` の3ファイルが変わり、値が追従した。
第1→第2との違いは、**第2以降は「何が変わったから値が動いたか」を `digestInputs.sources` の
個別ハッシュ差分で特定できる**点にある。第1世代にはその手段が無い。

過去の値は各フェーズ証跡に**そのまま残してある**（消していない）。
数字を差し替えて連続性があるように見せていない。

### 第1世代の値が比較できない理由

算出方法・対象ファイル集合が記録されていないため。
当時 digest が `--source-digest=` で外から渡すラベルだったことの必然的な結果である。
この構造欠陥は上記のとおり解消済み。

### 第3世代時点の検算と再生成結果 (2026-08-31)

- `digestInputs.method` の記述だけを読んだ独立実装 (Python) で再計算し `7eb4f64…` が一致。
- `digestInputs.sources` 15件の個別ハッシュも全件 working tree と一致。
- `mobile-viewport-results.json` の `measurements` は `320` / `375` / `reduced-motion` の3件、`result` は PASS。
- `commit.sha` は `6b98b32e…`、`sourcesMatchCommit: false`、`uncommittedSources` 14件（変化なし）。

### 証跡の健全性の判定基準

**証跡は多いほど良いのではなく、参照と一致しているほど良い。**

参照されないファイルが混ざっている状態は、網羅性が高いように見えて、
実際には嘘が混じる余地が増えているだけである。
本 feature の `200pct-equivalent.png` がその実例だった。
名前が中身と一致しておらず（200% を再現していない画像に 200% の名前が付いていた）、
しかもどの証跡からも参照されていなかったため、
**誤りが誰にも検出されないまま残り続けられる状態**にあった。
参照されていれば、参照元の記述と突き合わせた時点で矛盾が露見していた。

したがって証跡ディレクトリに対して確認すべきは枚数ではなく、次の2方向である。

- 参照されているが実体が無いファイル: 0 件
- 実体はあるが参照されていないファイル: 0 件

2026-08-31 時点の実測ではいずれも 0 件で、
`mobile-viewport-results.json` が参照する 3 枚と `screenshots/` 直下の 3 枚が一致する。
`screenshots/routes/` の 22 枚は実ルート検証が生成する別系統で、
`check-financial-visuals.mjs` の対象ルート × `375` / `1280` に対応する。
