---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G4]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-imp-maintenance-ops-web-001。裏付け質疑 (`qa_refs`): `qa-imp-maintenance-ops-web-evidence-001`, `qa-imp-decision-008` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、maintenance-ops では配布したアプリの版ごとの不具合報告と更新の運用を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、maintenance-ops では配布したアプリの版ごとの不具合報告と更新の運用を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、maintenance-ops では配布したアプリの版ごとの不具合報告と更新の運用を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、maintenance-ops では配布したアプリの版ごとの不具合報告と更新の運用を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、maintenance-ops では配布したアプリの版ごとの不具合報告と更新の運用を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 0054 の適用手順 (D1 のバックアップ→migration→Worker のデプロイ) と、失敗したときの戻し方を runbook に置く形へ反映した。夜間の完全消去の結果 (対象件数・消した件数・失敗件数) は、既存の job ごとの JSON ログに本文・利用者 ID・R2 のキーを載せずに出す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G4

#### 主たる接地根拠: `qa-imp-maintenance-ops-web-001`

**問**

maintenance-ops の web の方針を次の内容で確定してよいか。

**答**

core・API・DOM のテストに加え、lint・typecheck・test・skills:test・JS 予算・verify:full をすべて緑にする。0054 は表を作り直すので、適用前にバックアップを取る手順を runbook に書く。docs/improvement-request.md を更新する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 8 カテゴリの web 方針を表で提示し、AskUserQuestion の選択肢『この8カテゴリで確定 (推奨) / 修正して再提示』から利用者が『この8カテゴリで確定』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:16:38Z)

#### 裏付け質疑: `qa-imp-maintenance-ops-web-evidence-001`

**問**

maintenance-ops の web について、現行の実装と画像の差分は何か。

**答**

品質ゲートは pnpm lint・typecheck・test・skills:test・初期 JS 予算 (build:bundle の直後に js-budget)・verify:full (4175 の vite が前提) で、CI の headless Chrome は pointer:none である。改善要望の運用文書は docs/improvement-request.md と architecture/arch-improvement-request-pipeline.md にある。夜間 job の結果は index.ts で job ごとの JSON ログとして出る。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: repo の現物 (該当ファイルと行) と design/FINAL-UI/images/20-improvement.png を読んで観測した事実。answered_at は記録直前に実測した時刻。 / 回答時刻: 2026-09-23T13:17:45Z)

#### 裏付け質疑: `qa-imp-decision-008`

**問**

夜間 scheduledMaintenance の D1 予算は 49/49 (Free の上限 50、1 本は必ず残す) で満杯。削除した依頼を 30 日後に行と履歴ごと消す DELETE を 1 本足すにはどうするか (DB トリガで既存 UPDATE に連動 / 他 job の枠を 1 本回す / 一覧を開いたときに消す)。

**答**

