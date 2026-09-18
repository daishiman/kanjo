# 診断画面のテスト入力表

`docs/diagnosis-screen.md` の算式を固定するための入力表。P06 がこの表どおりにテストを書く。すべて `emptyDataset()` を起点にテスト内で組み立てた架空値で、外部データに依存しない。

共通の土台 (`baseMonths`): 15 ヶ月 `2025-01`〜`2026-03`、売上は毎月 1,000,000 円。検知器ごとに必要な列だけを足す。

## 1. 検知器の境界値 (対で 2 件ずつ)

| # | 検知器 | 検知される最小の入力 | 期待 | ぎりぎり検知されない入力 | 期待 |
|---|---|---|---|---|---|
| 1 | `fixed_cost_review` | 固定費性の科目 (CV < 0.6) を直近3ヶ月とも 30,001 円 | 1 件。`monthlyImpact = round(30001 × 0.15) = 4,500`、`annualImpact = 54,000` | 同じ科目を直近3ヶ月とも 30,000 円 | 0 件 (しきい値は超過のみ) |
| 2a | `spike` (予算あり) | 予算 10,000 円の科目の直近3ヶ月平均が 11,001 円 | 1 件。`impactBasis = recurring_monthly`、`monthlyImpact = 1,001`、`annualImpact = 12,012` | 直近3ヶ月平均が 11,000 円 | 0 件 |
| 2b | `spike` (予算なし) | 予算未設定の科目で直近値が `mean + sd` を超え、z ≥ 1 | 1 件。`impactBasis = one_off`、`monthlyImpact = annualImpact = lastVal − mean` | 直近値 = `mean + sd` ちょうど (z < 1) | 0 件 |
| 2c | `spike` (サブスク) | `subscriptions()` の spike 条件 `value >= median × 3 かつ value > 15,000` を満たす最小 (中央値 5,000 / 当月 15,001) | 1 件。`impactBasis = one_off`、`monthlyImpact = annualImpact = 10,001` | 当月 15,000 (`> 15000` を満たさない) | 0 件 |
| 3 | `duplicate_payment` | 同一取引先・同一金額 5,000 円が同一月に 2 件 | 1 件。`impactBasis = one_off`、`monthlyImpact = annualImpact = 5,000` | 同一取引先・同一金額が同一月に 1 件 | 0 件 |
| 4 | `subs_duplicate` | `subscriptions()` の dup 条件 `value >= median × 1.8 かつ value > 20,000 かつ median > 5,000` を満たす最小 (中央値 5,001 / 当月 20,001) | 1 件。`impactBasis = recurring_monthly`、`monthlyImpact = 15,000`、`annualImpact = 180,000` | 当月 20,000 (`> 20000` を満たさない) | `subs_duplicate` は 0 件。ただし spike 条件には落ちるので `spike:vendor:<取引先>` が 1 件立つ |
| 5 | `unclassified` | 直近月の未分類 + カード引落の合計が 10 円 | 1 件。`impactBasis = one_off`、`monthlyImpact = annualImpact = 3` | 合計 1 円 (`round(0.3) = 0` で 0 円は返さない) | 0 件 |
| 6 | `comms_review` | 「サブスク・通信」が全経費の 15.0% ちょうど | 1 件。`monthlyImpact = round(rAvg × 0.2)` | 同科目が全経費の 14.9% | 0 件 |
| 7 | `income_decline` | 前3ヶ月平均 100,000 円 / 直近3ヶ月平均 89,999 円 | 1 件。`monthlyImpact = 10,001`、`annualImpact = 120,012` | 直近平均 90,000 円、または5ヶ月以下 | 0 件 |
| 8 | `negative_net` | 直近3ヶ月の収入 100,000 円 / 支出 100,001 円 | 1 件。`monthlyImpact = 1`、`annualImpact = 12` | 収支 0 円、または2ヶ月以下 | 0 件 |

対で確かめること:

- 件数を固定値で検算する (`toHaveLength(1)` / `toHaveLength(0)`)。「0 件の違反」と「0 件しか調べていない」を区別するため、検知される側は金額も固定値で照合する。
- `action_key` の形が `<検知器 id>:<対象キー>` であること。
- `evidence` が 1 件以上あり、`value` / `baseline` / `period` / `source` を持つこと。
- `scope` が business / household の想定側、`metric` が検知器の対象指標、`claimKeys` が 1 件以上であること。
- `nextAction.to` が対象 query を含み、日本語・取引先名を percent encode していること。

## 2. impact・scope・claim の入力

| ケース | 入力 | 期待 |
|---|---|---|
| recurring と one-off | monthlyImpact 1,000 の候補を各 1 件 | recurring の annualImpact は 12,000、one-off は 1,000 |
| scope=business | business と household を各 1 件 | business だけを返す |
| scope=household | business と household を各 1 件 | household だけを返す |
| scope=total | business と household を各 1 件 | 両方を返す |
| metric=income | 直近3ヶ月平均が前3ヶ月平均より10%超減少 | `income_decline` だけ。waterfall は現状収入へ impact を加える |
| metric=net | 直近3ヶ月平均純収支が赤字 | `negative_net` だけ。waterfall は現状純収支へ赤字解消額を加える |
| metric=income / net の該当なし | 横ばい収入 / 収支0円以上 | improvements と totals は0件。waterfall は現状と改善後が同額の2本 |
| claim overlap | 異なる detector から同じ claimKeys を持つ 2 件 | annualImpact → claimKeys 数 → confidence → action_key の優先順で 1 件だけを返す |
| claim non-overlap | claimKeys が交差しない 2 件 | 両方を返し annualImpact 降順に並ぶ |
| waterfall floor | 現状支出 1,000、annualImpact 2,000 | 改善後は 0。-1,000 にしない |

