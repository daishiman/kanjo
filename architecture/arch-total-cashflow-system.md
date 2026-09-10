---
graph_node_id: arch-total-cashflow-system
artifact_kind: architecture
artifact_subtypes: [frontend, backend, infrastructure, data, security]
title: 事業・家計トータル収支システム アーキテクチャ (system-spec 由来)
project_id: kanjo
domain: total-cashflow
status: active
priority: high
start_date: null
target_date: null
iteration: null
owners: [daishiman]
tags: [system-spec, total-cashflow, architecture]
file_path: architecture/arch-total-cashflow-system.md
template_id: architecture
template_version: 1.0.0
confirmation_status: confirmed
evaluation_status: pass
confirmation_evidence:
  evaluator: system-spec-harness:assign-system-spec-completeness-evaluator
  evidence_ref: system-spec/completeness-findings.json
  evaluated_digest: 42a7120d73e79534d15acc3ebafc3b4bcdca94554b5c04934aedb488044baa28
source_lineage:
  origin_kind: system-spec-harness
  source_plugin: system-spec-harness
  source_path: system-spec/index.md
  source_version: 0.1.12
  source_digest: 69a9cb667945e7769df55e373d35de54a2a2f7f094d38454c9c008971fb6ce94
  imported_at: 2026-09-08T07:32:48Z
created_at: 2026-09-08T07:32:48Z
updated_at: 2026-09-08T07:32:48Z
depends_on: [spec-total-cashflow-system]
related_nodes: []
resource_scope:
  - system-spec/backend.md
  - system-spec/frontend.md
  - system-spec/infrastructure.md
  - system-spec/database.md
  - system-spec/security.md
  - system-spec/auth.md
  - system-spec/maintenance-ops.md
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 0.94
classification_reason: 7章がレイヤ境界・依存方向・配信トポロジ・データ所有・認証境界を確定しており architecture テンプレートへ対応する
classification_candidates:
  - {artifact_kind: architecture, confidence: 0.94, candidate_path: architecture/arch-total-cashflow-system.md}
  - {artifact_kind: specification, confidence: 0.13, candidate_path: specs/arch-total-cashflow-system.md}
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

# Architecture overview

本ノードは system-spec-harness が確定させた7つの技術章の dev-graph 側 projection である。本文は正本を複製せず lineage 参照で辿る (MM-12)。正本は `system-spec/` の backend / frontend / infrastructure / database / security / auth / maintenance-ops の各章で、`source_digest` が指す内容と一致する限り本ノードの記述は有効である。

中心にある構造は1つ — 二重計上の消し込みと合算という業務規則を `packages/core` の純関数として内側に置き、Cloudflare Workers のハンドラも D1 のアクセスも SQL の集計も、その外側に留める。集計値を保存しないのはこの構造の帰結であり、性能上の妥協ではない。

## Context and drivers

- Business/technical context: 個人事業主の事業と家計が一体になっている実態に対し、freee (事業帳簿) と Money Forward (家計) へ分かれて記録された収入・支出を1つの一覧表へ束ねる。既存のモノレポ (`packages/core` / `packages/api` / `packages/web`) と Cloudflare Workers + D1 の構成へ追加する形を取る。
- Quality attribute priorities: 検算可能性が最優先である (G3)。利用者が手で 事業費 + 家計費 = 総支出 を確かめられることが、性能・実装簡潔性より上位に置かれた。次いで期間をまたいだ一貫性 (G7)、既存トレンド判定との基準統一 (G5) が来る。
- Constraints: 対象プラットフォームは web のみ (承認 `appr-target-platforms-007`)。Cloudflare D1 の公式上限 (データベースサイズ・SQL 長・実行時間・クエリ数・行サイズ) に従う。統計判定は既存 `packages/core/src/trend.ts` の定数を共有する。

## Goals and non-goals

