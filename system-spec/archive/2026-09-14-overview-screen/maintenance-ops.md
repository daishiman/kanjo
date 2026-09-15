---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2, G3, G4]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-maintenance-ops-web-ov-observed-001。裏付け質疑 (`qa_refs`): `qa-design-rules-ov-decision-001`, `qa-o2-measure-ov-decision-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは端末・OS 版ごとの描画検査とクラッシュ収集をどう回すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリでは端末・OS 版ごとの描画検査とクラッシュ収集をどう回すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリでは端末・OS 版ごとの描画検査とクラッシュ収集をどう回すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリでは端末・OS 版ごとの描画検査とクラッシュ収集をどう回すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリでは端末・OS 版ごとの描画検査とクラッシュ収集をどう回すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | SRE の運用手順の明文化を、件数が3か所でずれたときに API 応答 → React Query のキー共有 → 保留の内容指紋 の順に確認する手順と、描画検査の失敗時に screenshot から幅を特定する方法を docs に残す規則 (qa-design-rules-ov-decision-001 の (4)) に反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G3, G4

#### 主たる接地根拠: `qa-maintenance-ops-web-ov-observed-001`

**問**

概況の作り替えを、どの検査に差し込めば回帰を機械で止められるか。現行の検査で足りないところはどこか。

**答**

ci.yml は static-checks (lint/typecheck/test:aux)・test-core-web・test-api・build を並行で回し集約する (:33-112)。描画検査 packages/web/scripts/check-financial-visuals.mjs は Overview を { name: 'Overview', path: '/', expectedFigures: 1 } (:820) で登録し、FinancialFigure 内の canvas がちょうど1つかを [360, 375, 390, 1280] の4幅 (:826) でしか見ていない。一方、画面条件の唯一の定義 viewports.mjs の VIEWPORT_CASES は 320/360/375/390/768/1280/1600/zoom200 の8ケースで、承認済み O4『8幅』を満たすには Overview をこの8ケースへ移し、expectedFigures を新しい図の数 (推移と内訳) に合わせる必要がある。schema-guard.test.ts:63-67 は migration と EXPECTED_D1_MIGRATION の一致を検査するので、migration だけ足して定数を忘れると落ちる。improvement-backup-exclusion.test.ts:34-44 は BACKUP_SNAPSHOT_SQL が明示列挙で sqlite_master を総なめしないことだけを検査し、新テーブルをバックアップへ入れ忘れても落ちない — そのため O3 の往復テストがこの更新漏れを止める唯一の検査になる。Overview を実際に描画する DOM テストは defense-forecast.dom.test.tsx だけで、common-shell-routes.dom.test.tsx は Overview をスタブにしている。追加する検査は、core 単体 (O1 同一 fixture で4要素の総額差0、O5 信頼度の決定論と推奨なし)、DOM (O2 バッジ・カード・アクションバーの件数一致と後で確認での同時減少)、API (O3 保留・月次レビューのバックアップ→全消去→復元の往復)、描画 (O4 check-financial-visuals の Overview 8ケース) の4系統である。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: Explore サブエージェントが 2026-09-14 に packages/api・packages/core・packages/web・migrations・.github を読み、file:line を付けて報告した観測事実。報告受領後に date -u で実測した時刻を answered_at (上限値) とした。 / 回答時刻: 2026-09-14T11:54:38Z)

#### 裏付け質疑: `qa-design-rules-ov-decision-001`

**問**

仕様書の上流指針に『推定』として書いた設計規則のうち、仕様として確定させるものを選んでください (複数選択、選ばなかったものは『実装時の提案』と明記して残す)。選択肢: 入力検証とDB制約の二重化 / 計算は core の純関数に置く / 新部品を共通化・PUTは冪等 / 件数ずれの切り分け手順を文書化

**答**

4件すべてを確定する。(1) 入力検証とDB制約の二重化: 保留と月次レビューの書込 API は kind (classification|reconciliation|import の3値)・itemKey (長さ上限つき文字列)・month (YYYY-MM) を境界で検証して 400 を返し、DB 側でも CHECK 制約と主キーで守る。migration 0040 は CREATE TABLE と CREATE INDEX だけで既存テーブルを変えず、件数などの集計列は保存しない。(2) 計算は core の純関数に置く: 未処理キュー・信頼度・月次クローズ判定・直近12か月比較は packages/core の純関数にし、packages/api のルートは D1 から読んだ行を渡して JSON にするだけにする。web は応答型 OverviewResponse・ReviewQueueResponse だけを知り、優先順位や信頼度を画面側で再計算しない。(3) 新部品を共通化・PUT は冪等: サイドバーのバッジ・右パネル・固定アクションバーは packages/web/src/components/ の共通部品にし、他の画面でも使える形にする。保留と月次レビューの PUT は同じ値を再送しても結果が変わらない。(4) 件数ずれの切り分け手順を文書化: 件数が3か所でずれたときは API 応答 → React Query のキー共有 → 保留の内容指紋 の順に確認する手順と、描画検査が失敗したときに screenshot から幅を特定する方法を docs に残す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 4件の文言は完成度 evaluator が『確定質疑に無い』と指摘した doctrine 記述をそのまま選択肢にしたもの。 / 回答時刻: 2026-09-14T12:14:38Z)

#### 裏付け質疑: `qa-o2-measure-ov-decision-001`

**問**

成功目標 O2(未処理件数の3か所一致)の検査方法に、今回決まった2つの振る舞いを加えますか? 選択肢: 加える (推奨) = (1) 期間を切り替えても未処理件数が変わらない (2) 保留にした明細の内容指紋が変わると再び未処理に数えられる、を足す / 加えない = 2つの振る舞いは各章のテスト方針にだけ書く

**答**

『加える』。O2 の measure に、(1) DOM テストで期間を 1年 から 3年 に切り替えても3か所の件数が変わらないこと (qa-review-queue-scope-ov-decision-001 の全期間で数える)、(2) core の単体テストで、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられ3か所の件数へ戻ること (qa-snooze-fingerprint-ov-decision-001) を足す。上位概念の変更として appr-foundation-overview-002 で承認を記録する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (回答返却の直後に実測した時刻 2026-09-14T12:42:56Z)。完成度 evaluator の再評価 (completeness-findings-r2.json) の差し戻しを受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:42:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 総合 (事業+家計、重複除外) / 事業 / 家計 の総収入・総支出・純収支と前12か月比を最上位に出す。KPI・推移・年次比較・内訳は単一の定義で互いに検算が一致する。
- **G2**: 仕分け確認・照合確認・取込確認を1つの未処理キューに集約する。件数 (バッジ・カード・アクションバー) の一致、優先順位、根拠種別付きの推奨科目と信頼度、右パネル、該当画面への1操作遷移を持つ。
- **G3**: 月次クローズ4ステップをデータから判定する。「月次レビュー完了」と「後で確認」は D1 に保存し、バックアップと復元でも保つ。
- **G4**: 02 のレイアウトを共通シェル・トークン・部品で実装する。既存の防衛予測・移動平均・パレート・未決済・科目別年比較は段階的開示で残す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 同一 fixture で KPI・推移・年次比較・内訳の4要素の総額差が0である。 | core の単体テストが同一 fixture から4要素を計算し、総収入・総支出・純収支の差が 0 円であることを assert する。 |
| O2 | 未処理件数がサイドバーのバッジ・未処理カード・固定アクションバーの3か所で一致する。 | DOM テストが3か所の件数表示を取得して一致を assert し、1件を後で確認にしたとき3か所が同時に減ること、ヘッダーの期間を 1年 から 3年 に切り替えても3か所の件数が変わらないことも検査する。core の単体テストが、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられることを assert する。 |
| O3 | snooze と月次レビュー完了がバックアップ→復元の往復で保たれる。 | API テストが snooze と月次レビューを書き、バックアップを取り、全消去後に復元して行が一致することを assert する。 |
| O4 | 画像正本の表示順と広幅レイアウトを保ち、概況の描画検査が8幅で通る。 | `system-spec/ui-ux.md#表示順の正本` の順序、広幅の Review 3列・比較/内訳2列、横はみ出しなしを scripts/check-financial-visuals.mjs が観測し、Overview エントリを8幅で描画して exit 0 になる。 |
| O5 | 推奨科目の信頼度が決定論で、根拠が無ければ推奨なしを返す。 | core の単体テストが同じ入力で同じ信頼度を返すこと、vendor_memory・ルール・MF中項目のいずれも該当しない明細で推奨なしを返すことを assert する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: KPI 3枚 (総収入・総支出・純収支、前12か月比つき) と説明カード
- **I2**: 推移グラフの1年・2年・3年切替 (移動平均は切替で残す)
- **I3**: 未処理カード3種 (仕分け確認・照合確認・取込確認)
- **I4**: 優先度順の未処理明細表
- **I5**: 右パネル (理由・取引元・類似取引・推奨仕訳と信頼度・仕分けを開く・後で確認)
- **I6**: 年次比較表 (増減額・増減率)
- **I7**: 支出内訳の金額・構成比切替 (上位5+その他、パレートは構成比表示で残す)
- **I8**: 固定アクションバー (未処理件数と次の操作)
- **I9**: 本文のデータ最終更新と出典リンク

