# サブスク統合 (09-subscriptions) — 実装要件

- Feature: `feat-subscriptions-merge`
- Package: `feature-package/feat-subscriptions-merge`
- Handoff target: `task-graph`
- Snapshot: `sha256:d690c00e96ef7745efd64ac67840530424c28d6ad4df33b34a7649e4921684ea`(`.dev-graph/state/graph.json` の bytes、graph revision 3)
- System plan: `sha256:c7490d24a113ff369d24716501692dc5364f49a8b5d6aa7179e368a49d1a36d8`
- Readiness: **PASS**(missing sections 0、3 gate が同一 snapshot)

契約の正本は `specs/spec-subscriptions-merge.md` である。本書が持つのは、要件と system task の対応と、requirements 段階で見つけた指摘だけである。実装コードも task spec も生成しない。13 task の内容は `.dev-graph/plans/feature-package-feat-subscriptions-merge/task-specs/` を正本とし、本書はそれを書き換えない (published digest を保つ)。

## 目的

サブスク画面で統合しても一覧から行が消えない問題を正す (`/subscriptions?vendor=aquavoice` の登録済みの行は、今は統合先の選択欄が出ず何も変わらない)。あわせて、統合・登録・変更・見直し判断を続けて行っても、複数の利用者が同時に行っても、操作が失われず止まらないようにする。今は同時の書込みが『サーバー側で処理に失敗しました』で終わる。

## 到達状態

登録済みの行を別の登録済みの行へ統合すると、統合元が一覧から消え、統合先の月額が統合前の和と一致する。他画面のサブスク集計も core の 1 つの照合一覧から同じ名寄せを示す (O1)。5 件連続・2 件同時の操作で 500 は 0 件になり、取り合いは明示的な 409 か 503 になって画面が自動で収束させる。『サーバー側で処理に失敗しました』は 5xx と通信の失敗のときだけ出る (O2)。行チェック・全選択・選択バー・統合先・操作状態・操作者・取り消しが DOM テストで緑になる (O3)。テナント分離・取り消し・古い revision の 409・保持の期限が守られる (O4)。そのうえで `pnpm verify:full` が緑になる状態を目指す。

## requirements 段階の決定

本 feature では requirements 段階で新たに決めた事項は無い。spec の未決事項は『利用者に聞く事項は残っていない』で閉じており、着手時に現物で確かめる 5 事項 (OI-1〜5) は P01 が担当する。

## 実装要件

### REQ-SM-001 名寄せを core の resolveVendorMerges 1 か所で導き、照合順をそろえる

packages/core に純関数 `resolveVendorMerges(vendors)` を足す。`merged_into_id` の連鎖を推移的にたどり、統合元の name と aliases を最終の統合先の照合対象へ展開して、統合元を単独の照合対象から外す。循環と自己統合は例外にし、同じテナントの行を指さない参照は統合なしとして扱う。`matchSubVendor` はこの照合一覧だけを受ける。他画面の subs 集計 (`dataset.ts` の applyFreeeDeals)、サブスク画面の行の組み立て (`subs-screen.ts` buildContext → registeredVendorOf)、事業分の現金明細の射影 (`store.ts` projectCashContribution) の 3 経路が同じ一覧を通す。照合の順序は、科目で先に絞ってから照合する形 (`subs.ts` の eligibleForAccount) にそろえる。復元した baseline に残る `subs:統合元` の列は、Dataset を組むときに統合先の列へ合算する。金額の母集団は各画面の定義を保つ。

- 根拠: FR-005 / FR-008 / FR-009 / BR-011 / BR-012 / AC-002 / AC-003 / qa-subsmerge-decision-002 / qa-subsmerge-backend-web-003
- 担当 task: `SYS-SUBSMERGE-P01`、`SYS-SUBSMERGE-P02`、`SYS-SUBSMERGE-P04`、`SYS-SUBSMERGE-P05`、`SYS-SUBSMERGE-P07`、`SYS-SUBSMERGE-P08`
- Source: `specs/spec-subscriptions-merge.md`、`features/feat-subscriptions-merge.md`

