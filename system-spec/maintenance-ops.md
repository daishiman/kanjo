---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G3, G4, G5]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-settings-maintenance-ops-web-003。裏付け質疑 (`qa_refs`): `qa-settings-maintenance-ops-web-evidence-001`, `qa-settings-maintenance-ops-web-002`, `qa-settings-maintenance-ops-web-004`, `qa-settings-decision-007`, `qa-settings-decision-008` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、maintenance-ops ではスマートフォン向け専用アプリの版ごとに設定 JSON の形式の互換を保ち、端末ごとのバックアップの失敗をどう知らせるかを決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、maintenance-ops ではタブレット向け専用アプリの版ごとに設定 JSON の形式の互換を保ち、端末ごとのバックアップの失敗をどう知らせるかを決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、maintenance-ops ではWindows 向けデスクトップアプリの版ごとに設定 JSON の形式の互換を保ち、端末ごとのバックアップの失敗をどう知らせるかを決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、maintenance-ops ではLinux 向けデスクトップアプリの版ごとに設定 JSON の形式の互換を保ち、端末ごとのバックアップの失敗をどう知らせるかを決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、maintenance-ops ではmacOS 向けデスクトップアプリの版ごとに設定 JSON の形式の互換を保ち、端末ごとのバックアップの失敗をどう知らせるかを決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 設定画面の保守運用では、設定の変更を追記のみの履歴で辿れ、バックアップの失敗を画面で知らせ、設定の誤りは D1 全体を上書きせずに設定 JSON の復元か直前値へ戻す手順で直す形へ反映した (障害時の最後の手段として D1 Time Travel を残す)。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4, G5

#### 主たる接地根拠: `qa-settings-maintenance-ops-web-003`

**問**

web の設定画面の maintenance-ops 要件のうち、利用者の決定・承認に遡れるものは何か。

**答**

web の設定画面の保守運用要件 (決定 007・008・C3・S5・O5 に基づく): 設定の変更は追記のみの変更履歴で、誰がいつ何を変えたかを辿れる (決定 008)。夜間バックアップの失敗は一覧に『失敗』として出て、利用者が気づける (決定 007)。migration は追加のみ (C3)。既存の設定機能のテストは緑のまま保ち、verify:full を緑にする (S5・O5)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が決めた・承認したものだけから書き起こした要件。出所は 画像 design/FINAL-UI/images/18-settings.png (利用者が正本と指示)、U1-U9 (appr-foundation-settings-001)、決定 qa-settings-decision-001〜010 と qa-settings-target-platforms-001。仕組みの選択 (パス・保存先の形・部品名・具体値) は同じ章の -002 と -004 (agent-inference) に分けた。 / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-maintenance-ops-web-evidence-001`

**問**

web の設定画面の maintenance-ops について、既存コードで何が観測できるか。

**答**

設定変更の監査記録は無い (audit-log.ts:248 の action は delete/undo/import_resolution に限る)。夜間バックアップの失敗は画面に出る経路が無い。既存テストに settings-restore.dom.test.tsx・backup-restore.dom.test.tsx・owner-labels.integration.test.ts がある。前例 (予算) は docs/budget-screen/ に設計判断と証拠、spec-reflection-receipt を置く。verify:full は 4175 の vite を前提とする。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存コードの読解 (HEAD 0ed2d8c、Explore 調査) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-maintenance-ops-web-002`

**問**

web の設定画面の maintenance-ops で、利用者が決めていない具体値は何か。

**答**

