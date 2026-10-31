# Design QA — Focus Ledger サブスク

## 比較対象

- source visual truth: `design/FINAL-UI/images/09-subscriptions.png`（1024 × 1536px）
- implementation: `packages/web/src/pages/Subscriptions.tsx` と `packages/web/src/pages/subscriptions/`
- comparison: `docs/evidence/subscriptions/final-comparison-1024x1536.png`（source左、implementation右）
- current captures: `final-1024x1536.png`、`final-375x1000.png`
- current-run baseline: `docs/evidence/subscriptions/detail-readability-baseline.png`（利用者提供。右詳細の履歴列が省略記号だけになる状態）
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

### Iteration 5 — 詳細履歴の可読性と統合先のその場登録

- [RESOLVED P1] 狭い詳細railの4列tableを直近3件の要約へ置き換え、全12件は `取引履歴を大きく表示` のnative dialogへ分離した。PCは日付・取引名・ソース・金額の4列、639px以下は1取引1行の縦リストとし、取引名は省略せず折り返す。
- [RESOLVED P1] dialogは全件DOMを保持し、`is-expanded` のセルを `text-overflow: clip` / `white-space: normal` に固定した。Escapeで閉じる、dialog内フォーカス、入口へのフォーカス復帰をDOMテストで固定した。
- [RESOLVED P1] 未登録候補の `統合先` 直下へ `新しい統合先を登録` を追加した。既存の `POST /sub-vendors` を共用し、必須・120文字上限・重複409・一般エラーを近接表示する。成功時は候補queryの再取得完了後、APIが返した作成IDを自動選択する。
- [RESOLVED P2] 登録入口から入力へフォーカスを移し、「やめる」で再生成された入口へ戻す。開始ボタンがフォーム切替時にunmountされる条件もDOMテストで固定した。
- [RESOLVED P2] dialogは `min(920px, 100vw - 32px)`、375pxを含む639px以下は `100vw - 24px`、登録フォームは親幅100%で折返す契約とした。1600/1280/768/375pxでdocument幅を超えないCSS境界を確認した。
- current-runのCUAは `No browser is available` で自動撮影を開始できなかった。新しい実装画像を代用生成せず、利用者提供baseline、匿名fixtureの `http://127.0.0.1:8790/subscriptions` 200、40件のDOM操作契約、レスポンシブCSS契約、production buildで代替監査した。既存の4幅captureは旧Iterationの回帰参照として保持する。

### Iteration 6 — 取引履歴から判断できる利用要約

- [RESOLVED P1] 全件dialogの明細より先に、`確認できる利用期間 / 支払い実績 / 合計支払額 / 支払い月あたり平均` を表示した。対象期間内の全履歴だけを根拠にし、契約開始・終了・連続利用は推測しない。
- [RESOLVED P1] 支払い実績の月数と平均の分母は、支払いがあった年月のdistinct件数へ統一した。ラベルも `支払い月あたり平均` とし、対象期間の全月平均との誤読を防いだ。1回平均は月1件では同値が重複するため置いていない。
- [RESOLVED P2] 集計をAPI契約へ追加せず、既存の期間内全履歴から求める副作用なしの表示用関数へ分離した。0件は要約なし、1件は1日・1か月・1件、複数月は並び順に依存せず最古/最新・月数・合計・月平均を返す契約をunit testで固定した。
- [RESOLVED P2] dialogは `header / 利用要約 / 明細` の3段にし、狭幅では期間と支払い実績を全幅、金額2項目を2列へ落とす。明細の縦スクロール領域とEscape・フォーカス復帰は既存契約を維持した。
- current-runの利用者提供スクリーンショットを現状証拠として監査した。Product Designの操作制約に従いChrome/Playwrightを直接操作せず、375/768/1280/1600pxのCSS境界、0/1/12件のunit/DOM契約、長い名称の折返し契約、dialog縦overflow契約、typecheck/lint/buildで代替する。

## Required Fidelity Surfaces

