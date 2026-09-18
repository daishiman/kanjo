# デザインシステム規約

新しい画面・図・部品をつくるときは、まずこの文書を読む。見た目の値の**手編集による規範正本**はここに置かない。以下の値は利用方法を説明する読解用カタログであり、編集・機械判定の正本は `packages/core/src/design-tokens.ts` とする。

| 何を | 正本 | 写し・利用側 |
|---|---|---|
| 色・寸法・文字・動き・影の値 | `packages/core/src/design-tokens.ts` | `packages/web/src/styles.css` の `design-tokens:begin 〜 end`(生成物)、`packages/web/src/components/charts.ts` |
| 値の出典(20画面の画像から決めた規定値) | `design/FINAL-UI/spec/DESIGN-SYSTEM.md` | `docs/design-system/requirements-baseline.md`(転記表) |
| token値・全display export・CSS projection policy・content-addressed由来のintegrity境界 | `docs/design-system/token-approval.json` | `scripts/check-design-tokens.mjs`(機械的一致の検査。人間承認とは別) |
| 採用した設計判断 | `docs/design-system/architecture-decision.md` | `docs/design-system/design-review.md` |

値を変える手順は次の4つだけ。styles.css の生成ブロックを手で直すと `pnpm lint` が落ちる。

1. 唯一の値正本 `packages/core/src/design-tokens.ts` を直す(DESIGN-SYSTEM.md と `requirements-baseline.md` は判断理由だけを追記し、値の第二正本にしない)
2. `node scripts/check-design-tokens.mjs --write` で styles.css の生成ブロックを書き直す
3. 表示に影響する値は出典と差分をレビューし、`token-approval.json` の `boundaryVersion`・integrity digest・content-addressed provenanceを同時に更新する。`approval_subject_digest` は機械的な承認対象IDであり、人間承認そのものではない。`humanApproval` は `pending-external` のまま保ち、リポジトリ内の自己記入で承認済みへ変えない
4. `pnpm lint` と `pnpm --filter @kanjo/web test` を通す。これらが証明するのは不変条件・integrity境界・コントラスト・consumerとの**機械的整合**だけで、リリースにはその `approval_subject_digest` を対象とする**外部の人間による承認**が別途必要

## 色の役割

色は値ではなく**役割**で選ぶ。CSS では `var(--kebab-case)`、TypeScript では `COLOR.camelCase` を使い、`packages/web/src` に6桁 hex を直書きしない(`scripts/check-design-tokens.mjs` が 0 件を検査する)。

### 塗りと文字を分ける

同じ色相でも、面を塗る色と文字に使う色は別のトークンにする。塗り用の色は背景に対して文字のコントラストが足りないことがあるため。

| 役割 | 塗り(面・系列) | 文字 | 淡い面 |
|---|---|---|---|
| 注意 | `--warn-fill`(`#b97000`、背景に 3.66:1 で文字には使えない) | `--warn` | `--warn-soft` |
| 危険 | `--danger` | `--danger` | `--danger-soft` |
| 成功 | `--good` | `--good` | `--good-soft` |
| 事業 | `--biz` / `--accent` | `--biz-strong`(淡い面の上) | `--biz-soft` |
| 家計 | `--per` | `--per` | `--per-soft` |
| 主色 | `--primary` | 塗りの上は `--on-primary` | — |

基準(`design-tokens-contrast.test.ts` が検査する。母数は正本の `CONTRAST_ROLES`):

- 文字用トークンは背景 `--bg` と面 `--surface` の双方に **4.5:1 以上**
- 同じ規則で `background` と `color` を両方トークン指定した組は **4.5:1 以上**
- 新しい文字色を足したら `CONTRAST_ROLES.text` にも足す

### 装飾罫線と部品の枠を分ける

| 用途 | トークン | 基準 |
|---|---|---|
| 表の区切り・カードの縁など、見分けなくても操作できる線 | `--line`、`--line-strong` | WCAG 1.4.11 の対象外 |
| 入力欄・選択欄・チェックボックスの枠 | `--control-border`、hover は `--control-border-hover` | 背景・面に **3:1 以上** |

入力部品の `border` に `var(--line)` を使うとテストが落ちる。

### 高コントラスト設定

