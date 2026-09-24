# 改善リクエスト画面の規則表

改善リクエスト画面(`/improvement`)の状態・一覧・詳細・削除・保持の規則と、それを実装しているコード、固定しているテストの対応表。画面仕様の正本は `specs/spec-improvement-screen.md`、判断の経緯は [`design-decisions.md`](design-decisions.md)、受入の証跡は [`evidence.md`](evidence.md)。

規則を変えるときは、この表の行・core の実装・テストの期待値を同じ変更で直す。どれか 1 つだけを直すと、テストが落ちるか、この表が実装と食い違う。

「根拠」の列は、その値を誰が決めたかを表す。`利用者` は利用者の決定、`推定` は spec が **agent 推定・利用者未確認** と注記した値である。推定の値は利用者の確認で変わり得る([`design-decisions.md`](design-decisions.md) §3)。

core は `packages/core/src/improvement-screen.ts`(以下 `screen`)と `packages/core/src/improvement.ts`(以下 `improvement`)。core のテストは `packages/core/test/improvement-screen.test.ts`(以下 core)。

R10 は本文・関連ページ・診断の文字列に対する規則である。撮影画像はブラウザの DOM 複製で一般文字を伏字にし canvas をプレースホルダー化するが、API は JPEG/PNG と 2MB 以下を確認してバイト列を保存する。画像内の機密情報をサーバで再マスクする保証はないため、作成フォームで利用者が送信前にプレビューを確認する。

## 1. 状態と作成

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R1 | 状態は 受付 / 対応中 / 完了 / 再確認 の 4 値。遷移は 受付→対応中・完了 / 対応中→受付・再確認・完了 / 再確認→対応中・完了 / 完了→対応中・再確認。許されない遷移は 409 `invalid_transition`、同じ状態は 200 で履歴を増やさない。`done_at` は完了に入ったときだけ付き、出たら外れる | 状態は利用者、遷移表は推定 | `screen` `IMPROVEMENT_TRANSITIONS`・`canTransitionImprovement`・`allowedImprovementTransitions`・`nextImprovementDoneAt`、`packages/api/src/routes/improvement.ts` の状態変更 | core「AC-001 状態の遷移表」4 件、`packages/api/src/improvement-screen.integration.test.ts`「受付から対応中で 200・履歴 1 行…」「同じ状態は 200 で、履歴は増えない」「旧 wontfix を含む候補外の値は 400、許されない遷移は 409」 |
| R2 | 送信できるのは、本文が空でなく 1000 字以下で、プライバシー確認の 2 つが両方チェック済みのときだけ。止める理由の文は core が決める。DB の CHECK は 4000 字のまま | 利用者(1000 字)、文言は推定 | `improvement` `IMPROVEMENT_NEW_BODY_MAX`、`screen` `checkImprovementDraft`・`IMPROVEMENT_DRAFT_MESSAGES`、`packages/web/src/pages/improvement/CreateForm.tsx` | core「本文の空・1000 字超・確認の未チェックで送信できない」、api 統合「1000 字ちょうどは 201、1001 字は 400」「プライバシー確認の片方が欠けると 400」 |
| R3 | 概要は最初の空でない行を trim し、40 字を超えたら 40 字で切って「…」を付ける | 推定 | `screen` `improvementSummary` | core「AC-002 概要と AC-015 の作成フォーム」 |
| R4 | 番号は利用者ごとの連番 `seq` を `IMP-` と 3 桁のゼロ詰めで出す(4 桁以上はそのまま)。削除しても再利用しない | 番号の形は利用者、桁は推定 | `screen` `formatImprovementNumber`、`improvement_request_counters`(0054) | core「AC-003 IMP 番号」、`packages/api/src/improvement-migration-0054.test.ts` |

