---
graph_node_id: "tasks-tax-preparation"
artifact_kind: "task"
title: "確定申告の準備と証憑の取得先 — タスク分解"
project_id: "kanjo"
domain: "accounting-records"
status: "complete"
file_path: "tasks/tax-preparation-tasks.md"
parent_feature: "spec-tax-preparation"
template_id: "task"
template_version: "1.0.1"
---

# タスク分解

`specs/tax-preparation.md` を実装単位に割ったもの。上から順に依存する。
Slice区分は `docs/product/elegant-review-tax-preparation/T3-feature-map.md` に対応する。

## Slice 0 — 境界（core純関数）

### T01 コア — 対象年と決算書科目の境界

- 変更: `packages/core/src/tax-return.ts`, `packages/core/src/index.ts`
- 内容: `TaxYear`(2000..2099)、`TAX_FORM_PRINTED_ACCOUNTS` / `TAX_FORM_SEPARATE_ACCOUNTS` /
  `TAX_FORM_REVENUE_ACCOUNTS` / `TAX_FORM_NON_EXPENSE_ACCOUNTS`、`TaxAccountSetting`、
  `apportion`(切り捨て)、`defaultTaxAccountFor`(同名のみ・推測しない)、`resolveTaxAccountSettings`。
- 受入: TI-2 / TI-3 / TI-4 / TI-10。`apportion(999, 30) === 299`、`defaultTaxAccountFor('サブスク・通信') === null`。
- 証拠: `packages/core/test/tax-return-contract.test.ts`
- 依存: なし

### T02 コア — 転記シートと準備チェック

- 変更: `packages/core/src/tax-return.ts`
- 内容: `taxReturnStatement`(印字欄=決算書の並び、空欄行=金額順、未割当は残す)、
  `taxReturnReadiness` / `taxReadinessVerdict`、`TAX_STATEMENT_EXPORT_HEADER` / `taxStatementExportRows`。
- 受入: 収入科目・事業主貸が経費計へ入らない。専従者給与が経費計と分かれる。
  完了以外の全チェックが次の行動を持つ。
- 証拠: `packages/core/test/tax-return-contract.test.ts`
- 依存: T01

### T03 コア — 証憑棚卸しと緊急度

- 変更: `packages/core/src/receipts.ts`
- 内容: `receiptInventory`(MF分割を親targetへ正規化、事業現金を合流)、`receiptGapReport`、
  `receiptGapUrgency` と `RECEIPT_MINOR_AMOUNT` / `RECEIPT_MAJOR_AMOUNT`、
  索引CSV(`RECEIPT_INDEX_HEADER`)・ファイル名・READMEの生成。
- 受入: TI-9。`minAmount` は一覧の絞り込みだけで、添付率と未添付合計は期間全体のまま。
  緊急度は支払手段と金額の帯だけで決まり、科目名に依存しない。
- 証拠: `packages/core/test/receipts-contract.test.ts`
- 依存: なし

### T04 コア — 依存ゼロのZIP生成

- 変更: `packages/core/src/zip.ts`
- 内容: `crc32`、`zipLocalHeader`、`zipCentralDirectory`、`buildZip`、`sanitizeZipName`。
  store方式(無圧縮)+ UTF-8ファイル名フラグ(bit 11)。
- 受入: 実ZIPとして展開でき、日本語ファイル名が壊れない。パス区切り・制御文字が名前から除去される。
- 証拠: `packages/core/test/zip-contract.test.ts`, `packages/api/src/tax-receipt-zip.test.ts`(fflateで往復)
- 依存: なし

### T05 コア — 証憑取得先プロフィール

- 変更: `packages/core/src/receipt-source-profile.ts`
- 内容: `profile_key = merchant_key::service_key` の正規化、HTTP/HTTPS以外と認証情報付きURLの拒否、
  表記揺れの継承範囲、曖昧候補の非自動確定。
- 受入: TI-7 / TI-8。秘密値を受け取る型が存在しない。
- 証拠: `packages/core/test/receipt-source-profile-contract.test.ts`
- 依存: なし

## Slice 1 — 縦切り（永続化とAPI）

### T06 スキーマ — 年別科目方針

- 変更: `migrations/0027_tax_account_settings.sql`, `packages/api/src/db/schema.ts`,
  `packages/api/src/schema-guard.ts`
- 受入: 主キーが `user_id + tax_year + account`。`tax_year` は2000..2099。
  `EXPECTED_D1_MIGRATION` が更新されている。
- 依存: T01

### T07 スキーマ — 証憑取得先

