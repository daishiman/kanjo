---
graph_node_id: "spec-overview-screen"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "FINAL-UI 02 概況画面 月次クローズ起点化 仕様"
project_id: "kanjo"
domain: "overview-screen"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen"]
file_path: "specs/spec-overview-screen.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "b59f1176e7a0d23474e8d9f4ea1b067eaf9c94d6eaaf0906c48de0de5fc33181"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "b59f1176e7a0d23474e8d9f4ea1b067eaf9c94d6eaaf0906c48de0de5fc33181", "imported_at": "2026-09-14T13:09:32Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-14T13:09:32Z"
depends_on: []
related_nodes: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-backend", "arch-overview-database", "arch-overview-auth", "arch-overview-security", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/02-overview.png", "packages/core/src", "packages/api/src", "packages/web/src", "packages/web/scripts", "migrations", "docs"]
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
classification_reason: "system-spec の要件定義書 (U1-U9) を実装計画の入口として参照する単一の specification。新規 API (GET /api/overview、GET /api/review-queue、保留と月次レビューの PUT/DELETE) を追加するため api_changed と判定し、api-contract overlay の 11 節を API契約節の下に合成した。artifact_subtypes は API 変更ありの既存 spec の前例に合わせて api とした。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-overview-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# FINAL-UI 02 概況画面 月次クローズ起点化 仕様

