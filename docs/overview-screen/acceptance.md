# 概況画面 受入検証 AC-001..AC-007 (SYS-OVERVIEW-P07)

`specs/spec-overview-screen.md` の受入基準を 1 件ずつ、検証コマンドと結果に対応づけた記録です。
実行記録の全体は [`test-run.md`](test-run.md) にあります。

| AC | 基準 (要約) | 検証コマンド | 検証箇所 | 結果 |
|---|---|---|---|---|
| AC-001 | 同一 fixture で KPI・推移・年次比較・支出内訳の総額差が 0 | `pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts` | `describe('AC-001 4 要素は同じ月別系列から出る')` | 合格 |
| AC-002 | バッジ・カード・アクションバーの件数が一致し、「後で確認」で同時に減り、1年→3年で不変 | `pnpm --filter @kanjo/web exec vitest run src/overview-review-queue.dom.test.tsx` | `describe('未処理件数の 3 か所一致 (AC-002)')` の 10 件 (解除で同時に戻る・0 件で「未処理なし」・狭幅ドロワーのフォーカスを含む) | 合格 |
| AC-003 | 内容指紋が変わった明細は再び未処理に数えられる | `pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts` | `describe('AC-003 内容指紋')` | 合格 |
| AC-004 | 保留と月次レビューがバックアップ→全消去→復元で保たれ、月次クローズ 4 ステップが判定表どおり | `pnpm --filter @kanjo/api exec vitest run src/overview.test.ts` と core の同ファイル | api `describe('AC-004 バックアップ → 全消去 → 復元')` / core `describe('AC-004 月次クローズ 4 ステップの判定表')` | 合格 |
| AC-005 | 画像正本の表示順・広幅グリッドを保ち、Overview を 8 幅で描画して exit 0 | `KANJO_VISUAL_BASE_URL=http://127.0.0.1:<vite port> node packages/web/scripts/check-financial-visuals.mjs` | 表示順、Review 3列、比較/内訳2列、320 / 360 / 375 / 390 / 768 / 1280 / 1600px と zoom200 の横はみ出し | 要再検証。以前の実行は図の存在と横はみ出しだけを検査しており、強化後の AC-005 の証拠にはならない |
| AC-006 | 同じ入力から同じ信頼度、根拠が無い明細は推奨なし | `pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts` | `describe('AC-006 推奨と信頼度は決定論')` | 合格 |
| AC-007 | 上記と既存の test / typecheck / lint、js 予算、CSP 差分検査が緑 | `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm --filter @kanjo/web run build:bundle && pnpm --filter @kanjo/web run check:js-budget` / `pnpm --filter @kanjo/api exec vitest run src/index.test.ts` | パッケージ別テスト・型検査・js 予算 109.63 KiB / 110 KiB・CSP 14 件 | 不合格。`pnpm test` / `pnpm lint` は既知の 3 件で exit 1 (下記) |

## AC-007 の未達理由

`pnpm test` の `check-design-tokens.test.mjs` 1 件、`pnpm lint` の design-system 系検査、
`security:content` の既存文書の絶対パス検出は、概況の変更前から失敗しています (詳細は `test-run.md` §2)。
原因の所在にかかわらず AC-007 は「リポジトリ全体が緑」を要求するため、exit 1 のまま合格扱いにはしません。

## 判定

AC-001..AC-004 と AC-006 は合格、AC-005 は強化した表示順・グリッド検査の再実行待ち、AC-007 は不合格です。したがって全体判定は **未達** です。既存失敗の帰属と受入条件の合否を混同せず、AC-005 の再検証とリポジトリ全体の exit 0 が揃ってから合格へ更新します。
