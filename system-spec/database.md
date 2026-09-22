---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G3, G5]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-budget-database-web-001。資するゴール: G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、データベースでは端末内のデータベースへ予算を複製し、サーバとどう同期するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、データベースでは端末内のデータベースへ予算を複製し、サーバとどう同期するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、データベースではWindows のローカル保存先に予算をどう置き、暗号化するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、データベースではLinux のローカル保存先に予算をどう置き、暗号化するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、データベースではmacOS のローカル保存先に予算をどう置き、暗号化するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 予算画面の D1 では、利用者・予算対象の開始月・科目の主キーで、1 期間ぶんの予算を 1 回の読取りで返せる形へ反映した。計画による調整額と理由を同じ行に持たせ、根拠の表示のために別表を結合しない。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 予算画面の D1 では、追加のみの migration 1 本に留めて Migrate の失敗時に行の巻き戻しが要らない形へ反映した。新しい表を JSON の書き出しと復元に含め、毎晩のバックアップから予算が戻るようにした。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G5

#### 主たる接地根拠: `qa-budget-database-web-001`

**問**

web の予算画面のデータベース要件は何か。保存単位・移行・既存表との関係・復元をどうするか。

**答**

予算を予算対象の 12 か月 (開始月) ×科目の単位で、年額・収入 / 支出の区別・計画による調整額・調整の理由・更新時刻とともに保存する新しい表を、追加のみの migration 1 本で設ける (qa-budget-decision-001〜003)。同じ期間は上書きで、版は持たない。主キーの先頭は利用者とし、利用者で区切る。既存の budgets 表は残し、1 行も書き換えない。保存行の無い期間を開いたときの初期値は既存 budgets の月額 × 12 を読み出して示すだけで、表へは書かない。新しい表は JSON の書き出しと復元 (Dataset・import-lifecycle) と JSON snapshot の無効化の対象に加え、毎晩のバックアップから予算が戻るようにする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 予算を予算対象の 12 か月 (開始月 YYYY-MM) ごとに科目別の年額・計画による調整額・調整の理由で保存する表を D1 に追加のみの migration で設け、同じ期間は上書きし版は持たない。保存済みの行が無い期間を開いたときは既存 budgets の月額 × 12 を初期値として示す (既存行は書き換えない)。GET /api/budget-plans?start=YYYY-MM と PUT /api/budget-plans を設け、PUT は canonicalMutationFence に登録する。診断の予算カバー率と予算の着地見込みなど既存の budgets の読み手は、今月を含む予算対象の年額 ÷ 12 を返す core の関数を経由して同じ値を読む。
- **G5**: 予算の数値が他画面とずれない。ヘッダの防衛ラインと防衛ライン余裕は同じ defenseLine、診断の予算カバー率と予算画面の設定済み科目は同じ予算の読み出し関数から導き、既存の診断・概要・家計収支・総収支・決算書の数値テストが緑のままである。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | KPI・一覧・グラフ・見通しの数値が core の 1 か所から出て互いに一致する。 | core の単体テストで、同じ Dataset・実績期間・予算対象に対し 年間収入予算 + (−年間支出予算) = 予算純収支、一覧の来期予算の和 = KPI、グラフの月次予算の年合計 = KPI、防衛ライン余裕 = 年間収入予算 − defenseLine().line × 12、自動提案 = 千円丸め(前期実績 × (1 + 増減率) + 季節性補正 + 計画による調整) の各項、過不足カテゴリの差額 = 見通し − 来期予算、調整によるインパクト = Σ(来期予算 − 自動提案) が固定される。 |
| O3 | 予算が期間ごとに保存され、既存の読み手が同じ値を読む。 | API 統合テストで、PUT が期間ごとに保存し同じ期間は上書きされ、未認証 401・フェンス違反の拒否・不正値の 400 を確かめる。migration が既存行を 1 行も書き換えないことを検査し、保存行の無い期間で既存月額 × 12 が初期値になること、診断の予算カバー率が新しい表の値から出ることを確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 予算対象の期間別の年額表を追加のみの migration で設け、GET / PUT /api/budget-plans と fence 登録を行い、診断の予算カバー率など既存の budgets の読み手を同じ読み出し関数へ寄せる。

### 本章に効く確定意思決定

- **dec-budget-storage-unit**: 予算の保存単位をどうするか (期間を持たない科目別の月額 1 つか、予算対象の 12 か月ごとの年額か)。
  - 採択: 期間別の年額表を追加 (`opt-period-annual-table`)
  - 目的適合: 画像の予算対象 12 か月・年額入力と一致し、既存の月額を初期値に引き継げる。
- **dec-budget-defense-margin**: KPI の『防衛ライン余裕』を何で数えるか。
  - 採択: 収入予算 − 防衛ライン × 12 (`opt-income-minus-line`)
  - 目的適合: ヘッダと同じ defenseLine を使い、年間収入予算が 1 年の防衛ラインをどれだけ上回るかを示す。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Schema evolution の card (expand のみで contract しない) を予算画面に適用した。予算対象ごとの新しい表を足し、既存の budgets 表は読むだけで書き換えない。保存行の無い期間の初期値も読み出し時に月額 × 12 で作るので、C3 の『既存行の書き換え 0 件』を migration 1 本で守れる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:35:48Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-21T13:39:51Z | 2026-09-21T13:39:51Z |
