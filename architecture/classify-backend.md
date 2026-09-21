---
graph_node_id: "arch-classify-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "明細仕分け — 分類ステータスと提案を導く core 純関数 1 か所と変更系 API"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "backend"]
file_path: "architecture/classify-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "28297c3d03be9cf9a1f52e5d03cb310b2ca3291534bb4e2591ba22da81ed9035"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "28297c3d03be9cf9a1f52e5d03cb310b2ca3291534bb4e2591ba22da81ed9035", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-database", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-auth"]
resource_scope: ["packages/core/src/classify-status.ts", "packages/core/src/classify.ts", "packages/core/src/overview.ts", "packages/core/src/vendor-memory.ts", "packages/core/src/splits.ts", "packages/core/src/cash.ts", "packages/core/src/types.ts", "packages/core/src/index.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/deletions.ts", "packages/api/src/d1-limits.ts", "docs/data-schema.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec の backend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/classify-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G2", "G3", "G4", "G5"]
---

# Architecture overview

明細仕分け — 分類ステータスと提案を導く core 純関数 1 か所と変更系 API。`system-spec/backend.md` は承認時入力、本書は判定・提案・ルール適用の置き場所と API の制約を持つ。契約と判定規則の逐語の正本は `specs/spec-classify-screen.md`。

## Context and drivers

- Business/technical context: `packages/api/src/routes/classify.ts` (729 行) は `GET /transactions` (94 行)・`PUT /transactions/:txId/class` (265)・`PUT /transactions/:txId/edit` (310)・`GET` / `PUT /transactions/:txId/splits` (395・436)・`GET /rules` (559)・`POST /rules` (624)・`PUT` / `DELETE /rules/:id` (658・688)・`PATCH /rules` (703) を持つ。`recommendationFor` (`packages/core/src/overview.ts:246`) は vendor_memory → ルール → MF 中項目の順で最初に当たった 1 つだけを返し、信頼度が数値になるのは vendor_memory 由来のときだけで、利用は `/review-queue` に限られる。仕分けの進捗は `classificationProgress` (`packages/core/src/classify.ts:335`) で、未確認は `clsSrc === '既定'`。月次クローズの『仕分け』(`overview.ts:453-461`) は `buildReviewQueue` が作る classification 項目の件数で、現金・`isMfCountable` 外・`splitProjection` あり・照合待ちの明細を除いている (`overview.ts:338-341`)。支払方法は `paymentMethodOf` (`packages/core/src/cash.ts:71`) が機関名から導き、上書きの列は無い (qa-classify-backend-web-evidence-001)。
- Quality attribute priorities: G2・G3・G4・G5 に資する。Clean Architecture の Dependency Rule (core ← api ← web の一方向) と data-access の境界 (D1 の読み書きを route に閉じ、core は行集合だけを受け取る) を適用する。
- Constraints: packages/core は依存ゼロの純関数。Cloudflare Workers (Hono) + D1/Drizzle。判定と集計を api / web に重複実装しない。外部の LLM を呼ばない (qa-classify-decision-003)。

## Goals and non-goals

- Goals:
  - G2: core に分類ステータスの判定 (仮称 `classifyStatus`、`packages/core/src/classify-status.ts` を予定) を新設し、各明細を 未整理 / 手動変更 / 完了 の 3 区分に排他で振り分け、和が全件に一致する件数集計と、未整理の内訳としての要確認を 1 か所で出す。ナビのバッジと月次クローズの『仕分け』もこの関数から導き、`classificationProgress` の数え方を置き換える。
  - G2: `recommendationFor` を拡張し、vendor_memory・ルール・MF 中項目のどの由来にも決定論の信頼度 (0〜100 の整数、提案が無いときだけ null) と根拠の文を付け、`GET /transactions` の各行に提案・信頼度・根拠・分類ステータスを載せる。
  - G3: 選択した複数の明細を 1 回の要求で保存する一括保存を設け、明細ごとの成否を返し、成功分を取り消さない。
  - G4: ルールに取引先・適用範囲・分割の型を持たせ、作成前のプレビューと適用を同じ core 関数で行う。手動変更した明細はルールで上書きしない。
  - G5: 保存フィルタの保存・一覧・削除と取引の履歴の取得を設け、全ての変更経路で履歴を 1 件ずつ残す。
