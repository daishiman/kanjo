---
graph_node_id: "arch-ai-analysis-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "AI分析 — 段階の規則を docs/ai-screen/ の表と境界テストで固定し、skill 不変を緑のまま保つ"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ai-analysis", "maintenance-ops"]
file_path: "architecture/ai-analysis-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2b3f704b5a4f10f10bf1f37852d1094d0c80cb21fbe1ec9470a3b9fa1f01ee08"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "2b3f704b5a4f10f10bf1f37852d1094d0c80cb21fbe1ec9470a3b9fa1f01ee08", "imported_at": "2026-09-19T13:11:57Z"}
created_at: "2026-09-19T13:11:57Z"
updated_at: "2026-09-19T13:11:57Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-frontend", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-auth", "arch-ai-analysis-security", "arch-ai-analysis-infrastructure"]
resource_scope: ["package.json", "docs", "skills/run-kanjo-accounting-report", "packages/api/src/ai-lifecycle.test.ts", "packages/api/src/ai/contract.test.ts", "packages/web/src/ai-copy-log.dom.test.tsx", "packages/web/src/ai-report-structure.dom.test.tsx", "packages/web/src/ai-report-archive.dom.test.tsx", "packages/web/src/ai-task-collapse.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/ai-analysis-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T13:11:57Z"}
serves_goals: ["G1", "G2", "G5"]
---

# Architecture overview

AI分析 — 段階の規則を docs/ai-screen/ の表と境界テストで固定し、skill 不変を緑のまま保つ。`system-spec/maintenance-ops.md` は承認時入力、本書は規則の記録場所と回帰の範囲の制約を持つ。期待値の正本は spec-ai-analysis-screen の受け入れ基準の節とフィクスチャの節。

## Context and drivers

- Business/technical context: `verify:full` (`package.json:40`) は test・typecheck・lint・build と web の check 群・preview:smoke を順に走らせる。lint は biome と glossary・design-tokens・graph-lineage などの検査を含む (`package.json:24`)。`test:aux` は `skills:test` を含み、skill (`skills/run-kanjo-accounting-report`、`.claude/skills` と `.agents/skills` に同期) を検査する。画面ごとの作業記録は `docs/` 配下の画面名のディレクトリに置く慣行がある (qa-ai-maintenance-ops-web-evidence-001)。
- Quality attribute priorities: G1・G2・G5 に資する。Clean Code の『規則は名前と境界値テストで読めるようにする』を段階の導出と持ち出し範囲の保守に適用する。
- Constraints: レポート JSON 契約 v3 と skill を変えない。検証の入口は `verify:full` と CI に一本化する。

## Goals and non-goals

- Goals:
  - G2: 段階の優先順位・版の説明の既定文・タブの振り分け・使用するデータの数え方・持ち出し範囲を `docs/ai-screen/` に表で残し、同じ表を core の単体テストの期待値にする。
  - G5: `skills:test` と契約テスト (`packages/api/src/ai/contract.test.ts`) が緑のままであることで skill と契約の不変を確かめる。
  - G1: 既存の AI の API テストと DOM テスト、初期 JS 予算 (CI 実測)、`verify:full` を緑のまま保つ。
- Non-goals:
  - 新しい検証コマンドやワークフローの追加
  - skill の改訂
  - 画像のモックの件数・日時・進捗を期待値にすること

## System context and boundaries

- Users/external systems: 開発者と CI。外部のエージェントは skill を通じて契約だけに依存する。
- Trust/deployment/data boundaries: 規則の正本は仕様書、実装の正本は core の順序表と定数、利用者向けの説明は `docs/ai-screen/`。3 者の一致をテストで確かめる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `docs/ai-screen/` (新設) | 段階・版の説明・タブ・数え方・持ち出し範囲の表 | Markdown | リポジトリ | 文書 |
| core の単体テスト | 段階の順序表と境界 4 件を `toBe` で固定 | vitest | packages/core | CI |
| API テスト | キャンセル・再実行・削除・使用するデータ・401 の統一 | vitest | packages/api | CI |
| DOM テスト | 画面の段・専用経路への遷移・5 タブ・取り込みエラー | vitest (DOM) | packages/web | CI |
| `skills:test` / 契約テスト | skill と契約 v3 の不変 | unittest / vitest | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: N/A: 本章は検証と記録の関心。
- Errors/resilience: 境界テストの失敗は差し戻しの条件にする。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 設定と秘密情報を持たない。
- Compatibility/versioning: 既存の DOM テストが `Ai.js` から import する部品名は、移設先から再エクスポートするか、テストを新しい構成に合わせて書き直す (`architecture/ai-analysis-frontend.md`)。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Operations architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Operations architecture

#### Fixture authority

