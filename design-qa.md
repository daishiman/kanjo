# Design QA — Focus Ledger 概況

## 比較対象

- source visual truth: `design/FINAL-UI/images/02-overview.png`
- implementation: `packages/web/src/pages/Overview.tsx`、`packages/web/src/components/Layout.tsx`、`packages/web/src/components/OverviewReviewQueue.tsx`
- implementation capture: `/tmp/kanjo-overview-fidelity-final/overview-{375,641,768,900,1023,1024,1280,zoom200,rail-zoom200}.png`、同`-review.png`、rail条件の`-rail-bottom.png`
- intended state: ログイン済み、概況、通常データあり
- source pixels: 971 × 1619 px（生成済みの全ページ画像）
- implementation pixels: 1280 × 1000 px / 375 × 1000 px（local previewを匿名fixtureで実描画）
- normalization: sourceは縦長の全ページ画像、implementationはviewport captureなので、固定pixelではなく情報順・相対密度・同段配置・状態表現を比較した

## Findings

- [RESOLVED P1] 情報順と広幅バランス
  - 改善前: 未処理一覧が推移より先にあり、右側に大きな空白が残っていた。
  - 改善後: 問い → KPI → 月次推移 → 未処理3列 → 前年比較/支出内訳の順へ統一。1280pxでは未処理の内訳・優先明細・選択中詳細が同じ段に並ぶ。
- [RESOLVED P1] 状態と判断根拠の不足
  - 改善前: KPIの前年差、明細の状態・推奨・信頼度、選択中詳細の理由が弱かった。
  - 改善後: KPIへ方向icon・符号付き増減額・増減率・比較値を追加し、比較期間が無い場合も「比較できる前期データがありません」と明示。優先表へ状態icon・推奨・信頼度、詳細へ未処理理由・信頼度meter・閉じる操作を追加した。
- [RESOLVED P1] icon・色・信頼情報の不足
  - 改善後: brand、header操作、防衛線、review状態、footer trustをLucide由来のstroke iconへ統一。収入=青、支出=赤、純収支=teal、危険/注意/情報のsemantic tokenを使用した。
- [RESOLVED P1] 注意・エラーの判別と優先明細表の崩れ
  - 改善前: 注意と不一致が色だけでは判別しづらく、1280pxの3列表示では中央表へ6列を押し込んで文字単位の改行と内側横スクロールが発生した。
  - 改善後: `要仕分け`は三角icon・淡黄背景・橙境界、`不一致`は丸型alert icon・淡赤背景・赤境界とし、短い状態語も常時表示。状態・日付・内容・金額・推奨・信頼度の6列は隠さず唯一のDOM契約にし、利用可能幅を超える場合は表内だけを横移動する。縦移動では見出し行、横移動では状態列を固定し、文字単位改行・セル重なり・ページ全体の横overflowを防いだ。
- [RESOLVED P2] 狭いデスクトップのheader圧迫
  - 1024〜1399pxでは検索・書き出し・使い方・利用者をicon表示へ縮約し、`aria-label`は維持。breadcrumb・期間操作・状態・共通操作が交差せず、breadcrumb全文が表示されることを採寸した。
- [RESOLVED P2] 冒頭説明と月次工程の重複
  - 主見出しは「今月の収支と、次に直すことは？」へ一本化。4工程と月次レビュー操作は、APIの`closeStatus`を読むsidebar cardへ集約した。
- [RESOLVED P2] 推移と支出内訳の密度
  - 推移は全体期間を変えずに図だけ1/2/3年で切替可能とし、既定は12か月。年またぎが曖昧にならない`YYYY/MM`表記へ変更した。
  - 支出内訳はKPIと同じ消し込み・要確認・除外済み取引集合から科目粒度で作り、事業/家計の同名科目を混ぜず、上位5項目+その他へ集約。金額/構成比切替で同じ率を二重表示せず、ラベル・金額・率に加えて既存semantic tokenのbar色でも項目を追えるようにした。
- [RESOLVED P2] 前年比較の構造不足
  - 比較表を`項目 / 今期 / 前期 / 増減 / 増減率`の5列へ揃えた。比較期間が無い場合もカードを消さず、今期値と`—`を同じ列構造で残すため、欠損と未実装を混同しない。
- [RESOLVED P1] 68px icon railの崩れと操作重複
  - 改善前: 641〜1023pxと200%拡大でbrand・月次進捗・改善ボタン・3桁badgeが同じ68pxに長文のまま残り、縦1文字とicon重なりが発生した。
  - 改善後: brandは正本icon、件数は8px dot、月次進捗は件数・meter・44px icon操作に縮約。railの固定「改善を送る」は重複する「改善要望」navへ委譲し、mobile/desktopのCTAは維持した。
