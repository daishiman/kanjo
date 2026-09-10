---
graph_node_id: spec-total-cashflow-system
artifact_kind: specification
artifact_subtypes: []
title: 事業・家計トータル収支システム 仕様 (system-spec 由来)
project_id: kanjo
domain: total-cashflow
status: active
priority: high
start_date: null
target_date: null
iteration: null
owners: [daishiman]
tags: [system-spec, total-cashflow, requirements]
file_path: specs/spec-total-cashflow-system.md
template_id: specification
template_version: 1.0.0
confirmation_status: confirmed
evaluation_status: pass
confirmation_evidence:
  evaluator: system-spec-harness:assign-system-spec-completeness-evaluator
  evidence_ref: system-spec/completeness-findings.json
  evaluated_digest: c2f74fde67952fa7a0a0e96317d79198d176db7e4a94eb73f33716848258c1f8
source_lineage:
  origin_kind: system-spec-harness
  source_plugin: system-spec-harness
  source_path: system-spec/index.md
  source_version: 0.1.12
  source_digest: c2f74fde67952fa7a0a0e96317d79198d176db7e4a94eb73f33716848258c1f8
  imported_at: 2026-09-08T07:32:48Z
created_at: 2026-09-08T07:32:48Z
updated_at: 2026-09-08T07:32:48Z
depends_on: []
related_nodes: []
resource_scope:
  - system-spec/00-requirements-definition.md
  - system-spec/ui-ux.md
  - system-spec/index.md
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 0.96
classification_reason: 要件定義書 (U1-U9・G1-G7) と ui-ux 章は specification テンプレートの必須節へ直接対応する
classification_candidates:
  - {artifact_kind: specification, confidence: 0.96, candidate_path: specs/spec-total-cashflow-system.md}
  - {artifact_kind: architecture, confidence: 0.11, candidate_path: architecture/spec-total-cashflow-system.md}
tracker_binding: none
beads_linkage: null
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence:
  policy: manual
  status: not_applicable
  source: null
  completed_at: null
  reconciled_at: null
  evidence_refs: []
implementation_readiness:
  status: complete
  missing_sections: []
  checked_at: 2026-09-08T07:32:48Z
---

# 目的と成功状態

本ノードは system-spec-harness が確定させた仕様の dev-graph 側 projection である。本文は正本を複製せず lineage 参照で辿る (MM-12)。正本は `system-spec/00-requirements-definition.md` (上位概念 U1-U9 の憲法)、`system-spec/ui-ux.md` (画面と情報優先度)、`system-spec/index.md` (章と集約状態の相互参照) の3点で、`source_digest` が指す内容と一致する限り本ノードの記述は有効である。

成功状態は正本 U3 のゴール G1-G7 で定義される。要約すると、freee (事業帳簿) と Money Forward (家計) に分かれた収入・支出を明細単位で二重計上を消し込んだうえで1つの一覧表へ束ね、月ごとのトータル収入・支出・収支と費用の推移を、消し込んだ根拠ごと確認できる状態である。

## スコープ

- In: 正本 `system-spec/index.md` が集約状態「確定」として列挙する8カテゴリ (database / auth / ui-ux / security / infrastructure / backend / frontend / maintenance-ops) の web プラットフォーム向け仕様。
- Out: mobile / tablet / desktop-windows / desktop-linux / desktop-macos の5プラットフォーム。承認 `appr-target-platforms-007` (2026-09-05T10:05:09Z 実測) により 5 platform × 8 カテゴリ = 40 セルを対象外として確定済み。

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 利用者 | 個人事業主。事業と家計が一体になった実態を1つの一覧表で確認する主体 |
| freee | 事業帳簿の取込元。同額・同発生日の重複において常に正 (計上の勝ち側) |
| Money Forward | 家計の取込元。freee と重なる支出は家計費から外す側 |
| MfTx | MF 明細。金額の符号で収入・支出を区別し、`idStable` で再取込をまたいで同定する |
| FreeeDeal | freee 取引。突合キーは発生日 `date` であり `dueDate` / `settledDate` は用いない |
| TotalCashflowMonth | 月次トータル収支の読み取りモデル。テーブルを持たず要求時に導出する |
| DuplicateVerdict | 要確認明細への利用者判断 (同じ / 違う)。唯一永続化される本機能固有の状態 |

## ユースケースとユーザーフロー

1. 利用者が期間を選び、月ごとのトータル収入・トータル支出・トータル収支と、事業費・家計費の内訳を1つの一覧表で読む。
2. 自動で事業費へ寄せられなかった重複候補 (金額一致・発生日ズレ) を要確認一覧で読み、理由を確認する。
3. 利用者が要確認明細へ「同じ」または「違う」を判断する。「同じ」は当該 MF 明細を家計側から外して事業側へ寄せ、合計を動かす。
4. 次回以降の取込で同じ明細に同じ判断が再適用され、利用者は同じ判断を繰り返さない。
5. 利用者がトータル支出の推移 (増加 / 減少 / 横ばい / 判定不可) を読み、費用が増えているのかを確認する。