具体値の推定: 設定 JSON の版を上げるときは core に移行関数を置き、古い版の復元を 1 世代まで受ける。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者確認も検証可能な出典も経ていない具体値。実装時に確かめる) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-maintenance-ops-web-004`

**問**

web の設定画面の maintenance-ops で、利用者が選んでいない仕組みの選択は何か。

**答**

仕組みの選択の推定 (maintenance-ops): docs/settings-screen/ に設計判断 (集計ルールの 2 種別と適用順・現金上書きの意味・設定 JSON の形式と版・バックアップの状態) と画面の証拠を置き、docs/data-schema.md と docs/ui-decisions.md を更新する。migration が途中で止まったときは Deploy の再実行で収束させる既存の手順に従う。設定 JSON の版を上げるときは core に移行関数を置き、古い版の復元を 1 世代まで受ける。設定だけの誤りは設定 JSON の復元か『元に戻す』で直し、D1 Time Travel は障害時の最後の手段に残す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者が選んでいない仕組みの選択。実装時に確かめる) / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-decision-007`

**問**

自動バックアップをどうするか。画像は『毎日 午前2:00』・ステータス (最新 / 成功)・メモ・比較・復元。現状は毎日 3:00 (JST) に全データを R2 へ保存、30 日保持、失敗はログのみ。

**答**

2:00 に変更＋状態・メモ・比較を足す (推奨)。cron を JST 2:00 に変え、各バックアップに状態 (成功 / 失敗)・メモ・設定部分の要約を持たせ、失敗も一覧に出す。『比較』はその日の設定と現在の設定の差分を表示する。中身は従来どおり全データ。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_017h7b4GCCbCPCw944pbShTE の questions[2]、提示 2026-09-22T08:25:32Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】自動バックアップをどうしますか？ 画像は『毎日 午前2:00』・ステータス（最新/成功）・メモ・比較・復元。現状は毎日 3:00(JST) に全データを R2 へ保存、30日保持、失敗はログのみです。 【選択肢】(1)『2:00に変更＋状態・メモ・比較を足す (推奨)』— cron を JST 2:00 に変え、各バックアップに状態（成功/失敗）・メモ・設定部分の要約を持たせる。失敗も一覧に出す。『比較』はその日の設定と現在の設定の差分を表示。中身は従来どおり全データ。 (2)『3:00のまま、表示を実際に合わせる』— 実行時刻は変えず、説明文を『午前3:00』にする。状態・メモ・比較は足す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-22T08:26:39Z)

#### 裏付け質疑: `qa-settings-decision-008`

**問**

右パネルの『最終更新 (更新者)』と『このルールを元に戻す』は何を基準にするか。

**答**

