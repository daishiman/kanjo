# 使い方画面の設計判断

使い方画面(`/guide`)を作り直したときの判断の記録。対象は feature `feat-guide-screen`(Beads epic `kanjo-ogz`、子タスク SYS-GUIDE-P01〜P13)。画面仕様の正本は `specs/spec-guide-screen.md`、アーキテクチャは `architecture/guide-*.md` の 8 章、見た目の正本は `design/FINAL-UI/images/19-guide.png`。受入の証跡は [`evidence.md`](evidence.md) にまとめた。

この文書は spec を置き換えない。spec が決めていない実装上の判断と、未決事項をどう決着させたかを残す。値の由来は「利用者確認済み」と「agent 推定 (利用者未確認)」を区別して書く。

## 1. 制約(全 task 共通)

- 要確認の閾値 `REVIEW_CONFIDENCE_THRESHOLD = 80`(`packages/core/src/classify-status.ts:43`)は変えない。自動判定の結果は本 feature の前後で同じ。
- DB の表・列・migration は足さない。`/api/guide` は読み取りだけで、D1 への書き込みは 0。巻き戻しはコードの revert だけで済む。
- 防衛ラインの算出(値)は変えない。算出の月数を名前付き定数にしただけで、`defenseLine` の既存テストは値を変えずに緑。
- 共通ヘッダの呼称『防衛ライン』は変えない。
- scope_out(利用規約・プライバシーの専用ページ、ガイド本文の DB 保存や管理画面、信頼度の規則変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、専用アプリ、税務判断)には触れない。

## 2. 受入 S1〜S4 を検証できる文に分ける(P01)

| 受入 | 分けた主張 | 対応する spec の節 |
|---|---|---|
| S1 | S1-a `/guide` に 問いの見出し・4 ステップ・目次 7 項目・月次の流れ(ステッパー・総収支の読み方・期間の表)・右カラム 3 枚(このページの数値・関連ページ・ガイド内を検索)・よくある疑問 5 行・下部固定バーが描画される | 機能要件 FR-1〜FR-12 |
| | S1-b 総収支の 3 枚が選択期間の実データ(振替除外)と一致する | FR-6・API 契約 |
| | S1-c `packages/web/src` に直書き色が 0 件 | テストと受入条件 |
| | S1-d 読込・失敗・検索 0 件・取込 0 件の各状態が DOM テストで固定されている | FR-13〜FR-16 |
| S2 | S2-a 信頼度 49/50/79/80 が 低/中/中/高 になる | ビジネスルール(信頼度の段階) |
| | S2-b §3 で確定した画面で『段階＋%』が出る | FR-17 |
| | S2-c 防衛ラインの値と要確認の自動判定が変わらない | ビジネスルール |
| S3 | web と api に ガイドの節・よくある疑問・期間の表・現在値の合成・信頼度の境界比較 が core の `guide-screen` と段階関数以外に 0 件 | アーキテクチャ(core に 1 か所) |
| S4 | S4-a ヘッダが『防衛ライン』のまま | ビジネスルール |
| | S4-b フッタ 1 文目『取込データは外部送信しません』と AI 送信の補足 3 か所が読める | FR-12 |
| | S4-c 他の利用者のセッションで `/api/guide` が数値を返さない・未認証 401・一時パスワード 403 | API 契約・セキュリティ |

## 3. 信頼度を出す画面の列挙と色(OI-1・OI-2、P01 → P05)

段階は `confidenceTier`(`packages/core/src/classify-status.ts`)1 つだけが決め、画面は `confidenceTierText` の結果(『高 92%』)を描くだけにした。

| 画面 | ファイル | 変更前 | 変更後 | 色 |
|---|---|---|---|---|
| 明細仕分けの表 | `pages/classify/TransactionTable.tsx:144`(`view-model.ts` の `confidenceText` 経由) | `92%` | `高 92%` | 変更なし |
| 明細仕分けの編集欄 | `pages/classify/EditPanel.tsx:261` | 信頼度の行が無かった | `信頼度 高 92%` の行を足した | なし |
| 明細仕分けの履歴 | `pages/classify/view-model.ts:148` | `（信頼度 92%）` | `（信頼度 高 92%）` | なし |
| 概況の確認待ち | `components/OverviewReviewQueue.tsx:148` | `92%` | `高 92%` | 変更なし |
| 概況の本文 | `pages/Overview.tsx:382` | `92%` | `高 92%` | 段階に従う(下記) |
| 診断の結果カード・詳細 | `pages/analysis/diagnosis/ResultCards.tsx:33` ほか | `確度 高` | **対象外**(据え置き) | — |
| AI 分析の仮説 | `pages/ai/AiContextAnalysis.tsx:22` | `確度 高` | **対象外**(据え置き) | — |

