# 決算書画面 — 検証証跡

この文書は `/statements` の**実行結果と未達ゲート**だけを記録する。要件は
`system-spec/00-requirements-definition.md`、実装境界は [`../statements-screen.md`](../statements-screen.md)、
画像との差の許可リストは [`../ui-decisions.md`](../ui-decisions.md) を正とする。

`tasks/feat-statements-screen/`、`.dev-graph/requirements/**/feat-statements-screen/` と計画 task ノードは
2026-09-19 の promotion digest に固定された計画投影である。
旧 migration 番号や旧 API 契約が残っていても、現行判定の根拠には使わない。現行 feature 境界は
`features/feat-statements-screen*` に再投影済みである。

## 1. 現在の判定

| ゲート | 判定 | 根拠 / 次の確認 |
|---|---|---|
| 機能・構造 | PASS | 現 refactor の対象 58 tests と実ブラウザ検査を再実行 |
| 数値の単一計算 | PASS | core 全テストと、GET の top-level key が `{ screen }` だけである API 統合テストを現行ワークツリーで再実行 |
| migration | PASS | 実体は `migrations/0046_liability_status.sql`。`0045_owner_labels.sql` と衝突しない |
| 画像内容・システム整合 | **PASS** | 原子要素を網羅し、共通シェル優先の意図差を確定。834px reference と全 responsive 幅を再検証 |
| `verify:full` | **未達** | 4175 番ポートの競合だけで exit 0 に至らない。競合しない 4176 では financial routes が PASS |

S1 は機能・構造、画像内容、システム整合を通して達成とする。literal pixel 一致は意図差のため対象外。
S5 は `verify:full` を実際に通したときだけ達成とする。

## 2. 2026-09-20 の現行実行記録

| コマンド | exit | 記録結果 |
|---|---:|---|
| `pnpm --filter @kanjo/core test -- test/statements-screen-contract.test.ts test/balances-contract.test.ts` | 0 | core 全体 893 passed / 6 skipped |
| `pnpm exec vitest run src/statements-screen.integration.test.ts src/balances-lifecycle.test.ts` (`packages/api`) | 0 | 対象 2 files、35 passed |
| system-spec 網羅性・出典検証、dev-graph schema / lineage、`pnpm run security:content` | 0 | 不整合・孤児・実データ参照 0 |
| `pnpm lint` | 0 | Biome 545 files、graph lineage、design token / document contract、security content がすべて PASS |
| `pnpm verify:full` | 1 | `check:financial-routes` の 4175 番ポート競合だけで停止。ほかの段階は個別に PASS |
| `check:financial-routes`（競合しない 4176 番ポート） | 0 | financial routes 自体も PASS。`verify:full` 自体の exit 0 を示すものではない |
| `check:analysis-hub`（4176 番ポート） | 0 | 11 条件・選択・遷移・履歴が PASS |
| `pnpm run preview:smoke` | 0 | 45 migrations、SPA、auth、現金記帳の作成 / 一覧 / 削除 / 空一覧、廃止 API 404 が PASS |
| web 対象 DOM / 表示契約 | 0 | 3 files、53 passed。月次 PL の千円→円→万円変換を含む |

実画面の再受入と、4175 の競合を解消した `verify:full` の exit 0 は別ゲートとして未達のままである。

## 3. 2026-09-20 の過去実行記録

以下は今回の refactor より前のスナップショットであり、現在のコードへの合格判定として流用しない。

| コマンド | exit | 記録結果 |
|---|---:|---|
| `pnpm test` (core) | 0 | 897 passed / 6 skipped |
| `pnpm test` (api) | 0 | 704 passed |
| `pnpm test` (web) | 0 | 818 passed |
| `pnpm typecheck` | 0 | core・api・web が完了 |
| `pnpm lint` | 0 | biome、graph-lineage、design-token、security content を含む |
| `pnpm --filter @kanjo/web build:bundle` と `check:js-budget` | 0 | 103.64 KiB / 110 KiB |
| `validate-system-plan.py --staging .dev-graph/plans/feature-package-feat-statements-screen` | 0 | 13 task、violations 0、digest `sha256:b7b5463d81396f3733f71694ba174d935c886841941c232029b6574add8f6eb1` |
| `pnpm verify:full` | — | 当時は 4175 番ポートの競合により未実行 |
| `pnpm run evidence:check` | 1 | statements ではなく design-system の changed-path-manifest が stale |