## 3. レジストリの拡張性 (AC-002)

| ケース | 入力 | 期待 |
|---|---|---|
| 検知器を 1 件足す | テスト内で `{ id: 'test_only', label: 'テスト用', detect: () => [固定の 1 件] }` を登録した配列を `detectImprovements` へ渡す | 返却に `test_only:...` が現れ、並びは `annualImpact` 降順を保つ |
| 分岐の不在 | `packages/web/src` と `packages/api/src` の全ファイル | 登録済み検知器 id の文字列リテラルが 0 件 (静的検査) |

## 4. 健全性スコアの 3 点 (AC-003)

| ケース | 入力 | 期待 |
|---|---|---|
| 100 点 | 固定費比率 0.20 以下・貯蓄率 0.30 以上・純収支 CV 0.10 以下・カバー率 1.0 | `score = 100`、`band = '健全'`、全 `breakdown[].score = 100`、寄与点の合計 = 100 |
| 最低点 | 固定費比率 0.70・貯蓄率 0 以下・CV 0.50 以上・カバー率 1/15 | 固定費比率・貯蓄率・安定性が 0 点、カバー率が 6.67 点。`score = 1`、`band = '要改善'` |
| 算出不能 | 売上 0 (平均月商 0・収入 0)・月数 2 ヶ月 | 固定費比率・貯蓄率・安定性が `score = null`・`unavailableReason` 付き。カバー率だけが残り重みが 15/15 = 1 へ正規化され、`score = カバー率の要素スコア`。寄与点の合計 = 総合スコア |
| 全要素が算出不能 | `emptyDataset()` | `score = null`、`band = null` |
| 区分の境界 | 総合 75 / 74 / 50 / 49 | 健全 / 注意 / 注意 / 要改善 |

## 5. `GET /api/diagnosis` の contract tests

| 種別 | 入力 | 期待 |
|---|---|---|
| Positive | 認証済み・既定条件 | 200。`improvements` / `health` / `waterfall` / `signals` / `evidence` / `totals` / 既存 `entries` `kpi` `bep` `autoDiagnosis` が揃う |
| Boundary | 改善余地が 0 件になるデータ | 200。`improvements = []`、`health` は返る、`waterfall` は合計 0 の 2 本 |
| Negative (条件) | `?scope=zzz&metric=zzz&compare=zzz` | 200。`selection` が既定値 (`total` / `expense` / `previous`) に倒れ、その selection を改善項目にも適用する |
| Negative (認証) | 未認証 | 401 `unauthorized` |

## 6. `PATCH /api/diagnosis/actions/:action_key` の contract tests

| 種別 | 入力 | 期待 |
|---|---|---|
| Positive | 4 語それぞれ (`未着手` / `対応中` / `対応済み` / `見送り`) | 200。`{ action_key, status, note, decided_at }` を返し、再取得で復元する |
| Positive (冪等) | 同じ `action_key` へ同じ `status` を 2 回 | 2 回とも 200 で同じ `status`。行は 1 行のまま |
| Ownership | user A / user B が同じ `action_key` を保存 | `(user_id, action_key)` の 2 行。互いの status / note は GET で見えない |
| Boundary (note) | 500 文字ちょうど | 200 |
| Boundary (note) | 501 文字 | 400 `invalid_request` |
| Boundary (action_key) | 200 文字ちょうどの正当なキー | 200 |
| Negative | 未登録の検知器 id を含む `action_key` (`zzz:あ`) | 400 |
| Negative | `status = '完了'` (4 語以外) | 400 |
| Negative | 未認証 | 401 |
| Negative | 応答本文 | いずれのエラーでも SQL とスタックを含まない |

## 7. 統合テスト (AC-004)

| 手順 | 期待 |
|---|---|
| 1. `GET /api/diagnosis` で `improvements` を得る | 全件 `status = '未着手'` |
| 2. 先頭の `action_key` を `対応中` にし note を付ける | 200 |
| 3. 期間を変えて `GET` | 同じ `action_key` の `status` / `note` / `decided_at` が保たれる |
| 4. `対応済み` にして `GET` | `totals.active` から当該金額が除かれ、`totals.collapsedCount` が 1 増える |
| 5. 検知されないデータへ入れ替えて `GET` | 行は残るが `improvements` に出ない (BR-008)。再び検知されるデータへ戻すと `対応済み` が復帰する |

## 8. 画面の DOM テスト (AC-001 / AC-005)

| ケース | 期待 |
|---|---|
| 既定条件で描画 | 期間タブ・見出し・条件の帯・primary improvement・健全性カード・主なシグナル・改善アクションの表・ウォーターフォール・診断根拠の表・完了すると変わる指標が現れる |
| 統計の詳細 | 既定で科目別プロファイルが非表示、開くと表示 |
| 行の選択 | master の選択と detail パネル、画面下部の固定アクションバーが同じ項目へ同期し、`?action=` が URL に載る |
| 実行先 | 詳細パネルと固定アクションバーの Link が用途別 query 付きで向き、日本語は percent encode される。未分類は `/classify?month=…&cls=per&category=未分類` |
| 期間と URL | 期間変更は `usePeriod` / localStorage、scope / metric / compare / action は searchParams へ保存される |
| 文字ラベル | 優先度・ステータス・手間・信頼度が色だけでなく文字で読める |
| 旧応答 | `improvements` が欠ける応答で新ブロックを出さず、既存の統計だけを出す |
| 畳み込み | 対応済み・見送りは既定で表に出さず、畳んだ件数と年間合計を注記する。切り替えると同じ並びのまま現れる |
| 未取込 | `entries` と `improvements` がどちらも空なら取込へ誘導する |
