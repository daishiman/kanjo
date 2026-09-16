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
| Web (web) | 確定 | 確定質疑: qa-database-web-rc-observed-001。裏付け質疑 (`qa_refs`): `qa-reconciliation-decision-002`, `qa-reconciliation-decision-005`, `qa-database-web-rc-decision-008` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは照合の判断・MF 側除外・操作履歴・月次レビュー完了を端末内に保持し、オフライン中の照合操作をサーバーの duplicate_verdicts とどう突き合わせるか (競合時にどちらの判断を残すか)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリでは照合の判断・MF 側除外・操作履歴・月次レビュー完了を端末内に保持し、オフライン中の照合操作をサーバーの duplicate_verdicts とどう突き合わせるか (競合時にどちらの判断を残すか)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリでは照合の判断・MF 側除外・操作履歴・月次レビュー完了を端末内に保持し、オフライン中の照合操作をサーバーの duplicate_verdicts とどう突き合わせるか (競合時にどちらの判断を残すか)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリでは照合の判断・MF 側除外・操作履歴・月次レビュー完了を端末内に保持し、オフライン中の照合操作をサーバーの duplicate_verdicts とどう突き合わせるか (競合時にどちらの判断を残すか)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリでは照合の判断・MF 側除外・操作履歴・月次レビュー完了を端末内に保持し、オフライン中の照合操作をサーバーの duplicate_verdicts とどう突き合わせるか (競合時にどちらの判断を残すか)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 永続化の境界を『利用者の意思と操作の事実だけを保存する』形で反映した。新設 3 表 (mf_tx_exclusions・reconciliation_actions・monthly_reviews) はいずれも user_id を持ち、既存 duplicate_verdicts と同じく tx_id と stable_key の両方で明細へ結べる列を持たせる。一致度などの派生値の列は作らない。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の『変更を小さく可逆に保つ』を、migration を CREATE だけの追加に限り deploy.yml の自動適用経路に乗せる確定内容に反映した。既存表の列の削除・型変更をしないため、ロールバックしても旧コードが新表を無視して動く。取消は D1 batch 1 回で判断と履歴を同時に書き戻し、途中失敗で半分だけ戻る状態を作らない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4

#### 主たる接地根拠: `qa-database-web-rc-observed-001`

**問**

照合の保存に使える既存テーブルと、追加が要る表・migration は何か。

**答**