- 診断と AI の『確度』は数値の % を持たない 3 値の列挙で、明細の自動判定の信頼度とは別の概念(見積りの確からしさ)。段階＋% の形にできず、境界 80/50 も当てはまらないので含めない。**agent 推定**。
- 概況の色(OI-2)は 80/60 の境界を捨て、段階に揃えた(高 good・中 warning・低 danger)。55% が段階では中なのに色は danger になる食い違いを消すため。境界の比較は `Overview.tsx` から無くなり、`confidenceTier` だけが持つ。**agent 推定**。
- 範囲外(−1・101・NaN)と null は『—』。0% と区別する。**agent 推定**(Q-4)。
- **RQ-F1(利用者確認済み)**: classify と overview の既存 DOM テストの信頼度の期待値を『段階＋%』へ書き換えることは、承認済みの scope 拡張として扱った。書き換えたのは信頼度の期待値だけ。

## 4. core の置き場所と名前(P02)

| 対象 | 置き場所 | 名前 |
|---|---|---|
| 信頼度の段階 | `packages/core/src/classify-status.ts` | `CONFIDENCE_TIER_HIGH_MIN = 80`・`CONFIDENCE_TIER_MEDIUM_MIN = 50`・`confidenceTier`・`confidenceTierText`・`CONFIDENCE_TIER_LABEL`・`CONFIDENCE_TIER_DESCRIPTION` |
| 防衛ラインの算出月数 | `packages/core/src/analysis.ts` | `DEFENSE_LINE_RECENT_MONTHS = 3`・`DEFENSE_LINE_BASIS` |
| 期間の前後移動・定義文 | `packages/core/src/period.ts` | `shiftedPeriod`(決算書から移設)・`periodDefinitionText` |
| 画面の本文と導出 | `packages/core/src/guide-screen.ts`(新設) | `guideScreen`・`GUIDE_TOPICS`・`GUIDE_STEPS`・`GUIDE_FAQ`・`GUIDE_PERIOD_TABLE`・`GUIDE_RELATED_PAGES`・`GUIDE_SEARCH`・`searchGuide`・`resolveGuideTopic`・`clampGuideQuery` ほか |
| AI 送信の補足文 | `packages/core/src/data-notice.ts`(新設) | `AI_DATA_NOTICE`(`guide-screen.ts` はここから import する) |

- 高の下限 80 と `REVIEW_CONFIDENCE_THRESHOLD` 80 は、意味(表示の段階 / 疑う基準)が違うので**別の定数**にした。両者が 80 であることは `classify-status.test.ts` で固定する。**agent 推定**(Q-4)。
- 防衛ラインの説明文は `DEFENSE_LINE_BASIS`(『個人生活費の直近${DEFENSE_LINE_RECENT_MONTHS}か月平均＋事業固定費の平均』)から組む。`analysis.ts` の `pMonths.slice(-3)` は `slice(-DEFENSE_LINE_RECENT_MONTHS)` に、用語集 `glossary.ts` の `defenseLine` の short / desc は `DEFENSE_LINE_BASIS` の連結に、旧 `guide-sections.ts` の現在値の合成は core の `GUIDE_TERM_CURRENT` に置き換えた(R-1)。
- `shiftedPeriod` は `pages/statements/view-model.ts` から core へ移し、決算書側は core から再輸出する。決算書の挙動と `statements-view-model.test.ts` は変えない(R-3)。

## 5. `GET /api/guide` の応答形(P02、Q-1)

- 置き場所は `packages/api/src/routes/analytics.ts` の `analyticsRoute`。`/api/*` の `authGuard` と `mustChangePasswordFence`(`index.ts:108-110`)の内側にある。`index.ts` の CSP と認可の配線は変えていない。
- `loadScoped`(`c.get('userId')` で絞った 1 回の `loadDataset`)と、`/overview` と同じ `loadCloseStatus` の導出(保留を除いた有効キュー)だけで作る。
- 総収支は総収支画面と同じ `totalCashflowScreen(...).summary.total` を写す。振替除外の既存集計をそのまま使い、新しい集計規則は足さない。
- 応答は `{ screen: GuideScreen }`。`GuideScreen = { period: { applied, full, label, definition }, totals: { income, expense, net }, dataUpdatedAt, sources, closeStatus }`。防衛ラインの値は含めない。取込 0 件では totals は 0、`dataUpdatedAt` と `closeStatus` は null。
- 細部(フィールド名・取込 0 件の扱い・`loadCloseStatus` に渡す items の取り方)は **agent 推定**。