- 変更: `migrations/0028_receipt_source_profiles.sql`, `packages/api/src/db/schema.ts`,
  `packages/api/src/schema-guard.ts`
- 受入: `receipt_source_profiles` / `receipt_source_overrides` が作られ、
  password/token相当の列が1つも無い。
- 依存: T05

### T08 API — 申告ルート一式

- 変更: `packages/api/src/routes/tax.ts`, `packages/api/src/index.ts`
- 内容: `GET /tax/overview`、`PUT /tax/accounts`、`GET /tax/receipt-gaps`、
  `PUT /tax/receipt-sources`、`GET /export/tax/statement.csv`、`/export/tax/expenses.csv`、
  `/export/tax/receipts.zip`。
- 受入: TI-1 / TI-5 / TI-6。要対応が残る年で完成物を返さない。
  R2 HEADで原本を確認する。ZIPは400件で分割し、索引と実ファイルが同一集合。
- 証拠: `packages/api/src/tax-route-boundary.test.ts`, `packages/api/src/tax-receipt-zip.test.ts`,
  `packages/api/src/tax-receipt-source.integration.test.ts`
- 依存: T02, T03, T04, T06, T07

### T09 横断契約 — 期間スライスの単一入口

- 変更: `packages/api/src/analytics-period.test.ts`
- 内容: `routes/tax.ts` が `loadDataset` を直接呼ばず `loadScoped` 経由でしか `Dataset` を読まないことを
  ソース検査で固定する。
- 受入: `TAX_SOURCE` に `loadDataset(` が現れない。
- 依存: T08

### T10 永続化 — backup/restoreと lifecycle 接続

- 変更: `packages/api/src/store.ts`, `packages/api/src/routes/settings.ts`,
  `packages/api/src/routes/imports.ts`, `packages/api/src/routes/cash.ts`,
  `packages/api/src/routes/attachments.ts`, `packages/api/src/import-lifecycle.ts`,
  `packages/api/src/import-active.ts`, `packages/api/src/canonical-mutation-fence.ts`
- 内容: 統合JSONへ `taxAccountSettings` / `receiptSourceProfiles` / `receiptSourceOverrides` を追加し、
  利用者内キーでmerge復元する。明細のrename/deleteで取得先が孤立しない。
- 受入: restore後に年別方針・profile・overrideが戻り、秘密値の列が増えていない。
- 証拠: `packages/api/src/import-lifecycle.test.ts`, `packages/api/src/import-lifecycle-pure.test.ts`,
  `packages/api/src/cash-lifecycle.test.ts`, `packages/api/src/index.test.ts`
- 依存: T06, T07

## Slice 2 — 体験（画面）

### T11 UI — 対象年セレクタ（申告専用）

- 変更: `packages/web/src/tax-year.tsx`
- 受入: TI-1。分析用の期間セレクタと独立し、切り替えで全セクションが同じ年に揃う。
- 証拠: `packages/web/src/tax-year.dom.test.tsx`
- 依存: T08

### T12 UI — P16 確定申告の準備

- 変更: `packages/web/src/pages/TaxReturn.tsx`, `packages/web/src/api.ts`,
  `packages/web/src/routeMetadata.ts`, `packages/web/src/App.tsx`, `packages/web/src/styles.css`
- 受入: 判定→KPI→準備チェック→科目設定→転記シート→書き出しの順。要対応が残る間は書き出せず、
  押せない理由が文字で出る。按分100%未満で根拠が空だと保存できない。
- 証拠: `packages/web/src/tax-preparation.dom.test.tsx`, `packages/web/src/display-contract.test.tsx`
- 依存: T11

### T13 UI — P17 領収書の残り

- 変更: `packages/web/src/pages/TaxReceipts.tsx`, `packages/web/src/components/Attachments.tsx`(既存流用)
- 受入: 初期表示が「要対応」。緊急度で絞り込め、スマートフォンのカメラからその場で添付できる。
- 証拠: `packages/web/src/tax-preparation.dom.test.tsx`
- 依存: T11

### T14 UI — ナビ契約の更新（15→17画面）

- 変更: `packages/web/src/routeMetadata.ts`, `packages/web/src/components/Layout.tsx`,
  `packages/web/scripts/check-mobile-layout.mjs`
- 受入: 17ルート・モバイル5タブ。`display-contract.test.tsx` が件数とパス集合を固定する。
- 証拠: `packages/web/src/display-contract.test.tsx`, `packages/web/src/layout-export-menu.dom.test.tsx`
- 依存: T12, T13

## Slice 3 — 追加要望（取得先の継承）

