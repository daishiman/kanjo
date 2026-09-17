---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G3, G4]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-trends-observed-003。裏付け質疑 (`qa_refs`): `qa-trends-decision-002`, `qa-trends-decision-003`, `qa-trends-decision-004`, `qa-trends-decision-006`, `qa-trends-decision-008`, `qa-trends-decision-010`, `qa-target-platforms-trends-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、推移画面の本カテゴリでは端末内に明細の写しを持ち、今回と比較期間の集計をオフラインで出すための同期方式を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、推移画面の本カテゴリでは端末内に明細の写しを持ち、今回と比較期間の集計をオフラインで出すための同期方式を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、推移画面の本カテゴリでは端末内に明細の写しを持ち、今回と比較期間の集計をオフラインで出すための同期方式を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、推移画面の本カテゴリでは端末内に明細の写しを持ち、今回と比較期間の集計をオフラインで出すための同期方式を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、推移画面の本カテゴリでは端末内に明細の写しを持ち、今回と比較期間の集計をオフラインで出すための同期方式を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-foundation-trends-001`

2026-09-16T09:27:37Z (回答直後の date -u 実測、選択時刻の上限値) 利用者が AskUserQuestion で推移画面サイクルの foundation (U1・G1-G5・対象外・制約) を『この内容で承認』と回答。先行する利用者決定 (2026-09-16T09:16:35Z / 09:19:14Z): 手を打つ順番=開閉式で残す、要因の説明=規則で自動生成、汎用性=指標を登録制、明細への導線=/classify に絞込を足す、期間タブ=全体の期間選択を操作、前期間=直前の同じ長さ、初期の月=最も変化が大きい月。

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 推移は新しい表も migration も足さず、Dataset と freee 系 4 表を総収支と同じ関数で読む。永続化の形は総収支の判定作業が所有したままにする。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 説明文も集計結果も保存しないので、推移の値は元データから常に再計算でき、バックアップ・復元の対象と手順は変わらない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4

#### 主たる接地根拠: `qa-database-web-trends-observed-003`

**問**

推移の拡張で D1 のスキーマ変更は要りますか?どの表を読みますか?

**答**

要らない。推移の数値は総収支と同じ取引集合から数える (qa-trends-decision-008)。読むのは loadDataset が作る Dataset (MF 明細 MfTx の日付・金額・大項目・内容 c・口座 inst、事業/家計の区分) と、loadReviewSources が読む freee_deals・duplicate_verdicts・freee_deal_exclusions・mf_tx_exclusions の 4 表で、どれも既存の表である。系列・比較・カテゴリ行・取引先行・説明文はこの読み取り結果から毎回導出し、説明文もメモも保存しないため、新しい表も migration (最新は 0042) も足さない。期間は applyPeriod/sliceDataset で切り、比較期間も同じ関数で切り出す。バックアップ・復元の対象表は変わらない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: R4-reopen (2026-09-16T09:55:09Z、数値の出所の利用者決定の反映) の後に既存コードを読み直した再観測 (worktree 07推移画面改善、origin/main 9da407b。packages/api/src/routes/analytics.ts の loadScoped / loadReviewSources、packages/core/src/total-cashflow.ts の totalCashflowReport、packages/web/src/pages/analysis/TotalCashflow.tsx)。answered_at は読解直後に date -u で実測した時刻。 / 回答時刻: 2026-09-16T09:55:39Z)

#### 裏付け質疑: `qa-trends-decision-002`

**問**

画像の増減要因の説明文(例『春のキャンペーンに伴う広告出稿の増加』)は、何から作りますか?選択肢: (A) 規則で自動生成 (推奨) / (B) 利用者がメモを書く / (C) AI で生成。

**答**

(A) 規則で自動生成 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:16:35Z)

#### 裏付け質疑: `qa-trends-decision-003`

**問**

『様々な情報の推移を管理できる汎用性』はどこまで作りますか?選択肢: (A) 指標を登録制にする (推奨。今回は収入・支出・純収支の 3 指標で出し、あとから指標を足せる形にする) / (B) 画像の 3 指標だけ固定 / (C) 件数・口座別残高なども今回出す。

**答**

(A) 指標を登録制にする を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:16:35Z)

#### 裏付け質疑: `qa-trends-decision-004`

**問**

