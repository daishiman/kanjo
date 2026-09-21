---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G2, G4, G5]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-classify-database-web-001。裏付け質疑 (`qa_refs`): `qa-classify-database-web-evidence-001`, `qa-classify-database-web-002`, `qa-classify-database-web-003`, `qa-classify-decision-006` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、データベースでは端末内に明細と下書きを持つ SQLite の同期をどう設計するかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、データベースではオフライン閲覧のため期間分の明細を端末へどこまで持つかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、データベースではデスクトップ版のローカル保存先と暗号化の方式をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、データベースではデスクトップ版のローカル保存の権限をどう扱うかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、データベースではネイティブ版のローカル保存とキーチェーンでの鍵管理をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 明細仕分けの D1 では、変更履歴を UPDATE しない追記のみの表にし、利用者と明細と時刻の索引で編集パネルの新しい順の表示を 1 回の読取りで返せる形へ反映した。保存フィルタの条件は JSON 1 列に入れ、絞り込みの項目が増えても列を足さない。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 明細仕分けの D1 では、追加のみの migration 1 本に留めて Migrate の失敗時に行の巻き戻しが要らない形へ反映した。取引の削除と取消は既存の /data/deletions と /data/undo を使い、履歴にも削除と取消の行を残して復元後の状態を辿れるようにした。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G4, G5

#### 主たる接地根拠: `qa-classify-database-web-001`

**問**

明細仕分けのために D1 のスキーマをどう変えるか。

**答**

追加のみの migration (新表・新カラム) とし、行を書き換える migration は作らない (qa-classify-decision-004 と U8 の C3)。保存したフィルタを名前付きで保存する新しい表、明細の変更履歴 (いつ・どの項目が・変更前後・どの由来 自動提案 / 手動 / ルール / 一括保存 / 分割 / 削除 / 取消 で変わったか) を追記のみで残す新しい表を設ける。ルールには取引先・適用範囲 (一致する明細すべて / 未確定の明細だけ)・分割の型 (固定額の行と残額の行) を持たせる列を追加する。支払方法を編集パネルで直せるよう、明細の手当て (tx_edits) に支払方法の上書きの列を追加し、値が無い明細は従来どおり機関名から導く。下書きは D1 に置かない。すべての表は利用者で区切る。本番反映は既存の Deploy / Migrate の手順とゲートに従う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/13-classify.png と、利用者承認 (appr-foundation-classify-001) の U1-U9、決定 qa-classify-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-database-web-evidence-001`

**問**

データベース 章の裏付けとして、13-classify.png と現行実装の差分として何を観測したか。

**答**

最新の migration は migrations/0045_owner_labels.sql。明細の手当ては tx_edits (note 列 200 字を含む)、分割は tx_splits (migrations/0035)、ルールは rules 表、取引先の決め事は vendor_memory 表にある。保存したフィルタと変更履歴の表は無い。支払方法の上書きの列はどこにも無い。証憑の表と R2 の保存は #42 (462dd9d) で全廃済み。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 0003cb4) の読取りによる観測。 / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-database-web-002`

**問**

web の明細仕分け画面で、データベース について利用者が決めていない具体値を何にするか。

**答**

