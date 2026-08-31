# Phase 07 — Mobile financial figure acceptance

- Task: `SYS-MOBFIN-P07`
- Result: **PASS**
- Environment: localhost only, deterministic anonymous fixtures only
- Production/remote access: none

## Acceptance result

| Surface | Figure contract reached through | Figure count in the route adapter | Seven visible meaning elements | Exact values | Result |
|---|---|---:|---|---|---|
| `/` | `OverviewPage` | 1 | heading, conclusion, period, unit, series, next action, table | named semantic table | PASS |
| `/analysis/matrix` | `MatrixPage` → `MatrixMoversChart` | 1 | complete | named mover table; sign also visible | PASS |
| `/analysis/trends` | `TrendsPage` | 3 | complete for split, waterfall, and Pareto | one table per figure | PASS |
| `/statements` | `StatementsPage` → `FinancialCharts` | 3 base figures, plus 2 BS figures when balance input exists | complete | one table per available figure | PASS |
| `/household` | `HouseholdPage` | 1 | complete | named monthly table | PASS |
| `/subscriptions` | `SubscriptionsPage` | 1 | complete | all series retained in the table | PASS |
| `/ai` | `ReportChart` for every supported imported report chart | 1 per available report chart | complete | report chart rows retained | PASS |

Route wiring was checked against the route components, while rendered semantics were
checked by the focused DOM suite and the shared primitive tests. A route without its
required input shows the existing empty state; it does not manufacture a zero-sized
canvas.

## Viewport matrix

> **訂正あり (2026-08-31)** — 以下の 8 ケース表と直後の 200% 相当に関する記述は、
> 記録当時のまま残す原記録である。その後の検証で **一部が過大報告であったことが判明** した
> (44 px / focus / タブバー被りの判定が実在しない要素に対して行われていた、
> `200% equivalent` が 200% を再現していなかった)。
> 何が誤りで何に置き換わったかは末尾の
> 「Addendum (2026-08-31) — 証跡の訂正」を参照すること。この表単体を根拠に使わないこと。

The deterministic financial figure was measured in headless Chrome after the
`origin/main` integration. Every case required positive figure/chart dimensions,
document overflow <= 1 CSS px, all seven meaning elements, a named keyboard-scrollable
local table, a visible keyboard focus outline, and a concise canvas name.

| Case | Width x height | Document overflow | 44 px controls at mobile width | Table is local scroll region | Focus | Result |
|---|---:|---|---|---|---|---|
| 320 reflow | 320 x 720 | PASS | PASS | PASS | PASS | PASS |
| 360 mobile | 360 x 720 | PASS | PASS | PASS | PASS | PASS |
| 375 mobile | 375 x 812 | PASS | PASS | PASS | PASS | PASS |
| 390 mobile | 390 x 844 | PASS | PASS | PASS | PASS | PASS |
| 768 tablet | 768 x 900 | PASS | N/A (pointer layout) | PASS | PASS | PASS |
| 1280 desktop | 1280 x 900 | PASS | N/A (pointer layout) | PASS | PASS | PASS |
| 1600 wide | 1600 x 1000 | PASS | N/A (pointer layout) | PASS | PASS | PASS |
| 200% equivalent | 320 x 640 | PASS | PASS | PASS | PASS | PASS |

At the 200% equivalent, conclusion, series, disclosure, exact table, final action,
and reduced-motion behavior remained present. Wide values overflowed only inside the
named table region. The final action stayed above the mobile tab bar, including its
safe-area allowance.

## Commands and observations

| Command | Result |
|---|---|
| `pnpm preview` | PASS: local migrations and web build completed; Wrangler selected the free shared-workspace port 8788 and served the SPA (`GET /` 200). The finite process was then stopped. |
| `pnpm preview:smoke` | PASS on the final retry: isolated temporary state, SPA, local authentication, cash entry, and attachment create/read/delete completed in 50.7 s. The first attempt had one local 5 s response timeout and is retained as transient history, not hidden. |
| `node packages/web/scripts/check-mobile-financial-layout.mjs` | **訂正後 (2026-08-31): PASS: 3/3 viewport cases** (`320` / `375` / `reduced-motion`)。原記録は「PASS: 8/8 viewport cases」だったが、fixture が 3 ケースへ削減され、DOM が `renderToStaticMarkup` による実装由来の描画と実測アサーションへ置き換わった。削減した 5 ケース (`360` / `390` / `768` / `1280` / `1600`) は実ルート検証 `check-financial-visuals.mjs` が同一ラベルでカバーするため被覆は落ちていない。詳細は末尾の Addendum。 |
| `pnpm --filter @kanjo/web exec vitest run src/mobile-financial-layout.test.ts` | PASS: 1 file / 3 tests, 19.91 s, normal exit after Chrome pipe cleanup. |
| focused route DOM suite | PASS: 7 route-related files / 28 tests. |

