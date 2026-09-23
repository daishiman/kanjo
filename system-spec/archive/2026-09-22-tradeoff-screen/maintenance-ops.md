---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2, G3, G4, G5]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-tradeoff-maintenance-ops-web-001。裏付け質疑 (`qa_refs`): `qa-tradeoff-maintenance-ops-web-evidence-001`, `qa-tradeoff-maintenance-ops-web-003`, `qa-tradeoff-decision-012` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、maintenance-ops では端末の機種ごとの動作確認と障害時の版の取り下げを決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、maintenance-ops ではタブレットの画面寸法ごとの回帰確認を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、maintenance-ops ではWindows の版ごとの回帰確認を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、maintenance-ops ではLinux のディストリビューションごとの回帰確認を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、maintenance-ops ではmacOS の版ごとの回帰確認を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 試算と推奨の規則を FR-09 の仕様書へ書き、契約テストの固定入力と同じ例 (毎月 80,000 と削減 85,000/月 で −60,000 など) を載せて、仕様と実装のずれを CI で見つける形へ反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G3, G4, G5

#### 主たる接地根拠: `qa-tradeoff-maintenance-ops-web-001`

**問**

web のトレードオフ画面の保守と運用の要件は何か。

**答**

core の契約テスト (試算・防衛ラインへの影響・候補集計・推移・必要度・推奨の順位) を固定入力で置き、api テスト (上書きの保存と読み戻し・利用者の分離・zod の上限・最新 1 件の復元) と web の DOM テスト (全構成要素と読込 / 空 / 失敗) を足す。既存の tradeoff-review・diagnosis-detectors の契約テストは緑のまま残す。規則は FR-09 の仕様書へ書く。typecheck・lint・テスト・初期 JS 予算を CI で緑にする。具体の記載先と番号は qa-tradeoff-maintenance-ops-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-tradeoff-001) と決定 qa-tradeoff-decision-001〜009 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-maintenance-ops-web-evidence-001`

**問**

maintenance-ops 章の裏付けとして、現行のトレードオフ画面まわりについて何を観測したか。

**答**

既存テストは packages/core/test/tradeoff-review-contract.test.ts、packages/core/test/diagnosis-detectors-contract.test.ts:534-590 (tradeoffCandidates)、packages/web/src/tradeoff-review.dom.test.tsx。ルート package.json の lint は biome と glossary・design-tokens・design-system の各検査を連ね、verify:full は test・typecheck・lint・build と web の各 check を実行する。FR-09 の仕様は docs/spec-v1.1.md:193-203 にあり、design/FINAL-UI/spec/AUDIT.md:21 は保存版の除去を記している。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-maintenance-ops-web-003`

**問**

web のトレードオフ画面で、利用者が決めていない 規則の記載先と migration の番号 を何にするか。

**答**

