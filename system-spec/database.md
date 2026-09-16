---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G4]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-tc-observed-001。裏付け質疑 (`qa_refs`): `qa-total-cashflow-decision-003`, `qa-total-cashflow-decision-004`, `qa-total-cashflow-decision-013`, `qa-total-cashflow-decision-017`, `qa-total-cashflow-decision-018`, `qa-database-web-tc-inference-006`, `qa-infrastructure-web-tc-observed-003`, `qa-infrastructure-web-tc-observed-004` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは判定・除外・操作履歴をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の取消の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリでは判定・除外・操作履歴をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の取消の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリでは判定・除外・操作履歴をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の取消の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリでは判定・除外・操作履歴をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の取消の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリでは判定・除外・操作履歴をアプリ内に同期保持する方式 (端末内キャッシュとオフライン時の取消の整合)を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | D1 側の読み書きを、freee_deal_exclusions (user_id, freee_key) の主キーと total_cashflow_operations の (user_id, created_at DESC) 索引で引く形に反映した。取消で指定された id が最新の未取消操作 (kind が undo でない) かの照合は、索引を created_at の降順にたどって引け、全件走査を必要としない。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 追加だけの migration と既存行の移行 (reason → memo・reason_code=other) で、旧 Worker が新スキーマを読んでも壊れない順序にした。判定や除外の更新と履歴行を同じ batch に入れ、途中失敗で片方だけ残る状態を作らない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-database-web-tc-observed-001`

**問**

総収支の判定・除外は D1 のどこに保存され、今回の要件にはどんなスキーマ変更が要るか。

**答**

D1 (binding DB、drizzle-orm、packages/api/src/db/schema.ts)。判定は duplicate_verdicts (0036、user_id・tx_id・verdict、0037 で freee_key TEXT NULL を追加)、freee 側の二重登録除外は freee_deal_exclusions (0037、PRIMARY KEY (user_id, freee_key)、reason TEXT NOT NULL、created_at/updated_at) に保存する。最新 migration は 0040_review_snoozes_and_monthly_close_reviews.sql。集計値は保存しない方針 (dec-aggregation-strategy-001)。利用者決定 qa-total-cashflow-decision-003 により freee_deal_exclusions に reason_code と memo を足して既存 reason を移す変更が、qa-total-cashflow-decision-004 により判定・除外・戻すを 1 件ずつ記録する操作履歴テーブルの追加が要る。いずれも追加のみの migration (0041 以降) で、既存行を失わない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD 1b16825) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: migrations/{0036_duplicate_verdicts,0037_freee_pairing_and_exclusions,0040_review_snoozes_and_monthly_close_reviews}.sql, packages/api/src/db/schema.ts, packages/core/src/total-cashflow.ts。 / 回答時刻: 2026-09-15T12:00:44Z)

#### 裏付け質疑: `qa-total-cashflow-decision-003`

**問**

画像の freee 除外一覧は『理由』列に 振替/内部移動/帳簿のみ のバッジと、別に『メモ』列を持ち、『一括で理由を設定』がある。現行 freee_deal_exclusions.reason は自由記述 1 列 (NOT NULL)。除外理由をどう持つか。選択肢: (A) 理由区分 reason_code (振替/内部移動/帳簿のみ/二重登録/その他) とメモ memo に分け、既存の自由記述は memo と『その他』へ移行する (推奨) / (B) 自由記述 1 列のまま、画面で先頭語をバッジ風に見せる。

**答**

(A) 理由区分+メモに分ける を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T11:48:28Z)

#### 裏付け質疑: `qa-total-cashflow-decision-004`

**問**

画像の右ペインは『直前の操作 2026/09/10 10:12 1件の判定を元に戻しました / 元に戻す』を持つ。現行は判定を取り消す API が無く、戻せるのは freee 除外の DELETE だけである。元に戻すをどう実現するか。選択肢: (A) 判定・除外・戻すを 1 件ずつ D1 の操作履歴に残し、直前の操作を取り消せる。再読込後も直前の操作が表示される (推奨) / (B) 画面のメモリ上だけで直前 1 件を保持し、再読込で消える。

**答**

(A) 操作履歴を D1 に残す を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T11:48:28Z)

#### 裏付け質疑: `qa-total-cashflow-decision-013`

**問**

『元に戻す』を続けて押したときの動きはどうするか (取り消した操作も履歴に 1 件残る)。選択肢: 1 つ前の操作へ遡る (押すたびに未取消の操作を新しい順に戻す・取消のやり直しは無い) / 直前の 1 回だけ戻せる (取消後はボタンを消す・2 つ以上前は戻せない)。

**答**

1 つ前の操作へ遡る。含意: 取消そのものは取消の対象にならず、押すたびに未取消の書込み操作を新しい順に 1 つずつ戻す。取り消した取消をやり直す手段は作らない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の再評価が、アシスタント推定 qa-backend-web-tc-inference-004 で利用者に見える規則が一意に決まっていない (どちらで実装してもテストが通る) と medium 指摘したため、R3-reask で 1 問 1 論点に分けて質問した。利用者は AskUserQuestion の 2 択 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T13:10:17Z)

#### 裏付け質疑: `qa-total-cashflow-decision-017`

**問**

『元に戻す』はどこまで遡れるようにするか (操作履歴は無期限に残る設計)。選択肢: その画面を開いている間 (画面を開いてから行った操作だけを遡れる・再読込すると取消できない・古い判定を誤って戻す危険が小さい) / 上限なし (未取消の操作が残る限り何日前でも遡れる・押し続けると数か月前の判定まで戻る) / 当日の操作だけ (同じ日 (JST) の操作だけ・再読込後も戻せるが日をまたぐと取消できない)。

**答**

その画面を開いている間。含意: 取り消せるのは総収支の画面を開いてから行った操作だけで、再読込や画面の移動の後は取消の導線を出さない。操作履歴そのものは残る。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の 3 回目の評価が medium を 3 件指摘した (除外後の数え方が core と食い違う・上位概念が改名に追随していない・取消が冪等でない)。そのうち利用者に見える規則の 2 件と、上位概念の語の変更の承認を、R3-reask で 1 問 1 論点に分けて質問した。利用者は AskUserQuestion の選択肢 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T13:41:26Z)

#### 裏付け質疑: `qa-total-cashflow-decision-018`

**問**

毎日のバックアップは表を列挙して作っており、総収支の判定 (duplicate_verdicts)・freee 除外 (freee_deal_exclusions)・新しい操作履歴の 3 表は入っていない。バックアップから復元したとき、これらをどうするか (前例: 月次クローズの『後で確認』と月次レビューは、復元で失わないよう後からバックアップに加えた)。選択肢: 3 表をバックアップに加える (復元しても判定・除外理由・操作履歴が戻る・backup の SQL と payload と復元テストに 3 表ぶんの追加が要りバックアップが少し大きくなる) / 判定と除外だけ加える (総額に効く判定と除外理由は戻る・操作履歴は復元されず復元直後は取消の記録が無い) / 加えない (現行のまま・復元すると判定と除外がやり直しになり総額が復元前と変わりうる)。

**答**

3 表をバックアップに加える。含意: 復元すると判定・除外理由とメモ・操作履歴が復元時点の状態に戻り、総額も復元前の判断を反映したものになる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の 4 回目の評価が、判定・除外・操作履歴をバックアップに入れない方針がアシスタント推定だけで確定しており、PR #51 (0040) の前例と逆の判断になっていると medium 指摘したため、R3-reask で質問した。利用者は AskUserQuestion の 3 択 (推奨ラベルなし・各案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T14:03:31Z)

#### 裏付け質疑: `qa-database-web-tc-inference-006`

**問**

バックアップと復元に 3 表を加えるときの変更箇所を前例の全体 (qa-infrastructure-web-tc-observed-003/004) で数え直し、取消 batch の照合と実行のすき間に別の操作が入った場合も含めてどう条件付けるか (qa-database-web-tc-inference-005 を置き換える)。

**答**

migration 0041 (番号は取込時点の main の最新 +1 で確定する) で freee_deal_exclusions に reason_code TEXT NOT NULL DEFAULT 'other' (CHECK で transfer/internal/book_only/duplicate/other の 5 値) と memo TEXT を追加し、既存行は memo = reason、reason_code = 'other' に移す。reason 列は後方互換のため残し、書込時は memo を正本として同じ値を入れる (旧 Worker が読んでも壊れない)。画面の表示語は 振替/内部移動/帳簿のみ/二重登録/その他。操作履歴は total_cashflow_operations (id TEXT PRIMARY KEY、user_id TEXT NOT NULL、kind TEXT NOT NULL CHECK (verdict/exclude/restore/undo)、items_json TEXT NOT NULL (対象ごとの操作前後の値。判定なら txId・before verdict/freeeKey・after、除外なら freeeKey・before 行の有無と reason_code/memo・after。自由文は取消に要る memo だけを持つ)、item_count INTEGER NOT NULL、undoes_id TEXT NULL、undone_at TEXT NULL、created_at TEXT NOT NULL) を新設し、索引 (user_id, created_at DESC)。取消は、指定された id が user_id の一致する kind <> 'undo' かつ undone_at IS NULL の行のうち最新 (created_at の降順、同時刻は id の降順) の 1 行と一致するときだけ行う。他人の id や存在しない id は 404、一致しない id (再送・古い表示) は書き込まず 409 とする。照合の後に、対象の値の復元 → kind=undo (undoes_id=対象 id) の行の追加 → 対象行の undone_at の更新 の順に並べた文を 1 つの D1 batch で行う。3 種の文は全て同じ条件『対象行が存在し undone_at IS NULL で、かつ対象より新しい kind <> 'undo' の未取消行が同じ user_id に無い (NOT EXISTS)』を持つ条件付き文にする。値の復元は、操作前に行が無かったものは DELETE … WHERE EXISTS、有ったものは INSERT … SELECT … WHERE EXISTS … ON CONFLICT DO UPDATE で操作前の値に戻す。undo 行は INSERT … SELECT … WHERE EXISTS、最後に UPDATE … SET undone_at WHERE id = ? AND undone_at IS NULL AND NOT EXISTS (より新しい未取消行)。照合と batch の間に同じ id の 2 回目や別タブの新しい操作が割り込んだときは全ての文が 0 行になる。route は undone_at の更新件数が 0 なら 409 を返す。undo の行は対象にならないので、画面が自分の操作 id を新しい順に送ると 1 つ前の操作へ遡り、やり直しの経路は持たない。取消できる範囲 (画面を開いている間) は画面が持つ id の列で決まり、D1 側は古さの上限を持たない (qa-total-cashflow-decision-017)。書込 1 操作 = 判定/除外の更新と履歴 1 行を D1 batch で同時に行い、片方だけ残らないようにする。items_json は 1 操作最大 200 件で、D1_MAX_BOUND_PARAMS に合わせて分割する。保持は無期限で、利用者の判断記録のみ (集計値は保存しない dec-aggregation-strategy-001 と矛盾しない)。毎日のバックアップは表を列挙して組み立てており判定・除外・操作履歴を含まない (qa-infrastructure-web-tc-observed-002) ので、duplicate_verdicts・freee_deal_exclusions・total_cashflow_operations の 3 表を、0040 の前例 (qa-infrastructure-web-tc-observed-003/004) が触れた全ての箇所に加える (qa-total-cashflow-decision-018): JSON_SNAPSHOT_MUTATION_CONSUMERS、復元 write-set の DELETE と insertJsonRows、スナップショット SQL の行と件数、canonical-mutation-fence の consumers、routes/imports.ts の復元 payload の zod 検証と受け渡しと件数 (key は duplicateVerdicts・freeeDealExclusions・totalCashflowOperations)、書込み route からの invalidateJsonSnapshotQuery、schema-guard の EXPECTED_D1_MIGRATION。旧バックアップに key が無いときは前例と同じく null として既存の行を残し、key があれば空配列でもその集合で置き換え、形が不正なら復元全体を拒む。復元は 3 表を user_id 単位で入れ替え、復元前の操作履歴の行も復元時点のものに置き換わる。取消は画面を開いている間だけなので、復元の前に持っていた操作 id の列は再読込で消え、復元後に古い id で取り消すことは無い。本記録は qa-database-web-tc-inference-005 を置き換え (005 は 004 を、004 は 003 を、003 は 002 を置き換えていた)、以後 002〜005 は根拠に使わない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントが 2026-09-15 に、qa-database-web-tc-inference-005 の本文を基に、観測 qa-infrastructure-web-tc-observed-004 で数え直した変更箇所と、完成度評価 (C05) 5 回目の low 指摘 (照合と batch のすき間に別の操作が入る場合・復元文の形) を反映した推測。NOT EXISTS の条件・DELETE と UPSERT による復元・旧バックアップで既存の行を残す扱いは利用者の明示選択ではない (3 表をバックアップに加えることは利用者決定 qa-total-cashflow-decision-018)。 / 回答時刻: 2026-09-15T14:26:23Z)

#### 裏付け質疑: `qa-infrastructure-web-tc-observed-003`

**問**

既存の表をバックアップと復元の対象に加えるとき、コードのどこに手が入るか (0040 で review_snoozes と monthly_close_reviews を加えた前例)。

**答**

0040 の前例では 4 箇所に同じ表が並んでいる。(1) packages/api/src/import-active.ts の JSON_SNAPSHOT_MUTATION_CONSUMERS (復元の write-set を変える表の列挙。コメント『変えると復元後の未処理件数とクローズ状況が変わる』)。(2) packages/api/src/import-lifecycle.ts の復元 write-set (宛先が空でなければ DELETE FROM <表> WHERE user_id=? の後に insertJsonRows で行を入れ直す)。(3) packages/api/src/store.ts のスナップショット SQL (行の読出しと review_counts の件数)。(4) packages/api/src/canonical-mutation-fence.ts の書込み route ごとの consumers (PUT/DELETE の route に表名を結び付ける)。duplicate_verdicts と freee_deal_exclusions はこの 4 箇所のどれにも無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD 1b16825) の import-active.ts・import-lifecycle.ts・store.ts・canonical-mutation-fence.ts を grep と sed で読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 / 回答時刻: 2026-09-15T14:04:19Z)

#### 裏付け質疑: `qa-infrastructure-web-tc-observed-004`

**問**

0040 (cd470e3) で review_snoozes と monthly_close_reviews をバックアップと復元に加えたとき、qa-infrastructure-web-tc-observed-003 の 4 箇所の外で変わった箇所はあるか。総収支の書込み route は同じ仕組みにつながっているか。

**答**

ある。cd470e3 の packages/api の変更は 4 箇所の外に 3 系統ある。(5) packages/api/src/routes/imports.ts: 復元 payload の zod 検証 (reviewSnoozesBackupSchema / monthlyCloseReviewsBackupSchema)、resolveRestoreReviewState (key が無い旧バックアップは null を返して既存の行を残し、key があれば空配列でもその集合で置き換え、形が不正なら InvalidRestoreSettingsError で復元全体を拒む)、復元への受け渡しと reviewStateCounts。key は camelCase なので表名の grep では見つからない。(6) 書込み route からの invalidateJsonSnapshotQuery の呼出し (routes/analytics.ts の保留と月次レビューの PUT/DELETE)。consumer 引数は JSON_SNAPSHOT_MUTATION_CONSUMERS の型に縛られ、列挙外の表では呼べない。(7) schema-guard.ts の EXPECTED_D1_MIGRATION と deletion-schema.test.ts の期待値。現行の routes/total-cashflow.ts の書込み (POST /total-cashflow/verdicts・POST と DELETE /total-cashflow/freee-exclusions) は invalidateJsonSnapshotQuery を呼ばず、canonical-mutation-fence.ts にも登録されていない。qa-infrastructure-web-tc-observed-003 の『4 箇所』は前例の変更の一部だけを数えていたので、本記録で補う。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD 1b16825) で git show --stat cd470e3、routes/imports.ts 218〜245 行、import-active.ts の invalidateJsonSnapshotQuery、canonical-mutation-fence.ts、schema-guard.ts、routes/total-cashflow.ts の書込み route を読んで確認した観測事実。完成度評価 (C05) 5 回目の medium 指摘を受けて数え直した。answered_at は確認直後に date -u で実測した時刻。 / 回答時刻: 2026-09-15T14:26:23Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 判定と除外の操作を D1 に記録し元に戻せるようにする。freee 除外は理由区分 (振替/内部移動/帳簿のみ/二重登録/その他) とメモに分けて一括設定でき、既存の自由記述理由は失わずに移行する。判定・除外・戻すの操作履歴を残し、画面を開いてから行った操作を新しい順に取り消すと総額が操作前と一致し、同じ取消の再送や古い表示からの取消で意図しない操作を戻さない。再読込後は取り消せない (操作履歴は残る)。判定・除外・操作履歴はバックアップに含め、復元しても戻る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 除外理由区分とメモ、操作履歴と取消が永続化される。 | migration 適用後に既存除外の理由がメモへ保持され、取消 API の統合テストで操作前後の総額が一致し、同じ取消の再送や古い表示からの取消で意図しない操作が戻らず、再取込後も判定が再適用され、バックアップから復元すると判定・除外・操作履歴が復元時点に戻る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I5**: freee から除外した明細一覧に理由区分バッジ・メモ・集計へ戻す・全選択/選択クリア/一括で理由を設定 を置く。
- **I8**: core に総収支のセグメント別集計・前期比較・判定作業の区分・一致度関数を追加し、API が 1 回で返す。一括判定と取消の API を足す。
- **I9**: D1 に freee 除外の reason_code と memo を足し既存 reason を memo と『その他』へ移し、判定・除外・戻すの操作履歴テーブルを作って画面を開いてから行った操作の取消を、同じ取消の再送や古い表示から意図しない操作を戻さない形で実装する。判定・除外・操作履歴の 3 表をバックアップと復元の対象に加える。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『永続化するのは利用者の判断であって派生値ではない』を、D1 に何を足すかの線引きに適用した。一致度・区分・前期比・進捗は取引と判定から毎回導出できる派生値なので保存しない (dec-aggregation-strategy-001 を維持)。保存を足すのは利用者の判断そのものである除外理由の区分とメモ (qa-total-cashflow-decision-003) と、元に戻すための操作履歴 (qa-total-cashflow-decision-004) の 2 つに限る。migration は追加だけで、freee_deal_exclusions に reason_code と memo を足し既存の reason を memo・その他へ移し、total_cashflow_operations を新設する (qa-database-web-tc-inference-006)。判定・除外の更新と履歴 1 行は同じ D1 batch に入れ、履歴だけ残る・更新だけ残るという集約の不整合を作らない。取消は、指定された id が kind が undo でない未取消の最新行と一致するときだけ行い、undo 行は記録として残すだけにする (qa-total-cashflow-decision-013/017)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T14:26:23Z)

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
| cloudflare-d1-batch | 2026-06-22 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/worker-api/d1-database/ | 2026-09-15T12:11:33Z | 2026-09-15T12:11:33Z |
