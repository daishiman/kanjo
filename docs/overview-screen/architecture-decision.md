# 概況画面 アーキテクチャ決定記録 (SYS-OVERVIEW-P02)

- 対象 feature: `feat-overview-screen`
- 入力: `specs/spec-overview-screen.md` (API契約節・データモデル節)、`architecture/overview-screen-{backend,database,auth}.md`、`docs/overview-screen/requirements-baseline.md`
- 役割: spec が「推定・plan で確定」とした API パス・クエリ・応答形・エラー形・列定義を、実装 (P05) が参照する確定値として固定する。

## 1. 共通方針

| 項目 | 決定 | 根拠 |
|---|---|---|
| 配置 | 4 エンドポイントとも `packages/api/src/routes/analytics.ts` の `analyticsRoute` に置き、`/api` に mount する | P05 write scope。既存 `/api/summary` と同じ `loadScoped` を共有する |
| 認証・適用順 | `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` → `canonicalMutationFence` → route (index.ts の既存順をそのまま通す) | spec 認証・認可節。新規 middleware は足さない |
| 集計の責務 | 集計・順序付け・判定・入力検証はすべて `@kanjo/core` の純関数。route は D1 読み出しと整形のみ | BR-001・BR-007、arch-overview-backend |
| エラー本文 | `{ "error": { "code": string, "message": string } }` | spec Error contract の提案を採用 |
| キャッシュ | HTTP キャッシュなし。web は React Query (`['overview', scope, periodKey]` と `['review-queue']`) | spec キャッシュ節 |
| 外部送信 | なし。CSP `connect-src 'self'` を変えない | security 節 |

エラーコード:

| HTTP | code | 発生源 |
|---|---|---|
| 400 | `invalid_scope` / `invalid_kind` / `invalid_item_key` / `invalid_month` | route が core の validator で判定 |
| 401 | 既存 authGuard の形 | authGuard |
| 404 | `review_item_not_found` | PUT snooze で、対象の明細が現在の未処理キューに無い (指紋を計算できない) |
| 409 | `canonical_write_busy` | canonicalMutationFence (既存形) |
| 503 | 既存 runtimeSchemaGuard の形 | runtimeSchemaGuard |

404 は spec の taxonomy に無いが、PUT のサーバ側指紋計算 (後述) に「指紋の元になる明細が無い」場合が必ず生じるため追加する。誤って消えた明細を保留できないことは利用者の損失にならない (キューに出ていないため)。

## 2. GET /api/overview

Request: `?scope=total|business|household` (省略時 `total`) と既存の期間指定 `from`/`to`/`year`/`span` (`loadScoped` と同じ解決。壊れた期間指定は既存どおり全期間に倒す)。scope の未知値は 400 `invalid_scope` (期間と違い、画面の既定が明確なので黙って倒さない。analytics-period.test の scope 検証を期間解決と分離する)。

Response `OverviewResponse`:

```ts
{
  scope: 'total' | 'business' | 'household';
  kpi: { income: number; expense: number; balance: number; months: number };
  trend: { month: string; income: number; expense: number; balance: number }[];
  yearComparison: {
    rows: { key: 'income' | 'expense' | 'balance'; label: string;
            current: number; previous: number | null; delta: number | null; deltaRate: number | null }[];
    currentLabel: string; previousLabel: string | null;
  };
  breakdown: { items: { label: string; amount: number; share: number }[]; total: number };
  closeStatus: {
    month: string | null;
    steps: { key: 'import' | 'classification' | 'reconciliation' | 'review'; label: string; done: boolean; count: number | null }[];
    doneCount: number; total: 4;
    reviewedAt: string | null;
  };
  dataUpdatedAt: string | null;
  defenseForecast: { level: 'none' | 'nodata' | 'caution' | 'warn'; reason: string; /* 既存 forecast の表示用項目 */ };
  period: PeriodMeta;
}
```