### REQ-SM-002 統合の意味の是正と、行チェック・全選択・選択バー・名称を統合の画面

登録済みの行も統合元にでき、統合元は `merged_into_id` で統合先を指して一覧から消える。未登録の取引名は統合先の aliases へ足す。統合元の見直し判断は統合先へ吸収し (FR-006)、統合先の accounts には統合元の accounts を足す (どちらかが空なら空 = 全科目、FR-007)。画面は一覧の先頭列に行チェック、ヘッダに全選択 (一部選択は SelectionCheckbox の indeterminate) を置く。選択は vendorKey の Set と取引名の配列を 1 つの選択バーへ渡す。選択バーは画面下端に固定し、『N件の取引を選択中』・チップ・統合先・『選択したN件を統合』『選択を解除』・右端の × を並べる。統合先の既定は core の `defaultMergeTarget` (選択中の登録済み行のうち推定月額が最大、無ければ null) で決める。統合済みのベンダーは統合先の選択欄に出さない。詳細パネルには『名称を統合』を登録の有無を問わず出す。統合の送信は選択バーの 1 か所だけにする。処理中は行チェック・全選択・取引名チェックを無効にする。統合が完了したら選択を消し、`?vendor=` が統合元を指していれば統合先へ置き換える。

- 根拠: FR-001〜FR-007 / FR-021 / FR-022 / BR-001 / AC-007 / AC-008 / AC-011 / AC-016 / qa-subsmerge-decision-001 / qa-subsmerge-ui-ux-web-003 / qa-subsmerge-frontend-web-003
- 担当 task: `SYS-SUBSMERGE-P02`、`SYS-SUBSMERGE-P04`、`SYS-SUBSMERGE-P05`、`SYS-SUBSMERGE-P07`、`SYS-SUBSMERGE-P09`
- Source: `specs/spec-subscriptions-merge.md`、`features/feat-subscriptions-merge.md`

### REQ-SM-003 POST /api/sub-vendors/merge と原子的な db.batch

`POST /api/sub-vendors/merge` を subsRoute に足し、authGuard・mustChangePasswordFence・canonicalMutationFence の配下に置く (fence の CANONICAL_MUTATION_ROUTES に明示登録)。Idempotency-Key は必須で 8〜64 文字の `[A-Za-z0-9-]`。本文は targetId・sourceVendorIds (0〜50 件・重複なし)・rawNames (0〜50 件・各 1〜120 文字・制御文字なし)・baseRevision で、両方が空なら 400 empty_merge とする。targetId と統合元はテナントの `sub_vendors` から 1 回で引き、無ければ 404 を返す。自己統合と循環は 422 merge_cycle、統合済みの行は 409 subscription_revision_conflict、aliases が 50 件を超えれば 400 too_many_aliases。適用は 1 つの `db.batch` の 10 文 ((a) 条件付きの操作の挿入、(b1) merged_into_id と aliases・accounts の更新、(b2)(b3) 判断の付け替えと削除、(c) revision の +1、(d)(e) subs 範囲の削除と `json_each(?)` による 1 文での再挿入、(f) JSON snapshot の無効化、(g)(h) 保持の掃除) で行い、recomputeFromDeals は呼ばない。(a) 以外の文は操作の行が在ることを条件にする。応答は `{ operation, revision, replayed }` で、`Cache-Control: private, no-store` を付ける。

- 根拠: FR-005〜FR-007 / FR-012 / FR-013 / BR-001〜BR-008 / API: sub-vendors-merge / AC-001 / AC-002 / AC-006 / AC-012 / AC-014
- 担当 task: `SYS-SUBSMERGE-P02`、`SYS-SUBSMERGE-P03`、`SYS-SUBSMERGE-P04`、`SYS-SUBSMERGE-P05`、`SYS-SUBSMERGE-P07`、`SYS-SUBSMERGE-P09`
- Source: `specs/spec-subscriptions-merge.md`、`features/feat-subscriptions-merge.md`

### REQ-SM-004 並行制御: revision・Idempotency-Key・lease の分離・503 d1_overloaded と画面の待ち行列