本書は `system-spec/00-requirements-definition.md` (承認 `appr-foundation-overview-001` / `appr-foundation-overview-002`、system-spec-harness 0.1.14) を dev-graph の specification として参照する入口である。規範本文は system-spec 側が正本で、ここでは実装計画が必要とする節だけを要約する。領域別の制約は architecture ノード (arch-overview-ui-ux, arch-overview-frontend, arch-overview-backend, arch-overview-database, arch-overview-auth, arch-overview-security, arch-overview-infrastructure, arch-overview-maintenance-ops) に分ける。見た目の正本は [`design/FINAL-UI/images/02-overview.png`](../design/FINAL-UI/images/02-overview.png)、表示順の正本は [`system-spec/ui-ux.md#表示順の正本`](../system-spec/ui-ux.md#表示順の正本) とする。

## 目的と成功状態

概況を「数字を眺める分析画面」から月次クローズの作業起点に変える (U1)。開いた瞬間に直近 12 か月の収支の結論と「次に直すこと」が分かり、未処理 0 まで概況から迷わず進める状態にする。現行の概況は GET /api/summary から core の overview() を呼び、事業だけを表示している (U2)。

ゴール:
- G1: 総合 (事業+家計、重複除外) / 事業 / 家計 の総収入・総支出・純収支と前 12 か月比を最上位に出す。KPI・推移・年次比較・内訳は単一の定義で互いに検算が一致する。
- G2: 仕分け確認・照合確認・取込確認を 1 つの未処理キューに集約する。件数 (バッジ・カード・アクションバー) の一致、優先順位、根拠種別付きの推奨科目と信頼度、右パネル、該当画面への 1 操作遷移を持つ。
- G3: 月次クローズ 4 ステップをデータから判定する。「月次レビュー完了」と「後で確認」は D1 に保存し、バックアップと復元でも保つ。
- G4: 02 のレイアウトを共通シェル・トークン・部品で実装する。既存の防衛予測・移動平均・パレート・未決済・科目別年比較は段階的開示で残す。
- G5: 読込・空・エラー状態、WCAG 2.2 AA、レスポンシブ (右パネルのドロワー化)、外部送信なし・認証必須を維持する。

計測可能な目標 (O):
- O1 (G1): 同一 fixture で KPI・推移・年次比較・内訳の 4 要素の総額差が 0 (core 単体テスト)。
- O2 (G2): バッジ・カード・アクションバーの 3 か所で未処理件数が一致する。DOM テストで一致を確かめ、「後で確認」で 3 か所が同時に減り、期間を 1年→3年に変えても件数は変わらない。core 単体テストで、内容指紋が変わった明細が再び未処理に数えられる。
- O3 (G3): 「後で確認」と月次レビューが、バックアップ→全消去→復元の往復で保たれる (API テスト)。
- O4 (G4, G5): 画像正本の表示順と広幅レイアウトを保ち、`packages/web/scripts/check-financial-visuals.mjs` の Overview を 8 幅で描画して exit 0。
- O5 (G2): 推奨科目の信頼度が決定論で決まり、根拠が無ければ推奨を出さない。

成功状態:
- S1 (G1-G5): O1-O5 の検査が CI で緑。
- S2 (G4): 02 の全要素が実データで描画される。

## スコープ

- In:
  - `packages/web/src/pages/Overview.tsx` の作り替え
  - 概況用 API (概況集計と未処理キュー、保留と月次レビューの書込)
  - core 集計 (直近 12 か月 vs 前 12 か月、支出内訳の上位 5 + その他、未処理キュー、推奨の信頼度、月次クローズ判定)
  - D1 migration (保留 review_snoozes と月次レビュー monthly_close_reviews)
  - サイドバーの未処理バッジ
  - 新テーブルのバックアップ・復元対象への追加
- Out:
  - 専用アプリ (スマートフォン・タブレット・デスクトップ)
  - AI/LLM による推定
  - 分類アルゴリズムの変更
  - 概況以外の 19 画面の作り替え

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 概況 | ルート `/` の画面。月次クローズの作業起点 |
| 集計範囲 | 総合 (事業+家計、重複除外) / 事業 / 家計。既定は総合 |
| 4 要素 | KPI・推移・年次比較・支出内訳。同じ月別系列から作る |
| 未処理キュー | 仕分け確認・照合確認・取込確認を 1 列に並べたもの |
| 後で確認 (保留) | 未処理の明細を一時的に件数から外す操作。内容指紋と一緒に D1 に保存する |
| 内容指紋 | 明細の金額・日付・内容から作る値。変われば保留を無効にする |
| 月次レビュー | 利用者が月ごとに記録する完了の印。D1 に保存する |
| 月次クローズ n/4 | データ取込・仕分け・照合・月次レビューの 4 ステップの完了数 |
| SH1 利用者 | 単独の個人事業主 1 名 (唯一の利用者・保守者) |
| SH2 保守エージェント | 規約に従って実装・保守するコーディングエージェント |

## ユースケースとユーザーフロー

1. 月初に概況を開く (1280px 以上を主とする)。最上位で総合の総収入・総支出・純収支と前 12 か月比、説明カード、月次クローズ n/4 を読む。
2. 範囲切替で事業・家計へ切り替えると、KPI・推移・年次比較・内訳の 4 要素が同じ範囲で描き直される。KPI 直後の推移で月ごとの変化を確かめる。未処理キューは切替の影響を受けない。
3. 推移の下にある未処理カード 3 種 (仕分け・照合・取込) と優先明細表で、次に直す明細を上から順に確認する。明細を選ぶと右パネル (1280px 未満ではドロワー) に推奨科目・根拠種別・信頼度が出る。
4. 右パネルから該当画面へ 1 操作で遷移して処理する。すぐ処理しない明細は「後で確認」にし、サイドバーのバッジ・カード・固定アクションバーの件数が同時に減る。
5. 4 ステップのうち残りが月次レビューだけになったら、月次レビュー完了を記録して n/4 を 4/4 にする。
6. 防衛予測が注意・警告水準のときだけ、KPI の上に警告が出る。未決済と科目別年比較は「詳しく見る」を開いて確認する。

## 機能要件

- `FR-001` (O1): 概況集計を core の純関数で行い、選択範囲 (総合/事業/家計) の月別系列から KPI (総収入・総支出・純収支と前 12 か月比)・推移・年次比較・支出内訳 (上位 5 + その他) を作る。総合は totalCashflowReport の月別値、事業は freee、家計は MF 家計側を使う。 判定: 同一 fixture で 4 要素の総額差が 0 になる core 単体テストが通る。
- `FR-002` (O2): 仕分け確認 (classificationProgress の reviewPending、clsSrc=既定)・照合確認 (totalCashflowReport の review)・取込確認 (import_runs.status=failed) を全期間で数え、1 つの未処理キューへ集約する。順は照合→仕分け→取込、同種別内は金額の絶対値の降順、同額は日付の新しい順。 判定: DOM テストでバッジ・カード・アクションバーの件数が一致し、期間 1年→3年で不変。優先明細表の表示だけが期間で絞れる。
- `FR-003` (O2, O3): 「後で確認」を内容指紋 (金額・日付・内容) と共に D1 に保存し、件数から除く。指紋が一致しなくなったら保留を無効にし、利用者の解除でも消える。月境界で自動解除しない。 判定: core 単体テストで指紋変更時に再び未処理に数えられ、DOM テストで保留操作により 3 か所の件数が同時に減る。
- `FR-004` (O3): 月次クローズ 4 ステップをデータから判定する。データ取込 (committed かつ未記録月でない)・仕分け 0・照合 0・月次レビュー行あり。保留中の明細は件数からは除くがステップ判定では未完了とする。月次レビューは D1 に保存する。 判定: core 単体テストで 4 ステップの判定表が通り、API テストでバックアップ→全消去→復元の往復後も保留と月次レビューが残る。
- `FR-005` (O5): 推奨科目の信頼度を 4 段で決める。(1) vendor_memory の一致率を百分率 (四捨五入) と「過去 N 件中 M 件」で示す、(2) ルール一致 (百分率なし)、(3) MF中項目が「事業」で始まれば事業区分のみ、(4) 推奨なし。乱数・時刻・外部送信を使わない。 判定: core 単体テストで同じ入力から同じ出力になり、根拠が無い明細は推奨なしになる。
- `FR-006` (O4): 02 のレイアウトを共通シェル・design-tokens・共通部品で、[表示順の正本](../system-spec/ui-ux.md#表示順の正本)どおりに描画する。防衛予測は defenseForecast.level が caution/warn のときだけ KPI の上に role=alert で出し、none/nodata では描かない。移動平均は推移グラフの切替、パレートは支出内訳の構成比表示に置き、未決済と科目別年比較だけを「詳しく見る」(details 要素、初期は閉じる) に入れる。 判定: check-financial-visuals.mjs の Overview が表示順と広幅グリッドを観測し、VIEWPORT_CASES の 8 幅で exit 0。
- `FR-007` (O2): サイドバーの概況項目に未処理件数バッジを付け、バッジ・右パネル・固定アクションバーを components/ の共通部品として置く。 判定: DOM テストでバッジが未処理キュー API と同じ件数を示し、ロック中は取得しない。

## 非機能要件

- Performance: 初期 JS 110KiB 予算 (check-initial-js-budget.mjs) を超えない。React Query は既存設定 (retry 1、staleTime 30s) に合わせる。
- Availability/Reliability: Worker kanjo-console と D1 kanjo-db の既存構成で配信する。EXPECTED_D1_MIGRATION を migration と同時に更新し、runtimeSchemaGuard の 503 を起こさない。
- Accessibility/Usability: WCAG 2.2 AA。件数の変化は role=status (4.1.3)、防衛予測の警告は role=alert、320px で横スクロールを出さない (1.4.10 Reflow)。ドロワーは APG モーダルダイアログ、「詳しく見る」は APG disclosure に従う。
- Security/Privacy: 外部送信なし (CSP connect-src 'self' を維持)。新テーブルに明細本文の写しを持たない。fixture は匿名・架空とする (security:content)。
- Maintainability/Operability: web は応答型だけを知り再計算しない。検査は core / DOM / API / 描画の 4 系統に置き、件数ずれの切り分け手順を docs に残す。

## UI・状態遷移

- 画面/CLI/API状態: 物理順は[表示順の正本](../system-spec/ui-ux.md#表示順の正本)に一本化する。過去文書の第 1〜4 層は情報の重要度分類で、DOM 順を意味しない。1280px 以上は未処理の内訳・優先明細・選択中明細を 3 列、前年比較・支出内訳を 2 列にし、未満は意味順を保って 1 列化して選択中明細を dialog ドロワーにする。
- 遷移条件: 範囲切替 (総合/事業/家計) は 4 要素だけを描き直す。期間切替 (usePeriod) は 4 要素と優先明細表の表示を変えるが件数は変えない。「後で確認」と解除、月次レビューの記録と取消は未処理キューのクエリ ['review-queue'] を invalidate し、3 か所の件数を同時に更新する。右パネルの遷移ボタンは該当画面へ 1 操作で移る。
- Loading/Empty/Error: 読込中は骨格表示、データ未取込は空状態の案内、API 失敗は領域ごとのエラー表示と再試行を出す。未処理 0 件は「未処理なし」を role=status で示す。

## ビジネスルールと検証

- `BR-001`: 4 要素は選択範囲の同じ月別系列から作り、画面側で再計算しない (G1, O1)。
- `BR-002`: 未処理件数は全期間で数え、期間に依存しない。優先明細表の表示だけが期間で絞れる (G2, O2)。
- `BR-003`: 範囲切替は 4 要素に効き、未処理キューには効かない (dec-overview-aggregation-scope)。
- `BR-004`: 保留は内容指紋が一致する間だけ有効で、月境界で自動解除しない (G3)。
- `BR-005`: 保留中の明細は件数から除くが、月次クローズのステップ判定では未完了とする (G3)。
- `BR-006`: 信頼度の根拠は vendor_memory → ルール → MF中項目 → 推奨なしの順で決め、同じ入力には同じ出力を返す (O5, dec-recommendation-confidence-source)。
- `BR-007`: 入力検証は kind (classification / reconciliation / import)、itemKey (長さ上限)、month (YYYY-MM) を core とルートの双方で行い、違反は 400 とする。

## API契約

API 変更あり。新規に概況集計・未処理キュー・保留・月次レビューの API を /api/* 配下へ追加する。既存 GET /api/summary は本仕様では変更しない。パスの細部・クエリ名・エラー形は実装方針の提案 (推定・plan で確定) であり、確定しているのは GET /api/overview、GET /api/review-queue、保留と月次レビューの PUT/DELETE を持つことである。

### API: 概況集計・未処理キュー・保留・月次レビュー

#### 識別と目的

- GET /api/overview: 選択範囲の KPI・推移・年次比較・支出内訳・月次クローズ状態・データ更新時刻を返す (G1, G3)。
- GET /api/review-queue: 全期間の未処理キュー (件数、種別別件数、優先順の明細、推奨と信頼度) を返す (G2)。
- PUT/DELETE /api/review-queue/snoozes/:kind/:itemKey: 「後で確認」の設定と解除 (推定・plan で確定)。
- PUT/DELETE /api/monthly-close/:month/review: 月次レビューの記録と取消 (推定・plan で確定)。

#### 認証・認可

既存の authGuard (index.ts で /api/* に掛かる) の下に置き、mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の順を通す。認証方式・セッションは変えない。月次レビューの reviewed_by_user_id には actor の user id を入れる。

#### Request

- GET /api/overview: クエリ scope = total / business / household (推定・plan で確定、既定 total) と既存の期間指定。
- GET /api/review-queue: 期間を受け取らない (件数が期間に依存しないため)。
- PUT snooze: パスの kind と itemKey。内容指紋はサーバが明細から計算し、クライアントは送らない (推定・plan で確定)。
- PUT/DELETE monthly-close review: パスの month (YYYY-MM)。

#### Response

- OverviewResponse (推定・plan で確定): kpi / trend / yearComparison / breakdown / closeStatus / dataUpdatedAt と、表示用の defenseForecast (level)。
- ReviewQueueResponse: 合計件数、種別別件数、優先順の明細 (種別・itemKey・金額・日付・内容・推奨科目・根拠種別・信頼度)。
- PUT/DELETE は成功時に 204 または更新後の状態を返す (推定・plan で確定)。

#### Validation・ビジネスルール

kind は classification / reconciliation / import のいずれか、itemKey は長さ上限内、month は YYYY-MM、scope は 3 値のいずれか。違反は 400。BR-001 から BR-007 を満たす。

#### Error contract

- 400: 入力検証違反。401: 未認証 (authGuard)。409 canonical_write_busy: 正準書込の衝突 (CANONICAL_MUTATION_ROUTES)。503: スキーマ版の不一致 (runtimeSchemaGuard)。
- 本文の形は {error:{code,message}} を提案する (推定・plan で確定)。

#### 実行セマンティクス

GET は読み取りのみで副作用なし。PUT は冪等 (同じ保留・同じ月次レビューを重ねても結果が同じ)、DELETE も対象が無ければ成功扱いの冪等とする。書込は CANONICAL_MUTATION_ROUTES に登録して直列化する。

#### キャッシュ・ページング

HTTP キャッシュは使わない。web は React Query で保持し、未処理キューのキーは ['review-queue'] (期間を含めない)、書込後に invalidate する。ページングは N/A: 単一利用者の未処理件数は全件を 1 応答で返せる規模であり、表示の絞り込みは画面側で行う。

#### 可観測性と監査

既存 Worker のログに乗る範囲に留め、新規の計測基盤は追加しない。月次レビューは reviewed_at と reviewed_by_user_id を記録として残す。

#### セキュリティ確認

外部送信なし (CSP connect-src 'self')。明細はテキストとして描画する。新テーブルに明細本文の写しを持たない。認証なしで到達できないことを既存の authGuard テストの対象に含める。

#### Contract tests

API テストで (1) 概況と未処理キューの応答形、(2) 入力検証の 400、(3) PUT の冪等、(4) バックアップ→全消去→復元の往復で保留と月次レビューが残ること (O3)、(5) 未認証の 401 を確かめる。

## データモデル

- Entity/Value: review_snoozes (「後で確認」の保留)、monthly_close_reviews (月次レビュー)。集計値は保存しない。
- Fields/Types/Nullability: review_snoozes は user_id、item_kind、item_key、内容指紋、snoozed_at。monthly_close_reviews は user_id、month、reviewed_at、reviewed_by_user_id (列名は推定・plan で確定)。
- Relations/Constraints/Indexes: review_snoozes の主キー (user_id, item_kind, item_key)、monthly_close_reviews の主キー (user_id, month) を提案する (推定・plan で確定)。item_kind と month は CHECK で制約する。
- Ownership/Retention/Migration: migration 0040 で CREATE TABLE/INDEX のみを追加する (前進のみ)。user_id は 'default'。EXPECTED_D1_MIGRATION・schema.ts・BACKUP_SNAPSHOT_SQL と loadBackupPayload・POST /api/restore・CANONICAL_MUTATION_ROUTES を同時に揃える。夜間バックアップ (30 日保持) の対象に含める。

## 認証・認可

- Authentication: 既存の authGuard とセッションを変えない。新 API は /api/* 配下に置くだけで保護される。
- Authorization: 単一利用者のため役割による区別は無い。パスワード変更必須の状態では mustChangePasswordFence が止め、web はロック中にバッジを取得しない (enabled: !locked)。
- Tenant/data boundary: N/A: 単一利用者 (user_id 'default') で境界を変えない。

## エラー・例外・回復

- Error taxonomy: 400 入力検証、401 未認証、409 canonical_write_busy、503 スキーマ版不一致、500 想定外。画面は領域ごとのエラー表示に落とし、他の領域の描画を止めない。
- Retry/Timeout/Fallback: React Query の retry 1 と再試行ボタン。409 は利用者の再操作で回復する。
- Idempotency/Concurrency: PUT/DELETE は冪等。書込は canonicalMutationFence で直列化する。内容指紋の不一致は保留の無効化として扱い、エラーにしない。

## イベント・非同期処理

- Producer/Consumer: N/A: 新しい非同期処理を追加しない。既存の cron (nightlyBackup) が新テーブルをバックアップ対象として読むだけである。
- Delivery/Ordering/Deduplication/DLQ: N/A: 同上。

## 可観測性

- Logs/Metrics/Traces/Audit: 既存の Worker ログの範囲に留める。月次レビューの記録時刻と記録者を監査情報として保存する。
- Alert/SLO dashboard: N/A: 単一利用者の個人運用で SLO を持たない。検証は CI の 4 系統と deploy 後の smoke に置く。

## 互換性・移行・リリース

- Compatibility/versioning: GET /api/summary は変更せず、新 API は追加のみとする。
- Migration/backfill: migration 0040 は CREATE のみで、既存データのバックフィルは不要。deploy.yml の plan-auto-migration.mjs が DROP/RENAME を blocked にする前提に従う。
- Rollout/rollback: 単一の PR で配信する。D1 に rollback は無いため、問題時は Worker を直前のビルドへ戻し、新テーブルは残したまま無害に置く。

## テストと受入条件

- [ ] `AC-001`: O1 (G1): 同一 fixture で KPI・推移・年次比較・支出内訳の総額差が 0 である (core 単体テスト、FR-001)。
- [ ] `AC-002`: O2 (G2): バッジ・カード・アクションバーの件数が一致し、「後で確認」で同時に減り、期間 1年→3年で不変である (DOM テスト、FR-002、FR-007)。
- [ ] `AC-003`: O2 (G2): 内容指紋が変わった明細が再び未処理に数えられる (core 単体テスト、FR-003)。
- [ ] `AC-004`: O3 (G3): 保留と月次レビューがバックアップ→全消去→復元の往復で保たれ、月次クローズ 4 ステップが判定表どおりになる (API テストと core 単体テスト、FR-004)。
- [ ] `AC-005`: O4 (G4, G5): check-financial-visuals.mjs が画像正本の表示順、広幅の Review 3列・比較/内訳2列、横はみ出しなしを観測し、Overview を 8 幅で描画して exit 0 になる (FR-006)。
- [ ] `AC-006`: O5 (G2): 同じ入力から同じ信頼度が出て、根拠が無い明細は推奨なしになる (core 単体テスト、FR-005)。
- [ ] `AC-007`: S1 (G1-G5): 上記の検査と既存の pnpm test / typecheck / lint、check-initial-js-budget、index.test の CSP 差分検査が CI で緑である。
- Contract/integration/e2e/security/performance: core 単体 (O1、O2 の指紋、O5)、DOM (O2)、API (O3 と入力検証・冪等・401)、描画 (O4)、初期 JS 予算、CSP 差分検査。

## 未決事項

- `low-u4-measure-numbering`: U4 の measure と C/SH 番号の具体化が利用者確認を経ていない。
- `low-reference-recheck`: w3c-csp3 と whatwg-web-storage は plan 着手時に再照合する。

## 確定意思決定

- `dec-overview-aggregation-scope`: 概況の集計範囲をどうするか 採択『総合を既定に事業/家計へ切り替える (total-with-toggle)』 (他案: 総合のみで切替なし total-only / 現行どおり事業のみ business-only)。理由: G1 の 3 範囲を満たすのはこの案だけである。切替は 4 要素に効き、未処理キューには効かない。
- `dec-overview-legacy-elements`: 既存の防衛予測・移動平均・パレート・未決済・科目別年比較をどう残すか 採択『畳んで残す (fold-and-keep)』 (他案: 画像どおりに削り他画面への導線だけ残す remove / 既存要素も常時表示する show-all)。防衛予測は警告時だけ KPI の上、移動平均は推移の切替、パレートは支出内訳の構成比、未決済と科目別年比較は「詳しく見る」に置く。理由: U1 の結論先行と G4 の既存機能の維持を両立するのは段階的開示だけで、削る案は必須機能を、常時表示は結論の見つけやすさと狭幅の読みやすさを失う。
- `dec-recommendation-confidence-source`: 推奨科目の信頼度の出どころ 採択『既存の分類資産を統合する (integrate-existing)』 (他案: vendor_memory がある明細だけ推奨する vendor-memory-only / Workers AI の LLM で推定する ai-estimate)。vendor_memory 一致率 → ルール → MF中項目 → 推奨なしの順。理由: O5 の決定論と C2 (外部送信なし) を満たすのは既存根拠を使う 2 案だけで、そのうち本案は既存のルールと MF中項目も根拠に使うので推奨が出る明細が多い。
- `dec-review-state-storage`: 「後で確認」と月次レビューの保存先 採択『D1 (review_snoozes と monthly_close_reviews、夜間バックアップと復元の対象)』 (他案: ブラウザの localStorage に保存する browser / 保存しない none)。理由: G3 がバックアップ・復元での保持を要求し、ブラウザ保存と保存しない案は満たせない。追加費用は 0。
