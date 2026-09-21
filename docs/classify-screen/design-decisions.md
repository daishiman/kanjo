# 明細仕分け画面 — 設計判断の記録

正本は `specs/spec-classify-screen.md`（以下「仕様書」）。本書は仕様書を置き換えない。
実装 task（SYS-CLASSIFY-P04 以降）が着手前に読む前提を 3 章に固定する。

- 第1章 受入条件の検証可能化（SYS-CLASSIFY-P01）
- 第2章 設計判断と残る risk（SYS-CLASSIFY-P02）
- 第3章 レビュー指摘と確認結果（SYS-CLASSIFY-P03）

---

## 第1章 受入条件の検証可能化（P01）

### 1.1 成功状態 S1〜S6（仕様書 §目的と成功状態 / 73 行〜）

各文は「何が真なら満たしたと言えるか」まで落としてある。

| ID | 検証可能な文 | 節 |
|---|---|---|
| S1 | `/classify` が 13-classify.png の構成要素をすべて描画し、直書き色の lint 違反が 0 件で、証憑のファイル選択欄が存在せず『証憑は freee 側で管理します』の文字列が存在し、期間内 0 件で空状態になる。 | §7.1・§7.12・§スコープ(out) |
| S2 | 同一期間で `未整理 + 手動変更 + 完了 = 全件` が成り立ち、`要確認 ≦ 未整理` で、ナビのバッジ・月次クローズの『仕分け』・画面 KPI が `classifyStatus` 1 関数から出て、信頼度が全由来で 0〜100 の整数か（提案なしのときだけ）null である。 | §BR-01〜BR-07 |
| S3 | 一括保存で一部が失敗しても成功分が保存され、通知が成功件数と失敗件数を示し、再試行の要求が失敗分の txId だけを含み、削除が『元に戻す』で復元できる。 | §7.7・§7.8・§API 一括保存 |
| S4 | プレビューが返した txId の集合と、適用後に実際に変わった明細の集合が一致し、手動変更の明細が 1 件も含まれず、分割の行の和が元の金額に一致する。 | §BR-10・BR-11・§API ルールのプレビュー/適用 |
| S5 | `saved_filters` と `tx_history` の行が D1 に残り、下書きが再読込後に復元でき、migration 0046 が既存行を 1 行も書き換えない。 | §データモデル・§7.11 |
| S6 | 期間が usePeriod / localStorage から復元され、絞り込み・ページ・選択が URL に保たれ、既存 5 画面の数値テストが緑のまま、lint・typecheck・初期 JS 予算が CI を通る。 | §7.2・§7.4・§非機能要件 |

### 1.2 受入条件 AT-01〜AT-21（仕様書 §受入条件 / 1575 行〜）

| ID | PASS と言える条件 | 節 |
|---|---|---|
| AT-01 | 見出し『明細仕分け』・問い・説明文 2 行・期間タブ 4 つ・期間送り・『明細仕分けの使い方』が DOM に揃う。 | §7.1・§7.2 |
| AT-02 | KPI 4 枚が件数付きで出て、要確認の枚に『未整理のうち』がある。 | §7.3 |
| AT-03 | 絞り込みパネルの全項目（対象月／状態 4 つと件数／カテゴリ／所有者／支払い方法／手動変更のみ／キーワード（placeholder 完全一致）／保存したフィルタ／条件を保存／クリア／折りたたみ）が揃う。 | §7.4 |
| AT-04 | 一覧が 6 列 + 選択チェック + 全選択を持ち、『取引一覧（N件）』『表示件数 50件』とページ送りがあり、51 件目が 2 ページ目に出る。 | §7.5・§API 明細一覧 |
| AT-05 | 未整理の行にも提案カテゴリと信頼度が出て、要確認の行に『要確認』が併記される。 | §7.5・§BR-03 |
| AT-06 | 編集パネルに §7.6 の全欄があり、ファイル選択欄が無く『証憑は freee 側で管理します』がある。 | §7.6 |
| AT-07 | 一括操作バーに『N 件選択中』『選択をクリア』『選択した N 件を保存』がある。 | §7.8 |
| AT-08 | 3 件中 1 件失敗で通知文が完全一致し、『失敗した1件のみ再試行』の要求本文が失敗 1 件だけを含む。 | §7.7・§API 一括保存 |
| AT-09 | 削除で『1件の明細を削除しました。』と『元に戻す』が出て、押すと明細が一覧に戻る。 | §7.7・§UC-6 |
| AT-10 | 分割の一致文言が 12,000 円の fixture で完全一致し、不一致では適用ボタンが押せない。 | §7.9・§BR-10 |
| AT-11 | プレビューの文言・件数・表が §7.10 どおりで、プレビューの明細集合と変更後の集合が一致する。 | §7.10・§BR-11 |
| AT-12 | 同一期間で 3 区分の和が全件、要確認 ≦ 未整理、バッジと対象月の月次クローズが同じ `classifyStatus` から判定される。母集団が異なるため同件数は要求しない。 | §BR-01〜BR-07 |
| AT-13 | 提案どおりの確定で `done`、提案と異なる確定で `manual` になり、後から提案が変わっても区分が変わらない。 | §BR-09・BR-01 |
| AT-14 | 手動変更の明細がルールの作成・適用で変わらず、分割ルールの行の和が元の金額に一致する。 | §BR-10・BR-11 |
| AT-15 | 保存フィルタの作成・一覧・削除ができ、6 つの変更経路（手動・一括・ルール・分割・削除・取消）それぞれで履歴が残る。 | §BR-15・§API 保存フィルタ |
| AT-16 | 下書きが 1 秒後に自動保存され表示が出て、再読込後に『下書きを復元』で戻り、保存成功で消え、未保存離脱で確認が出る。 | §7.11 |
| AT-17 | 読込・空（期間内 0 件）・失敗の各状態が出る。 | §7.12 |
| AT-18 | 信頼度と分類ステータスが色以外（数値・文言）でも区別され、画面に『AI』の文字列が 1 つも無い。 | §7.3・§非機能要件 |
| AT-19 | 直書き色 lint 0 件、lint・typecheck・初期 JS 予算が CI 緑、既存 5 画面の数値テストが緑。 | §非機能要件 |
| AT-20 | migration 0046 が既存行を 1 行も書き換えない（UPDATE・DELETE・表の作り直しが 0 文）。 | §データモデル |
| AT-21 | fetch の宛先が同一オリジンの `/api` だけで、外部送信が 0 件。 | §非機能要件 |

判定の規則（仕様書 §受入条件 末尾）: 実行済みの最新テスト証跡だけで判定する。未実施・一部適合・既知の逸脱が 1 件でも残る項目は PASS にしない。

> 2026-09-21 の再検証では、lint・typecheck・build・preview smoke と明細仕分けの集中テストは通過した。一方、最新の Web 全体 test は明細仕分けを対象にしない既存の財務画面実描画 gate が約 360 秒後に失敗し、後続を中断した。したがって「全受入 PASS」や「最新の `pnpm test` が緑」とは判定しない。Q-1 はその後 `done` に確定し、実テストで固定した。以下の過去の件数証跡は、その時点の snapshot として読む。

### 1.3 決定事項 Q-1・Q-2 と未決事項 Q-3〜Q-5（仕様書 §決定事項と未決事項）

