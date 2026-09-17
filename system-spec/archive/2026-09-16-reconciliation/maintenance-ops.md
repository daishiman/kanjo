---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G2, G4, G5]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-maintenance-ops-web-rc-observed-001。裏付け質疑 (`qa_refs`): `qa-reconciliation-decision-003`, `qa-reconciliation-decision-004`, `qa-maintenance-ops-web-rc-inference-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではストア審査と、一致度規則や月次クローズ判定を変えたときのアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではストア審査と、一致度規則や月次クローズ判定を変えたときのアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではストア審査と、一致度規則や月次クローズ判定を変えたときのアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではストア審査と、一致度規則や月次クローズ判定を変えたときのアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではストア審査と、一致度規則や月次クローズ判定を変えたときのアプリ版ごとの回帰確認を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | Google SRE の『手作業の確認を自動の検査へ置き換える』を、一致度・キュー・月次クローズの境界値テスト、照合画面と共通シェルの DOM テスト更新、check:financial-routes / check:mobile-layout の対象へ /analysis/reconciliation を含めることに反映した。e2e が無い前提で、verify:full と CI だけで照合の回帰を検出できる状態にする。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G4, G5

#### 主たる接地根拠: `qa-maintenance-ops-web-rc-observed-001`

**問**

照合改善後の検証と保守の手順 (回帰確認・規則の維持・古い docs) はどうなるか。

**答**

ルート package.json の verify:full は pnpm test → typecheck → lint → build → web の check:thead / check:mobile-layout / check:financial-figure / check:financial-routes / check:analysis-hub → preview:smoke。lint は biome・check-glossary・check-design-tokens・check-design-system-document-contract・check-graph-lineage 等を束ねる。更新対象のテストは reconciliation.dom.test.tsx・analysis-tabs / analysis-hub / analysis-navigation の DOM テスト・route-icon-distinct.test.tsx・core expense-projection.test.ts・api total-cashflow-verdict.integration.test.ts・shell 系 DOM テスト (サイドバー文言変更)。docs/data-schema.md:120-124 の自動照合・要確認の記述は、一致度規則とキュー分類 (qa-reconciliation-decision-003) を入れた時点で古くなるため同じ変更で直す。e2e テストは無いため、画像との差は DOM テストと check:financial-routes / check:mobile-layout の対象に /analysis/reconciliation を含めて狭幅の横スクロールを検査する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD cc0d5e3) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: package.json, packages/web/package.json, .github/workflows/ci.yml, docs/data-schema.md, packages/web/src/*.dom.test.tsx。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-reconciliation-decision-003`

**問**

画像の『一致度 %』『金額の差異』『日付の近い取引』は現行実装に定義が無い。どう定めるか。選択肢: (A) 単純な加点規則を core の純関数に置く: 金額一致 50 点 + 日付差 (同日 30 / 1 日 20 / 2 日 10 / 3 日 5) + 内容類似 (正規化した文字列の類似度 × 20) = 100 点満点。金額の差異 = 日付 ±3 日かつ内容類似だが金額不一致。日付の近い取引 = 金額一致で日付差 1〜3 日。規則は docs とテストで固定する (推奨) / (B) 一致度は出さず一致の理由のチェック表示だけにする。

**答**

(A) 単純な加点規則 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T07:41:58Z)

#### 裏付け質疑: `qa-reconciliation-decision-004`

**問**

サイドバーの文言・件数バッジも画像 04-reconciliation.png に揃えるか。画像: 概要/データ取込(3)/現金入力/明細仕分け(12)/サブスク(2)/累計収支/支出分析/決算書/AI分析/予算/トレードオフ/設定/使い方/改善リクエスト。現行: 概況/現金の記帳/公私仕分け/サブスク分析/家計/予算管理/やりくり試算/指標ガイド で、件数バッジは支出分析の子行だけ。選択肢: (A) 文言もバッジも揃える。ページ見出し・パンくず・コマンドパレットも同じラベルに追随させ、データ取込=要確認の取込件数、明細仕分け=未整理明細数、サブスク=判定待ち候補数を出す (推奨) / (B) バッジだけ追加 / (C) 照合子行のバッジと月次クローズカードだけ直す。

**答**

(A) 文言もバッジも揃える を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:11:23Z)

#### 裏付け質疑: `qa-maintenance-ops-web-rc-inference-003`

**問**

内容類似のしきい値 0.5 (qa-backend-web-rc-decision-013) を、規則を変えるとテストが落ちる状態にするために core の境界値テストで何を固定するか。

**答**