migration は migrations/0046_classify_workbench.sql の 1 本とし、実装時に origin/main を fetch して番号の空きを確かめる。表は saved_filters (id・user_id・name 1〜40 字・query_json 2000 字以内・created_at・updated_at、(user_id, name) で一意、利用者あたり 20 件まで) と tx_history (id・user_id・tx_id・changed_at・field・before_value・after_value・source を CHECK で auto / manual / rule / bulk / split / delete / undo・op_id、索引 (user_id, tx_id, changed_at))。rules には payee (NULL 可)・scope (CHECK で all / unconfirmed、既定 all)・split_template_json (NULL 可) を、tx_edits には payment_method (CHECK で cash / card / account、NULL 可) を追加する。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent の推定 (利用者未確認) / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-database-web-003`

**問**

提案どおりの確定と提案と異なる確定 (qa-classify-decision-006) を、後から提案が変わっても区分が揺れないようにどこへ残すか。

**答**

明細の手当て (tx_edits) に、利用者が確定したときに提案と一致していたかを表す列を追加のみの migration で足す。値が無い既存の手入力の明細は手動変更として扱う。行を書き換える migration は作らない。 これは agent の推定で、利用者は未確認である。決定 006 の保存先は利用者が指定していないため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent-inference (qa-classify-decision-006 の実装上の帰結) / 回答時刻: 2026-09-19T13:40:10Z)

#### 裏付け質疑: `qa-classify-decision-006`

**問**

一覧や編集パネルで明細を『確定』したとき、どの区分に移すか。

**答**

提案どおりなら完了 (推奨)。提案をそのまま受け入れたものは完了、区分・カテゴリ・所有者のどれかを提案と違う値にしたものは手動変更。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり (完成度評価 high 指摘への差し戻し) / 回答時刻: 2026-09-19T13:40:10Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 分類ステータスと提案を core の純関数 1 か所に集める。各明細を 未整理 (利用者・ルール・MF 中項目のどれもまだ決めていない明細。提案の有無と信頼度は問わない) / 手動変更 (利用者が提案と異なる値で確定した明細。提案が無いまま利用者が決めた明細と、この変更より前の手入力の明細を含む) / 完了 (利用者が提案どおりに確定した明細と、ルール・MF 中項目が決めた明細) の 3 区分に排他で振り分け、和が全件に一致する。要確認は区分ではなく未整理の内訳で、提案の信頼度が 80% 未満・提案どうしの衝突・区分と名義の矛盾のいずれかがある未整理の明細を数える。ナビのバッジは未整理の件数、月次クローズの『仕分け』は同じ判定の未整理から照合側で数える明細を除いた件数とし (現行の clsSrc=既定 と同じ意味)、同じ関数から導かれることをテストで固定する。提案カテゴリ・信頼度・根拠の文は recommendationFor を拡張し、過去の同取引先・ルール・MF 中項目のどの由来にも決定論の信頼度を付け、/transactions の応答にも載せる。外部の LLM は呼ばず、表示は『自動提案』とする。
- **G4**: 『この条件をルールにする』で取引先・キーワード・適用範囲 (一致する明細すべて / 未確定の明細だけ) を選んでルールを作り、作成前に該当する明細と適用後の仕訳 (カテゴリ・分割の内訳) の一覧と件数をプレビューで確かめてから適用できるようにする。分割の内容もルールにでき、固定額の行と残額の行で同じ条件の明細を同じ形に分ける。該当する既存のルールと、そのルールの対象件数を編集パネルに示す。手動変更した明細はルールで上書きしない。
- **G5**: 仕分けの作業状態を失わない。保存したフィルタは D1 に新しい表を追加のみの migration で設け、名前付きで保存・呼出・削除できる。取引の履歴は D1 に明細の変更履歴表を追加のみで設け、いつ・何が (区分・カテゴリ・所有者・支払方法・メモ・分割)・どの由来 (自動提案 / 手動 / ルール / 一括保存) で変わったかを残し、編集パネルに新しい順で出す。編集パネルの下書きは端末の localStorage に明細単位で自動保存し、最終保存時刻を表示し、保存に成功したら消し、次回に『下書きを復元』できる。未保存のまま離れるときは確認する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 未整理・手動変更・完了の件数が排他で閉じ、要確認が未整理の内訳に収まり、他画面と一致する。 | core の単体テストで、同じ Dataset と期間に対し 未整理 + 手動変更 + 完了 = 全件、各明細がちょうど 1 区分に入り、要確認 ⊆ 未整理、未整理の明細で信頼度 80% の境界 (79 は要確認・80 は要確認でない) と衝突・矛盾の各規則、提案どおりの確定は完了・提案と異なる確定は手動変更になることが固定され、ナビのバッジと月次クローズの『仕分け』の件数が同じ関数から出る。 |
| O4 | ルールのプレビューと適用結果が一致する。 | core の単体テストで、プレビューが列挙した明細と件数が、適用後に実際に変わった明細と一致し、手動変更の明細が変わらず、分割ルールの各行の和が元の金額に一致する。 |
| O5 | 作業状態が失われない。 | API 統合テストで保存フィルタの作成・一覧・削除と、各変更経路で履歴が 1 件ずつ残ることを確かめ、migration が既存行を 1 行も書き換えないことを検査する。DOM テストで下書きの自動保存・復元・保存成功での消去・離脱確認を確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に分類ステータス判定 (仮称 classifyStatus) を新設し、3 区分の排他判定と要確認の内訳・件数集計を 1 か所で行い、サイドバーのバッジと月次クローズの『仕分け』もここを参照させる。
- **I3**: recommendationFor を拡張し、ルール・MF 中項目由来にも決定論の信頼度を付け、根拠の文を由来ごとに整え、/transactions の各行に提案・信頼度・根拠・ステータスを載せる。
- **I5**: ルールに取引先・適用範囲・分割の型 (固定額の行と残額の行) を持たせる追加のみの migration と、作成前プレビュー・適用 API を設ける。
- **I6**: 保存フィルタ表と明細の変更履歴表を追加のみで設け、全変更経路 (手動・一括・ルール・分割・削除と取消) で履歴を 1 件ずつ残す。
- **I7**: 編集パネルの下書きを localStorage に明細単位で自動保存し、保存時刻の表示・復元・保存成功での消去・未保存の離脱確認を行う。

### 本章に効く確定意思決定

- **dec-classify-confidence-source**: 一覧の信頼度と自動提案をどう算出するか。
  - 採択: 既存規則の拡張・外部送信なし (`opt-deterministic`)
  - 目的適合: G2 の決定論と『取込データは外部送信しません』の約束に一致する。
- **dec-classify-state-storage**: 保存したフィルタ・下書き・取引の履歴の保存先をどうするか。
  - 採択: フィルタと履歴は D1、下書きは端末 (`opt-d1-and-local`)
  - 目的適合: 共有と監査が要るものは D1、頻繁に変わる下書きは端末に置き G5 を満たす。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Schema evolution の card (expand のみで contract しない) を明細仕分けに適用した。ルールの新しい列は NULL 可か既定値付きにして既存のルールが今までどおり動くようにし、支払方法の上書きも NULL なら従来の導出に落ちる。こうして C3 の『既存行の書き換え 0 件』を migration 1 本で守る。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T13:24:40Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-19T13:26:35Z | 2026-09-19T13:26:35Z |