## 4. 過去の実画面受入

実画面の操作結果は [`statements/acceptance.json`](statements/acceptance.json)、画像は `statements/*.png` に残す。
16 項目は当時すべて OK だった。

- 見出し、KPI 4 枚、PL / CF / BS の 3 節、期間を表示できた
- ページ内ナビで選択した節へフォーカスを移せた
- PL の行選択、負債の 3 状態、下書き、自動保存、再読込、保存を操作できた
- 負債保存後の KPI・図・下書き消去を確認した
- 基準月の切替と CSV メニューを確認した

この受入は「構造と操作が動く」証跡であり、「基準画像と同じ」ことの証跡ではない。

## 5. 画像参照ゲート

| 項目 | 値 |
|---|---|
| 基準 | `design/FINAL-UI/images/11-statements.png`、834 × 1886 |
| 834px visual reference | `statements/statements-reference-834.png`、834 × 1910、sha256 `d8c8527cf4d68fc158c3e984c8b585e22714ab64c75ecf8be0c171c9e4556ea9`、2026-09-21 17:04 JST 再撮影 |
| 既存代表画像 | `statements/final-1280.png`、1280 × 3506 |
| overlay | `statements/statements-reference-overlay.png`、834 × 1987、2026-09-20 の旧比較。共通シェルの方針確定後に再生成する |
| diff | `statements/statements-reference-diff.png`、834 × 1987、2026-09-20 の旧比較。今回の原子要素判定には流用しない |
| 現在ある検査 | DOM 構造、チャート / 表、横はみ出し、重なり、操作、原子要素の実描画。overlay / diff は上記の旧比較 |
| 差分の分類 | 下表で動的値 / 意図的差 / 修正済みに分類 |
| 判定 | **PASS（内容網羅・システム整合）** / literal pixel 一致は非対象 |

比較時に除外できるのは、動的な金額・日付・グラフ値と、`ui-decisions.md` の決算書画面に列挙した 8 件だけ。
一律の差分率は設けず、内容と配置は原子要素・DOM・実描画の検査で判定する。

| 差分 | 分類 | 現在の判断 |
|---|---|---|
| 金額、日付、グラフ値 | 動的値 / 意図的差 | core の整合する値を正本にする。画像の誤った「万円」表記は再現しない |
| PL 表と推移図の左列 + 詳細の右列 | 修正済み | 詳細を 2 段スパンさせ、参照と同じ情報構造にした |
| 推移図の内部検算表 / 行動文 | 修正済み | 直下の月次 PL 表と重複するため、`companion-table` 契約で一本化した |
| サイドバー幅とヘッダー段数 | 意図的なシステム差 | 現行共通シェルを優先し、1 画面だけ上書きしないことを 2026-09-21 に確定 |
| 負債入力の任意「その他の負債」 | 意図的な仕様差 | 現行仕様は 4 行、画像は必須 3 行。任意入力を削除しないことを確定 |
| 全体高 1910px / 基準 1886px | 上記からの派生差 | 24px 差。フォーム操作の可視余白と任意負債行を含み、重なりは 0 |

共通シェル優先を確定後に再撮影し、PL 5列の同時表示、フォーム操作と固定バーの非重複も実ブラウザで固定した。

## 6. 再検証チェックリスト

- core の恒等式、前期比、未知科目、CF 不能、負債 3 状態
- GET が `{ screen }` だけを返し、web が `screen` 以外を参照しない
- PUT の部分保存、unset / zero、400 / 401 / 409 / 413、金額を残さない監査
- 画面構造、URL、アクセシビリティ、下書き、保存中 / 失敗、CSV
- 834px の画像忠実度ゲート
- `pnpm verify:full`