『該当明細を開く』と、カテゴリ行→取引先の内訳はどこまで作りますか?選択肢: (A) 明細画面 /classify に category・取引先(明細の内容)の絞込クエリを足す。取引先は名寄せなし (推奨) / (B) 月だけで開く / (C) 取引先の名寄せ規則も作る。

**答**

(A) 明細画面に絞込を足す を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:16:35Z)

#### 裏付け質疑: `qa-trends-decision-006`

**問**

比較対象『前期間』はどの期間を指しますか?(『前年』は前年の同じ月範囲とします) 選択肢: (A) 直前の同じ長さ (推奨。支出分析ハブの previousPeriod と同じ定義) / (B) 期間内の前半と後半。

**答**

(A) 直前の同じ長さ を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:19:14Z)

#### 裏付け質疑: `qa-trends-decision-008`

**問**

推移の数値 (収入・支出・純収支とカテゴリ・取引先の行) は、どの取引集合から数えますか?選択肢: (A) 総収支と同じ (freee 取引と MF 明細を消し込んだ後の集合。totalCashflowReport と同じ数え方で、総合・事業の値が概況と総収支画面に一致する。freee 由来の行の明細は総収支画面で開く) (推奨) / (B) MF 明細だけ (現行 /api/trends と同じ。事業の値が概況・総収支と一致しない)。

**答**

(A) 総収支と同じ を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の decision_guidance 指摘を受けた追加質問)。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T09:50:42Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:50:42Z)

#### 裏付け質疑: `qa-trends-decision-010`

**問**

期間に『全期間』を選んだとき、比較期間 (前期間・前年) はどう扱いますか?選択肢: (A) 比較を出さない (推奨。比較対象の切替を無効にして理由を表示し、KPI の増減は最も変化が大きい月の前月差で出す) / (B) 前年だけ出す。

**答**

(A) 比較を出さない を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の decision_guidance 指摘を受けた追加質問)。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T09:50:42Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:50:42Z)

#### 裏付け質疑: `qa-target-platforms-trends-001`

**問**

推移画面サイクルの対象プラットフォームはどれですか? foundation の対象外に『web 以外の platform (専用アプリ)』を含めた案を提示し、承認を求めた。

**答**