テナントに 1 本の revision (`subscription_revisions`) を持ち、書込みの baseRevision が現在値と違えば未適用の 409 subscription_revision_conflict を返す。読んでから batch までの競合は、(a) の 0 行か `UNIQUE (user_id, base_revision)` の違反で同じ 409 にする。Idempotency-Key は (user_id, actor_user_id, key) で一意にし、同じ本文の再送は最初の結果 (`replayed: true`) を返す。本文が違えば 422 idempotency_key_reused、本文を消した後なら 422 idempotency_key_expired。canonical mutation の lease はサブスク等を 2 分 (`CANONICAL_MUTATION_CLAIM_TTL_MS`) とし、取込の 15 分と分ける。D1 の overloaded は 503 d1_overloaded (retryable) に言い換える。画面の書込みは全て 1 つのフックを通し、`useMutation` に `scope: { id: 'subscriptions-write' }` を付けて 1 件ずつ実行する。409 busy と 503 は同じ key で 1・2・4 秒後に最大 3 回再送する。409 revision は取り直して前提を検査し、新しい base と key で最大 3 回送り直す。5xx と通信の失敗は自動では送らず、同じ key の『再試行』を出す。操作状態の文言は describeError を通さず、エラーコードから spec の文言を決める。

- 根拠: FR-011 / FR-012 / FR-014〜FR-017 / BR-007 / BR-008 / 非機能 Availability / AC-004 / AC-005 / AC-006 / AC-009 / AC-015 / AC-021 / qa-subsmerge-decision-003〜005
- 担当 task: `SYS-SUBSMERGE-P01`、`SYS-SUBSMERGE-P02`、`SYS-SUBSMERGE-P03`、`SYS-SUBSMERGE-P04`、`SYS-SUBSMERGE-P05`、`SYS-SUBSMERGE-P07`、`SYS-SUBSMERGE-P09`
- Source: `specs/spec-subscriptions-merge.md`、`features/feat-subscriptions-merge.md`

### REQ-SM-005 取り消しと操作履歴 (POST …/undo・GET /api/subscription-operations・操作状態)

`POST /api/subscription-operations/:id/undo` は、テナントの kind='merge' で未取り消しの操作を、操作者を問わず取り消す。判定は BR-009 の順で行う: 404 not_found、409 already_undone、410 undo_expired (30 日超か before_json が NULL)、409 undo_blocked_by_later_operation。取り消しは before_json の値で merged_into_id・aliases・accounts・判断を戻し、元の行の undone_at を埋めて kind='unmerge' の行を足す。revision は +1 する。これを 11 文の batch で行う。`GET /api/subscription-operations?limit=1..20` は users を LEFT JOIN して、新しい順に `{ operations: [{ id, kind, targetVendorName, createdAt, actorEmail, undoneAt, undoneByEmail, undoable, undoBlockedReason }], revision }` を返す。payload_json・before_json・key は返さない。画面は一覧のカードの直下に『操作』として直近 5 件を出す。各行には操作者の email、状態 (文字と design tokens の状態色)、取り消せる統合の『元に戻す』を付ける。users に行が無い操作者は『削除された利用者』と示す。

- 根拠: FR-018〜FR-020 / BR-009 / BR-010 / API: subscription-operation-undo / API: subscription-operations-list / AC-010 / AC-013 / AC-017 / AC-019 / AC-020 / AC-022 / qa-subsmerge-undo-scope-001 / qa-subsmerge-actor-record-001
- 担当 task: `SYS-SUBSMERGE-P02`、`SYS-SUBSMERGE-P04`、`SYS-SUBSMERGE-P05`、`SYS-SUBSMERGE-P07`、`SYS-SUBSMERGE-P09`
- Source: `specs/spec-subscriptions-merge.md`、`features/feat-subscriptions-merge.md`

### REQ-SM-006 既存書込み 9 本と読み取り 2 本への revision と操作の記録