- Goals: G1 (合算した1つの一覧表)、G2 (二重計上のない支出合計)、G3 (利用者の手で検算できる内訳の明示)、G4 (要確認の列挙と判断の再適用)、G5 (既存基準でのトレンド判定)、G6 (合算後も内訳を保持し辿れる)、G7 (期間切替でも矛盾しない再計算)。逐語は `system-spec/00-requirements-definition.md` の U3。
- Non-goals: 新しい取込元の追加 (事業用 Money Forward・家計用 freee のいずれも追加しない)。支払先を用いた突合。専用アプリの配布。集計値の事前計算テーブル。SQL 側への集計ロジック移設。

## System context and boundaries

- Users/external systems: 利用者は単一の個人事業主。外部システムは freee と Money Forward の2つで、いずれも明細のエクスポートを取込元とする受動的な関係であり、実行時に API 連携しない。
- Trust/deployment/data boundaries: 信頼境界は Cloudflare Workers の `/api` 認証ゲートに置く。`wrangler.jsonc` の `run_worker_first` が `/api/*` を指すため、本機能が追加する読み取り API と DuplicateVerdict 更新 API も必ずゲートを通り、静的アセット経路から迂回できない。データ境界は Cloudflare アカウント内の D1 データベース1つに閉じ、テナント分割を持たない。
- Context diagram: 経路は3本のみである。利用者のブラウザから Workers へ (認証ゲート経由)、Workers から D1 へ (取得のみ、集計を伴わない)、そして D1 から R2 への夜間バックアップ。3本目だけが利用者の操作を起点としない。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| packages/core | 消し込み・合算・トレンド判定の純関数。D1 も Workers も知らない | TypeScript の関数境界 | 状態を持たない | web と api の双方へバンドルされる |
| packages/api (Hono) | 入出力変換と認証ゲートの通過。集計ロジックを持たない | `/api` 配下の REST。zod スキーマで契約化 | D1 への読み書きの唯一の経路 | Cloudflare Workers |
| packages/web (React) | 一覧表と要確認一覧の描画、期間切替、判断の入口 | Workers の REST を消費 | 保持しない (サーバ状態のキャッシュのみ) | Cloudflare の静的配信 |
| D1 (SQLite) | canonical な明細と DuplicateVerdict の永続化 | drizzle-orm 経由の素直な範囲取得 | 明細と利用者判断の所有者 | Cloudflare D1 |
| R2 | D1 の夜間バックアップ先 | Cloudflare の定期実行から書込 | バックアップ世代の所有者 | Cloudflare R2 |

## Cross-cutting contracts

- Identity/access: 既存の `/api` 認証ゲート1本に集約する (`dec-auth-boundary-001`)。本機能だけ到達性が異なる状態を作らない。
- Errors/resilience: 読み取りは副作用を持たず無条件に再試行できる。DuplicateVerdict の upsert は同一の安定識別子への再送を同じ結果へ収束させる。導出中に恒等式が成立しない場合は部分結果を返さない。
- Observability/audit: DuplicateVerdict が判断日時と根拠を保持し、帰属が動いた理由の監査証跡そのものになる。明細内容はログへ出さない。
- Configuration/secrets: Cloudflare の環境変数とシークレットに従い、リポジトリへ値を持たない。統計判定の定数は設定ではなくコード上の共有定数として `packages/core` に置く。
- Compatibility/versioning: web のみを対象とするため、配信と同時に全利用者が新版になる。旧版クライアント残留を前提とした API 互換期間の定義が発生しない。

## Subtype architecture

合成対象を記録し、正本の対応章を示す。

