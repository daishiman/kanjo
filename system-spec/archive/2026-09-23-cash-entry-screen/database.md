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
| Web (web) | 確定 | 確定質疑: qa-cash-database-web-005。裏付け質疑 (`qa_refs`): `qa-cash-database-web-evidence-001`, `qa-cash-database-web-003`, `qa-cash-decision-009` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、database では外出先で入力した現金明細を端末内 DB に溜めて D1 と同期する規則 (論理削除の伝播を含む)を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、database では共有端末に残る現金明細のキャッシュの保持期限を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、database ではオフライン時に入力した明細を保留する端末内の保存形を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、database では端末内に保留した明細ファイルの権限を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、database では端末内に保留した明細を Keychain とファイルのどちらに置くかを決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | cash_entries の新しい列の書き込み元を 1 経路ずつに限る形へ反映した。deleted_at は削除と一括削除で付け、復元と一括復元でだけ外し、夜間の完全消去は読むだけで行ごと消す。owner と transit_purpose は追加と更新でだけ書く。JSON 復元の INSERT は新しい列を持つ形に合わせる。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | migration 0050 を列の追加と索引だけにすることで、既存の現金明細を 1 行も書き換えず、巻き戻しが新しい列を読まないことだけで済む形へ反映した。schema-guard.ts の EXPECTED_D1_MIGRATION を 0050 の migration ファイル名へ進め、migration 前の D1 では Worker が論理削除の経路を動かさないようにする。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G4

#### 主たる接地根拠: `qa-cash-database-web-005`

**問**

現金明細の名義・業務の目的・論理削除を D1 にどう持ち、どの読み取り経路で削除中の行を外すか。

**答**