`@media (prefers-contrast: more)` の上書きも正本の `HIGH_CONTRAST_COLOR` から生成する。事業色の上書きは通常時と同じ色相(差 10° 以内)に保つ(`docs/design-system/refactoring.md` §2.1)。

## タイポグラフィ

| 項目 | トークン | 値 |
|---|---|---|
| 本文・見出しの書体 | `--font-head` / `TYPOGRAPHY.fontHead` | OS の日本語 UI 書体(外部Webフォントは読み込まない) |
| 金額・数値 | `--font-mono` | 自己配信の IBM Plex Mono Latin 400/600(右寄せ・桁区切り・等幅数字) |
| 文字サイズの段 | `--fs-2xs` 〜 `--fs-3xl` | 12 / 13 / 14 / 15 / 16 / 17 / 19 / 21 / 24px |
| 最小サイズ | `--fs-2xs` | 12px。これより小さい文字はつくらない |
| 本文の行高 | `--line-height-body` | 1.6(`body` が参照) |
| 図の目盛り・凡例 | `TYPOGRAPHY.chartFontSize` | 12px |

`font-size` は段のトークンから選ぶ。段にない大きさが必要なら、先に正本へ段を足す。

IBM Plex Mono は `@fontsource/ibm-plex-mono` をビルドに含める自己配信とし、Latin の 400/600 以外は読み込まない。`font-family: var(--font-mono)` を指定する rule は `font-weight: 400` または `600` も明示し、未配信 weight の合成を求めない。`font-loading-contract.test.ts` は `packages/web/src` の全非 test source、dependencies、外部フォントURLを検査する。

## 余白と寸法

レイアウト値は `PageShell` の用途 variant から適用し、画面ごとに同じ数値を書かない。

| 項目 | トークン | 値 | 適用 |
|---|---|---|---|
| 本文の左右余白 | `--page-gutter` / `--page-gutter-compact` | 32px / 20px | `.main` / 狭幅 |
| 本文の最大幅 | `--content-max-w` / `--content-data-max-w` | 1180px / 1800px | `PageShell` reading / data |
| 角丸 | `--radius` | 8px | 適用済み |
| 押せる領域の最小 | `--tap-target-min` | 44px(WCAG 2.5.5。緩和しない) | 全実操作要素 |
| 右側パネル | `--aside-panel-w` | 320px | 定義のみ |
| ナビのアイコンと文字の間 / グループ間 | `--nav-icon-label-gap` / `--nav-group-gap` | 10px / 14px | 適用済み |
| 浮かせる面の影・背後の幕 | `--shadow-popover` / `--shadow-overlay` / `--scrim` | ink の半透明 | 適用済み |
| 動き | `--motion-instant` / `--motion-fast` / `--motion-base` / `--motion-chart`、`--ease-standard` | 90 / 140 / 200 / 220ms | 適用済み |

`a[href]` / `button` / hidden 以外の `input` / `textarea` / `select` / `summary` は、実要素 taxonomy の共通 CSS 契約から 44px を受け取る。inline link は寸法が有効になる `inline-flex` とする。既存の用途別 `min-height: 44px` は回帰契約の互換性のため残るが、新しく書く CSS は `var(--tap-target-min)` を使う。動きは `prefers-reduced-motion: reduce` でほぼ 0 になることを `check:mobile-layout` が確かめる。

## シェル