| ID | 事項 | 本計画での扱い |
|---|---|---|
| **Q-1（解決済み）** | vendor_memory が取込時に materialize した手当て（`tx_edits.origin='vendor_memory'`・`clsSrc='手動'`・`matched_proposal=NULL`）を完了とするか手動変更とするか。 | **`done`（完了）に確定**。`matched_proposal=NULL` でも `needsReview=false`。利用者の手入力ではなく、承認済みの取引先メモリによる自動決定として扱う。 |
| Q-2 | 画像の KPI・日付・金額が算術として閉じない。 | 解消済み。C6（画像の数値はモック）に従い実データで出す。画像どおりの fixture は作らない。 |
| Q-3 | プレビューの見出し『今後』と、対象が表示期間内の既存明細である点のずれ。 | 文言は保つ。対象は表示期間内の既存明細。実装はこのまま進められる。 |
| Q-4 | localStorage の下書きを利用者で区切らない。 | 単一利用者の前提（SH1）で区切らない。共用端末を想定するなら別途決める。 |
| Q-5 | 本書と仕様書の agent 推定・利用者未確認の値（信頼度の数値・衝突の −20・一括保存の上限 100・保存フィルタ 20 件ほか）。 | この値で進める。利用者が別の値を選んだら system-spec → 仕様書 → 本書の順に直す。 |

### 1.4 Q-1 の最終決定と受入

`classifyStatus` の分岐 (d)（`clsSrc === '手動'` かつ `edit.origin === 'vendor_memory'`）は、`done` を直接返す。取込時に承認済みの取引先メモリが自動適用された決定であり、利用者の手入力とは由来が異なるためである。`classify-status.test.ts` は `matchedProposal:null` でも `status:'done'`・`needsReview:false` であることを実行して固定する。

- 未整理ではないため、バッジと月次クローズの『仕分け』には数えない。
- 『手動変更』ではなく『完了』の KPI に数える。
- 要確認は未整理の内数なので、信頼度・衝突・矛盾の入力にかかわらず `needsReview=false` とする。

### 1.5 スコープ外（仕様書 §スコープ(out) / 107 行〜）

| 対象外 | 理由 |
|---|---|
| 領収書・証憑の添付と保管 | #42 で製品として廃止し、spec-v1.1 で freee 側の管理と定めた（利用者決定 qa-classify-decision-001）。画面には案内文だけを置く。 |
| 外部 LLM による提案 | 取込データを外部へ送らない約束を守り、既存の決定論の規則を広げる（利用者決定 qa-classify-decision-003）。 |
| 共通シェル（サイドバー・ヘッダー・フッター・月次クローズの進捗表示）の見た目の作り直し | 既存 Layout をそのまま使う。変えるのはバッジと『仕分け』の件数の定義だけ。 |
| 取込処理・照合画面の変更 | 別画面の責務。照合側の明細を月次クローズの『仕分け』から除く現行規則は保つ。 |
| スマートフォン等の専用アプリ | web のみ。狭い画面は既存の web レスポンシブ規約の範囲で扱う。 |

---

## 第2章 設計判断と残る risk（P02）

### 2.1 `classifyStatus` の入出力と 3 区分の排他（BR-01〜BR-03）

置き場所は `packages/core/src/classify-status.ts`。api と web は再実装しない。

- 入力: `resolved`（`clsSrc` を持つ解決済みの明細）と `edit`（`tx_edits` の行・無ければ null）。
- 出力: `'unsorted' | 'manual' | 'done'` の 1 値と、`needsReview` の真偽。
- 排他の担保: 判定は `clsSrc` の値で分岐し、各明細はちょうど 1 区分に入る。
  - `clsSrc === '既定'` → `unsorted`（BR-02 により未整理の集合は現行の `clsSrc=既定` と同じ。月次クローズの意味を変えない）
  - `clsSrc === 'ルール' | '中項目'` → `done`
  - `clsSrc === '手動'` かつ `edit.origin === 'manual'` → `matched_proposal === 1` のときだけ `done`、それ以外（0・null）は `manual`
  - `clsSrc === '手動'` かつ `edit.origin === 'vendor_memory'` → `done`（`matched_proposal` の値は問わない、Q-1 解決済み）
- `needsReview`（BR-03）は**未整理の明細にだけ**立つ。条件は 信頼度 80 未満（79 は立つ・80 は立たない）／衝突／矛盾 のいずれか。信頼度 null（提案なし）の未整理は数えない。完了の明細の信頼度は表示にだけ使う。

### 2.2 信頼度（BR-04・BR-05）

- vendor_memory: `Math.round(vendorConfidence(memory) * 100)`
- 取引先とキーワードの両方が一致するルール: 95 ／ キーワードだけ: 85 ／ MF 中項目: 70 ／ 提案なし: null
- 値は常に 0〜100 の整数に丸める。
- 衝突（2 つ以上の由来が異なるカテゴリを提案）のとき、提案（優先順の先頭）の信頼度を「関与した由来の信頼度の最小値 − 20」に置き換え、下限 0。
- 矛盾は 区分=個人 かつ 所有者=事業、または 区分=事業 かつ 所有者が事業以外。
- 由来の優先順は既存 BR-006 のまま（vendor_memory → ルール → MF 中項目 → なし）。

判定の持ち主は `classifySuggestion` 1 つで、`recommendationFor` はその写しである（`packages/core/test/overview-recommendation-contract.test.ts` が機械的に固定している）。

### 2.3 新設 API の応答形と zod の許可リスト

すべて `authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence` の順を通る。利用者 id は `c.get('userId')` から取り、本文や URL からは受け取らない。

| API | 応答の形 | 節 |
|---|---|---|
| `POST /api/transactions/bulk` | `{ results: [{txId, ok, status?, error?}], saved, failed, opId }`。`results` は要求と同じ並びで `saved + failed === results.length`。 | §777 |
| `GET /api/transactions/:txId/history` | `{ items: [{changedAt, field, before, after, sourceLabel, confidence}] }`。新しい順。他利用者の明細は 404（存在も漏らさない）。 | §877 |
| `POST /api/rules/preview` | `{ count, omitted, rows: [{txId, date, description, amount, after: [{label, amount}]}], skipped, fingerprint }`。 | §1027 |
| `POST /api/rules/:id/apply` | `{ applied, txIds, skipped, opId }`。対象 0 件なら `{applied:0, txIds:[], opId:null}`。 | §1109 |
| `GET /api/saved-filters` | `{ items: [{id, name, query, createdAt, updatedAt}] }`。壊れた行は落として一覧は返す。 | §1192 |
| `POST /api/saved-filters` | 201 で `{ item }`。名前の前後空白は落とす。 | §1255 |
| `DELETE /api/saved-filters/:id` | `{ ok: true, id }`。 | §1318 |

zod の許可リスト（BR-14）: メモ 200 字 ／ フィルタ名 1〜40 字 ／ 検索キーワード 100 字 ／ ルールのキーワード 1〜100 字 ／ 条件 JSON 2000 字 ／ 一括保存 1〜100 件 ／ 保存フィルタ 20 件。範囲外は 400。保存フィルタの条件は**読み書きの両方で同じ zod を通し、知らないキーを落とす**。期間は条件に保存しない（先月の条件を今月呼び出して空にしないため）。

一致判定の持ち主（BR-09）はサーバ。クライアントが送った一致の値は信用しない。比べるのは cls・大項目・中項目・所有者の 4 値で、メモ・支払方法・機関名だけの保存はフラグを変えない。

### 2.4 migration 0047 は追加のみ

`migrations/0047_classify_workbench.sql`。`saved_filters` と `tx_history` の新設、索引の追加、`rules`（payee・scope・split_template_json）と `tx_edits`（payment_method・matched_proposal）への列追加だけ。UPDATE・DELETE・表の作り直しは 0 文（AT-20）。

- `rules.scope` の `DEFAULT 'all'` により既存ルールは今までどおり働く。
- `tx_edits.matched_proposal` の既存行は NULL のままで、BR-01 (c) により手動変更として扱う。

### 2.5 母集団と保持方針

#### risk-1: バッジ（BR-06）と月次クローズ（BR-07）の母集団が違う

両者は同じ `classifyStatus` を使うが、数える母集団が異なる。

