---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G2, G5]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-ai-database-web-001。裏付け質疑 (`qa_refs`): `qa-ai-database-web-evidence-001`, `qa-ai-database-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、database では端末内に依頼とレポートを持つ場合のローカル DB と D1 の同期規則を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、database では共有端末に残るレポート本文のキャッシュ期限を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、database ではオフライン時に貼り付けたレポートを保留する端末内の保存形を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、database では端末内に保留したレポートの保存先のファイル権限を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、database では端末内に保留したレポートを Keychain とファイルのどちらに置くかを決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | ai_tasks の新しい列の書き込みを、それぞれの出来事の経路 1 か所にだけ置く形へ反映した。データ取得時刻はエージェントのデータ取得、差し戻しはレポートの契約違反、取消時刻はキャンセル経路で書き、段階の導出側は読むだけにする。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | migration 0046 を列の追加だけにすることで、既存の依頼とレポートを 1 行も書き換えず、巻き戻しが新しい列を読まないことだけで済む形へ反映した。runtimeSchemaGuard の必須列に新しい列を加え、migration 前の Worker で新経路が動かないようにする。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G5

#### 主たる接地根拠: `qa-ai-database-web-001`

**問**

AI 依頼の段階を導くために D1 のスキーマをどう変えるか。

**答**

追加のみの migration 0046 で ai_tasks に 連番 (seq)・データ取得時刻 (data_fetched_at)・差し戻し時刻 (rejected_at)・差し戻し回数 (reject_count、既定 0)・取消時刻 (canceled_at) を足す。既存行は書き換えない。段階・進捗・版の説明は保存せず記録から導く。ai_reports は変えない。runtimeSchemaGuard の必須列に新しい列を加え、migration 適用前の Worker が新しい経路を中途半端に動かさないようにする。具体の採番は qa-ai-database-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-ai-analysis-001) と決定 qa-ai-decision-001〜008 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-database-web-evidence-001`

**問**

database 章の裏付けとして、AI 依頼とレポートの保存形について何を観測したか。

**答**

ai_tasks (packages/api/src/db/schema.ts:589-611) は id・user_id・period_from/to・report_type・supplement・parent_report_id・token_hash・expires_at・used_at・copied_at・copied_target・report_id・created_at を持ち、連番・データ取得時刻・差し戻し・取消の列は無い。ai_reports (schema.ts:620-640) は version (同じ期間・型の通し番号)・parent_report_id・title・summary・body_json・archived_at を持つ。migration は migrations/ 直下の連番で、最新は 0045_owner_labels.sql である。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-database-web-003`

**問**

web の AI分析画面で、利用者が決めていない 依頼の連番の採番方法と、既存行の番号の扱い を何にするか。

**答**

連番は利用者ごとに max(seq)+1 で採番し、(user_id, seq) に一意索引を張って衝突時は 1 回だけ採番し直す。既存行は seq が NULL のままで、ID 欄には T-番号の代わりに『旧』と作成日を表示する (行は書き換えない)。 これは agent の推定で、利用者は未確認である。画像と決定 001〜008 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-19T12:36:49Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 依頼の段階と進捗を core の純関数 1 か所で記録から導く。発行済みでデータ未取得 = 待機中 0%、データ取得済み = 実行中 50%、形式エラーで差し戻し = 実行中 75%、受信 = 完了 100%、結果なしで期限切れ = 失敗、取り消し = キャンセル。依頼には利用者ごとの連番から T-0001 形式の ID を振る。
- **G5**: データの扱いと安全を固める。使用するデータのカードは実データ (対象期間・freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数) を新しい API で返し、AI へは集計値だけを渡す。エージェント用と貼り付けの経路に body の上限を設け、キャンセル済み・期限切れのトークンを拒否する。段階を導くための列 (連番・データ取得時刻・差し戻し時刻と回数・取消時刻) は追加のみの migration で足す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 依頼の段階と進捗が記録から一意に決まる。 | core の単体テストで、6 つの段階 (待機中 0 / 実行中 50 / 実行中 75 / 完了 100 / 失敗 / キャンセル) が記録の組合せから toBe で導かれ、期限切れと受信・取消の優先順位が境界ケースで固定される。 |
| O5 | データの件数が実データと一致し、外部へ出るのは集計値だけである。 | API テストで、使用するデータの件数が同じ期間の D1 行数と一致し、エージェントへ渡すデータセットに明細行と摘要が含まれず、上限を超える body が 413 で止まることを確かめる。migration は追加のみで既存行の書き換えが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に依頼の段階と進捗を導く純関数と T-番号の整形を新設し、api の taskStatus と web の表示をこれに寄せる。
- **I6**: 使用するデータの件数 API を足し、エージェント経路と貼り付け経路へ body 上限を掛け、追加のみの migration で段階の記録列を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『永続化するのはドメインの状態であって表示の都合ではない』を、ai_tasks に足す列の選び方に適用した。進捗 % や段階名は記録から導けるので保存しない。一方でエージェントがデータを取りに来た時刻、形式エラーで差し戻した時刻と回数、利用者が取り消した時刻は、後から導けない出来事なので列として持つ。T-番号の元になる連番も採番時にしか決まらないので保存する。ai_reports は版と親子関係をすでに持っており、版の説明は依頼の補足指示から導けるので列を足さない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T12:38:49Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-19T12:40:44Z | 2026-09-19T12:40:44Z |
