# Design QA — Focus Ledger 共通シェル

## 比較対象

- source visual truth: `design/FINAL-UI/images/02-overview.png`
- source set: `design/FINAL-UI/images/`（全20ページ）
- implementation: `packages/web/src/components/Layout.tsx` を中心とする既存Webアプリ
- implementation screenshot: なし
- intended state: ログイン済み、概況、通常データあり、デスクトップ
- intended viewport: デスクトップ（正式画像の縦長全体表示）
- source pixels: 971 × 1619 px
- source CSS size / density: 生成画像のため不明
- implementation pixels / CSS size / density: 未取得
- normalization: 未実施。実装スクリーンショットが無いため同一寸法へ正規化できない

## Findings

- [P1] 正式画像と実装の視覚差分を判定できない
  - Location: 共通サイドバー、ヘッダー、フッター、概況画面
  - Evidence: 正式画像は開いて確認済みだが、この作業環境には利用可能なブラウザ画面がなく、同一状態・同一ビューポートの実装スクリーンショットを取得できなかった。
  - Impact: タイポグラフィ、余白、色、アイコン、折返し、画面密度が正式画像と同等かを、視覚証拠に基づいて合否判定できない。
  - Fix: ユーザー指定ブラウザで実装を開き、971 × 1619相当の同一状態を撮影する。正式画像と実装画像を1枚の比較入力に並べ、P0〜P2がなくなるまで修正・再撮影する。

## Required Fidelity Surfaces

- fonts and typography: コード上は既存の日本語system-uiとIBM Plex Mono、共通文字スケールを維持。視覚比較は未実施。
- spacing and layout rhythm: 220pxサイドバー、64pxヘッダー、レスポンシブ規則を実装。実画像との寸法・折返し比較は未実施。
- colors and visual tokens: 正式仕様のネイビー、ティール、状態色を共通トークンへ反映。実画像との色比較は未実施。
- image quality and asset fidelity: 共通シェルに写真・イラストは無い。ナビゲーションは既存のLucideアイコン資産を使用。視覚上のサイズ・光学位置は未比較。
- copy and content: `Focus Ledger`、月次4工程、1年／2年／3年／任意、防衛線、未記録、最終更新、共通信頼文言を実装し、DOMテストで存在を確認。
- states and interactions: 期間切替、任意期間、不正範囲ガード、検索、書き出し、利用者メニュー、ログイン前ロックを自動テストで確認。hover/focus/popoverの見た目は未比較。
- responsiveness and accessibility: リポジトリの実ブラウザ描画テストを含む全429テストは通過。正式画像との視覚比較、ブラウザコンソールの手動確認、テキスト拡大時の目視は未実施。

## Full-view Comparison Evidence

- source: 正式概況画像（971 × 1619 px）
- implementation: 取得不可
- result: 比較入力を作成できないため未判定

## Focused Region Comparison Evidence

- 対象予定: サイドバー上部、期間セグメント、防衛線・未記録・最終更新、共通信頼フッター
- implementation captureが無いため未実施

## Comparison History

- iteration 0: ソース画像は確認済み。実装画像が無いため初回比較を開始できず、視覚修正は行っていない。

## Open Questions

- 正式画像の971 × 1619 pxをCSSビューポートとして扱うか、全ページキャプチャの出力寸法として扱うかは、ブラウザ撮影時に実測して合わせる。

## Implementation Checklist

- [x] 全ページ共通シェルを実装
- [x] 全体期間1年／2年／3年／任意を実装
- [x] ログイン前ロックと主要操作を自動検証
- [x] 全Webテスト、型検査、production buildを通過
- [ ] ユーザー指定ブラウザで実装スクリーンショットを取得
- [ ] 正式画像と同じ比較入力で、全体・重点領域を視覚確認
- [ ] P0〜P2を修正して再比較

## Follow-up Polish

- 視覚比較後に、サイドバーの行密度、ヘッダーの日本語折返し、Lucideアイコンの光学位置をP3として調整する。

final result: blocked