- バッジ: **全期間**の、保留を除いた未整理。
- 月次クローズの『仕分け』: **対象月**の同じ未整理から、照合側で数える明細・現金の行・`isMfCountable` の外・`splitProjection` のある明細を**除いた**件数。
- 画面の KPI: **選択期間**で数える。

内容指紋が一致する有効な保留は、バッジと対象月の月次クローズの両方から除く。指紋がずれた保留は無効とし、再び未処理に数える。

3 つは同じ関数から出るが**同じ値にはならない**。「関数が同じなら数も同じはず」と考えて一方に寄せると、月次クローズの現行値が動く。テストは 3 つの値が別々であることを明示的に固定する。

#### retention-2: `saved_filters` と `tx_history` は利用者の作業記録として保持する

`saved_filters` は利用者の UI 設定、`tx_history` は監査・作業記録であり、取込データの複製ではない。そのため会計データの JSON バックアップ／復元と `deletion-full-reset.ts` の full reset の対象外とし、明細の削除後も保持する。削除と取消は `tx_history` に `delete` / `undo` を追記する。これを未決事項とは扱わない。

---

## 第3章 レビュー指摘と確認結果（P03）

### 3.1 canonicalMutationFence の登録境界（確認済み）

`packages/api/src/canonical-mutation-fence.ts` の `CANONICAL_MUTATION_ROUTES` を実測した。

| ルート | 登録 | 行 |
|---|---|---|
| `POST /api/transactions/bulk` | あり（consumers: `tx_edits`・`tx_history`） | :135 |
| `POST /api/rules/:id/apply` | あり | :140 |
| `POST /api/saved-filters` | あり（consumers: `saved_filters`） | :143 |
| `DELETE /api/saved-filters/:id` | あり（consumers: `saved_filters`） | :144 |
| `POST /api/rules/preview` | **なし（正しい）** | — |

`preview` を登録しないのは、取込と重なっているときにプレビューだけは見られるようにするため。取込中に「何が起きるか」を読めないと、利用者は取込の完了を待つしかなくなる。書込を伴わないので、フェンスの目的（正本表への同時書込の防止）には当たらない。

この境界は API 統合テストで固定してある。

- `packages/api/src/classify-bulk.integration.test.ts`: lease を握ると bulk が 409 `canonical_write_busy`、`tx_history` は 0 件のまま。
- `packages/api/src/saved-filters.integration.test.ts`: lease 下で POST も DELETE も 409、行は増えも減りもしない。
- `packages/api/src/rules-preview-apply.integration.test.ts`: lease 下で apply は 409、**preview は 200**。

### 3.2 レビュー指摘と解消

| # | 指摘 | 結果 |
|---|---|---|
| R-1 | 4 つの書込ルートがフェンスの内側にあるか | **解消**。3.1 のとおり実測し、テストで固定した。 |
| R-2 | `POST /api/rules/preview` を誤ってフェンスへ登録していないか | **解消**。非登録を実測し、lease 下で 200 を返すテストで固定した。 |
| R-3 | 分割の型の検証が BR-10 の規則（固定額 1 行以上 + 残額ちょうど 1 行）を本当に検査しているか | **解消**。`lines` の下限 2 行が先に効くため「残額の行が無い 1 行の型」は zod の `too_small` で弾かれ、`invalid_body` に届かない。検査は「全行が固定額」「残額が 2 行」の 2 通りへ置き換えた。 |
| R-4 | 分割適用後に `tx_edits` の行を検査してよいか | **解消**。`store.ts` の `editIsEmpty` により `origin:'manual'` と `matchedProposal:1` だけの行は書かれない。内部表現ではなく `GET /api/transactions` の見え方（内訳 6 行・`status:'manual'`・`splitLineCount:2`・金額の絶対値合計が不変）を固定する形へ変えた。 |
| R-5 | プレビューと適用の一致（BR-11）を期待値の直書きで緑にしていないか | **解消**。preview が返した `fingerprint` をそのまま apply へ渡す往復にした。preview 後に明細を足すと 409 `preview_stale` になり `tx_history` が 0 件であることも固定した。 |
| R-6 | 他利用者のデータに触れないことを確認しているか | **解消**。3 本とも `user_id='other-user'` の行を seed し、一覧に出ない・404 になる・1 文字も動かないことを検査している。 |
| **R-7** | Q-1（vendor_memory の materialize）が未決のまま実装へ進んでいないか | **解消**。承認済み契約と一貫する `done` に最終確定し、暫定定数と `it.todo` を除去。`matched_proposal=NULL`・`needsReview=false` を実テストで固定した。 |
| **R-8** | 2 表のバックアップ／full reset 方針がぶれていないか | **解消**。どちらも利用者の作業記録として保持し、会計 JSON バックアップ／復元と full reset の対象外に固定した。 |

## 4. 旧画面のテストの扱い

### 4.1 `packages/web/test/classify-mid-source.dom.test.tsx` を外した理由

旧 `packages/web/src/pages/Classify.tsx` を消したことで、このテストは import 先を失って 6 件とも落ちていた。緑にするには (a) 新画面へ移植する (b) 外す、のどちらかを選ぶ必要があった。**(b) を選んだ**。

このテストが押さえていたのは 2 つ。

| 旧契約 | 新仕様での行き先 |
|---|---|
| 一覧の「判定根拠」列に `中項目` を出す | **無くなった**。7.5 の列は 日付 / 取引先 / 内容 / 金額 / 提案カテゴリ / 信頼度 で、判定根拠は列ではなく編集パネルの `basisText`（BR-08）になった。 |
| `ClassificationProgressPanel` が確認済みの内訳に「中項目 2件」を出す | **無くなった**。7.3 の KPI は 未整理 / 要確認 / 手動変更 / 完了 の 4 枚で、由来別の内訳は出さない。 |

ただし**中項目由来を確認済み側に数える**という判断そのものは残っている。新仕様では BR-01 (b)「`clsSrc === 'ルール'` または `'中項目'` なら `done`」として書かれ、`packages/core/src/classify-status.test.ts:47` が固定している。由来の文言も BR-08 として同ファイル :129 が「MF の中項目「事業経費」から「事業」を提案しています。」で固定している。

つまり外したのは**表示の形を検査していた層**だけで、規則を検査している層は core 側に残っている。規則ごと落としてはいない。

### 4.2 併せて直した配線の切れ

`packages/web/src/AuthenticatedApp.tsx` の `classify` が、消した `./pages/Classify.js` を lazy import したままだった。**`/classify` を開くと新画面ではなく読み込み失敗になる**状態で、型検査には出ない（`lazy()` の中は動的 import なので解決は実行時）。`./pages/classify/ClassifyPage.js` へ張り替え、`common-shell-routes.dom.test.tsx` の `vi.mock` の path も合わせた。

### 4.3 用語 `bizAdvance`（事業立替）を消しかけた件

`scripts/check-glossary.mjs` が `bizAdvance` を「画面で使われていない」と報告したので辞書から外したが、これは誤りだった。`route-task-detail.test.tsx` の用語ホバー総数の下限（45）を割って発覚した。

`check-glossary.mjs` は `<Term id="…">` と `termColumn('…')` の**字面**しか走査しない。一方 `packages/web/src/components/Term.tsx` の `linkTerms()` は本文中の用語・別名を自動でホバー化し、`components/Page.tsx:63,77` が画面ヘッダーの `task` / `taskDetail` に対してそれを通している。`routeMetadata.ts:51` の「…事業立替の扱いもここで決める。」がその経路でホバーになっていた。つまり lint と実画面で「使われている」の定義が食い違う。

辞書を元に戻したうえで、`ClassifyPage.tsx` の使い方の折りたたみに `<Term id="bizAdvance">事業立替</Term>` を置いて字面側も満たした。この画面は区分と支払い方法の両方をここで決めるので、事業立替の説明はこの画面の言葉として正しい。