### 本章に効く確定意思決定

- **dec-review-state-storage**: 『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか
  - 採択: D1 に2テーブル (review_snoozes・monthly_close_reviews) を追加し、夜間バックアップと復元の対象にする (`d1`)
  - 目的適合: G3 の『D1 に保存し、バックアップと復元でも保つ』に直接合う。端末やブラウザを替えても未処理件数と月次クローズの判定が変わらない
- **dec-overview-aggregation-scope**: 概況の総収入・総支出・純収支、推移、年次比較、支出の内訳を、どの範囲で集計するか
  - 採択: 総合 (事業+家計、重複除外) を既定にし、事業/家計へ切り替えられる (`total-with-toggle`)
  - 目的適合: G1 の『総合/事業/家計の総収入・総支出・純収支と前12か月比』をそのまま満たす
- **dec-overview-legacy-elements**: 02 の画像に無い既存要素 (防衛予測・移動平均・パレート・未決済・科目別年比較) を概況でどう扱うか
  - 採択: 畳んで残す (防衛予測は注意・警告の見込みがあるときだけ KPI の上に出し、移動平均は推移の切替、パレートは構成比表示、未決済・科目別年比較は <details>『詳しく見る』) (`fold-and-keep`)
  - 目的適合: G4 の『02 のレイアウトで実装し、既存要素は段階的開示で残す』をそのまま満たす
- **dec-recommendation-confidence-source**: 右パネルの推奨科目と信頼度を何を根拠に出すか
  - 採択: 既存の判定根拠を統合 (vendor_memory の一致率 → ルール → MF中項目、どれも無ければ推奨なし) (`integrate-existing`)
  - 目的適合: G2 の『根拠種別付きの推奨科目と信頼度』を満たし、O5 の決定論を検査できる

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の Executable examples を O1-O5 の検査配置に適用した。検査は内部構造でなく観測できる結果 (総額差0、3か所の件数一致、往復後の行一致、8ケースの描画) を守る。migration 定数の漏れは既存の schema-guard.test が落とし、バックアップ対象の漏れを落とす既存検査は無いので O3 の往復テストが唯一の検査になる (qa-maintenance-ops-web-ov-observed-001)。件数ずれの切り分け手順を docs に残すことは qa-design-rules-ov-decision-001 の (4) で確定した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 記録時刻: 2026-09-14T12:20:03Z)

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
