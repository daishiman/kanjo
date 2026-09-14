# トークン設計の独立レビュー(SYS-DSFOUND-P03)

- 対象 feature: `feat-design-system-foundation`
- レビュー対象: `docs/design-system/requirements-baseline.md`(P01)、`docs/design-system/architecture-decision.md`(P02)
- 突合先: `specs/spec-design-system-foundation.md`、`design/FINAL-UI/spec/DESIGN-SYSTEM.md`、`architecture/design-system-{frontend,backend,ui-ux,maintenance-ops}.md`、現行の `packages/web/src/styles.css` / `packages/web/src/components/charts.ts`
- レビュー方法: 起草した context とは別の独立 context(サブエージェント)が読み取り専用で実施した。コントラスト値は node で WCAG 2.2 の相対輝度式から検算した。
- 実施日: 2026-09-13

## 1. 観点別の判定

| # | 観点 | 判定 | 要旨 |
|---|---|---|---|
| 1 | FR の検証可能性 | 指摘 | FR-003 の「主操作ボタン」、FR-004 の「文字用トークン」の母数が未定。FR-005 は目視のみ |
| 2 | DESIGN-SYSTEM.md 転記 | 合格(一部指摘) | 10色・寸法は一致。`--fs-2xs: 11px` が「最小 12px」に反するのに差分表にない |
| 3 | コントラスト値 | 合格(根拠2点に誤り) | 18色の比は記載どおり。`#7f9095` を「同色相」とした説明と、`color-mix` の余裕の主張が誤り |
| 4 | 依存方向 | 合格(表記に指摘) | import の向き(web→core)と値の流れ(core→web)の混同。`.ts` 正本を node から読む手段が未記載 |
| 5 | 互換性 | 指摘 | 維持する変数名を「ほか」で省略。`COLORS.biz` 予備値の色相変化、`vendorPalette` の warn の役割が未定 |
| 6 | 20ルート | 合格 | 13 + 5 + `/improvement` + ログインで20。`Layout locked` は読込中にも使われるので、ログインの数え方を明記する |
| 7 | 見落としリスク | 指摘 | `prefers-contrast` 内の hex、`:root` 外の hex 52行、canvas 描画の直書き2件、ボタン枠の分類 |

## 2. 指摘と是正

「是正先」が文書のものは本レビュー内で反映済み。実装に関わるものは P05 / P08 で是正し、その結果を §3 に記録する。

