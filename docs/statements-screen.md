# 決算書画面 — 実装判断と受入対応

`/statements` の要件本文を重ねて持たないため、この文書は**実装時に確定した差分と検証先**だけを記録する。
画面要件は `system-spec/00-requirements-definition.md` と `specs/spec-statements-screen.md`、UI の意図的な差は
[`ui-decisions.md`](ui-decisions.md)、実行結果は [`evidence/statements-screen.md`](evidence/statements-screen.md) を参照する。

## 1. 文書の役割と現行性

| 種類 | 正本 / 役割 |
|---|---|
| 上位要件 | `system-spec/00-requirements-definition.md` と該当カテゴリ章。`spec-state.json` から生成する |
| 詳細画面契約 | `specs/spec-statements-screen.md`。system-spec から再生成した現行の仕様投影 |
| 領域別制約 | `architecture/statements-*.md`。各 system-spec 章から再生成した現行の architecture 投影 |
| feature 境界 | `features/feat-statements-screen*`。現行仕様から再生成した実装単位の投影 |
| 実装判断 | 本書。仕様に無い境界だけを持つ |
| UI 判断 | `docs/ui-decisions.md` の「決算書画面」。画像との差を一度だけ説明する |
| 実行証跡 | `docs/evidence/statements-screen.md` と `docs/evidence/statements/` |
| 計画投影 | `tasks/feat-statements-screen/`、`.dev-graph/requirements/**/feat-statements-screen/` と計画 task ノード |

計画投影は 2026-09-19 の promotion digest に固定された**計画時点の生成物**である。そこに残る
`0045` や旧 API 契約を現行実装の根拠にしない。直接書き換えると lineage が壊れるため、次回 plan を生成するときに
現行の system-spec から更新する。現在の補正は次節を正とする。

## 2. 計画後に確定した 3 つの補正

### 2.1 GET は `screen` だけを返す

`GET /api/statements` の応答は `{ screen: StatementsScreen }` のみ。画面が読まない旧
`pl / cf / bs / liabilityCategoryOptions / balanceSheetSources / period` を同時に返さない。
同じ数値を旧形と新形の二つで契約すると、core の単一計算という目的に反して型・fixture・API テストが二重になるためである。

web は `screen` の値を描画し、合計・比率・CF 可否・負債の完了判定を数え直さない。
`PUT /api/balances/liabilities` の `{ ok: true, bs }` は保存直後の結果を返す別契約なので維持する。

### 2.2 migration は `0046`

実体は `migrations/0046_liability_status.sql`。`0045_owner_labels.sql` が先に使われたため、仕様にあった
「衝突時は次の番号へ繰り下げる」を適用した。

- `balance_entries.status`: `zero | amount`、既定 `amount`。`unset` は行を持たない
- `liability_audit_log`: 状態遷移と件数だけを記録し、金額を残さない
- 既存行を書き換える backfill はしない。`('amount', 0)` は読取時に `zero` と同じ扱いにする
- `schema-guard.ts` の期待値も `0046_liability_status.sql`

取込取消の退避 payload に `status` が無い旧行は `amount` で復元する。全件初期化は既存の `audit_log` と同様、
監査表を削除しない。利用者削除の経路が将来追加されたときは、両監査表を同じ境界で扱う。

### 2.3 画像内容とシステム整合を受入基準にする

基準画像 `design/FINAL-UI/images/11-statements.png`（834×1886）の原子要素を照合し、構成要素・順序・操作、
PL の5列同時表示、未保存バーとの非重複、横はみ出しなしを DOM と実描画で検証する。
2026-09-21 の再確認により、決算書だけ共通シェルを画像固有の寸法へ変えず、システム全体の
`Layout.tsx` とデザイントークンを優先する。任意の「その他の負債」も現行データ契約として維持する。

| ゲート | 合格条件 | 現状 |
|---|---|---|
| 機能・構造 | KPI 4 枚、ページ内ナビ、PL / CF / BS、入力、各状態が DOM と実画面で動く | PASS（現 refactor 後 58 tests） |
| 画像内容の網羅 | 基準画像の原子要素を、意図差を明示した上で欠落なく表示する | PASS（30項目 + 仕様上の任意1項目） |
| システム整合 | 共通シェル・トークン・44px操作領域を維持し、320〜1908pxと200% zoomで崩れない | PASS |
| literal pixel 一致 | 共通シェルを画像固有の寸法へ変える | 非対象（1画面だけの上書きをしない） |

許容するのは、動的な金額・日付・グラフ値と、`ui-decisions.md` に列挙した 8 件の意図的差だけ。
未計測のずれを一律の pixel 率で暗黙に許容せず、原子要素と実ブラウザの配置検査で判定する。