追加のみの migration 0050 で cash_entries に owner (TEXT NULL、business / spouse / family の CHECK)、transit_purpose (TEXT NULL)、deleted_at (TEXT NULL) を足し、(user_id, deleted_at) の索引を張る。既存行は書き換えない。削除中の行を読まない条件 (deleted_at IS NULL) は cash_entries を読む全経路 5 本 — loadCashEntries (store.ts。一覧と loadDataset が使う)、バックアップの BACKUP_SNAPSHOT_SQL (store.ts。エクスポートと夜間バックアップが共有)、取込時の設定スナップショット loadImportRestoreSettingsSnapshot (store.ts)、科目使用状況 loadCategoryUsageContext (routes/settings.ts)、PUT の既存行取得 (routes/cash.ts) — に掛け、集計・取引の導出、バックアップ、取込時の設定スナップショットは削除中の行を一切読まない。JSON 復元の INSERT は新しい列を持つ形に合わせる。schema-guard.ts の EXPECTED_D1_MIGRATION を 0050 の migration ファイル名へ進め、migration 前の D1 では Worker が論理削除の経路を動かさないようにする。例外は 1 つだけで、JSON 復元の『移行先の現金明細が 0 件か』の判定だけは削除中の行も数える (loadImportRestoreSettingsSnapshot の destination_counts に、削除中を含む現金明細の件数を 1 つ足す)。削除中の行が残っている間は現金明細を復元せず、理由を表示する。バックアップの id をそのまま INSERT して主キーが衝突し、復元全体が失敗することを防ぐためである。件数のほかに、削除中の行の中身はどの出力にも出さない (qa-cash-decision-009)。夜間 cron の完全消去 job は /api/* に掛かる schema guard の外で動くため、migration 0050 の適用 (Migrate) を Worker の配備 (Deploy) より先に行う既存の順序で守る。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の承認 (appr-foundation-cash-004、qa-cash-decision-010) と、決定 qa-cash-decision-009 (JSON 復元の件数の例外) の範囲に収まる確定内容。前回の確定 (qa-cash-database-web-004) に例外の記述を足した。JSON 復元の判定は routes/imports.ts と store.ts の現物で確認した。 / 回答時刻: 2026-09-21T22:45:23Z)

#### 裏付け質疑: `qa-cash-database-web-evidence-001`

**問**

database 章の裏付けとして、現行実装について何を観測したか。

**答**

cash_entries (packages/api/src/db/schema.ts:439-464) は id・user_id・date・month・side (biz/per)・io・amount・description・category_major/mid・memo・transit_from/to・transit_round・receipt_waived・created_at・updated_at を持ち、名義・業務の目的・削除時刻の列は無い。索引は idx_cash_month (user_id, month) だけ。読み取りは loadCashEntries (packages/api/src/store.ts:521-528) の 1 か所で user_id だけで絞る。migration は migrations/ 直下の連番で最新は 0049_ai_report_invariants.sql。取込・期間の一括削除には tombstone 方式の取り消し (packages/api/src/deletion-retention.ts:87) が別にあり、1 行を同じ id で戻す用途ではない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-database-web-003`

**問**

web の現金入力画面で、利用者が決めていない 名義・入力経路・完全消去の具体を何にするか。

**答**

入力経路は列を持たず transit_from IS NOT NULL で交通費入力、それ以外を通常入力と導く (既存行を書き換えずに全行へ経路が付く)。既存行の owner は NULL (未設定) のままとし、画面は『未設定』と表示する。新規入力の担当者の既定は事業なら business、個人なら未選択とする。完全消去は deleted_at が 30 日より前の行を 1 晩あたり最大 500 行消す。 これは agent の推定で、利用者は未確認である。画像と決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-decision-009`

**問**

JSON 復元は移行先の現金明細が 0 件のときだけバックアップの明細を id のまま入れる。削除中の行だけが残る利用者は 0 件と判定され、主キーが衝突して復元全体が失敗する。どう扱うか。

**答**

削除中も件数に数える。『空か』の判定だけは削除中の行を数え、削除中の行が残る間は現金明細を復元せず理由を表示する。削除中の行を他のどの出力にも出さない不変条件の例外は、この件数 1 つだけとする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 3 件 (削除中も件数に数える・復元前に削除中の行を消す・衝突した行だけ飛ばす) と推奨案を提示し、利用者が「削除中も件数に数える (推奨)」を選択。answered_at は選択時刻の上界。 / 回答時刻: 2026-09-21T22:44:32Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 記録が消えない。入力途中の内容はブラウザ内に自動保存して復元でき、削除は論理削除として一覧と集計から外したうえで『元に戻す』で同じ行を復活でき、30 日後に夜間処理で完全に消える。
- **G4**: 現金明細の入力と変更を安全に保つ。利用者ごとの分離、入力検証、削除・復元の権限確認、削除済み行を集計へ混ぜない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 下書きと論理削除で記録が欠けない。 | DOM テストで入力→再描画後に下書きが復元されること、API テストで削除→元に戻すで同じ id が一覧に戻ること、削除中の行が集計 (cashToDeal / cashToTx の入力) に 0 件であることが通る。 |
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: cash_entries に owner・transit_purpose・deleted_at を足す追加のみの migration 0050 (入力経路は列を持たず交通費の区間の有無から導く) と、削除・復元・一括削除・一括復元の API、削除中の行を読まない条件を cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に掛けること、夜間の完全消去を実装する。 JSON 復元の『空か』判定だけは削除中の行も数え、削除中の行が残る間は現金明細を復元しない (qa-cash-decision-009)。
- **I4**: 入力途中の内容をブラウザ内に自動保存し、保存時刻を表示し、復元する。『入力をクリア』で下書きも消す。
- **I5**: 削除をインライン確認にし、削除完了トーストの『元に戻す』で同じ行を復活させる。空状態では画面内だけのサンプル表示と『はじめての明細を入力』を出す。
- **I6**: 入力検証 (名義・業務の目的・カテゴリの候補、文字数、金額の範囲) を core と API の zod で揃え、他の利用者の行を 404 にする。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『永続化するのはドメインの状態であって表示の都合ではない』を、cash_entries に足す列の選び方に適用した。名義・業務の目的・削除時刻は利用者が決めた事実なので列に持つ。入力経路は交通費の区間があるかどうかで決まる導出値なので列を持たず、合計や件数も保存しない。こうして既存行を 1 行も書き換えずに、全行へ経路が付く。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:23:17Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
| sqlite-alter-table | 2026-06-04 | SQLite (www.sqlite.org) | https://www.sqlite.org/lang_altertable.html | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
