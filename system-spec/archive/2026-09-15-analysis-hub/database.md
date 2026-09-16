---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G3]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-ah-observed-001。裏付け質疑 (`qa_refs`): `qa-analysis-hub-decision-002` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではハブ集計に使う取引・月次集計・freee 取引・重複判定をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではハブ集計に使う取引・月次集計・freee 取引・重複判定をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではハブ集計に使う取引・月次集計・freee 取引・重複判定をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではハブ集計に使う取引・月次集計・freee 取引・重複判定をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではハブ集計に使う取引・月次集計・freee 取引・重複判定をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 永続化の境界を動かさない形で反映した。ハブの派生値 (優先度・正常判定・改善余地・前期間比) はデータアクセス層を通して保存せず、既存テーブルの読取りから毎回導出する。スキーマと migration は変えない。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の『変更を小さく保つことが信頼性を保つ』を、スキーマ変更を 0 にする確定内容に反映した。migration を伴わないため、デプロイ順序 (migrate → deploy) の失敗やロールバック時のスキーマ不一致という障害源が本サイクルでは発生しない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3

#### 主たる接地根拠: `qa-database-web-ah-observed-001`

**問**

ハブの集計はどのデータを読み、D1 スキーマや migration の変更は要るか。

**答**

D1 (binding DB、drizzle-orm)。loadDataset(db, userId) は monthly_agg・restored_monthly_agg ほか取引系テーブルを userId で読み Dataset を組む (packages/api/src/store.ts)。総収支は加えて freee_deals・duplicate_verdicts・freee_deal_exclusions を userId で読む (routes/total-cashflow.ts)。ハブの 5 視点の状態・収支サマリー・前期間比はいずれもこれら既存テーブルからの集計で出せるため、新しいテーブル・列・migration は不要 (最新 migration は 0039_account_login.sql のまま)。書込は発生せず読み取りだけで、ハブ API は canonicalMutationFence の対象外 (GET)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/store.ts, packages/api/src/routes/total-cashflow.ts, migrations/。スキーマ変更をしない点は上位概念 U7 (appr-foundation-analysis-hub-001) でも利用者が承認した。 / 回答時刻: 2026-09-14T11:38:26Z)

#### 裏付け質疑: `qa-analysis-hub-decision-002`

**問**

ハブの『現在の状態』列と前 12 か月比を出すデータはどこで計算するか。選択肢: (A) core に純関数を足し GET /analysis/hub が 1 回で 5 視点の状態・収支サマリー・前 12 か月比を返す。前期間の計算は api/ai/dataset.ts から core へ移す (推奨) / (B) API は変えずハブ表示時に既存 5 本を同時に呼び、前 12 か月比と改善余地は省く。

**答**

(A) 集約 API を新設 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-14T11:33:07Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: ハブに必要な集計を packages/core の純関数と、1 回で返す集約 API (GET /analysis/hub) に置く。期間の収支サマリーと前 12 か月比、5 視点それぞれの現在の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前 12 か月比・診断の改善余地) と優先度を返し、ハブ表示中に 5 タブ分の既存 API を呼ばない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | core に analysisHub(dataset) 相当の純関数を置き、API に GET /analysis/hub を足す。 | core 単体テストが期間合計・前 12 か月比 (前期間データ無しは null)・5 視点の状態・優先度・改善余地を固定データで検証し、API 統合テストが認証付きで 200 と期間メタを返し、ハブ表示中の DOM テストで既存 5 API への呼出しが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 期間の収支サマリーに総収入・総支出・純収支と前 12 か月比 (増減率と前期間の金額) を出し、純収支の説明パネルを右に置く。前期間データが無い場合は比較を『比較データなし』と表示する。
- **I4**: core にハブ集計関数を置き、GET /analysis/hub が期間メタ・サマリー・5 視点の状態・優先度を返す。前期間の計算は core へ移し AI 側もそれを使う。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『永続化するのはドメインの状態であって表示の都合ではない』を、ハブのためにテーブルや列を足さない判断に適用した。優先度・マトリクスの正常判定・改善余地は既存の取引・月次集計・freee 取引・重複判定から毎回導出できる派生値である。これを D1 に保存すると、判定規則 (qa-analysis-hub-decision-003) を変えたときに保存値と規則がずれる二重の正本になる。migration は 0039 のまま増やさない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T11:57:54Z)

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
| cloudflare-d1-limits | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/limits/ | 2026-09-14T11:44:16Z | 2026-09-14T11:44:16Z |