- 系列の出典 (FR-001): total = `totalCashflowReport(all, deals, verdicts, exclusions).months`、business = `data.biz` (freee)、household = `data.personal` (MF 家計側)。系列は全期間 (`all`) から作り、期間は「表示する月の集合」として core に渡す。前年比の比較窓が期間の外に出ても欠けないようにするためである。
- 集計窓: `kpi`・`yearComparison.current`・`breakdown` は期間内の直近 12 か月 (期間が 12 か月未満ならその月数)、`previous` はその直前の同じ月数。`trend` は期間内の全月。4 要素は同じ `ScopeMonth[]` から出し、`kpi.expense === yearComparison(expense).current === breakdown.total` を core テストで固定する (AC-001)。
- 内訳: 支出を科目で集計し金額降順の上位 5 件 + 「その他」。`share` は `amount / total` (total=0 なら 0)。total は KPI と同じ消し込み・要確認・除外済み取引集合から科目別に投影し、同名科目を混ぜないよう `事業 / 科目`・`家計 / 大項目` のラベルで区別する。
- `defenseForecast.level`: 既存 core の `'watch'` を API 境界で `'caution'` に写す。core の型は変えない (他画面の互換)。
- `dataUpdatedAt`: `imports` の `status='committed'` の最大 `committed_at`。無ければ null。
- `closeStatus` は scope にも期間にも依存しない (BR-002・BR-003)。

## 3. GET /api/review-queue

Request: クエリなし (期間を受け取らない。BR-002)。

Response `ReviewQueueResponse`:

```ts
{
  total: number;                       // 保留を除いた件数
  counts: { reconciliation: number; classification: number; import: number };
  snoozedCount: number;
  items: {
    kind: 'reconciliation' | 'classification' | 'import';
    itemKey: string;
    amount: number;                    // 符号付き (取込は 0)
    date: string;                      // YYYY-MM-DD
    month: string;                     // YYYY-MM (画面側の期間絞り込み用)
    content: string;
    recommendation: string | null;     // 推奨の区分/科目
    basis: 'vendor_memory' | 'rule' | 'mf_mid' | 'none';
    basisLabel: string;                // 「過去 N 件中 M 件」等
    confidence: number | null;         // 0..100 の整数。vendor_memory のときだけ
  }[];
}
```

キューの材料 (全期間):

| kind | 対象 | itemKey | 指紋の元 (amount / date / content) |
|---|---|---|---|
| reconciliation | `totalCashflowReport(...).review` | `mfTxId` | 符号付き MF 金額 / `mf.date` / `mf.content` |
| classification | `countableMfTxs(data.mfTx)` を `resolveTx` した結果の `clsSrc === '既定'` (照合キューに出た明細は除く) | MF `tx.id` | `a` / 月+表示日 / `c` |
| import | `import_runs.status = 'failed'` | `import_runs.id` | 0 / `created_at` の日付 / `failure_reason` |

- 取込キューの出典は spec どおり `import_runs` とする。`imports` 行は 1 run に複数あり、履歴の破棄 (`import-history-discard.ts`) は run 単位で `import_runs` 行ごと消すため、run 単位で数えると破棄と同時にキューから消えて件数がずれない。
- 順序 (FR-002): kind 順 reconciliation → classification → import、同 kind 内は `|amount|` 降順、同額は `date` 降順、最後に `itemKey` 昇順 (決定論のため)。
- 推奨 (FR-005): vendor_memory (`normalizeVendorKey(content)` 一致・revoked でない) → rules (`ruleMatches`) → MF中項目が「事業」始まり (区分「事業」のみ) → 推奨なし。取込は常に推奨なし。

## 4. PUT/DELETE /api/review-queue/snoozes/:kind/:itemKey

- パス: `kind` は 3 値、`itemKey` は URL デコード後 1..200 文字 (`REVIEW_ITEM_KEY_MAX`)。違反は 400。
- PUT: body なし。サーバが現在の未処理キューから該当明細を探し指紋を計算して UPSERT (`snoozed_at` は再計算時刻で更新)。該当なしは 404 `review_item_not_found`。成功は `200 { kind, itemKey, snoozedAt }`。同じ PUT を重ねても行は 1 行 (冪等)。
- DELETE: 行が無くても `204` (冪等)。
- 指紋: `sha256Hex(canonicalEncode([amount, date, content]))` の 64 桁 16 進。**明細本文をそのまま保存しない** (spec セキュリティ確認「新テーブルに明細本文の写しを持たない」)。`canonicalEncode` は型+長さで符号化するため区切り文字を含む内容でも衝突しない。
- 有効性 (FR-003): GET 時に現在の明細から指紋を計算し、保存値と一致する保留だけを件数から除く。不一致の行は削除せず無視する (GET に副作用を持たせない)。月境界での自動解除はしない。

