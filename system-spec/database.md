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
| Web (web) | 確定 | 確定質疑: qa-imp-database-web-001。裏付け質疑 (`qa_refs`): `qa-imp-database-web-evidence-001`, `qa-imp-decision-001`, `qa-imp-decision-003`, `qa-imp-decision-007` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、database では端末内に依頼を保存するローカル DB と、サーバとの同期の方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、database では端末内に依頼を保存するローカル DB と、サーバとの同期の方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、database では端末内に依頼を保存するローカル DB と、サーバとの同期の方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、database では端末内に依頼を保存するローカル DB と、サーバとの同期の方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、database では端末内に依頼を保存するローカル DB と、サーバとの同期の方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 新しい列と表の書き込み元を 1 経路ずつに限る形へ反映した。seq は作成時に採番表と同じ batch でだけ付ける。deleted_at は削除で付けて復元でだけ外し、夜間の完全消去は読むだけで行を消す。履歴の行は作成・状態の変更・再発行・削除・復元の各経路が依頼の行と同じ batch で書き、依頼の行が消えると ON DELETE CASCADE で一緒に消える。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 0054 では表を作り直す (新しい表を作り、行を写し、古い表を消し、名前を変える)。これで既存の行・画像のキー・トークンのハッシュを 1 件も落とさず、wontfix の行だけを done と履歴 1 行に移す形へ反映した。適用前には D1 のバックアップを取る手順を runbook に置く。schema-guard.ts の EXPECTED_D1_MIGRATION を 0054 のファイル名へ進め、migration 前の D1 では Worker が新しい経路を動かさないようにする。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4

#### 主たる接地根拠: `qa-imp-database-web-001`

**問**

database の web の方針を次の内容で確定してよいか。

**答**

0054 で表を作り直す (状態の CHECK を open/in_progress/done/reconfirm に変え、wontfix は done へ移して履歴に理由を残す)。利用者ごとの連番 (UNIQUE(user_id, seq)、採番表で再利用しない。既存行は作成順に採番)、deleted_at、件名の NULL 許容、履歴表 (ON DELETE CASCADE) を足す。既存の行・画像・トークンは保つ。バックアップの対象外。EXPECTED_D1_MIGRATION を 0054 に進める。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 8 カテゴリの web 方針を表で提示し、AskUserQuestion の選択肢『この8カテゴリで確定 (推奨) / 修正して再提示』から利用者が『この8カテゴリで確定』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:16:38Z)

#### 裏付け質疑: `qa-imp-database-web-evidence-001`

**問**

database の web について、現行の実装と画像の差分は何か。

**答**

migrations/0029_improvement_requests.sql の improvement_requests 表は、id TEXT PK・user_id・title (1..120)・body (1..4000)・route・status (CHECK open/in_progress/done/wontfix)・screenshot_key・screenshot_size・diagnostics_json・diagnostics_omitted・token_hash UNIQUE・token_expires_at・token_fetch_count・copied_at・copied_target・done_at・purged_at・created_at・updated_at を持つ。連番・論理削除・履歴の列や表は無い。最新の migration は 0052_cash_entry_owner_soft_delete.sql で、schema-guard.ts:4 の EXPECTED_D1_MIGRATION と deletion-schema.test.ts:63 が最新番号を固定している。BACKUP_SNAPSHOT_SQL (store.ts:796) はこの表を含まない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: repo の現物 (該当ファイルと行) と design/FINAL-UI/images/20-improvement.png を読んで観測した事実。answered_at は記録直前に実測した時刻。 / 回答時刻: 2026-09-23T13:17:45Z)

#### 裏付け質疑: `qa-imp-decision-001`

**問**

画像の状態タブ (受付 / 対応中 / 完了 / 再確認) を現行の 4 状態 (未対応 / 対応中 / 対応済み / 対応しない) とどう対応させるか。

**答**

受付 / 対応中 / 完了 / 再確認 の 4 状態にする。再確認は『利用者の確認待ち』(開発側が直したので利用者が確かめる段階)。既存の対応しない (wontfix) は完了へ移し、理由をアクティビティに残す。30 日削除の起点は完了のまま。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 3 件と推奨案を提示し、利用者が『再確認=利用者の確認待ち (推奨)』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:05:47Z)

#### 裏付け質疑: `qa-imp-decision-003`

**問**

詳細パネルの『削除』をどう扱うか (物理削除 / 論理削除)。