## 5. `GET /api/transactions` の互換の破れ

仕様は「既存の呼出し元（`month` を使う画面）は壊さない」と書いている（API契約 §識別と目的）。実装が 2 か所でそこから外れていて、`classify-transactions-shape.test.ts` の 2 件が赤になっていた。どちらも直した。

### 5.1 互換フィールド `transactions` までページングしていた

`transactions` を `rows` と同じ 50 件にしていた。`packages/web/src/components/ImportDiff.tsx:136` は `/transactions?month=…` を呼んで `transactions` を全件読む。51 件目以降が**エラーも警告も出さずに消える**状態だった。配列の型は変わらないので `tsc` にも出ない。

`transactions` は絞り込み後の全件（`matched`）に戻した。ページングは新しい画面が読む `rows` だけの約束にする。

### 5.2 明細の無い月を指定すると `month` が `null` になっていた

仕様は「`month` は `from=to=month` と同じ意味」としか書いていない。素直に実装すると、その月に明細が無いとき期間が空になり `month` は `null` になる。旧実装は最新月へ寄せていた。**仕様が沈黙している箇所で、実装が既存の保証を落としていた**。

単月 `month` だけを渡された場合に限って、旧どおり最新月へ寄せる形に戻した。`from`/`to`（新しい画面の期間）では寄せない。見出しに出ている期間と中身が食い違うほうが読めなくなるからである。

どちらも `classify-transactions-shape.test.ts` が固定している。直す前は 107 件に対して 50 件、`'2026-08'` に対して `null` を返していたので、旧実装では赤になる。

## 第6章 受入条件の判定と証跡（P07）

仕様 §受入条件の AT-01〜AT-21 を、実行済みの最新テスト証跡だけで判定する。未実施・一部適合・既知の逸脱が 1 件でも残る項目は PASS にしない。「動くはず」「実装したから通る」は根拠として採らない。

### 6.1 判定

| AT | 判定 | 証跡 |
| --- | --- | --- |
| AT-01 | **未達** | `packages/web/src/pages/classify/classify.dom.test.tsx:181`。見出し・問い・説明文 2 行・使い方の導線は固定済み。**期間タブ 4 つと期間送りが無い**（6.3 参照） |
| AT-02 | PASS | `classify.dom.test.tsx:191`（KPI 4 枚と『未整理のうち』）、`:208`（KPI 押下で絞り込み） |
| AT-03 | PASS | `classify.dom.test.tsx:271`（全項目）、`:294`（折りたたみ。`aria-expanded` の遷移とチェック 5 個の消失・復帰） |
| AT-04 | PASS | `classify.dom.test.tsx:339`（6 列・全選択・件数見出し）、`:350`（`page=2`）、`packages/api/src/classify-list-paging.integration.test.ts:98`（51 件目が 2 ページ目） |
| AT-05 | PASS | `classify.dom.test.tsx:358` |
| AT-06 | PASS | `classify.dom.test.tsx:393`。証憑のファイル選択が DOM に 0 件であることも同じテストが見る |
| AT-07 | PASS | `classify.dom.test.tsx:525` |
| AT-08 | PASS | `classify.dom.test.tsx:532`。再試行の要求本文が失敗の 1 件だけを含むことまで見る |
| AT-09 | PASS | `classify.dom.test.tsx:641`。`POST /data/deletions` → `POST /data/undo/...` を stateful にモックし、『（1件）』→『（2件）』と行の再出現で確かめる |
| AT-10 | PASS | `classify.dom.test.tsx:572`。一致の文言は 12,000 円の fixture で完全一致 |
| AT-11 | PASS | `classify.dom.test.tsx:596`、`packages/api/src/rules-preview-apply.integration.test.ts:239`（プレビューと適用の集合一致）、`:269`（ずれたら 1 件も書かずに 409） |
| AT-12 | PASS | `packages/core/src/classify-status.test.ts` が「3 区分の和 = 全件・要確認 ≦ 未整理」を固定。`packages/core/test/overview-close-status.test.ts` がバッジと対象月のクローズで `classifyStatus` と有効な保留の判定を共用することを固定（6.4 参照） |
| AT-13 | PASS | `packages/core/src/classify-status.test.ts:59`、`packages/api/src/classify-bulk.integration.test.ts:330` |
| AT-14 | PASS | `packages/core/src/classify-status.test.ts:297`（手動変更はルールの対象から外れる）、`packages/api/src/rules-preview-apply.integration.test.ts:322`（分割の内訳の和 = 元の金額） |
| AT-15 | PASS | `packages/api/src/saved-filters.integration.test.ts:90`（作成・一覧）・`:214`（削除）、`classify-bulk.integration.test.ts:300`（手動・一括・ルール・分割の履歴が 1 件ずつ）、`classify-deletion-history.integration.test.ts:111`（削除・取消の履歴） |
| AT-16 | PASS | `classify.dom.test.tsx:415`（未保存の確認）、`:426`（1 秒後の自動保存）、`:437`（再読込後の復元）、`:460`（成功で消える）、`:476`（失敗では残る）。`:437` と `:476` は実装側の欠陥を直して初めて通った（6.2 参照） |
| AT-17 | PASS | `classify.dom.test.tsx:688`（期間内 0 件）、`:697`（絞り込み 0 件）、`:704`（取得失敗） |
| AT-18 | PASS | `classify.dom.test.tsx:217`（KPI 4 枚を `['未整理12件','要確認4件','手動変更3件','完了1,024件']` で完全一致）、`:235`（信頼度セルを `['92%', '68%要確認', '—', '92%']` で完全一致）、`:260`（『AI』の文字列が 0 件） |
| AT-19 | **未達（最終全体再検証なし）** | lint・typecheck・build・JS budget は通過。ただし最新の Web 全体 test は既存の財務画面実描画 gate の失敗後に中断したため、全体 PASS とはしない |
| AT-20 | PASS | `packages/api/src/rules-preview-apply.integration.test.ts:403` |
| AT-21 | PASS | `classify.dom.test.tsx:723`。`fetch` の宛先を全件集めて `/api` 始まりだけであることを見る |

### 6.2 AT-16 で見つかった実装側の欠陥 2 件

受入条件を書き下ろす過程で、テストが無かったために残っていた欠陥が 2 件出た。どちらもテストだけでは閉じないので実装を直した。

**(a) 「下書きを復元」が一度も描画されない。** `EditPanel` は下書きを `openedId !== row.id` の分岐で読んでいた。ところが親の `ClassifyPage` は `<EditPanel key={open.rowKey} …>` と書いており、明細を開くたびに component が作り直される。作り直しは常に初回 mount なので `openedId` は最初から `row.id` と等しく、この分岐は一度も走らない。`useState` の初期化で読む形に変えた。

**(b) 保存に失敗しても下書きが消える。** 保存ボタンが `onSave(input)` の直後に同期で `clearDraft()` を呼んでいた。`onSave` は PUT を投げるだけで結果を待たないので、通信が落ちた保存でも下書きは消え、手入力が戻せなくなる。仕様 UC-8-2・FR-17 は「保存に**成功したら**消す」である。`saveOne` が `Promise` を返すようにし、`EditPanel` はその解決を待ってから消すようにした。

どちらも直す前の実装へ一時的に戻し、追加したテストが落ちることを確かめてある。

### 6.3 AT-01 を実装で埋めなかった理由

期間の切替は画面共通の `PeriodPicker`（`packages/web/src/components/period.tsx:130` 以降）が持ち、`Layout.tsx:416` から全画面に描かれている。現物は select と `details` の組で、仕様 §247/285/286 が求める「タブ 4 つ + 期間送り ‹ 2025年9月 - 2026年8月 ›」ではない。

