---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G3]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-guide-maintenance-ops-web-001。裏付け質疑 (`qa_refs`): `qa-guide-maintenance-ops-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、maintenance-ops ではOS ごとのビルド・署名と配布後の不具合収集を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、maintenance-ops ではOS ごとのビルド・署名と配布後の不具合収集を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、maintenance-ops ではOS ごとのビルド・署名と配布後の不具合収集を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、maintenance-ops ではOS ごとのビルド・署名と配布後の不具合収集を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、maintenance-ops ではOS ごとのビルド・署名と配布後の不具合収集を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 画面の描画検査 check:guide-screen を verify:full に組み込み、作り直しの回帰を CI で止める形へ反映した。記録は docs/guide-screen/ の rules・design-decisions・evidence に置く。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G3

#### 主たる接地根拠: `qa-guide-maintenance-ops-web-001`

**問**

使い方画面サイクルの検査と記録をどう残すか。

**答**

verify:full に check:guide-screen (check-financial-visuals.mjs の KANJO_VISUAL_SCOPE=guide) を足し、画面の見た目を画像と突き合わせる。記録は docs/guide-screen/{rules,design-decisions,evidence}.md に置く。check-glossary が通るよう、用語集は『用語と目安』節で全用語を 1 度ずつ出し続ける。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-guide-001) と決定 qa-guide-decision-001〜007 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-23T12:37:28Z)

#### 裏付け質疑: `qa-guide-maintenance-ops-web-evidence-001`

**問**

maintenance-ops 章の裏付けとして、現行実装について何を観測したか。

**答**

verify:full (package.json:40) は test・typecheck・lint・build と check:cash-screen などの画面別の見た目検査・preview:smoke を連ねる。lint (package.json:24) は check-glossary (全用語が 1 画面以上で使われる)・check-graph-lineage・check-design-tokens を含む。画面サイクルの記録は docs/<screen>-screen/ (例 docs/cash-screen) に置かれる。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-23T12:37:28Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /guide を 19-guide.png どおりの画面にする。問いの見出しと説明、共通の期間と前後移動、4 ステップ (取込む・整える・確認・計画) と各『元画面を開く』、使い方ガイド (左の目次 6 項目＋用語と目安、月次の流れステッパー、総収支の読み方 = 総収入 − 総支出 = 純収支 を選択期間の実データで、含まれるもの・振替は除外・freee の権限、期間の切り替えによる表示の違い表)、右カラム (このページの数値・関連ページ・ガイド内を検索)、よくある疑問と対処法 5 行 (データの出所・確認の条件・関連ページ)、下部固定バー (現在のトピックと主要な元画面へのボタン) を描く。
- **G3**: 画面の数字と文言の対応を core の 1 か所から導く。ガイドの節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・検索を core の純関数 (guide-screen) に置き、API は JSON に写すだけ、web は描くだけにする。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 使い方画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出し・期間の前後移動・4 ステップと 4 つの元画面リンク・目次 7 項目・ステッパー・総収支の 3 枚 (実データの金額)・含まれるもの 3 枚・期間の表 4 行・このページの数値 4 項目・関連ページ 5 件・ガイド内検索・よくある疑問 5 行・下部固定バーの存在を確認し、全て通る。 |
| O3 | ガイドの導出が core の 1 か所に集まる。 | core の guide-screen の単体テストが節・よくある疑問・期間の表・このページの数値・検索を固定し、web と api に同じ導出の重複が無い (guide-sections.ts の現在値合成は core へ移る)。 |
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Guide.tsx を pages/guide/ 配下へ分割し、問いの見出し・期間・4 ステップ・目次と本文・右カラム・よくある疑問・下部固定バーの構成に作り直す。選択中のトピックと検索語を URL に保つ。
- **I2**: core に guide-screen を新設し、節・ステップ・よくある疑問・期間の表・このページの数値 (選択中の期間・期間の定義・データの出所・最終更新)・関連ページ・ガイド内検索を純関数で導く。guide-sections.ts の現在値合成を core へ移す。
- **I3**: GET /api/guide を追加し、選択期間の総収入・総支出・純収支 (振替除外)・最終更新・データの出所を core の guide-screen で JSON に写す。利用者ごとに分離し期間クエリを検証する。
- **I7**: 期間の前後移動 (shiftedPeriod) を core へ移し、決算書と使い方画面で共有する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『規則は名前と境界値テストで読めるようにする』を、使い方画面の保守に適用した。信頼度の段階は 80 と 79、50 と 49 の境界値で単体テストに固定する。防衛ラインは算出期間の定数を 1 か所に置き、ガイドと用語集の説明文がその定数から組まれていることをテストで固定するので、将来算出を変えるときに説明だけが取り残されない。用語集は check-glossary が全用語の使用を検査するので、『用語と目安』節で全用語を 1 度ずつ出し続ける。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T13:15:27Z)

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
| vitest-expect | 5.0.1 | Vitest (VoidZero) (vitest.dev) | https://vitest.dev/api/expect | 2026-09-23T12:39:53Z | 2026-09-23T12:39:53Z |