## 機能要件

正本の受入条件 O1-O6 を機能要件として引く。各項の測り方の逐語は `system-spec/backend.md` および `system-spec/database.md` の「受入条件 (Delta の判定点)」表にある。

- `FR-001` (O1): 月次のトータル収支行を導出する読み取りモデルを core に持ち、全月で 総支出 = 事業費 + 家計費 および 総収入 = 事業収入 + 家計収入 が成立する。
- `FR-002` (O2): 支出帰属規則を単一実装として持つ。同じ (金額, 発生日) に MF が n 件・freee が m 件あるとき MF から min(n,m) 件を事業費へ寄せる。支払先は判定に用いない。
- `FR-003` (O3): 収入は MF の事業・副業区分で帰属を決め、freee 売上と同額・同発生日で重なる分を総収入へ二度加算しない。
- `FR-004` (O4): 要確認明細への判断を永続化し、再取込後も同じ明細へ再適用する。
- `FR-005` (O5): トータル支出のトレンド判定を既存 `packages/core/src/trend.ts` と同じ基準 (Mann-Kendall 検定 + Theil-Sen 傾き推定) で行う。
- `FR-006` (O6): 一覧表を web 画面へ出し、判断の入口を既存の取込明細編集画面に置く。9列すべてを常時表示する。

## 非機能要件

- Performance: 集計は要求時に canonical から毎回導出する (`dec-aggregation-strategy-001`)。事前計算テーブルを持たないため、応答時間の上限は D1 の取得コストと core の純関数計算に支配される。制約値は `system-spec/database.md` が引く Cloudflare D1 の公式上限に従う。
- Availability/Reliability: Cloudflare Workers + D1 の可用性に従属する。本機能は独自の冗長化を持たない。障害時は一覧表を出さず、部分的な合計を表示しない。
- Accessibility/Usability: 9列常時表示と、取込完了時に要確認が残っている場合の画面警告を承認済み要件として持つ (`appr-foundation-total-cashflow-005`)。詳細は `system-spec/ui-ux.md`。
- Security/Privacy: 追加する読み取り API と DuplicateVerdict 更新 API は既存の `/api` 認証ゲートの内側に置く (`dec-auth-boundary-001`)。`wrangler.jsonc` の `run_worker_first` が `/api/*` を指すため迂回経路は生じない。
- Maintainability/Operability: 集計ロジックは `packages/core` の純関数として置き、Hono の route は入出力変換のみを担う。統計判定の定数 (TREND_MIN_MONTHS = 6, TREND_ALPHA = 0.05) は既存実装と共有し、本機能側で作り直さない。

## UI・状態遷移

- 画面状態: 一覧表は 読込中 / 表示 / 空 (対象期間に明細なし) / エラー の4状態を取る。要確認一覧は 候補あり / 候補なし の2状態を取る。
- 遷移条件: 期間切替は再導出を起こし、同じ導出関数を通すため期間ごとに矛盾した数字を出さない (G7)。要確認への「同じ」判断は一覧表の数字を更新する遷移を伴い、「違う」判断は帰属を変えず当該組を次回以降の要確認から外す。
- Loading/Empty/Error: 読込中は合計行を含む部分的な数字を表示しない。空は0件であることを明示し、合計0と区別可能にする。詳細は `system-spec/ui-ux.md`。

## ビジネスルールと検証

- `BR-001`: 支出の自動帰属判定は完全一致 (金額一致 かつ MF 日付 = freee 発生日) の1本のみとする。日付近傍 (発生日 ±3日) の照合は要確認候補の抽出にのみ用い、自動付替を1件も行わない。
- `BR-002`: 帰属を動かす権限を持つのは自動判定と利用者判断のみ。利用者の「同じ」判断は自動規則を上書きするが、freee 側1取引に対し MF は1件までしか寄せない (1対1 保存)。
- `BR-003`: 収入側も支出と対称に扱う。「同じ」判断は家計収入から外して事業収入へ寄せ、判断の前後いずれでも 総収入 = 事業収入 + 家計収入 が成立する。
- `BR-004`: 既知の限界として、支払先を判定に用いないため偶然に同額・同発生日となった無関係な支出も事業費として扱われうる。利用者はこれを承知のうえで規則の単純さと予測可能性を優先すると判断した (`qa-duplicate-rule-001`)。

## API契約

既存の Hono + `@hono/zod-validator` による `/api` 配下の REST を踏襲し、読み取り1本 (月次トータル収支と要確認一覧を1応答で返す) と DuplicateVerdict の upsert 1本を追加する。月次行と内訳を別呼び出しに分けないのは、呼び出し間で期間がずれると内訳の和が合計に一致しない画面を作れてしまうためである。レスポンス形状は zod スキーマで契約化する。endpoint 単位の逐語契約は本機能の実装 task 側で `api-contract.md` を合成して確定する。

## データモデル

