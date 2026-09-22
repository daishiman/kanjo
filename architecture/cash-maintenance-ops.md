---
graph_node_id: "arch-cash-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "現金入力 — 削除中の行を出さない規則を経路ごとの API テストと 29 日 / 31 日の境界で固定し、check:cash-screen を verify:full に組み込む"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "maintenance-ops"]
file_path: "architecture/cash-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6101bc7549cfb1cd1f2fc96915120a6dd9aa17678c0d23eb631c8e06ca8d6827"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "6101bc7549cfb1cd1f2fc96915120a6dd9aa17678c0d23eb631c8e06ca8d6827", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-backend", "arch-cash-database", "arch-cash-auth", "arch-cash-security", "arch-cash-infrastructure"]
resource_scope: ["package.json", "packages/web/package.json", "packages/web/scripts/check-financial-visuals.mjs", "packages/api/src/cash-lifecycle.test.ts", "packages/api/src/transit-lifecycle.test.ts", "packages/api/src/scheduled-maintenance-budget.test.ts", "packages/web/src/cash-duplicate.dom.test.tsx", "packages/web/src/cash-transit-regression.test.ts", "packages/core/src/cash-screen.ts"]
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
classification_reason: "system-spec の maintenance-ops 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/cash-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G1", "G2", "G4"]
---

# Architecture overview

現金入力 — core の `cash-screen` の単体テスト、API テスト (論理削除・復元・一括・利用者分離・入力検証・削除中の行を集計に出さない不変条件)、DOM テスト (画像の構成要素・下書きの復元・元に戻す・空状態) を足し、web に `check:cash-screen` を加えて `verify:full` に組み込む。夜間の完全消去は消した件数を JSON ログに出し、上限に達した晩は warn にする。`system-spec/maintenance-ops.md` は承認時入力、本書は検証の範囲と運用の信号の制約を持つ。

## Context and drivers

- Business/technical context: ルートの `package.json:40` の `verify:full` は test・typecheck・lint・build の後に web の `check:thead`・`check:mobile-layout`・`check:financial-figure`・`check:financial-routes`・`check:ai-screen`・`check:analysis-hub` と `preview:smoke` を走らせる。描画検査は `packages/web/scripts/check-financial-visuals.mjs` に `KANJO_VISUAL_SCOPE` を渡す形 (`packages/web/package.json:21` の `check:ai-screen` が前例)。既存の現金のテストは `cash-lifecycle.test.ts`・`transit-lifecycle.test.ts` (api)、`cash-duplicate.dom.test.tsx`・`cash-transit-regression.test.ts` (web) (qa-cash-maintenance-ops-web-001、qa-cash-frontend-web-evidence-001)。
- Quality attribute priorities: G1・G2・G4 に資する。Clean Code の『規則は名前と境界値テストで読めるようにする』を適用する (agent 推定・利用者未確認、design_applications)。上流指針は operations (Google SRE)。
- Constraints: 既存の lint・typecheck・test・skills:test・初期 JS 予算・`verify:full` を緑に保つ (C4)。`verify:full` はローカルでは vite (4175) の起動を前提にする。

## Goals and non-goals

- Goals:
  - G1: 画像の構成要素 (領収書欄を除く) を DOM テストと `check:cash-screen` で確かめる (O1)。
  - G2: 下書きの復元と、削除 → 元に戻すで同じ id が戻ることを確かめる (O2)。
  - G4: 利用者分離と入力検証と削除中の行の不変条件を API テストで固定する (S4)。
- Non-goals:
  - 新しい CI ワークフローや監視基盤
  - 画像のモックの金額・件数・日付を期待値にすること

## System context and boundaries

- Users/external systems: 開発者と CI。夜間処理のログは Cloudflare の既存の observability で見る。
- Trust/deployment/data boundaries: テストのデータはテストの中で作り、本番のデータを使わない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core `cash-screen` の単体テスト | 合計・絞り込み・ページング・入力経路・交通費合計 | vitest | packages/core | CI |
| API テスト | 論理削除・復元・一括・利用者分離・入力検証・読取経路ごとの不変条件 | vitest | packages/api | CI |
| DOM テスト | 画面の構成要素・下書き・元に戻す・空状態 | vitest + DOM | packages/web | CI |
| `check:cash-screen` | `KANJO_VISUAL_SCOPE=cash` の描画検査 | `check-financial-visuals.mjs` | packages/web | CI / ローカル |
| 夜間ログ | 完全消去の件数と上限到達の warn | JSON ログ | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: API テストは利用者を 2 人作り、分離を確かめる。
- Errors/resilience: 検査のどれかが赤なら差し戻す。
- Observability/audit: 完全消去の件数を `{"level":"info","job":"cash_soft_delete_purge",...}` の形の JSON ログに出し、500 行に達した晩は `level: "warn"` にする (qa-cash-maintenance-ops-web-003、agent 推定・利用者未確認)。利用者 id や明細の内容はログに出さない。
- Configuration/secrets: N/A: 秘密情報を持たない。
- Compatibility/versioning: 既存テストは新しい構成へ移しても期待値を緩めない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Operations architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Operations architecture

#### Fixture authority

