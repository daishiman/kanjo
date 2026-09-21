---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2, G5]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-ai-maintenance-ops-web-001。裏付け質疑 (`qa_refs`): `qa-ai-maintenance-ops-web-evidence-001`, `qa-ai-maintenance-ops-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、maintenance-ops ではストア審査に合わせたリリース手順とクラッシュ収集を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、maintenance-ops ではタブレット実機での表示回帰の確認手順を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、maintenance-ops ではWindows 実機での回帰確認とクラッシュ収集を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、maintenance-ops では主要ディストリビューションでの回帰確認を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、maintenance-ops ではmacOS 版ごとの回帰確認と公証の更新手順を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 検証の入口を verify:full と CI に一本化する形へ反映した。AI分析画面の core・API・DOM テストを既存の test に載せ、skills:test と初期 JS 予算を緑のまま保つことを完了条件にする。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G5

#### 主たる接地根拠: `qa-ai-maintenance-ops-web-001`

**問**

AI分析画面の品質をどう保ち、規則をどこに残すか。

**答**

段階の導出・版の説明・タブの振り分け・使用するデータの数え方・持ち出し範囲を docs/ai-screen/ に明記し、core の単体テスト・API テスト・DOM テストで固定する。既存の AI の API テストと DOM テスト、skills:test (skill 不変の確認)、初期 JS 予算 (CI 実測)、verify:full を緑のまま保つ。境界テストの具体は qa-ai-maintenance-ops-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-ai-analysis-001) と決定 qa-ai-decision-001〜008 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-maintenance-ops-web-evidence-001`

**問**

maintenance-ops 章の裏付けとして、既存の検証コマンドと記録の場所について何を観測したか。

**答**

package.json の verify:full (package.json:40) は test・typecheck・lint・build と web の check 群・preview:smoke を順に走らせる。lint は biome と glossary・design-tokens・graph-lineage などの検査を含む (package.json:24)。test:aux は skills:test を含み、skill (skills/run-kanjo-accounting-report、.claude/skills と .agents/skills に同期) の検査を行う。画面ごとの作業記録は docs/<name>-screen/ に置く慣行がある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-maintenance-ops-web-003`

**問**

web の AI分析画面で、利用者が決めていない 段階の判定を固定する境界テスト を何にするか。

**答**

core の単体テストで、期限切れと受信が同時に成り立つ行 (完了が勝つ)、キャンセル後に期限が切れた行 (キャンセルが勝つ)、差し戻し後にデータを再取得した行 (75% のまま)、期限ちょうどの時刻 (待機中) の 4 境界を toBe で固定する。 これは agent の推定で、利用者は未確認である。画像と決定 001〜008 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-19T12:36:49Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /ai を 12-ai.png どおりの画面にする。問いの見出し『AIに分析を依頼し、根拠と版を確認しますか？』と説明文、共通の期間タブ (1年 / 2年 / 3年 / 任意と範囲の送り)、1.依頼 (期間・補足指示 0/1000 と下書き自動保存・Claude Code 用 / Codex 用のコピー・使用するデータのカード・自動送信しない注記)、2.実行中の表 (ID・ステータス・依頼期間・作成日時・進捗・依頼内容・操作)、3.レポート (一覧の検索とアーカイブ表示・結果の取り込み・詳細のタブと版履歴と版比較)、下部の選択中バーを、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持つ。
- **G2**: 依頼の段階と進捗を core の純関数 1 か所で記録から導く。発行済みでデータ未取得 = 待機中 0%、データ取得済み = 実行中 50%、形式エラーで差し戻し = 実行中 75%、受信 = 完了 100%、結果なしで期限切れ = 失敗、取り消し = キャンセル。依頼には利用者ごとの連番から T-0001 形式の ID を振る。
- **G5**: データの扱いと安全を固める。使用するデータのカードは実データ (対象期間・freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数) を新しい API で返し、AI へは集計値だけを渡す。エージェント用と貼り付けの経路に body の上限を設け、キャンセル済み・期限切れのトークンを拒否する。段階を導くための列 (連番・データ取得時刻・差し戻し時刻と回数・取消時刻) は追加のみの migration で足す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | AI分析画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出し・期間タブ・1.依頼 (補足指示の文字数と下書き復元・コピー 2 種・使用するデータ・注記)・2.実行中の表の 7 列・3.レポートの一覧と取り込みと詳細 4 タブと版履歴・下部の選択中バーが描画され、読込・空・失敗の状態テストが緑である。 |
| O2 | 依頼の段階と進捗が記録から一意に決まる。 | core の単体テストで、6 つの段階 (待機中 0 / 実行中 50 / 実行中 75 / 完了 100 / 失敗 / キャンセル) が記録の組合せから toBe で導かれ、期限切れと受信・取消の優先順位が境界ケースで固定される。 |
| O5 | データの件数が実データと一致し、外部へ出るのは集計値だけである。 | API テストで、使用するデータの件数が同じ期間の D1 行数と一致し、エージェントへ渡すデータセットに明細行と摘要が含まれず、上限を超える body が 413 で止まることを確かめる。migration は追加のみで既存行の書き換えが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Ai.tsx を pages/ai/ 配下へ分割し、問いの見出し・期間タブ・1.依頼・2.実行中・3.レポート・下部の選択中バーの構成に作り直す。選択中の依頼とレポートとタブを URL に保つ。
- **I2**: core に依頼の段階と進捗を導く純関数と T-番号の整形を新設し、api の taskStatus と web の表示をこれに寄せる。
- **I5**: レポート詳細を 要約 / 根拠データ / 改善提案 / 関連リンク のタブに問い順で振り分け、要約の下に関連ページのリンクと版履歴 (補足指示の 1 行目から説明) と 2 版比較を置く。一覧に検索とアーカイブ切替を付ける。
- **I6**: 使用するデータの件数 API を足し、エージェント経路と貼り付け経路へ body 上限を掛け、追加のみの migration で段階の記録列を足す。
- **I7**: 補足指示の下書きを localStorage に自動保存し、発行時に消す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『規則は名前と境界値テストで読めるようにする』を、段階の導出と持ち出し範囲の保守に適用した。段階の優先順位は core の名前付きの順序表 1 か所に置き、段階の優先順位・版の説明の既定文・タブの振り分け・使用するデータの数え方を docs/ai-screen/ に表で残し、同じ表を core の単体テストの期待値にする。skill (run-kanjo-accounting-report) とレポート JSON 契約を変えないことは skills:test と契約テストが緑のままであることで確かめる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T12:38:49Z)

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
| vitest-expect | 5.0.1 | Vitest (VoidZero) (vitest.dev) | https://vitest.dev/api/expect.html | 2026-09-19T12:40:44Z | 2026-09-19T12:40:44Z |
