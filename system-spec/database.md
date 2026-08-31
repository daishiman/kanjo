---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G1, G2, G4, G5, G6, G7]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-017 |
| モバイル (mobile) | 対象外 | 理由: 専用モバイルアプリを提供せず、webのレスポンシブ表示で到達するためモバイル固有のデータ層要件を持たない |
| タブレット (tablet) | 対象外 | 理由: 専用タブレットアプリを提供せず、webのレスポンシブ表示で到達するためタブレット固有のデータ層要件を持たない |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 適用された設計知識

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

---

### 最小保持を複製側で骨抜きにしないテーブル設計

- project candidate: `database-improvement-tables-excluded-from-backup` (`deepened`)
- 解決対象: 確定セル database×web (qa-017) の3テーブル構成は、保持期間 30 日 (D6) を前提とする。しかし既存 nightlyBackup が改善要望テーブルを複製すると、削除済みの添付物が複製側に最大 30 日残り、最小保持が形骸化する。

#### 目的

『保持期間はデータの生存経路すべてに課さなければ意味を持たない』という原則を、BACKUP_SNAPSHOT_SQL の明示列挙という既存設計へ接地させる。

#### 解決する問題

- 削除ジョブだけを実装しても、複製経路が残っていれば実効的な保持期間が延びる
- 『追加しない』という決定は差分に現れないため、将来の変更で静かに破られる
- D1 Time Travel の復元範囲もプラン依存 (Workers Paid 30 日 / Free 7 日) であり、保持設計の前提として明示が要る

#### 適用条件

- acceptance『改善要望のテーブル名が packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL に1つも現れないことをテストが固定している』: テーブル名の不在を検査するテストを置く
- acceptance『status=done かつ完了から30日を超えた要望の、スクリーンショット R2 オブジェクトと診断情報列が削除され、本文・状態・対応記録は参照できる』: 削除対象を列単位で分け、本文列とは別に持つ
- トークン格納テーブルと指示文コピー記録テーブルは G6 に直接資する (qa-018(5))

#### 非適用条件

- 記帳データ本体 (事業・家計の明細と残高)。こちらは D7 で日次バックアップ維持が確定しており、除外の議論は適用されない
- 要望本文・状態・対応記録の削除 (scope_out)。削除対象は添付物のみ

#### トレードオフ

- バックアップ対象外のため、改善要望は D1 障害時に復元できない。一次資産ではないため許容する
- 添付物を別列・別オブジェクトへ分けることで、1 要望あたりの読み取り経路が増える

#### 失敗モード

- 善意の『バックアップ漏れ修正』として改善要望テーブルが後から列挙へ追加される
- 削除を行削除で実装し、本文・対応記録まで消える
- R2 オブジェクトだけが残り、D1 側の参照が消えて孤児化する

#### goalへの寄与

G7 (最小範囲の保持) を複製経路まで含めて成立させる。同時に G4 (既存データを一件も失わない) を、記帳データと改善要望添付物を別扱いにすることで両立させる。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-08-27T03:38:13Z | 2026-08-27T03:38:13Z |
| cloudflare-d1-limits | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/limits/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| cloudflare-d1-time-travel | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/time-travel/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| cloudflare-d1-import-export | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/best-practices/import-export-data/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
