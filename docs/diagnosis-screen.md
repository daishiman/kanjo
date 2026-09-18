# 診断画面 (08-diagnosis) の計算規則

『次に何を改善すると最も効くのか』を 1 画面で決めるための**算式としきい値だけ**を置く正本。振る舞いは `specs/spec-diagnosis-screen.md`、依存と ADR は `architecture/arch-diagnosis-screen.md`、テスト入力は `docs/diagnosis-screen-test-plan.md` を参照する。

- 対象画面: `/analysis/diagnosis`
- 計算の置き場所: `packages/core/src`（依存ゼロの純粋関数）
- 本書が固定するもの: 検知器 8 種の算式、impact 換算、claim 排他、健全性スコアの算式

## 1. 用語

| 用語 | 定義 |
|---|---|
| 検知器 (detector) | `{ id, label, detect(data: Dataset): Improvement[] }`。改善余地の見つけ方 1 種類。core のレジストリへ登録する。 |
| 改善余地 (Improvement) | 検知器が返す 1 件の課題。表示値に加え `impactBasis` / `scope` / `metric` / `claimKeys` を持つ。 |
| action_key | `<検知器 id>:<対象キー>` の安定キー。D1 では `user_id` と組にして判断を識別する。 |
| claimKeys | 同じ支出・契約・科目を指す候補を見分ける安定キー。同じキーを claim する候補は 1 件だけ採用する。 |
| 年間改善インパクト | `recurring_monthly` は月額 × 12、`one_off` は一度の金額をそのまま使う。 |
| 健全性スコア | 固定費比率・貯蓄率・収支の安定性・データカバー率の 4 要素を重み 30/30/25/15 で合成した 0-100。 |

## 2. 検知器レジストリ

### 2.1 共通の型

```ts
export interface ImprovementEvidence {
  /** 何の数値か (例: 直近3ヶ月平均) */
  label: string;
  /** 実測値 (円・比率いずれも数値のまま持つ) */
  value: number;
  /** 比較対象の値 (基準・中央値・予算など)。持たない場合は null */
  baseline: number | null;
  /** 観測した期間 (例: 2026-04〜2026-06) */
  period: string;
  /** 出典 (例: MoneyForward 明細 / freee 取引 / 予算設定) */
  source: string;
}

export interface Improvement {
  /** 検知器 id */
  id: string;
  /** 永続化の主キー */
  action_key: string;
  label: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  /** 円・整数 */
  annualImpact: number;
  monthlyImpact: number;
  impactBasis: 'recurring_monthly' | 'one_off';
  scope: 'business' | 'household';
  metric: 'expense' | 'income' | 'net';
  claimKeys: string[];
  effort: 'low' | 'medium' | 'high';
  confidence: 'high' | 'medium' | 'low';
  evidence: ImprovementEvidence[];
  /** 遷移先の経路名と絞込クエリ。画面は Link へ渡すだけ (FR-009) */
  nextAction: { label: string; to: string };
  /** 利用者の判断。D1 に行が無ければ 未着手 */
  status: '未着手' | '対応中' | '対応済み' | '見送り';
}

export interface Detector {
  id: string;
  label: string;
  detect(data: Dataset): Improvement[];
}
```

共通規則:

- `monthlyImpact <= 0` の候補は返さない。
- `impactBasis === 'recurring_monthly'` なら `annualImpact = monthlyImpact × 12`、`one_off` なら `annualImpact = monthlyImpact`。
- `evidence` は最低 1 件。実測値・比較値・期間を必ず載せる (切り分けの順序を固定するため)。
- `severity` は年間インパクトから決める: 240,000 円以上 = high、60,000 円以上 = medium、それ未満 = low。
- `detectImprovements()` は候補を `annualImpact` 降順 → claimKeys 数降順 → confidence 降順 → action_key 昇順で安定化し、採用済み候補と `claimKeys` が交差する候補を除外する。
- selection.metric と各候補の `metric` が一致する項目だけを残す。selection.scope が `business` / `household` なら一致する項目だけを残し、`total` なら両方を残す。
- core は既定の `status = 未着手` を置き、api が同じ user_id の `diagnosis_action_states` を join して保存済み判断を上書きする。