過去結果と今回の再実行結果は同じ表に混ぜず、実行日時と対象 commit を添えて追記する。

## 7. 参照画像の原子要素カバレッジ（2026-09-21 再監査）

使われる場面は「事業者が PC で 1 年分の損益・現金・負債のつながりを上から確認し、不足する負債残高をその場で入力・保存する」である。
そのため、読む節は KPI → PL → CF → BS の順、照合は表、時間変化は図、入力は BS のフォームに閉じる現行形式を採用する。画像の 3 ナビを排他タブへ戻す案は、3 節を通して整合性を確認する目的に反するため却下した。

「実装」は表示の正本、「DOM」は回帰を固定する受入テスト、「実描画」はローカル preview のスクリーンショットを指す。
初回監査時点の実描画は `statements/statements-reference-834.png`、入力中は `statements/input-draft-1280.png`。
修正後の再撮影と動的操作の結果は、下表と本節末尾に追記する。

| ID | 参照画像の原子要素 | 実装証跡 | DOM 証跡 | 実描画証跡 | 再監査判定 |
|---|---|---|---|---|---|
| SH-01 | ロゴ、アプリ名、サイドバーの業務グループと現在地 | `components/Layout.tsx` | `common-shell.dom.test.tsx` / `common-shell-routes.dom.test.tsx` | `statements-reference-834.png` | PASS（共通シェルの形状差は意図差） |
| SH-02 | 月次クローズ進捗 | `components/Layout.tsx` | `common-shell.dom.test.tsx` | `statements-reference-834.png` | PASS（現行は 1/4、画像の値に固定しない） |
| SH-03 | パンくず、税務状態、未記帳・要確認数、最終更新、検索・書き出し・ヘルプ・利用者 | `components/Layout.tsx` | `common-shell.dom.test.tsx` | `statements-reference-834.png` | PASS（共通シェル差は意図差） |
| SH-04 | 1年 / 2年 / 3年 / 任意の期間選択 | `components/Layout.tsx` + `period.tsx` | `period-picker.dom.test.tsx` | `statements-reference-834.png` | PASS |
| SH-05 | フッターの外部送信・税務・バックアップ、規約・出典・版 | `components/Layout.tsx` | `common-shell.dom.test.tsx` | `statements-reference-834.png` | PASS |
| SH-06 | 改善 CTA | `components/Layout.tsx` | `improvement-capture.dom.test.tsx` | `statements-reference-834.png` | PASS |
| PG-01 | 問いの H1 と説明 | `StatementsPage.tsx` | `statements-screen.dom.test.tsx` 「見出しと期間」 | `statements-reference-834.png` | PASS |
| PG-02 | 対象期間と前後移動 | `StatementsPage.tsx:PeriodRange` | `statements-screen.dom.test.tsx` 「問いの見出し…」 | `statements-reference-834.png` | PASS |
| KPI-01 | 4 KPI の名称、説明 `?`、意味の異なる図記号 | `StatementsKpis.tsx` + `HelpTip.tsx` | `statements-screen.dom.test.tsx` 「4つの数字に…」 | `statements-reference-834.png` | PASS |
| KPI-02 | 値、増減、比較種別、出典、対象期間 | `StatementsKpis.tsx` | `statements-screen.dom.test.tsx` KPI 4 ケース | `statements-reference-834.png` | PASS（負債未入力は数値でなく「未入力あり」） |
| NV-01 | PL / CF / BS の 3 項目 | `StatementsPage.tsx:SectionNav` | `statements-screen.dom.test.tsx` 「ページ内ナビ」 | `statements-reference-834.png` | PASS（排他タブではなくページ内 nav） |
| PL-01 | PL 見出し、説明、エクスポートメニュー | `StatementsPl.tsx` | 「参照画像の意味記号」+ CSV | `statements-reference-834.png` | PASS（download 図記号を追加） |
| PL-02 | 当期・前期・差額・構成比の列と5行 | `StatementsPl.tsx:PlTable` | `statements-screen.dom.test.tsx` 行選択 / 内訳 | `statements-reference-834.png` | PASS |
| PL-03 | 区分選択、内訳開閉、計算式の説明 | `StatementsPl.tsx:PlTable` | 行選択 / `HelpTip` DOM | `statements-reference-834.png` | PASS |
| PL-04 | 右側詳細の閉じる操作、値、計算式、主な科目 | `StatementsPl.tsx:DetailPanel` | `statements-screen.dom.test.tsx` 行選択 4 ケース | `statements-reference-834.png` | PASS |
| PL-05 | 詳細の月別推移、出典、関連明細 | `StatementsPl.tsx:DetailPanel` | 「詳細パネルの月別推移…」 | `statements-reference-834.png` | PASS |
| PL-06 | 月別損益推移の見出し、単位、凡例、棒・線図 | `FinancialCharts.tsx:StatementsPlTrendChart` + `statements.css` | 「損益の推移図」+意味記号 DOM | `statements-reference-834.png` | PASS（`(万円)` を図内に明示） |
| PL-07 | 月次 PL の見出し、単位、12か月、5行、合計 | `StatementsPl.tsx:MonthlyTable` | `statements-screen.dom.test.tsx` 「月次PL…」 | `statements-reference-834.png` | PASS（数値は core 正本） |
| CF-01 | CF 見出し | `StatementsCf.tsx` | `statements-screen.dom.test.tsx` ページ内 nav | `statements-reference-834.png` | PASS |
| CF-02 | 集計不能の info 図記号、説明、取引確認 CTA | `StatementsCf.tsx:Unavailable` | 集計不能 + 意味記号 DOM | `statements-reference-834.png` | PASS |
| CF-03 | 主な原因の実データ件数 | `view-model.ts:cfCauseLines` | 「0 でない原因だけ…」 | `statements-reference-834.png` | PASS |
| CF-04 | 3 段階の解決方法 | `StatementsCf.tsx:STEPS` | 集計不能 DOM | `statements-reference-834.png` | PASS |
| BS-01 | BS 見出し | `StatementsBs.tsx` | `statements-balance-sheet.dom.test.tsx` | `statements-reference-834.png` | PASS |
| BS-02 | 未入力 alert 図記号、説明、フォーム開閉 | `StatementsBs.tsx` | 必須未入力 / 開閉 + 意味記号 DOM | `statements-reference-834.png` | PASS |
| BS-03 | 基準月 | `StatementsBs.tsx:LiabilityForm` | BS 基準月 DOM | `statements-reference-834.png` | PASS |
| BS-04 | 下書き自動保存の check 図記号と時刻 | `StatementsBs.tsx:LiabilityForm` | 自動保存 + 意味記号 DOM | `statements-reference-834.png` | PASS（文字記号を共通 `UiIcon` へ一本化） |
| BS-05 | 必須 3 項目の名称、未入力 / 0円 / 金額入力、金額欄 | `StatementsBs.tsx:LineField` | `statements-screen.dom.test.tsx` 「3 状態から…」 | `statements-reference-834.png` | PASS |
| BS-06 | 必須エラーと0円・未入力の注記 | `StatementsBs.tsx:LineField/LiabilityForm` | BS 不正入力 2 ケース + 意味記号 DOM | `statements-reference-834.png` | PASS（alert / info を追加） |
| BS-07 | フォーム内の rotate 図記号付きリセットと保存 | `StatementsBs.tsx:LiabilityForm` | リセット / 保存 + 意味記号 DOM | `statements-reference-834.png` | PASS |
| BS-08 | 未保存固定バーの alert、件数、リセット、保存 | `StatementsBs.tsx:UnsavedBar` | 「変えた項目の数…」+意味記号 DOM | `statements-reference-834.png` | PASS |
| BS-09 | 任意「その他の負債」 | core `screen.bs.lines` → `LineField` | 「3 状態から…」 | `statements-reference-834.png` | INTENTIONAL（参照画像に無い現行仕様、維持） |