### T15 UI/API — 取得先の設定と継承

- 変更: `packages/web/src/components/ReceiptSourceProfile.tsx`, `packages/api/src/routes/tax.ts`
- 受入: 「今後の同じ取引先に使う」が既定ON。継承元・明細上書き・曖昧候補が文字で分かる。
  他利用者のprofileを参照・更新できない。
- 証拠: `packages/api/src/tax-receipt-source.integration.test.ts`, `packages/web/src/tax-preparation.dom.test.tsx`
- 依存: T08, T13

## Slice 4 — 性能・防御

### T16 性能 — 初期JS予算と申告画面のcold-load

- 変更: `packages/web/vite.config.ts`, `packages/web/scripts/check-initial-js-budget.mjs`,
  `packages/web/package.json`
- 受入: 初期JSが110KiB以下でbuildが失敗しない（超過でbuildを落とす）。
  TaxReturnの直列chunkを除去してLCPを改善する。
- 証拠: `packages/web/src/tax-performance-contract.test.ts`, `pnpm build`
- 依存: T12

### T17 防御 — 共通セキュリティヘッダー

- 変更: `packages/api/src/index.ts`
- 内容: API・Workers Assetsの全レスポンスへ CSP / Permissions-Policy / Referrer-Policy /
  X-Frame-Options を1箇所で付与する。カメラは同一originのみ許可する。
- 受入: 外部originのscript/connect/frameが許可されない。証憑撮影は引き続き動く。
- 証拠: `packages/api/src/index.test.ts`, `pnpm run preview:smoke`
- 依存: なし

## Slice 5 — 文書

### T18 文書 — 正本と詳細仕様の更新

- 変更: `docs/spec-v1.1.md`(FR-11 / P16 / P17 / API表 / §10.1), `docs/data-schema.md`(0027 / 0028),
  `README.md`, `specs/tax-preparation.md`, `tasks/tax-preparation-tasks.md`,
  `features/feat-tax-preparation.md`, `architecture/arch-tax-preparation-boundary.md`
- 受入: 同じ契約が2箇所に書かれていない（詳細は本書、不変条件と導線はspec-v1.1、
  永続形状はdata-schema）。
- 依存: T01..T17

# 受入証拠台帳

| 受入（specs/tax-preparation.md） | 証拠 |
|---|---|
| 年の拒否と表示一致（TI-1） | `tax-route-boundary.test.ts`, `tax-year.dom.test.tsx` |
| 行の不在＝未確認、100%明示（TI-2） | `tax-return-contract.test.ts`, `tax-route-boundary.test.ts` |
| 按分の切り捨て（TI-3） | `tax-return-contract.test.ts` |
| 未割当を雑費へ寄せない（TI-4） | `tax-return-contract.test.ts` |
| R2原本で添付判定（TI-5） | `tax-receipt-zip.test.ts`, `tax-route-boundary.test.ts` |
| 準備チェックが書き出しの最終ゲート（TI-6） | `tax-route-boundary.test.ts` |
| 秘密値を保存しない（TI-7） | `receipt-source-profile-contract.test.ts`, `tax-receipt-source.integration.test.ts` |
| 取得先の正本は取引先単位（TI-8） | `receipt-source-profile-contract.test.ts`, `tax-receipt-source.integration.test.ts` |
| 棚卸しの親正規化（TI-9） | `receipts-contract.test.ts` |
| businessPercentは0..100整数（TI-10） | `tax-return-contract.test.ts`, `tax-preparation.dom.test.tsx` |
| 緊急度は支払手段と金額だけ | `receipts-contract.test.ts` |
| ZIPが実展開でき索引と一致 | `zip-contract.test.ts`, `tax-receipt-zip.test.ts` |
| Datasetの単一入口 | `analytics-period.test.ts` |
| backup/restoreの往復 | `import-lifecycle.test.ts`, `index.test.ts` |
| 17ルート・モバイル5タブ | `display-contract.test.tsx` |
| 初期JS予算 | `check-initial-js-budget.mjs`（`pnpm build` で強制） |
| 共通セキュリティヘッダー | `index.test.ts` |

# 残条件（本番）

`docs/product/elegant-review-tax-preparation/T4-release-readiness.md` の本番No-Go条件を正とする。

1. D1 migration 0027 / 0028 を、コード配信より**先に**手動Migrateワークフロー（`APPLY` 入力）で適用する
2. 依頼者が preview で主要ジャーニーを確認する
3. 本番相当で LCP / INP / CLS、3G、200%拡大を実測する