### 2.2 8 種の定義

| # | id | scope / basis | 検知条件 | monthlyImpact | nextAction query |
|---|---|---|---|---|---|
| 1 | `fixed_cost_review` | business / recurring_monthly | `type === '固定費'` かつ `rAvg > 30,000` | `rAvg × 0.15` | `/subscriptions?account=<科目>` |
| 2 | `spike` | business / (a) recurring_monthly、(b)(c) one_off | (a) 予算あり: `rAvg > 予算` (b) 予算なし: `lastVal > mean + sd` (c) 取引先 spike | (a) `rAvg - 予算` (b) `lastVal - mean` (c) `value - median` | (a)(b) `/budget?account=<科目>` (c) `/subscriptions?vendor=<取引先>&month=<月>` |
| 3 | `duplicate_payment` | household / one_off | 同一取引先・同一金額・同一月が 2 件以上 | 2 件目以降の合計 | `/analysis/reconciliation?month=…&payee=…&amount=…` |
| 4 | `subs_duplicate` | business / recurring_monthly | `subscriptions()` の `type === 'dup'` | `value - median` | `/subscriptions?vendor=<取引先>&month=<月>` |
| 5 | `unclassified` | household / one_off | `unexplained > 0` | `unexplained × 0.3` | `/classify?month=…&cls=per&category=未分類` |
| 6 | `comms_review` | business / recurring_monthly | 「サブスク・通信」が全経費の 15% 以上 | `rAvg × 0.2` | `/subscriptions?account=サブスク・通信` |
| 7 | `income_decline` | business・household / recurring_monthly | 6ヶ月以上あり、直近3ヶ月平均収入がその前3ヶ月平均より 10% 超低い | `前3ヶ月平均 − 直近3ヶ月平均` | `/analysis/trends?scope=…&metric=income` |
| 8 | `negative_net` | business・household / recurring_monthly | 3ヶ月以上あり、直近3ヶ月平均純収支が 0 円未満 | `abs(直近3ヶ月平均純収支)` | `/analysis/trends?scope=…&metric=net` |

query の値は用途別の生値を `encodeURIComponent` で percent encode する。`/classify` へ渡せるキーは `month` / `cls` / `category` / `payee` とし、家計の未分類は `cls=per` を必須とする。

補足:

- 検知器 2 の (a)(b) は排他である。既存 `tradeoffCandidates()` が `budget_over` を予算あり、`above_range` を `data.budgets[account] == null` の場合だけ出していることに対応する。したがって既存 5 種を本レジストリへ寄せても同じ科目が二重に出ることはない。
- 検知器は対象を `claimKeys` へ射影する。安定順で先に採用された候補の claim と交差した候補は除外する。検知器 3 と 4 が同じ支払いを指す場合もこの一般則で 1 件に寄せ、検知器固有の if を画面・API・集計へ増やさない。
- 既存 `tradeoffCandidates()` の 5 種は次のとおり吸収済み。判定規則は検知器レジストリだけが持ち、`tradeoffCandidates()` は kind の対応表だけを残した射影関数になっている (ADR-001 / fitness test)。実体は `packages/core/src/diagnosis-detectors.ts`。

| 既存 kind | 寄せ先 | 射影後の id |
|---|---|---|
| `subs_dup` | 4 `subs_duplicate` | `subs:<取引先>` |
| `subs_spike` | 2 `spike` の (c) | `subs:<取引先>` |
| `budget_over` | 2 `spike` の (a) | `budget:<科目>` |
| `above_range` | 2 `spike` の (b) | `range:<科目>` |
| `unexplained` | 5 `unclassified` | `unexplained` |