既存の書込み 9 本 (sub-vendors の作成・更新・別名・削除・exclusions の POST/DELETE・review、review-decisions の POST/DELETE) を変える。いずれも baseRevision (任意) と Idempotency-Key (任意、省略時は操作 id を key に入れる) を受け、操作を actor_user_id 付きで記録し、revision を +1 する。掃除も同じ batch に入れる。名寄せに効く書込み (作成・更新・別名・削除) は subs 範囲の置き換えも同じ batch に入れ、別の batch の再集計をやめる。統合済みの行への PUT・aliases・review・DELETE は 409 とする。統合先の DELETE は統合元もまとめて消し、まとまりの判断も消す (9 文)。fence の既存 9 経路の consumers に新しい 2 表を足す。`GET /api/subscriptions` と `GET /api/sub-vendors` の応答に revision を足し、sub-vendors には各行の mergedIntoId も足す。baseRevision を送らない古い画面は従来どおり動かす。

- 根拠: FR-010 / FR-011 / API: subscriptions-read-revision / API: subscription-writes-base-revision / AC-014 / AC-018
- 担当 task: `SYS-SUBSMERGE-P02`、`SYS-SUBSMERGE-P04`、`SYS-SUBSMERGE-P05`、`SYS-SUBSMERGE-P07`、`SYS-SUBSMERGE-P08`
- Source: `specs/spec-subscriptions-merge.md`、`features/feat-subscriptions-merge.md`

### REQ-SM-007 migration 0058・schema・backup/restore・保持と掃除

`migrations/0058_subscription_merge_operations.sql` は追加型の migration とする。`sub_vendors.merged_into_id` を足し、`subscription_operations` (UNIQUE (user_id, actor_user_id, idempotency_key)・UNIQUE (user_id, base_revision)・INDEX (user_id, created_at)、actor に外部キーなし) と `subscription_revisions` を作る。`EXPECTED_D1_MIGRATION` を 0058 へ進め、`db/schema.ts` に列と 2 表を足す。backup の JSON では `subVendorMetadata` の各行の任意のキー `mergedIntoName` で統合を運ぶ。復元はこれを名前で検証 (存在しない・自己・循環は InvalidRestoreSettingsError) し、`UPDATE … FROM json_each(?)` で入れ直す。操作の記録と revision は backup に入れず、`JSON_SNAPSHOT_MUTATION_CONSUMERS` にも足さない (`CanonicalConsumer` の型にだけ足す)。復元は revision を +1 する。保持は、30 日を過ぎた行の payload_json・before_json を NULL にし、400 日を過ぎた行を削除する。掃除は書込みの batch の 2 文で 50 件ずつ行う。

- 根拠: FR-023 / BR-013 / データモデル / 互換性・移行・リリース / AC-019 / qa-subsmerge-retention-001 / qa-subsmerge-database-web-003
- 担当 task: `SYS-SUBSMERGE-P01`、`SYS-SUBSMERGE-P02`、`SYS-SUBSMERGE-P04`、`SYS-SUBSMERGE-P05`、`SYS-SUBSMERGE-P12`、`SYS-SUBSMERGE-P13`
- Source: `specs/spec-subscriptions-merge.md`、`features/feat-subscriptions-merge.md`

### REQ-SM-008 非機能制約・セキュリティ・監査と docs・配信

統合・取り消し 1 要求の D1 の問い合わせを 20 文未満にし、統合テストで数える。テナントは `c.get('userId')`、操作者は `c.get('actor').id` からだけ特定し、本文・クエリ・ヘッダの値は無視する。observability のログには操作 id・kind・結果・所要 ms・actor の id だけを出し、取引名・別名・email・金額は出さない。応答にも before_json・payload_json・key を含めない。色は design tokens だけを使い、`packages/web/src` に hex を直書きしない。native checkbox は SelectionCheckbox だけが持つ。状態の変化は `aria-live="polite"` で知らせる。初期 JS 予算を超えない。`pnpm lint`・`typecheck`・`test`・`verify:full` を exit 0 にする。docs は `docs/subscriptions-screen.md` と `docs/data-schema.md` に書く (追跡手順 UC-8 と 0058 の説明を含む)。配信は単一 PR で、順序は Migrate 0058 の後に Deploy とする。今回の実行では commit・push・PR を行わず、ローカルの準備までとする。

