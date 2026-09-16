# 照合画面 要件ベースライン (SYS-RECON-P01)

- 対象 feature: `feat-reconciliation`
- 正本: `system-spec/00-requirements-definition.md` (system-spec-harness v0.1.14)。入口は `specs/spec-reconciliation.md`
- 本書の役割: 実装着手時点の要件を固定した履歴である。現行の状態・件数・期間投影・下段プレビューは [`specs/spec-reconciliation.md`](../../specs/spec-reconciliation.md#状態件数投影の正本) だけを参照し、本書の旧表現を規範として使わない。
- 画面設計: `design/FINAL-UI/images/04-reconciliation.png`

## 1. 目的と成功状態

帳簿 (freee の仕訳) と口座 (MoneyForward の取引) の差異を「どこから解消するか」判断し、確認・照合・別取引・除外・元に戻すまでを 1 画面で終えられるようにする。照合の完了は月次クローズ進捗に反映する。

| ID | 成功状態 (要約) | 検査系統 |
|---|---|---|
| S1 (G1) | 04-reconciliation.png の構成要素がすべて描画され、色はトークン経由で直書き色 lint 0 件 | DOM・描画検査・lint |
| S2 (G2) | 現行の意味は仕様正本を参照。同じ投影scopeの `actionRequiredCount` 一致を検査 | core・API 統合 |
| S3 (G3) | 照合 / 別取引 / 除外 / 一括の結果が再読込後も残り、元に戻すで操作前へ戻る | API 統合・DOM |
| S4 (G4) | サイドバー文言と件数バッジ、月次クローズ 3/4、ヘッダー、フッターが画像どおり | shell 系 DOM |
| S5 (G5) | 画像のアイコンがすべて表示され、図形の重複検査が緑 | route-icon-distinct |
| S6 (G1-G5) | test / typecheck / lint と web の check 系が緑、狭幅で縦積み・横スクロールなし | CI・描画検査 |

## 2. 機能要件 (FR-001..FR-007)

| ID | 要件 | 判定 |
|---|---|---|
| FR-001 | 3 カラム、KPI 4 枚、下段 `mfOnly` / `reviewRows` プレビュー、選択中バー | DOM テスト |
| FR-002 | 検索・絞り込み・キュー選択・ページ送り (10/20/50)・リセット | DOM テスト |
| FR-003 | core の照合判定 (一致度・理由・ステータス・キュー 4 分類・KPI)。支出投影とハブが判断と除外を反映 | core 境界値テスト・件数一致の統合テスト |
| FR-004 | 照合 API・MF 除外・操作履歴を migration 付きで追加し、web から照合 / 別取引 / 除外 / 一括 / 取消 | API 統合テスト (201 件で 400・部分成功・取消) |
| FR-005 | サイドバー文言とグループ・件数バッジ・月次クローズ 3/4・ヘッダー・フッター・改善を送る | shell 系 DOM テスト・月次レビュー API テスト |
| FR-006 | 画像のアイコン一覧を docs に書き、不足分を lucide-static 由来で登録 | docs の表と登録名の一致テスト・重複検査 |
| FR-007 | 規則を docs に書き、`docs/data-schema.md` の古い候補条件を直して境界値テストで固定 | 規則を変えると core テストが落ちる |

## 3. ビジネスルール (BR-001..BR-009)

| ID | 規則 (要約) |
|---|---|
| BR-001 | 一致度 = 金額一致 50 + 日付 (同日 30 / 1 日 20 / 2 日 10 / 3 日 5) + 内容類似×20 |
| BR-002 | 内容類似は NFKC・空白除去・小文字化した文字 bigram の Dice 係数。0.5 以上で「内容が類似」。カナと英字の表記違いは 0 になる |
| BR-003 | 金額の差異 = ±3 日・内容類似 0.5 以上・金額不一致。日付の近い取引 = 金額一致で日付差 1〜3 日 |
| BR-004〜006 | 5 状態、解消率、`actionRequiredCount`、全期間クローズ判定は仕様正本の「状態・件数・投影の正本」を参照 |
| BR-007 | 判断は `duplicate_verdicts` を総収支と共用し、`bindDuplicateVerdicts` で結び直す |
| BR-008 | 元に戻すは直前の操作 1 件 (一括は一括単位) だけ。取消済みは再取消不可 |
| BR-009 | 一括は最大 200 件で件ごとの成否を返す |

## 4. 受入条件 (AC-001..AC-006)

| ID | 対応 | 担当テスト・検査 |
|---|---|---|
| AC-001 | S1 | `packages/web/src/reconciliation.dom.test.tsx`、`check:financial-routes`、`pnpm lint` (check-design-tokens) |
| AC-002 | S2 | `packages/core/test/reconciliation.test.ts`、`packages/api/test/reconciliation.integration.test.ts` |
| AC-003 | S3 | `packages/api/test/reconciliation.integration.test.ts`、`reconciliation.dom.test.tsx` の操作節 |
| AC-004 | S4 | `packages/web/src/common-shell.dom.test.tsx`、`navigation-ux.dom.test.tsx`、analysis 系 DOM テスト |
| AC-005 | S5 | `packages/web/src/route-icon-distinct.test.tsx` |
| AC-006 | S6 | `pnpm test` / `pnpm typecheck` / `pnpm lint`、`check:mobile-layout`、`check:financial-routes`、`check:js-budget` |

## 5. 未決事項 7 件と確定先

値は本書で決めず、どの task の契約テストで固定するかだけを記録する。確定した値は `architecture-decision.md` §5 に記録した。

| # | 未決事項 | 確定先 task | 固定するテスト |
|---|---|---|---|
| U1 | 一致度の端数の丸め規則 | P04 → P05 | core `一致度は Math.round で整数にする` |
| U2 | Dice の重複 bigram の数え方 (多重集合か集合か) | P04 → P05 | core `重複 bigram は多重集合で数える` |
| U3 | 0.5 ちょうどの比較方法 (浮動小数の誤差) | P04 → P05 | core `0.5 ちょうどは類似に含める` |
| U4 | しきい値 0.5 の本文反映 | P05 / P12 | `docs/data-schema.md` と `docs/reconciliation.md` |
| U5 | 月次レビュー API の Method/Path・応答形 | P04 → P05 | API `PUT は 200 と reviewedAt、DELETE は 204` |
| U6 | 取消済み操作の再取消時の status/code、POST actions の成功 status と逐語フィールド名 | P04 → P05 | API `最新でない操作は 409、最新は 200 で書き戻し、再取消は 409` ほか |
| U7 | 解決済み。5 状態と `reconciliationReport` は仕様正本を参照 | P05 | core `照合の行と状態` |

## 6. 確定意思決定 (13 件の実装への帰結)

| ID | 採択 | 実装への帰結 |
|---|---|---|
| qa-reconciliation-decision-001 | 共通シェルも今回直す | Layout・MonthlyCloseProgress・ヘッダー・フッターを変更範囲に含める |
| qa-reconciliation-decision-002 | 既存表を再利用し拡張 | `duplicate_verdicts` / `freee_deal_exclusions` を共用し、`mf_tx_exclusions` と `reconciliation_actions` を追加 |
| qa-reconciliation-decision-003 | 単純な加点規則を core に置く | `matchScore` |
| qa-reconciliation-decision-004 | 文言もバッジも画像に揃える | `routeMetadata.ts` のラベル・グループ変更と件数バッジ |
| qa-reconciliation-decision-005 | 3 つ自動+レビュー手動 | 照合ステップは core が導出した全期間の `actionRequiredCount` だけを受け取る |
| qa-backend-web-rc-decision-007 | 照合専用 API を新設 | `routes/reconciliation.ts` の 3 本。既存 API は残す |
| qa-database-web-rc-decision-008 | 直前 1 件+履歴 90 日 | `reconciliation_actions`、取消は最新かつ未取消のみ |
| qa-security-web-rc-decision-009 | 書込系を fence 対象に | `CANONICAL_MUTATION_ROUTES` に照合 2 本と総収支 3 本を追加 |
| qa-backend-web-rc-decision-010 | 除外は分母外、分母 0 は対象なし | `resolutionRate: null` |
| qa-backend-web-rc-decision-011 | 文字 bigram の Dice | `contentSimilarity` |
| qa-backend-web-rc-decision-012 | 表記違いが 0 になる限界を docs に明記 | `docs/data-schema.md` と `docs/reconciliation.md` |
| qa-backend-web-rc-decision-013 | しきい値 0.5 以上・内容点は連続値 | `CONTENT_SIMILARITY_THRESHOLD`・`contentIsSimilar` |
| qa-ui-ux-web-rc-decision-006 | 一覧+詳細が主役、狭幅は縦積み | `reconciliation.css` の 1099px / 639px の縦積み規則 |

## 7. スコープ外

- 総収支・マトリクス・推移・診断タブの中身の作り直し (ラベルと共通シェルの追随だけ行う)
- データ取込・明細仕分け・サブスクなど他画面の中身 (件数バッジと導線リンクだけ)
- freee / MoneyForward への書き戻し、外部送信
- 利用規約・プライバシー・データ出典の本文の新規作成 (既存内容へのリンク配置だけ)
- 専用アプリ