| id | severity | 指摘 | 是正内容 | 是正先 | 状態 |
|---|---|---|---|---|---|
| R-01 | high | `.tcf-line.tcf-differs`(styles.css:4942)は `--warn` を 14% 混ぜた地色の上に `--warn` の文字を置き、面上 4.39:1 で 4.5 を割る | 地色を役割トークン `--warn-soft`(`#fdf9ef`)に替える。`#9a5d00` との比は 5.07:1 | styles.css(P05) | 是正済み(§3) |
| R-02 | high | `.status-fact.warn`(627)と 982 行の枠は `--warn` を `--line` へ混ぜた色で、面上 2.49:1 | 枠を `--warn-fill`(3.90:1)にし、`color-mix` をやめる。ADR の「余裕を残す」根拠を削除 | styles.css(P05)、architecture-decision.md | 是正済み(§3) |
| R-03 | high | `prefers-contrast: more` と `:root` 外の hex(52行)が S1 の母数から漏れる | 高コントラスト上書きも正本から生成してマーカー内に置く。`:root` 外の hex はすべて役割トークンの `var()` に置き換え、`check-design-tokens.mjs` が `packages/web/src` 全体(テスト以外)を検査する | design-tokens.ts / styles.css / check-design-tokens.mjs(P05) | 是正済み(§3) |
| R-04 | medium | FR-003「主操作ボタン」の母数が未定 | 「`className` に `primary` を含む要素」を主操作ボタンと定義し、全件が共通ボタンのクラス `btn` を併せ持つことを検査する(ルートごとの目視選定に依存しない) | requirements-baseline.md §3、common-shell-routes.dom.test.tsx(P04) | 是正済み |
| R-05 | medium | FR-004「文字用トークン」の範囲が未定 | 正本 `CONTRAST_ROLES.text` に列挙し、テストはその一覧を母数にする。一覧は requirements-baseline.md §3.1 に転記 | requirements-baseline.md、design-tokens.ts | 是正済み |
| R-06 | medium | canvas 描画(annotate-image.ts:22、capture-screen.ts:182)の直書き | 正本の `COLOR.annotateStroke` / `COLOR.surface` を import する。P05 の write scope 外のファイルだが S1 の充足に必要なため変更し、完了報告に明記する | annotate-image.ts / capture-screen.ts(P05) | 是正済み(§3) |
| R-07 | medium | ボタンの枠 `--line` を装飾に分類してよいか | ボタンは文字ラベルと地色の差で識別でき、枠は識別に必須の視覚情報ではない(WCAG 2.2 Understanding 1.4.11「文字を持つボタンの境界は必須でない」)。装飾に分類したまま、入力欄・選択欄・チェックボックスの枠だけを `--control-border` にする | architecture-decision.md | 是正済み |
| R-08 | medium | `--fs-2xs: 11px` が最小 12px に反する | 正本の `TYPOGRAPHY.minFontSize = 12` に合わせ `--fs-2xs` を 12px にする。check 系4本で崩れがないことを確認する | design-tokens.ts / styles.css(P05) | 是正済み(§3) |
| R-09 | medium | `.ts` の正本を node スクリプトから読む手段が未記載 | Node 22.18 以降の型除去(既定有効)で読むため、design-tokens.ts は import を持たない単独ファイルにする。CI は setup-node の `22`(最新 22.x) | architecture-decision.md | 是正済み |
| R-10 | low | `#7f9095` を「同色相の最初の値」とした説明が不正確(実測 193.6° / 彩度 0.094、元は 190.9° / 0.159) | 「`#d7e0e2` と同系統の青緑灰で、背景に 3:1 を超える値」と改め、値は維持する | architecture-decision.md | 是正済み |
| R-11 | low | 依存方向の矢印表記の混同 | 「import は web→core、値は core→web」と両方を明記 | architecture-decision.md | 是正済み |
| R-12 | low | 互換性で維持する変数名を「ほか」で省略 | 既存変数名の全件をテストに固定し、1件でも消えると落とす(core の design-tokens.test.ts) | design-tokens.test.ts(P04) | 是正済み |
| R-13 | low | `COLORS.biz` の予備値が青からティールに変わる、`vendorPalette` の warn の役割が未定 | 予備値は CSS 変数が読めない環境だけで使われ、ブラウザでは既に `--biz: #087f78` が効いているため見た目は変わらない。`vendorPalette` の注意系列は塗りなので `warnFill` を使う | architecture-decision.md / charts.ts(P05) | 是正済み(§3) |
| R-14 | low | FR-005 が目視確認だけ | 節見出しと README / AGENTS.md からの参照を grep で確認し、P12 の証跡に残す | P12 | 是正済み(§3) |
| R-15 | low | ログインの数え方 | 未認証時に `LoginPage` を `Layout locked` で描画した状態を1ルートと数える(読込中の表示は数えない)。2026-09-14 改訂: PR #48 でログインはシェルの外になり、シェルの母数は認証後19ルート、ログインは「シェルを持たない」反例として検査する | requirements-baseline.md §4 | 是正済み(#48 で改訂) |

### 起草側が追加で見つけた指摘

| id | severity | 指摘 | 是正内容 | 状態 |
|---|---|---|---|---|
| R-16 | medium | `.pill.biz` はティール文字 `#087f78` を `--biz-soft` `#edf7f6` の上に置き 4.46:1 | 文字を `--biz-strong`(6.89:1)にする | 是正済み(§3) |

## 3. 実装での是正確認

P05 / P08 の実装後に次を確認した。実測値と検証コマンドの出力は `docs/design-system/test-run.md` と `docs/design-system/acceptance.md` に残す。

| id | 確認方法 | 結果 |
|---|---|---|
| R-01, R-02, R-16 | `grep -n "color-mix" packages/web/src/styles.css` が 0 件。`design-tokens-contrast.test.ts` の淡い塗り組み合わせ検査が緑 | 0 件 / 緑 |
| R-03 | `node scripts/check-design-tokens.mjs` が exit 0、`packages/web/src` の hex 直書き 0 件 | exit 0 / 0 件 |
| R-06 | 同上(`.ts` の引用符付き hex 0 件)、`annotate-image.dom.test.ts` 緑 | 0 件 / 緑 |
| R-08 | `check:thead` / `check:mobile-layout` / `check:financial-figure` / `check:financial-routes` 緑 | 緑 |
| R-13 | `charts.ts` の hex 直書き 0 件、`vendorPalette` が `warnFill` を参照 | 0 件 |
| R-14 | P12 で `grep` による節見出し・参照の確認 | `docs/design-system/evidence.md` に記録 |

## 4. 結論

指摘 16 件(high 3 / medium 7 / low 6)。§2 と §3 のとおり是正未了の指摘は 0 件。P04 の失敗テストは R-04 / R-05 / R-12 の母数定義に基づいて作成する。
