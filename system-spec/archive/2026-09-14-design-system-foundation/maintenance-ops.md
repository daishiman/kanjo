---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G4]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-maintenance-ops-web-ds-observed-004。裏付け質疑 (`qa_refs`): `qa-maintenance-ops-web-ds-decision-002`, `qa-maintenance-ops-web-ds-decision-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは OS ごとのスクリーンショット回帰 (端末サイズ×OS 版) と、トークン変更時にネイティブ側の写しを追従させる運用手順を持つ必要があった。本サイクルの保守は pnpm lint のずれ検出と web の check 系スクリプトに閉じる。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリでは OS ごとのスクリーンショット回帰 (端末サイズ×OS 版) と、トークン変更時にネイティブ側の写しを追従させる運用手順を持つ必要があった。本サイクルの保守は pnpm lint のずれ検出と web の check 系スクリプトに閉じる。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリでは OS ごとのスクリーンショット回帰 (端末サイズ×OS 版) と、トークン変更時にネイティブ側の写しを追従させる運用手順を持つ必要があった。本サイクルの保守は pnpm lint のずれ検出と web の check 系スクリプトに閉じる。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリでは OS ごとのスクリーンショット回帰 (端末サイズ×OS 版) と、トークン変更時にネイティブ側の写しを追従させる運用手順を持つ必要があった。本サイクルの保守は pnpm lint のずれ検出と web の check 系スクリプトに閉じる。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリでは OS ごとのスクリーンショット回帰 (端末サイズ×OS 版) と、トークン変更時にネイティブ側の写しを追従させる運用手順を持つ必要があった。本サイクルの保守は pnpm lint のずれ検出と web の check 系スクリプトに閉じる。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | Google SRE の手作業 (toil) 削減を、規約の遵守を目視レビューではなく pnpm lint のずれ検出と直書き検出で自動化するという確定内容に反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-maintenance-ops-web-ds-observed-004`

**問**

規約のずれを機械で止める仕組みは、現行の保守の流れのどこに差し込めるか。

**答**

pnpm lint は biome check → sync-project-skills --check → check-glossary → check-report-css → check-graph-lineage → security:content を直列に実行する。check-report-css.mjs は『正本 report.css と写し report-css.ts がズレたら落とす』検査で、正本→写しのずれ検出を lint へ組み込む前例がすでにある。トークンの写しずれ検出と直書き検出は、この列に同じ型の node スクリプトとして足せる。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: package.json の scripts.lint と scripts/check-report-css.mjs の冒頭をアシスタントが R4-reopen の後に読んだ観測事実。answered_at は読んだ直後の記録時刻で上限値。 / 回答時刻: 2026-09-13T07:54:32Z)

#### 裏付け質疑: `qa-maintenance-ops-web-ds-decision-002`

**問**

会計レポート用の report-design-system(青ブランド #1d63be) も今回 Focus Ledger の配色へ揃えますか？

**答**

『今回は対象外で記録 (Recommended)』を選択。今回はアプリ画面の共通化に集中し、report.css / report-css.ts の配色移行は次サイクルとして明記する。今回は、トークン正本を依存ゼロの packages/core に置くことで、次サイクルでレポート側から同じ値を import できる前提だけを用意する (report 側のファイルは変更しない)。 提示した選択肢: 『今回は対象外で記録 (Recommended)』(アプリ画面に集中し、配色移行は次サイクル) / 『今回含めて揃える』(report.css と report-css.ts も同じトークンへ移行。会計レポートの出力見た目も変わる)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion の選択肢から明示選択した。answered_at は会話記録に残る回答の返却時刻 2026-09-13T04:54:53Z である。 / 回答時刻: 2026-09-13T04:54:53Z)

#### 裏付け質疑: `qa-maintenance-ops-web-ds-decision-003`

**問**

今後の作成物が規約に従い続けるよう、どう保守するか。

**答**

上位概念 G4 (色の直書きを機械検出し、規約文書を置いて今後の成果物に強制する) として利用者が承認した。トークン正本と写し (CSS 変数・チャート色の予備値) のずれ、およびトークン定義以外での 6 桁 hex の直書きを lint で検出して pnpm lint に組み込み、使い方を docs 配下の規約文書 1 つにまとめる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 上位概念 U1-U9 の承認質問 (選択肢『この内容で承認』/『修正して承認』) で利用者が『この内容で承認』を選んだ。G4 はその要約に明記されていた。answered_at は会話記録に残る回答の返却時刻である。 / 回答時刻: 2026-09-13T04:54:53Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 今後の作成物が自動的に規約へ従うよう、トークン定義以外での色の直書きと、正本と写し (CSS 変数・チャート色) のずれを lint で機械検出し、使い方を規約文書として置く。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | styles.css の :root トークンと charts.ts の COLORS を design-tokens.ts から導出した写しに置き換え、写しのずれを検出する lint を lint スクリプトへ組み込む。 | pnpm lint が写しの不一致で exit 非 0 になり、一致時に exit 0 になる。charts.ts から 6 桁 hex の直書きが 0 件になる。 |
| O5 | トークンと共通部品の使い方を規約文書 (docs 配下) にまとめ、新しい画面・図をつくるときの参照先を 1 つにする。 | 規約文書が色の役割 (塗り/文字の分離)・タイポグラフィ・余白・シェル・ボタン・チャートの各節を持ち、README または AGENTS.md から参照されている。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 新しい画面をつくるとき、色・余白・角丸・文字サイズを design-tokens から選ぶだけで FINAL-UI と同じ見た目になる。
- **I4**: 誰かが画面のコードに #xxxxxx の色を直書きしたら、pnpm lint が落ちて共通トークンを使うよう促す。

### 本章に効く確定意思決定

- **dec-design-token-source**: デザイントークンの正本をどこに置くか
  - 採択: packages/core の design-tokens.ts を正本にし、CSS 変数とチャートの予備値を生成する (`core-ts`)
  - 目的適合: G1 の『依存ゼロの TypeScript 1 か所』に直接合う。テスト (O1・O4) が CSS を解析せず値を import でき、次サイクルでレポート側からも同じ値を import できる

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『同じ知識を 1 か所に置く (DRY)』と『意図を名前で示す』を保守の仕組みに適用した。色の値を役割名で呼ぶ (例: 注意の塗りと注意の文字を別名にする) ことで、直書きの hex がコードに現れた時点で規約違反と判別できる。これを lint で機械検出するのは、人やエージェントのレビューに頼ると規約が今後の作成物へ届かないためである。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T05:07:52Z)

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

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