変更履歴表で直前の保存値へ (推奨)。設定の変更を追記のみの履歴表 (変更前・後・更新者・日時) に残し、『元に戻す』はそのルールの直前の保存値を下書きへ戻す (保存で確定)。更新者は利用者名、復元や移行で入った値は『システム』。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_017h7b4GCCbCPCw944pbShTE の questions[3]、提示 2026-09-22T08:25:32Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】右パネルの『最終更新（更新者）』と『このルールを元に戻す』は何を基準にしますか？ 【選択肢】(1)『変更履歴表で直前の保存値へ (推奨)』— 設定の変更を追記のみの履歴表に（変更前・後・更新者・日時）残し、『元に戻す』はそのルールの直前の保存値を下書きへ戻す（保存で確定）。更新者は利用者名、復元や移行で入った値は『システム』。 (2)『未保存の編集だけを戻す』— 履歴は持たず、行に更新日時・更新者の列だけ足す。『元に戻す』は最後に保存した値への取消しになる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-22T08:26:39Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 設定を安全に保存する。全節の編集を 1 つの下書きに集め、未保存の件数を数え、localStorage へ自動保存・復元し、リセットと離脱の前に確認する。保存は baseSavedAt つきの 1 回の PUT で、他所の更新と競合したら 409 で上書きを防ぐ。設定の変更は追記のみの変更履歴表に 変更前・変更後・更新者・日時 を残し、右パネルの最終更新・更新者と『このルールを元に戻す』(直前の保存値を下書きへ戻す) はそこから導く。復元や移行で入った値の更新者は『システム』とする。
- **G4**: 設定を持ち出し・戻せるようにする。設定のエクスポートは集計ルール・名義・統計・現金上書きだけを版番号つき JSON で出し、復元は同じ形だけを受ける (厳密な形の検証・サイズ上限・差分プレビューと確認・復元直前に現在の設定を自動退避)。取引は消えない。マトリクス CSV・取引 CSV・レポート HTML は選択中の期間で出す。自動バックアップは毎日 JST 2:00 に実行し、各回に 状態 (成功 / 失敗)・メモ・設定部分の要約 を持たせて失敗も一覧に出し、『比較』でその日の設定と現在の設定の差分を見てから『復元』できる。
- **G5**: 既存のデータと安全性を壊さない。migration は追加のみで既存行の書き換えは 0 件、既存の設定値は初回に同じ意味で引き継ぐ。設定系の変更 API は認証・パスワード変更強制・スキーマ確認・canonicalMutationFence の内側に置き、公開向けの入力検証 (詳細を外に出さない) と本文サイズ上限を掛ける。外部送信は 0 件で、画像に無い既存の設定機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版からの初期移行) は 1 つも消さない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 保存が 1 回にまとまり、競合と取り消しが安全に扱える。 | API 結合テストで、古い baseSavedAt の PUT が 409 を返して行が変わらず、保存ごとに変更履歴が追記され (更新・削除は 0 件)、『元に戻す』が直前の保存値を返す。DOM テストで未保存件数・下書きの復元・リセットと離脱の確認が動く。 |
| O4 | 設定の書き出し・復元・バックアップが安全に往復する。 | 書き出した JSON を復元すると設定が一致し取引件数は不変、形の違う JSON・上限超過・版違いは 4xx で拒否され何も変わらない。復元前の自動退避が 1 件増える。scheduled のテストで 2:00 の実行が状態つきで保存され、失敗も一覧に出る。比較が差分を返す。 |
| O5 | 既存データと安全性の回帰が 0 件である。 | migration が追加のみで既存行の書き換え 0 件、既存の設定値が初回に引き継がれる。設定系の新 API が CANONICAL_MUTATION_ROUTES に登録され、未認証 401・本文上限超過 413・不正入力で詳細を返さない。外部送信 0 件。既存の設定機能の DOM テストが引き続き緑。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Settings.tsx を pages/settings/ 配下へ分割し、見出し・期間タブ・節ナビ・各節・説明パネル・保存バーの構成に作り直す。画像外の既存機能はアカウント / その他の管理の節へ移す。
- **I2**: core に設定画面の算出 (仮称 settingsScreen) と、集計ルールの照合・適用 (勘定科目 / 取引先)・現金上書きの解決・設定 JSON の検証と差分を新設する。
- **I3**: 集計ルールと現金上書きの列追加・変更履歴表の追加のみの migration と、GET / PUT の設定 API (baseSavedAt つき・409・変更履歴の追記) を作り、canonicalMutationFence に登録する。
- **I4**: 下書きの localStorage 自動保存・復元・未保存件数・リセットと離脱の確認を予算画面の先例 (draft.ts・BudgetSaveBar) にならって作る。
- **I5**: 設定のみの JSON 書き出し・復元 API (版番号・厳密検証・サイズ上限・差分プレビュー・復元前退避) と、出力 3 種の期間連動を作る。
- **I6**: 夜間バックアップを JST 2:00 にし、R2 の customMetadata に状態・メモ・設定要約を持たせ、失敗も記録する。一覧 API に状態・メモ、比較 API に差分を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card を適用した。Intention-revealing names: 変更履歴・元に戻す・失敗の状態を、画面・API・docs で同じ語にする。Executable examples: 集計ルールの適用順と現金上書きの 4 通り、復元の拒否を、内部構造ではなく観測できる結果としてテストに置く。Continuous refactoring: 457 行の Settings.tsx を節ごとに分け、既存機能のテストを緑のまま小さく移す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-22T09:45:25Z)

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-time-travel | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/time-travel/ | 2026-09-22T08:43:18Z | 2026-09-22T08:43:18Z |