- 根拠: 非機能要件 / 可観測性 / 認証・認可 / AC-012 / AC-020 / AC-023 / qa-subsmerge-security-web-003 / qa-subsmerge-maintenance-ops-web-003
- 担当 task: `SYS-SUBSMERGE-P01`、`SYS-SUBSMERGE-P05`、`SYS-SUBSMERGE-P06`、`SYS-SUBSMERGE-P08`、`SYS-SUBSMERGE-P09`、`SYS-SUBSMERGE-P10`、`SYS-SUBSMERGE-P11`、`SYS-SUBSMERGE-P12`、`SYS-SUBSMERGE-P13`
- Source: `specs/spec-subscriptions-merge.md`、`features/feat-subscriptions-merge.md`

## 着手前提と持ち越し事項

handoff を止める不足 (missing sections) は 0 件である。次の事項は未決のまま持ち越し、各担当 task の着手時に確かめる。推定のまま confirmed にしない。

### plan の open_items(goal-spec.json)

| ID | 内容 | 状態 | 是正担当 |
|---|---|---|---|
| OI-1 | migration 0058 の番号が空いていること | 未決 (unresolved_precondition) | SYS-SUBSMERGE-P01 |
| OI-2 | TanStack Query の解決版で useMutation の scope と useMutationState の型が使えること | 未決 (unresolved_precondition) | SYS-SUBSMERGE-P01 / SYS-SUBSMERGE-P05 |
| OI-3 | D1 の overloaded を 503 d1_overloaded へ言い換える判定に使う例外の message | 未決 (unresolved_precondition) | SYS-SUBSMERGE-P01 / SYS-SUBSMERGE-P05 |
| OI-4 | FR-009 (科目で先に絞る照合順) による他画面のサブスク集計の数値の変化 | 未決 (unresolved_precondition) | SYS-SUBSMERGE-P01 / SYS-SUBSMERGE-P04 |
| OI-5 | 統合 1 回の D1 の問い合わせ数が 20 未満に収まる見込み | 未決 (unresolved_precondition) | SYS-SUBSMERGE-P01 / SYS-SUBSMERGE-P04 / SYS-SUBSMERGE-P09 |

### system-spec の完了評価・plan の評価から持ち越した指摘

| ID | 重大度 | 内容 | 状態 | 是正担当 |
|---|---|---|---|---|
| CF-doc-freshness-vitest | medium | 出典 vitest-expect の version と latest_checked_at が評価時点で現行版 (5.0.3) より古かった。取込み前に 5.0.3 へ更新済みだが、評価は取り直していない | 未決 | doc-fetch/C02 / SYS-SUBSMERGE-P12 (記録) |
| CF-C06-leading-question | medium | qa-subsmerge-decision-005 の問文が推奨案を埋め込んでいる (C06 軸2)。qa の問文は凍結されていて追記では消えない | 例外承認済み | SYS-SUBSMERGE-P10 (waiver の範囲の再確認) |
| CF-C06-unresolvable | medium | hearing-auditor の判定規則 (1 軸でも検出で FAIL、問文の書換禁止) の組合せで、置き換え済みの過去の問文まで FAIL が続く | 例外承認済み | なし (記録のみ) |
| CF-low-8 | low | low 8 件 (問文の前提埋め込み 3 件・訂正が章に届かない・reopen 後の取り直し・basis の過大・foundation の参照の鮮度・承認節への qa の再掲・vitest の版の食い違い)。いずれも結論は変えない | 未決 | SYS-SUBSMERGE-P12 (docs に訂正と版の扱いを記録) / elicit/C01 |
| PF-C3-waiver | low | 仕様章の完成度評価は FAIL のまま、利用者の例外承認で先へ進めている | 未決 | SYS-SUBSMERGE-P10 |

### requirements 段階で見つけた指摘