初回監査で修正対象としたのは `PL-01 / PL-06 / CF-02 / BS-02 / BS-04 / BS-07 / BS-08` の表示記号だけである。
共通シェルの寸法、月次数値、負債 KPI の未入力表示、ページ内 nav、任意の「その他の負債」は意図差として維持する。

### 7.1 TDD と実描画の再検証

| 層 | 実行 | 結果 |
|---|---|---|
| RED | `vitest run src/statements-screen.dom.test.tsx --maxWorkers=1` | 追加 2 テストが意図どおり失敗（実装前の 30 件中 2 fail） |
| GREEN | 同コマンド | 30 / 30 pass |
| 関連回帰 | `vitest run src/statements-screen.dom.test.tsx src/statements-balance-sheet.dom.test.tsx src/statements-view-model.test.ts --maxWorkers=1` | 3 files、58 / 58 pass |
| 型 | `pnpm --filter @kanjo/web typecheck` | PASS |
| 静的品質 | 変更対象への `biome check` | PASS |
| 参照実描画 | `KANJO_VISUAL_SCOPE=statements-reference ... check-financial-visuals.mjs` | exit 0。本体 1280 / viewport 1280px、横はみ出し 0、PL 5列同時表示、固定バーとの重なり 0、未保存 3 件・必須エラー・9 個の意味記号・`(万円)` を確認 |
| responsive 実描画 | `KANJO_VISUAL_SCOPE=core ... check-financial-visuals.mjs` | exit 0。320〜1908px、375 / 768 / 1280 / 1600、200% zoom を含む全条件で Statements の図4・表7・BS配置・横幅が PASS |

