---
graph_node_id: "arch-total-cashflow-screen-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "総収支画面 — 規則の docs とテストによる固定と回帰検証"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "maintenance-ops"]
file_path: "architecture/total-cashflow-screen-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "5b14f0bb88713c5578abf9aea6d803f4aa8f9618d5bdfd3a3c4c71571750aef7"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "5b14f0bb88713c5578abf9aea6d803f4aa8f9618d5bdfd3a3c4c71571750aef7", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["spec-total-cashflow-screen", "arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure"]
resource_scope: ["package.json", "packages/web/package.json", ".github/workflows/ci.yml", "packages/core/test/total-cashflow-contract.test.ts", "packages/api/test/total-cashflow-verdict.integration.test.ts", "packages/web/test/total-cashflow-table.dom.test.tsx", "packages/api/src/deletion-schema.test.ts", "packages/api/src/import-lifecycle-pure.test.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-screen-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T14:50:54Z"}
serves_goals: ["G4", "G5"]
---

# Architecture overview

総収支画面 — 規則の docs とテストによる固定と回帰検証。正本は `system-spec/maintenance-ops.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-total-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-maintenance-ops-web-tc-observed-001。ルート package.json の verify:full (pnpm test → typecheck → lint → build → web の check:thead / check:mobile-layout / check:financial-figure / check:financial-routes / check:analysis-hub → preview:smoke) と design-system:fast がある。lint は biome・check-design-tokens・check-design-system-document-contract 等を束ね、CI (ci.yml) が lint/typecheck/test/build を実行する。消し込みの不変条件は packages/core/test/total-cashflow-contract.test.ts、判定の保存は packages/api/test/total-cashflow-verdict.integration.test.ts、画面は packages/web/test/total-cashflow-table.dom.test.tsx が既に検査している。
- Quality attribute priorities: G4 と G5 に資する。doctrine は Google SRE operations (判定規則の docs とテストを同じ変更で更新する手順、取消できない誤操作が起きた場合に操作履歴から前後の値を確認できること、文言変更は e2e の期待値と同時に直す)。
- Constraints: 既存の 3 本のテストを緑のまま拡張する。migration は追加のみ。

## Goals and non-goals

- Goals:
  - G4: migration で既存除外の reason が memo へ移ること、取消と復元の規則を統合テストで固定する。
  - G5: 一致度・判定作業の 3 区分・自動一致の扱い・前年同期比の null 規則を docs に明記し、境界値テストで固定する。共通シェルの文言変更を期待値に持つテストを同じ変更で更新する。
- Non-goals:
  - 新しい CI ワークフローや監視の追加
  - coverage や lint スコアの目標化

## System context and boundaries

- Users/external systems: 開発者と CI (GitHub Actions ci.yml)。
- Trust/deployment/data boundaries: 検証はローカルの verify:full と CI で行い、本番データに触れない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| verify:full | test・typecheck・lint・build・web の check 系・preview:smoke を順に実行 | ルート package.json | リポジトリ | ローカル・CI |
| core 契約テスト | 消し込みの不変条件・一致度・区分・前年同期比の境界値 | total-cashflow-contract.test.ts | packages/core | CI |
| API 統合テスト | 判定・除外・取消・migration 後の memo | total-cashflow-verdict.integration.test.ts | packages/api | CI |
| web DOM テスト | 表・3 ペイン・選択バー・共通シェルの文言 | total-cashflow-table.dom.test.tsx | packages/web | CI |
| スキーマ・復元テスト | EXPECTED_D1_MIGRATION と 3 表の復元 | deletion-schema.test.ts・import-lifecycle-pure.test.ts | packages/api | CI |

## Cross-cutting contracts

- Identity/access: N/A: 保守手順は権限を変えない。
- Errors/resilience: 取消できない誤操作は操作履歴の前後の値で確認する。
- Observability/audit: 規則の変更は docs とテストの同時更新で追跡する。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存テストを緑のまま拡張し、旧実装では落ちる形にする。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

検証の環境はローカルの verify:full と GitHub Actions の ci.yml の 2 つ。本番環境の構成は infrastructure 章 (`architecture/total-cashflow-screen-infrastructure.md`) に従い、本章は変えない。

#### Compute and storage

N/A: 保守手順は計算資源・保存先を追加しない。

#### IaC and delivery

ci.yml の lint/typecheck/test/build を緑に保つ。check:financial-routes / check:mobile-layout の対象に /analysis/total-cashflow が含まれるかを確認し、無ければ追加して狭幅の横スクロールを検査する。文言変更 (防衛ライン・毎朝バックアップ) は、その文言を期待値に持つテストがあれば同じ変更で更新する (qa-total-cashflow-decision-010)。

#### Secrets and access

N/A: 検証で秘密情報を追加しない。

#### Reliability and recovery

Clean Code card の『規則は名前と境界値テストで読めるようにする』を適用する。一致度の配点 (金額 40・日付 30/20/10/5/0・口座 15/8/0・摘要 15/8/0)、3 区分の境界、前年同期比の null 規則、取消の対象範囲を docs と core の単体テストで固定し、数値は名前付き定数にする (qa-backend-web-tc-inference-006)。3 表のバックアップと復元を 0040 の前例が触れた全ての箇所に揃え、復元テストで 3 表が復元時点へ戻ること、key の無い旧バックアップでは既存の行が残ることを固定する (qa-total-cashflow-decision-018・qa-infrastructure-web-tc-observed-003/004・qa-database-web-tc-inference-006)。

#### Infrastructure verification

境界値テストの一覧: 日付差 3 日と 4 日、候補 1 件と 2 件、前年同期の月が 1 か月欠ける場合、続けて 2 回取り消す場合、同じ操作 id を 2 回送る場合、古い id を送る場合、唯一の候補を除外した月ずれ明細が要確認から出る場合、除外の前後で事業/家計の内訳が入れ替わる場合、自動一致の組で摘要だけが違う場合。いずれも旧実装では落ちる形にする。migration 後に既存除外の reason が memo へ移ることを統合テストで確かめる。pnpm test / typecheck / lint と packages/web の check 系スクリプトが全て緑であること (O5)。出典は cloudflare-d1-migrations (2026-06-08)。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-total-cashflow-decision-007 | 一致度を規則で算出して表示 | 数値を出さない | 配点の合計として説明でき docs とテストで固定できる | 配点を名前付き定数と境界値テストにする |
| qa-total-cashflow-decision-012/016 | 自動一致の一致度を規則どおり表示し一覧名を改める | 常に 100% / 画像の文言を残す | 表示と説明が矛盾しない | 一覧名・説明文・docs の語を揃える |
| qa-total-cashflow-decision-013/017 | 取消は 1 つ前へ遡り、画面を開いている間だけ | 直前 1 回だけ / 上限なし / 当日 | 古い判定を誤って戻す危険が小さい | 連続取消と古い id のテストが要る |
| qa-total-cashflow-decision-014/015 | 除外後は MF の公私仕分けに従い、唯一の候補なら集計へ | 事業/家計を引き継ぐ / 要確認に残す | core の集計規則を大きく変えない | 内訳の入れ替わりと要確認から出る境界テスト |
| qa-total-cashflow-decision-010 | 共通シェルの文言を画像に揃える | 現状のまま | 全画面で文言が揃う | 文言を期待値に持つテストを同時に更新 |
| qa-total-cashflow-decision-018 | 3 表をバックアップと復元に加える | 判定と除外だけ / 加えない | 復元しても判断と履歴が戻る | 復元テストを足す |

## Delivery, migration and rollback

- Build/deploy topology: 変更は verify:full と CI を緑にしてから配備する。
- Migration sequence: docs と core テスト → core 実装 → migration と API 統合テスト → 画面と DOM テスト → check 系スクリプトの対象確認。
- Rollback trigger/procedure: 回帰が見つかったら直前のビルドへ戻し、該当の境界値テストを先に足してから直す。

## Risks and verification

- Risk/assumption: 適用文 (Clean Code) と境界値の一覧はアシスタント推定。import-lifecycle-pure.test.ts の routeSources と db/schema.ts が変更箇所に明記されていない (findings low)。check 系スクリプトの対象に総収支の route が入っているかは未確認。
- Architecture fitness test: 配点・区分境界が名前付き定数であること、docs と core テストの規則が一致すること。
- Load/failure/security validation: 旧実装で境界値テストが落ちることを検算する。
