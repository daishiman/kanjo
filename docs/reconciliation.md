# 照合画面

照合 (`/analysis/reconciliation`) は、帳簿 (freee の仕訳) と口座 (MoneyForward の取引) の差異を「どこから解消するか」判断し、確認・照合・別取引・除外・元に戻すまでを 1 画面で行う画面です。

- 仕様の正本は `specs/spec-reconciliation.md` です。
- 設計の根拠は `architecture/reconciliation-*.md` と [`reconciliation/architecture-decision.md`](reconciliation/architecture-decision.md) にあり、ここには転記しません。
- この文書は、機能の見取り図と、運用・調査のときに最初に読む場所をまとめたものです。
- 見た目の正本は [`../design/FINAL-UI/images/04-reconciliation.png`](../design/FINAL-UI/images/04-reconciliation.png)、アイコンの対応は [`reconciliation-icons.md`](reconciliation-icons.md) です。

## 前提となる仕組み

- 状態・対応必要件数・期間投影・下段プレビューの定義は、仕様正本 [`specs/spec-reconciliation.md` の「状態・件数・投影の正本」](../specs/spec-reconciliation.md#状態件数投影の正本) だけを参照します。
- 判定器は core の `reconcileBizDuplicates`、画面向け導出は `reconciliationReport` に一本化します。5 状態と `actionRequiredCount` は保存せず、判断と除外から導出します。
- 一覧・KPI・対応キュー・下段プレビューは「全期間で照合 → 選択期間へ投影」の同じ結果から描きます。下段は左=`mfOnly`、右=`reviewRows` の読み取り専用プレビューです。
- 元に戻せるのは直前の 1 操作だけです。履歴とエラー契約は仕様正本の BR-008 と API 契約を参照します。
- 一致度・類似度の計算詳細は [`data-schema.md` の「照合の規則」](data-schema.md#照合の規則)、プロダクト上の状態と件数の意味は仕様正本を参照します。

## 1. 画面の構成

| 部品 | 内容 | 実装 |
|---|---|---|
| KPI 4 枚 | 事業支出 / MFのみの支出 (対応不要) / 対応が必要 (`kpi.actionRequiredCount`) / 解消済み (リング) | `ReconciliationPage` の `KpiTile` / `ResolutionTile` |
| 絞り込み | 入力元・状態・月。狭幅では畳む | `RadioOption` |
| 対応キュー | 対応が要る 3 行と「確認のみ」の MFのみ。見出しは API の `kpi.actionRequiredCount` をそのまま使う | `ACTION_QUEUES` / `INFO_QUEUES` |
| 候補一覧 | 検索、状態バッジ、一致度、行の選択、ページ送り (10 / 20 / 50)。並びは日付の降順で固定 | `ReconciliationPage` |
| 取引の詳細 | MF と freee の値、一致の理由 (満たす / 満たさない)、一致度のバー、照合 / 別の取引 / 除外、直前の操作と元に戻す。MFのみの行は対応不要の説明・除外・仕分けへの導線だけを出す | `DetailPanel` |
| 操作の結果 | 完了 / 部分成功 (件ごとの失敗理由) / 失敗 | `OperationResult` |
| 下段プレビュー | `mfOnly` と `reviewRows` の代表行。読み取り専用で、操作は中央一覧・詳細で行う。`unmatchedFreee` は現行 web では未使用 | `ReconciliationPage` |
| 選択中バー | 選んだ件数と一括操作 (最大 200 件)。「照合から除外」は除外済み以外のすべての行 (MFのみ・照合済みを含む) を、「別の取引として処理」は未解消 (要確認・未処理) の行だけを、「照合」は未解消で freee の候補がある行だけを送る。一括照合は同じ freee の候補を指す 2 件目以降を送らない。どちらも確認ダイアログで送る件数と残す件数を出す | `ReconciliationPage` |
| 共通シェル | サイドバーの件数バッジ、月次クローズ (取込・仕分け・照合は自動判定、レビューは手動)、フッター、改善を送る | `components/Layout.tsx`、`components/MonthlyCloseProgress.tsx` |

1099px 以下では 1 カラムに縦積み (キュー → 一覧 → 詳細) になり、639px 以下では KPI が 1 列になります。

## 2. API

| メソッドとパス | 役割 | 主なエラー |
|---|---|---|
| `GET /api/reconciliation` | `{ period, kpi, statusCounts, sourceCounts, queues, rows, mfOnly, unmatchedFreee, lastAction }`。対応必要総数は `kpi.actionRequiredCount`、`reviewCount` は要確認だけの互換内訳。`unmatchedFreee` は web 未使用 | — |
| `POST /api/reconciliation/actions` | `{ action, targets[1..200] }` を受けて判断・除外を保存する。200 `{ results, saved, action }` | 400 (件数・形式違反)、409 `canonical_write_busy` |
| `POST /api/reconciliation/actions/:id/undo` | 直前の操作を書き戻す。200 `{ ok, action }` | 400 `invalid_action_id`、404 `action_not_found`、409 `action_already_undone` / `action_not_latest` / `action_snapshot_invalid` / `action_stale` / `canonical_write_busy` |
| `PUT /api/monthly-close/:month/review` | 月次レビュー済みにする。200 `{ month, reviewedAt }` | 400 `invalid_month`、409 |
| `DELETE /api/monthly-close/:month/review` | 月次レビューの取り消し (204) | 400、409 |

- `action` は `same` (同じ取引) / `different` (別の取引) / `exclude-mf` / `exclude-freee` のいずれかです。
- 件ごとの失敗理由は `not_found` / `tx_id_required` / `unstable_identity` / `freee_not_found` / `no_candidate` / `freee_not_pairable` / `duplicate_target` / `freee_excluded` / `freee_already_matched` / `not_matchable` / `target_not_actionable` です。意味と対処は runbook の表を正とします。
- 「同じ」で相手の freee を名指しすれば、金額が違っても照合済みになります。総額には freee 側の金額が残ります。
- 「同じ」は保存の前に、保存後の判断で判定器 `reconcileBizDuplicates` を試算し、名指しの組が照合済みになる件だけを保存します。保存したのに照合済みにならない判断 (取り合いで負けた、相手が除外済み) を残さないためです。
- すべて `/api/*` の認証ガードの下にあり、未ログインは 401 です。
- web 側の react-query のキーは `['reconciliation']` です。判断や取込の後は、照合・ハブ・総収支の問い合わせを一緒に無効化します。総収支の画面で判断したときも、照合と月次クローズのキューを無効化します。

## 3. データ

migration `0041_reconciliation_tables.sql` が 2 表を追加します (CREATE のみ)。判断は既存の表を共用します。

| 表 | 主キー | 役割 |
|---|---|---|
| `duplicate_verdicts` (0036) | `(user_id, tx_id)` | 同じ / 違う の判断。総収支と共用 |
| `freee_deal_exclusions` (0037) | `(user_id, freee_key)` | freee 側の除外。総収支と共用 |
| `mf_tx_exclusions` (0041) | `(user_id, tx_id)` | MF 側の除外。tx_id が変わったら stable_key で結び直す |
| `reconciliation_actions` (0041) | `id` | 一括操作 1 回ぶんの記録。90 日で次の操作の batch 内で削除 |
| `monthly_close_reviews` (0040) | `(user_id, month)` | 月次レビュー。概況と共用 |

バックアップと復元での扱いは、[`reconciliation/refactoring.md`](reconciliation/refactoring.md) で点検しています。判断と除外の 3 表は、既存の `duplicate_verdicts` と同じくバックアップに含めません。復元の後に古い操作を取り消そうとすると `action_stale` で止まります。

## 4. 検査の置き場所

| 系統 | ファイル | 見ているもの |
|---|---|---|
| core | `packages/core/test/reconciliation.test.ts` | 類似度・一致度の境界と丸め、状態 5 語、キュー、金額違いの相手の 1 対 1 割り当て、判断と除外、件数の一本化、解消率 |
| API | `packages/api/test/reconciliation.integration.test.ts` | 認証、4 経路の件数一致、200 / 201 件、部分成功、組めない「同じ」の拒否、取り消し、90 日保持、月次レビュー |
| DOM | `packages/web/src/reconciliation.dom.test.tsx`、`src/common-shell.dom.test.tsx`、`src/route-icon-distinct.test.tsx` | 構成・操作・読込 / 空 / 失敗の状態、共通シェル、アイコンの重複 |
| 描画 | `packages/web/scripts/check-financial-visuals.mjs` | 照合画面の各幅での横はみ出しと縦積み |

## 5. 困ったとき

- 画面ごとに対応必要件数が合わない、照合を押しても照合済みにならない: [`runbooks/reconciliation-mismatch.md`](runbooks/reconciliation-mismatch.md)
- 受入と証跡: [`reconciliation/acceptance.md`](reconciliation/acceptance.md)、[`reconciliation/evidence.md`](reconciliation/evidence.md)
- リリースと巻き戻し: [`reconciliation/close-out.md`](reconciliation/close-out.md)
- 仕様・設計への影響判定: [`reconciliation/spec-reflection-receipt.md`](reconciliation/spec-reflection-receipt.md)
