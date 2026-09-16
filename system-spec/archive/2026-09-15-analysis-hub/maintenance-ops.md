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
| Web (web) | 確定 | 確定質疑: qa-maintenance-ops-web-ah-observed-001。裏付け質疑 (`qa_refs`): `qa-analysis-hub-decision-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではストア審査とアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではストア審査とアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではストア審査とアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではストア審査とアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではストア審査とアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | Google SRE の『手作業の確認を自動の検査へ置き換える』を、判定規則の境界値テスト、タブ label 変更に伴う DOM テスト更新、check:mobile-layout / check:financial-routes の対象へ /analysis を含めることに反映した。verify:full と CI だけでハブの回帰を検出できる状態にする。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-maintenance-ops-web-ah-observed-001`

**問**

ハブ導入後の検証と保守の手順 (回帰確認・規則の維持) はどうなるか。

**答**

ルート package.json の verify:full (pnpm test → typecheck → lint → build → web の check:thead / check:mobile-layout / check:financial-figure / check:financial-routes → preview:smoke) と、デザイン系の高速確認 design-system:fast がある。lint は biome・check-design-tokens・check-design-system-document-contract・check-graph-lineage 等を束ねる。CI (ci.yml) が lint/typecheck/test/build を実行する。ハブでは、判定規則 (優先度・マトリクス正常判定・改善余地・前期間比の null 規則) を docs に明記し core テストの境界値で固定する (利用者決定 qa-analysis-hub-decision-003)。タブ label の変更で analysis-tabs / navigation-ux / common-shell-routes の DOM テストを新しい文言へ更新する。check:financial-routes / check:mobile-layout の対象ルートにハブ (/analysis) が含まれるかを確認し、無ければ追加して狭幅の横スクロールを検査する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: package.json, packages/web/package.json, .github/workflows/ci.yml。 / 回答時刻: 2026-09-14T11:38:26Z)

#### 裏付け質疑: `qa-analysis-hub-decision-003`

**問**

画像の『優先度 (高/中)』『マトリクスの正常判定』『診断の改善余地 (金額)』は現行実装に定義が無い。どう定めるか。選択肢: (A) 単純な規則で定義する: 優先度は照合・総収支が要確認 1 件以上なら高・0 件なら中、他 3 視点は中。マトリクスは未記録月 0 なら正常。改善余地は既存 tradeoffCandidates の月額合計 × 12 の年額。規則は docs に明記しテストで固定する (推奨) / (B) 状態は件数と前 12 か月比だけにし、優先度・正常判定・改善余地は出さない。

**答**

(A) 単純な規則で定義 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-14T11:33:07Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 優先度・マトリクスの正常判定・改善余地を単純で説明可能な規則として定義し、規則を docs に明記してテストで固定する。優先度は照合と総収支が要確認 1 件以上なら高・0 件なら中、他の 3 視点は中。マトリクスは未記録月 0 なら正常。改善余地は tradeoffCandidates の月額合計 × 12 の年額。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | core に analysisHub(dataset) 相当の純関数を置き、API に GET /analysis/hub を足す。 | core 単体テストが期間合計・前 12 か月比 (前期間データ無しは null)・5 視点の状態・優先度・改善余地を固定データで検証し、API 統合テストが認証付きで 200 と期間メタを返し、ハブ表示中の DOM テストで既存 5 API への呼出しが 0 件である。 |
| O4 | 判定規則を docs に書き、境界値をテストで固定する。 | 要確認 0 件/1 件、未記録月 0/1、tradeoff 候補 0 件の境界でテストが規則どおりの値を返し、規則を変えるとテストが落ちる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I5**: 優先度・マトリクス正常判定・改善余地の規則を docs/ui-decisions.md (または docs 配下の分析ハブ文書) に書き、境界値テストで固定する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『規則は名前と境界値テストで読めるようにする』を、ハブの判定規則の保守に適用した。優先度 (照合・総収支の要確認 1 件以上で高)・マトリクスの正常判定 (未記録月 0)・改善余地 (tradeoffCandidates の月額合計 × 12)・前期間比の null 規則を、docs に書いた文言と同じ名前の core テストで、0 件と 1 件・欠け月 0 と 1 の境界ごとに固定する。規則を変えるとテストが落ちる状態を保守の停止条件にし、タブ label 変更に伴う DOM テストの文言更新も同じ変更の中で行う。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T11:57:54Z)

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