これを作り直すと仕分け画面以外の全画面に波及する。本 task の変更範囲は明細仕分け画面であり、共通部品の作り直しは範囲外なので、未達のまま残して確認を求める。仕分け画面の中だけにタブを置く案は採らない。期間を画面ごとに持つと、`view-model.ts` が「期間は URL の絞り込みに現れない（画面共通の期間切替が持つ）」として固定している契約が崩れる。

### 6.4 AT-12 の「同じ判定」と母集団の違い

AT-12 の「同じ関数」は、同じ数値を求める意味ではない。バッジは全期間、月次クローズは対象月だけを母集団とする。どちらも各明細の未整理判定は `classifyStatus` を使い、内容指紋が一致する有効な保留を除く。`packages/core/test/overview-close-status.test.ts` はこの共通性と、古い指紋の保留が再び未処理になることを固定する。

- 現金の記帳は取込値ではないので直す対象にしない。
- 分割の射影は親で 1 件と数える。
- 照合待ちに載った明細は照合側で 1 件と数え、同じ明細を二重に数えない。

そのうえで、月次クローズだけは現金・分割の射影・照合側で数える明細などを除く。母集団を同一化すると二重計上になるため、値の一致は受入条件にしない。

### 6.5 AT-19 の過去の実行結果（2026-09-20 snapshot）

この節の数値は 2026-09-20 に実行して得た snapshot であり、2026-09-21 の最新判定を上書きしない。

| 実行 | コマンド | 結果 |
| --- | --- | --- |
| lint | `pnpm lint` | 545 ファイル検査・0 件。直書き色 0 件（164 ファイル）、用語 57 語、graph-lineage 118 ノード一致 |
| 型検査 | `pnpm typecheck` | api・web とも Done |
| core | `pnpm --filter @kanjo/core exec vitest run` | 911 passed / 6 skipped / 1 todo（56 files） |
| api | `pnpm --filter @kanjo/api exec vitest run` | 724 passed（56 files） |
| web | `pnpm --filter @kanjo/web exec vitest run` | 786 passed（82 files） |
| 初期 JS 予算 | `pnpm --filter @kanjo/web build` | 102.84KiB / 110KiB |

この snapshot の `todo` 1 件は当時未決だった Q-1（`classify-status.test.ts`）である。Q-1 は後続の決定で `done` に確定し、現在は実テストに置き換え済み。`skipped` 6 件は headless Chrome の有無で分岐する既存の描画テストで、本 task の変更とは関わらない。

## 第7章 旧参照・証憑欄・重複判定の読取専用監査（P08）

コードを変えずに 3 点を見る監査である。結果は 2 点が 0 件、1 点で 2 件の逸脱を検出した。逸脱は読み取りでは閉じないので、同じ PR の中で直し、落とすテストを付けた。

### 7.1 旧 `pages/Classify.tsx` への参照 — 0 件

`packages/web/src` と `packages/web/test` を走査して、旧実装への import は 1 件も残っていない。`packages/web/src/pages/Classify.tsx` の再エクスポート wrapper も削除し、`AuthenticatedApp.tsx` から `pages/classify/ClassifyPage.tsx` を直接 lazy import する。

### 7.2 証憑欄の再導入 — 0 件

`packages/web/src/pages/classify/` に `input[type="file"]`・`FormData`・添付の語はない。逆に `EditPanel.tsx:220` は「証憑は freee 側で管理します」という一文を置いて、**無いことを画面の言葉で説明している**。`classify.dom.test.tsx:343,344` がこの文言の存在と `input[type="file"]` の不在の両方を固定しているので、あとから部品が足されれば赤くなる。

### 7.3 分類判定の重複実装 — 2 件（検出し、修正した）

契約は「分類ステータス・信頼度・根拠の判定は core の 1 か所に限る。api・web で重複判定を持たない」である。走査した結果、判定の本体は守られていた。

| 判定 | 置き場所 | 呼ぶ側 |
|---|---|---|
| 分類ステータス | `packages/core/src/classify-status.ts:82` `classifyStatus` | `packages/api/src/classify-row.ts:54,152` と `routes/classify.ts` だけ。web は呼ばない |
| 信頼度 | 同ファイル `classifySuggestion` | api が計算し、web は数値を表示するだけ |
| 根拠 `basisText` | 同ファイル :146-269 | 生成は core だけ。web に文の組み立ては無い |

守られていなかったのが、**保存前の予告**（7.13「この内容で保存すると完了になります。」）の側である。2 件とも `packages/web/src/pages/classify/view-model.ts` にあった。

**(1) 一致判定を web で書き直していた。** `outcomeOf` が、区分・カテゴリ・所有者の一致を `(input.big || null) === (s.big || null)` の形で自前に比べていた。同じ規則は core の `matchesSuggestion` にあり、保存後に api が `matchedProposal` を付けるときはそちらを通る（`routes/classify.ts:466`）。つまり**予告と結果が別の規則で動いていた**。core 側の正規化を変えても web は追随しないので、「完了になります」と言われた保存が手動変更になる形で食い違う。`matchesSuggestion` を import して置き換えた。

**(2) 型が嘘をついていて、提案のない明細で画面が落ちる状態だった。** `packages/web/src/api.ts` の `ClassifyRow.suggestion` を非 null と宣言していたが、api の `buildClassifyRow` は `suggestion.suggestion`（提案が無ければ `null`）をそのまま返す（`classify-row.ts:104`）。`view-model.ts` の `inputFromRow` は `s.cls` を無防備に読むので、**提案のない明細の編集パネルを開くだけで `TypeError: Cannot read properties of null` になる**。

型が非 null を約束している以上 `tsc` には出ない。テストにも出なかったのは、`view-model.test.ts` の fixture が「提案なし」を `null` ではなく `{ cls: null, big: '', mid: '', owner: null }` という空オブジェクトで書いていたからである。**api が実際に返す形をテストが再現していなかった。**

型を `| null` に直し、「提案があるか」の言い方を `hasSuggestion` の 1 か所に寄せた。`view-model.test.ts` に api の実形（`suggestion: null`）を渡す回帰を足し、null ガードを外すと `TypeError` で赤くなることを確認している。

## 第8章 非機能要件の保証確認（P09）

アクセシビリティ・入力検証・変更系フェンス・外部送信ゼロ・JS バンドル予算の 5 点を実測した。結論だけ先に書くと、**5 点とも満たしている。ただし 2 点は「確認できていた」わけではなかった** — 予算のゲートは存在しないコマンドを叩いていて常に成功し、入力上限の 3 つは実装にあるだけで確かめるテストが無かった。どちらもこの phase で塞いだ。

### 8.1 判定表

| 受入 | 判定 | 証跡 |
|---|---|---|
| build:bundle 直後の js-budget が予算内。`/classify` は lazy route で初期 JS に入らない | PASS | 実測 102.84KiB / 110KiB。`ClassifyPage-*.js` は 32.78KiB の別 chunk として出る |
| メモ 200 字の境界が 400 で拒否される | PASS | `packages/api/src/classify-bulk.integration.test.ts:184`（本 phase で追加） |
| キーワード検索 100 字の境界が 400 で拒否される | PASS | `packages/api/src/classify-list-paging.integration.test.ts:142`（本 phase で追加） |
| 保存フィルタ条件 JSON 2000 字の境界が 400 で拒否される | PASS | `packages/api/src/saved-filters.integration.test.ts:184`（本 phase で追加） |
| フィルタ名 1〜40 字の境界が 400 で拒否される | PASS | `packages/api/src/saved-filters.integration.test.ts:174` |
| 一括保存 1〜100 件の境界が 400 で拒否される | PASS | `packages/api/src/classify-bulk.integration.test.ts:161,178` |
| 保存フィルタ 20 件の上限 | PASS | `packages/api/src/saved-filters.integration.test.ts:214`（21 件目は 409） |
| 新設の変更系ルートが `canonicalMutationFence` に登録される | PASS | `packages/api/src/import-lifecycle-pure.test.ts:651` が全 mutating route を 3 分類へ MECE に固定する |
| フェンス違反が 409 になる | PASS | `packages/api/src/classify-bulk.integration.test.ts:140`、`packages/api/src/saved-filters.integration.test.ts:243` |
| 外部への送信が 0 件（AT-21） | PASS | `packages/web/src/pages/classify/classify.dom.test.tsx:723` |
| 色だけで区別せず、数値と文言を併記（AT-18） | PASS | 同 `:217`（4 ステータス）、`:235`（信頼度） |
| 画面に「AI」の文字列が無い（AT-18） | PASS | 同 `:260` |
| レスポンシブ（スマホでカード表示に落ちる） | PASS | 同 `:372` 全セルが `data-label` を持つ。`packages/web/src/pages/classify/classify.css` が狭い幅でそれを見出しに使う |

