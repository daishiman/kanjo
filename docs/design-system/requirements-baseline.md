# 要件ベースライン(SYS-DSFOUND-P01)

- 対象 feature: `feat-design-system-foundation`
- 入力: `specs/spec-design-system-foundation.md`、`design/FINAL-UI/spec/DESIGN-SYSTEM.md`、`architecture/design-system-*.md`(8件)
- 用途: P02 以降が「何を満たせば完了か」を参照する基準表。承認値の実装正本は `packages/core/src/design-tokens.ts` の1か所で、本表と DESIGN-SYSTEM.md は由来・意図を説明する参照資料とする。

## 1. DESIGN-SYSTEM.md 規定値の転記表

DESIGN-SYSTEM.md「3. 視覚ルール」「2. 共通シェル」「5. レスポンシブ」から、FR-001 の判定対象を転記した。hex は比較のため小文字6桁に正規化する(原文は大文字)。

### 1.1 色(10色)

| # | 役割(原文) | 原文の値 | 正規化 | トークン名(予定) | CSS 変数 |
|---|---|---|---|---|---|
| 1 | 背景 | `#F6F8F9` | `#f6f8f9` | `color.bg` | `--bg` |
| 2 | 面 | `#FFFFFF` | `#ffffff` | `color.surface` | `--surface` |
| 3 | 境界(装飾罫線) | `#D7E0E2` | `#d7e0e2` | `color.line` | `--line` |
| 4 | 文字 | `#15262B` | `#15262b` | `color.ink` | `--ink` |
| 5 | 補助 | `#617177` | `#617177` | `color.inkSoft` | `--ink-soft` |
| 6 | 主色 ネイビー | `#14353D` | `#14353d` | `color.primary` | `--primary` |
| 7 | 主色 ティール | `#087F78` | `#087f78` | `color.accent` | `--accent` |
| 8 | 注意 アンバー | `#B97000` | `#b97000` | `color.warnFill` | `--warn-fill` |
| 9 | 危険 | `#B33A3A` | `#b33a3a` | `color.danger` | `--danger` |
| 10 | 成功 | `#247A52` | `#247a52` | `color.good` | `--good` |

### 1.2 寸法

| 項目 | 原文 | 値 | トークン名(予定) |
|---|---|---|---|
| サイドバー幅 | 固定サイドバー 220px | 220 | `size.sidebarWidth` |
| ヘッダー高 | 固定ヘッダー 64px | 64 | `size.headerHeight` |
| 標準本文最大幅 | 最大幅 1180px | 1180 | `size.contentReadingMaxWidth` |
| 横長データ本文最大幅 | 既存データ画面の表示域 | 1800 | `size.contentDataMaxWidth` |
| 角丸 | 角丸 8px | 8 | `radius.base` |
| 操作対象 | 44px以上 | 44 | `size.tapTargetMin` |
| 本文余白 | 32px余白 | 32 | `space.pageGutter` |
| 右側パネル | 右側 320px | 320 | `size.asidePanelWidth` |
| タブレットのアイコンレール | 68px | 68 | `size.iconRailWidth` |

### 1.3 文字

| 項目 | 原文 | 値 |
|---|---|---|
| 本文サイズ | 14〜16px | 14〜16px |
| 最小サイズ | 最小 12px | 12px |
| 行高 | 行高 1.6 | 1.6 |
| 金額 | 右寄せ・桁区切り・等幅数字 | 既存の IBM Plex Mono Latin 400/600を自己配信(新規の外部フォント/CDN追加なし) |

## 2. 現行実装との差分(移行で変わる値)

`packages/web/src/styles.css` の `:root`(2026-09-13 時点)と比べ、正本の値へ寄せる対象。

| CSS 変数 | 現行 | 正本 | 備考 |
|---|---|---|---|
| `--danger` | `#b23a3a` | `#b33a3a` | DESIGN-SYSTEM.md へ一致させる |
| `--good` | `#2e7d5b` | `#247a52` | 同上 |
| `--warn` | `#805a12` | 文字用の派生色 | 塗り用 `#b97000` と文字用を分離する(BR-002) |
| (新設)部品の枠 | `--line` を流用 | 3:1 以上の派生色 | 入力欄の枠が装飾罫線を参照しない(BR-003) |
| charts.ts 予備値 | `biz #2f5da8` など旧値 | 正本由来 | CSS 変数と予備値が別の色になっている(FR-002) |
| `--fs-2xs` | `11px` | `12px` | DESIGN-SYSTEM.md「最小 12px」へ一致させる(design-review R-08) |
| `:root` 外の hex | 52行(`prefers-contrast` 内を含む) | 役割トークンの `var()` | S1 の母数。高コントラスト上書きも生成物にする(design-review R-03) |

## 3. 機能要件と成功状態の対応表