## 5. PUT/DELETE /api/monthly-close/:month/review

- `month` は `^\d{4}-(0[1-9]|1[0-2])$`。違反は 400 `invalid_month`。
- PUT: UPSERT。`reviewed_at` は現在時刻、`reviewed_by_user_id` はログイン中の利用者 (`c.get('actor').id`)。`c.get('userId')` はテナントの鍵 (`'default'`) で、誰がレビューしたかを表さない (P10 指摘 F3 で是正)。既存行があれば初回の値を保つ (冪等: 重ねても同じ結果)。`200 { month, reviewedAt }`。
- DELETE: 行が無くても `204`。
- 月次クローズ判定 (FR-004・BR-005): 対象月 = データの最終月。
  1. データ取込: 確定済みの取込 (`imports.status='committed'`) が 1 件以上あり、対象月が `data.months` に在り、`unrecordedExpMonths` に含まれない (P10 指摘 F6 で是正)。
  2. 仕分け: classification の件数 (保留を含む全件) が 0。
  3. 照合: reconciliation の件数 (保留を含む全件) が 0。
  4. 月次レビュー: `monthly_close_reviews` に対象月の行がある。

## 6. データモデル (migration 0040、CREATE のみ)

```sql
CREATE TABLE IF NOT EXISTS review_snoozes (
  user_id TEXT NOT NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('classification','reconciliation','import')),
  item_key TEXT NOT NULL CHECK (length(item_key) BETWEEN 1 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  snoozed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_kind, item_key)
);
CREATE TABLE IF NOT EXISTS monthly_close_reviews (
  user_id TEXT NOT NULL,
  month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(month,6,2) BETWEEN '01' AND '12'),
  reviewed_at TEXT NOT NULL,
  reviewed_by_user_id TEXT NOT NULL,
  PRIMARY KEY (user_id, month)
);
```

- 主キーが利用者単位の一意性と参照経路を兼ねるので追加 INDEX は持たない。
- 同時更新が必要な箇所: `EXPECTED_D1_MIGRATION` (schema-guard.ts)、drizzle `schema.ts`、バックアップ (`BACKUP_SNAPSHOT_SQL` の source 数と `loadBackupPayload`)、復元 (payload key `reviewSnoozes` / `monthlyCloseReviews`。**key が無い旧バックアップでは既存行に触れない**)、`CANONICAL_MUTATION_ROUTES` と JSON snapshot consumer、削除スキーマ検査。
- 明細の削除・全件初期化 (`deletion-lifecycle` / `deletion-full-reset`) の対象には加えない。両テーブルは vendor_memory・sub_vendor_exclusions と同じ「利用者の判断の記録」で明細そのものではなく、明細が消えれば保留は指紋を計算できずに件数へ影響しなくなる (無害に残る)。全件初期化の取り消し (undo) の tombstone 形も増やさない。
- 復元の write-set 指紋 (`restoreWriteSetFingerprint`) に両テーブルの行を含める。含めないと「記帳は同じで保留だけ違う」バックアップが重複 (duplicate) と判定され、復元がスキップされる。
- 復元の併合規則: バックアップに key があればその集合で置き換える (JSON 復元は初期移行・巻き戻しの用途で、バックアップ時点の判断を正とする)。key が無ければ現在の行を保つ。

## 7. 決定の帰結とスコープ外

- `GET /api/summary` の応答形は変えない。概況画面は新 API に移るが、他の利用箇所 (Layout の防衛ライン等) は summary を使い続けてよい。
- 分類アルゴリズム (`resolveTx`・vendor memory の判定) は読むだけで変えない。