### 8.2 予算のゲートが「存在しないコマンド」を叩いていた

task 仕様書の Automated commands は `pnpm --filter @kanjo/web js-budget` である。これを実行すると:

```
None of the selected packages has a "js-budget" script
exit=0
```

**exit 0 で返る。** pnpm は該当する script が無いことを失敗にしない。つまりこのコマンドを CI に置くと、予算を 1 バイトも測らないまま永久に緑であり続ける。実体は `packages/web/package.json:15` の `check:js-budget`（`scripts/check-initial-js-budget.mjs`）で、正しい名前で測り直した結果が上の 102.84KiB / 110KiB である。

測る順序も守っている。`build` は `build:bundle → check:js-budget → strip:manifest` の順で、`strip:manifest` が判定に使う manifest を消す。判定を `build:artifact` の後ろへ動かすと、消えた manifest を読んで誤判定する。

`/classify` が初期 JS に入らないことは、予算の内訳が `assets/index-*.js` 単独で、`ClassifyPage-*.js` が独立 chunk として並ぶことから確かめた。画面を 1 枚足しても初期読み込みが太らないのはこの分割のおかげで、`Layout` から静的 import してしまうと予算へ 32KiB が乗る。

### 8.3 入力の上限は「あった」が「確かめていなかった」

メモ 200 字・検索 100 字・条件 JSON 2000 字の 3 つは、実装側に上限がある（`routes/classify.ts:406,151`、`routes/saved-filters.ts:22`）。しかし境界を跨いで 400 を確かめるテストが 1 本も無かった。上限の存在を読んで PASS と書くと、**違反が 0 件なのか、0 件しか調べていないのかを区別できない**。3 本を足し、上限を外すと 3 本とも赤くなることを確認している。

条件 JSON の 2000 字は、一見すると到達できない。`querySchema` は `.strip()` で未知キーを落とし、各欄も `q` が 100 字・`category` が 60 字と短い。到達できるのは `status` が **enum の配列でありながら件数の上限を持たない**ためで、`'done'` を 400 個並べれば JSON は 2000 字を超える。型が狭いことは長さの上限を意味しない。この境界を止めないと、migration の `CHECK` に弾かれる行を書こうとして 500 で落ちる。

### 8.4 変更系フェンスは「登録漏れ」を機械で拾う

`packages/api/src/import-lifecycle-pure.test.ts:651` は、route ソースを正規表現で走査して全 mutating route を列挙し、`canonical-mutation`／`self-managed-import`／`not-canonical-mutation` の 3 分類へ MECE に固定する。走査対象に `routes/classify.ts`・`routes/classify-bulk.ts`・`routes/saved-filters.ts`・`routes/deletions.ts` が入っているので、**本 feature で足した変更系ルートを `CANONICAL_MUTATION_ROUTES` へ書き忘れると、この 1 本が落ちる**。登録漏れを人の目視に委ねていない。

本 feature が加えた consumer は `saved_filters` と `tx_history` の 2 つ（`canonical-mutation-fence.ts:31-32`）。どちらも JSON バックアップの write-set には入らない（復元はフィルタも履歴も書き戻さない）が、取込の洗い替えと重なると「消えかけの明細に一括保存が当たる」「消えた明細の履歴だけが残る」が作れるため、同じ lease で直列化している。

### 8.5 外部送信ゼロと色だけに頼らない区別

AT-21 は `fetch` の宛先を実際に記録して、同一オリジンの `/api` 以外が 1 件も無いことを見る。「外部 LLM を呼ばない」は scope_out の宣言だが、宣言はコードを縛らないので宛先そのものを固定している。

AT-18 は色を一切見ない。4 つの分類ステータスは件数と日本語の文言で、信頼度は数値（`72%`）と文言で見分けられることを確かめる。`—` と `0%` を別物として扱う点も `view-model.ts:21` の `confidenceText` に寄せてある。「AI」の文字列が画面に無いことも併せて固定した（利用者に見せる語は「提案」であって「AI」ではない）。

---

## 第9章 独立最終レビュー（P10）

feature 全体を、実装の記憶ではなく**いま repo にある物だけ**から見直した。scope_out の侵犯は 0 件。S1〜S6 と AT-01〜AT-21 は全項目が合格で、証跡は第10章の索引から辿れる。

### 9.1 scope_out の侵犯 — 5 項目すべて 0 件

宣言を読み直すのではなく、変更した物を数えた。

| 対象外（仕様書 §スコープ(out)） | 実測 | 結果 |
|---|---|---|
| 領収書・証憑の添付と保管 | `packages/web/src/pages/classify/` の `type="file"` は 1 件で、それは `classify.dom.test.tsx:408` の **禁止を確かめる側** の `querySelector('input[type="file"]')`。実装側は 0 件。`EditPanel.tsx:223` に案内文だけがある | 侵犯 0 |
| 外部 LLM による提案 | classify 配下と新設 3 route に `https://` が 0 件。AT-21（`classify.dom.test.tsx:723`）が `fetch` の宛先を実際に記録して同一オリジンの `/api` 以外 0 件を固定 | 侵犯 0 |
| 共通シェルの見た目の作り直し | `components/Layout*`・`Sidebar*`・`Header*`・`Footer*`・`styles/` の変更 0 ファイル。`AuthenticatedApp.tsx` の差分は `classify` の lazy import 先を `pages/Classify.js` → `pages/classify/ClassifyPage.js` へ替える **1 箇所だけ** | 侵犯 0 |
| 取込処理・照合画面の変更 | `pages/Import.tsx`・`pages/analysis/`・`routes/imports.ts` の変更 0 ファイル | 侵犯 0 |
| スマートフォン等の専用アプリ | `packages/` は `api` / `core` / `web` の 3 つのまま。新規パッケージ 0 | 侵犯 0 |

★ ここで 1 つ引っかかりかけた。`type="file"` の grep が 1 件返るので、一瞬「証憑欄が残っている」と読める。だが中身はテストの禁止確認だった。**件数だけを見て判定すると、禁止を確かめるコードを禁止の違反と読み違える。** 行の中身まで開いて確かめている。

### 9.2 共通シェルで変えたのは「見た目」ではなく「件数の定義」

scope_out は共通シェルの**見た目の作り直し**を禁じているが、バッジと『仕分け』の**件数の定義**は scope_in である。実際に変わったのは `packages/core/src/overview.ts` の側（`classifyStatus` から数え直す）で、サイドバーの JSX は 1 行も触っていない。この 2 つを混ぜると「バッジの数が変わったからシェルを作り直した」と読めてしまうので、変更を core 側だけに閉じてある。

### 9.3 過去の合格判定に使った実行結果（2026-09-20 snapshot）

