---
graph_node_id: "arch-expense-matrix-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "支出マトリックス — core 純関数 1 か所とセル指向 API"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["expense-matrix", "backend"]
file_path: "architecture/expense-matrix-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "aa683b83952f8d5cda302aa3b26e2150fa8306d080c02fe03648cb32aeafe0b4"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "aa683b83952f8d5cda302aa3b26e2150fa8306d080c02fe03648cb32aeafe0b4", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-16T11:55:20Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-frontend", "arch-expense-matrix-database", "arch-expense-matrix-auth", "arch-expense-matrix-security", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops"]
resource_scope: ["packages/core/src/analysis.ts", "packages/core/src/dataset.ts", "packages/core/src/period.ts", "packages/api/src/routes/analytics.ts", "docs/data-schema.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/expense-matrix-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T11:55:20Z"}
serves_goals: ["G3", "G4"]
---

# Architecture overview

支出マトリックス — core 純関数 1 か所とセル指向 API。`system-spec/backend.md` は承認時入力、本書は集計とデータ契約の制約を持つ。数値・フィクスチャの正本は `specs/spec-expense-matrix-screen.md` §3.5 / §9。

## Context and drivers

- Business/technical context: 現行 `packages/core/src/analysis.ts` の `matrix(data: Dataset): MatrixData` は事業固定で、行は `data.biz.categories` に 経費計 と 売上（記帳） を足したもの。`packages/api/src/routes/analytics.ts:418` が `c.json(matrix(data))` を返し、`:648` が `/export/matrix.csv` を返す。平均・列方向の集計・濃淡スケール・偏り 3 点・セル内訳は存在しない。
- Quality attribute priorities: G3・G4 に資する。Clean Architecture の Dependency Rule (core ← api ← web の一方向)、API Design Patterns の契約安定、DDD の用語一致を適用する。
- Constraints: packages/core は依存ゼロの純関数。Cloudflare Workers (Hono) + D1。集計を web 側や API ハンドラ側へ複製しない。

## Goals and non-goals

- Goals:
  - G3: 偏りが大きい 3 点を core の純関数で算出する (スコアと同点解消と決定論テンプレート)。
  - G4: 月×(カテゴリ|取引先)・事業/家計・金額/構成比/前年差・行と列の合計と平均・濃淡階級・偏り上位 3 点・セル内訳を 1 か所で算出し、`GET /api/matrix` を拡張しセル内訳を別経路で返す。
- Non-goals:
  - 新しい保存・スキーマ変更 (database 章の範囲で不要と確定)
  - 生成 AI による示唆文の作成
  - 画面側での再集計

## System context and boundaries

- Users/external systems: web (マトリックス画面) と既存の CSV 出力。外部サービスは呼ばない。
- Trust/deployment/data boundaries: core は D1 を知らず `Dataset` だけを受け取る。route が期間・スコープ・軸を受け取り Dataset を組んで純関数へ渡し、結果を JSON へ写す。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core matrix 集計関数 | `Dataset` と `{scope, axis}` から months / rows (key,label,series,total,average) / columnTotals / columnAverages / grandTotal / grandAverage / heatScale {min,max,steps:7} を返す | 純関数 | packages/core | 同一 Worker |
| core 表示モード変換 | 同じ series から 構成比 (列合計 100%) と 前年差 を導く | 純関数 | packages/core | 同一 Worker |
| core 偏り度スコア | `score(cell) = max(z_month, z_row) + max(0, mom_rate)` の降順で 3 件選ぶ | 純関数 | packages/core | 同一 Worker |
| core 示唆テンプレート | 6 パターンを判定し金額・比率・件数を差し込む | 純関数 | packages/core | 同一 Worker |
| `GET /api/matrix` | 期間 + scope / axis / mode を受け、集計結果と movers と updatedAt を返す | Hono route | packages/api | Worker |
| `GET /api/matrix/cell` | month / axis / key / scope を受け、amount / mom / yoy / badge / transactions / sources / updatedAt / detailHref を返す | Hono route | packages/api | Worker |
| `GET /api/export/matrix.csv` | 9.1 と同じクエリを受け、同じ core 関数の結果を 17 列固定 (科目 + 13 か月 + 合計 + 平均 + 前年比(年換算)) で書き出す | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 新設経路も既存 `/api/*` の認証ミドルウェア配下に置く (`architecture/expense-matrix-auth.md`)。
- Errors/resilience: クエリの列挙値違反は 400。エラー応答に内部の SQL・スタック・ファイルパスを含めない。
- Observability/audit: 監査ログに明細金額を書かない。
- Configuration/secrets: 追加の設定値・秘密情報を持たない。
- Compatibility/versioning: `GET /api/matrix` は既存の期間クエリへ scope / axis / mode を加法的に足す。既存 CSV の金額と画面の金額を一致させる。CSV は加法的ではなく、年計列 (年数ぶん可変) を落として 13 か月固定 + 合計 + 平均へ置き換える (列契約は `specs/spec-expense-matrix-screen.md` §9.4)。取り込み側を持たない一方向の書き出しなので、列の入替を後方互換の対象にしない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/expense-matrix-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外 (`architecture/expense-matrix-database.md`)
- Security: N/A: 本章の関心外

