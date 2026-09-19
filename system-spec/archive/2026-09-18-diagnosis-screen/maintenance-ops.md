---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G2, G6]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-diagnosis-maintenance-ops-web-001。資するゴール: G2, G6 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS / Android)を提供していたなら、診断画面の本カテゴリでは端末へ配った版の不具合追跡と回収の手順を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS / Android)を提供していたなら、診断画面の本カテゴリでは端末へ配った版の不具合追跡と回収の手順を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末へ配った版の不具合追跡と回収の手順を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末へ配った版の不具合追跡と回収の手順を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末へ配った版の不具合追跡と回収の手順を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-foundation-diagnosis-001`

2026-09-17T21:57:21Z (回答直後の date -u 実測、選択時刻の上限値) 利用者が AskUserQuestion で診断画面サイクルの foundation (U1・G1-G6・対象外・制約) を『この内容で承認』と回答した。先行する利用者決定 (同日 2026-09-17T21:51:23Z より前の同一セッション): 健全性スコア=固定費比率30%・貯蓄率30%・収支の安定性25%・データカバー率15%の重みで 0-100 へ合成する規則ベースの指標とし内訳を開閉表示する、改善アクションの対応状況=D1 の新表 (照合の reconciliation_actions と同じ型) へ保存して期間切替と再取込をまたいで引き継ぐ。指標切替 (支出/収入/純収支) と旧統計表の開閉保持も承認に含まれる。

#### この承認を名指ししている質疑: `qa-target-platforms-diagnosis-001`

**問**

診断画面 (08-diagnosis) の作り直しは、どの platform を対象にしますか。web / mobile / tablet / desktop-windows / desktop-linux / desktop-macos の6 種それぞれについて、対象に含めるか外すかを決めてください。

**答**

対象は web のみとする。mobile / tablet / desktop-windows / desktop-linux / desktop-macos の 5 種は本サイクルの対象外とする。

理由: 本プロダクト kanjo は Cloudflare Workers 上の API (packages/api) と、ブラウザへ配信する SPA (packages/web、React 18 + react-router-dom 7) の 2 つだけで構成されており、専用アプリの成果物・配布経路・ビルド設定はリポジトリに存在しない。直前の総収支画面 (PR #55)・照合画面 (PR #54)・推移画面 (PR #56) の各サイクルも同じ理由で web のみを対象としており、本サイクルで方針を変える理由がない。上位概念の対象外 (scope.out) にも『web 以外の platform』を明記して利用者承認済み (appr-foundation-diagnosis-001)。

なお web はレスポンシブで提供するため、スマートフォンのブラウザからも閲覧できる。ここで対象外にしたのは『専用アプリという成果物』であって『小さい画面』ではない。小さい画面での表示は ui-ux / frontend の web セルで扱う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (上位概念 scope.out) + リポジトリ構成の観測 (packages/ 配下は api / core / web のみ) / 回答時刻: 2026-09-17T22:01:23Z)

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 金額が想定と違うときの切り分け順 (期間 → 範囲 → 検知器ごとの evidence) を章に定め、その切り分けが画面だけで完結するように evidence へ実測値・比較値・期間・出典を必ず載せる。計算規則は docs/diagnosis-screen.md を正本とし、画面の文言と食い違ったら文書を正とする。検知器の追加手順も同じ文書に置き、画面と API に触れずに足せることを保守時の健全性の指標にする。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G6

#### 主たる接地根拠: `qa-diagnosis-maintenance-ops-web-001`

**問**

この画面を後から保守する人が困らないように、何をどこへ残し、どう検証できるようにしますか。

**答**

**計算規則の正本 (G6)**: docs/diagnosis-screen.md を新規に書き、(a) 6 種の検知器それぞれが何を根拠にいくらと見積もるか、(b) 健全性スコアの 4 要素・重み・正規化・区分の境界、(c) 合計から除外する条件 (対応済み・見送り・重複キー)、(d) 年額と月額の換算規則と丸めの位置、を数式と例で固定する。画面の文言と食い違ったらこの文書を正とする。

**テスト**: packages/core に境界値テストを置く。各検知器について『検知される最小の入力』『ぎりぎり検知されない入力』を対で書き、健全性スコアは 0・100・要素が算出不能 (分母 0・データ不足) の各点を固定する。テストは旧実装でも緑になってはならない — 件数と金額を固定値で検算し、『0 件の違反』と『0 件しか調べていない』を区別できる形にする。

**検知器を足す手順**: レジストリへ 1 件追加し、docs と境界値テストを足すだけで画面・API に手を入れずに済むことを、追加手順として docs に書く。これが崩れていたら G2 が壊れている合図になる。

**調査の手順**: 金額が想定と違うときは (1) 期間の切り方、(2) 範囲 (事業/家計/総合) の選択、(3) 検知器ごとの evidence、の順で切り分ける。evidence に実測値と比較値と期間を必ず載せるのは、この切り分けを画面だけで完結させるため。

**戻し方**: 新表の追加のみで既存データの書き換えを伴わないため、問題時は画面と API の変更を戻せば足りる。表は残っていても既存機能に影響しない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存 docs / テスト運用の観測 (docs/ 配下の画面別文書、packages/core のテスト構成) + G2/G6 / 回答時刻: 2026-09-17T22:01:23Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 改善余地の見つけ方を登録制にする。検知器の定義 (id・表示名・課題文の作り方・年間改善インパクトの見積り方・対応の手間・優先度の決め方・次のアクションの行き先・根拠に使う数値と明細の取り出し方・信頼度の出し方) を packages/core に置き、今回は固定費の見直し・急増した費目・重複支払いの候補・サブスクの重複候補・未分類明細・通信費の見直しを登録する。画面・API・表は検知器の定義から描き、検知器を足すときに画面と API のコードに検知器 id の分岐を増やさない。
- **G6**: 診断の計算規則を単純で説明可能な形で docs に明記しテストで固定する。年間改善インパクトの見積り方 (検知器ごとの根拠と年換算の仕方)、優先度の決め方 (改善インパクトと対応の手間の組合せ)、信頼度とデータカバー率の出し方、改善後の見込みの積み上げ方、完了すると変わる指標の before→after の出し方、要確認の明細を数値に含めない規則、事業/家計/総合の取引集合を総収支・推移と一致させる規則を docs/diagnosis-screen.md に書き、境界値付きの core テストと DOM テストで固定する。既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (視覚検査を含む) を緑のまま保つ。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 検知器を足すときに画面と API を編集しなくてよい。 | 検知器定義を 1 件足したテストで、画面の表・ウォーターフォール・詳細パネルと API の返却に新しい課題が現れ、packages/web と packages/api のコードに検知器 id の分岐が 0 件であることを静的検査とテストで確認する。 |
| O6 | 数値が他画面と一致し、規則が docs とテストで固定されている。 | 同じ期間の総収支・推移の API 返却と、診断が使う取引集合の合計が一致する core テストが通り、docs/diagnosis-screen.md に見積り・優先度・信頼度・カバー率・改善後の見込みの規則が書かれ、境界値テストが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 診断結果カードに、最も効く改善の見出し (例『固定費の見直しで年間 ¥148,000 の改善余地』)・補足・信頼度・データカバー率を出す。
- **I5**: 主なシグナルを 3 件まで、順位付きで短文と根拠の数値つきで出す。
- **I6**: 改善アクションの優先順位の表を、# ・優先度 (高/中/低)・課題・年間改善インパクト・対応の手間 (高/中/低)・ステータス (未着手/対応中/対応済み/見送り、要確認は判断待ちの検知)・次のアクション の列で出し、行を選ぶと詳細パネルと選択バーが連動する。
- **I7**: 改善インパクトの見込みをウォーターフォールチャートで出す。左端に改善余地の合計、中間に項目ごとの削減 (負の棒)、右端に改善後の支出見込みを置き、『年間 ¥X の改善で支出を Y% 削減できます』の注記を添える。
- **I8**: 診断根拠の表に、データソース (銀行口座・クレジットカード・電子マネー・手入力データ) ごとの対象期間・カバー率・主な内容と、全体のデータカバー率を出す。
- **I13**: 既存の科目別プロファイル表と自動診断は『統計の詳細を表示』で開閉できる根拠として下部に残し、どの基準で数えたか (MF 明細の事業側だけか) を明記する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

運用設計の『規則を文書と実行可能な検査の両方で固定する』を、診断の計算規則に当てた。docs/diagnosis-screen.md に検知器ごとの見積り方・健全性スコアの 4 要素と重みと境界・合計から除外する条件・年額換算と丸めの位置を数式と例で書き、同じ規則を packages/core の境界値テストで固定する。テストは『検知される最小の入力』と『ぎりぎり検知されない入力』を対で持ち、旧実装でも緑になる書き方をしない (0 件の違反と 0 件しか調べていないを区別する)。検知器を足す手順を docs に書き、画面と API に触れずに足せることが崩れていたら登録制が壊れた合図として扱う。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-17T23:25:04Z)

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
