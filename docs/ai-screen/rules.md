# AI分析画面の規則表

AI分析画面(`/ai`)の数値・段階・表示の規則と、それを実装しているコード、固定しているテストの対応表。画面仕様の正本は `specs/spec-ai-analysis-screen.md`、判断の経緯は [`design-decisions.md`](design-decisions.md)、受入の証跡は [`evidence.md`](evidence.md)。

規則を変えるときは、この表の行・core の実装・テストの期待値を同じ変更で直す。どれか 1 つだけを直すと、テストが落ちるか、この表が実装と食い違う。

「根拠」の列は、その値を誰が決めたかを表す。`利用者` は利用者の決定、`推定` は spec が **agent 推定・利用者未確認** と注記した値である。推定の値は利用者の確認で変わり得る([`design-decisions.md`](design-decisions.md) §3)。

## 1. 依頼の段階と進捗

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R1 | 段階は記録と現在時刻から毎回導き、保存しない。上から順に最初に当たったものを採る: 取り消し済み → キャンセル / 受信済み → 完了 100% / 結果なしで期限切れ → 失敗 / 差し戻しあり → 実行中 75% / データ取得済み → 実行中 50% / それ以外 → 待機中 0% | 段階の意味は利用者、優先順は推定 | `packages/core/src/ai-screen.ts` `aiTaskStage` | `packages/core/test/ai-screen.test.ts`「段階と進捗」1〜6 |
| R2 | 境界: 期限切れと受信が同時なら完了 / キャンセル後に期限が切れてもキャンセル / 差し戻し後にデータを再取得しても 75% / 期限ちょうどの時刻は待機中 | 推定 | 同上 | 同上「境界」4 件(`toBe`) |
| R3 | キャンセルの進捗は数値を出さず「-」 | 推定 | 同上(`progress: null`)、`packages/web/src/pages/ai/view-model.ts` `aiProgressText` | 同上「1 キャンセル」、`packages/web/src/pages/ai/ai-screen.dom.test.tsx`「進捗と依頼内容の表記」 |
| R4 | 旧来の status(done / expired / waiting)は段階から導く | 利用者(api の置き換え) | `aiTaskLegacyStatus` | `ai-screen.test.ts`「旧来の status は段階から導く」 |
| R5 | エージェントのデータ取得・結果送信と画面貼り付けは、段階がキャンセル・失敗・完了なら拒否する。表示と操作可否は core の `aiTaskStage` / `aiTaskCapabilities` を共有する | 利用者 | `packages/api/src/routes/ai.ts` `resultRefusal`、`packages/web/src/pages/ai/view-model.ts` | core capability テスト、統合テスト「取り消し」 |
| R6 | データ取得は初回の時刻だけを記録する。応答直前の CAS で使用済み・取消・期限を再確認し、競合で負けたらデータを返さない | 推定 | `routes/ai.ts` `GET /ai/tasks/:id/data` | 統合テスト「データ取得は初回の時刻だけを残し…」「payload構築中に取り消されたら…」 |
| R7 | 契約違反(構文・形・内容)の送信は差し戻しとして回数を数える。受信後・取り消し後は数えない。取込データが無い 400(`no_data`)は数えない | 利用者 | `routes/ai.ts` `recordReject` | 統合テスト「契約違反の送信…」 |
| R8 | 結果待ち(待機中・実行中)が 1 件でもあるあいだだけ、依頼一覧を 10 秒ごとに取り直す | 推定 | `packages/web/src/pages/ai/view-model.ts` `aiTasksRefetchMs`(`AiPage.tsx` の `refetchInterval` が使う) | `ai-screen.dom.test.tsx`「結果待ちがあるあいだだけ 10 秒ごとに取り直す」 |

