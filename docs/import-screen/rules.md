# データ取込画面の規則表

データ取込画面(`/import`)の上限・状態・履歴・安全の規則と、それを実装しているコード、固定しているテストの対応表。画面仕様の正本は `specs/spec-import-screen.md`、判断の経緯は [`design-decisions.md`](design-decisions.md)、受入の証跡は [`evidence.md`](evidence.md)。

規則を変えるときは、この表の行・core の実装・テストの期待値を同じ変更で直す。どれか 1 つだけを直すと、テストが落ちるか、この表が実装と食い違う。

「根拠」の列は、その値を誰が決めたかを表す。`利用者` は利用者の決定、`推定` は spec が **agent 推定・利用者未確認** と注記した値である(spec 948 行の一覧)。推定の値は利用者の確認で変わり得る([`design-decisions.md`](design-decisions.md) §3)。

## 1. 上限

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R1 | 上限値は core の `IMPORT_LIMITS` 1 か所だけに置く: 1 ファイル 25MB / 10 ファイル / 合計 30MB / 展開後 15MB / エントリ 1,000 / CSV削除100件 / 片づけ 500 行 / ファイル名 255 文字 / 検査 30 回/分 / 確定 5 回/分 / 仮置き 24 時間 / 取り消し 30 日。MB は 1,048,576 byte | 上限値は利用者、MB の定義は推定 | `packages/core/src/import-screen.ts` `IMPORT_LIMITS`・`IMPORT_MB` | `packages/core/test/import-screen.test.ts`「上限値の定数」 |
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
| R19 | 行の操作は結果と経過日数から導く: 全結果・経過日数にかかわらずCSV削除を提示（帰属を特定できない旧履歴/JSON・処理中は不可）。30日以内の成功は置換・取り消し、一部成功は取り消しも提示。API の拒否と画面のボタンが同じ表を見る | 推定 | `importHistoryActions`、`importWithinUndoWindow` | core「履歴の操作」 |
| R20 | 削除は選択取込に含まれる全CSV・全月の現行import_idに帰属する正本/個別補正/分割/照合判断/履歴/active指紋/保存原本と、過去undoの当該CSV控えを除く不可逆操作。新たなundo控えは作らない。他CSV・共通ルール・手入力現金/負債・アカウントは保持。夜間backupは既存30日保持。共有原本は理由付きで保持、原本削除失敗は耐久outboxへ残して再試行。1回100取込まで、処理中/帰属不明が混じれば一部も消さない | 利用者（2026-10-31の追加要望が旧非表示契約に優先） | `POST /imports/runs/delete/preflight`・`/delete`、`import-source-deletion.ts`。旧`/hide`は410 | `deletion-lifecycle.test.ts` CSV削除回帰・`import-screen.integration.test.ts` |
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
| R28 | migration 0053 は追加だけ。既存の表の UPDATE・DELETE・DROP を含まず、`import_runs` の新しい列は NULL を許す | 利用者 | `migrations/0053_import_inspections.sql` | `packages/api/src/import-migration-0053.test.ts` |
| R29 | 24 時間を過ぎた仮置きは夜間保守が 1 回 500 件まで R2 から消す(D1 は 1 本も使わない)。期限切れの検査と古いレート制限の枠は、検査を新しく作る要求のついでに消す | 利用者(片づけの置き場所は OI-08 の判断) | `import-rate-limit.ts` `runImportStagingCleanup` / `purgeExpiredImportRows`、`packages/api/src/scheduled-maintenance-budget.ts` | 統合「夜間保守の片づけ」「期限切れの行の片づけ」、`scheduled-maintenance-budget.test.ts` |
| R30 | 配信は Migrate → Deploy の順。0053 を適用する前の Worker は新しい表を読めない | 利用者(運用) | `.github/workflows` の手順 | — (運用の注意。[`design-decisions.md`](design-decisions.md) §9) |


## CSV削除の差分判断（2026-10-31 / #84）

履歴1行は取込1回で、複数CSV・子run・各月logical unitをまとめて削除する。確認にはCSV数と現在の対象明細数を先に表示する。所有権は現在のimport_id/active targetを使い、置換済みの過去月やstable IDだけで範囲を広げない。共通仕分けルール/取引先設定はCSV別に帰属できないので保持する。

「取り消す」は従来どおり30日間戻せる操作で、今回のCSV削除と区別する。過去の複数CSV混在undoからは選択分だけを除去し、戻せる件数を残存控えへ合わせる。資産の控えはoperation_idとassets target月の所有権で限定する。総収支/照合の判断undoも該当要素だけ除き、freee重複行の番号変化は存続行の判断を新しい鍵へ再束縛する。

正本の削除・関連データの除去・再集計・outbox intent・監査をwriter所有権guard付きの単一D1 batchで確定する。R2は原子的にできないため完了/待ち/共有保持を別件数で返す。非共有原本はR2 APIの上限1000件以内で一括削除し、成功時にoutboxを一括完了する。失敗時だけ既存nightly cleanupへ引き継ぐ。公開前preview了承が必要。本番削除は本変更の作業範囲に含めない。

要件フラグ差分: 認証境界変更なし（既存tenant隔離を保持）、AI/メール/公開フォーム/リアルタイム追加なし、D1/R2ライフサイクル変更あり。既存Button/確認ダイアログ/配色をそのまま使い、入口と確認文を変更する。新画面/新しい視覚デザイン/スキーマ変更はない。


### #84 検証・品質ゲート

- 匿名RED: 未実装のCSV削除preflightが404となり、複数月明細を削除できないことを再現。GREEN: 所有境界・混在undo・資産控え・lease差替え・D1 rollback/予算拒否・freee #1→#0再束縛・R2失敗/再試行/複数原本即時削除・2MB超明細を検証。
- 関連APIは取込/削除/非有効履歴破棄の3ファイル112件成功。snapshotの行返却へ変更後、CSV回帰13件と2.1MB超の追加1件も成功。core取込/削除/履歴破棄の3ファイル112件、web取込/置換と確認競合・旧形式の理由表示34件成功。全package型検査、full lint、web build/Worker dry-run成功。
- `pnpm run preview` のWorkers上で合成ローカルアカウントにCSV2本・3明細を取り込み、実ブラウザで対象2明細を削除。存続CSVの1明細、active1件、補正0、undo控え0、R2待ち0を確認。総合支出4500→500、同じCSVの再取込で4500へ復帰し、ログインも維持。実データ・本番への変更はなし。
- 差分監査: tenant条件付きprepared SQL、既存認証/Origin検証、固定テーブル名、応答にraw金融データ/R2 keyなし、不可逆確認、writer guard付き原子的batch、R2失敗時outbox保持を確認。差分由来の確定CRITICALは0。既存lockfileのprod auditはcritical1/high4/low2で、認証依存の後続対応は残課題リストの方針を継続（依存更新は本変更外）。
- ステージ: 準備（solo-git-flow、最新mainの別worktree/Issue #84）→要件（app-excellence/mvp-first、上記R20）→設計（design-judgment/ux-design/jp-web-design/12ui参照、既存確認部品を再利用）→実装（workers-best-practices/testing-excellence、RED→GREEN）→公開（wranglerのローカルpreviewまで、本番は未反映・preview了承待ち）→品質（launch-security差分監査、既存依存はCONDITIONAL）。先行のMAIL_FROM未設定による公開停止は本変更と独立。