期待値の正本は仕様書のフィクスチャで、画像 (`12-ai.png`) の件数・日時・進捗はモックなので期待値にしない。段階と進捗は `toBe`、タブの振り分けの結果は `toEqual` で比べる。

#### Documentation upkeep

`docs/ai-screen/` に段階の優先順位、版の説明の既定文 (v1『初回レポート』・v2 以降『最新のデータで再分析』)、タブの振り分け、使用するデータの数え方、持ち出し範囲 (集計値だけ・自動送信なし) を表で置く。core の順序表と定数は同じ名前で書き、表の行とテストの期待値を 1 対 1 に対応させる。

#### Regression scope

既存の AI の API テスト (`packages/api/src/ai-lifecycle.test.ts` の系列)、DOM テスト 4 本 (ai-copy-log / ai-report-structure / ai-report-archive / ai-task-collapse)、契約テスト、`skills:test`、lint (直書き色の検査を含む)・typecheck・初期 JS 予算を緑のまま保つ。既存のレポート (受信済み・アーカイブ済み・版つき) が一覧と詳細で読めることを確かめる (S6)。

#### Operations verification

core の単体テストで段階の境界 4 件を固定する。期限切れと受信が同時に成り立つ行は完了、キャンセル後に期限が切れた行はキャンセル、差し戻し後にデータを再取得した行は 75% のまま、期限ちょうどの時刻は待機中。この 4 境界の選び方は agent 推定・利用者未確認 (根拠 qa-ai-maintenance-ops-web-003)。body 上限は上限ちょうどのレポートが通り 1 バイト超えが 413 になる境界テストで固定する (`architecture/ai-analysis-security.md`)。回帰の検出は既存の `verify:full` に載せる。

### Infrastructure architecture (運用の観点)

基盤そのものの構成は `architecture/ai-analysis-infrastructure.md` が正本である。本節はそれを検証と回帰の運用から見た制約だけを持つ。

#### Environments and topology

検証は、ローカル・CI・本番の 3 つで行う。ローカルの `verify:full` は vite (4175) の起動を前提にし、CI は headless Chrome で DOM テストと preview:smoke を走らせる。AI分析画面のために新しい環境は足さない。

#### Compute and storage

N/A: 本章は計算資源と保存先を持たない。件数読み取りの負荷と body 上限は `architecture/ai-analysis-infrastructure.md` と `architecture/ai-analysis-security.md` に従う。フィクスチャは仕様書の値を正本にし、D1 のローカルの seed は変えない。

#### IaC and delivery

検証の入口は既存の CI と `verify:full` だけで、新しいワークフローや検証コマンドは足さない。migration 0046 の反映は既存の Migrate → Deploy の手順に載せる。

#### Secrets and access

N/A: 検証と記録に秘密情報は要らない。テストのトークンはテストの中で発行し、平文を文書やログに残さない。

#### Reliability and recovery

既存のテスト・`skills:test`・契約テスト・初期 JS 予算のどれかが赤になったら差し戻す。差し戻しは Worker と web の配信を戻すだけで、0046 の列は落とさない。

#### Infrastructure verification

`verify:full` の緑と、Migrate の手順で 0046 が `d1_migrations` に記録されることを確かめる。基盤の検証項目は `architecture/ai-analysis-infrastructure.md` に従う。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ai-maintenance-ops-web-001 | 規則を `docs/ai-screen/` の表に置き、テストの期待値と揃える | コードのコメントだけに書く | 利用者と開発者が同じ表を読め、ずれをテストが検知する | 規則の変更は表・core・テストの同時更新になる |
| qa-ai-maintenance-ops-web-003 | 段階の境界 4 件を `toBe` で固定する (agent 推定・利用者未確認) | 代表値だけを試す | 優先順位の入れ替えを確実に落とせる | 順序表を変えるとテストが落ちる |
| qa-ai-maintenance-ops-web-001 | skill と契約の不変を `skills:test` と契約テストで確かめる | 目視で差分を確認 | 外部のエージェントとの契約が壊れたら CI で止まる | 契約を変える作業は別サイクルになる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI と `verify:full`。
- Migration sequence: `docs/ai-screen/` の表 → core の順序表と単体テスト → API テスト → DOM テストの移設または書き直し → `verify:full`。
- Rollback trigger/procedure: 既存のテスト・`skills:test`・初期 JS 予算のどれかが赤になれば差し戻す。

## Risks and verification

- Risk/assumption: DOM テストを新しい構成に書き直すとき、旧実装でも通る緩い期待値に変えてしまうと回帰を見逃す。書き直したテストが旧実装で落ちることを確かめる。
- Architecture fitness test: `docs/ai-screen/` の表の行数と core の順序表の要素数が一致すること。skill と契約 v3 の差分が 0 件であること。
- Load/failure/security validation: 初期 JS 予算を CI 実測で確かめ、AI分析画面が遅延読み込みのままであること。