- 射影に対応する kind を持たない検知器 (1 `fixed_cost_review` / 3 `duplicate_payment` / 6 `comms_review`) はやりくり試算へ出さない。
- 同じ取引先が 4 `subs_duplicate` と 2 `spike` (c) の両方に当たることがある。どちらも「当月値 − 中央値」を見るので金額は並ぶが、試算は取引先ごとに 1 行にするため、打ち手のはっきりしている `subs_dup` を残す (急増は「なぜ増えたか」を先に調べる必要があり、そのままでは行動に移せない)。金額が同額になる以上、実装の出力順に任せると結果が実装順依存になるので、この優先規則を明文で固定する。
- `income_decline` は季節性を推測で補正せず、10% 減ちょうどまでは通常変動として候補を出さない。回復見込みは「その前3ヶ月平均へ戻す」可逆な運用仮説なので confidence は medium とする。
- `negative_net` は赤字幅を 0 円へ戻す差だけを候補にする。事業は経費未記帳月を除外し、欠損を 0 円経費として黒字扱いしない。

### 2.3 action_key の形式 (BR-006)

- 形式: `<検知器 id>:<対象キー>`
- 許可文字種: 半角英数字・`_`・`-`・`:`・`.`・全角文字 (科目名と取引先名を含むため)。制御文字と改行を含まない。
- 長さ上限: 200 文字。
- 検証: 先頭のコロンより前が**登録済み検知器 id と完全一致**すること。一致しない値は 400 で拒む。未知の id を受け付けないことで、レジストリに無いキーの行が増えない。

### 2.4 検知器を足す手順

1. `packages/core/src/diagnosis-detectors.ts` の `DIAGNOSIS_DETECTORS` へ `{ id, label, detect }` を 1 件追加する。
2. 本書 2.2 の表へ 1 行足す。
3. `packages/core/test/diagnosis-detectors-contract.test.ts` へ境界値テストを対で足す (検知される最小の入力 / ぎりぎり検知されない入力)。

この 3 つ以外の編集 (画面・API の変更) が必要になったら G2 が壊れている合図とする。`packages/web/src` と `packages/api/src` に検知器 id のリテラルが現れていないことは、同ファイルの `registry-no-branch` テストが全ソースを走査して固定している。テストのフィクスチャで検知器を模す場合も実在の id を書かない (契約側を緩めずに実装を合わせる)。

## 3. 健全性スコア

4 要素を 0-100 の要素スコアへ正規化し、重みを掛けて合成する。

### 3.1 要素と算式

| 要素 | 重み | 実測値 | 要素スコア | 算出不能の条件 |
|---|---|---|---|---|
| 固定費比率 | 30 | `F = 固定費(直近3ヶ月平均) / 平均月商` | `clamp(100 × (0.60 − F) / (0.60 − 0.20), 0, 100)` — F ≤ 0.20 で 100、F ≥ 0.60 で 0 | 平均月商 = 0 |
| 貯蓄率 | 30 | `S = (収入 − 支出) / 収入` | `clamp(100 × S / 0.30, 0, 100)` — S ≥ 0.30 で 100、S ≤ 0 で 0 | 収入 = 0 |
| 収支の安定性 | 25 | `CV = 月次純収支の標準偏差 / 平均の絶対値` | `clamp(100 × (0.50 − CV) / (0.50 − 0.10), 0, 100)` — CV ≤ 0.10 で 100、CV ≥ 0.50 で 0 | 対象月数 < 3、または平均 = 0 |
| データカバー率 | 15 | `C = 記帳済み月数 / 対象期間の月数` | `100 × C` | 対象期間の月数 = 0 |

`clamp(x, 0, 100)` は 0 未満を 0、100 超を 100 に丸める。

### 3.2 合成と区分

- 寄与点: `contribution_i = score_i × weight_i / Σ(算出できた要素の weight)`
- 総合スコア: `score = round(Σ contribution_i)`。寄与点の合計は総合スコアと一致する (AC-003)。
- 算出不能な要素はその要素を除いて重みを正規化し、除いた旨を画面に示す (FR-005)。全要素が算出不能なら `score = null` として区分を出さず、データ未取込として扱う。
- 区分 (band): `score ≥ 75` = 健全 / `score ≥ 50` = 注意 / それ未満 = 要改善。

