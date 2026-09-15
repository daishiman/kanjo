# 概況画面 要件ベースライン (SYS-OVERVIEW-P01)

- 対象 feature: `feat-overview-screen`
- 正本: `system-spec/00-requirements-definition.md` (system-spec-harness v0.1.14)。入口は `specs/spec-overview-screen.md`
- 本書の役割: 実装着手時点の要件を固定した履歴である。現在の表示順と O4/AC-005 は `system-spec/ui-ux.md#表示順の正本` と `specs/spec-overview-screen.md` を参照し、本書の転記より優先する。

## 1. 目的と目標

利用者 (単独の個人事業主) が月初に概況を開き、「今月いくら残ったか」と「次に何を直すか」を 1 画面で掴めるようにする (画面設計: `design/FINAL-UI/images/02-overview.png`)。

| ID | 目標 | 測定基準 (要約) |
|---|---|---|
| O1 | KPI・推移・年次比較・内訳の 4 要素の総額差が 0 | core 単体テスト |
| O2 | 未処理件数がバッジ・カード・アクションバーで一致 | DOM テスト (保留で同時に減る・期間切替で不変) と core 単体テスト (指紋) |
| O3 | 保留と月次レビューがバックアップ→復元で保たれる | API テスト |
| O4 | 概況の描画検査が 8 幅で通る | `check-financial-visuals.mjs` |
| O5 | 信頼度が決定論で、根拠が無ければ推奨なし | core 単体テスト |

## 2. 機能要件 (FR-001..FR-007)

| ID | 要件 | 判定 |
|---|---|---|
| FR-001 | core の純関数で、選択範囲 (総合/事業/家計) の同じ月別系列から KPI・推移・年次比較・支出内訳 (上位 5 + その他) を作る。総合は totalCashflowReport、事業は freee、家計は MF 家計側 | 4 要素の総額差 0 の core テスト |
| FR-002 | 照合確認 (totalCashflowReport の review)・仕分け確認 (clsSrc=既定)・取込確認 (import_runs.status=failed) を全期間で数えて 1 つのキューにする。順は 照合→仕分け→取込、同種別内は金額の絶対値の降順、同額は日付の新しい順 | DOM テストで 3 か所一致・期間で不変 |
| FR-003 | 「後で確認」を内容指紋 (金額・日付・内容) と共に D1 に保存し件数から除く。指紋不一致で無効、解除で消える。月境界で自動解除しない | core テスト (指紋変更で再計上)・DOM テスト |
| FR-004 | 月次クローズ 4 ステップ (データ取込・仕分け 0・照合 0・月次レビュー行あり) をデータから判定する。保留中の明細はステップ判定では未完了 | core 判定表テスト・API 往復テスト |
| FR-005 | 信頼度を vendor_memory (百分率と「過去 N 件中 M 件」) → ルール (百分率なし) → MF中項目「事業」始まり (事業区分のみ) → 推奨なし の順で決める。乱数・時刻・外部送信なし | core 決定論テスト |
| FR-006 | 02 のレイアウトを共通シェル・トークン・共通部品で描く。防衛予測は caution/warn だけ KPI の上に role=alert。移動平均は推移の切替、パレートは内訳の構成比、未決済と科目別年比較は「詳しく見る」(details、初期は閉じる) | 描画検査 8 幅 exit 0 |
| FR-007 | サイドバーの概況にバッジ。バッジ・右パネル・固定アクションバーは components/ の共通部品。ロック中は取得しない | DOM テスト |

## 3. 受入条件 (AC-001..AC-007)

| ID | 条件 | 検査系統 | 担当テスト |
|---|---|---|---|
| AC-001 | 同一 fixture で 4 要素の総額差が 0 | core | `packages/core/test/overview-close-status.test.ts` |
| AC-002 | バッジ・カード・アクションバーの件数一致、「後で確認」で同時に減る、期間 1年→3年で不変 | DOM | `packages/web/src/overview-review-queue.dom.test.tsx` |
| AC-003 | 内容指紋が変わった明細が再び未処理に数えられる | core | `packages/core/test/overview-close-status.test.ts` |
| AC-004 | 保留と月次レビューがバックアップ→全消去→復元で保たれ、4 ステップが判定表どおり | API + core | `packages/api/src/overview.test.ts` ほか |
| AC-005 | Overview を 8 幅で描画して exit 0 | 描画 | `pnpm --filter @kanjo/web run check:financial-routes` |
| AC-006 | 同じ入力から同じ信頼度、根拠なしは推奨なし | core | `packages/core/test/overview-close-status.test.ts` |
| AC-007 | 上記と既存の test / typecheck / lint、初期 JS 予算、CSP 差分検査が緑 | CI | P06 / P09 |

## 4. 確定意思決定 (4 件)

| ID | 採択 | 実装への帰結 |
|---|---|---|
| dec-overview-aggregation-scope | 総合を既定に事業/家計へ切替 | `scope` は 4 要素だけに効き、未処理キューには効かない |
| dec-overview-legacy-elements | 畳んで残す | 防衛予測=警告時のみ、移動平均=推移の切替、パレート=構成比、未決済と科目別年比較=「詳しく見る」 |
| dec-recommendation-confidence-source | 既存の分類資産を統合 | vendor_memory → ルール → MF中項目 → 推奨なし |
| dec-review-state-storage | D1 に保存 | `review_snoozes` / `monthly_close_reviews` を migration 0040 で CREATE し、バックアップ・復元の対象にする |

## 5. 未決事項 2 件の着手時確認 (2026-09-15)

| ID | 内容 | 確認結果 | 状態 |
|---|---|---|---|
| low-u4-measure-numbering | U4 の measure と C/SH 番号の具体化が利用者確認を経ていない | 正本 U4 の O1..O5 の測定基準は、それぞれ検査系統 (core / DOM / API / 描画) と対象ファイルまで具体化されている (本書 §1・§3)。C1 (既存構成)・SH1 (利用者)・SH2 (保守エージェント) の番号は正本 U6/U7 の記載どおりに参照し、本 feature で番号を新設・変更しない。実装はこの番号体系で追跡し、利用者向け報告にも同じ番号を使う | 確認済み (番号体系を変更せずに採用) |
| low-reference-recheck | w3c-csp3 と whatwg-web-storage を plan 着手時に再照合する | `system-spec/fetched-references.json` の両 entry (retrieved_at 2026-09-14) を照合した。w3c-csp3 は connect-src をスクリプト発の接続に適用する規定で、本 feature は外部送信を追加しないため既存の `connect-src 'self'` (packages/api/src/index.test.ts の CSP 差分検査) で足りる。whatwg-web-storage は保存先比較の根拠で、採択は D1 保存 (dec-review-state-storage) のため Web Storage に状態を置かない。どちらも本 feature の設計判断を変える差分は無い | 確認済み (設計変更なし) |

## 6. スコープ外

- 専用アプリ、AI/LLM による推定、分類アルゴリズムの変更、概況以外の画面の作り替え
- `GET /api/summary` の応答形の変更 (互換維持)