## 2. 依頼の操作

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R9 | 段階ごとに出す操作: 待機中・実行中 = キャンセル / 完了 = 詳細 / 失敗・キャンセル = 再実行と削除。可否は core の capability 表から導く | 推定(キャンセル行の操作) | `aiTaskCapabilities`、`view-model.ts` `aiTaskActions` | core capability テスト、`ai-screen.dom.test.tsx`「段階ごとの操作」 |
| R10 | キャンセルは `used_at IS NULL AND canceled_at IS NULL` を条件にした 1 文で行う。取り消し済みなら時刻を変えずに 200(冪等) | 推定 | `routes/ai.ts` `POST /ai/tasks/:id/cancel` | 統合テスト「待機中の依頼を取り消すと…2回目は時刻を変えずに 200」 |
| R11 | 受信済みのキャンセルは 409 `already_done`、期限切れは 409 `already_expired`、他人・存在しない依頼は 404 | 推定(`already_expired`) | 同上 | 統合テスト「受信済みは 409 already_done…」 |
| R12 | 再実行は失敗・キャンセルの依頼だけ。期間・補足指示・再分析元を引き継ぎ、新しい番号とトークンで発行する。元の行は残す | 推定(キャンセルも対象) | `routes/ai.ts` `POST /ai/tasks/:id/retry` | 統合テスト「再実行」2 件 |
| R13 | 完了の依頼は削除できない(409)。レポートの出所だから | 利用者 | `routes/ai.ts` `DELETE /ai/tasks/:id` | `packages/api/src/ai-lifecycle.test.ts`「受信済みの依頼は…409」 |

## 3. 表示

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R14 | 表示 ID は `T-` と 4 桁のゼロ埋め。10000 以上は桁をそのまま、`seq` が無い既存行は「旧」と作成日(Asia/Tokyo) | 推定(桁) | `aiTaskDisplayId` | `ai-screen.test.ts`「T-番号」 |
| R15 | 通し番号は利用者ごとに `max(seq)+1`。`(user_id, seq)` の一意索引に衝突したら 1 回だけ採り直す | 推定 | `routes/ai.ts`(採番、`isUniqueViolation` は drizzle の `cause` を辿る) | 統合テスト「通し番号と表示ID」「同時発行で (user_id, seq) に衝突したら 1 回だけ採り直し…」、`ai-migration-0048.test.ts` |
| R16 | 版の説明は、その版を発行した依頼の補足指示の最初の空でない行。補足指示が無ければ v1 は「初回レポート」、v2 以降は「最新のデータで再分析」 | 利用者 | `aiVersionNote` | `ai-screen.test.ts`「版の説明」、統合テスト「版の説明」 |
| R17 | レポートを 要約 / 根拠データ / 背景仮説 / 改善提案 / 関連リンク の 5 タブへ振り分ける。主な発見は `keyFindings` の 3 分類を並べ、priority が high → mid → low → なし の順、同順位は配列の順で上位 3 件 | 利用者(5 タブ。2026-09-21 に利用者が実装どおりの 5 タブへ決め直した。旧: 4 タブ)、推定(選び方) | `aiReportTabs`、`aiTopFindings` | `ai-screen.test.ts`「タブの振り分け」(`toEqual`) |
| R18 | 使用するデータの件数: 期間内の freee 取引、期間内で集計対象の MF 明細(振替と対象外を除く)、科目の種類数(freee と MF を別に数える)、取引先の種類数。dataset はカードと同じ期間の依頼だけ開ける | 推定 | `routes/ai.ts` `GET /ai/inventory`、`AiInventoryCard` | 統合テスト「使用するデータの件数」、DOM 期間不一致テスト |
| R19 | 取り込み先になる依頼の既定は、実行中 → 待機中 → 最新の完了 の順で最初の 1 件。URL は見ない(依頼は `/ai/tasks/:id` で開く) | 推定 | `aiDefaultSelectedTask` | `ai-screen.test.ts`「実行中 → 待機中 → 最新の完了」 |
| R20 | レポート一覧の検索は、レポート名・要約内容・対象期間の表示に対する、大文字小文字を区別しない部分一致 | 推定 | `aiReportMatches` | `ai-screen.test.ts`「レポート一覧の検索…」 |
| R21 | URL の検索パラメータに残すのはタブ(`tab`)だけで、既定の要約は付けない。依頼とレポートはパスで表す(`/ai/tasks/:taskId`、`/ai/reports`、`/ai/reports/:reportId`)。旧 `task` / `report` クエリは状態として復元しない。壊れた `tab` は既定の要約へ戻し、画面を失敗にしない | 利用者(2026-09-21 に利用者が実装どおりのパス分割へ決め直した。旧: FR-14 の `task` / `report` / `tab`) | `view-model.ts` `readAiUrl`、`AiReportPages.tsx` `AiReportPage`、`AiTaskDetailPage.tsx`、`AuthenticatedApp.tsx` のルート定義 | `ai-screen.dom.test.tsx`「専用URLの report と tab から詳細を復元し、5 タブを矢印キーで移れる」「壊れた tab は既定の要約へ倒し…」「readAiUrl はタブだけを読み、旧 task/report クエリは状態として復元しない」 |