### Backend architecture

#### Aggregation rules

`scope` は `biz` / `personal` の 2 値で、両者を足した `total` を持たない (仕様 §2.2)。したがって `total = biz + personal` という不変条件も持たない。未記帳月は合計・平均・比率・濃淡から除外し、平均は未記帳月を除いた月数で割る。構成比はその月の合計に対する割合 (列合計 100%)、前年差は前年同月との差額で、前年同月が無ければ '—'。濃淡は表示中のデータセルの最小〜最大を 7 階級に等分した表全体共通スケールで、合計行・平均行・合計列・平均列は階級の算出から除外する。取引先軸は期間合計の上位 20 取引先 + 『その他』1 行へ純関数側で畳む。

#### Outlier selection

同点は 金額降順 → 新しい月 → 行の固定順 で解く。標準偏差 0 の行・月はスコア 0、未記帳月・合計行・平均行は対象外、候補が 3 件未満ならある分だけ返す。示唆は 急増 (前月比 ≥ +50%) / 増加 (+10% 以上 +50% 未満) / 継続高水準 (前月比 +10% 未満かつ行平均の 1.5 倍以上) / 減少後も高水準 (前月比 < 0 かつ 前年同月比 > 0) / 前年比のみ増 / その他 の 6 種を判定し、決定論テンプレートへ金額・比率・件数を差し込む。

#### API contract

`GET /api/matrix` は既存の期間クエリへ `scope` (biz|personal) / `axis` (category|vendor) / `mode` を加える。`GET /api/matrix/cell?month=&axis=&key=&scope=` を新設し、含まれる取引は金額降順で上位 10 件と `truncated` を返す。取引の合計はセル金額と一致させる。契約の逐語は `specs/spec-expense-matrix-screen.md` §9.1 / §9.2。

#### Data access

core の集計関数は D1 を知らない。期間の前後 12 か月まで広げた読み取りは route の Dataset 組み立てで行い、純関数には『表示期間』と『比較のために読めた範囲』を区別した形で渡す。セル内訳も同じ Dataset の絞り込みで組み、内訳専用の SQL を別に増やさない。

#### Backend verification

core 単体テストで 構成比の列合計が 1・前年差の対象外月 (未記帳・前年同月なし) の扱い・取引先軸のその他まとめ・濃淡階級の境界・同点時の順位付け・候補 3 件未満を検証する。API テストで期間とスコープと軸のクエリ、セル内訳の取得、既存 matrix CSV との金額一致を検証する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-matrix-outlier-score | `score(cell) = max(z_month, z_row) + max(0, mom_rate)` の降順 | 単純な金額順 | 月内偏りと行内偏りの大きい方に増加ボーナスを足す規則をそのまま実装できる | 標準偏差 0 と同点の扱いを明示的に決める必要がある |
| dec-matrix-insight-generation | 示唆は決定論テンプレート (6 パターン) | 生成 AI 文 | 同じ入力から必ず同じ文が出てテストで固定できる。取引データを外部へ送らない | 文面の変更は仕様書を先に直す |
| dec-matrix-heat-scale | 階級は表全体共通の 7 階級、合計/平均の行列は算出から除外 | 列ごと正規化 / 全セル込み | 含めると本体セルが最下位階級へ潰れる | 階級境界を API が返す |
| dec-matrix-counterparty-axis | 取引先は上位 20 + その他をサーバ側で集約 | 全件返す | 取引先数が増えても応答と表の大きさが変わらない | 『その他』行の内訳は詳細で降りる先を持たない |
| dec-matrix-fixture-authority | 再現テストはセル値を正本とし合計・平均は実計算値 | 画像の合計欄を正本 | 期待値が算術的に閉じ、`toBe` の厳密一致で集計の誤りが検出される | 画像と合計欄が一致しない点を仕様書に明記する |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) と packages/core のビルド。
- Migration sequence: core 集計関数 (scope/axis/合計と平均/階級) → 表示モード変換 → 偏り度スコアと示唆テンプレート → `GET /api/matrix` 拡張 → `GET /api/matrix/cell` 新設 → CSV を同じ関数へ付け替え。
- Rollback trigger/procedure: core / API テストが落ちたら差し戻し。スキーマ変更が無いためデータの巻き戻しは不要。

## Risks and verification

- Risk/assumption: 同じ集計が CSV と画面に二重実装されると数値が食い違う。core の 1 関数を両者が参照していることをテストで固定する。
- Architecture fitness test: api ハンドラと web に集計ロジックが無いこと。core が D1 / Hono の型を参照していないこと。
- Load/failure/security validation: 集計がセル数に比例する O(n) に収まり Worker の CPU 時間内であること。クエリの列挙値検証が 400 を返すこと。