認証後のすべての画面(19ルート)は `packages/web/src/components/Layout.tsx` の共通シェルの下に置く。ログイン画面だけは認証前の単一カラムで、サイドバー・ヘッダー・フッターを持たない(PR #48)。画面側でサイドバーやヘッダーを自作しない。

| 部位 | クラス | 寸法トークン |
|---|---|---|
| サイドバー(PC) | `.sidebar` | `--sidebar-w` 220px |
| アイコンレール(タブレット) | — | `--icon-rail-w` 68px(定義のみ) |
| ドロワー(狭幅) | — | `--drawer-w` 240px |
| ヘッダー(ロゴ・現在地・全体期間・データ状態・共通操作) | `.header` | `--header-h` 64px |
| 本文 | 共通 `PageShell` / `main.main#main-content` | reading=`--content-max-w`、data=`--content-data-max-w`、`--page-gutter` |
| 下部タブ(スマホ) | `.tabbar` | `--tabbar-h` 56px |
| フッター(信頼とデータの確認先) | `.footer` | — |

新しいルートは `APP_ROUTES` に `contentWidth` を指定する。DOMテストの母数は `APP_ROUTES` / `ANALYSIS_TABS` から導出される。狭幅の崩れは `pnpm --filter @kanjo/web run check:mobile-layout` で確かめる。

## ボタン

新しい画面では `<button className="...">` を手書きせず、`packages/web/src/components/Button.tsx` の `Button` を使う。

| variant | 用途 | 付くクラス |
|---|---|---|
| `primary`(主) | その画面で一番大事な操作。1つの領域に1つ | `btn primary` |
| `secondary`(副、既定) | それ以外の操作 | `btn` |
| `danger`(危険) | 削除など取り消せない操作。確認ダイアログと組み合わせる | `btn danger-btn` |
| `text`(テキスト) | 行を開くなど、ページ遷移しない「リンクに見える操作」。遷移するなら `<Link>` を使う | `btn linklike` |

```tsx
import { Button } from '../components/Button.js';

<Button variant="primary" onClick={save}>保存する</Button>
<Button size="mini" onClick={openRow}>内訳</Button>
```

- `type` の既定は `"button"`。フォーム送信だけ `type="submit"` を明示する
- `size="mini"` は表の行内など密に並ぶ場所だけ。文字と余白は小さくても、押せる高さは `--tap-target-min`(44px)を保つ
- 標準操作は固有 `className` が必要な場合も共通 `Button` を通す。クラスや `type="submit"` を理由に native `<button>` へ逃がさない
- native `<button>` は下の ARIA 固有 control だけ。`data-native-control` を必ず付け、値は `Button.tsx` の閉じた taxonomy から選ぶ。DOM 契約テストが未標識・未知値・ARIA状態の欠落を拒否する

| `data-native-control` | 必要な意味 |
|---|---|
| `disclosure` | `aria-expanded` |
| `menu-trigger` | `aria-expanded` + `aria-haspopup="menu"` |
| `tab` | `role="tab"` + `aria-selected` |
| `toggle` | `aria-pressed` |
| `sort` | 列見出しの `aria-sort` と一体の `.th-sort` |

## チャート

図は Chart.js 4 を `packages/web/src/components/charts.ts` 経由で使う。色・文字を図ごとに書かない。

| 使うもの | 中身 |
|---|---|
| `COLORS` | CSS 変数を読んだ色(読めない環境では正本 `COLOR` の値)。`COLORS.net` はティール線 |
| `vendorPalette()` | 積み上げ系列の色。テーマ色で足りない分は正本 `VENDOR_EXTRA_COLORS` |
| `import` するだけで効く既定 | `Chart.defaults` の書体(`TYPOGRAPHY.fontHead`、12px)・文字色(`inkSoft`)・線色(`line`) |
| `baseChartOptions()` | 全図共通の骨格(responsive、高さは CSS が決めるので `maintainAspectRatio: false`) |
| `chartAnimation()` | 動きを減らす設定の利用者には出さない。図ごとに `animation: false` と書かない |
| `chartSeriesColor()` / `chartDecorativeFill()` | 判別用の不透明系列 / 数値や輪郭を別に持つ装飾面。consumerでalpha suffixを連結しない |
| `yenTick` / `stackedTotals` / `stackTotalLabels` | 円の目盛り、積み上げの合計ラベル |

系列の意味と色は固定する(収入・支出・純収支の色相は `design-tokens-contrast.test.ts` が検査する)。

| 系列 | トークン | 色相 |
|---|---|---|
| 収入 | `income` | 青系 |
| 支出 | `expense` | 赤系 |
| 純収支 | `accent` | ティールの線 |
| その他・中立 | `neutral` | 灰 |

- 系列色は背景・面に **3:1 以上**。新しい系列色は `CONTRAST_ROLES.chartSeries` に足す
- 収入・支出・純収支の系列に `${COLORS.income}d9` のような透明度を連結しない。背景と混ざって 3:1 を割る(`chart-series-contract.test.ts` が合成後の色で検査する)。他の系列(`neutral`・`good` など)に残る透明度は既存の表現で、この検査の対象外
- 注意系列は塗りなので `warnFill` を使う(文字用の `warn` ではない)
- 財務図の高さは `--financial-chart-height`(300px)。表示幅ごとの崩れは `check:financial-figure` と `check:financial-routes` で確かめる
- 積み上げの系列が多い図は、core 側で**上位 N + 「その他」**に畳んでから渡す。サブスクの推移(`pages/subscriptions/CategoryTrendChart.tsx`)は上位 3 カテゴリ + その他の最大 4 系列で、その他は `neutral`、残りは `chartSeriesColor(...)` の既定順。色は consumer で関数に包まず `chartSeriesColor(role)` を直接呼ぶ(`scripts/ui-contract-ast.mjs` の出どころ検査は直接呼出しだけを認める)。図の代替となる表と凡例は同じ系列配列から作る
- 表は並べ替えられるもの(`data-table-kind="sortable"` + `SortableTableHeader`)か、並びを固定する理由を持つもの(`layout`・`matrix`・`hierarchy`・`comparison`・`workflow` のどれかと、10 文字以上の `data-sort-reason`)のどちらか。サブスクの年換算比較は `comparison`(月額の降順 + 合計行を末尾に固定)、詳細パネルの直近取引は `layout`(新しい日付順に固定)

## 検査の一覧

| 検査 | 何を落とすか |
|---|---|
| `pnpm lint`(`check-design-tokens`) | token値・CSS adapter・tracked provenance内容のintegrity、生成ブロックと正本のずれ、`packages/web/src` の色直書き |
| `scripts/check-design-system-document-contract.mjs` | FR-005の6つのH2節、README/AGENTS両方の正規導線、未決/確定の意思決定矛盾、`humanApproval=pending-external` 境界 |
| `packages/core/test/design-tokens.test.ts` | pure registry・schema・意味ロール・alias・reading/data幅・44px操作領域。repo横断checkerはroot integration testが担う |
| `packages/web/src/font-loading-contract.test.ts` | 全非 test source・dependencies・外部URL、許可されたfont-size scale、IBM Plex Mono Latin 400/600だけの自己配信契約 |
| `packages/web/src/design-tokens-contrast.test.ts` | コントラスト不足、入力部品の枠の `--line` 参照、系列の色相違い |
| `packages/web/src/chart-series-contract.test.ts` | ASTで全chart consumerのcolor propertyを意味分類し、生色・decorative輪郭・theme追随漏れを拒否 |
| `packages/web/src/common-shell-routes.dom.test.tsx` | route registry由来のシェル/PageShell欠落と、ASTで検出したinput submit・role button・ARIA例外marker偽装 |
| `packages/web/src/components/Button.dom.test.tsx` | variant とクラスの対応 |
| `check:thead` / `check:mobile-layout` / `check:financial-figure` / `check:financial-routes` | 実ブラウザでの表・狭幅・図の崩れ |

対象外: 各画面の中身を FINAL-UI の画像どおりに作り直すこと、ダークテーマ、Web フォントの追加、`skills/report-design-system/assets/report.css` と `packages/core/src/report-css.ts` の配色。

## 配信計画の再生成と検証

通常経路の唯一の正本は `.dev-graph/plans/feature-package-feat-design-system-foundation/task-graph.json`。まず `pnpm delivery:regenerate:dry-run` で変更予定を確認し、明示的に `pnpm delivery:regenerate:apply` を実行する。通常producerはtracked projectionだけを書き、ignoredな`.dev-graph/state`や外部Beads/GitHubを変更しない。

共有ゲートは `pnpm delivery:check`、ローカルgraph・外部tracker・過去receiptとのparityは `pnpm delivery:check:maintainer`。後者のstale/pendingは共有PASSに混ぜない。plugin validatorは `pnpm delivery:validate:system-plan` が設定・CLI・環境から解決し、版とscriptをpreflightする。

inventoryからtask-graphへ戻す逆輸入は災害復旧専用で、通常再生成から隔離している。`pnpm delivery:recover:dry-run` の結果を確認し、実行時はscriptへ `--apply --acknowledge-disaster-recovery --receipt <repository-relative-path>` を明示する。
