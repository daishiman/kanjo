---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G2, G4]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-household-database-web-004。裏付け質疑 (`qa_refs`): `qa-household-database-web-evidence-001`, `qa-household-database-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、データベースでは端末内に家計の集計や名義ラベルを複製する SQLite を持つか、その同期の衝突をどう解くかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、データベースではタブレット端末でのオフライン閲覧のために期間分の台帳を端末へ持つかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、データベースではデスクトップ版のローカル保存先と暗号化の方式を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、データベースではデスクトップ版のローカル保存の権限 (ユーザーディレクトリの扱い) を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、データベースではネイティブ版のローカル保存とキーチェーンでの鍵管理を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | owner_labels の読み書きを settings の route に 1 か所だけ置く形へ反映した。読み取りは利用者の 4 行以下を 1 回で取り、欠けた名義は既定の表示名で補う。更新は 4 行の upsert をまとめて行い、途中で失敗したときに一部だけ変わらないようにする。家計の集計は既存の明細・判定・除外の表からの読み取りだけで作り、新しい索引も追加しない。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | migration を追加のみにすることで、巻き戻しが表を使わないことだけで済む形へ反映した。既存の名義列 (institution_owners・rules.owner・tx_edits.owner・tx_splits.owner) を 1 行も書き換えないため、行の書き換えで Deploy が止まった過去の復旧手順が要らない。runtimeSchemaGuard の必須表に owner_labels を加え、migration を適用する前の Worker が新しい経路を中途半端に動かさないようにする。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G4

#### 主たる接地根拠: `qa-household-database-web-004`

**問**

家計収支画面のために D1 のスキーマをどう変えるか。

**答**

名義の表示名を保存する owner_labels 表だけを追加する (追加のみの migration。次の空き番号は実装時に origin/main を fetch して確定する)。列は user_id・owner (CHECK で business / spouse / family / unset)・label (長さの上限を CHECK で守る。具体値は qa-household-database-web-003 (agent 推定) を参照)・updated_at、主キーは (user_id, owner)。行が無い名義は既定の表示名 (本人 / パートナー / 子ども / その他) を使い、初期データを投入しない。名義の内部値と既存表 (institution_owners・rules.owner・tx_edits.owner・tx_splits.owner) の行は 1 行も書き換えない (利用者決定 qa-household-decision-002)。家計の集計値は保存せず要求のたびに導出する。振替の対推定のために相手口座カラムを足さない (qa-household-decision-003)。runtimeSchemaGuard の必須表へ owner_labels を加える。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-database-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-database-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

#### 裏付け質疑: `qa-household-database-web-evidence-001`

**問**

database 章の裏付けとして、名義と振替の保存形について何を観測したか。

**答**

名義の内部値は packages/core/src/types.ts:114-147 の OWNER_VALUES (business / spouse / family) と導出値 unset で、表示名 OWNER_LABEL (事業 / 妻 / 家族 / 未設定) はコードに固定されている。D1 では institution_owners、rules.owner、tx_edits.owner (migrations/0009)、tx_splits.owner (migrations/0035) がいずれも CHECK で 3 値に固定されている。振替は migrations/0022 の mf_transactions.is_transfer で、相手口座の列は無い。最新の migration は 0042_total_cashflow_operations_and_exclusion_reason.sql である。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-18T11:33:59Z)

#### 裏付け質疑: `qa-household-database-web-003`

**問**

web の家計収支画面で、利用者が決めていない owner_labels の表示名の長さ制約 を何にするか。

**答**

表示名は前後の空白を除いて 1〜20 文字とし、D1 の CHECK 制約でも長さを守る。 これは agent の推定で、利用者は未確認である。画像と決定 001〜007 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様書 specs/spec-household-cashflow-screen.md を書く際に補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-18T12:02:30Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 家計の集計を core の純関数 1 か所に集め、総収支の台帳 (totalCashflowLedger) を正本にする。総収入・総支出・純収支と月平均・年換算、事業と個人の分解 (和が家計全体に一致)、前年同期間との比較 (前年に欠けた月があれば比較不能として null)、月別の収入・支出・純収支と前年系列、生活費カテゴリ 6 区分の集計と構成比・前年差、名義別の収入と前年差を同じ関数から算出し、GET /api/household をこの形へ拡張する。総収支画面の『総合』と家計画面の『家計全体』が同じ期間で同じ数字になることをテストで固定する。
- **G4**: 名義を『本人 / パートナー / 子ども / その他』で扱えるようにする。内部値 (business / spouse / family と未設定) は変えず、名義ラベル表を追加する追加のみの migration と、表示名の取得・更新 API を設ける。初期表示名は business→本人、spouse→パートナー、family→子ども、未設定→その他。『名義ラベルを編集』から表示名だけを変更でき、家計画面・設定画面・明細画面の名義表示がすべてこの表示名を参照する。更新 API は既存の authGuard・パスワード変更フェンス・スキーマガード・変更系フェンスの内側に置き、入力は zod で長さと文字種を検証する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 家計の数字が総収支画面と一致し、等式が閉じる。 | core の単体テストで、同じ Dataset と期間に対し家計全体の総収入・総支出・純収支が totalCashflowLedger の総合と toBe で一致し、事業 + 個人 = 家計全体が全月で成り立ち、前年欠損月があるとき前年差が null になる。 |
| O4 | 名義ラベルの編集が安全に保存され全画面に反映される。 | API 統合テストで、未認証 401・変更系フェンス違反の拒否・長さ超過と制御文字の 400・正常更新の 200 と再取得での反映を確認し、migration が既存行を 1 行も書き換えないことを検査する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に household-summary (仮称) を新設し、totalCashflowLedger の行集合から家計全体・事業・個人の総額と月別系列、前年比較、生活費 6 区分、名義別収入を 1 か所で算出する。旧 household() の独自定義は置き換える。
- **I4**: 生活費 6 区分 (住居費 / 食費 / 光熱費 / 教育費 / 交通費 / その他) と MF 大項目の対応表を core に 1 か所だけ置き、docs に同じ表を載せる。
- **I6**: owner_labels 表と GET / PUT の表示名 API、名義ラベル編集ダイアログを作り、家計・設定・明細の名義表示を表示名の取得関数 1 つへ寄せる。

### 本章に効く確定意思決定

- **dec-household-figure-source**: 画像の数値が算術で閉じない欄をどう扱うか。収入・支出を正本に差を計算するか、画像の純収支を正本にして前年の総支出を調整するか。
  - 採択: 収入・支出を正本に差を計算する (−¥80,000) (`opt-compute-from-income-expense`)
  - 目的適合: G2 の『数字は台帳の行から作る』と一致し、どの欄も算術で閉じる。見た目の数値は一部画像と変わる。
- **dec-household-ledger-source**: 家計収支の数字を何から作るか。総収支画面の台帳を正本にするか、現行の household() を拡張するか。
  - 採択: 総収支の台帳を正本にする (`opt-ledger-source`)
  - 目的適合: G2 の『家計の集計を 1 か所に集め、総収支と同じ行から作る』に直接答える。総収支の総合と家計全体が同じ行集合から出るため、両画面の数字が一致する。
- **dec-household-owner-model**: 名義を『本人 / パートナー / 子ども / その他』で扱うとき、内部値を移行するか、内部値を残して表示名だけを編集可能にするか。
  - 採択: 内部値は残し表示名を編集可能にする (`opt-owner-display-label`)
  - 目的適合: G4 の表示名の要件を満たし、既存の business / spouse / family / unset を使う規則・明細を壊さない。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『永続化するのはドメインの状態であって表示の都合ではない』を、名義ラベルだけ表を足す判断に適用した。家計の集計値・前年比・構成比・振替の対は、どれも既存の明細と判定から導出できるので保存しない。一方で名義の表示名 (本人 / パートナー / 子ども / その他) は利用者が決める状態であり、導出できないので owner_labels 表として持つ。名義の内部値 (business / spouse / family / unset) は institution_owners・rules・tx_edits・tx_splits の CHECK 制約に固定された識別子なので変えず、表示名だけを別の表に分ける。行が無いときは既定の表示名で補い、初期データの投入も既存行の書き換えも行わない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T11:37:52Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-18T11:39:30Z | 2026-09-18T11:39:30Z |