- Entity/Value: 集約ルートは既存の Dataset。本機能が追加する読み取りモデルは TotalCashflowMonth、永続化するのは DuplicateVerdict のみ。
- Fields/Types/Nullability: TotalCashflowMonth は month / totalIncome / totalExpense / totalBalance / bizExpense / householdExpense / reassignedCount / reassignedAmount / reviewCount を持つ。DuplicateVerdict は MF 明細の安定識別子 / verdict (同じ または 違う) / 根拠 / 判断日時を持つ。
- Relations/Constraints/Indexes: MfTx と FreeeDeal を (金額, MF 日付 = FreeeDeal.date) の完全一致で突合する。DuplicateVerdict は MF 明細の安定識別子で一意。
- Ownership/Retention/Migration: TotalCashflowMonth はテーブルを持たず毎回導出するため保持もマイグレーションも発生しない。DuplicateVerdict のスキーマ変更は `migrations/` の連番 SQL への追記方式に従う (`system-spec/database.md`)。

## 認証・認可

- Authentication: 既存の `/api` 認証ゲートを用いる。本機能専用の認証経路を設けない (`dec-auth-boundary-001`)。
- Authorization: 単一利用者の個人利用を前提とし、ロールによる権限分割を持たない。
- Tenant/data boundary: テナント分割を持たない。データ境界は Cloudflare アカウント内の D1 データベース1つに閉じる。

## エラー・例外・回復

- Error taxonomy: 認証失敗は既存ゲートの応答に従う。入力検証失敗は zod スキーマの検証エラーとして 400 系で返す。導出中の不整合 (恒等式が成立しない) は部分結果を返さず失敗として扱う。
- Retry/Timeout/Fallback: 読み取りは副作用を持たないため無条件に再試行可能。DuplicateVerdict の upsert は同一の安定識別子に対する再送を同じ結果へ収束させる。
- Idempotency/Concurrency: DuplicateVerdict は upsert であり、同一明細への複数回の判断は最後の判断へ収束する。読み取りモデルは保存しないため、並行更新による古い集計値の残留が構造的に発生しない。

## イベント・非同期処理

N/A: 本機能は要求時導出の読み取りと利用者判断の upsert のみで構成され、producer/consumer の非同期境界を持たない。取込そのものは既存機能であり本仕様の範囲外である。

## 可観測性

- Logs/Metrics/Traces/Audit: DuplicateVerdict は判断日時と根拠を保持するため、帰属が動いた理由の監査証跡そのものになる。金額・取引先を含むため、ログへの明細内容の出力は行わない。
- Alert/SLO dashboard: 個人利用のため常時監視のダッシュボードを持たない。利用者向けの異常検知は、取込完了時に要確認が残っている場合の画面警告が担う。

## 互換性・移行・リリース

- Compatibility/versioning: 対象を web のみとし専用アプリを配布しないため、配信と同時に全利用者が新版になる。旧版クライアントの残留を前提とした API 後方互換の維持期間を定義する必要が生じない。
- Migration/backfill: DuplicateVerdict テーブルの追加は `migrations/` への連番 SQL 追記で行う。既存データの backfill は不要で、判断が無い明細は要確認として現れる。
- Rollout/rollback: Cloudflare Workers のデプロイ単位に従う。ロールバックは直前のデプロイへ戻すことで足り、読み取りモデルを保存しないため戻した後に古い集計値が残らない。

## テストと受入条件

- [ ] `AC-001`: 任意の月次データにおいて、総支出 = 事業費 + 家計費 および 総収入 = 事業収入 + 家計収入 が全月で成立する (契約テスト)。
- [ ] `AC-002`: 同じ (金額, 発生日) に MF が n 件・freee が m 件あるとき、事業費へ寄る MF が min(n,m) 件であり、freee 件数を超える付替が0件である (契約テスト)。
- [ ] `AC-003`: 発生日 ±3日 の近傍照合が要確認候補の抽出にのみ使われ、自動付替を1件も行わない (契約テスト)。
- [ ] `AC-004`: 利用者の判断が保存され、再取込後も同じ明細へ再適用される (結合テスト)。
- [ ] `AC-005`: TREND_MIN_MONTHS 未満の期間で判定不可を返し、既存 categoryTrends と同じ TREND_ALPHA で有意判定する (契約テスト)。
- [ ] `AC-006`: 9列すべてが常時表示され、取込完了時に要確認が残っている場合に画面へ警告が出る (DOM テスト)。
- Contract/integration/e2e/security/performance: 恒等式と帰属規則は D1 を立てない契約テストで固定する。判断の再適用は結合テストで確認する。認証境界は既存ゲートの経路テストが担う。

## 未決事項

- 本ノード取込時点で、正本側の未決事項は0件である。`system-spec/index.md` の集約状態サマリは8カテゴリすべてを「確定」とし、「未着手」「収集中」「対象外」はいずれも該当なしである。完成度評価は 2026-09-08 の再集計で総合 PASS (6 aspect すべて PASS) を得ている。