- [RESOLVED P2] rail境界の表によるpage overflow
  - 641/768pxの支出トレンド表がmobileカード化境界の外でpage幅を押し広げていた。既存の`scroll-x`に収め、shellやsticky actionを押し出さない表境界へ統一した。

## 意図して残した差分

- sidebar幅、文字scale、tap targetは画像の見た目だけに合わせず、`docs/design-system.md`の正本値を維持した。
- 総合/事業/家計のscope切替は既存の実機能なので保持した。
- APIにない取引口座、カード名、類似取引履歴、サブスク件数は架空表示しない。利用可能な`recommendation`、`basisLabel`、`confidence`だけを表示する。これらの追加は新しいデータ契約を要するP3残課題とする。
- 全体期間の既定値や月次クローズ件数は実データに従い、参考画像の固定値へ合わせない。

## Required Fidelity Surfaces

- fonts and typography: 日本語system fontとIBM Plex Mono、共通scaleを維持。KPI・残件・confidenceだけを数値階層として強調。
- spacing and layout rhythm: 1280pxの同段3列、720px以下の1列化、480px以下のKPI1列化を実描画で確認。
- colors and visual tokens: `packages/core/src/design-tokens.ts`だけを参照し、Web側にhexを追加していない。
- icon fidelity: emoji、CSS art、個別画像、独自icon依存を追加せず、Lucide由来registryへ統一。共通shellのiconは遅延chunk化した。
- copy and content: 主見出し、月次クローズ、KPI定義、推移、未処理、比較、内訳、出典/除外、trust文言を確認。
- states and interactions: scope、図の1/2/3年、3か月平均、金額/構成比、明細選択/選択解除、後で確認、月次レビューの前提disabledをDOMテストで確認。
- responsiveness and accessibility: 320/360/375/390/641/768/900/1023/1024/1280/1600pxと200% zoomで、ページ横はみ出し・セル交差なし、表の行高96px以内。優先表は6列見出しと列対応を保ち、表内横スクロール後も状態列、縦スクロール後も見出し行が見えることを実測。railはbrand/badge/scrollbar/月次進捗の非重なり、実文字の1文字折返しなし、操作の読み上げ名維持を追加。native fieldset、progressbar値、aria-current、dialog、focus復帰を維持。

## Full-view Comparison Evidence

- iteration 0: source画像のみで未判定。
- iteration 1: ユーザー共有の改善前画像と比較し、表示順・余白・情報不足をP1/P2として特定。
- iteration 2: sourceと`overview-1280.png`を同じ比較入力で確認。主要情報順、4分割KPI、compact trend、review 3列、semantic色、icon階層が一致することを確認。
- mobile: `overview-375.png`で1列化、header操作、KPIの可読性、sticky actionとtabbarの共存を確認。
- iteration 3: `overview-{375,768,1024,1280}-review.png`と`overview-zoom200-review.png`で、状態の形・語・面の差、当時の列縮約、文字単位改行なし、header非交差を同一匿名fixtureで確認。iteration 5で列縮約は全6列+表内scrollへ置き換えた。
- iteration 4: `overview-{641,768,900,1023,rail-zoom200}-rail-bottom.png`でicon railのbrand、8px badge、月次進捗の数値/meter/icon操作、scrollbarの非重なりを確認。同じ幅で概況・支出トレンド・サブスク・家計・AIレポートの共5画面を横断監査した。
- iteration 5: `/tmp/kanjo-overview-fidelity-final`でKPIの符号付き差額/率/前期値、科目別上位5+その他の金額/構成比/識別色、前年比較5列、Review全6列と双方向stickyを同一匿名fixtureで再確認。正本画像と1280px captureを再比較し、APIにない情報以外のP0/P1/P2差分を解消した。

## 実行証跡

- local preview: `http://127.0.0.1:4391`（公開URLではない）
- visual harness: Overviewは320/360/375/390/641/768/900/1023/1024/1280/1600px + mobile/rail 200% zoomで、console/runtime error・page/表overflow・header/main/sticky action・6列対応・縦横sticky・KPI比較・内訳6行・比較表5列を実測 PASS。全route横断harnessもPASS。
- Web test: 74 files / 565 tests PASS
- Core test: 41 files / 588 tests PASS（6 skipped）
- API test: 40 files / 549 tests PASS
- 今回の概況DOM回帰: 1 file / 23 tests PASS
- typecheck / Biome対象check / production build: PASS
- initial JS: 107.93KiB / 110KiB PASS
- dependency audit: high/critical 0
- public content real-data guard: PASS
- Computer Use browser inventory: browserなし。リポジトリ既存の匿名fixture CDP harnessでWorkers previewを実描画した

## Open Questions

- なし。実データに存在しない参考画像の情報は、データ契約が追加されるまで表示しない。

final result: passed