**答**

論理削除にし、完了トーストの『元に戻す』で同じ番号のまま戻す。削除から 30 日後に夜間処理で本文・画像・履歴を完全消去する。削除中の依頼は一覧・件数・agent 経路のどこからも読まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案を提示し、利用者が『論理削除＋元に戻す (推奨)』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:05:47Z)

#### 裏付け質疑: `qa-imp-decision-007`

**問**

画像の IMP-024 形式の番号と、キャプチャパネルの『範囲を選択する』をどう実装するか。

**答**

番号は利用者ごとの連番にし、削除しても再利用しない (既存行は作成順に採番)。撮影は画面全体と範囲選択の両方を実装する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案を提示し、利用者が『利用者ごと連番＋範囲選択も実装 (推奨)』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:06:50Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 画面の数字と判定を core の 1 か所から導く。状態の体系と遷移、概要の切り出し、IMP 番号の表示、検索・件数タブ・ページング、関連する依頼、アクティビティの表示、診断情報の表示用要約 (OS・ブラウザ・画面サイズ・利用環境・伏せたセッション ID)、マスク規則を core の純関数に置き、API は JSON に写すだけ、web は描くだけにする。
- **G4**: 依頼と添付を安全に保つ。利用者ごとの分離、入力検証 (本文 1000 字・プライバシー確認 2 つ・画像の形式と大きさ)、削除は論理削除で『元に戻す』で戻し 30 日後に夜間処理で本文・画像・履歴を完全消去、使い捨てトークンの再発行、夜間バックアップへ添付を入れない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 画面の導出が core の 1 か所に集まる。 | core の improvement-screen の単体テストが状態遷移・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約を固定し、web と api に同じ計算の重複が無い (grep で 0 件)。 |
| O4 | 削除・分離・保持期限・既存ゲートを守る。 | API テストで削除→元に戻すで同じ id と番号が戻ること、削除中の行が一覧と件数に 0 件、他の利用者の依頼が 404、30 日経過の完全消去で R2 の画像と履歴が消えること、BACKUP_SNAPSHOT_SQL に改善リクエストの表が無いことが通り、pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に improvement-screen を新設し、状態の体系と許される遷移、概要の切り出し、IMP 番号の表示、検索・件数タブ・ページング、関連する依頼、アクティビティの表示、診断情報の表示用要約を純関数で導く。
- **I4**: migration 0054 で状態の CHECK の張り替え (wontfix→done の移し替え)、利用者ごとの連番、論理削除の列、アクティビティの表を足し、削除・復元・状態変更・再発行で履歴を書く API と夜間の完全消去を実装する。
- **I6**: 入力検証 (本文 1000 字・プライバシー確認 2 つ・状態の候補・画像の形式と大きさ) を core と API の zod で揃え、他の利用者の依頼を 404 にする。

### 本章に効く確定意思決定

- **D-imp-008**: 夜間 scheduledMaintenance の D1 予算は 49/49 (Free の 1 invocation あたり 50 クエリ、1 本は必ず残す) で満杯。削除した改善リクエストを 30 日後に行と履歴ごと消す DELETE を 1 本足すにはどうするか。
  - 採択: 他 job の枠を 1 本回す (`borrow-slot`)
  - 目的適合: G4 の完全消去をアプリのコードとテストに明示したまま満たす。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『Entity / Value Object』を、0054 で足す列の選び方に適用した。改善リクエストは利用者ごとの連番で追う Entity なので、連番を列に持ち、削除しても採番表の最後の番号を戻さない。一方、概要 (本文の先頭 40 字)・IMP 番号の表示形・件数・関連する依頼は、他の値から決まる導出値なので保存しない。同じ card の『Domain Event』は履歴の表に当てた。状態の変更・再発行・削除・復元は起きた事実なので、1 件ずつ行として追記し、書き換えない。件名の列は、既存行の値を失わないよう残し、新規行では NULL にする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T13:43:22Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-23T13:21:07Z | 2026-09-23T13:21:07Z |
| sqlite-alter-table | 2026-06-04 | SQLite (www.sqlite.org) | https://www.sqlite.org/lang_altertable.html | 2026-09-23T13:21:22Z | 2026-09-23T13:21:22Z |
| cloudflare-d1-foreign-keys | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/sql-api/foreign-keys/ | 2026-09-23T13:21:22Z | 2026-09-23T13:21:22Z |