### 3.3 返却する内訳

```ts
{
  score: number | null;
  band: '健全' | '注意' | '要改善' | null;
  breakdown: {
    key: 'fixed_cost_ratio' | 'savings_rate' | 'stability' | 'coverage';
    label: string;
    /** 実測値 (比率) */
    actual: number | null;
    /** 0-100。算出不能なら null */
    score: number | null;
    /** 正規化後の重み。算出不能なら 0 */
    weight: number;
    /** score × weight / Σweight */
    contribution: number;
    /** 算出不能の理由。算出できた場合は null */
    unavailableReason: string | null;
  }[];
}
```

## 4. 金額が合わないときの切り分け順序

「診断画面の数字が別画面と違う」という問い合わせは、必ず次の 3 段を上から順に潰す。上の段が違っていれば下の段を見ても意味が無い。段を飛ばすと、たまたま近い数字を見て「合っている」と誤判定しやすい。

### 第 1 段: 期間の切り方

まず両方の画面が同じ月の集合を見ているかを確かめる。

- 診断画面の期間は `usePeriod` / localStorage の共有状態が正本。期間表示と `usePeriod.key` を突き合わせる。URL は scope / metric / compare / action など診断固有の状態だけを持つ。
- 期間は Dataset を切ってから分析関数へ渡す。分析関数に期間引数を配る設計ではないので、「どの Dataset を渡したか」が全ての起点になる。
- 比較対象 (前期間 / 前年同期) は対象の全月が揃っているときだけ出る。1 か月でも欠ければ比較列を出さない (AC-006 の組合せテストで固定)。比較値が空なのはバグではなく、この規則の結果であることがある。
- ここが揃っていれば、期間合計は同じ期間の総収支画面と一致する (BR-004・AC-006)。一致しなければ第 2 段へ進まず、ここで原因を確定させる。

### 第 2 段: 範囲の選択

次に、事業 / 家計 / 総合のどれを見ているかを確かめる。

- 総合 = 事業 + 家計 (BR-004)。総合と片方を比べていないかを最初に疑う。
- 要確認の明細は事業にも家計にも数えない (BR-003)。総合が事業 + 家計と一致していて、それでも他画面と差があるなら、この除外分が差の正体であることが多い。注記に件数が出る。
- 改善アクションの合計は対応済み / 見送りを除く (BR-001)。畳んだ件数と金額は注記に出るので、その注記の金額を足し戻して一致するかを見る。

### 第 3 段: 検知器ごとの evidence

ここまでで揃っていれば、差は個々の検知器の中にある。

- 各改善余地は `evidence[]` に実測値・比較値・観測期間・出典を持つ (2.1)。詳細パネルの診断根拠の表がそれをそのまま出す。
- 見るのは 3 つ: **どの値を**見たか (label)、**何と比べたか** (baseline)、**どの期間を**見たか (period)。差はこの 3 つのいずれかに必ず現れる。
- 丸めは表示時のみで、内部は円単位の整数 (BR-002)。画面の 1 円差は丸めの結果であり、計算の差ではない。
- `monthlyImpact` は検知器ごとに算式が違う (2.2)。年間インパクトは `impactBasis` を確認し、recurring だけ 12 倍、one_off は 1 倍で照合する。

## 5. 集合からの導出

status・scope・metric・claim 排他を適用した 1 つの改善項目集合を正本とする。

- primary improvement: 集合の先頭。空なら「大きな改善余地なし」。
- totals: 未着手 / 対応中の annualImpact の和。対応済み / 見送りは collapsed へ分ける。
- waterfall: 支出は同じ集合を順に引き、改善後金額を `max(0, 現状支出 - 累計 impact)` とする。収入・純収支は同じ集合を順に足し、`現状値 + 累計 impact` とする。
- signals: 同じ集合の上位から最大 3 件。
- 表・詳細・固定アクションバー: 同じ action_key の項目を参照し、画面側で再集計しない。