The plain preview did not have local authentication configuration in its process
environment, so its authenticated check correctly returned the existing
`auth_not_configured` response. The separate isolated smoke supplied ephemeral test
configuration and established the authenticated path without reading or changing any
repository credential file. No real financial input was used.

## Five feature acceptance conclusions

1. Financial relationships are not removed on mobile: **PASS**.
2. Conclusion, comparison period, unit, series, and next action precede detail: **PASS**.
3. Accurate values remain available from the same view model in a semantic table: **PASS**.
4. 320–390 px, 200% equivalent, focus, tap targets, safe area, and local overflow: **PASS**
   (訂正: このうち「200% equivalent」「tap targets」「focus」「safe area」の 4 者は
   当時の根拠が無効だった。訂正後の根拠は末尾の Addendum を参照)。
5. Desktop/tablet compatibility at 768/1280/1600 px: **PASS**.

P08 entry gate: **OPEN**.

## Final localhost performance and reflow acceptance

The parent repeated the real localhost audit with Fast 4G and 4x CPU throttling
after reserving the loading header geometry. The final-digest rerun measured LCP
**1.217 s** and CLS **0.00** (previously 0.23). Lighthouse mobile Accessibility
and Best Practices both scored **100** (previously Best Practices 93); 56
applicable checks passed. The four non-passing SEO/agentic checks are intentional
for this authenticated application and are not accessibility, contrast, target,
or runtime regressions.

The subsequent fail-first 200% regression and repair are also included in this
phase: the exact browser inspector now reports 0 px document overflow at 375 px,
with 44 px normal and 88 px zoomed tap targets. The eight-condition financial
fixture (訂正 2026-08-31: 現在は 3 条件。末尾の Addendum 参照),
actual React/Chart.js routes, and 55-file full suite all pass at final
digest `7eb4f647552b06eb6b88d6d44b6ac963416992dd00530a26fd0fabe0e120c717`
(**訂正 2026-08-31**: 当時の記録値は第1世代 `6bb3085…` だったが算出方法が残っておらず比較できない。
第2世代 `866cee53…` を経て現在は第3世代。過去の値は phase 冒頭に残置。
世代の整理は `phase-11-reproducible-evidence.md` の Addendum)。

## Addendum (2026-08-31) — 証跡の訂正: viewport ケース削減と過大報告

原記録は書き換えず、何が誤りで何に置き換わったかを対応表として残す。
これは記述合わせではなく、**当時の証跡が実態より広く PASS を主張していたこと**の訂正である。

### 訂正1: 8 ケース → 3 ケース (被覆は落ちていない)

`check-mobile-financial-layout.mjs` の fixture ケースは
`320` / `375` / `reduced-motion` の 3 件になった
(`packages/web/scripts/check-mobile-financial-layout.mjs:119`、
定義は `packages/web/scripts/viewports.mjs:22, :32`)。

削減が被覆低下にならない理由は、**責務が分離されたから**である。

| ラベル | 訂正前 (fixture) | 訂正後の担当 |
|---|---|---|
| `320` | fixture | fixture (最小幅 reflow) + 実ルート `check-financial-visuals.mjs:15` |
| `375` | fixture | fixture (代表モバイル幅) + 実ルート同上 |
| `360` / `390` / `768` / `1280` / `1600` | fixture | **実ルート検証のみ** (`check-financial-visuals.mjs:15` が同一ラベルで実施) |
| `reduced-motion` | 無し (旧 `200pct-equivalent` が誤って占めていた) | fixture のみ。実ルート側は `prefers-reduced-motion: reduce` を常時かけるため、動きのある baseline と停止後を比較できるのは fixture だけ (`check-mobile-financial-layout.mjs:117-118, :291, :298`) |

### スクリーンショットの置き場所と、画像が無い幅について

| 置き場所 | 撮ったスクリプト | ケース |
|---|---|---|
| `evidence/screenshots/*.png` | `check-mobile-financial-layout.mjs`（合成フィクスチャ） | `320` / `375` / `reduced-motion` |
| `evidence/screenshots/routes/*.png` | `check-financial-visuals.mjs`（実ルート） | 各ルート × `375` / `1280` |

**`360` / `390` / `768` / `1600` 幅には画像が無い。これは意図的な方針であり、
「検証していない」という意味ではない。** 実ルートスクリプトはこの4幅を**計測**しており、
合否判定は計測値が行っている。撮影を 375 / 1280 に絞っているのは、
画像を増やしても誰も見ない証跡が増えるだけだからである。
旧証跡に8幅ぶんの画像があったのは、旧フィクスチャが8ケースを自前で回していた副産物にすぎない。

