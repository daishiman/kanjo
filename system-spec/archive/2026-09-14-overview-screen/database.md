---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G2, G3]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-ov-observed-001。裏付け質疑 (`qa_refs`): `qa-database-web-ov-decision-001`, `qa-snooze-fingerprint-ov-decision-001`, `qa-design-rules-ov-decision-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは端末内に未処理の保留 (後で確認) と月次レビュー完了を保存するローカルストアを持つか、D1 と同期して二重の保存をどう解消するかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリでは端末内に未処理の保留 (後で確認) と月次レビュー完了を保存するローカルストアを持つか、D1 と同期して二重の保存をどう解消するかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に未処理の保留 (後で確認) と月次レビュー完了を保存するローカルストアを持つか、D1 と同期して二重の保存をどう解消するかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に未処理の保留 (後で確認) と月次レビュー完了を保存するローカルストアを持つか、D1 と同期して二重の保存をどう解消するかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に未処理の保留 (後で確認) と月次レビュー完了を保存するローカルストアを持つか、D1 と同期して二重の保存をどう解消するかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスの責務を利用者の判断だけの保存に絞る考え方を、review_snoozes と monthly_close_reviews に件数などの集計列を持たせない規則 (qa-design-rules-ov-decision-001 の (1)) に反映した。保存するのは保留の時刻と内容指紋 (qa-snooze-fingerprint-ov-decision-001) と月次レビューの時刻・操作者で、件数とステップ判定は毎回明細から求める。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の変更リスク最小化を、migration 0040 を CREATE TABLE と CREATE INDEX だけにして既存テーブルを変えない規則 (qa-design-rules-ov-decision-001 の (1)) に反映した。D1 migration に rollback が無いこと (qa-database-web-ov-observed-001) から、誤りは前進の修正 migration で直す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3

#### 主たる接地根拠: `qa-database-web-ov-observed-001`

**問**

保留と月次レビュー完了を D1 に置くとき、既存の migration・schema-guard・バックアップ/復元のどこを変える必要があるか。

**答**

テーブル定義は packages/api/src/db/schema.ts (730行、drizzle) にあり、migration はリポジトリ直下の migrations/ (packages/api/wrangler.jsonc:20) に NNNN_snake.sql で置かれ、最新は 0039_account_login.sql である。packages/api/src/schema-guard.ts:4 の EXPECTED_D1_MIGRATION が d1_migrations の最新 head と比べて古ければ /api/* を 503 にし (:24-85)、schema-guard.test.ts:63-67 が migrations の最新ファイルと定数の一致を検査する。夜間バックアップと export は loadBackupPayload (packages/api/src/store.ts:1065) が BACKUP_SNAPSHOT_SQL (store.ts:628) に明示列挙した15テーブルだけを読み、duplicate_verdicts・freee_deal_exclusions・vendor_memory などは入っていない。復元は POST /api/restore (packages/api/src/routes/imports.ts:1675) が JSON を取込パイプラインへ通す。バックアップの書込対象になるテーブルの更新は canonicalMutationFence (packages/api/src/canonical-mutation-fence.ts:119) の CANONICAL_MUTATION_ROUTES に登録して取込と同じ lease で直列化する規約がある。業務テーブルの user_id は常に 'default' (packages/api/src/auth.ts:31-36) である。したがって新しい2テーブルは、migration 0040・EXPECTED_D1_MIGRATION・schema.ts の3点、BACKUP_SNAPSHOT_SQL と payload の組立、restore 側の書戻し、CANONICAL_MUTATION_ROUTES への書込ルート登録を同じ変更で揃える必要がある。Cloudflare D1 の migration は連番 .sql を d1_migrations テーブルで適用記録し、create/list/apply だけで rollback の手段を持たない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: Explore サブエージェントが 2026-09-14 に packages/api・packages/core・packages/web・migrations・.github を読み、file:line を付けて報告した観測事実。報告受領後に date -u で実測した時刻を answered_at (上限値) とした。 D1 migration の仕様は fetched-references の cloudflare-d1-migrations (取得 2026-09-14T11:49:44Z) による。 / 回答時刻: 2026-09-14T11:54:38Z)

#### 裏付け質疑: `qa-database-web-ov-decision-001`

**問**

『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか。

**答**

『D1に保存』(代替: ブラウザ保存 / 保存しない)。保留と月次レビュー完了は D1 の新しい2テーブル (review_snoozes・monthly_close_reviews) に保存し、夜間バックアップ (R2 の backups/YYYY-MM-DD.json) と JSON export の対象へ加え、POST /api/restore で書き戻す。バックアップ→全消去→復元の往復で行が一致することを API テストで保証する (O3)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion の4問 (集計範囲・既存要素・状態の保存・信頼度) に回答した (会話記録上の回答返却時刻 2026-09-14T11:33:34Z)。回答は上位概念の承認 appr-foundation-overview-001 (11:38:48Z) にも反映済み。 テーブル名とバックアップ経路は承認済み U8 scope.in (D1 migration・バックアップ対象への追加) の具体化。 / 回答時刻: 2026-09-14T11:33:34Z)

#### 裏付け質疑: `qa-snooze-fingerprint-ov-decision-001`

**問**

『後で確認』にした明細を、あとで金額・日付・内容が変わった(取込の洗替えなど)ときにどう扱いますか? 選択肢: 内容が変われば再表示 (推奨) / 利用者が解除するまで保留 / 月が変わったら自動で解除

**答**

『内容が変われば再表示』。保留 (review_snoozes) を書くときに明細の内容指紋 (金額・日付・内容から作る) を保存し、キューを組み立てるときに現在の明細の指紋と比べて、異なる明細は保留を無効として未処理に戻す。同じ item_key のまま中身が変わった明細を、別の取引を保留したつもりで見落とさないためである。保留は利用者が解除したときにも消える。月の境目では自動で解除しない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:14:38Z)

#### 裏付け質疑: `qa-design-rules-ov-decision-001`

**問**

仕様書の上流指針に『推定』として書いた設計規則のうち、仕様として確定させるものを選んでください (複数選択、選ばなかったものは『実装時の提案』と明記して残す)。選択肢: 入力検証とDB制約の二重化 / 計算は core の純関数に置く / 新部品を共通化・PUTは冪等 / 件数ずれの切り分け手順を文書化

**答**

4件すべてを確定する。(1) 入力検証とDB制約の二重化: 保留と月次レビューの書込 API は kind (classification|reconciliation|import の3値)・itemKey (長さ上限つき文字列)・month (YYYY-MM) を境界で検証して 400 を返し、DB 側でも CHECK 制約と主キーで守る。migration 0040 は CREATE TABLE と CREATE INDEX だけで既存テーブルを変えず、件数などの集計列は保存しない。(2) 計算は core の純関数に置く: 未処理キュー・信頼度・月次クローズ判定・直近12か月比較は packages/core の純関数にし、packages/api のルートは D1 から読んだ行を渡して JSON にするだけにする。web は応答型 OverviewResponse・ReviewQueueResponse だけを知り、優先順位や信頼度を画面側で再計算しない。(3) 新部品を共通化・PUT は冪等: サイドバーのバッジ・右パネル・固定アクションバーは packages/web/src/components/ の共通部品にし、他の画面でも使える形にする。保留と月次レビューの PUT は同じ値を再送しても結果が変わらない。(4) 件数ずれの切り分け手順を文書化: 件数が3か所でずれたときは API 応答 → React Query のキー共有 → 保留の内容指紋 の順に確認する手順と、描画検査が失敗したときに screenshot から幅を特定する方法を docs に残す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 4件の文言は完成度 evaluator が『確定質疑に無い』と指摘した doctrine 記述をそのまま選択肢にしたもの。 / 回答時刻: 2026-09-14T12:14:38Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 仕分け確認・照合確認・取込確認を1つの未処理キューに集約する。件数 (バッジ・カード・アクションバー) の一致、優先順位、根拠種別付きの推奨科目と信頼度、右パネル、該当画面への1操作遷移を持つ。
- **G3**: 月次クローズ4ステップをデータから判定する。「月次レビュー完了」と「後で確認」は D1 に保存し、バックアップと復元でも保つ。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 未処理件数がサイドバーのバッジ・未処理カード・固定アクションバーの3か所で一致する。 | DOM テストが3か所の件数表示を取得して一致を assert し、1件を後で確認にしたとき3か所が同時に減ること、ヘッダーの期間を 1年 から 3年 に切り替えても3か所の件数が変わらないことも検査する。core の単体テストが、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられることを assert する。 |
| O3 | snooze と月次レビュー完了がバックアップ→復元の往復で保たれる。 | API テストが snooze と月次レビューを書き、バックアップを取り、全消去後に復元して行が一致することを assert する。 |
| O5 | 推奨科目の信頼度が決定論で、根拠が無ければ推奨なしを返す。 | core の単体テストが同じ入力で同じ信頼度を返すこと、vendor_memory・ルール・MF中項目のいずれも該当しない明細で推奨なしを返すことを assert する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 未処理カード3種 (仕分け確認・照合確認・取込確認)
- **I4**: 優先度順の未処理明細表
- **I5**: 右パネル (理由・取引元・類似取引・推奨仕訳と信頼度・仕分けを開く・後で確認)
- **I8**: 固定アクションバー (未処理件数と次の操作)

### 本章に効く確定意思決定

- **dec-review-state-storage**: 『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか
  - 採択: D1 に2テーブル (review_snoozes・monthly_close_reviews) を追加し、夜間バックアップと復元の対象にする (`d1`)
  - 目的適合: G3 の『D1 に保存し、バックアップと復元でも保つ』に直接合う。端末やブラウザを替えても未処理件数と月次クローズの判定が変わらない
- **dec-recommendation-confidence-source**: 右パネルの推奨科目と信頼度を何を根拠に出すか
  - 採択: 既存の判定根拠を統合 (vendor_memory の一致率 → ルール → MF中項目、どれも無ければ推奨なし) (`integrate-existing`)
  - 目的適合: G2 の『根拠種別付きの推奨科目と信頼度』を満たし、O5 の決定論を検査できる

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の Entity / Value Object の区別を2つのテーブルに適用した。確定しているのは、D1 に保存してバックアップと復元の対象にすること (qa-database-web-ov-decision-001)、内容指紋が変わった明細の保留を無効にすること (qa-snooze-fingerprint-ov-decision-001)、CHECK 制約・主キー・CREATE TABLE/INDEX のみ・集計列を持たないこと (qa-design-rules-ov-decision-001)、同じ変更で揃える6か所 (qa-database-web-ov-observed-001) である。【実装方針の提案 (推定・未確定。plan の task で確定する)】 review_snoozes は主キー (user_id, item_kind, item_key)、item_kind は classification|reconciliation|import、item_key は仕分けなら tx_id、照合なら bindVerdicts と同じ stable_key、取込なら import id とし、snoozed_at と内容指紋 (金額・日付・内容の連結ハッシュ) を持つ。monthly_close_reviews は主キー (user_id, month 'YYYY-MM') で reviewed_at と reviewed_by_user_id を持つ。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T12:20:03Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-14T11:49:44Z | 2026-09-14T11:49:44Z |
| whatwg-web-storage | HTML Living Standard | WHATWG (html.spec.whatwg.org) | https://html.spec.whatwg.org/multipage/webstorage.html | 2026-09-14T12:44:40Z | 2026-09-14T12:44:40Z |
