# 家計収支画面 — 設計判断と証跡

- 対象: feature `feat-household-cashflow` / Beads epic `kanjo-fzu` (子 `kanjo-fzu.1`〜`.13` = `SYS-HOUSEHOLD-P01`〜`P13`)
- 仕様の正本: [`specs/spec-household-cashflow-screen.md`](../../specs/spec-household-cashflow-screen.md) (以下 spec)
- 上位要件: [`features/feat-household-cashflow.md`](../../features/feat-household-cashflow.md) (受入 S1〜S6)、`system-spec/00-requirements-definition.md`

この 1 枚に P01〜P13 の証跡を集める。前例 (マトリックス画面の `evidence-index.md`) と同じく、正本が別にあるものはポインタに留め、名前だけのファイルを増やさない。

---

## 1. 要件ベースライン (P01)

### 1.1 受入 S1〜S6 (検証可能な文と spec の節)

| | 検証する文 | spec の節 |
|---|---|---|
| S1 | `/household` に見出し・出典・KPI 4 枚・推移グラフ (5 系列)・事業と個人の内訳・カテゴリ表と詳細・名義別収入・選択月の振替全件 (抜粋なし)・名義ラベル設定・前年比較・下部バーが描画される。集計対象台帳行 0 件 (振替のみ・除外行のみ) は空。色は `charts.ts` の系列色とトークンだけ。ナビとパンくずが `家計収支` | §0〜§9、§13-7〜8 |
| S2 | 同じ Dataset と期間で `householdSummary().summary.total` と `totalCashflowScreen().summary.total` が `toBe` で一致し、全月で `biz + personal = total`。前年は BR-006 (1 か月でも欠ければ null) | §3.2、§4.5、§12、§13-2 |
| S3 | カテゴリ行を選ぶと詳細パネルと下部バーが同じ月を示し、`current`=期間合計、`monthTotal`=選択月全件の和、`transactions`=最大 5 件プレビュー。カテゴリの `すべて見る` が `/classify?month=YYYY-MM&big=<大項目>` | §5.2、§5.3、§8、§13-3 |
| S4 | `PUT /api/settings/owner-labels` は認証・パスワード変更フェンス・変更系フェンス・入力検証の内側。保存後、家計・設定・明細の名義表示が新しい表示名になる。migration は `CREATE TABLE` のみ | §6.3、§6.4、§11.3、§11.4、§13-5 |
| S5 | 選択月の振替が家計カード内に全件 (抜粋なし) 出て、振替用の循環する `すべて見る` が無く、`ledger.rows` に振替明細が 1 件も無い。対推定は §6.2 の規則、相手が無いものは `相手不明` | §6.2、§13-4 |
| S6 | 既存の総収支・推移・マトリックス・分析ハブのテストが緑のまま、`build:bundle` 直後の `check:js-budget` が予算内 | §13-8 |

### 1.2 期待値の採用

画像の値のうち算術が閉じない欄は spec §10 の**計算値**を期待値にする。純収支の前年差は `−¥80,000 (−9.6%)`、前年よりの文言は `家計の黒字が減少しました。`、住居費 25.2%、その他 31.9%、食費の前年比 +14.3%、主な取引の名義は `子ども`。

### 1.3 持ち越し 4 件と解決担当

| id | 事項 | 担当 | 決定 (§3.3 で確定) |
|---|---|---|---|
| OI-01 | owner_labels の migration 番号 | P05 | `0045_owner_labels.sql`。2026-09-18 に `git fetch origin` した時点では origin/main (`4e3583c`) の最新が `0042_...` で `0043` を採ったが、PR 前に main を取り込んだ 2026-09-19 の時点で main がサブスク (`0043`) と診断 (`0044_diagnosis_action_states.sql`) を使っていたため `0045` へ改番した。新しい表の追加だけなので改番で意味は変わらない |
| OI-02 | 構成比と前年比率の丸め | P04 | core は丸めない比 (0..1) を返す。表示で `×100` を小数 1 桁に四捨五入 (`Math.round(x*1000)/10`)。各行独立で和を 100.0 に寄せない |
| OI-03 | 表示名の文字種 | P04 | 前後空白を除いて 1〜20 文字 (コードポイント数)。空白のみは空扱いで拒否。制御文字 U+0000–U+001F / U+007F は拒否。絵文字・全角空白を含む文字列は許可 (制御文字でないため) |
| OI-04 | 振替の対推定の同点解消 | P04 | 日付差 → 出金側の日付 → 出金側の明細 id → 入金側の明細 id の昇順で貪欲に確定。相手の無い明細は `相手不明` |