実描画ランナーは判定と PNG 書き出しの後に exit 0 で終了した。

Low 候補のうち、必須エラーの alert と「0円と未入力」の info は誤入力防止に寄与するため採用した。
基準月の calendar はネイティブ選択と意味が重複し、PL 詳細ミニ図の y 軸目盛は各棒の正確値と「万円」表示に重複するため非採用とした。

## 8. 2026-09-21 PR 前の全体再実行

対象 commit: 本 PR の HEAD（base は `main` の `0003cb4`）。§2 / §3 とは別の実行なので、同じ表に混ぜずここへ記録する。

| コマンド | exit | 記録結果 |
|---|---:|---|
| `pnpm --filter @kanjo/core test` | 0 | Test Files 54 passed / 1 skipped (55)、Tests 893 passed / 6 skipped (899) |
| `pnpm --filter @kanjo/api test` | 0 | Test Files 52 passed (52)、Tests 705 passed (705) |
| `pnpm --filter @kanjo/web test` | 0 | Test Files 90 passed (90)、Tests 828 passed (828) |
| `pnpm typecheck` | 0 | core・api・web すべて Done |
| `pnpm lint` | 0 | biome 546 files、glossary 57 語、graph-lineage 118 ノード一致、design token 直書き 0 件（163 ファイル）、design-system contract / delivery、`security:content` OK |
| `pnpm --filter @kanjo/web build:bundle` → `check:js-budget` | 0 | 初期 JS 103.74KiB / 110KiB |
| `validate-system-plan.py --staging .dev-graph/plans/feature-package-feat-statements-screen` | 0 | `status: pass`、P01..P13 exact 13、`violations: []`、digest `sha256:b7b5463d81396f3733f71694ba174d935c886841941c232029b6574add8f6eb1` |
| `pnpm verify:full` | — | 未実行。§1 のとおり 4175 番ポートを同じ機械の別ワークツリーが使っているため。各段を個別に実行して置き換えた |

§1 の未達ゲート（`verify:full` の exit 0）はこの再実行でも解消していない。CI の 1 本につないだ実行で判定する。
