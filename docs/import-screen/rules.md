# データ取込画面の規則表

データ取込画面(`/import`)の上限・状態・履歴・安全の規則と、それを実装しているコード、固定しているテストの対応表。画面仕様の正本は `specs/spec-import-screen.md`、判断の経緯は [`design-decisions.md`](design-decisions.md)、受入の証跡は [`evidence.md`](evidence.md)。

規則を変えるときは、この表の行・core の実装・テストの期待値を同じ変更で直す。どれか 1 つだけを直すと、テストが落ちるか、この表が実装と食い違う。

「根拠」の列は、その値を誰が決めたかを表す。`利用者` は利用者の決定、`推定` は spec が **agent 推定・利用者未確認** と注記した値である(spec 948 行の一覧)。推定の値は利用者の確認で変わり得る([`design-decisions.md`](design-decisions.md) §3)。

## 1. 上限

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R1 | 上限値は core の `IMPORT_LIMITS` 1 か所だけに置く: 1 ファイル 25MB / 10 ファイル / 合計 30MB / 展開後 60MB / エントリ 1,000 / 非表示 100 件 / 片づけ 500 行 / ファイル名 255 文字 / 検査 30 回/分 / 確定 5 回/分 / 仮置き 24 時間 / 取り消し 30 日。MB は 1,048,576 byte | 上限値は利用者、MB の定義は推定 | `packages/core/src/import-screen.ts` `IMPORT_LIMITS`・`IMPORT_MB` | `packages/core/test/import-screen.test.ts`「上限値の定数」 |
| R2 | web・api の取込経路に上限の数値リテラルを書き写さない | 利用者(規則を 1 か所に) | 対象 10 ファイルが `IMPORT_LIMITS` を import する | `packages/api/src/import-limits-literal.test.ts`(旧 `25*1024*1024` を拾うことで検出器自体を検算) |
| R3 | 判定の順はファイル数 → 1 ファイル → 合計。最初に当たった 1 件を `{kind, reason, index?}` で返す。ZIP は展開後の大きさとエントリ数を中央ディレクトリだけで判定する | 推定 | `importLimitViolation`、`importArchiveViolation` | core「importLimitViolation の境界」「importArchiveViolation の境界」 |
| R4 | 境界ちょうどは通り、1 byte・1 件でも超えれば止める。この境界 12 件を core の共通表にし、web と api のテストが同じ表を読む | 利用者 | `IMPORT_LIMIT_BOUNDARY_CASES` | core「web・api と共通の境界表」、`packages/web/src/pages/import/import-screen.dom.test.tsx`「送信前の上限判定は core の共通境界表どおり」、`packages/api/src/import-screen.integration.test.ts`「上限は web の送信前判定と同じ共通境界表どおり」 |
| R5 | 本文の上限 = 合計の上限 + 64KiB(multipart の枠)。Content-Length が上限を超えれば本文を読まずに 413、Content-Length が無くても読みながら 413 | 推定(OI-02) | `importBodyLimitBytes`、`packages/api/src/routes/imports.ts` `importUploadBodyLimit` | 統合「413: 本文を読む前に拒否する」の Content-Length あり・無しの 2 件 |
| R6 | API 互換用に残す旧 `POST /imports` にも、本文の上限とファイル数・合計の判定、新経路と同じ確定 5 回/分制限を掛ける。新画面はこの経路を使わない | 利用者(P10 の中2) | `routes/imports.ts` `POST /imports` | 統合「旧来の POST /imports にも同じ本文の上限が掛かる」「旧来の POST /imports も 11 ファイルは 413 に…」「互換 POST /imports も 5 回まで許可し 6 回目を 429」 |
| R7 | 追加は検査 ID ごとの累計で判定する(11 ファイル目は 413) | 利用者 | `POST /imports/inspections/:id/files` | 統合「追加でも検査 ID ごとの累計で 11 ファイル目を 413 にする」 |
| R8 | ファイル名は拒否しない。制御文字とパスの区切りを除き、255 文字を超えれば拡張子を残して切る | 推定 | `packages/api/src/import-pipeline.ts` | 統合「ファイル名は制御文字とパスの区切りを除き…」 |

## 2. ファイルの状態と操作

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R9 | 状態は 6 種。上から最初に当たったものを採る: 確定に失敗 → 失敗 / 確定済み → 取込済み / 送信に失敗(通信・413・429 など) → 失敗(理由つき) / 上限違反・形式エラー・取込済みと同一(強制なし) → 取込不可 / 検査結果あり → 取込準備完了 / 送信済み → 検査中 / それ以外 → アップロード中 | 状態の意味は利用者、優先順は推定 | `importFileState`(送信の失敗は `uploadError` で受ける。api は渡さない) | core「importFileState の優先順位」「送信の失敗は確定の結果より弱く…」、DOM「送信が通信で落ちた行は、理由つきの失敗になり…」 |
| R10 | 操作は状態だけから導く: アップロード中 = キャンセル / 準備完了 = 削除 / 取込不可 = 再試行・削除 / 失敗 = 再試行。確定に含められるのは準備完了だけ | 推定 | `importFileActions`、`importFileSelectable` | core「ファイルの操作と取込可否」 |
| R11 | ステッパーは検査 ID と確定の有無から導く(1 選ぶ / 2 内容確認 / 3 結果) | 推定 | `importStep` | core「ステッパー」、DOM「選ぶと 2 段目と選択件数バー…」 |
| R12 | 要約は準備完了のファイルだけを数える。エラー件数は取込不可だけ(選択バーの errors は取込不可と失敗を数える。意味が違うので別の値) | 推定 | `importInspectionSummary`、`packages/web/src/pages/import/view-model.ts` | core「内容確認の要約」 |
| R13 | web は core が導いた状態を数えるだけで、状態を導き直さない | 利用者(core だけが判定) | `view-model.ts` | P08 の監査(evidence §3) |