旧 8 枚は 2026-08-31 に削除された。`screenshots/` 直下は現在 3 枚
(`320.png` / `375.png` / `reduced-motion.png`) で、`mobile-viewport-results.json` が
参照する 3 枚と**過不足なく一致**する（参照されない画像は 0 件、参照だけあって実体が無い画像も 0 件）。
削除されたうちの `200pct-equivalent.png` は、**名前が中身と一致しておらず、
しかもどの証跡からも参照されていないファイル**だった。

加えて fixture の DOM は、スクリプト内の手書き文字列から
`FinancialFigure.tsx` を `renderToStaticMarkup` で描画したものへ置き換わった
(`check-mobile-financial-layout.mjs:84-86, :342`)。
これによりフェーズ1所見 C の「コンポーネント構造が変わっても fixture は追随せず緑のまま通る」
ドリフト経路が閉じている。

### 訂正2: 実質空だった判定 (過大報告)

原記録の viewport 表で PASS としていた
**44 px コントロール / focus-visible / タブバー被り** の判定は、
実装に存在しないセレクタ `.financial-test-last-action` を対象にしていた。
現在の repository 全体でこの文字列の出現は **0 件**であり、
当時も同じ要素は存在しなかったため、これらの判定は空振り (vacuously true) だった。

- 誤り: 対象が 0 個でも「違反 0 件」として PASS になる判定形だった。
- 置き換え: 実装から生成した DOM に対する実測アサーションへ変更。
  対象が存在しない場合は PASS ではなく失敗として扱われる。
- 影響範囲: 上記「Five feature acceptance conclusions」の 4 番。

### 訂正3: `200pct-equivalent` は 200% を再現していなかった

旧ラベル `200pct-equivalent` (320 x 640) は
`deviceScaleFactor: 1` のままで `Emulation.setPageScaleFactor` を呼んでおらず、
**単に狭い viewport を測っていただけ**で 200% zoom ではなかった。
実体は reduced-motion の検査だったため、`reduced-motion` へ改名された
(`packages/web/scripts/viewports.mjs:32`)。

真の 200% zoom の根拠は **`zoom200` のみ**である:
375 x 812 / `zoom: 2` (`viewports.mjs:30`) を
`check-financial-visuals.mjs:15` が実ルートに対して実行し、
`Emulation.setPageScaleFactor` で倍率を適用する (`check-financial-visuals.mjs:594`)。

したがって本フェーズ記録中の「200% equivalent」「At the 200% equivalent, ...」
「200% 相当」という表現は、いずれも **200% zoom の証拠ではない**。
200% に関する主張は `zoom200` の結果のみを引くこと。

## Addendum (2026-08-31) — M03: `次の行動` の重複解消

7要素契約のうち `次の行動` について、**要素は存在するが中身が機能していなかった**件の是正。

**問題**: `action` 13件のうち12件が `…を表で確認し、` で始まり、
直下の `<details>` 見出し「正確な値を表で確認」と逐語で重複していた。
1画面に図が4〜5個並ぶため、全図が同じ書き出しだと次の行動として読まれない（banner blindness）。

**採らなかった案**: `action` を optional にして情報量のない図から外す案は却下。
`check-financial-visuals.mjs`（3箇所）と `check-mobile-financial-layout.mjs`（1箇所）が
`[data-financial-action]` の存在を7要素契約として実測しており、
optional 化はこの検証を緩めることになる。
本レビューで一貫して排除してきた「テストを実装に合わせて弱める」形なので採らなかった。
**要素の存在（構造）は守り、重複していた中身だけを直す**方針を採った。

**実施**: 12件を、前置きを外して図ごとに固有の行き先・判断だけを書く形へ変更。
うち「利益と営業CFの差が大きい月を表で確認します。」
「累計がマイナスに転じた月を表で確認します。」の2件は
**直下の表を指す以上の情報がゼロ**だったため、実際の次の判断
（売掛金・在庫の増加との照合／支払いの前倒しの遡り）へ書き換えた。
`figure-view-model.ts` の `action` 型に、前置きを書かない規則とその理由をコメントで明記。

**再発防止のテスト**: `mobile-financial-visualization.dom.test.tsx` に1件追加。
`CashFlowCharts` を描画し、(1) `[data-financial-action]` が**ちょうど2件**
（対象0件で緑にならないよう件数を固定）、(2) 互いに異なる、
(3) `表で.*確認` を含まない、を判定する。

**空振りでないことを検算済み**: 旧2文はどちらも (3) に掛かり、新文面は通る。
重要なのは **(2) の重複判定だけでは旧文面を落とせなかった**こと
（旧文も互いには別文字列だった）で、だから (3) を別に置いている。
本 feature で繰り返し問題になった「検査対象が0個でも緑になる判定」を
件数固定で塞いだ形でもある。

**検証結果**: typecheck PASS（core / api / web）、`biome check .` 281 files で修正なし、
`pnpm test` 55 files / 308 tests PASS（追加1件ぶん増）、
証跡再生成は `320` / `375` / `reduced-motion` すべて PASS（EXIT=0）。