---

## 2. 設計決定 (P02)

### 2.1 core `household-summary.ts`

入力は `totalCashflowLedger(...)` の `ledger.rows` に限る。家計画面は独自の選別を持たない。

```ts
householdSummary({
  all, deals, verdicts, exclusions, mfExcludedTxIds,   // totalCashflowScreen と同じ 5 入力
  range,                                               // 期間 (null は呼び出し側で fullRange へ)
  month?,                                              // 選択中の月。既定は range.to
  labels?,                                             // 保存済みの表示名 (部分可)
}): HouseholdSummary
householdCategoryDetail({ ...同じ入力, key, month }): HouseholdCategoryDetail
pairTransfers(txs, ownerOf): TransferRow[]
ownerLabel(owner, saved?) / DEFAULT_OWNER_LABELS / validateOwnerLabels(input)
HOUSEHOLD_CATEGORY_MAP / householdCategoryOf(row) / TRANSFER_PAIR_MAX_DAYS = 3
```

- 期間の切り方は `totalCashflowScreen` の `reportFor` と同じ (`applyPeriod(all, r)` + 期間内の月の freee 取引)。前年も同じ関数で作り直す。
- 台帳行 `TrendSourceRow` に `owner` (`business | spouse | family | unset`) と `date` (`YYYY-MM-DD`) を足す。freee 行は `business`、MF 行は `resolveTx(...).owner ?? 'unset'`。総収支・推移は読まないので数値は変わらない。
- 区分: `side === 'business'` → 事業 (`biz`)、`'household'` → 個人 (`personal`)。
- 月平均の分母は期間内の**記帳済みの月** (`all.months` に含まれる月) の数。年換算は月平均 × 12。
- 率は丸めずに返す (OI-02)。前年値 0 の率は `null`。

出力の各欄は spec §11.1 の JSON と同じ名前・形。

### 2.2 不変条件 (テストで固定)

1. `summary.total` = `totalCashflowScreen(...).summary.total` の `income / expense / balance`。
2. 全月と期間合計で `biz + personal = total` (収入・支出・純収支)。
3. `categories[].current` の和 = `summary.total.expense`。
4. `owners[].current` の和 = `summary.total.income`。
5. `isTransfer === true` の明細は `ledger.rows` に現れない。

### 2.3 API (3 経路)

| 経路 | クエリ / 本文 | 検証 | 応答 |
|---|---|---|---|
| `GET /api/household` | `from` `to` `year` `span` (既存) + `month` | zod の許可リスト (`.strict()`)。`month` は `^\d{4}-(0[1-9]|1[0-2])$` かつ期間内。外れたら 400 | spec §11.1 |
| `GET /api/household/category` | 上記 + `key` (6 区分 enum、必須) | 同上。`key` 欠落・未知は 400 | spec §11.2 |
| `GET /api/settings/owner-labels` | なし | — | `{ labels }` (保存値 + 既定の合成) |
| `PUT /api/settings/owner-labels` | `{ labels: { business, spouse, family, unset } }` | 4 キー必須・未知キー拒否 + `validateOwnerLabels` (core) | 200 `{ labels }` / 400 `{ error: { code: 'invalid_owner_labels', fields } }` |

- 期間パラメータの壊れた値は既存どおり全期間に倒す (`loadScoped`)。400 にするのは新しく足した `month` / `key` と未知のクエリ名だけ。
- `household` と `household/category` は `analyticsRoute` に置く。`owner-labels` は `settingsRoute` に置く。いずれも `/api/*` の `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` → `canonicalMutationFence` の内側。
- 名義の表示名 (`label`) はサーバで `ownerLabel` を適用して返す。

### 2.4 owner_labels 表とガード

```sql
CREATE TABLE IF NOT EXISTS owner_labels (
  user_id    TEXT NOT NULL,
  owner      TEXT NOT NULL CHECK (owner IN ('business', 'spouse', 'family', 'unset')),
  label      TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 20),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, owner)
);
```