foundation を『この内容で承認』と回答した。対象は web のみ (狭幅は既存 web のレスポンシブ表示で扱う)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で foundation 全体 (scope.out に web 以外を含む) を承認した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:27:37Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 推移に必要な集計を packages/core の純関数と API に置く。数値は総収支と同じ取引集合 (freee 取引と MF 明細を消し込んだ後、totalCashflowReport と同じ数え方) から数え、総合・事業・家計の値を概況と総収支画面に一致させる。範囲 (総合/事業/家計)・指標・比較対象 (前期間=直前の同じ長さ / 前年=前年の同じ月範囲) を受け取り、今回と比較期間の月次系列、月次差、KPI (現在値・増減額と率・最も変化が大きい月)、選択月の詳細 (各指標の値・増減要因 上位 3・出典の口座)、カテゴリ別の行 (直近 12 か月の系列・今回・比較・増減額・増減率・構成比・寄与度。カテゴリは MF 由来が大項目、freee 由来が勘定科目)、カテゴリ内の取引先別の行、パレート (増減額の降順と累計構成比) を返す。期間は既存の Dataset を切る設計 (sliceDataset) に従い、比較期間のデータは同じ方法で切り出す。全期間を選んだときは比較期間を作らず、KPI の増減は最も変化が大きい月の前月差で出す。要確認の MF 明細は総収支と同じく事業にも家計にも数えず、期間と選択月の要確認の件数と金額 (totalCashflowReport の月次 reviewCount・reviewAmount) を返す。開閉で残す傾向の判定は現行どおり MF 明細だけから trendsReport で計算し、どの基準で数えたかを返却に含める。
- **G4**: 推移から根拠の明細へ辿れるようにする。MF 由来の行の『該当明細を開く』『増減の明細を確認』は /classify へ月・範囲に加えてカテゴリと取引先 (専用の payee クエリ、明細の内容と完全一致、名寄せなし) の絞込クエリを渡して開き、明細画面はその絞込で表示する。freee 由来の行は MF 明細の画面に無いため、全体の期間選択を保ったまま総収支画面 (/analysis/total-cashflow) を開く。期間タブは全体の期間選択 (usePeriod) を操作し、範囲・指標・比較対象・選択月・選択カテゴリは URL に保持して再読込と共有で同じ表示に戻る。URL の値が形式違反なら既定値へ倒して画面を出す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 範囲・指標・比較対象の切替で KPI・チャート・表・パレートが同じ条件の値に切り替わる。 | core テストで 3 指標×3 範囲×2 比較対象の組合せについて、総合=事業+家計、純収支=収入-支出、カテゴリ行の今回合計の和=指標の期間合計、寄与度の和=100% (増減 0 を除く) が成り立つ。 |
| O4 | 選択した月・カテゴリ・取引先から絞り込んだ明細へ遷移できる。 | DOM テストで MF 由来の行の遷移先 URL (/classify の month・cls・category・payee) が正しく、/classify がそのクエリで該当明細だけを表示する。freee 由来の行は /analysis/total-cashflow へ遷移する。URL の条件から推移の表示が復元され、形式違反の値は既定値で表示される。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 推移タブの上部に期間タブ (1年/2年/3年/任意) と期間表示を置き、全体の期間選択と同期させる。
- **I3**: KPI 3 枚: 現在の値 (期間合計)、前期間 (または前年) からの増減の額と率、最も変化が大きい月とその増減と主な要因の一文。KPI の値は要確認の明細を含まない値である (帯の注記と対応する)。
- **I4**: 推移チャート: 収入・支出・純収支の今回の折れ線と、選んだ指標の比較期間の点線、月次差の棒、選択月の縦帯。月をクリックで選択月を変える。
- **I5**: 詳細パネル: 選択月の収入・支出・純収支と比較期間の値、主な増減要因 上位 3 (カテゴリ・増減額・説明文)、データの出典 (口座名と件数)、該当明細を開くボタン。選択月に要確認の明細があればその件数と金額も出す。freee 由来の行で口座が空のものは口座名を『—』と表示し、口座別の件数には数えない。
- **I6**: カテゴリ別の推移と増減の表: 12 か月のスパークライン・今回合計・比較期間・増減額・増減率・構成比・寄与度。行を開くと取引先別の同じ列の内訳を出す。
- **I7**: 増減の要因のパレート図 (増減額の棒と累計構成比の折れ線) と、増減が大きい項目の上位 3 のカード。
- **I8**: 下部の選択バー: 選択中の月とカテゴリ (取引先) と増減額・率を出し、『増減の明細を確認』で絞込済みの明細へ遷移する。
- **I10**: /classify にカテゴリ・取引先の絞込クエリを追加する。

### 本章に効く確定意思決定

- **dec-trends-datasource-001**: 推移の数値をどの取引集合から数えるか (総収支と同じ freee+MF の消し込み後か、MF 明細だけか)
  - 採択: 総収支と同じ取引集合 (totalCashflowReport) (`opt-total-cashflow`)
  - 目的適合: G3 の『概況・総収支と一致する値』を満たし、事業費・事業収入を freee 側から数えるため事業の推移が会計と合う。
- **dec-trends-review-rows-001**: 推移の数値に要確認の MF 明細をどう扱うか (含めず件数を表示するか、公私仕分けで仮に数えるか)
  - 採択: 含めず件数と金額を注記する (`opt-exclude-with-note`)
  - 目的適合: G3 の『総収支と一致する値』を保ったまま、G1 の画面上で欠けている量を見せられる。
- **dec-trends-judgement-source-001**: 開閉で残す傾向の判定を MF 明細のまま計算するか、総収支と同じ取引集合へ移すか
  - 採択: MF 明細のまま計算し、基準を見出しに明記する (`opt-keep-mf-with-label`)
  - 目的適合: C4 (既存の傾向判定の値とテストを壊さない) を満たし、G5 の規則の固定も既存テストで続けられる。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Domain-Driven Design の集約境界を、推移では『読むだけ』の側に適用した。freee_deals・duplicate_verdicts・freee_deal_exclusions・mf_tx_exclusions は総収支の判定作業が所有する集約で、推移はそれを書き換えず、同じ読み取り関数 (loadReviewSources) を通して参照する。推移専用の表を作らないので、集約の不変条件 (1 つの MF 明細は消し込み・除外・要確認のどれか 1 つ) の持ち主は総収支のまま 1 か所に保たれる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-16T09:55:39Z)

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-limits | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/limits/ | 2026-09-16T09:31:19Z | 2026-09-16T09:31:19Z |
