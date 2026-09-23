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
| Web (web) | 確定 | 確定質疑: qa-tradeoff-database-web-001。裏付け質疑 (`qa_refs`): `qa-tradeoff-database-web-evidence-001`, `qa-tradeoff-database-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、database では端末内に試算条件を持つオフライン保存と D1 との同期規則を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、database ではタブレットと web で同じ試算を同時に編集したときの行の競合規則を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、database では端末内データベースへの候補のキャッシュと失効の規則を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、database では端末内データベースの版の移行手順を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、database では端末内データベースと D1 の差分の取り込み規則を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 上書きの読み書きを (user_id, candidate_key) の一意キー 1 本で行う形へ反映した。GET では利用者の上書きを 1 回で読み、候補に重ねるのは core 側で行う。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | migration を追加のみ (CREATE TABLE と ADD COLUMN) に限り、既存の tradeoff_plans の行を書き換えない形へ反映した。途中で Deploy が止まっても既存の行と突合の関数は読めるままになる。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G5

#### 主たる接地根拠: `qa-tradeoff-database-web-001`

**問**

web のトレードオフ画面が要する永続化は何か。

**答**

追加のみの migration (予定番号 0050) で、tradeoff_plans に開始月とメモの列を足し、候補ごとの上書き (必要度とメモ) を置く新表を作る (qa-tradeoff-decision-002, 006, 007)。『この条件で試算』のたびに tradeoff_plans へ 1 行を追加し (qa-tradeoff-decision-008)、最新の 1 件を復元に使う。既存の行と列は書き換えず、保存一覧と突合の表示は外すがデータは残す (qa-tradeoff-decision-004)。全行を user_id で分ける。候補は freee_deals から読み、候補そのものは保存しない。具体の形と上限は qa-tradeoff-database-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-tradeoff-001) と決定 qa-tradeoff-decision-001〜009 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-database-web-evidence-001`

**問**

database 章の裏付けとして、現行のトレードオフ画面まわりについて何を観測したか。

**答**

D1 の tradeoff_plans (migrations/0000_init.sql:85-95、packages/api/src/db/schema.ts:610-620) は id, user_id, title, amount, recurring, selected (JSON 文字列), covered, verdict, created_at を持ち、開始月とメモの列が無い。候補ごとの上書きを置く表は無い。freee_deals (schema.ts:47) は user_id, month, date, io (income / expense), partner, account_raw, account_norm, amount を持ち、科目×取引先の集計に必要な列がそろっている。最新の migration は 0049_ai_report_invariants.sql で、schema-guard.ts の EXPECTED_D1_MIGRATION も 0049 を指す。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-database-web-003`

**問**

web のトレードオフ画面で、利用者が決めていない 候補キーと上書きの表の形・文字数の上限 を何にするか。

**答**

候補キーは『account_norm + 区切り文字 + partner (空なら空文字)』の文字列。上書きは新表 tradeoff_candidate_notes (user_id, candidate_key, need は low / mid / high か NULL, memo は NULL 可, updated_at) で (user_id, candidate_key) を一意にし upsert する。need と memo が両方 NULL になったら行を消して自動へ戻す。tradeoff_plans には start_month (YYYY-MM、NULL 可) と memo (NULL 可) を ADD COLUMN で足し、selected の JSON に候補キーを含める。既存行は NULL のまま読む。 これは agent の推定で、利用者は未確認である。画像と決定 001〜009 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:19:22Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 見直し候補を事業経費の科目×取引先ごとに直近 3 か月の平均月額で作る。必要度 (低 / 中 / 高) と直近の推移 (過去 3 か月の減少 / 横ばい / 増加) を core が推定し、『損益・メモ』には検知器の改善案や推移から作る自動の理由を出す。利用者は必要度を上書きしメモを書け、それらは D1 に保存して自動の値より優先する。
- **G5**: 試算条件と候補ごとの上書きを安全に記録する。『この条件で試算』を押すたびに条件 (支出名・金額・単発 / 毎月・開始月・メモ・選んだ候補・差額) を既存 tradeoff_plans へ履歴として追加し、画面は最新の 1 件を復元する。保存一覧と翌月の突合は画面から外すが、既存の行と突合の関数は消さない。列と表は追加のみの migration で足し、入力は zod で検証し文字数に上限を設け、利用者ごとに分離する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 候補と必要度・推移・理由が決定論で出て、上書きが優先される。 | core の契約テストで、科目×取引先の集計・直近 3 か月平均・推移の 3 区分・必要度の推定・理由の文を固定入力で検査し、api テストで上書きの保存と読み戻し、利用者間の分離を検査する。 |
| O5 | 試算条件と上書きの記録が追加のみで安全に行われる。 | migration が CREATE TABLE / ALTER TABLE ADD COLUMN だけで、api テストで zod の上限・認証・利用者分離・最新 1 件の復元を検査し、既存の tradeoff_plans の行と tradeoffReview の契約テストが緑のままである。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に科目×取引先の候補集計・推移・必要度・自動の理由を新設し、上書きの新表と保存 API を足す。
- **I5**: tradeoff_plans に開始月・メモ列を足し、POST で履歴を追加、GET で最新 1 件を返して画面で復元する。保存一覧と突合の表示を外す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

追加のみの schema 進化の原則を、上書きと試算条件の置き場所に適用した。上書きは候補ごとに 1 行の新表とし (user_id, candidate_key) の一意制約で upsert するため、同じ候補に上書きが重複しない。試算条件は tradeoff_plans に ADD COLUMN で開始月とメモを足し、既存行は NULL として読むので、突合の関数 tradeoffReview と既存の行が壊れない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:19:22Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-21T15:23:17Z | 2026-09-21T15:23:17Z |
| sqlite-upsert | 2024-04-11 | SQLite Consortium (sqlite.org) (sqlite.org) | https://sqlite.org/lang_upsert.html | 2026-09-21T15:23:17Z | 2026-09-21T15:23:17Z |
