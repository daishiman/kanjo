---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G4, G5]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-statements-decision-007。裏付け質疑 (`qa_refs`): `qa-statements-decision-002`, `qa-statements-database-web-002`, `qa-statements-agent-decisions-001`, `qa-statements-reopen-pass3-001`, `qa-statements-database-web-evidence-001`, `qa-statements-zero-amount-legacy-001`, `qa-statements-migration-0046-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、データベースでは端末内の SQLite と D1 の同期・競合解決を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、データベースではタブレットの端末内キャッシュの持ち方と失効を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、データベースでは Windows 版のローカル DB ファイルの置き場所と暗号化を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、データベースでは Linux 版のローカル DB の置き場所と権限を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、データベースでは macOS 版のローカル DB とキーチェーンの使い分けを決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | balance_entries の読み書きを balances route と statements route に限る形へ反映した。status 列は既定値 'amount' で追加し既存行を書き換えない。未入力を行の不在で表すので、既存の UNIQUE(user_id, month, side, category) がそのまま『1 項目 1 状態』を保証する。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | migration を追加のみにすることで、Deploy が自動適用判定で止まらない形へ反映した。audit_log の CHECK 拡張に要する表再構築は採らず新表で監査する。実体は 0045_owner_labels.sql と衝突しない migrations/0046_liability_status.sql である。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5

#### 主たる接地根拠: `qa-statements-decision-007`

**問**

負債残高の保存・削除の記録 (監査ログ) をどう残しますか？

**答**

新表・金額は残さない (推奨)。migration 0045 で liability_audit_log を追加し、誰がいつどの月のどの項目を 保存/0円/未入力 にしたかだけを記録し、金額は残さない。既存 audit_log の CHECK 変更は表の再構築 (Deploy 自動適用で止まる) が要るため避ける。(提示した他の選択肢: 新表・金額も残す / 記録しない)

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: 新表で金額を残さない決定は有効だが、実 migration は migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり (2026-09-19T02:30:05Z 提示・02:41:21Z 回答) / 回答時刻: 2026-09-19T02:41:21Z)

#### 裏付け質疑: `qa-statements-decision-002`

**問**

BS の負債入力で、画像の 3 項目 (借入金・未払金・クレジット未払) と既存の『その他の負債』をどう扱うか。

**答**

3 項目は必須、その他は任意。画像の 3 項目は『未入力 / 0円 / 金額』の選択を必須にし、項目ごとに状態を保存する (migration 0045 で状態列を追加)。その他の負債は任意項目として残す。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: 状態列と 3 状態の決定は有効だが、実 migration は 0045_owner_labels.sql との衝突を避けた migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-19T01:53:56Z)

#### 裏付け質疑: `qa-statements-database-web-002`

**問**

負債の 3 状態と保存の監査を、どのテーブル変更で持つか。

**答**

migration 0045 で ALTER TABLE balance_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'amount' CHECK (status IN ('zero','amount')) を足し、既存行は金額ありのまま保つ (C4)。『未入力』は行を持たないことで表す。『0円』は status=zero・amount=0 の行。UNIQUE(user_id, month, side, category) は変えない。監査は同じ migration で新表 liability_audit_log (id, user_id, actor_user_id, month, changed_json, occurred_at) を CREATE TABLE で足し、金額は残さず項目ごとの状態遷移と件数だけを残す。既存 audit_log の action は CHECK 制約で閉じており拡張には表の再構築 (INSERT…SELECT と DROP TABLE) が要るが、Deploy の自動適用判定が止めるうえ C4 に反するので採らない。drizzle の schema.ts に列と表を足す。並行サイクルが 0045 を使っていれば実装時に次の番号へ繰り下げる。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: DDL と追加のみの方針は有効だが、実 migration は 0045_owner_labels.sql との衝突を避けた migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-statements-database-web-001 を置き換える訂正版。利用者が選んだのは qa-statements-decision-007 (監査は新表・金額は残さない)・002 (負債=3 項目必須+その他任意) と appr-foundation-statements-001 の範囲で、それ以外の具体化 (値・部品分割・名前・判定式・テスト観点) はエージェント判断 (qa-statements-detail-parameters-001・qa-statements-agent-decisions-001 に列挙)。 / 回答時刻: 2026-09-19T11:41:33Z)

#### 裏付け質疑: `qa-statements-agent-decisions-001`

**問**

pass-3 の差し戻しを直すときに、利用者の決定を具体化するためエージェントが決めた点は何か。

**答**

(a) 行の選択は勘定科目セル内のボタンと aria-pressed で示す (表の行は aria-selected を持てないため)。(b) ページ内ナビは選んだ項目だけに aria-current="location" を付け、スクロール位置で自動更新しない。選択時は節見出し (tabIndex=-1) へフォーカスを移す。(c) ref が期間外・不正なら期間の最終月に丸め、丸めた月を bs.referenceMonth で返し web は URL をその値へ置き換える。(d) CF は原因 3 種 (未仕訳件数・現金口座の欠け {月数, 決済列なし}・科目未設定件数) のどれかが立つときだけ不可にし、決済方法の列が無い場合 (既存 settlementUnknown) は 2 番目の原因に添えて表示する。原因が 1 つも無ければ可 (原因の無い不能表示を出さない)。(e) liability_audit_log の列は id・user_id・actor_user_id・month・changed_json・occurred_at で、changed_json は項目ごとの状態遷移と件数。(f) 画像との差 (負債 KPI の文言と色・ナビの意味論・行の選択・月次表の数値・CF 原因・監査) を spec §8 と docs/ui-decisions.md に記録する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: エージェントによる具体化 (利用者決定 qa-statements-decision-005〜007 と WAI-ARIA / 既存コードからの導出。利用者への個別確認なし) / 回答時刻: 2026-09-19T11:41:33Z)

#### 裏付け質疑: `qa-statements-reopen-pass3-001`

**問**

決算書画面サイクルの web × 8 セルを再オープンする理由は何か。

**答**

完成度 evaluator の pass-3 (FAIL) の high 指摘 H1: 8 セルの主根拠 qa-statements-<cat>-web-001 は basis=user-decision だが、利用者が代替案を見ずにエージェントが具体化した設計 (監査の新表、ref の丸め、タブの構成、負債 KPI の色の向き、現金 KPI の %) を含む。3 点は利用者に選択肢を示して決定を得た (qa-statements-decision-005〜007、foundation-002)。残りはエージェント判断として qa-statements-agent-decisions-001 に分けた。各セルを reopen し、利用者決定を主根拠に、訂正版の回答 web-002 (agent-inference) を補助根拠として確定し直す。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: エージェントによる再オープン理由の記録 (evaluator 指摘の転記) / 回答時刻: 2026-09-19T11:41:33Z)

#### 裏付け質疑: `qa-statements-database-web-evidence-001`

**問**

database 章の裏付けとして、既存のテーブルと migration の規則について何を観測したか。

**答**

migrations/0026_balance_entries.sql は id・user_id・month・date・side・category・amount・source ('mf' | 'manual')・created_at・updated_at と UNIQUE(user_id, month, side, category)。migrations/0033_audit_log.sql は action を CHECK で閉じ、0034 と 0039 は CHECK を広げるために audit_log_new を作って RENAME する再構築をしている。.github/scripts/plan-auto-migration.mjs は DROP TABLE・DROP COLUMN・DELETE FROM・UPDATE…SET・ALTER TABLE…RENAME を自動適用しない。最新の migration は 0044_diagnosis_action_states.sql。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T02:01:29Z)

#### 裏付け質疑: `qa-statements-zero-amount-legacy-001`

**問**

migration 0045 の適用前に金額 0 で保存された既存の手入力負債行 (status 列の既定値で 'amount' になる) を、画面と集計でどう扱うか。

**答**

(status='amount', amount=0) の組を『0円』(zero) と同じ扱いで表示・完了判定する。現行 UI で 0 を入れて保存した行は利用者が値を入れた項目であり、未入力ではないため。行は書き換えない (C4。UPDATE を含む migration は Deploy の自動適用判定で止まる)。次にその項目が保存されたとき status='zero' で上書きされる。core の契約テストでこの扱いを固定する (specs/spec-statements-screen.md §3.4・§7)。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: 『状態列の適用前に amount=0 で保存された行』の互換処理は有効だが、状態列を追加する実 migration は migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: エージェントによる既存データの扱いの決定 (C4 と G4 から導出。利用者への個別確認なし) / 回答時刻: 2026-09-19T02:18:27Z)

#### 裏付け質疑: `qa-statements-migration-0046-001`

**問**

負債 3 状態の migration 番号は、実際のワークツリーで何番になったか。

**答**

0045_owner_labels.sql が先に存在するため、仕様の衝突時繰り下げ規則を適用し、実体は migrations/0046_liability_status.sql になった。現行の仕様・運用・schema guard・テスト参照は 0046 を使う。0045 という記述は生成済み計画の履歴を除き、現行契約として扱わない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: migrations/0045_owner_labels.sql と migrations/0046_liability_status.sql のワークツリー観測 / 回答時刻: 2026-09-19T21:52:53Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 貸借対照表の負債残高を、基準月ごと・項目ごとに『未入力 / 0円 / 金額』の 3 状態で入力・保存できるようにする。借入金・未払金・クレジット未払の 3 項目は状態の選択を必須とし、その他の負債は任意項目として残す。保存済みの値を読み込んで初期表示し、保存は項目単位で上書きして他の項目を消さない。基準月は期間内の任意の月を選べる。入力中の値はブラウザ内に利用者ごとの下書きとして自動保存し保存時刻を示し、リセットで保存済みの値へ戻し、未保存の項目数を画面下部の固定バーに出す。未入力の項目がある月は BS にデータ不足の表示を出し、純資産を出さない。
- **G5**: 負債の保存経路と画面の安全性を整える。既存の認証・セッション・CSRF 相当の防御 (SameSite=Strict の Cookie と JSON の Content-Type 検証) と取込との直列化を保ったまま、金額の上限、リクエストの大きさの上限、保存操作の監査ログを加える。下書きには利用者の識別子をキーに含め、ログアウトで消す。取込データや下書きを外部へ送らない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 負債残高の 3 状態入力が値を失わない。 | API と DOM のテストで、1 項目だけ保存しても他項目の保存値が残り、保存済みの値が初期表示され、『未入力』と『0円』が別々に保存・表示され、必須 3 項目の状態が未選択なら保存できず、下書きの復元・リセット・未保存件数の表示が緑である。 |
| O5 | 負債の保存経路が入力の上限と監査を持つ。 | API テストで、上限を超える金額と大きすぎる本文が 4xx で拒否され、保存が監査ログに 1 件残り、未認証の保存が拒否されることが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I6**: 負債入力を基準月の月ピッカーと項目ごとの 3 択 (未入力 / 0円 / 金額を入力) に作り直し、migration 0046 で balance_entries に状態列を足し、PUT を項目単位の upsert にして保存済みの値を読み込む。
- **I7**: 入力中の負債を localStorage に利用者別のキーで下書き保存し、保存時刻・リセット・未保存件数の固定バーを出し、ログアウトで下書きを消す。
- **I8**: PUT /api/balances/liabilities に金額の上限と本文の大きさの上限を課し、保存を監査ログへ記録する。

### 本章に効く確定意思決定

- **D-statements-draft-storage**: 決算書の負債入力の下書き (『下書きを自動保存しました』) をどこに保存するか
  - 採択: ブラウザ内 (localStorage に利用者別キー) (`browser-localstorage`)
  - 目的適合: G4 の『入力中の値をブラウザ内に利用者ごとの下書きとして自動保存』をそのまま満たす。既存の period.tsx と同じ方式。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『永続化するのはドメインの状態であって表示の都合ではない』を、負債の状態列だけを足す判断に適用した。段階損益・前期比・構成比・CF の原因件数は既存の明細と判定から導出できるので保存しない。一方で負債の『0円』と『未入力』の区別は利用者が決めた事実であり導出できないため、balance_entries に status 列を足し、未入力は行が無いこと、0円は status=zero の行で表す。監査は既存 audit_log の CHECK を再構築せず、状態遷移だけを残す新表 liability_audit_log を足す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T02:05:18Z)

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
| sqlite-alter-table | 2026-06-04 | SQLite (www.sqlite.org) | https://www.sqlite.org/lang_altertable.html | 2026-09-19T02:03:50Z | 2026-09-19T02:03:50Z |