規則 (候補の作り方・推移・必要度・推奨の順位・防衛ラインへの影響・符号) は docs/spec-v1.1.md の FR-09 を改訂して書く。migration は 0050 を予定番号とし、マージ時点の main の最新 +1 に合わせて付け替える (並行 worktree の 14予算・16データ取り込み・17現金入力には 0050 以上の予定が無いことを確認済み)。schema-guard.ts の EXPECTED_D1_MIGRATION とそのテストを同じ変更で更新する。 これは agent の推定で、利用者は未確認である。画像と決定 001〜009 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-decision-012`

**問**

要件定義の O1〜O5 (測れる目標) と S1〜S6 (成功基準) を、提示した本文のまま承認するか。O1: 画像の全構成要素を描画する (DOM テスト) / O2: 試算の数字を core の 1 関数から出す (毎月 80,000・削減 85,000/月 で差額 −60,000 などの契約テスト) / O3: 候補・必要度・推移・理由を決定論で出し、上書きを優先する / O4: 推奨の上位 4 件を決定論で並べ、届かない組み合わせは入れない / O5: 記録は追加のみの migration と zod 上限・利用者分離で安全に行う。S1: トークンと共通部品で描画し、直書き色 0 件・期間は usePeriod / S2: 年額・差額・防衛ラインは core だけが決め、3 か所の表示が一致 / S3: 上書きとメモが再読込後も残る / S4: 同じ入力で同じ上位 4 件と理由・リンクが出る / S5: 押すたびに履歴を追加し、再訪時に最新を復元 / S6: typecheck・lint・テスト・JS 予算が CI で緑。

**答**

この本文で承認する。appr-foundation-tradeoff-001 の承認時に本文を見せていなかった O1〜O5 と S1〜S6 を、本 qa で本文を示したうえで利用者が承認した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / O・S の本文を提示し、利用者本人が『この本文で承認』を選択。completeness evaluator の持ち越し指摘 (承認時に O/S/I の本文を見せていない) への対応。 / 回答時刻: 2026-09-21T22:24:40Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /tradeoff を 15-tradeoff.png どおりの画面にする。見出し『トレードオフ』と問い『新しい支出を増やすなら、何を見直しますか？』と説明文、分析期間 (グローバル) のカード、1.新しい支出を設定 (支出名・金額・単発 / 毎月・開始月・メモ)、2.見直し候補の選択 (検索・カテゴリ絞込・選択をすべてクリア、# / カテゴリ・取引先 / 月額 / 年額 / 必要度 / 直近の推移 / 損益・メモ の表と件数表示)、3.推奨の組み合わせ (内容・年間削減額・充足度・実行のしやすさ・リスクの表と、選択中の組み合わせの理由・関連ページへのリンク)、計算例 (毎月と単発)、右側の試算結果 (新しい支出・見直しによる削減額・年間の差額と警告・防衛ラインへの影響・計算の前提)、下部の選択中バー (件数・年間削減額・年間差額・選択をクリア・この条件で試算) を、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持つ。
- **G2**: 試算の数字を core の純関数 1 か所で導く。毎月の支出は月額×12、単発の支出は発生月だけに計上し、見直しの削減は選択した候補の月額合計×12 で年額にする。年間の差額 = 新しい支出の年額 − 削減の年額。防衛ラインへの影響は、既存 defenseLine の月の余裕×12 を『防衛ライン余裕』、そこから年間の差額を引いた値を『試算後の余裕』とし、試算後が 0 以上なら維持、負なら割れると文字で示す。 差額の符号は『新しい支出の年額 − 削減の年額』で、正は支出増 (赤の警告)、負は捻出できる。
- **G3**: 見直し候補を事業経費の科目×取引先ごとに直近 3 か月の平均月額で作る。必要度 (低 / 中 / 高) と直近の推移 (過去 3 か月の減少 / 横ばい / 増加) を core が推定し、『損益・メモ』には検知器の改善案や推移から作る自動の理由を出す。利用者は必要度を上書きしメモを書け、それらは D1 に保存して自動の値より優先する。
- **G4**: 推奨の組み合わせを core の決まったルールで出す。候補 2〜4 件の組み合わせのうち年間削減額が新しい支出の年額以上になるものを選び、充足度・実行のしやすさ (必要度の低い候補が多いほど易しい)・リスク (必要度の高い候補を含むほど高い) で順位を付けて上位 4 件を示し、選んだ組み合わせの理由の文と関連ページ (サブスク・予算・明細) へのリンクを添える。アプリは LLM を呼ばない。
- **G5**: 試算条件と候補ごとの上書きを安全に記録する。『この条件で試算』を押すたびに条件 (支出名・金額・単発 / 毎月・開始月・メモ・選んだ候補・差額) を既存 tradeoff_plans へ履歴として追加し、画面は最新の 1 件を復元する。保存一覧と翌月の突合は画面から外すが、既存の行と突合の関数は消さない。列と表は追加のみの migration で足し、入力は zod で検証し文字数に上限を設け、利用者ごとに分離する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | トレードオフ画面が画像の全構成要素を描画する。 | DOM テストで、見出しと問い・分析期間カード・1.新しい支出の 5 入力・2.候補表の 8 列と検索とカテゴリ絞込と全クリア・3.推奨の表と理由とリンク・計算例 2 種・右側の試算結果と防衛ラインへの影響と計算の前提・下部の選択中バーが描画され、読込・空・失敗の状態テストが緑である。 |
| O2 | 試算の数字が core の 1 関数から出る。 | core の契約テストで、毎月 80,000 と削減 85,000/月 のとき 年額 960,000 / 1,020,000 / 年間の差額 −60,000 (捻出できる)、単発 300,000 と削減 50,000/月 のとき 年間の差額 −300,000、毎月 100,000 と削減 50,000/月 のとき +600,000 (支出増) が出ること、防衛ライン余裕と試算後の余裕と維持 / 割れるの境界 (0) を検査し、web と api に同じ計算が無いことを grep で確かめる。 |
| O3 | 候補と必要度・推移・理由が決定論で出て、上書きが優先される。 | core の契約テストで、科目×取引先の集計・直近 3 か月平均・推移の 3 区分・必要度の推定・理由の文を固定入力で検査し、api テストで上書きの保存と読み戻し、利用者間の分離を検査する。 |
| O4 | 推奨の組み合わせが決定論で並ぶ。 | core の契約テストで、同じ入力に同じ上位 4 件と同じ順位・評価・理由が返り、年間削減額が新しい支出の年額に届かない組み合わせが入らないことを検査する。 |
| O5 | 試算条件と上書きの記録が追加のみで安全に行われる。 | migration が CREATE TABLE / ALTER TABLE ADD COLUMN だけで、api テストで zod の上限・認証・利用者分離・最新 1 件の復元を検査し、既存の tradeoff_plans の行と tradeoffReview の契約テストが緑のままである。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Tradeoff.tsx を pages/tradeoff/ 配下へ分割し、見出しと問い・分析期間カード・1.新しい支出・2.見直し候補・3.推奨の組み合わせと計算例・右側の試算結果・下部の選択中バーの構成に作り直す。
- **I2**: core に試算関数 (年額・差額・単発の計上・防衛ラインへの影響) を新設し、画面の右パネル・選択中バー・計算例がそれだけを読む。
- **I3**: core に科目×取引先の候補集計・推移・必要度・自動の理由を新設し、上書きの新表と保存 API を足す。
- **I4**: core に推奨の組み合わせの列挙・評価・順位・理由を新設し、関連ページへのリンクを出す。
- **I5**: tradeoff_plans に開始月・メモ列を足し、POST で履歴を追加、GET で最新 1 件を返して画面で復元する。保存一覧と突合の表示を外す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

回帰を契約テストで守る原則を適用した。試算・推奨の規則を固定入力の core テストで固め、既存の tradeoffReview と tradeoffCandidates のテストを残すことで、作り直しで既存の数字が動いたら CI で落ちるようにする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:19:22Z)

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
| vitest-expect | 5.0.1 | Vitest (VoidZero) (vitest.dev) | https://vitest.dev/api/expect.html | 2026-09-21T15:23:17Z | 2026-09-21T15:23:17Z |