## 4. 取り込みと下書き

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R22 | 取り込んだ JSON の構文エラーは、最初のエラーの行と列(1 始まり)を core の走査で出す。実行環境の `JSON.parse` の文言には頼らない | 推定 | `jsonErrorPosition`、`aiJsonErrorMessage` | `ai-screen.test.ts`「JSON 取り込みエラーの行と位置」 |
| R23 | 補足指示の下書きは `kanjo:ai:supplement-draft:{利用者ID}` に保存する。1000 字を超える値は保存しない。読み書きの例外は握って画面を止めない | 推定 | `aiDraftKey`、`saveAiDraft`、`loadAiDraft`、`clearAiDraft` | `ai-screen.test.ts`「補足指示の下書き」 |
| R24 | レポート送信・貼り付けは固定 4 MiB の request budget。境界値までは読み込みへ進み、1 byte 超過は JSON 読み込み前に 413。個別 field・配列は contract validator が検証する。キャンセル・再実行は 4KB | 推定([`design-decisions.md`](design-decisions.md) §4) | `contract.ts` `REPORT_BODY_MAX_BYTES`、`routes/ai.ts` `ACTION_BODY_MAX_BYTES` | 統合テスト「送信の大きさ上限 (4 MiB)」「本文が 4KB を超える取り消し要求は 413」 |
| R25 | エージェントへ渡すデータは集計値だけ。明細ID・摘要・freee memo を含めず、freee は候補計算に必要な列だけ SELECT する | 利用者 | `packages/api/src/ai/dataset.ts`、`routes/ai.ts` `agentPayload` | 統合テスト「集計値だけで、明細ID・摘要・freeeメモを含まない」 |

## 5. 保存(migration 0046 / 0047)

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R26 | 0046 は列と索引の追加だけ。既存の行は 1 行も書き換えない。`ai_reports` は変えない | 利用者 | `migrations/0048_ai_task_stages.sql` | `ai-migration-0048.test.ts`「当てても行の更新は 0 件」「既存の列の値はそのまま…」 |
| R27 | 段階名と進捗 % は列に持たない(R1 で毎回導く) | 利用者 | 同上 | 同上、`packages/api/src/schema-guard.ts` |
| R28 | task claim と report INSERT は D1 batch で原子的に行う。同じ版系列の版番号は一意。旧重複版は本文・参照を失わず作成順に連番化し、同一taskの今後の重複INSERTはtriggerで拒否する | 利用者 | `routes/ai.ts` `storeReport`、`0049_ai_report_invariants.sql` | 原子性・同時受信・0047 migration テスト |
| R29 | レポート本文は物理削除せずアーカイブする。旧DELETE経路も参照を保ったままアーカイブへ変換する | 利用者 | `PUT /ai/reports/:id/archive`、互換 `DELETE /ai/reports/:id` | `ai-lifecycle.test.ts`「旧DELETE経路の安全なアーカイブ互換」 |
