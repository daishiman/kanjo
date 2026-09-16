---
graph_node_id: "arch-total-cashflow-screen-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "総収支画面 — 既存 Worker 構成の維持とバックアップ対象の追加"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "infrastructure"]
file_path: "architecture/total-cashflow-screen-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "4118eb0594d7db66724df96bb1c75d090a4f2578788d871f22bba750b0f5d399"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "4118eb0594d7db66724df96bb1c75d090a4f2578788d871f22bba750b0f5d399", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["spec-total-cashflow-screen", "arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", ".github/workflows", "migrations", "packages/api/src/store.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/routes/imports.ts", "packages/api/src/schema-guard.ts", "packages/api/src/d1-limits.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-screen-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T14:50:54Z"}
serves_goals: ["G4"]
---

# Architecture overview

総収支画面 — 既存 Worker 構成の維持とバックアップ対象の追加。正本は `system-spec/infrastructure.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-total-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-infrastructure-web-tc-observed-001。packages/api/wrangler.jsonc の Worker kanjo-console が SPA を Workers Assets (binding ASSETS) で配信し、D1 (DB)・R2 (FILES)・cron ("0 18 * * *" = 日本時間 03:00 の夜間処理、バックアップを含む) を持つ。GitHub Actions は ci.yml・deploy.yml・migrate.yml で、本番 migration は feat-deploy-migration-gate の gate と runtimeSchemaGuard を通る。毎日のバックアップは store.ts の loadBackupPayload が BACKUP_SNAPSHOT_SQL で表を 1 つずつ列挙して組み立て、duplicate_verdicts・freee_deal_exclusions・新設の total_cashflow_operations を含まない (qa-infrastructure-web-tc-observed-002)。
- Quality attribute priorities: G4 に資する。doctrine は Google SRE (reliability: 追加 migration も本番 Worker の配備より先に適用する feat-deploy-migration-gate を通す / operations: cron と D1 の構成を変えず、利用者決定 qa-total-cashflow-decision-018 により 3 表をバックアップと復元の対象に加える。新しい監視や cron は足さない)。
- Constraints: binding・cron・デプロイ経路の変更は無い。本章へ引く設計知識 card は 0 件 (配信構成を変えないサイクルで infrastructure 固有に適用すべき知識が無いことを確認した上での確定)。効く制約は D1 の上限 (1 文の bind パラメータ数・batch の文数) と migration の適用順序の 2 つ。

## Goals and non-goals

- Goals:
  - G4: 追加 migration を既存の gate で安全に適用し、判定・除外・操作履歴の 3 表を毎日のバックアップと復元に含める。
- Non-goals:
  - binding・cron・デプロイ経路・バックアップ保存先の変更
  - 新しい監視・cron の追加

## System context and boundaries

- Users/external systems: Cloudflare Workers (Assets・D1・R2・cron) と GitHub Actions。
- Trust/deployment/data boundaries: 本番 D1 への migration は migrate.yml の gate 経由のみ。バックアップは cron が R2 へ書く既存経路。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker kanjo-console | API と SPA 配信・夜間処理 | wrangler.jsonc (ASSETS・DB・FILES・cron) | packages/api | Cloudflare Workers |
| D1 (DB) | 判定・除外・操作履歴を含む正本データ | binding DB | packages/api | Cloudflare D1 |
| R2 (FILES) | バックアップ等のファイル保存先 | binding FILES | packages/api | Cloudflare R2 |
| ci.yml・deploy.yml・migrate.yml | 検証・配備・migration gate | GitHub Actions | リポジトリ | GitHub |
| バックアップ・復元の列挙 | 表のスナップショットと復元 write-set | store.ts・import-active.ts・import-lifecycle.ts・canonical-mutation-fence.ts・routes/imports.ts・schema-guard.ts | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: N/A: 実行基盤のアクセス権を変えない。
- Errors/resilience: migration は追加のみで、配備前に適用しても旧 Worker が壊れない。
- Observability/audit: 既存の監視・ログのまま。新しい監視は足さない。
- Configuration/secrets: binding と秘密情報は変更しない。
- Compatibility/versioning: key の無い旧バックアップからの復元でも既存の行を残す (database 章 qa-database-web-tc-inference-006)。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

既存 Worker kanjo-console 1 つで、Workers Assets (ASSETS)・D1 (DB)・R2 (FILES)・cron ("0 18 * * *" = JST 03:00) を持つ。本サイクルは総収支 route を拡張し D1 migration を 1〜2 本足すだけで、トポロジーは変えない。cron が JST 03:00 に動くため、画面フッターの『毎朝バックアップ』が事実に沿う。

#### Compute and storage

GET /api/total-cashflow は 1 リクエストで loadDataset と freee 系 3 テーブル (+操作履歴) を読み、d1-limits.ts の制限内に収まる。書込みの分割は D1_MAX_BOUND_PARAMS に合わせる。出典は cloudflare-d1-limits (2026-04-21)。

#### IaC and delivery

wrangler.jsonc と GitHub Actions (ci.yml・deploy.yml・migrate.yml) を変えない。追加 migration も feat-deploy-migration-gate を通し、本番 Worker の配備より先に適用する。schema-guard.ts の EXPECTED_D1_MIGRATION を新しい番号へ上げる。

#### Secrets and access

N/A: binding・秘密情報・アクセス権を追加・変更しない。

#### Reliability and recovery

毎日のバックアップと復元に 3 表を加える (qa-total-cashflow-decision-018)。0040 の前例が触れた 7 系統に揃えて足す: (1) import-active.ts の JSON_SNAPSHOT_MUTATION_CONSUMERS、(2) import-lifecycle.ts の復元 write-set、(3) store.ts のスナップショット SQL と件数、(4) canonical-mutation-fence.ts の consumers (qa-infrastructure-web-tc-observed-003)、(5) routes/imports.ts の復元 payload の zod 検証と resolveRestoreReviewState 相当の扱いと件数、(6) 書込み route からの invalidateJsonSnapshotQuery、(7) schema-guard.ts の EXPECTED_D1_MIGRATION と deletion-schema.test.ts の期待値 (qa-infrastructure-web-tc-observed-004)。現行の総収支の書込み route は invalidateJsonSnapshotQuery を呼ばず fence にも登録されていないので、(4) と (6) は新規の結線になる。cron とバックアップ保存先は変えない。

#### Infrastructure verification

ci.yml の検証一式を緑に保つ。復元テストで 3 表が復元時点に戻ること、key の無い旧バックアップで既存の行が残ることを確かめる。本番 migration が gate を通って配備前に適用されることを migrate.yml の実行で確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-infrastructure-web-tc-observed-001 | 配信構成・binding・cron を変えない | 総収支用の別 Worker や cron | 変更面を route と migration に閉じる | 監視や cron の追加は無い |
| qa-total-cashflow-decision-018 | 3 表をバックアップと復元に加える | 判定と除外だけ / 加えない | 復元しても判断と履歴が戻る | 7 系統に 3 表を足しバックアップが少し大きくなる |
| qa-database-web-tc-inference-006 | 前例の全箇所に揃えて足す | 表の列挙だけに足す | 復元の受け渡し漏れを防ぐ (アシスタント推定) | 旧バックアップの互換を保つ扱いが要る |

## Delivery, migration and rollback

- Build/deploy topology: 既存の deploy.yml で同じ Worker を配備する。
- Migration sequence: migrate.yml と feat-deploy-migration-gate で migration 0041 を本番 D1 に適用 → schema-guard の期待番号を含む Worker を配備。
- Rollback trigger/procedure: 配備後の不具合は直前のビルドへ戻す。migration は追加のみで巻き戻さない。

## Risks and verification

- Risk/assumption: 前例の変更箇所は当初 4 箇所と数え、後に 7 系統へ数え直した経緯があり、なお漏れがありうる (import-lifecycle-pure.test.ts の routeSources や db/schema.ts が変更箇所に明記されていない findings low)。migration 番号は取込時点の main で確定する。
- Architecture fitness test: wrangler.jsonc と workflows に差分が無いこと、バックアップ SQL の列挙に 3 表があること。
- Load/failure/security validation: GET と一括書込みが D1 の上限内に収まること、復元の不正な形が全体拒否されること。