## 6. web の分割と URL(P02・P05、Q-2・Q-3)

- `/guide` は `packages/web/src/pages/guide/` 配下(GuidePage・GuideSteps・GuideToc・GuideTopicBody・GuideAside・GuideFaq・GuideBottomBar・GuideTerms・GuideValue・view-model・guide.css)に分けた。このディレクトリで `@kanjo/core` を import するのは `view-model.ts` だけ。旧 `pages/Guide.tsx` は再輸出 1 行。期間移動 UI は決算書と共通の `components/PeriodRange.tsx` へ置く。
- トピック id は `flow / totals / reconcile / classify / budget / sources / terms`。URL は `?topic=` と `?q=`。既定(`topic=flow`・空の `q`)はキーごと消し、期間(`from` / `to`)など他のキーは残す。未知の topic は月次の流れに戻す。`q` は 100 字で切る。
- 検索はブラウザ内の core の関数だけで行い、検索語は `/api` へ送らない。全角と半角、大文字と小文字を同一視する。0 件は『該当するガイドがありません』。
- 目次は幅 1024px 以上で左の縦並び、未満で横スクロールのタブ。右カラムは 1024px 未満で本文の下へ積む。4 ステップは 1024px 以上で 4 列、641〜1023px で 2 列、640px 以下で 1 列。
- ステッパーは完了の段を塗り、文字(完了 / 未完了)も添える。取込 0 件では『取込む』のステップを強調し、ステッパーはすべて未完了。
- 検索で選択中のトピックが外れたら先頭の一致へ移り、タブ・本文・下部バーを一致させる。疑問だけの一致または0件では無関係な本文と下部バーを出さない。期間切替中は旧期間の数値を読込状態として隠す。これらの再検証の根拠は [`elegant-review.md`](elegant-review.md) に記録する。
- 以上の綴り・行き先・切替幅・文言は **agent 推定**(Q-2・Q-3)。

## 7. フッタと AI 送信の補足(P02・P05、R-2)

- 共通シェルのフッタ 1 文目を『取込データは外部送信しません』にした。
- AI 送信の補足『AI 実行時は、確認した集計データを選択した AI へ渡します』(core の `AI_DATA_NOTICE`)を 3 か所に置いた: フッタ 1 文目の `title`、フッタのプライバシー欄、使い方画面の『データ出典』の節。文言は **agent 推定**(Q-4)。
- `AI_DATA_NOTICE` は `guide-screen.ts` ではなく `data-notice.ts` に置く。フッタは初期 JS に入るため、`guide-screen.ts` から値を 1 つ import するだけで同じモジュールの本文表(よくある疑問・月次の流れ)まで初期 JS に残り、`check:js-budget` が 111.96KiB > 110KiB で落ちた。分けた後は 107.71KiB で、初期チャンクに本文表の文字列は 0 件(記録は [`evidence.md`](evidence.md))。
- ヘッダの『防衛ライン』は変えない。`common-shell.dom.test.tsx` のヘッダの期待も変えていない。

## 8. 描画検査(P05、R-4)

- `packages/web/package.json` に `check:guide-screen`(`KANJO_VISUAL_SCOPE=guide node scripts/check-financial-visuals.mjs`)を足し、ルートの `verify:full` の `check:cash-screen` の次に組み込んだ。
- `check-financial-visuals.mjs` の guide スコープは `/api/guide` の応答を用意し、360・390・768・1023・1024・1280・1600px と 200% 拡大で次を測る: 本体の横はみ出し、見出しと問い、4 ステップの文言と列数、目次 7 項目、ステッパー、総収支 3 枚の値と 1 行に収まること、右カラム、よくある疑問 5 行、1024px 境界の 2 列 / 1 列、下部固定バーが画面内にあること、実行時エラー。
- 描画検査で見つけた不具合: 1024〜1280px で総収支の金額が『¥4,860,00 / 0』のように桁の途中で折り返していた。`.guide-total-value` を `white-space: nowrap` と container query 単位(`min(var(--fs-xl), 13cqi)`)に直し、折り返しの検査を足した。検査は修正前の CSS で不合格になることを確かめてある。

## 9. 持ち越し事項の担当と結論

