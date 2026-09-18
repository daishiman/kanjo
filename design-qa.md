# Design QA — Focus Ledger サブスク

## 比較対象

- source visual truth: `design/FINAL-UI/images/09-subscriptions.png`（1024 × 1536px）
- implementation: `packages/web/src/pages/Subscriptions.tsx` と `packages/web/src/pages/subscriptions/`
- comparison: `docs/evidence/subscriptions/final-comparison-1024x1536.png`（source左、implementation右）
- current captures: `final-1024x1536.png`、`final-375x1000.png`
- fixture: `scripts/seed-local.mjs` が生成した匿名サンプルのみ。実データ・ローカルsecretは比較入力に含めていない
- normalization: 金額・候補数・行数はデータ駆動なので固定pixel一致の対象外。情報順、判断導線、相対密度、状態表現、応答幅を比較した

## 最終判定

- P0: 0件
- P1: 0件
- P2: 0件
- console error / runtime exception / failed resource: 0 / 0 / 0
- 1024 / 375px: document-level horizontal overflow 0
- 結論: 参照画像の「問い → KPI → カバー率/更新 → 一覧/詳細 → 推移 → 年換算比較 → 代表理由」と「候補の理由から詳細で判断する」構造を保ち、重複操作と不要取得を除いた

## P0/P1/P2 比較履歴

### Iteration 0 — baseline

- [P1] 一覧に用途のない選択checkboxがあり、詳細の生取引名選択と役割が競合していた（baseline 21要素）。
- [P1] 候補カードごとに「採用・除外・詳細」の判断操作が重複し、baselineでは候補rail内に15操作あった。
- [P1] 初期表示からvendors/candidatesを取得し、詳細も全画面のKPI・推移・比較を再導出していた。
- [P2] `DetailPanel` に概要・履歴・関連データ・判断・編集が集中し、変更影響と失敗状態が読みにくかった。

### Iteration 1 — 情報と操作の単一化

- [RESOLVED P1] 一覧checkboxを削除し、行は詳細を開く操作、生取引名checkboxは名称統合だけに限定した。最終実測は一覧checkbox 0。
- [RESOLVED P1] 理由カードは選択中または最優先の1件だけを代表表示し、残りは「他N件」で一覧の既存ステータス絞り込みへ渡す。判断は詳細の `ReviewDecisionActions` へ集約した。
- [RESOLVED P2] 詳細を概要・履歴・関連データの部品へ分割し、選択CTAは下部 `SelectionBar` の1か所に限定した。
- [RESOLVED P2] 推移カードの見出し・単位・凡例を各1つに限定した。最終実測は推移見出し1。

### Iteration 2 — 依存取得と再計算の縮小

- [RESOLVED P1] 初期表示と登録済み概要では `/api/sub-vendors` と `/api/sub-vendors/candidates` を取得しない。関連データを開いた時だけ各1回取得する。
- [RESOLVED P1] 補助取得のloading/error/retryを対象科目・除外情報ごとに表示し、空データと失敗を混同しない。
- [RESOLVED P1] 詳細APIと判断更新は対象行の共有導出へ変更し、全画面のKPI・推移・比較を再計算しないことをcore契約テストで固定した。
- [RESOLVED P2] mutationのinvalidationsをdecision / vendorDefinition / category / reviewDate / exclusionごとに限定し、request数と更新後状態をDOMテストで固定した。

### Iteration 3 — 実ブラウザ最終監査

- [RESOLVED P1] 行選択、概要/取引履歴/関連データ、理由→詳細、判断、名称選択→下部バーを匿名fixtureで完走した。
- [RESOLVED P2] 検索は24行→1行、見直し候補filterは24行→9行へ変化することを実ブラウザで確認した。
- [RESOLVED P2] 5幅すべてでpage overflowなし。狭幅は表だけを横スクロール領域に閉じ、375pxはbottom navigationと選択/改善操作を維持した。
- [RESOLVED P2] sourceと1024px詳細表示を同じ比較画像へ並べ、見出し階層、5 KPI、カバー率、一覧/詳細の並置、推移/比較への流れを確認した。

### Iteration 4 — 参照密度への再調整

- [RESOLVED P1] route限定の160px sidebarと12px本文gutterで、1024pxの本文左端を252pxから172pxへ戻した。他routeのshell/token値は変更していない。
- [RESOLVED P1] coverage/updateを同じ横行へ置き、両カードを71px高に統一。最終更新は専用copy構造でラベル・日付・時刻を自然な2行にし、再取得ボタンを右端へ固定した。
- [RESOLVED P1] PC一覧は440pxの内部縦スクロールとsticky見出し/合計行にし、20行の匿名fixtureを削らず約8行だけ表示。8列は12pxの固定レイアウトで同じviewportに収めた。
- [RESOLVED P1] 詳細内のcheckbox indicatorを18px、label hit-areaを44pxに分離し、tab・履歴表・判断操作を圧縮。内部scrollへ逃がさず、代表ReasonCard全体を1024×1536のdocument内（y=1274–1519）へ戻した。
- [RESOLVED P2] 5 KPIへ既存UiIconを割り当て、trend canvasをdesktop 140pxへ縮小。正確値表と次の行動は残し、comparison開始位置をy=1290へ戻した。
- [RESOLVED P2] 1024/375ともdocument overflow 0。代表理由1件、他4件導線、候補filter 5行、sticky合計行、console/runtime/network error 0を実ブラウザで確認した。

## Required Fidelity Surfaces

- typography: 日本語system fontと数値用IBM Plex Mono、共通scaleを維持
- spacing/layout: 参照の主列+右詳細、5 KPI、coverage/list/detail/reasonの順序を維持。狭幅では詳細を一覧直後へ移す
- colors/tokens: `packages/core/src/design-tokens.ts` と既存CSS tokenだけを使用し、subscriptions実装にhexを追加していない
- icons: 共通 `UiIcon` registryを使用し、ロゴ画像・emoji・CSS artを追加していない
- content: KPI定義、候補理由、推定月額/年換算、取引履歴、データソース、判断状態をAPI契約から表示
- states: page/detail/supplementary queryそれぞれのloading/error/retry、empty、mutation failure/retryを確認
- accessibility: 8列table、名前付きtab/tabpanel、roving tabindex、fieldset/legend、aria-current、dialog、regionをDOMテストで確認

## 検証証跡

- target tests: `subscriptions-screen.dom.test.tsx` 36件 PASS
- request contract: 初期補助API 0、登録済み概要 0、関連タブでvendors 1 / candidates 1
- target-row contract: `subscriptionRow` / `subscriptionVendorDetail` は全画面clone経路を通らない
- lint: `pnpm lint` PASS（実データ公開guard、token直書き検査を含む）
- typecheck: web PASS
- production build: PASS、initial JS 103.48KiB / 110KiB
- browser audit: `docs/evidence/subscriptions/final-audit.json`
- baseline audit: `docs/evidence/subscriptions/baseline-audit.json`
- public deployment: 未実施（依頼範囲外）

## 残るP3

- 参照画像は登録済みカテゴリ比較を持つが、現captureの匿名fixtureには継続中の登録済みサブスクがないため空状態を表示する。架空の比較値は追加しない。
- 参照のブランド名と匿名fixtureのベンダー名・金額は一致させない。構造・密度・操作状態だけを視覚比較する。

final result: passed
