---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2, G4]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-cash-maintenance-ops-web-001。裏付け質疑 (`qa_refs`): `qa-cash-maintenance-ops-web-evidence-001`, `qa-cash-maintenance-ops-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、maintenance-ops ではストア審査と、古い版が残ることを前提にした障害切り分けを決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、maintenance-ops ではタブレット実機での回帰テストを決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、maintenance-ops ではWindows 実機での回帰テストとクラッシュ収集を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、maintenance-ops では複数ディストリビューションでの回帰テストを決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、maintenance-ops ではmacOS の版ごとの回帰テストとクラッシュ収集を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 夜間の完全消去が消した件数を JSON ログに出し、上限に達した夜は warn にする形へ反映した。画面の描画検査 check:cash-screen を verify:full に組み込み、作り直しの回帰を CI で止める。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G4

#### 主たる接地根拠: `qa-cash-maintenance-ops-web-001`

**問**

現金入力の作り直しを何で検証し、運用で何を見るか。

**答**

core の cash-screen の単体テスト、API テスト (論理削除・復元・一括削除・利用者分離・入力検証・削除中の行が集計に出ない不変条件)、DOM テスト (画像の構成要素・下書き復元・元に戻す・空状態) を足し、web に check:cash-screen を加えて verify:full に組み込む。夜間の完全消去は消した件数を JSON ログに出す。既存の lint・typecheck・test・skills:test・初期 JS 予算・verify:full を緑に保つ。具体値は qa-cash-maintenance-ops-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-cash-001) と決定 qa-cash-decision-001〜004 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-maintenance-ops-web-evidence-001`

**問**

maintenance-ops 章の裏付けとして、現行実装について何を観測したか。

**答**

ルートの package.json の verify:full は test・typecheck・lint・build と web の check:thead / mobile-layout / financial-figure / financial-routes / ai-screen / analysis-hub、preview:smoke を順に実行する。現金入力の画面専用の描画検査は無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-maintenance-ops-web-003`

**問**

web の現金入力画面で、利用者が決めていない 運用で見る閾値を何にするか。

**答**

夜間の完全消去が 1 晩の上限 500 行に達したら warn ログを出し、翌晩に続きを消す。check:cash-screen は既存の check-financial-visuals.mjs に KANJO_VISUAL_SCOPE=cash を渡して実行する。 これは agent の推定で、利用者は未確認である。画像と決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:20:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /cash を 17-cash.png どおりの画面にする。問いの見出しと説明、共通の期間 (1年 / 2年 / 3年 / 任意) と対象期間カード、通常入力 / 交通費入力のタブ、現金明細の入力 (日付・事業/個人・収支・金額・内容・カテゴリ・担当者・メモ 0/200・入力をクリア・現金明細を追加・下書き自動保存の表示)、交通費の入力 (出発駅・到着駅・入替・片道運賃・往復・合計金額・業務の目的・メモ・交通費として追加)、現金明細の一覧 (月送り・キーワード検索・4 種の絞り込み・詳細検索・収入/支出/差額の合計・選択・編集/削除・ページング)、インラインの削除確認と元に戻す、空状態、下部固定の追加バーを描く。
- **G2**: 記録が消えない。入力途中の内容はブラウザ内に自動保存して復元でき、削除は論理削除として一覧と集計から外したうえで『元に戻す』で同じ行を復活でき、30 日後に夜間処理で完全に消える。
- **G4**: 現金明細の入力と変更を安全に保つ。利用者ごとの分離、入力検証、削除・復元の権限確認、削除済み行を集計へ混ぜない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 現金入力画面が画像の全構成要素を描画する (領収書欄を除く)。 | DOM テストで、問いの見出し・対象期間カード・2 つのタブ・通常入力の全項目とメモの文字数・交通費入力の全項目と入替・合計金額の自動計算・一覧の月送り/検索/4 種の絞り込み/合計 3 枚/表/ページング・インライン削除確認・元に戻すトースト・空状態・下部固定バーの存在を確認し、全て通る。 |
| O2 | 下書きと論理削除で記録が欠けない。 | DOM テストで入力→再描画後に下書きが復元されること、API テストで削除→元に戻すで同じ id が一覧に戻ること、削除中の行が集計 (cashToDeal / cashToTx の入力) に 0 件であることが通る。 |
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Cash.tsx を pages/cash/ 配下へ分割し、問いの見出し・対象期間カード・タブ・入力 2 枚・一覧・下部固定バーの構成に作り直す。選択中のタブ・月・絞り込み・ページを URL に保つ。
- **I3**: cash_entries に owner・transit_purpose・deleted_at を足す追加のみの migration 0050 (入力経路は列を持たず交通費の区間の有無から導く) と、削除・復元・一括削除・一括復元の API、削除中の行を読まない条件を cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に掛けること、夜間の完全消去を実装する。 JSON 復元の『空か』判定だけは削除中の行も数え、削除中の行が残る間は現金明細を復元しない (qa-cash-decision-009)。
- **I4**: 入力途中の内容をブラウザ内に自動保存し、保存時刻を表示し、復元する。『入力をクリア』で下書きも消す。
- **I5**: 削除をインライン確認にし、削除完了トーストの『元に戻す』で同じ行を復活させる。空状態では画面内だけのサンプル表示と『はじめての明細を入力』を出す。
- **I6**: 入力検証 (名義・業務の目的・カテゴリの候補、文字数、金額の範囲) を core と API の zod で揃え、他の利用者の行を 404 にする。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『規則は名前と境界値テストで読めるようにする』を、現金入力の保守に適用した。削除中の行を集計へ出さない規則は、cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に同じ条件を掛けたうえで、経路ごとに削除 → 読み取り → 復元 → 読み取りの往復を固定する API テストを 1 件ずつ置いて読めるようにする。経路を 1 本足したときに条件を忘れないためである。30 日の期限は 29 日と 31 日の境界値で固定し、夜間予算は計画上限 49 を予算テストで固定する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T22:28:41Z)

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
| vitest-expect | 5.0.1 | Vitest (VoidZero) (vitest.dev) | https://vitest.dev/api/expect.html | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