## 3. 検査と確定

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R14 | 検査は明細の表を 1 行も書かない。原本は R2 に仮置きし、結果は `import_inspections` / `import_inspection_files` に置く | 利用者 | `POST /imports/inspections` | 統合「明細の表を 1 行も書かず…」 |
| R15 | 確定は本人の未期限切れの検査 ID だけを受ける。確定後は仮置き原本を消し、最小の結果 receipt を期限まで残して、同一選択の再送に同じ結果を返す。他人・期限切れは同じ 404。確定を開始した検査へのファイル追加・削除も 404 | 利用者(再送 receipt は信頼性補正) | `POST /imports/runs`、`import_inspection_files.summary_json`・`error_kind`・`r2_key` | 統合「確定応答を受け取れなくても…」「本人の検査 ID だけで…」「本人以外の検査 ID と期限切れの検査 ID は…」 |
| R16 | 確定は 1 要求 1 ファイル。2 本目以降の run は最初の run の子(`parent_run_id`)にし、履歴は 1 行に保つ | 推定(D1 の query 予算) | `routes/imports.ts`、`import_inspections.run_id` | 統合「最初の確定で選ばなかったファイルは外し…」 |
| R17 | 「前回データを残す」は既定でオン。オンは同じ明細を飛ばし、オフは月単位で入れ替える | 利用者(既定値は推定) | `keep_previous` | 統合「前回データを残す」2 件、DOM「『前回データを残す』は既定でオンで…」 |

## 4. 履歴

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R18 | 結果: 全成功 = 成功 / 成功と失敗が混在 = 一部成功 / 成功 0 件 = 失敗。取り消した回は取り消し済み | 推定 | `importRunResult` | core「取込 1 回の結果」 |
| R19 | 行の操作は結果と経過日数から導く: 失敗・取り消し済み = 詳細・ファイル・削除 / 30 日を過ぎた回 = 詳細・ファイル / 成功 = 詳細・ファイル・置換・取り消し / 一部成功 = 詳細・ファイル・取り消し。API の拒否と画面のボタンが同じ表を見る | 推定 | `importHistoryActions`、`importWithinUndoWindow` | core「履歴の操作」 |
| R20 | 一括削除は記録の非表示(`hidden_at`)で、失敗・取り消し済みだけ、1 回 100 件まで。明細は変えない | 利用者(対象の制限は推定) | `importHistoryHideable`、`POST /imports/runs/hide` | 統合「非表示は 1 回 100 件までで…」「失敗した履歴 100 件は 1 回で…」 |
| R21 | 取り消しは既存の指紋付きの取り消しを使い、run の全ファイルを戻す | 利用者 | `POST /imports/runs/:id/undo` | 統合「取り消しは確認した指紋で…」 |
| R22 | 置換は保存した原本で強制再取込し、新しい取込 1 回として記録する。429 を受けたら Retry-After だけ待って再送する | 推定 | `POST /imports/runs/:id/reimport`、`packages/web/src/pages/import/ImportHistory.tsx` | 統合「置換は保存した原本で…」、`packages/web/src/import-reimport.dom.test.tsx` の 429 再送 |
| R23 | 詳細ペインは `?run=<id>` で開き直せる | 推定 | `ImportPage.tsx` | DOM「?run=<id> で開くと詳細ペインを復元し…」 |

## 5. 安全

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R24 | 変更要求は Origin が自サイトと違えば 403 | 利用者 | 既存の Origin 検査 | 統合「Origin が自サイトと違う変更要求は 403…」 |
| R25 | 検査 30 回/分・確定 5 回/分(利用者 × 種別 × 1 分枠)。超えれば 429 と Retry-After。確定は取込 1 回で 1 回数え、続きの要求は数えない | 利用者(数え方は推定) | `packages/api/src/import-rate-limit.ts` `consumeImportRateLimit` | 統合「検査は 1 分 30 回まで…」「確定は 1 分 5 回まで…」「10 ファイルの確定は続きの要求を数えず…」 |
| R26 | 検査から履歴まで、外部への送信は 0 件 | 利用者 | — | 統合「検査から確定・履歴まで、localhost 以外への要求は 0 件」 |
| R27 | ファイル名は文字として出し、HTML にしない | 利用者 | React の既定のエスケープ | DOM「ファイル名の HTML は要素にならず…」 |

## 6. データと運用

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R28 | migration 0051 は追加だけ。既存の表の UPDATE・DELETE・DROP を含まず、`import_runs` の新しい列は NULL を許す | 利用者 | `migrations/0051_import_inspections.sql` | `packages/api/src/import-migration-0051.test.ts` |
| R29 | 夜間保守が、期限切れの検査・24 時間を過ぎた仮置き・古いレート制限の枠を、1 回 500 行まで消す | 利用者 | `import-rate-limit.ts` `runImportStagingCleanup`、`packages/api/src/scheduled-maintenance-budget.ts` | 統合「夜間保守の片づけ」、`scheduled-maintenance-budget.test.ts` |
| R30 | 配信は Migrate → Deploy の順。0051 を適用する前の Worker は新しい表を読めない | 利用者(運用) | `.github/workflows` の手順 | — (運用の注意。[`design-decisions.md`](design-decisions.md) §9) |