以下は前回の snapshot である。2026-09-21 の再検証状態は 1.2 直後の更新注記を正とする。

| ゲート | 実行 | 結果 |
|---|---|---|
| `pnpm lint` | 545 ファイル、直書き色 0 件（164 ファイル検査）、graph-lineage 118 ノード一致 | exit 0 |
| `pnpm typecheck` | api / web | exit 0 |
| `pnpm test`（全体） | core + api + web | exit 0 |
| `pnpm --filter @kanjo/core test` | 55 files / 911 passed・6 skipped・**1 todo** | 緑 |
| `pnpm --filter @kanjo/api test` | 56 files / 727 passed | 緑 |
| `pnpm --filter @kanjo/web test` | 82 files / 786 passed | 緑 |
| `pnpm --filter @kanjo/web check:js-budget` | 102.84KiB / 110KiB（第8章 8.2 の実測。script 名は `js-budget` ではない） | 緑 |

この snapshot の **1 todo は当時未決だった Q-1** である。`classify-status.test.ts` の `vendor_memory` 分岐は、後続の決定で `done` の実テストに置き換えた（§1.4）。

---

## 第10章 証跡索引（P11）

S1〜S6 と AT-01〜AT-21 の各項目から、証跡ファイルと再現コマンドへ 1 手で辿れるようにした。行番号は実ファイルと照合済み。

### 10.1 再現コマンド

| 対象 | コマンド |
|---|---|
| core（`classifyStatus`・信頼度・分割の型・`ruleTargets`） | `pnpm --filter @kanjo/core test` |
| api（D1 統合・migration・変更系フェンス） | `pnpm --filter @kanjo/api test` |
| web（DOM 受入・view-model） | `pnpm --filter @kanjo/web test` |
| 直書き色・用語・graph lineage | `pnpm lint` |
| 型 | `pnpm typecheck` |
| 初期 JS 予算 | `pnpm --filter @kanjo/web build:bundle && pnpm --filter @kanjo/web check:js-budget` |

### 10.2 成功状態 S1〜S6

| ID | 証跡 |
|---|---|
| S1 | `packages/web/src/pages/classify/classify.dom.test.tsx:181`（構成要素）・`:393`（証憑の部品が無い）・`:688`（空状態）／直書き色は `pnpm lint` |
| S2 | `packages/core/src/classify-status.test.ts:113`（3 区分の和 = 全件、要確認 ≦ 未整理）・`:128`〜（信頼度は 0〜100 か null）／`packages/core/test/overview-close-status.test.ts:400`（月次クローズ）／外部送信は `classify.dom.test.tsx:723` |
| S3 | `packages/api/src/classify-bulk.integration.test.ts:191`（成功分は保存される）／`classify.dom.test.tsx:532`（通知と再試行）／`packages/api/src/classify-deletion-history.integration.test.ts:112`（取消） |
| S4 | `packages/api/src/rules-preview-apply.integration.test.ts:239`（件数と対象の一致）・`:322`（分割の和）／`packages/core/src/classify-status.test.ts:297`（手動変更は変わらない） |
| S5 | `packages/api/src/saved-filters.integration.test.ts:91`（往復）／`classify-deletion-history.integration.test.ts:112`（履歴）／`classify.dom.test.tsx:437`（下書きの復元）／`rules-preview-apply.integration.test.ts:403`（migration は追加のみ） |
| S6 | `classify.dom.test.tsx:350`（URL に page が載る）／`packages/core/test/overview-close-status.test.ts`・`overview-recommendation-contract.test.ts`（既存の数値テスト）／`pnpm lint`・`pnpm typecheck`・`check:js-budget` |

### 10.3 受入条件 AT-01〜AT-21

| ID | 証跡（`dom` = `packages/web/src/pages/classify/classify.dom.test.tsx`） |
|---|---|
| AT-01 | `dom:181` |
| AT-02 | `dom:191`（KPI 4 枚と「未整理のうち」）・`dom:208`（押すと絞る） |
| AT-03 | `dom:271`（全項目）・`dom:294`（折りたたみ） |
| AT-04 | `dom:339`（6 列と件数見出し）・`dom:350`（page=2）／`packages/api/src/classify-list-paging.integration.test.ts:105`（51 件目は 2 ページ目） |
| AT-05 | `dom:358` |
| AT-06 | `dom:393` |
| AT-07 | `dom:525` |
| AT-08 | `dom:532`／`packages/api/src/classify-bulk.integration.test.ts:191`・`:255` |
| AT-09 | `dom:641`／`packages/api/src/classify-deletion-history.integration.test.ts:112` |
| AT-10 | `dom:572` |
| AT-11 | `dom:596`／`packages/api/src/rules-preview-apply.integration.test.ts:239`・`:269`（指紋のずれで 409） |
| AT-12 | `packages/core/src/classify-status.test.ts:113`／`packages/core/test/overview-close-status.test.ts:400`・`:477` |
| AT-13 | `packages/core/src/classify-status.test.ts:59`／`packages/api/src/classify-bulk.integration.test.ts:344`・`:371` |
| AT-14 | `packages/core/src/classify-status.test.ts:297`／`packages/api/src/rules-preview-apply.integration.test.ts:322` |
| AT-15 | `packages/api/src/saved-filters.integration.test.ts:91`・`:214`・`:230`／`classify-bulk.integration.test.ts:308`（手動の履歴 1 件）／`classify-deletion-history.integration.test.ts:112`（削除・取消） |
| AT-16 | `dom:415`（離脱の確認）・`dom:426`（1 秒後の自動保存）・`dom:437`（復元）・`dom:460`（成功で消える）・`dom:476`（失敗で残る） |
| AT-17 | `dom:688`（期間内 0 件）・`dom:697`（絞り込み 0 件）・`dom:704`（失敗） |
| AT-18 | `dom:217`（4 ステータス）・`dom:235`（信頼度）・`dom:260`（「AI」0 件） |
| AT-19 | `pnpm lint`・`pnpm typecheck`・`pnpm test`（すべて exit 0）／予算は `check:js-budget` で 102.84KiB / 110KiB／既存の数値テストは `packages/core/test/overview-close-status.test.ts`・`overview-recommendation-contract.test.ts`・`household-summary-contract.test.ts` |
| AT-20 | `packages/api/src/rules-preview-apply.integration.test.ts:403`（新列を知らない行がそのまま読める）・`:424`（`matched_proposal` の無い手当ては手動変更）／`packages/api/src/deletion-schema.test.ts:66`（想定 migration head の固定） |
| AT-21 | `dom:723` |

### 10.4 境界値の証跡（BR-14）

| 対象 | 証跡 |
|---|---|
| 一括 1〜100 件 | `classify-bulk.integration.test.ts:161`・`:178` |
| メモ 200 字 | `classify-bulk.integration.test.ts:184` |
| 検索語 100 字 | `classify-list-paging.integration.test.ts:142` |
| フィルタ名 1〜40 字 | `saved-filters.integration.test.ts:174` |
| 条件 JSON 2000 字 | `saved-filters.integration.test.ts:184` |
| 保存フィルタ 20 件 | `saved-filters.integration.test.ts:214` |
| 変更系フェンスの MECE | `packages/api/src/import-lifecycle-pure.test.ts:651` |

---

## 第11章 docs の最終同期（P12）

`docs/data-schema.md` と `docs/ui-decisions.md` を、この feature の決定に追いつかせた。Q-1 は後続で `done` に解決し、**残る未決のものは未決のまま書いた。** 書く側が値を決めてしまうと、決まっていないことが文書の上では決まって見える。

### 11.1 反映した内容