`docs/evidence/statements/` に 834px 幅の reference、overlay、diff を保存済み。差分の分類と
未達理由は `docs/evidence/statements-screen.md` を正本とし、比較画像があることだけを
pixel-perfect の合格証跡にはしない。

## 3. 実装境界

### 3.1 core と期間

- `statementsScreen(input)` が KPI、PL、CF、BS を一度だけ算出する
- 当期は `applyPeriod(all, range)`、前期は直前の同じ月数。全期間は `fullRange(all)` を当期にする
- 前期に月が無ければ `previous=null` とし、画面は `—` を出す
- `ref` が不正または期間外なら期間末へ丸め、`screen.bs.referenceMonth` を正規値として返す

区分対応・計算式は `packages/core/src/statements-screen.ts` と [`data-schema.md`](data-schema.md) の一か所に寄せる。
未知科目と外注工賃は販管費、期末商品棚卸高は売上原価から減算する。

月次 fixture は千円を正本にし、core は `× 1,000` した円を返す。web の月次表だけが円を
`÷ 10,000` して万円表示するため、売上高は 9 月 `950,000円 → 95万円`、期間合計
`12,480,000円 → 1,248万円` となる。画像の `950`〜合計 `12,480` は千円値としては整合するが、
`（万円）` のラベルと重複した月見出しは引き継がない。

### 3.2 CF

不能原因は次の三群だけを core が数える。

| 原因 | 判定 |
|---|---|
| 未仕訳 | 対象 MF 明細のうち、振替でなく `clsSrc === '既定'` |
| 現金口座データの欠け | `unrecordedExpMonths`、または `cashFlow(...).settlementUnknown` |
| 科目未設定 | `accountRaw` と `accountNorm` がともに空の仕訳 |

一つでも立てば `unavailable`、全て 0 / false のときだけ `available`。web はこの判定を再実装しない。

### 3.3 負債保存

PUT 本文は `{ month, lines: [{ category, status: 'unset'|'zero'|'amount', amount? }] }`。
送られた項目だけを処理し、未送信項目と他月には触らない。`unset` は manual 行を削除し、`zero / amount` は upsert する。
同じキーに `source='mf'` の行があれば 409 で止め、取込値を手入力で上書きしない。

金額は整数・0 以上・1 兆円以下、本文は 8 KiB 以下、カテゴリ重複は不可。保存と金額なし監査を同じ batch で行う。

### 3.4 web の部品

| ファイル | 責務 |
|---|---|
| `StatementsPage.tsx` | 取得、URL、読込 / 空 / 失敗、期間、節ナビ |
| `StatementsKpis.tsx` | KPI 4 枚 |
| `StatementsPl.tsx` | PL 表、詳細、推移、月次表、CSV 入口 |
| `StatementsCf.tsx` | CF の不能 / 概算 |
| `StatementsBs.tsx` | BS、負債 3 状態、保存、未保存バー |
| `liability-draft.ts` | 利用者・月別の下書きと未保存件数 |
| `statements-csv.ts` | CSV と数式注入対策 |
| `view-model.ts` | URL と表示書式。財務計算は置かない |

下書きキーは `kanjo.statements.liabilityDraft.<認証主体id>.<YYYY-MM>`。800ms 後に保存し、保存成功・リセット・ログアウトで消す。

## 4. 受入の参照先

| 観点 | 主な自動検証 |
|---|---|
| core 恒等式・前期比・区分・CF・負債 3 状態 | `packages/core/test/statements-screen-contract.test.ts` |
| GET screen-only・ref 丸め・PUT 部分保存・入力制約・監査 | `packages/api/src/statements-screen.integration.test.ts` |
| 画面構造・URL・a11y・下書き・保存 | `packages/web/src/statements-screen.dom.test.tsx` |
| 既存 BS 契約との統合 | `packages/web/src/statements-balance-sheet.dom.test.tsx` |
| レイアウト・描画領域・はみ出し | `packages/web/scripts/check-financial-visuals.mjs` |
| 参照画像との判定 | `docs/evidence/statements-screen.md`（現行 reference と意図差・実描画結果） |

## 5. 未完了

- literal pixel 比較が別途必要になった場合の現行 reference に対する overlay / diff 再生成
- `verify:full` の 4175 番ポート競合を除いた exit 0 の一括記録（代替 4176 で financial routes 単体は PASS）
- 取込中 409 とログアウト下書き消去の結合テスト
- `保存中…`、保存失敗、CSV 操作の DOM テスト

ここにある未完了を S1 / S5 の達成として読み替えない。
