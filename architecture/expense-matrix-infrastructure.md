---
graph_node_id: "arch-expense-matrix-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "支出マトリックス — 応答 2 分割と Workers CPU 予算に収める"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["expense-matrix", "infrastructure"]
file_path: "architecture/expense-matrix-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "43416dd0ae8d102622e9c3e1c75496c9f9d2ca8217b2fac378555d42c82cf8d6"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "43416dd0ae8d102622e9c3e1c75496c9f9d2ca8217b2fac378555d42c82cf8d6", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-16T11:55:20Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-frontend", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-auth", "arch-expense-matrix-security", "arch-expense-matrix-maintenance-ops"]
resource_scope: ["packages/api/src/routes/analytics.ts", "packages/api/wrangler.jsonc", "packages/web/scripts", "packages/core/src/analysis.ts"]
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
classification_reason: "system-spec の infrastructure 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/expense-matrix-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T11:55:20Z"}
serves_goals: ["G4"]
---

# Architecture overview

支出マトリックス — 応答 2 分割と Workers CPU 予算に収める。`system-spec/infrastructure.md` は承認時入力、本書は実行環境の制約を持つ。doctrine anchor は Google SRE。

## Context and drivers

- Business/technical context: 表本体は 12 か月 × 最大 21 行 (カテゴリ軸) または 12 か月 × 21 行 (取引先上位 20 + その他) で上限が決まっている。一方セル内訳は明細件数に依存するため、同じ応答へ混ぜると初回表示が明細量に引きずられる。
- Quality attribute priorities: G4 に資する。SRE の『変更を小さく可逆に保つ』と、負荷特性を先に見積もる姿勢を適用する。
- Constraints: Cloudflare Workers + D1。CPU 時間は有料プラン既定の 30 秒を上限とする。既存 binding を増やさない。本サイクルで SLO を新たに定義しない。

## Goals and non-goals

- Goals:
  - G4: 応答を『表本体 + 偏り 3 点』と『セル内訳』の 2 本に分け、初回表示の大きさを上限のある側だけで決める。
- Non-goals:
  - SLO・エラーバジェットの新規定義
  - 新しい binding・キュー・cron・外部サービスの追加
  - 集計結果のキャッシュ層の導入

## System context and boundaries

- Users/external systems: Cloudflare Workers と D1 のみ。
- Trust/deployment/data boundaries: 既存 Worker の中に route を足すだけで、デプロイ単位は増えない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker (既存) | 集計 route と内訳 route を同居させる | Hono | packages/api | 単一 Worker |
| D1 (既存 binding) | 明細の読み取り | Drizzle | packages/api | 既存 binding |
| web ビルド | 追加依存なしで JS バンドル予算内に収める | Vite ビルド | packages/web | 静的配信 |

## Cross-cutting contracts

- Identity/access: N/A: 本章の関心外 (`architecture/expense-matrix-auth.md`)。
- Errors/resilience: セル内訳が失敗しても表本体の表示は保たれる (取得が別経路であることの帰結)。
- Observability/audit: 新しい計測基盤を導入しない。JS バンドル予算は既存の測定 (build:bundle 直後) を使う。
- Configuration/secrets: `wrangler.toml` の binding を据え置く。
- Compatibility/versioning: 既存の分析系エンドポイントと同じ実行特性に収める。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/expense-matrix-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Runtime topology

既存 Worker に route を 1 本足し、新しいデプロイ単位・キュー・スケジュール実行を作らない。実行環境が増えないため、運用手順も増えない。

#### Capacity and budget

表本体は 12 か月 × 最大 21 行で上界が定まる。集計はセル数に比例する O(n) に収め、月ごとの繰り返し問い合わせを作らない。CPU 時間の上限は有料プラン既定の 30 秒とし、その内側に収まることを見積りの基準にする。web 側は新しい外部依存を増やさず既存の JS バンドル予算を超えない。

#### Response partitioning

応答を 2 本へ分ける。表本体と偏り 3 点は上限のある大きさ、セル内訳は明細件数に依存する大きさで、後者を初回表示の経路から外す。内訳は上位 10 件 + `truncated` で頭打ちにする。

#### Reliability posture

本サイクルで SLO・エラーバジェットを定義しない。可用性の前提は既存の分析系画面と同じとする。

#### Infrastructure verification

集計がセル数に比例することを、行数・月数を変えた計測で確かめる。JS バンドル予算は `build:bundle` 直後に測る (`build:artifact` は manifest を消すため後では測れない)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-matrix-infrastructure-web-003 | 応答を表本体とセル内訳の 2 本に分ける | 1 本で全明細を返す | 初回応答の大きさが明細件数に依存しなくなる | 失敗経路が 2 系統になる |
| qa-matrix-infrastructure-web-003 | 集計キャッシュ層を導入しない | 集計結果を保存/キャッシュ | 上界が小さく毎回計算で足りる。無効化の運用が増えない | CPU 予算の見積りが前提になる |
| qa-matrix-infrastructure-web-004 | SLO を本サイクルで定義しない | SLO を新設 | 既存分析画面と同じ前提で足り、運用負荷を増やさない | 可用性の議論は別サイクル |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker + 既存 web ビルド。binding 追加なし。
- Migration sequence: route 追加 → 応答分割 → 計測 (CPU 時間・バンドル予算)。
- Rollback trigger/procedure: 計測が予算を超えたら差し戻す。インフラ構成を変えないため巻き戻しは実装のみ。

## Risks and verification

- Risk/assumption: ±12 か月の読み広げで読み取り件数が増え CPU 時間が伸びる。上界のある表サイズと O(n) の集計により 30 秒の内側に収まる見込み。
- Architecture fitness test: 月ごとのループ問い合わせが無いこと。新しい binding・依存が増えていないこと。
- Load/failure/security validation: 12 か月 × 21 行での実行時間の計測。`build:bundle` 直後の js-budget が緑であること。