- 既存表の行を書き換えない。初期データを入れない (行が無い名義は既定の表示名)。
- `runtimeSchemaGuard` は表ごとではなく**最新 migration 名**で照合する実装 (`EXPECTED_D1_MIGRATION`)。spec §11.4 の「必須表へ追加」はこの定数を `0045_owner_labels.sql` に進めることで満たす。未適用の環境は既存の 503 `schema_unavailable` で止まる。
- 変更系フェンス: `CANONICAL_MUTATION_ROUTES` に `PUT /api/settings/owner-labels` (consumer `owner_labels`) を足す。取込の確定中は 409 `canonical_write_busy`。`owner_labels` は JSON スナップショット (バックアップ / 復元) の対象に**入れない** (入れると復元の形式が変わる。表示名は再入力できる設定であり、会計の正本ではない)。

### 2.5 画面と URL

- 置き場所: `packages/web/src/pages/household/` (`HouseholdPage.tsx` ほか)。`pages/Household.tsx` は新しいページの再輸出だけにし、遅延読み込みの入口 (`AuthenticatedApp.tsx`) を変えない。
- URL クエリ: `seg=all|biz|personal` (既定 `all`、既定値は URL に書かない)、`month=YYYY-MM` (既定は期間の最終月)、`cat=<key>|none` (無ければ前年差最大の区分)。期間は既存の `usePeriod` (localStorage) をそのまま使い、画面で新しい期間状態を持たない。
- 名義の表示名は `useOwnerLabels()` (React Query `['owner-labels']`) で取得し、`ownerLabel()` 1 つを経由して表示する。家計・設定・明細の 3 画面がこのフックを呼ぶ。保存成功で `['owner-labels']` `['household']` と明細・設定の問い合わせを無効化する。

---

## 3. 独立レビュー (P03)

P02 の決定を (a) spec の不変条件、(b) 既存の総収支画面の契約、(c) 認証とフェンスの位置 の 3 点から読み直した指摘。

| # | 観点 | 指摘 | 対応 |
|---|---|---|---|
| R1 | (b) | 不変条件 1 の比較対象を `monthlyTotalCashflow` の和にすると、期間の切り方 (`applyPeriod` + 期間内の freee) が総収支画面とずれうる | **解消**。比較対象は `totalCashflowScreen(all, deals, verdicts, exclusions, range, mfExcludedTxIds).summary.total`。core は同じ `reportFor` 相当で切る |
| R2 | (c) | `PUT /api/settings/owner-labels` がフェンスの外にあると取込の確定と競合する | **解消**。`index.ts` の `/api/*` の 4 段の後にルートを登録し、`CANONICAL_MUTATION_ROUTES` に足す。`import-lifecycle-pure.test.ts` の全経路の突き合わせに加える |
| R3 | (c) | `runtimeSchemaGuard` は表の存在ではなく最新 migration 名を見る | **解消**。`EXPECTED_D1_MIGRATION` を 0045 へ。`deletion-schema.test.ts` の固定名も更新 |
| R4 | (a) | 画像の事業 +¥420,000 / 個人 +¥336,000 は、収入と支出の正本値と同時に成立しない | **解消済み**。フィクスチャは事業の収入 ¥2,275,000 / 支出 ¥1,704,000 / 純収支 +¥571,000、個人の収入 ¥4,205,000 / 支出 ¥4,020,000 / 純収支 +¥185,000 (和 ¥756,000) を正とし、spec §4.5 / §10 / §11.1 へ同期した |
| R5 | (a) | 不変条件 3 は「事業側の支出を `その他` に入れる」ことで初めて閉じる。事業側の MF 明細が `食費` 等の大項目を持っていても家計側の区分に入れない | **解消**。`householdCategoryOf` は `side === 'business'` を先に判定して `other` を返す |
| R6 | (b) | 名義の既定表示名が `事業 / 妻 / 家族 / 未設定` から `本人 / パートナー / 子ども / その他` に変わる。明細画面・エクスポート・グラフの既存テストが旧名を期待している | **解消**。`OWNER_LABEL` の直参照を `ownerLabel()` に置き換える実装と旧参照除去を P05 で完了し、P08 は読取専用の監査にする。CSV エクスポートの名義列も表示名に従う |
| R7 | (c) | 他の利用者の表示名が読めてしまう経路 | **解消**。GET / PUT とも `user_id = c.get('userId')` の条件だけで読み書きし、統合テストで 2 利用者の分離を確かめる |
| R8 | (a) | `month` が期間外のときの挙動 | **解消**。400 `invalid_month`。画面は期間を変えたときに URL の `month` を期間の最終月へ寄せ直す |

全 8 件のうち 7 件解消、R4 は利用者決定 006 に基づく理由付きの決定 (持ち越しなし)。

