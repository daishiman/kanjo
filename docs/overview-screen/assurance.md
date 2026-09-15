# 概況画面 品質保証 (SYS-OVERVIEW-P09)

アクセシビリティ・セキュリティ・性能・運用観測の 4 観点で、実装が仕様と architecture を満たすことを確認した記録です。
検証コマンドの一覧は [`evidence.md`](evidence.md) にまとめています。

## 1. アクセシビリティ

| 観点 | 仕様の要求 | 実装 | 確認方法 | 結果 |
|---|---|---|---|---|
| 件数変化の読み上げ | 件数の変化を role=status で伝える | `ReviewActionBar` の `<output aria-live="polite">` (暗黙の role=status) | DOM テスト (AC-002) | 適合 |
| 防衛ラインの警告 | caution / warn とも role=alert (FR-006) | `DefenseForecastPanel` は両レベルで `role="alert"`。強さは見出しと色で区別 | `defense-forecast.dom.test.tsx` 3 件 | 適合 (P10 F4 で是正) |
| 0 件の表現 | 「未処理 0 件」でなく終わったことが伝わる文言 | `reviewTotalText(0)` = 「未処理なし」 (カードとアクションバー共通) | DOM テスト | 適合 (P10 F7) |
| 選択中の行 | 表の行選択は aria-current で示す | 行内 Button に `aria-current="true"`、`<tr aria-selected>` は除去 | DOM テスト | 適合 (P10 F8) |
| 狭幅ドロワー | APG モーダルダイアログ、閉じたら元へフォーカス | `<dialog>` + showModal。閉じる→行ボタンへ、後で確認→「未処理の内訳」見出しへ | DOM テスト (matchMedia 狭幅) | 適合 (P10 F5) |
| リフロー | 320px で横スクロールなし | Overview 8 幅 (320〜1600px・zoom200) で本体幅 = ビューポート幅 | `check-financial-visuals.mjs` EXIT 0 | 適合 (旧検査)。画像正本の表示順・広幅グリッドは AC-005 の再検証対象 |

## 2. セキュリティ

| 観点 | 確認内容 | 結果 |
|---|---|---|
| 認証 | 追加した 4 経路 (`PUT/DELETE /api/review-queue/snoozes/:kind/:itemKey`、`PUT/DELETE /api/monthly-close/:month/review`) は `/api/*` の authGuard 配下。未認証 401 を API テストで固定 | 適合 |
| 監査列 | `monthly_close_reviews.reviewed_at` と `reviewed_by_user_id` を保存。`reviewed_by_user_id` はテナント鍵 `'default'` ではなく、ログイン中の利用者 `c.get('actor').id` | 適合 (P10 F3 で是正) |
| 平文の非保持 | `review_snoozes.fingerprint` は SHA-256 の 64 桁で `CHECK (length(fingerprint) = 64)`。明細本文の写しを持たない | 適合 |
| 入力検証 | kind / itemKey / month を core validator とルートの双方で検証し、D1 CHECK でも同じ制約 (BR-007) | 適合 |
| 直列化 | PUT/DELETE を `CANONICAL_MUTATION_ROUTES` に追加。取込中は 409 `canonical_write_busy` | 適合 |
| 外部送信 | 新規の fetch 先・外部 SDK なし。`pnpm --filter @kanjo/api exec vitest run src/index.test.ts` の CSP 差分検査 14 件 pass (`connect-src 'self'` 維持) | 適合 |
| テストデータ | fixture とローカル seed は架空の取引先・金額のみ | 適合 |
| 公開文書の機密 | 概況で追加した文書に絶対パス・秘密情報なし。`security:content` の検出は既存文書のみ | 適合 (既存失敗は `test-run.md` §2) |

## 3. 性能

| 観点 | 確認内容 | 結果 |
|---|---|---|
| 初期 JS 予算 | `build:bundle` 直後に `check:js-budget` を実行: 109.63 KiB / 110 KiB | 適合 (余裕 0.37 KiB。次の追加では分割を検討する) |
| API の読み取り | `/api/overview` と `/api/review-queue` は既存 `loadDataset` と付随テーブル数本の読み取りで、N+1 なし | 適合 |
| 再取得の範囲 | 「後で確認」と解除は `['review-queue']` だけを invalidate し、概況本体を再計算しない | 適合 |

## 4. 運用観測

新しいログ出力やメトリクスは追加していません。Worker の既存ログ (エラー応答の構造化ログ) だけで、
件数ずれは [`../runbooks/overview-review-queue-mismatch.md`](../runbooks/overview-review-queue-mismatch.md) の手順で切り分けます。

## 結論

本書の 4 観点では未適合は 0 件です。ただし本書は画像正本への視覚的忠実度を保証しません。全体の受入判定は [`acceptance.md`](acceptance.md) を正とし、現在は AC-005 の再検証と AC-007 の解消が必要です。
