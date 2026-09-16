# 総収支画面 要件ベースライン (SYS-TCSCREEN-P01)

正本は `specs/spec-total-cashflow-screen.md` と `system-spec/00-requirements-definition.md`。
本書はその要件を実装が参照できる粒度へ落とし、仕様が「未決」と印を付けた点に着手時の扱いを与える。
ここで閉じた判断は推定であり、利用者の明示選択ではない。仕様が更新されたら本書が従う。

## 1. 実装が満たす受入条件

| ID | 内容 | 検証の置き場所 |
|---|---|---|
| AC-001 | 05-total-cashflow.png の構成要素が全て描画され、色は共通トークン経由で直書きが0件 | `packages/web/test/total-cashflow-table.dom.test.tsx`、`check:financial-figure` |
| AC-002 | 総合/事業/家計の KPI と前年同期比が core と一致し、総合 = 事業 + 家計 | `packages/core/test/total-cashflow-screen-rules.test.ts` |
| AC-003 | 単票・複数選択の 同じ/別/除外 が行え、判定後の総額が不変条件どおり | `packages/api/test/total-cashflow-verdict.integration.test.ts` |
| AC-004 | 取消で総額と判定件数が操作前と一致、同じ id の再送は1回分、再読込後は導線なし | `packages/api/test/total-cashflow-operations.integration.test.ts` |
| AC-005 | 規則が docs と境界値テストで固定され、サイドバーの現在地と照合バッジが一致 | 本 docs 群 + DOM テスト |
| AC-006 | `pnpm test` / `typecheck` / `lint` と web の check 系が緑 | `docs/total-cashflow-screen/test-run.md` |

## 2. 規則の実装単位への割り当て

| 規則 | 置き場所 | 名前 |
|---|---|---|
| BR-001 一致度 | core | `matchScore()` と `MATCH_SCORE_*` 定数 |
| BR-002 判定作業3区分 | core | `totalCashflowWorkbench()` |
| BR-003 自動一致の候補 | core | `autoMatches` (`by === 'auto'` の matched に score を添える) |
| BR-004 セグメント | core | `totalCashflowSummary()` / 月次系列 |
| BR-005 除外後の数え方 | core | `reconcileBizDuplicates()` の review ループ |
| BR-006 前年同期比 | core | `previousYearPeriod()` と summary の `previousYear` |
| BR-007 判定進捗 | web | 表示中区分の N/M を core の件数から導く |
| BR-008 取消 | api | `POST /total-cashflow/operations/:id/undo` |
| BR-009 消し込み不変条件 | core (既存) | 変更しない |

## 3. 未決事項に対する着手時の扱い

仕様の「未決事項」は全て completeness-findings の low。実装は次のとおり倒す。

- **U-001 取消の 409 と 404 の画面の扱い**: 応答本文の `error` で分ける。
  `canonical_write_busy` は再試行すれば通るので **操作 id の列を保持** し「別の更新と重なりました。もう一度お試しください」を出す。
  それ以外の 409 (最新の未取消操作と一致しない) と 404 (他人の id・存在しない id) は **列を空にし**「別の画面で新しい操作があったため取り消せません」と再読込を促す。
  根拠: 列を空にする目的は「画面が持つ id が実際の最新と食い違った」ことの表明であり、lease 競合はその食い違いを示さない。
- **U-002 変更箇所の数え漏れ**: 次を本サイクルの変更範囲に明示的に含める。
  `packages/api/src/import-lifecycle-pure.test.ts` の consumers 列挙と route 列挙の期待値、`routeSources` への総収支ルートの追加、`packages/api/src/db/schema.ts` の列と表、`packages/api/src/schema-guard.ts` の期待 migration 名、`packages/api/src/deletion-schema.test.ts` の期待値。
- **U-003 表記の混在**: 画面と docs の表示語は **「前年同期」「前年同期比」** に統一する。`analysis-hub` の `previousPeriod` (直前の同じ長さ) は名前も意味も変えない。
- **U-004 除外を考えない候補が2件以上あり全部除外済みの明細**: **review に残す**。decision-015 の「唯一の候補」は字義どおり1件に限る。2件以上あった組は、どの候補と同じだったのかを機械が名指しできないため、集計へ落とすと利用者の確認機会が消える。
- **U-005 `lastOperation` の用途**: 右ペインの「直前の操作」の**表示**に使う。再読込直後は `undoable` を偽にして取消の導線を出さない (decision-017)。
- **U-006 「同じ取消を2回送っても1回分しか戻らない」**: AC-004 のテストで固定する。

## 4. 変更してよい範囲 (resource_scope)

core の `total-cashflow.ts` と `index.ts` / api の総収支ルート・DB 定義・schema guard・canonical mutation fence・import 系 / `migrations/0041_*.sql` /
web の `pages/analysis/TotalCashflow.tsx`・`api.ts`・`analysis-query-invalidation.ts`・`components/Layout.tsx` / 上記に対応するテストと `docs/total-cashflow-screen/`。

範囲外 (触らない): サイドバーの項目と並び (decision-011 により確認のみ)、照合/マトリクス/推移/診断タブの中身、取込経路、期間選択の保存先。