- Non-goals:
  - 外部の LLM による提案 (qa-classify-decision-003)
  - 証憑の受け付け・保存 (qa-classify-decision-001)
  - 取込処理・照合の判定の変更
  - 削除と取消の新しい経路 (既存の `/data/deletions`・`/data/undo/:operationId` を使う)

## System context and boundaries

- Users/external systems: web (明細仕分け画面・共通シェルのナビのバッジと月次クローズ)。外部サービスは呼ばない。
- Trust/deployment/data boundaries: core は D1 を知らず、明細・手当て・ルール・vendor_memory の行集合だけを受け取る。route は zod で受け、`loadScoped` などで D1 から入力を組んで純関数へ渡し、結果を書くか JSON へ写すだけにする。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 分類ステータス判定 (`classifyStatus` 仮称) | 各明細の区分 (未整理 / 手動変更 / 完了) と要確認の理由、件数 (3 区分と要確認) を返す | 純関数 | packages/core | 同一 Worker |
| core `recommendationFor` (拡張) | 全由来を評価して提案カテゴリ・信頼度・根拠の文・衝突の有無を返す | 純関数 | packages/core | 同一 Worker |
| core ルールの該当と分割の展開 | ルール条件 (取引先・キーワード・適用範囲) に当たる明細と、適用後の仕訳 (カテゴリ・分割の行) を返す。プレビューと適用で共用する | 純関数 | packages/core | 同一 Worker |
| core 月次クローズ・レビューキュー (改修) | 『仕分け』の件数とナビのバッジを分類ステータス判定から導く | 純関数 | packages/core | 同一 Worker |
| `GET /api/transactions` (拡張) | 期間・分類ステータス・カテゴリ・所有者・支払方法・手動変更のみ・キーワードで絞り、50 件ずつ返す。各行に提案・信頼度・根拠・区分、応答に件数 KPI | Hono route | packages/api | Worker |
| 一括保存 | 明細ごとに検証と保存を行い、成否の配列を返す | Hono route | packages/api | Worker |
| ルールのプレビューと適用 | 作成前の条件で該当明細と適用後の仕訳・件数を返す。保存済みルールを同じ判定で適用する | Hono route | packages/api | Worker |
| 保存フィルタと取引の履歴 | 保存フィルタの保存・一覧・削除、明細の履歴の新しい順の取得 | Hono route | packages/api | Worker |
| 既存の手当て・分割・削除と取消 | 確定時の提案一致の記録と履歴の追記を加える | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 新経路はすべて既存 `/api/*` の認証・フェンス配下に置く (`architecture/classify-auth.md`)。変更系のフェンス登録は `architecture/classify-security.md`。
- Errors/resilience: クエリと本文は zod で検証し、違反は 400。一括保存の件数上限超過は 400。一括保存は部分失敗でも HTTP 200 で明細ごとの結果を返す (agent 推定・利用者未確認、根拠 qa-classify-backend-web-002)。エラー応答に内部の SQL・スタックを含めない。
- Observability/audit: 取引の履歴 (`tx_history`) を業務上の変更記録とし、各変更経路の書込と同じ D1 batch に入れて、書込は成功して履歴だけ欠ける状態を作らない。
- Configuration/secrets: 追加の秘密情報を持たない。
- Compatibility/versioning: `GET /transactions` への列の追加は加法的。`classificationProgress` を置き換えるときは既存の利用者 (`GET /transactions` の `progress` など) を新しい判定へ移し、同じ数え方を 2 か所に残さない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/classify-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/classify-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/classify-database.md`)
- Security: N/A: 本章の関心外 (`architecture/classify-security.md`)

### Backend architecture

#### Runtime and architecture pattern

- Runtime/framework/version: 既存の Cloudflare Workers + Hono + zod + Drizzle (D1)。packages/core は依存ゼロの TypeScript 純関数。
- Pattern: 判定・信頼度・ルールの該当と分割の展開は入出力を持たない計算として core に置き、api の route は入力の組み立てと書込だけを行う層構造 (Clean Architecture の Dependency Rule)。
- Selection rationale and rejected alternatives: プレビューと適用が同じ core 関数を通るため、O4 の『プレビューの件数と適用後に変わった明細が一致する』を単体テストで確かめられる。route ごとに判定を書く案は、バッジ・月次クローズ・画面の件数がずれるため採らない。

#### Domain and module boundaries

- Bounded contexts/modules: 分類ステータス (区分と要確認)、提案 (由来ごとの信頼度と根拠)、ルール (該当・適用範囲・分割の型)、作業状態 (保存フィルタ・履歴)。
- Dependency direction: core ← api ← web の一方向。core は D1 / Hono の型を参照しない。
- Public/internal interfaces: 区分の定義は次のとおり (qa-classify-backend-web-003・qa-classify-decision-005/006)。
  - 未整理: 利用者・ルール・MF 中項目のどれもまだ決めていない明細 (現行の `clsSrc === '既定'`)。提案の有無と信頼度は問わない。
  - 完了: 利用者が確定したとき区分・カテゴリ・所有者がすべてその時点の提案と一致した明細と、ルール・MF 中項目が決めた明細、取込時に vendor_memory が materialize した明細。vendor_memory は `matched_proposal` が NULL でも完了とし、これら自動決定由来の信頼度は表示にだけ使い、要確認には数えない。
  - 手動変更: 利用者が提案と 1 つでも異なる値で確定した明細、提案が無いまま利用者が決めた明細、この変更より前の手入力の明細 (確定時の一致の記録が無い手当て)。
  - 要確認: 区分ではなく未整理の内訳。提案の信頼度が 80 未満・提案どうしの衝突・区分と名義の矛盾のいずれかがある未整理の明細。
  - 確定時の判断は明細の手当て (`tx_edits`) の追加列に残し、後から提案が変わっても区分が揺れないようにする (列の置き場所は agent 推定・利用者未確認、根拠 qa-classify-database-web-003)。

#### API and service contracts

- Protocol/style/versioning: 同一オリジンの REST (JSON)。経路は `POST /api/transactions/bulk`・`POST /api/rules/preview`・`POST /api/rules/:id/apply`・`GET` / `POST /api/saved-filters`・`DELETE /api/saved-filters/:id`・`GET /api/transactions/:txId/history`。ルールの作成は既存の `POST /api/rules` に取引先・適用範囲・分割の型を足す (経路名は agent 推定・利用者未確認、根拠 qa-classify-backend-web-002)。
- Request lifecycle: ミドルウェア (認証 → パスワード変更 → スキーマ → フェンス) → zod → `loadScoped` 等で入力を組む → core 純関数 → D1 batch で手当て・分割・ルール・履歴を書く → JSON。
- Error taxonomy: 検証違反と上限超過は 400、他人の行・存在しない行は 404 (一括保存では明細単位の `not_found`)、フェンスの競合は既存の 409 `canonical_write_busy`、未適用のスキーマは 503。一括保存の応答は `{ results: [{ txId, ok, error? }] }` (agent 推定・利用者未確認、根拠 qa-classify-backend-web-002)。

#### Data and transaction behavior

- Repository/data owner: 書込は classify route に閉じる。削除と取消は既存の deletions route を使い、履歴に削除と取消の行を足す。
- Transaction/idempotency/concurrency: 一括保存は明細ごとに先に検証してから書き、成功分は取り消さない。D1 の batch は 1 回の中で全か無かになるため、batch の区切りは明細の境界に合わせ、1 明細の書込 (手当て・分割・履歴) を 2 つの batch に跨がせない。batch が失敗したときはその batch に入った明細だけを失敗として返す。変更系はフェンスで取込の洗替えと直列化する。
- Cache consistency/invalidation: サーバ側キャッシュを持たない。件数と提案は要求のたびに導出する。
- 信頼度の値: vendor_memory 由来は既存の `vendorConfidence`、取引先とキーワードの両方が一致するルールは 95、キーワードだけのルールは 85、MF 中項目の対応表は 70、2 つ以上の由来が異なるカテゴリを提案する衝突では最小値から 20 を引く (下限 0)。区分と名義の矛盾は 区分=個人 かつ 所有者=事業、または 区分=事業 かつ 所有者が事業以外 (いずれも agent 推定・利用者未確認、根拠 qa-classify-backend-web-002)。衝突を検出するため、拡張後の `recommendationFor` は最初の 1 由来で止めず全由来を評価する。
- ルール適用: 適用範囲『未確定の明細だけ』は未整理の明細に限り、『一致する明細すべて』でも手動変更の明細は変えない。分割ルールは固定額の行と残額の行で展開し、各行の和を元の金額に一致させる。
- 支払方法: 手当ての上書きの値があればそれを、無ければ従来どおり `paymentMethodOf` の導出値を使う。

#### Async processing

- Queue/event/scheduler: N/A: 非同期処理・キュー・スケジューラを追加しない。一括保存とルール適用は要求内で完結する。
- Delivery/order/dedup/retry/DLQ: N/A: 再試行は画面が失敗した明細だけを再送して行う。

#### Security and resilience

- Authn/authz/input validation: `architecture/classify-auth.md` と `architecture/classify-security.md` に従う。手動変更を上書きしない規則は core で守り、画面の表示に頼らない。
- Timeout/retry/circuit breaker/load shedding: 一括保存 1 回 100 件の上限 (agent 推定・利用者未確認、根拠 qa-classify-security-web-002) と、ルールのプレビューの走査を表示期間 (最大 3 年) の明細に限ることで 1 要求の負荷を抑える。`IN (...)` に載せる件数は `packages/api/src/d1-limits.ts` の `inClauseChunkSize` で区切る。

#### Operations and verification

- Logs/metrics/traces/health/readiness: N/A: 新しい運用信号を追加しない。
- Unit/contract/integration/load/failure tests: core 単体テストで O2 (3 区分の排他と和、要確認 ⊆ 未整理、信頼度 79 は要確認・80 は要確認でない、衝突・矛盾の各規則、提案どおりの確定は完了・異なる確定は手動変更、vendor_memory のmaterialize は `matched_proposal=NULL` でも完了かつ要確認でない、バッジと月次クローズの件数が同じ関数から出る)、信頼度が全由来で 0〜100 の整数か提案なしのときだけ null、O4 (プレビューの明細と件数 = 適用後に変わった明細、手動変更は不変、分割ルールの行の和 = 元の金額) を固定する。API 統合テストで O3 (3 件中 1 件が検証エラーの一括保存が 2 件を保存して明細ごとの結果を返す、未認証 401、フェンス違反の拒否、上限超過 400) と O5 (保存フィルタの作成・一覧・削除、各変更経路で履歴が 1 件ずつ残る) を確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-classify-backend-web-003 | 分類ステータスの判定と件数集計を core の純関数 1 か所に置き、バッジと月次クローズもそこから導く | 画面・バッジ・月次クローズで個別に数える | 3 か所の件数が構造的にずれない | `classificationProgress` と `buildReviewQueue` の classification 判定を付け替える |
| qa-classify-decision-005 | 未整理・手動変更・完了の 3 区分を排他にし、要確認は未整理の内訳にする | 要確認を独立の区分にする | どこにも入らない明細・二重に数える明細が出ず、和が全件に一致する | KPI は 4 枚でも区分は 3 つで、要確認のカードは未整理のうちの件数になる |
| qa-classify-decision-006 | 提案どおりの確定は完了、異なる確定は手動変更とし、確定時の一致を手当てに記録する | 確定のたびに現在の提案と比べ直す | 後から提案が変わっても区分が揺れない | 記録の無い既存の手入力は手動変更として扱う |
| appr-foundation-classify-003 | vendor_memory が取込時に materialize した手当ては完了とする | 手動変更とする | 承認済みの取引先メモリによる自動決定であり、ルール・MF 中項目と同じ完了側で一貫する | `matched_proposal=NULL` でも `done`。要確認には数えない |
| dec-classify-confidence-source | `recommendationFor` を全由来の決定論の信頼度へ拡張し、外部送信しない | 外部 LLM で推論 | 再現性があり費用ゼロで、『取込データは外部送信しません』と一致する | 規則に無い取引は提案が出ず未整理に残る |
| qa-classify-backend-web-003 | ルールのプレビューと適用を同じ core 関数で行う | プレビュー用と適用用に別の判定を書く | O4 の一致を単体テストで確かめられる | 適用はプレビューと同じ入力 (期間の明細) を読む |
| qa-classify-backend-web-002 | 一括保存は部分失敗でも 200 で明細ごとの結果を返す (agent 推定・利用者未確認) | 1 件でも失敗したら全体を 4xx にする | 成功分を取り消さない (G3) 契約と一致する | 画面は結果の配列から失敗分だけを再送する |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) と packages/core のビルド。
- Migration sequence: 追加 migration の反映 (`architecture/classify-database.md`) → core の分類ステータス判定と `recommendationFor` の拡張 → `classificationProgress`・`buildReviewQueue`・月次クローズの付け替え → `GET /transactions` の拡張 → 確定時の一致の記録と履歴の追記を既存の変更経路へ → 一括保存 → ルールのプレビューと適用 → 保存フィルタと履歴の経路 → 旧 `classificationProgress` の削除。
- Rollback trigger/procedure: core / API テストが落ちたら差し戻し。集計値を保存しないため、件数のデータの巻き戻しは不要。書込済みの手当て・履歴は追加列・追加表にあり、直前版の Worker はそれを読まないので Worker を戻すだけで足りる。

## Risks and verification

- Risk/assumption: 現行のナビのバッジは `/review-queue` の保留を除いた items の classification 件数、月次クローズの『仕分け』は保留を含む items の件数で、どちらも期間に依存しない (`all`)。system-spec はバッジを『未整理の件数』、月次クローズを『未整理から照合側で数える明細を除いた件数』と定めており、照合待ちと保留の扱い・期間の範囲が現行と変わりうる。どの集合に同じ関数を当てるかは `specs/spec-classify-screen.md` で固定し、テストで件数を突き合わせる。
- Resolved decision: vendor_memory の当て直しで作られた手当て (`tx_edits.origin = 'vendor_memory'`) は、`matched_proposal` が NULL でも完了に入れ、要確認には数えない。提案が無い (信頼度 null の) 未整理は引き続き要確認に数えない。両方を core の単体テストで固定する。
- Risk/assumption: vendor_memory の当て直し (`POST /api/vendor-memory/:key/reapply`) は system-spec の変更経路の列挙 (手動・一括・ルール・分割・削除と取消) に無いが手当てを書き換える。履歴を残すかを仕様で決める。
- Architecture fitness test: api ハンドラと web に区分・信頼度・ルール該当の判定が無いこと。core が D1 / Hono の型を参照しないこと。`classificationProgress` の参照が残らないこと。
- Load/failure/security validation: 一括保存 100 件とルール適用が Worker の CPU 時間内に収まること。上限超過が 400 を返すこと。
