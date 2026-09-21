---
graph_node_id: "arch-classify-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "明細仕分け — 3 区分の不変条件テストと旧実装で落ちる検算による回帰検出"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "maintenance-ops"]
file_path: "architecture/classify-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "5b8f24c0344ea95abaf6eba3e8a983caa814090f7de068bb89e433cc4fcb38ee"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "5b8f24c0344ea95abaf6eba3e8a983caa814090f7de068bb89e433cc4fcb38ee", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-backend", "arch-classify-database", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-auth"]
resource_scope: ["package.json", "packages/core/test", "packages/core/src/classify-status.ts", "packages/api/src/routes/classify.ts", "packages/web/src/pages/classify/", "docs/data-schema.md", "docs/ui-decisions.md", "docs/classify-screen/", "scripts/check-design-tokens.mjs"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/classify-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# Architecture overview

明細仕分け — 3 区分の不変条件テストと旧実装で落ちる検算による回帰検出。`system-spec/maintenance-ops.md` は承認時入力、本書はテストの置き場所・検証の手順・文書の更新の制約を持つ。

## Context and drivers

- Business/technical context: core のテストは `packages/core/test/` に `classification-progress-contract.test.ts`・`overview-close-status.test.ts`・`splits-contract.test.ts`・`payment-method-contract.test.ts` がある。web には `classify-*.dom.test.tsx` (削除・離脱確認・スマホのカード・支払方法・分割・家計の絞り込み・推移の絞り込み・編集の契約) と `classification-progress.dom.test.tsx` がある。`package.json` の `lint` はデザイントークン検査 (`scripts/check-design-tokens.mjs`) などを含み、`verify:full` はローカルの vite (4175) を前提にする。文書は `docs/data-schema.md` と `docs/ui-decisions.md` (qa-classify-maintenance-ops-web-evidence-001)。
- Quality attribute priorities: G1〜G5 に資する。テストは旧実装で落ちることを確かめてから確定し、0 件の違反と 0 件しか調べていないことを区別する (qa-classify-maintenance-ops-web-003)。
- Constraints: 実データをテストに持ち込まない。件数の定義を緑にするために緩めない。

## Goals and non-goals

- Goals:
  - G1: 画面の問い・KPI 4 枚・3 カラム・通知が揃うことを DOM テストで固定する。
  - G2: 3 区分の排他と和・要確認 ⊆ 未整理・信頼度の境界・提案一致の区分・バッジと月次クローズの一致を core の単体テストで固定する。
  - G3: 一括保存の部分失敗と上限を API 統合テストで固定する。
  - G4: プレビューと適用の一致・手動変更の不変・分割ルールの和を core の単体テストで固定する。
  - G5: 保存フィルタと履歴の記録を API 統合テストで固定する。
- Non-goals:
  - 新しい監視・アラート・ダッシュボード
  - E2E の実ブラウザ試験の追加 (既存の DOM テストと `verify:full` の範囲に留める)

## System context and boundaries

- Users/external systems: 開発者のローカル環境と GitHub Actions の CI。
- Trust/deployment/data boundaries: テストは合成データだけを使う。本番の D1 に触れない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `packages/core/src/classify-status.test.ts` (予定) | 区分・要確認・信頼度・提案一致・ルールの該当と分割の単体テスト | vitest | packages/core | CI |
| `packages/api/src/routes/classify-bulk.test.ts` (予定) | 一括保存・ルールのプレビューと適用・保存フィルタ・履歴・上限・認可の統合テスト | vitest | packages/api | CI |
| `packages/web/src/pages/classify/classify.dom.test.tsx` (予定) | 画面の構成・KPI・絞り込み・一括操作・下書きの DOM テスト | vitest + DOM | packages/web | CI |
| 既存の契約テスト | `classification-progress-contract`・`overview-close-status` などを新しい判定へ付け替える | vitest | packages/core | CI |
| 文書 | `specs/spec-classify-screen.md`・`architecture/classify-*.md`・`docs/classify-screen/design-decisions.md` (予定)・`docs/data-schema.md` | Markdown | リポジトリ | リポジトリ |

(テストと文書のパスは agent 推定・利用者未確認、根拠 qa-classify-maintenance-ops-web-002)

## Cross-cutting contracts

- Identity/access: 認可のテストは `architecture/classify-auth.md` の検証項目に従う。
- Errors/resilience: 部分失敗・上限超過・フェンスの競合の応答をテストで固定する。
- Observability/audit: 取引の履歴が変更の記録を担う。新しい運用信号は足さない。
- Configuration/secrets: N/A: テストに秘密情報を使わない。
- Compatibility/versioning: 既存テストの期待値を変えるときは、変えた理由 (区分の定義の変更) を文書に残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/classify-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/classify-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/classify-database.md`)
- Security: N/A: 本章の関心外 (`architecture/classify-security.md`)

### Infrastructure architecture

#### Environments and topology

- Environments: ローカル (wrangler dev + vite 4175) と CI。`verify:full` はローカルの vite を前提にする。
- Topology: 既存のまま。

#### Compute and storage

- Compute: CI の GitHub Actions ランナー。
- Storage: テストはメモリ上か一時的なローカル D1 を使う。

#### IaC and delivery

- IaC: N/A: 基盤の定義を変えない。
- Delivery: `ci.yml` で lint (デザイントークン検査を含む)・型・テストを通してから `migrate.yml` と `deploy.yml` へ進む既存の順。

#### Secrets and access

- Secrets: N/A: テストと文書に秘密情報を使わない。
- Access: 実データの持ち込みは `scripts/hooks/guard-real-data.sh` が止める。

#### Reliability and recovery

- 回帰の検出: 新しいテストは確定前に旧実装 (現行の `classificationProgress` と `buildReviewQueue`) に当てて落ちることを確かめ、落ちないテストは条件を見直す。件数を固定する検査は、対象の件数が 0 でないことも併せて確かめる。
- Recovery: テストが落ちたら差し戻す。件数の定義を変えるときは仕様を先に直す。

#### Infrastructure verification

CI で core・API・DOM のテストと lint を通す。ローカルで `verify:full` を実行する。追加した各テストが旧実装で落ちたことを記録してから確定する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-classify-maintenance-ops-web-003 | 3 区分の排他と和・要確認 ⊆ 未整理を core の単体テストで固定する | 画面の DOM テストだけで確かめる | 定義の違反を最も小さい単位で見つけられる | core のテストが区分の定義の正本を映す |
| qa-classify-maintenance-ops-web-003 | テストは旧実装で落ちることを確かめてから確定する | 新実装で緑になれば確定する | 何も調べていない緑を防ぐ | 旧実装に当てる手順が 1 つ増える |
| qa-classify-maintenance-ops-web-002 | テストと文書のパスを 3 本と 3 種に決める (agent 推定・利用者未確認) | 既存のテストに追記する | 仕分けの新しい契約の置き場所が明確になる | 既存テストとの重複を整理する |
| qa-classify-maintenance-ops-web-003 | バッジと月次クローズと画面の件数を同じ関数から出すことをテストで固定する | 各所の件数を個別に確かめる | 3 か所のずれを 1 つの検査で見つけられる | 対象の集合 (期間・照合待ち・保留) を仕様で決めておく |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI → Migrate → Deploy。
- Migration sequence: core の単体テスト (旧実装で落ちることの確認) → core の実装 → API 統合テスト → API の実装 → DOM テスト → 画面の実装 → 既存テストの付け替え → 文書の更新 (`docs/data-schema.md` に 2 表と列、`docs/ui-decisions.md` と `docs/classify-screen/design-decisions.md` に画面の決定)。
- Rollback trigger/procedure: CI が落ちたら差し戻す。配信後の不具合は Worker と web を直前版へ戻す。

## Risks and verification

- Risk/assumption: 既存の `classification-progress-contract.test.ts` と `classification-progress.dom.test.tsx` は現行の『未確認 = clsSrc 既定』の数え方を固定している。付け替えのときに期待値を新しい区分へ変えるが、変えた理由を文書に残さないと契約を緩めたのか定義を変えたのか区別できない。
- Risk/assumption: `verify:full` はローカルの vite 4175 を前提にし、起動していないと接続拒否で落ちる。CI とローカルで実行の前提を分けて記録する。
- Architecture fitness test: 追加テストの件数と対象の件数が 0 でないこと。3 区分の和が全件に一致すること。
- Load/failure/security validation: 一括保存 100 件・3 年分のプレビューの統合テストが CI の時間内に収まること。