## 2. 一覧と詳細

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R5 | 検索は NFKC と英字の大小を同一視した部分一致。当てる先は本文・IMP 番号(`IMP-024`・`024`・`24`)・関連ページ名。検索語は 100 字で切る | 推定 | `screen` `normalizeImprovementSearchText`・`matchesImprovementQuery`・`IMPROVEMENT_QUERY_MAX` | core「全角半角・大小を同一視し、IMP 番号は 3 通りの書き方で当たる」 |
| R6 | 新しい順に 1 ページ 10 件。件数タブの数は検索後・削除中を除いた集合で数え、タブでは絞らない。範囲外のページは最後のページ、壊れた値は既定に倒す | 推定 | `screen` `buildImprovementList`・`normalizeImprovementListQuery`・`IMPROVEMENT_PAGE_SIZE`・`improvementPageRangeText` | core「新しい順に 10 件…」「範囲外のページは最後のページに倒し…」「タブで絞っても件数は検索後の集合のまま」 |
| R7 | 関連する依頼は同じ route の新しい順に最大 3 件。自分・削除中・空の route を除く。画面名はクエリを落として core の表から引く | 推定(画面名の表は OI-05) | `screen` `relatedImprovements`・`IMPROVEMENT_ROUTE_LABELS`・`improvementRouteLabel` | core「関連する依頼は同じ route の…」「画面名はクエリを落として引き…」、`packages/web/src/improvement-route-labels.test.ts` 2 件 |
| R8 | アクティビティは `created` / `status_changed` / `reissued` / `deleted` / `restored` / `migrated_wontfix` の 6 種類。追記専用で、新しい順(同時刻は id の降順)。見出しと説明は core が組む。コピーは履歴に書かない | 種類は推定 | `screen` `IMPROVEMENT_ACTIVITY_KINDS`・`describeImprovementActivity`・`orderImprovementActivities`、`improvement_request_activities`(0054) | core「6 種類の見出しと説明」「新しい順に並べ、同時刻は id の降順」 |
| R9 | 診断の要約は OS・ブラウザ(版を伏せる)・画面サイズ(倍率を落とす)・利用環境(origin から)・セッション ID の末尾 4 桁 | 推定 | `screen` `summarizeDiagnosticEnvironment`・`maskImprovementSessionId` | core「OS・ブラウザ (版を伏せる)…」「web が記録する『幅x高さ@倍率』の倍率を落として…」「sessionId と origin は…」 |
| R10 | マスクは 口座・取引先名・金額(円と記号)・個人名・メール・電話・住所・秘匿値 の 8 種類を `***` にする。辞書は 2 字未満と伏字を含む語を除き、長い順に当てる。ブラウザは辞書を使わない規則だけ、サーバは辞書を含めて掛け直す | 対象は利用者、辞書の扱いは推定(OI-03) | `improvement` `redactPersonalInfo`・`buildMaskDictionary`・`IMPROVEMENT_MASK`、`packages/web/src/capture-screen.ts`、`packages/api/src/improvement/redact.ts` | core「AC-006 マスク (7 種と秘匿値)」、`packages/api/src/improvement-redaction.test.ts`「サーバ側の再マスク」、DOM「撮影用の複製で金額を伏せる (AC-016)」 |
| R11 | 画面の状態は URL のキー `id` / `tab` / `q` / `page` に書く。既定値は書かない。URL の `id` が見つからなければ選択を外す | 推定 | `packages/web/src/pages/improvement/view-model.ts` `readImprovementUrl`・`writeImprovementUrl` | `packages/web/src/pages/improvement/improvement-screen.dom.test.tsx`「タブ・検索語・選択が URL から復元される」「タブとページの操作は URL に書かれ、既定値は書かない」「URL の id が見つからなければ…」 |

## 3. 削除と保持

| # | 規則 | 根拠 | 実装 | テスト |
|---|---|---|---|---|
| R12 | 削除は論理削除(`deleted_at`)で、確認ダイアログを出さず、トーストの『元に戻す』で同じ id と番号のまま戻す。削除中でない行の restore は 200 で、`updated_at` も履歴も変えない。削除中の行は一覧・件数に出ず、詳細・画像・指示文・コピー記録・状態・agent の 2 経路で 404 | 論理削除は利用者、冪等と 404 は推定(OI-06) | `packages/api/src/routes/improvement.ts` の削除・`/improvements/:id/restore`、`packages/web/src/pages/improvement/Toasts.tsx` | api 統合「削除から復元で同じ id と seq が一覧に戻り…(AC-008)」「削除中でない行の restore は 200 で…」、DOM「削除すると一覧から消え、『元に戻す』で同じ番号が戻る」 |
| R13 | `deleted_at` から 30 日を 1 日でも過ぎた行は、夜間 job が R2 の画像・行・履歴ごと消す。R2 の削除に失敗した行は残し、翌晩に回す。削除中の行は完了から 30 日の添付削除の対象にしない。夜間の枠は `improvement_retention: 4`、合計 `PLAN_MAX` 49 | 30 日は利用者、枠は推定(OI-07) | `improvement` `IMPROVEMENT_RETENTION_DAYS`、`runImprovementRetention`、`packages/api/src/scheduled-maintenance-budget.ts` | `packages/api/src/improvement-retention.test.ts`「論理削除から30日の完全消去 (AC-010)」3 件、`packages/api/src/scheduled-maintenance-budget.test.ts` |
| R14 | 0054 で旧 `wontfix` は完了へ移す。元の `done_at` は残し、NULL なら適用時刻を入れる。その行にだけ `migrated_wontfix` の履歴を 1 行書く | 移行は利用者、`done_at` の起点は推定 | `migrations/0054_improvement_request_screen.sql` | `packages/api/src/improvement-migration-0054.test.ts`「wontfix は done へ移り…」「全行に作成の履歴が 1 行ずつ…」 |

## 4. 重複の禁止

web と api は core が導いた値を写すだけで、R1〜R10 の計算を書き直さない。確認の手順は [`design-decisions.md`](design-decisions.md) §7 の P08 の監査にある。