| FR | 判定基準(要約) | 対応する S | 検証手段(予定) | 担当 phase |
|---|---|---|---|---|
| FR-001 | 正本の10色・寸法が schema と関係不変条件を満たし、consumer が同じ正本を参照する | S3 | `packages/core/test/design-tokens.test.ts`、`scripts/check-design-tokens.mjs` | P04(red)→P05 |
| FR-002 | `:root` と charts.ts 予備値が正本の写し。ずれで `pnpm lint` が非0。charts.ts の hex 直書き0件 | S1, S2 | `scripts/check-design-tokens.mjs`(lint 組込み) | P04→P05→P08 |
| FR-003 | route registry 由来の認証後19ルートすべてが `PageShell` と共通シェルを通り、ログインはシェルの外に置く(PR #48)。標準の主・副・危険・submit操作は共通 `Button` を使う | S5 | `packages/web/src/common-shell-routes.dom.test.tsx`、`components/Button.dom.test.tsx` | P04→P05 |
| FR-004 | 文字用(§3.1 の一覧)は背景・面に 4.5:1 以上、部品の枠と系列色は 3:1 以上。装飾罫線は対象外で、入力欄の枠が参照しない | S4 | `packages/web/src/design-tokens-contrast.test.ts` | P04→P05 |
| FR-005 | 規約文書が色の役割・タイポグラフィ・余白と寸法・シェル・ボタン・チャートの6つのH2節を各1つ持ち、README と AGENTS.md の双方から正規相対リンクで参照 | — | `scripts/check-design-system-document-contract.mjs`(見出し・導線・意思決定状態・外部承認境界を検査) | P12 |
| (横断) | 既存 test / typecheck / lint / check 系4本が緑 | S6 | `pnpm test` ほか | P06, P07 |

### 3.1 FR-004 の母数(正本 `CONTRAST_ROLES`)

| 役割 | トークン | 基準 |
|---|---|---|
| 文字 `text` | `ink` `inkSoft` `primary` `accent` `biz` `bizStrong` `per` `warn` `danger` `good` | 背景・面の双方に 4.5:1 |
| 部品の枠 `controlBorder` | `controlBorder` `controlBorderHover` | 3:1 |
| チャート系列 `chartSeries` | `income` `expense` `accent` `neutral` `per` `warnFill` `good` と追加パレット5色 | 3:1 |
| 装飾罫線 `decorativeLine` | `line` `lineStrong` | 対象外(部品の枠に使われていないことだけを検査) |

一覧は `packages/core/src/design-tokens.ts` が正本で、テストはその一覧を母数にする。役割を持たない塗り(`bizSoft` や行の地色など)は文字色ではないため検査しない。

### 3.2 FR-003 の共通 Button 境界

標準の主・副・危険・フォーム送信操作は `Button` の variant を使う。menu/tab/sort/toggle/category picker など、ARIA の role・expanded・pressed・selected と一体の低レベル control は native `<button>` を明示例外とする。個数を無差別に包まず、標準 variant のクラスや submit を native button が直接所有していないことを検査する。

## 4. 20ルートの内訳(S5 の母数)

> 改訂 (2026-09-14): PR #48 (2026-09-14) でログイン画面は共通シェルの外の単一カラムへ変わったため、共通シェルの母数は認証後の19ルートとし、ログインは「シェルを持たない」ことを反例として検査する。下表の20は FINAL-UI の画面数としては有効で、共通シェルの母数はログインを除く19。

| 区分 | 件数 | パス |
|---|---|---|
| 主ルート | 13 | `/`、`/import`、`/cash`、`/classify`、`/subscriptions`、`/household`、`/analysis`、`/statements`、`/ai`、`/budget`、`/tradeoff`、`/settings`、`/guide` |
| 支出分析タブ | 5 | `/analysis/reconciliation`、`/analysis/total-cashflow`、`/analysis/matrix`、`/analysis/trends`、`/analysis/diagnosis` |
| その他 | 2 | `/improvement`、ログイン(未認証時の `LoginPage`。PR #48 以降は共通シェルの外の単一カラムで描画し、シェルの母数には含めない) |
| 合計 | 20 | `design/FINAL-UI/manifest.json` の pageCount 20 と一致 |

## 5. 対象外(本ベースラインで判定しない)

- 各画面の中身を FINAL-UI の画像どおりに作り直すこと(次サイクル)
- ダークテーマ、新規の外部フォント/CDN追加、API・データベースの変更
- `skills/report-design-system/assets/report.css` と `packages/core/src/report-css.ts` の配色移行

## 6. 突合結果

DESIGN-SYSTEM.md §3 の色8行(10色)と §2・§3 の寸法5項目(220 / 64 / 1180 / 8 / 44)を初期取り込み時に突き合わせた。以後の値変更は `design-tokens.ts` を唯一の編集点とし、テストは値の複製ではなく schema・関係不変条件・consumerとの一致を検査する。