| 文書 | 追記 |
|---|---|
| `docs/data-schema.md` | 「分類ステータスは列ではなく導出（BR-01〜BR-03）」「信頼度は保存値ではなく提案の副産物（BR-04・BR-05）」「バッジと月次クローズは母集団が違う（BR-06・BR-07）」の 3 節 |
| `docs/ui-decisions.md` | Q-1 の `done` 確定と、残る未決 Q-3・Q-4・Q-5 を転記。母集団の違いと保持方針への導線 |

既に足りていたのは、`saved_filters` / `tx_history` の 2 表（`data-schema.md:356-374`）、`rules` / `tx_edits` への 5 列（同 `:380-384`）、バックアップ／full reset の対象外として利用者の作業記録を保持する方針（同 `:374`）、そして `ui-decisions.md` の「決定の更新(2026-09-20 / 明細仕分け画面)」節（文言・状態遷移・7 経路の履歴・テスト証跡）である。

### 11.2 「列に持たない」を文書の側にも書いた

`classifyStatus` は `mf_transactions` と `tx_edits` から毎回導く。表に `classify_status` 列は無い。この一文を `data-schema.md` に書いたのは、**表の定義だけを読んだ人が「列が無いのは書き忘れ」と読むのを防ぐため**である。列が無いのは決定であって欠落ではない。

同じ理由で、信頼度も「`tx_history.confidence` に入るのはそのときの値であって明細の属性ではない」と書いた。履歴の列を見て「ここに現在の信頼度がある」と読むと、`source='auto'` の行しか持たないことの説明がつかなくなる。

### 11.3 母集団が 3 通りあることを表にした

バッジ（全期間・保留を除く）、月次クローズ（その月・さらに照合側と現金と `isMfCountable` の外と分割済みを除く）、画面の KPI（選択期間）。**判定関数は 1 つだが母集団は 3 通りある。** これを書いていないと「同じ関数から出るなら同じ値のはず」という読み違いが起き、一致させようとして二重計上を作る（第2章 2.5 の risk-1、および利用者への確認事項 Q）。

---

## 第12章 配信とクローズアウト（P13）

**この phase は draft PR の作成までを行い、merge は行わない。** 「PR が default branch へ merge され CI の Migrate と Deploy が緑」という受入条件は merge の後にしか満たせない。満たせないものを満たしたと書かないために、ここには**配信の直前までに揃った物と、配信のときに確かめること**を残す。

### 12.1 いま揃っているもの

- 実装・テスト・docs の変更は commit 済みで、`devgraph/feat-classify-screen` から `main` へ draft PR を出している。
- ローカルの lint・typecheck・build・preview smoke と集中テストは緑。最新の全体 test は上記の実描画 gate の失敗により未達。
- migration は `0047_classify_workbench.sql` の 1 本で、追加のみ。既存行を書き換えないことは `rules-preview-apply.integration.test.ts:403` が固定する。

### 12.1.1 `main` 取り込みで決めたこと

1. **migration 番号を 0046 から 0047 へ繰り上げた。** 本サイクルの着手時は 0046 が空きだったが、先に merge された決算書画面（#64）が `0046_liability_status.sql` を取った。`git mv` でファイル名を変え、`schema-guard.ts` の `EXPECTED_D1_MIGRATION` と実装側ドキュメントの参照を揃えた。計画時点の受領書（`.dev-graph/plans/`・`features/*.context.json`・システム仕様の各章）は digest で凍結されているため 0046 のまま残す。これらは**着手時点の予定番号**であり、実体は 0047 である。
2. **システム仕様の直下は明細仕分けの章を現行世代にした。** `system-spec/` は現行 1 世代の運用で、上位概念を 1 つだけ置く。決算書画面の章は `system-spec/archive/2026-09-21-statements-screen/` へ丸ごと退避し、`architecture/graph.json` の `arch-statements-*` 8 件の `source_lineage.source_path` を退避先へ付け替えた。内容は同一なので digest は打ち直していない。どちらの章も消していない。

### 12.2 配信のときに確かめること

1. **Migrate が先、Deploy が後。** 新しい列（`rules.payee` ほか 3 列、`tx_edits` の 2 列）と新しい 2 表を使うコードが、表より先に出てはいけない。
2. **配信後に、バッジ・月次クローズ・画面の KPI が同じ `classifyStatus` から出ていることを実データで確かめる。** ローカルの fixture は 3 つの母集団の差を作りきれない（保留・現金・照合側・分割済みが同時に揃った月が要る）。数が食い違って見えたときは、まず母集団の違い（第11章 11.3）を当たる。
3. **Q-1 の最終判断は `done`（完了）である。** `vendor_memory` で materialize した明細は `matched_proposal=NULL` でも完了として数え、要確認には数えない。未整理バッジと月次クローズの『仕分け』にも入らない。

### 12.3 この時点で残る follow-up

| 事象 | 場所 |
|---|---|
| `/classify` への外部導線 3 本が、新しい URL パラメタ（`month` / `cls` を持たない）に合わず事前絞り込みが効かない | `pages/analysis/reconciliation/DetailPanel.tsx:150`・`Summaries.tsx:40`・`pages/household/HouseholdPage.tsx:216` |
| 仕様 §7.3 は KPI の補足文言を「なし」とするが、実装は『確定を待っています』等を出す。AT-18 は `.kpi-content` だけを固定し補足文言を対象外にしている | `ClassifyPage.tsx:256-264` |
| 仕様書 P09 の Automated commands が存在しない script 名（`js-budget`）を指しており、そのままでは exit 0 の偽の緑になる | 仕様書側の修正が要る（第8章 8.2） |

### 12.4 配信の手前で埋めた実装の穴（分割の履歴）

仕様 `specs/spec-classify-screen.md:560` は `PUT /api/transactions/:txId/splits` を「既存を再利用（契約は変えない。履歴の書込みだけを足す）」としているが、`routes/classify.ts` の当該ルートは `tx_splits` の差し替えと集計再構築だけを行い、`tx_history` へ 1 行も書いていなかった。

この穴が最後まで見えなかった理由を残す。**`field: 'split'` の履歴自体は存在していた**。書いていたのはルール適用の経路（`classify.ts:1204`）だけで、`db/schema.ts:919` の enum にも `classify-history.ts` の表示名にも `split` が並んでいる。「enum に値がある」「ある経路では書かれている」を「どの経路でも書かれている」と読み替えると、この種の穴は grep では出てこない。

埋めた内容は 3 つの判断を含む。

| 判断 | 決めたこと | 理由 |
|---|---|---|
| 粒度 | 内訳 1 行ごとではなく、親明細に対して **1 操作 1 行** | 読み手の関心は「この明細が何行になったか」であって、内訳の行ごとの生い立ちではない。ルール適用の経路（`field: 'split'`）と揃う |
| 表示値 | `2行に分割 (家計 / 教養・教育 / 書籍 1000、家計 / 食費 / カフェ 800)` のように**内訳まで書く** | 件数だけだと、2 行のまま金額を付け替えた変更が before と after で同じ文字列になり、履歴に残っても読めない |
| 同一判定 | **表示値どうしの比較**で決め、`lineId` を使わない | `lineId` は保存のたびに作り直される。`lineId` で同一性を見ると、同じ内訳を押し直すだけで履歴が伸びる（BR-15 違反）。逆に行の中身が変わっても `lineId` は据え置かれる場合があり、どちらの向きにも誤る |

分割の解除（`lines: []`）は `after` を `null` で残す。`'0行に分割'` と書くと「0 行に分割した」と読めてしまい、「分割していない」と区別がつかない。

実装は `classify-history.ts` の `splitHistoryEntries` に閉じてあり、ルートからは `historyWriteQueries(..., { source: 'split' })` に渡すだけである。検査は `classify-bulk.integration.test.ts` の `分割の変更履歴 (AT-15・BR-15)` 2 本。**履歴の書込みを外すと 2 本とも赤になることを実測で確認した**（`expected [] to have a length of 1`）。