---

## 4. 失敗するテスト (P04)

置換前の実装で落ちることを確かめてから実装へ進んだテスト。各ファイルの冒頭コメントに「置換前に落ちる理由」を書いている。

| 層 | ファイル | 置換前に落ちる理由 |
|---|---|---|
| core | `packages/core/test/household-summary-contract.test.ts` | `household-summary.ts` が存在しない (import で落ちる)。フィクスチャ一致・不変条件 5 件・持ち越し OI-01〜04 の値を固定 |
| api | `packages/api/test/household.integration.test.ts` | 旧 `/household` は `month` を読まず壊れた値も 200、`/household/category` は 404 |
| api | `packages/api/test/owner-labels.integration.test.ts` | `/settings/owner-labels` と `owner_labels` 表が無い (404 / 表なし) |
| web | `packages/web/src/pages/household/household.dom.test.tsx` | 旧 `Household.tsx` は `seg` / `month` / `cat` を読まず、詳細パネルも下部バーも無い (受入 3・6・7) |
| web | `packages/web/src/classify-household-filter.dom.test.tsx` | 旧仕分け画面は `big` / `hcat` / `transfer` を読まず同じ月の全件を並べ、名義の未設定を固定の「未設定」で出す |

P10 のレビュー後に足したテストは、実装を旧い形へ戻して落ちることを確かめた (変異の内容は §10)。

## 5. 実装 (P05)