| ID | 内容 | 担当 | 結論 | 区別 |
|---|---|---|---|---|
| OI-1 | 信頼度を出す画面の列挙 | P01 → P05 | §3 の表。診断と AI の『確度』は対象外 | agent 推定(DOM テストの書き換えは RQ-F1 で利用者確認済み) |
| OI-2 | 概況の色の境界 80/60 | P01 → P05 | 段階(80/50)に揃えた | agent 推定 |
| R-1 | 『直近3か月』の直書き | P02 → P05 | `DEFENSE_LINE_RECENT_MONTHS` と `DEFENSE_LINE_BASIS` へ寄せた。値は 3 のまま | 仕様どおり |
| R-2 | フッタの期待の書き換え | P04 → P05 | §7 | 仕様どおり(文言は agent 推定) |
| R-3 | `shiftedPeriod` の移設 | P02 → P05 | core の `period.ts` へ移し、決算書は再輸出 | 仕様どおり |
| R-4 | `check:guide-screen` | P05 | §8 | 仕様どおり |
| R-5 | architecture の resource_scope の誤記の可能性(`docs/cash-screen`・`scripts/check-glossary.mjs`・migrations) | P12 | 本 feature では書き換えていない。修正は architecture の再 import で行う | 記録のみ |
| Q-1 | `/api/guide` の応答の細部 | P02 | §5 | agent 推定 |
| Q-2 | トピック id・行き先・切替幅・ステッパー | P05 | §6 | agent 推定 |
| Q-3 | 検索の正規化・0 件の文言・URL の既定・期間の定義文 | P05 | §6・`periodDefinitionText` | agent 推定 |
| Q-4 | AI 補足の文言・段階関数と定数の名前・範囲外の扱い・閾値の共有 | P02 | §3・§4・§7 | agent 推定 |
| Q-5 | DOM テストのファイル名 | P04 | `packages/web/src/pages/guide/guide-screen.dom.test.tsx` | agent 推定 |

## 10. レビュー指摘と確認(P03・P08・P10)

- `/api/guide` が `authGuard` と `mustChangePasswordFence` の内側にあり、`loadScoped` が `c.get('userId')` で絞った Dataset だけを読むことを確認した(統合テストで他の利用者・未認証 401・一時パスワード 403 も固定)。
- `/summary`・`/diagnosis`・`/defense-line`・`/statements` の経路は変えていない。`analysis.ts` の差分は算出月数の定数化だけ。
- `rg` の結果(実行記録は [`evidence.md`](evidence.md)):
  - `pages/Guide.tsx` は再輸出 1 行。旧 `guide-sections.ts` の現在値の合成は core の `GUIDE_TERM_CURRENT` へ移った。`guide-sections.ts` は用語集の文言と core の現在値を並べる書式だけを持つ。
  - web と api に信頼度の境界比較(80 / 60 / 50)は 0 件。
  - 防衛ラインの説明で『直近3か月 / 3ヶ月』を直書きしている箇所は、実装コードでは 0 件。残るのは `packages/core/test/defense-forecast-contract.test.ts:35` のコメント 1 件で、feature の resource_scope の外のため据え置いた。損益分岐点・予算・診断などの『直近3ヶ月』は防衛ラインとは別の算出なので対象外。
  - web で `@kanjo/core` から使い方画面の規則を読むのは `pages/guide/view-model.ts` だけ。フッタ(`Layout.tsx`)が読むのは `data-notice.ts` の `AI_DATA_NOTICE` だけ。
  - `REVIEW_CONFIDENCE_THRESHOLD = 80` のまま。migrations と `packages/api/src/db/schema.ts` の差分は 0 件。
- scope_out の侵犯は 0 件。`routeMetadata.ts` と `classify.css` は範囲外として触っていない。

## 11. 品質(P09)

- `/guide` は既存の lazy route のままで、初期 JS には含まれない(`build:bundle` 直後の `check:js-budget` の結果は [`evidence.md`](evidence.md))。
- 状態を色だけで伝えない: 信頼度は段階の文字と %、ステッパーは完了 / 未完了の文字、純収支は符号(+ / −)。
- 検索語は React のテキストとして描き、`/api` へ送らない。fetch の宛先は同一オリジンの `/api` だけで、CSP は変えていない。
- 下部固定バーは 640px 以下でタブバーの上に置き、安全領域の余白(`env(safe-area-inset-bottom)`)を足す。

## 12. リリース(P13)

- commit・push・PR の作成は、利用者の指示があるまで行っていない。`verify:full` の結果は [`evidence.md`](evidence.md) に記録する。配信後の確認(総収支の一致・防衛ラインと要確認の判定が変わらないこと・ヘッダとフッタの文言)は merge と配信の後に行う。