- Frontend: `system-spec/frontend.md`。一覧表・要確認一覧の描画と期間切替への追随、判断の入口を既存の取込明細編集画面へ置く配置を確定している。資するゴールは G1 G4 G5 G6 G7。
- Backend: `system-spec/backend.md`。集計を `packages/core` の純関数へ置き Hono の route を入出力変換に留める依存方向、月次行と内訳を1応答で返す API 形状を確定している。資するゴールは G1 G2 G3 G5 G6。
- Infrastructure: `system-spec/infrastructure.md`。Cloudflare Workers への配信単位とロールバック手順を確定している。資するゴールは G1 G7。
- Data: `system-spec/database.md`。TotalCashflowMonth を保存せず DuplicateVerdict のみを永続化する所有関係、`migrations/` への連番 SQL 追記方式、D1 の公式上限への従属を確定している。資するゴールは G2 G4 G7。
- Security: `system-spec/security.md` および `system-spec/auth.md`。認証境界を既存 `/api` ゲートへ置く決定と、明細内容をログへ出さない方針を確定している。資するゴールは G2 G3 G4 (security) と G1 G7 (auth)。
- 運用面は上記5 subtype のいずれにも属さないため `system-spec/maintenance-ops.md` を別途参照する。D1 から R2 への夜間バックアップと復旧手順を確定しており、資するゴールは G4 G7 である。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-trend-method-001 | トータル支出の推移判定を既存の Mann-Kendall 検定 + Theil-Sen 傾き推定に合わせる | 最小二乗回帰の傾き / 前年同月比 / 移動平均の傾き | Theil-Sen は中央値ベースで外れ値に頑健であり、年に数回の大きな事業支出に傾きを引きずられない。判定語 TrendDirection も共有するため、同一画面でカテゴリ別とトータルが別基準になる矛盾が起きない | TREND_MIN_MONTHS = 6 未満の期間は常に判定不可を返す。新しい統計手法を導入しない |
| dec-auth-boundary-001 | 本機能の API を既存 `/api` 認証ゲートの内側に置く | 別経路を設ける / Cloudflare Access へ一本化する | 認証は G1 G7 の前提条件であり、既存ゲートに載せることで本機能だけ到達性が異なる状態を作らない | `run_worker_first` により追加 API も必ずゲートを通る。本機能固有の認証設定が増えない |
| dec-aggregation-strategy-001 | 月次トータル収支を要求時に canonical から毎回導出する | 事前計算して保存する / D1 の SQL ビューへ寄せる | canonical が唯一の真実であり、画面の合計と明細が定義上ずれない (G3)。ビュー化は業務規則を永続化層の方言で表現させ、境界の外側へ内側の規則を漏らす | 集計テーブルを持たないため再計算コストを毎回払う。その代わり古い集計値の残留が構造的に発生しない |

## Delivery, migration and rollback

- Build/deploy topology: モノレポをビルドし、Workers (api) と静的アセット (web) を Cloudflare へ配信する。`packages/core` は独立配信されず双方へバンドルされる。
- Migration sequence: DuplicateVerdict テーブルの追加を `migrations/` の連番 SQL として追記し、Cloudflare D1 の migrations 機構 (create / list / apply) で適用する。既存データの backfill は不要で、判断が無い明細は要確認として現れる。
- Rollback trigger/procedure: 恒等式の破れ、または要確認判断の再適用が働かないことを検知した場合に直前のデプロイへ戻す。読み取りモデルを保存しないため、戻した後に古い集計値が残らない。テーブル追加は既存経路を壊さない加算的変更であり、スキーマを戻さずコードだけ戻す運用が成立する。

## Risks and verification

- Risk/assumption: 支払先を判定に用いないため、偶然に同額・同発生日となった無関係な支出も事業費として扱われうる。利用者はこれを承知のうえで規則の単純さと予測可能性を優先すると判断した (`qa-duplicate-rule-001`)。収入側は freee 売上が発生主義の発生日、MF 入金が入金日であるため日付が一致せず、実際に消し込まれる件数は少ない見込みである。
- Architecture fitness test: 恒等式 総支出 = 事業費 + 家計費 と 総収入 = 事業収入 + 家計収入 を D1 を立てない契約テストで全月について固定する。これが `packages/core` の独立性を測る適合テストそのものになる — core が D1 を知っていればこのテストは書けない。
- Load/failure/security validation: 帰属規則の境界 (n が m を超える向き・m が n を超える向き) と近傍照合が自動付替を行わないことを契約テストで固定する。判断の再適用は再取込を伴う結合テストで確認する。認証境界は既存ゲートの経路テストが担う。
