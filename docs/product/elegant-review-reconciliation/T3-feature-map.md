# T3. 機能分解・実装計画 — 照合作業場の改善

## 最リスク仮説

> 状態と対応必要件数の意味が経路ごとにずれたままでは、画面を整えても利用者は完了を信頼できない。

検証は Slice 0 で行います。`kpi.actionRequiredCount = review + unprocessed` を core の唯一の正本にし、照合ページ=ハブ (同期間)、サイドバー=月次クローズ (全期間) の契約テストを先に通します。

## 縦切り

背骨: 件数を把握する → 対象を選ぶ → 根拠を見る → 判断する → 結果を確認・取消する

| Slice | 画面 | core / API | 検証 |
|---|---|---|---|
| 0 契約骨格 | 5状態と対応不要を表示 | `actionRequiredCount`、全期間照合→期間投影、互換 `reviewCount` | core境界値 + 同一scopeの件数一致 |
| 1 MVP | 3列マスタ詳細、1件/一括操作、Undo | actions / undo、対象外は `target_not_actionable` | 主要ジャーニー DOM + API統合 |
| 2 磨き | 下段 `mfOnly` / `reviewRows` プレビュー、6状態、モバイル情報削減 | `unmatchedFreee` は未使用契約として保持 | 375/768/1024/1280/1600px、空/読込/部分/失敗/低速 |

`unmatchedFreee` の削除は Slice 2 に滑り込ませず、後方互換を調べる別カードにします。

## 依存とリスク

- 最優先: `actionRequiredCount` の二重計算を残さない。web は足し算しない。
- 月境界: 期間で先に切ると ±3 日候補が壊れるため、全期間照合を先に固定する。
- 公開安全性: 実取引・実金額・利用者固有件数を docs / test fixture に入れない。
- UX: モバイルで情報を減らしても状態、主要操作、Undo は残す。

## Definition of Done

- [x] 5状態、MFのみ対応不要、下段の意味が仕様正本と実装で一致する
- [x] 全利用箇所が `kpi.actionRequiredCount` を使い、同じ投影scopeで一致する。`reviewCount` は互換内訳に限定される
- [x] 全期間照合→期間投影と月境界を契約テストが固定する
- [x] 3列マスタ詳細と6状態が DOM / 描画検査を通る
- [x] 主要操作・一括・Undo・対象外エラーが API / DOM テストを通る
- [x] `pnpm typecheck`、関連テスト、`pnpm lint` が成功する
- [x] 公開文書の機微データ検査が成功する

## 変更ログ

| 日付 | 変更 | Slice |
|---|---|---|
| 2026-09-16 | 5状態とMFのみ対応不要を正本化 | 0 |
| 2026-09-16 | `actionRequiredCount` と全期間照合→期間投影を一本化 | 0 |
| 2026-09-16 | 下段右を `reviewRows` のプレビュー、`unmatchedFreee` を未使用契約として分離 | 2 |