| 対象 | 主な変更 |
|---|---|
| core | `household-summary.ts` (集計・詳細・6 区分の対応表・`householdCategoryOfTx`・`householdDetailHref`)、`owner-labels.ts` (既定の表示名・`resolveOwnerLabels`・`validateOwnerLabels`・`OWNER_LABEL_MAX = 20`)。旧 `household()` と `HouseholdData` を削除し、`analysis.ts` / `exports.ts` / `chart-aggregates.ts` / `total-cashflow.ts` の名義表示を `ownerLabel()` へ寄せた |
| DB | `migrations/0045_owner_labels.sql` (新しい表の追加のみ)。`db/schema.ts` に `ownerLabels`、`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を 0045 へ |
| api | `routes/analytics.ts` の `GET /household` (zod の許可リスト・`invalid_month`) と `GET /household/category`、`routes/settings.ts` の `GET` / `PUT /settings/owner-labels`、`canonical-mutation-fence.ts` へ PUT を登録、`ai/dataset.ts` を新しい集計へ付け替え |
| web | `pages/household/` (ページ・区分表と詳細・名義別・月別系列・view-model・CSS)、`owner-labels.ts` (`useOwnerLabels` / `useSaveOwnerLabels`)、`Classify.tsx` の `big` / `hcat` / `transfer` 対応と名義の表示名、`ClassificationSettings.tsx` / `SplitEditor.tsx` / `VendorMemory.tsx` / `ImportDiff.tsx` の名義表示、`routeMetadata.ts` / `figure-guides.ts` / `glossary.ts` / `guide-sections.ts` の名称を「家計収支」へ |

期間は既存の `usePeriod` (localStorage) が正本 (§2.5)。ブラウザ URL は `seg` / `month` / `cat` だけを持つ。spec §9 / §13-6 も同じ契約へ同期済み。

## 6. 検証 (P06)

P05 で最終コードと旧参照除去を完了した後に実行する。下表は 2026-09-19 の以前の実行記録であり、
今回の契約修正後の受入 PASS 証跡には使わない。最終コードに対する P06 の再実行結果で置き換えるまで**未検証**。

| コマンド | 結果 |
|---|---|
| `pnpm --filter @kanjo/core test` | 49 ファイル / 769 件 合格 (6 件は既存の skip) |
| `pnpm --filter @kanjo/api test` | 49 ファイル / 627 件 合格 |
| `pnpm --filter @kanjo/web test` | 87 ファイル / 714 件 合格 |
| `pnpm typecheck` | 合格 (rc 0) |
| `pnpm lint` | 合格 (rc 0、`security:content` も OK) |

参考にした過去の結果に既知の逸脱が残っていたため、合格件数だけで今回の合否を判定しない。

## 7. 受入の合否 (P07)

### 7.1 受入 S1〜S6 (最終コードの P06 再実行前)

| 受入 | 合否 | 証跡 |
|---|---|---|
| S1 構成要素・空状態・直書き色 0・名称「家計収支」 | 未判定 | 振替のみ・除外行のみの空状態を含む最終 DOM テスト待ち |
| S2 総収支との一致・事業 + 個人 = 全体・欠損規則 | 未判定 | +¥571,000 / +¥185,000 と実装契約の最終テスト待ち |
| S3 `current` / `monthTotal` / 5 件プレビュー・カテゴリ導線 | 未判定 | 三者の意味を分けた契約テスト待ち |
| S4 名義の保存と各画面への反映・migration は追加のみ | 未判定 | P06 の API / web 再検証待ち |
| S5 選択月振替の全件 (抜粋なし)・循環導線なし・合計除外・対推定 | 未判定 | 最終コード後の P06 / P07 で `month`、`totalCount === rows.length`、循環導線なしを再検証する |
| S6 URL / 期間の正本・既存テスト・JS 予算 | 未判定 | URL は `seg` / `month` / `cat`、期間は `usePeriod` / localStorage。全体再検証待ち |

### 7.2 spec §13 の受入 1〜8

P06 の最終再検証後に 1〜8 を判定する。現時点はすべて**未判定**で、過去の合格や一部適合を PASS に繰り上げない。

## 8. 重複・旧参照の読取専用監査 (P08)

実装を変えるリファクタと旧参照除去は P05 の最終コードに統合する。P06 のテスト、P07 の受入判定の後にある P08 はコードを変えず、
それらが残っていないことだけを監査する。監査で不整合を見つけた場合は PASS にせず、P05〜P07 へ戻す。

| 検査 | 結果 |
|---|---|
| `grep -rn "household(" packages --include=*.ts --include=*.tsx` (旧集計の呼び出し) | 0 件 |
| `grep -rn "HouseholdData" packages` | 0 件 |
| `OWNER_LABEL[` の直参照 (表示名の取得関数を経由しない名義表示) | 0 件 |

## 9. 安全と性能 (P09)

| 観点 | 結果 |
|---|---|
| 入力の検証 | `GET /household` と `/household/category` は zod の許可リスト (未知のパラメータ・壊れた `month`・未知の `key` は 400 `invalid_query`、期間外は 400 `invalid_month`) |
| 表示名 | 21 文字・制御文字・空・重複は `fields` 付きの 400 で保存しない。20 文字ちょうどは保存できる (api 統合テスト) |
| 利用者の分離 | 表示名も集計も `user_id` の条件だけで読み書きする。別利用者の 999,999 円が集計に入らないことを完全一致 (250,000 円) で確かめる |
| 変更系フェンス | `PUT /settings/owner-labels` は取込の確定中に 409 `canonical_write_busy` |
| XSS | 家計画面 (`pages/household/`) の `dangerouslySetInnerHTML` は 0 件。明細への URL の大項目は区切り文字 (`& # % + = ?`) だけを符号化する |
| 初期 JS 予算 | `build:bundle` 直後の `check:js-budget` で 102.83KiB / 110KiB (予算内) |
| a11y | 対象のタブは左右キー・Home / End で移る。区分は行内のボタンで選ぶ (Tab / Enter)、選択中は `aria-pressed`。詳細の取得中は `aria-busy`、失敗はパネル内の `role="alert"` と再試行 |

## 10. レビューと対処 (P10)

独立レビュー (blocker 0 / major 4 / minor 8) の指摘と対処。

| # | 指摘 | 対処 | 旧い形へ戻すと落ちるテスト |
|---|---|---|---|
| M1 | 仕分け画面が `big` / `transfer` を読まず、すべて見るの遷移先で絞られない | `big` と `hcat` で絞り、`transfer=1` は振替が一覧に載らない理由と家計収支への戻り先を示す | `classify-household-filter.dom.test.tsx` の big・hcat の 2 件 |
| M2 | 「その他」のすべて見るに絞り込み条件が付かない | `hcat=other`。区分の判定は集計と同じ `householdCategoryOfTx` (事業側の食費は「その他」) | core「明細の 1 行の区分判定は集計と同じ」、web の hcat=other |
| M3 | 仕分け画面の名義が未設定の行が固定の「未設定」 | `ownerLabel('unset')` | web「名義の表示名」(名義の欄だけを見る。選択肢にも表示名が出るため) |
| M4 | 名義の変更が各画面に反映されることのテストが無い | api「名義の表示名の反映」と web「名義の表示名」を追加 | 同上 |
| m1 | 前年の棒が点線でない | 記録のみ。Chart.js の bar は `borderDash` を持たない。前年は同じ色の枠を濃く・塗りを淡くし、凡例の「（前年）」で区別する | — |
| m2 | タブを矢印キーで移動できない | 左右キー・Home / End で移り、選択中のタブだけを `tabIndex=0` にする (WAI-ARIA の tabs) | web「タブは矢印キーと Home / End で移り…」 |
| m3 | 区分の行とボタンの両方で `onSelect` が 2 回呼ばれる | ボタンで `stopPropagation` | web「区分の選択は 1 回だけ伝える」 |
| m4 | すべて見るの大項目を丸ごと符号化していた | 区切り文字だけを符号化 | core「受入3」の `detailHref` |
| m5 | 設定へのリンクが分類ルールの節まで飛ばない | 記録のみ (設定画面に節の錨が無い。設定画面の作り直しは scope 外) | — |
| m6 | AI レポートの名義別グラフが表示名を使わない | 記録のみ。scope_in は反映先を家計・設定・明細の 3 画面に限る。`ownerMonthlyExpense` は表示名を受け取れる形にしてあるので、AI 側で `loadOwnerLabels` を渡せば足りる (後続候補) | — |
| m7 | 別利用者の分離の検査が `< 999_999` で甘い | 完全一致 (250,000) | api「別の利用者の行は集計に入らない」 |
| m8 | 不変条件 1 のテストが判定と除外を空のまま通す | 記録のみ。判定と除外を含む一致は総収支画面の既存テストが持つ。家計側は同じ `totalCashflowScreen` を呼ぶので経路は共有している | — |

scope_out の侵犯: 0 件 (累計収支画面・名義の内部値・相手口座カラム・共通シェル・他画面の中身・永続化 / 新しい依存・専用アプリのいずれにも触れていない)。

## 11. 証跡の索引 (P11)

| 受入 | 証跡のファイル | 再現コマンド |
|---|---|---|
| S1 | `packages/web/src/pages/household/household.dom.test.tsx`、`packages/web/src/common-shell.dom.test.tsx` | `pnpm --filter @kanjo/web test`、`pnpm lint` |
| S2 | `packages/core/test/household-summary-contract.test.ts`、`packages/api/test/household.integration.test.ts` | `pnpm --filter @kanjo/core test`、`pnpm --filter @kanjo/api test` |
| S3 | 同上 + `packages/web/src/classify-household-filter.dom.test.tsx` | 同上 + `pnpm --filter @kanjo/web test` |
| S4 | `packages/api/test/owner-labels.integration.test.ts`、`packages/api/src/deletion-schema.test.ts`、`migrations/0045_owner_labels.sql` | `pnpm --filter @kanjo/api test` |
| S5 | `packages/core/test/household-summary-contract.test.ts`、`docs/data-schema.md` | `pnpm --filter @kanjo/core test` |
| S6 | §6・§9 | `pnpm test && pnpm typecheck && pnpm lint`、`pnpm --filter @kanjo/web build:bundle && pnpm --filter @kanjo/web check:js-budget` |

## 12. docs の同期 (P12)

- `docs/data-schema.md`: 家計収支の集計の節 (家計全体 = 事業 + 個人、前年の欠損規則、振替の対推定と「相手不明」)、6 区分の対応表 (`household-category-map` の印の間)、`owner_labels` 表の定義。対応表は core の `HOUSEHOLD_CATEGORY_MAP` と core テスト「区分と大項目の対応表: docs は core の写し」で突き合わせる (どちらかだけ変えると落ちる)。
- `docs/ui-decisions.md`: 「決定の更新 (2026-09-19 / 家計収支画面)」。
- spec §10 に足すべき行: R4 (事業の支出 ¥1,704,000、事業の純収支 +¥571,000、個人の純収支 +¥185,000 は計算値)。

## 13. 配信 (P13)

**未実施 (保留)**。利用者の指示で commit / push / PR 作成を行っていない。したがって PR の merge と CI の Migrate / Deploy は未確認で、このタスクは閉じない。

配信するときの確認手順:

1. PR を default branch へ merge し、CI の Migrate (0045 の適用) と Deploy が緑であることを確かめる。0045 は新しい表の追加だけなので、既存の行は書き換わらない。
2. 配信先で同じ期間を選び、家計収支画面の家計全体 (総収入・総支出・純収支) と総収支画面の総合が一致することを確かめる。
3. 設定で名義の表示名を変え、家計収支・明細・設定の 3 画面に反映されることを確かめる。