core の reconciliation テストで次を固定する。(1) 内容類似の値そのもの: 同一文字列 1.0、共通 bigram 無し 0 (『Amazon.co.jp』と『アマゾン』は 0 で、カナと英字の表記違いを拾わない限界を docs/data-schema.md に明記)、『ヤマト運輸』と『ヤマト運輸株式会社』 0.67、『東京電力』と『東京ガス』 0.33。(2) しきい値の境界: 類似度がちょうど 0.5 の組は『似ている』で、0.5 未満の組は『似ていない』。金額の差異キューへの所属と一致の理由の内容行のチェック有無の両方で確認する。(3) 日付差 3 日と 4 日、金額一致と不一致を組み合わせ、金額の差異キューに入る条件 (±3 日かつ類似 0.5 以上かつ金額不一致) の各辺を 1 つずつ外したときに所属が外れること。(4) 一致度の内容点が 内容類似×20 の連続値 (例 0.67 → 13.4 点の扱いは実装時に丸め規則を docs に書いて固定)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: エージェントが qa-backend-web-rc-decision-013 の決定と S2 (規則を docs に明記しテストで固定) から導いた推定。例示の類似度は同じ正規化と bigram Dice を Python で試算した値。丸め規則は未決定で、実装時に docs とテストへ書く前提。 / 回答時刻: 2026-09-15T10:23:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 照合に必要な判定を packages/core の純関数に置く。一致度 (金額一致 50 + 日付差 同日30/1日20/2日10/3日5 + 内容類似×20 の 100 点満点)・一致の理由・ステータス (未処理/要確認/照合済み/除外)・対応キュー 4 分類 (要確認の候補 / MF未計上 / 金額の差異=±3日かつ内容類似で金額不一致 / 日付の近い取引=金額一致で日付差1〜3日)・KPI を 1 か所で算出し、保存済みの判断と除外を反映する。buildExpenseProjection・ハブのバッジ・総収支と件数を一致させ、規則を docs に書きテストで固定する。
- **G4**: 共通シェルを画像に揃える。サイドバーの文言 (概要/データ取込/現金入力/明細仕分け/サブスク/累計収支/支出分析/決算書/AI分析/予算/トレードオフ/設定/使い方/改善リクエスト) とグループ・件数バッジ (データ取込=要確認の取込件数・明細仕分け=未整理明細数・サブスク=判定待ち候補数・照合=要確認件数)、ページ見出し・パンくず・コマンドパレットのラベル追随、月次クローズ進捗 3/4 (データ取込/仕分け/照合は直近の締め月について自動判定、月次レビューは利用者の完了操作を月単位で D1 に保存し取消可)、ヘッダー (防衛ライン：正常 の表記・未記録 Nか月・最終更新・⌘K 検索・ダウンロード・ヘルプのアイコンボタン・アバター)、フッター (外部送信しない / 税務上の正本は freee / 毎晩バックアップ と 利用規約・プライバシー・データ出典・v1.0) と改善を送るボタン。
- **G5**: 画像で使われるアイコンを全て lucide-static 由来の SVG として RouteIcon (または同等の登録表) に追加し、KPI・キュー・ステータス・一致の理由・操作ボタン・ヘッダー・フッター・サイドバーで表示する。絵柄の重複検査テストを維持する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | core の一致度・キュー分類・KPI 関数を実装し、既存集計と件数を揃える。 | core 単体テストが一致度の境界 (日付差 0/1/2/3/4 日・金額不一致・内容類似 0/1) とキュー 4 分類と判断反映を検証し、同じデータで照合 API・ハブのバッジ・総収支の要確認件数が一致する統合テストが緑である。 |
| O4 | 共通シェルの差分を実装する。 | shell 系 DOM テストをサイドバー新文言・件数バッジ・月次クローズ 3/4 (自動 3 + レビュー手動の保存と取消)・ヘッダーのアイコンボタン・フッターリンクで更新して緑、月次レビュー API の統合テストが緑である。 |
| O5 | 画像のアイコンを登録し表示する。 | 画像で使われるアイコンの一覧 (docs 記載) と RouteIcon の登録名が一致し、route-icon-distinct テストと各表示箇所の DOM テスト (svg の存在と aria-hidden) が緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に照合判定関数 (一致度・一致の理由・ステータス・キュー 4 分類・KPI) を置き、buildExpenseProjection とハブのバッジが判断と除外を反映するよう揃える。
- **I5**: routeMetadata のラベルとグループを画像に揃え、件数バッジ・月次クローズ 3/4 (月次レビュー完了の保存と取消)・ヘッダーのアイコンボタン・フッター・改善を送るボタンを共通シェルに入れる。
- **I6**: 画像のアイコン一覧を docs に書き、RouteIcon に不足分を登録して各箇所で表示する。
- **I7**: 一致度・キュー・ステータス・月次クローズ判定の規則を docs に書き、docs/data-schema.md の古い候補条件を直し、境界値テストで固定する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『規則は名前と境界値テストで読めるようにする』を照合の規則の保守に適用した。一致度 (日付差 0/1/2/3/4 日・金額不一致・内容類似 0 と 1)・キュー 4 分類・ステータス・解消率 (分母 0 のとき)・月次クローズの 3 自動ステップを、docs に書いた文言と同じ名前の core テストで境界ごとに固定する。規則を変えるとテストが落ちる状態を保守の停止条件にし、docs/data-schema.md の古い自動照合・要確認の記述とサイドバー文言変更に伴う DOM テストを同じ変更の中で更新する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T08:59:56Z)

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