- typography: 日本語system fontと数値用IBM Plex Mono、共通scaleを維持
- spacing/layout: 参照の主列+右詳細、5 KPI、coverage/list/detail/reasonの順序を維持。狭幅では詳細を一覧直後へ移す
- colors/tokens: `packages/core/src/design-tokens.ts` と既存CSS tokenだけを使用し、subscriptions実装にhexを追加していない
- icons: 共通 `UiIcon` registryを使用し、ロゴ画像・emoji・CSS artを追加していない
- content: KPI定義、候補理由、推定月額/年換算、取引履歴、データソース、判断状態をAPI契約から表示
- states: page/detail/supplementary queryそれぞれのloading/error/retry、empty、mutation failure/retryを確認
- accessibility: 8列table、名前付きtab/tabpanel、roving tabindex、fieldset/legend、aria-current、native dialog、Escape、フォーカス復帰、inline formのlabel/errorをDOMテストで確認

## 検証証跡

- target tests: `history-summary.test.ts` 3件 PASS、`subscriptions-screen.dom.test.tsx` 42件 PASS、`subs-screen.integration.test.ts` 26件 PASS、core 785件 PASS（6件skip）
- request contract: 初期補助API 0、登録済み概要 0、関連タブでvendors 1 / candidates 1
- target-row contract: `subscriptionRow` / `subscriptionVendorDetail` は全画面clone経路を通らない
- lint: `pnpm lint` PASS（実データ公開guard、token直書き検査を含む）
- typecheck: web PASS
- production build: PASS、initial JS 103.47KiB / 110KiB
- launch-security差分監査: client側の既存履歴から読むだけで、入力・保存・API・HTML挿入を追加していない。`pnpm audit --prod` は既知脆弱性0、CRITICAL 0 / HIGH 0（GO）
- browser audit: `docs/evidence/subscriptions/final-audit.json`
- baseline audit: `docs/evidence/subscriptions/baseline-audit.json`
- current-run detail baseline: `docs/evidence/subscriptions/detail-readability-baseline.png`
- current-run browser availability: CUA `No browser is available`。新規binary captureの代わりにDOM/CSS/build契約で監査
- public deployment: 未実施（依頼範囲外）

## 残るP3

- 参照画像は登録済みカテゴリ比較を持つが、現captureの匿名fixtureには継続中の登録済みサブスクがないため空状態を表示する。架空の比較値は追加しない。
- 参照のブランド名と匿名fixtureのベンダー名・金額は一致させない。構造・密度・操作状態だけを視覚比較する。

final result: passed

---

# Design QA — Login v2

- Source: `design/FINAL-UI/images/01-login-v2.png`
- Implementation: `docs/login-v2/evidence/login-1024x1536-cdp.png`
- Responsive evidence: `docs/login-v2/evidence/login-375x812-cdp.png`, `login-768x1024-cdp.png`, `login-1600x1000-cdp.png`
- Reference viewport / pixels: 1024 x 1536 / 1024 x 1536
- Implementation viewport / pixels: 1024 x 1536 / 1024 x 1536
- Device scale factor: 1
- State: initial login, email focused, password intentionally empty, unauthenticated service-status API unavailable locally

## Comparison

- Full frame: the one-column public shell, brand, 590px card, information order, trust section, and three-part footer match the reference hierarchy.
- Authentication focus: the Google mark is 28px with a computed 10px gap, fields share the common input surface, the visual checkbox is 24px over a 44px input and control row, and the footer separators compute to 1px on desktop.
- Responsive focus: at 375px the card is 343px wide with 16px outer gutters; document and body widths are both 375px, so there is no horizontal overflow. Footer separators collapse at the mobile breakpoint.
- Intentional differences: the password is empty, focus is visibly outlined, the background and typography use the approved project tokens, and local service status is shown as unavailable instead of copying the static mock state.

## Iteration history

1. Baseline found an unstyled email input, ineffective Google flex gap, a 44px visible checkbox, missing footer separators, and underscaled card/type hierarchy.
2. The common input selector, login layout, checkbox hit-area split, footer, card width, type hierarchy, and authentication busy/error states were corrected.
3. Google brand colors were moved from application source to the official static mark, login radii were unified to `--radius`, and the 375px form heading was tightened to the approved `--fs-lg` step.

## Final result

passed

## 30思考法による最終監査

思考リセット後、論理・構造、メタ・発想、システム・戦略の3系統を並列に検証し、実装・仕様・テストへ反映した。