他 job の枠を 1 本回す。回す元は audit_header_retention とする。この job は削除の前後で件数と容量を 2 回読むが、読んだ値はログに書くだけで判定には使わない (容量上限を持つのは detail 層だけ)。そこで削除後の 1 回だけを読み、削除前の件数は削除後の件数と消した件数の和で出す。これで 3→2 本になり、improvement_retention を 3→4 本にする。合計は 49 のまま変えず、新しい Cron も足さない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 3 件 (DB トリガで連動 (推奨) / 他 job の枠を 1 本回す / 一覧を開いたときに消す) を提示し、利用者が『他 job の枠を 1 本回す』を選択。回す元の job (audit_header_retention の削除前の容量の読み取り) は、利用者の選択を受けて repo を調べ、判定に使っていない読み取りを特定したもの。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:16:38Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /improvement を 20-improvement.png どおりの画面にする。問いの見出しと説明・使い方リンク、共通の期間、作成フォーム (スクリーンショット任意と撮り直し/削除、本文 0/1000、プライバシー確認 2 つ必須、自動マスキングの対象の説明、送信)、一覧 (ID・内容・関連ページの検索、すべて/受付/対応中/完了/再確認の件数タブ、選択、ID・関連ページ・概要・状態・作成日・更新日の表、10 件ずつのページング)、詳細パネル (IMP 番号と状態、本文、添付画像と拡大、マスク済み診断情報、アクティビティ、関連する依頼、状態の変更・再発行・Claude Code 用 / Codex 用のコピー・削除)、空状態、読み込み失敗と再読み込み、画面キャプチャの浮動パネル (キャプチャする・範囲を選択する)、選択中バー、コピー完了トーストを描く。
- **G4**: 依頼と添付を安全に保つ。利用者ごとの分離、入力検証 (本文 1000 字・プライバシー確認 2 つ・画像の形式と大きさ)、削除は論理削除で『元に戻す』で戻し 30 日後に夜間処理で本文・画像・履歴を完全消去、使い捨てトークンの再発行、夜間バックアップへ添付を入れない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 改善リクエスト画面が画像の全構成要素を描画する (共通シェルの文言を除く)。 | DOM テストで、問いの見出し・作成フォームの全項目と本文の文字数・プライバシー確認 2 つが未チェックのとき送信不可・マスキングの説明・一覧の検索/5 つの件数タブ/表/ページング・詳細パネルの全区画・空状態・読み込み失敗と再読み込み・キャプチャ浮動パネル・選択中バー・コピー完了トーストの存在を確認し、全て通る。 |
| O4 | 削除・分離・保持期限・既存ゲートを守る。 | API テストで削除→元に戻すで同じ id と番号が戻ること、削除中の行が一覧と件数に 0 件、他の利用者の依頼が 404、30 日経過の完全消去で R2 の画像と履歴が消えること、BACKUP_SNAPSHOT_SQL に改善リクエストの表が無いことが通り、pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Improvement.tsx を pages/improvement/ 配下へ分割し、問いの見出し・作成フォーム・一覧・詳細パネル・空/失敗の状態・選択中バーの構成に作り直す。選択中の依頼・タブ・検索・ページを URL に保つ。
- **I4**: migration 0054 で状態の CHECK の張り替え (wontfix→done の移し替え)、利用者ごとの連番、論理削除の列、アクティビティの表を足し、削除・復元・状態変更・再発行で履歴を書く API と夜間の完全消去を実装する。
- **I5**: 画面キャプチャの浮動パネル (全体と範囲選択) を作り、右下の『改善を送る』から撮影して作成フォームへ移る流れにする。
- **I6**: 入力検証 (本文 1000 字・プライバシー確認 2 つ・状態の候補・画像の形式と大きさ) を core と API の zod で揃え、他の利用者の依頼を 404 にする。

### 本章に効く確定意思決定

- **D-imp-008**: 夜間 scheduledMaintenance の D1 予算は 49/49 (Free の 1 invocation あたり 50 クエリ、1 本は必ず残す) で満杯。削除した改善リクエストを 30 日後に行と履歴ごと消す DELETE を 1 本足すにはどうするか。
  - 採択: 他 job の枠を 1 本回す (`borrow-slot`)
  - 目的適合: G4 の完全消去をアプリのコードとテストに明示したまま満たす。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『Appropriate abstraction / DRY』を、判定の置き場所と検証の配分に適用した。状態の遷移・概要・番号・件数・関連・マスクは同じ知識なので core に 1 つだけ置き、web と api に同じ計算が無いことを grep で 0 件と確かめる (O3)。同じ card の『Executable examples』は、テストに当てた。core の単体テストが上の判定を例で固定する。API テストは境界 (404・400・論理削除・完全消去・バックアップの対象外) の観測できる結果だけを見て、DOM テストは画像の構成要素の存在と操作だけを見る。『Continuous refactoring』は分割の進め方に当てた。Improvement.tsx は一度に書き換えず、pages/improvement/ へ部品ごとに移す。1 回ごとに lint・typecheck・test を緑にしてから次へ進む。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T13:33:08Z)

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
| vitest-expect | 5.0.1 | Vitest (vitest.dev) | https://vitest.dev/api/expect.html | 2026-09-23T13:21:40Z | 2026-09-23T13:21:40Z |