| ID | 重大度 | 内容 | 是正担当 |
|---|---|---|---|
| RQ-F1 | medium | `packages/api/src/import-lifecycle.test.ts:991` がバックアップの `subVendorMetadata` を toEqual で固定している。このファイルは P04・P05 の resource_scope に無い。mergedIntoName を全行に null で付けると落ちる。mergedIntoName は統合済みの行にだけ付け、未統合の行にはキーを出さない (spec の『任意のキー』の読み方)。scope 外のテストは書き換えない | SYS-SUBSMERGE-P02 / SYS-SUBSMERGE-P05 |
| RQ-F2 | low | `packages/web/src/selection-checkbox-source-contract.test.ts` は native checkbox を SelectionCheckbox だけに許す。新しい行チェック・全選択はこの部品で書く (scope 外の契約テストは書き換えない)。 | SYS-SUBSMERGE-P05 |
| RQ-F3 | info | registration receipt の graph_digest_after は canonical JSON の sha256 で、本書の snapshot (bytes の sha256) と方式が違う。値の違いは drift ではない。handoff に graph_canonical_digest を併記し、登録時の値と一致することを検算した | なし (記録のみ) |

## 実行グラフ

13 nodes は P01→P13 の直列で、依存は直前の 1 件だけ、root は P01 である。状態・資源・lineage は各 task の frontmatter (`tasks/feat-subscriptions-merge/sys-subsmerge-pNN.md`) を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-SUBSMERGE-P01 | 要件の基準線と、着手時に確かめる 5 事項 (0058 の空き・TanStack の型・問い合わせ数・overloaded の判定・照合順による数値の変化) の確定 | — |
| SYS-SUBSMERGE-P02 | resolveVendorMerges・統合と取り消しの db.batch・fence の登録・migration 0058・backup の mergedIntoName・画面の待ち行列の設計決定記録 | SYS-SUBSMERGE-P01 |
| SYS-SUBSMERGE-P03 | 名寄せの 1 か所導出・書込みの原子性・テナント分離と操作者の記録の独立設計レビュー | SYS-SUBSMERGE-P02 |
| SYS-SUBSMERGE-P04 | 名寄せ・統合と取り消し・並行制御・選択と待ち行列の失敗テストの先行作成 | SYS-SUBSMERGE-P03 |
| SYS-SUBSMERGE-P05 | migration 0058・resolveVendorMerges・統合と取り消しと操作履歴の API・既存書込みの revision・backup・選択バーと操作状態の画面の実装 | SYS-SUBSMERGE-P04 |
| SYS-SUBSMERGE-P06 | 全テスト・型検査・lint の実行記録 | SYS-SUBSMERGE-P05 |
| SYS-SUBSMERGE-P07 | 受入 O1〜O4・U5 の検証 | SYS-SUBSMERGE-P06 |
| SYS-SUBSMERGE-P08 | 旧い統合経路・名寄せを通らない照合・色の直書き・describeError を通る操作状態の文言の残存の読取専用監査 | SYS-SUBSMERGE-P07 |
| SYS-SUBSMERGE-P09 | アクセシビリティ・ログの秘匿・D1 の問い合わせ数・JS 予算の保証確認 | SYS-SUBSMERGE-P08 |
| SYS-SUBSMERGE-P10 | 独立最終レビュー | SYS-SUBSMERGE-P09 |
| SYS-SUBSMERGE-P11 | 再現可能な証跡索引の作成 | SYS-SUBSMERGE-P10 |
| SYS-SUBSMERGE-P12 | 統合と取り消し・操作履歴の API・migration 0058・保持と掃除の docs 最終同期 | SYS-SUBSMERGE-P11 |
| SYS-SUBSMERGE-P13 | 単一 PR での配信 (Migrate 0058 の後に Deploy) とクローズアウト。今回はローカルの準備まで | SYS-SUBSMERGE-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0(graph revision 3) |
| C02 saved state | spec・architecture 8・feature と 13 task がいずれも confirmed / pass / complete。13 task の source_digest は validated_digest と一致 |
| validate-system-plan | pass、P01..P13、`sha256:c7490d24a113ff369d24716501692dc5364f49a8b5d6aa7179e368a49d1a36d8`、violations 0 |

task artifact (md) 13 件は plan の段階で graph の task node の値と task-spec 本文から投影した。graph.json は書き換えていない (revision 3 のまま。canonical digest `sha256:ffb581eb074478f9aaa5a1597af34ecd7ce49be18a80a24bb90a99e2a6e7c224` は登録時の値と一致する)。