1. **批判的思考**: 既存認証を前提にせず、公開可能な認証面をdefault-denyで再判定した。
2. **演繹思考**: 「招待された本人だけが登録できる」制約から、一回限りの招待grantと原子的消費を導いた。
3. **帰納的思考**: 認証分岐に反復していたtoken・rate-limit・audit処理を共通モジュールへ集約した。
4. **アブダクション**: セッション挙動の不整合を旧認証とBetter Authの二重管理が原因と推定し、旧経路を撤去した。
5. **垂直思考**: 表示差ではなく、認証・設定・管理画面に分散したsource of truthまで掘り下げて解消した。
6. **要素分解**: UI、API、DB、メール、運用、テスト、仕様へ分けて独立検証した。
7. **MECE**: 未認証、認証中、MFA、連携、管理、保守の状態を重複なく網羅した。
8. **2軸思考**: 「未認証/認証済み」と「参照/更新」の2軸でendpointの許可範囲を整理した。
9. **プロセス思考**: 招待→承諾→ログイン→MFA→セッション、および再設定・連携・失効の順序を検証した。
10. **メタ思考**: 実装だけでなく、画像証跡、契約テスト、統合テスト、運用手順を監査可能な形にした。
11. **抽象化思考**: 招待・再設定・MFA設定・連携を「期限付き一回限りgrant」として共通化した。
12. **ダブル・ループ思考**: 管理者が仮パスワードを発行する前提自体を廃止し、本人招待方式へ置き換えた。
13. **ブレインストーミング**: 複数案から、画面追加を抑えつつ既存設定画面へ管理機能を統合する案を採用した。
14. **水平思考**: ログイン専用部品を公開画面・設定・利用者管理で共有できるauth featureへ再配置した。
15. **逆説思考**: 機能を増やすだけでなく、不要な認証endpointと旧rate-limit実装を削ることで安全性を上げた。
16. **類推思考**: one-time capabilityの設計を招待、再設定、MFA、アカウント連携へ一貫適用した。
17. **if思考**: 同時承諾、取消中の再送、二重作成、昇格中のsession残存など競合シナリオを試験した。
18. **素人思考**: 初見でも招待、ログイン保持、再設定、MFA、連携の次の操作が分かる文言と導線にした。
19. **システム思考**: UI、Worker、D1、メール、Cloudflare設定、CI、runbookの接続を通しで確認した。
20. **因果関係分析**: 列挙可能な応答、再利用可能token、残存sessionが不正利用へ至る因果を遮断した。
21. **因果ループ**: 認証失敗→rate-limit/audit→運用確認→失効/復旧という監視・改善ループを整備した。
22. **トレードオン思考**: セキュリティと利便性を両立し、保持30日/非保持12時間とMFA境界を明示した。
23. **プラスサム思考**: 共通Input・auth feature・共通guardにより、UI統一と保守性とテスト容易性を同時に上げた。
24. **価値提案思考**: 「招待された利用者が迷わず安全に利用開始できる」を画面と認証契約の中心に置いた。
25. **戦略的思考**: Better Authをセッションの正本にし、アプリ固有の招待・権限・監査だけを境界層へ残した。
26. **why思考**: 不整合の根本原因を5段階で追い、最終的に二重認証経路と分散責務へ到達した。
27. **改善思考**: 重複削除、component化、原子更新、fail-closed設定、運用手順まで一体で改善した。
28. **仮説思考**: 各リスクを再現可能な仮説に変え、境界・競合・統合・DOMテストで反証した。
29. **論点思考**: pixel一致だけでなく、安全な認証完了と保守可能な単一構造を本質的論点とした。
30. **KJ法**: 発見事項をUI、認証境界、データ整合、運用、検証、仕様の6群へ統合し、重複を除いた。

## 検証4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | Better Authをsessionの正本に統一し、旧認証経路を削除 |
| 漏れなし | PASS | 招待、Google/パスワード、再設定、MFA、連携、管理、監査、保守を実装・試験 |
| 整合性あり | PASS | auth feature、共通部品、design token、endpoint guard、仕様用語を統一 |
| 依存関係整合 | PASS | pageへの逆依存を除去し、UI→API→DB→運用の依存とgraph lineageを検証 |