D1 (binding DB、drizzle-orm)。照合判断は migrations/0036_duplicate_verdicts.sql の duplicate_verdicts (user_id・tx_id・stable_key・fingerprint_version・verdict same/different・freee_key)、freee 側除外は 0037_freee_pairing_and_exclusions.sql の freee_deal_exclusions (Drizzle 定義は packages/api/src/db/schema.ts:130-159)。最新 migration は 0039_account_login.sql。MF 側の除外表・照合操作の履歴表・月次レビュー完了表は無い。deploy.yml は取り返しのつく (追加だけの) D1 migration を自動適用し、列や行を失う変更だけを migrate.yml の手動承認へ倒す。追加する 0040 以降は新表 (mf_tx_exclusions・reconciliation_actions・monthly_reviews) の CREATE だけにし、取消は reconciliation_actions に保存した操作前の判断 (before) を D1 batch で書き戻して行う。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD cc0d5e3) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: migrations/0036_duplicate_verdicts.sql, migrations/0037_freee_pairing_and_exclusions.sql, migrations/0039_account_login.sql, packages/api/src/db/schema.ts, .github/workflows/{deploy,migrate}.yml。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-reconciliation-decision-002`

**問**

照合の操作結果 (同じ取引として照合 / 別の取引として処理 / 除外) の保存と『元に戻す』をどう実装するか。既存は総収支用の duplicate_verdicts (same/different) と freee 側除外のテーブル (migrations 0036/0037) があるが、verdict を消す API・MF 側の除外・操作履歴は無い。選択肢: (A) 既存表を再利用し拡張する。判断は duplicate_verdicts を共用して総収支と結果を一致させ、verdict 取消 API・MF 側の除外・照合操作の履歴表 (直前の操作と元に戻すに使う) を migration で足す (推奨) / (B) 照合専用の新テーブルを作り総収支の判断と独立に持つ / (C) DB 変更なしで画面内の直前 1 操作を逆操作 API で打ち消すだけにし MF 側の除外は出さない。

**答**

(A) 既存表を再利用+拡張 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T07:41:58Z)

#### 裏付け質疑: `qa-reconciliation-decision-005`

**問**

サイドバー下部の月次クローズ進捗 (データ取込/仕分け/照合/月次レビュー) の完了をどう判定するか。選択肢: (A) 3 つ自動+レビュー手動。直近の締め月について データ取込=未記録月 0、仕分け=未整理明細 0、照合=要確認+MF未計上 0 を自動判定し、月次レビューは利用者が『レビュー完了』を押して月単位で D1 に保存する (取消可) (推奨) / (B) 4 つとも自動 (レビューは前 3 つの完了で自動完了。DB 変更なし) / (C) 完了判定を持たず見た目だけ画像に寄せる。

**答**

(A) 3つ自動+レビュー手動 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:11:23Z)

#### 裏付け質疑: `qa-database-web-rc-decision-008`

**問**

『元に戻す』の範囲をどうするか。選択肢: (A) 直前の操作 1 件+履歴は保存: 画面には直前の操作 1 件 (一括なら一括単位) を出し、元に戻すで操作前の判断状態へ戻す。履歴表には全操作を 90 日保存し、取消済みの操作は再取消できない。中間の操作を戻すには各行の判断を解除する (推奨) / (B) 履歴から任意の操作を戻す / (C) 画面内の直前 1 件のみで履歴を保存しない。

**答**

(A) 直前の操作 1 件+履歴は保存 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:59:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 照合操作を保存し元に戻せるようにする。既存の duplicate_verdicts と freee 除外表を再利用し、照合画面用の API (一覧・KPI・キューを返す GET と、照合 / 別取引 / 除外 / 一括照合の POST)、verdict 取消 API、MF 側除外、照合操作の履歴表 (直前の操作と元に戻すに使う) を migration 付きで追加する。一括は最大 200 件で部分成功を返す。
- **G4**: 共通シェルを画像に揃える。サイドバーの文言 (概要/データ取込/現金入力/明細仕分け/サブスク/累計収支/支出分析/決算書/AI分析/予算/トレードオフ/設定/使い方/改善リクエスト) とグループ・件数バッジ (データ取込=要確認の取込件数・明細仕分け=未整理明細数・サブスク=判定待ち候補数・照合=要確認件数)、ページ見出し・パンくず・コマンドパレットのラベル追随、月次クローズ進捗 3/4 (データ取込/仕分け/照合は直近の締め月について自動判定、月次レビューは利用者の完了操作を月単位で D1 に保存し取消可)、ヘッダー (防衛ライン：正常 の表記・未記録 Nか月・最終更新・⌘K 検索・ダウンロード・ヘルプのアイコンボタン・アバター)、フッター (外部送信しない / 税務上の正本は freee / 毎晩バックアップ と 利用規約・プライバシー・データ出典・v1.0) と改善を送るボタン。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 照合操作 API・取消・MF 除外・操作履歴を migration 付きで追加する。 | API 統合テストが認証付きで照合 / 別取引 / 除外 / 一括 (201 件で 400、部分成功の内訳) / 取消 / 直前の操作の取得を検証し、migration が既存 D1 に冪等に適用され、元に戻すと KPI とキューが操作前の値に戻る。 |
| O4 | 共通シェルの差分を実装する。 | shell 系 DOM テストをサイドバー新文言・件数バッジ・月次クローズ 3/4 (自動 3 + レビュー手動の保存と取消)・ヘッダーのアイコンボタン・フッターリンクで更新して緑、月次レビュー API の統合テストが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: 照合画面用 API と verdict 取消・MF 除外・操作履歴を migration 付きで足し、同じ取引として照合 / 別の取引として処理 / 除外 / 一括照合 / 元に戻すを web から呼ぶ。
- **I5**: routeMetadata のラベルとグループを画像に揃え、件数バッジ・月次クローズ 3/4 (月次レビュー完了の保存と取消)・ヘッダーのアイコンボタン・フッター・改善を送るボタンを共通シェルに入れる。
- **I7**: 一致度・キュー・ステータス・月次クローズ判定の規則を docs に書き、docs/data-schema.md の古い候補条件を直し、境界値テストで固定する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『永続化するのはドメインの状態であって表示の都合ではない』を、保存するものと導出するものの線引きに適用した。利用者の判断 (duplicate_verdicts)・除外 (freee_deal_exclusions と新設 mf_tx_exclusions)・操作の事実 (reconciliation_actions の before/after)・月次レビュー完了 (monthly_reviews) は利用者の意思なので保存し、一致度・キュー・KPI・解消率・月次クローズの自動 3 ステップは毎回導出して保存しない。一致度規則を変えても保存値とずれる二重の正本が生まれない。取消は履歴の before を D1 batch で書き戻す 1 単位にし、判断と除外と履歴の取消済みフラグが途中で分かれないようにした。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T08:59:56Z)

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
| cloudflare-d1-batch | 2026-06-22 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/worker-api/d1-database/ | 2026-09-15T09:06:26Z | 2026-09-15T09:06:26Z |