期待値の正本は仕様書のフィクスチャで、`17-cash.png` の金額・件数・日付はモックなので期待値にしない。合計・交通費合計・件数は `toBe`、絞り込みとページの結果は `toEqual` で比べる (vitest expect)。

#### Documentation upkeep

N/A: 新しい文書は足さない。規則の説明は core の定数名と境界値テストの名前で読めるようにする (Clean Code、agent 推定・利用者未確認)。

#### Regression scope

既存の `cash-lifecycle.test.ts`・`transit-lifecycle.test.ts`・`cash-duplicate.dom.test.tsx`・`cash-transit-regression.test.ts`・`scheduled-maintenance-budget.test.ts`・lint (直書き色の検査を含む)・typecheck・`skills:test`・初期 JS 予算を緑のまま保つ。既存行の `cashToDeal` / `cashToTx` の結果が変わらないことを確かめる (C2)。

#### Operations verification

削除中の行を出さない規則は、cash_entries を読む全経路 5 本 (`loadCashEntries`・`BACKUP_SNAPSHOT_SQL`・`loadImportRestoreSettingsSnapshot`・`loadCategoryUsageContext`・PUT の既存行取得) ごとに API テストを 1 件ずつ置き、削除 → 各経路に出ない → 復元 → 各経路に戻る の往復で固定する。30 日の期限は 29 日目の行が残り 31 日目の行が消える境界で固定する。一括は 100 件が通り 101 件が 400 になる境界で固定する (qa-cash-maintenance-ops-web-001 / 003、境界値の選び方は agent 推定・利用者未確認)。書き直したテストが旧実装で落ちることを確かめる。

### Infrastructure architecture (運用の観点)

基盤そのものの構成は `architecture/cash-infrastructure.md` が正本である。本節はそれを検証と回帰の運用から見た制約だけを持つ。

#### Environments and topology

検証はローカル・CI・本番の 3 つで行う。ローカルの `verify:full` は vite (4175) の起動を前提にし、CI は headless Chrome で DOM テストと描画検査を走らせる。現金入力のために新しい環境は足さない。

#### Compute and storage

N/A: 本章は計算資源と保存先を持たない。夜間の D1 予算は `architecture/cash-infrastructure.md` に従う。フィクスチャは仕様書の値を正本にする。

#### IaC and delivery

検証の入口は既存の CI と `verify:full` だけで、`packages/web/package.json` に `check:cash-screen` (`KANJO_VISUAL_SCOPE=cash node scripts/check-financial-visuals.mjs`) を足し、ルートの `verify:full` の検査列に加える。migration 0051 の反映は既存の Migrate → Deploy の手順に載せる。

#### Secrets and access

N/A: 検証と記録に秘密情報は要らない。テストのセッションはテストの中で発行し、平文を文書やログに残さない。

#### Reliability and recovery

既存のテスト・`skills:test`・初期 JS 予算・`check:cash-screen` のどれかが赤になったら差し戻す。差し戻しは Worker と web の配信を戻すだけで、0051 の列は落とさない。

#### Infrastructure verification

`verify:full` の緑と、Migrate の手順で 0051 が `d1_migrations` に記録されることを確かめる。夜間ログに `cash_soft_delete_purge` の件数が出ることを本番の初回実行で確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-cash-maintenance-ops-web-001 | `check:cash-screen` を足し `verify:full` に組み込む | DOM テストだけ | 実描画の崩れを CI で止められる | `verify:full` の実行時間が延びる |
| qa-cash-maintenance-ops-web-001 | 読取経路ごとに API テストを 1 件置く | 代表の 1 経路だけ試す | 経路を足したときの条件漏れを検知できる | 経路の追加でテストも足す |
| qa-cash-maintenance-ops-web-003 | 完全消去の件数を JSON ログに出し、500 行到達で warn (agent 推定・利用者未確認) | ログなし | 翌晩への持ち越しに気づける | ログの形を固定する |
| qa-cash-maintenance-ops-web-003 | 29 日 / 31 日と 100 / 101 件の境界で固定する (agent 推定・利用者未確認) | 代表値だけ | 境界のずれを確実に落とせる | 定数を変えるとテストが落ちる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI と `verify:full`。
- Migration sequence: core `cash-screen` の単体テスト → API テスト (経路ごと・境界値・利用者分離) → DOM テストの移設と追加 → `check:cash-screen` → `verify:full` への組み込み → 夜間ログ。
- Rollback trigger/procedure: 既存のテスト・`skills:test`・初期 JS 予算・`check:cash-screen` のどれかが赤になれば差し戻す。

## Risks and verification

- Risk/assumption: DOM テストを新しい構成に書き直すとき、旧実装でも通る緩い期待値に変えると回帰を見逃す。書き直したテストが旧実装で落ちることを確かめる。
- Risk/assumption: CI の headless Chrome は `pointer: none` で、`@media (pointer: fine)` に依る見た目はローカルと CI で分かれる。描画検査の期待はこれに依らない形で書く。
- Architecture fitness test: web と api に合計・交通費合計の計算の重複が無いこと (grep で 0 件、O3)。`verify:full` の検査列に `check:cash-screen` があること。
- Load/failure/security validation: 初期 JS 予算を CI 実測で確かめ、現金入力画面が遅延読込のままであること。
