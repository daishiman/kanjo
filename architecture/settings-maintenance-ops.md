---
graph_node_id: "arch-settings-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "設定 — 変更は追記のみの履歴で辿り、誤りは D1 全体を上書きせず設定の復元と元に戻すで直す"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "maintenance-ops"]
file_path: "architecture/settings-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "55b201ec86e261da7cb5fceb2ba2d639875931c7a72a259401e72e623add4452"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "55b201ec86e261da7cb5fceb2ba2d639875931c7a72a259401e72e623add4452", "imported_at": "2026-09-22T10:13:43Z"}
created_at: "2026-09-22T10:13:43Z"
updated_at: "2026-09-22T10:13:43Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-ui-ux", "arch-settings-frontend", "arch-settings-backend", "arch-settings-database", "arch-settings-security", "arch-settings-infrastructure", "arch-settings-auth"]
resource_scope: ["package.json", "packages/core/test", "packages/api/test/owner-labels.integration.test.ts", "packages/api/src/nightly-backup.test.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/web/src/settings-restore.dom.test.tsx", "packages/web/src/backup-restore.dom.test.tsx", "packages/web/src/pages/Settings.tsx", "packages/web/src/pages/settings/", "docs/data-schema.md", "docs/ui-decisions.md", "docs/settings-screen/", "docs/runbooks/prod-d1-schema-recovery.md", "scripts/hooks/guard-real-data.sh"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/settings-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-22T10:13:43Z"}
serves_goals: ["G3", "G4", "G5"]
---

# Architecture overview

設定 — 変更は追記のみの履歴で辿り、誤りは D1 全体を上書きせず設定の復元と元に戻すで直す。`system-spec/maintenance-ops.md` は承認時入力、本書は変更の追跡・バックアップの失敗の知らせ方・設定の誤りの直し方・テストの置き場所・文書の更新の制約を持つ。確定内容の正本は qa-settings-maintenance-ops-web-003 と決定 qa-settings-decision-007・008。

## Context and drivers

- Business/technical context: 設定変更の監査記録は無い (`packages/api/src/audit-log.ts` の action は delete / undo / import_resolution に限る)。夜間バックアップの失敗は画面に出る経路が無い。既存テストに `packages/web/src/settings-restore.dom.test.tsx`・`packages/web/src/backup-restore.dom.test.tsx`・`packages/api/test/owner-labels.integration.test.ts` がある。前例 (予算) は `docs/budget-screen/` に設計判断と証拠を置く。`verify:full` はローカルの vite (4175) を前提にする (qa-settings-maintenance-ops-web-evidence-001)。夜間バックアップの外形テストは `packages/api/src/nightly-backup.test.ts`。D1 の本番復旧は `docs/runbooks/prod-d1-schema-recovery.md`。
- Quality attribute priorities: G3・G4・G5 に資する。Google SRE の operations (設定の変更を追記のみの履歴で辿れ、バックアップの失敗を画面で知らせ、設定の誤りは D1 全体を上書きせずに設定 JSON の復元か直前値へ戻す手順で直す。障害時の最後の手段として D1 Time Travel を残す) を適用する (https://sre.google/workbook/、https://developers.cloudflare.com/d1/reference/time-travel/)。本章での適用は Test pyramid とし、意味は core の単体テスト、保存・復元・認可・scheduled は API 統合テスト、画面の構成と下書きは DOM テストに置く。
- Constraints: migration は追加のみ (C3)。既存の設定機能のテストを緑のまま保ち、`verify:full` を緑にする (S5・O5)。実データをテストに持ち込まない (`scripts/hooks/guard-real-data.sh`)。緑にするために契約を緩めない。

## Goals and non-goals

- Goals:
  - G3: 設定の変更を追記のみの変更履歴に 変更前・変更後・更新者・日時 で残し、誰がいつ何を変えたかを辿れるようにする (qa-settings-decision-008)。
  - G4: 夜間バックアップの失敗を一覧に『失敗』として出し、利用者が気づけるようにする (qa-settings-decision-007)。
  - G5: migration を追加のみにし、既存の設定機能のテストと `verify:full` を緑に保つ (qa-settings-maintenance-ops-web-003)。
  - G4: 設定だけの誤りは設定 JSON の復元か『元に戻す』で直し、D1 Time Travel は障害時の最後の手段に残す (agent 推定・利用者未確認、根拠 qa-settings-maintenance-ops-web-004)。
- Non-goals:
  - 新しい監視・アラート・メール通知・ダッシュボード
  - 変更履歴の保持期限の設計 (件数が少ない前提。`architecture/settings-database.md`)
  - 独自の migration 運用手順
  - E2E の実ブラウザ試験の追加 (既存の DOM テストと `verify:full` の範囲に留める)

## System context and boundaries

- Users/external systems: 開発者のローカル環境と GitHub Actions の CI。運用者は利用者本人で、設定画面の一覧と変更履歴から状態を見る。
- Trust/deployment/data boundaries: テストは合成データだけを使う。本番の D1・R2 に触れない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 変更履歴表 | 追記のみの 変更前・変更後・更新者・日時・由来 (画面 / 復元 / 移行) | D1 | migrations | Cloudflare D1 |
| バックアップ一覧の状態 | 成功 / 失敗・メモ・要約を画面に出す (`architecture/settings-infrastructure.md`) | HTTP | packages/api | Worker |
| core の単体テスト (`packages/core/test` 配下) | 集計ルールの適用順・照合・現金上書きの 4 通り・設定 JSON の検証と差分と版の移行 | vitest | packages/core | CI |
| API 統合テスト | 409・履歴の追記のみ・元に戻す・復元の往復と拒否・401・413・フェンス・scheduled の状態 | vitest / Miniflare | packages/api | CI |
| DOM テスト | 画面の構成・未保存件数・下書きの復元・リセットと離脱の確認・既存機能の節の移設 | vitest + DOM | packages/web | CI |
| 文書 | `docs/settings-screen/` の設計判断と証拠、`docs/data-schema.md`・`docs/ui-decisions.md` の更新 | Markdown | リポジトリ | リポジトリ |

(文書の配置は agent 推定・利用者未確認、根拠 qa-settings-maintenance-ops-web-004。テストの具体のファイル名は実装時に決める)

## Cross-cutting contracts

- Identity/access: 認可のテストは `architecture/settings-auth.md` の検証項目に従う。
- Errors/resilience: 409・413・4xx の拒否と、復元の拒否で何も変わらないことをテストで固定する。
- Observability/audit: 設定の変更は変更履歴、バックアップの成否は一覧で見る。ログを読まないと分からない運用状態を増やさない。
- Configuration/secrets: N/A: テストと文書に秘密情報を使わない。
- Compatibility/versioning: 設定 JSON の版を上げるときは core に移行関数を置き、古い版の復元を 1 世代まで受ける (agent 推定・利用者未確認、根拠 qa-settings-maintenance-ops-web-002・-004)。既存テストの期待値を変えるときは変えた理由を文書に残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/settings-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/settings-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/settings-database.md`)
- Security: N/A: 本章の関心外 (`architecture/settings-security.md`)

### Infrastructure architecture

#### Environments and topology

- Environments: ローカル (wrangler dev + vite 4175) と CI。`verify:full` はローカルの vite を前提にする。
- Topology: 既存のまま。

#### Compute and storage

- Compute: CI の GitHub Actions ランナー。
- Storage: テストはメモリ上か一時的なローカル D1 と Miniflare の R2 を使う。

#### IaC and delivery

- IaC: N/A: 基盤の定義は `architecture/settings-infrastructure.md` の cron の 1 行だけ。
- Delivery: `ci.yml` で lint・typecheck・テストを通してから `migrate.yml` と `deploy.yml` へ進む既存の順。migration が途中で止まったときは Deploy の再実行で収束させる既存の手順に従う (agent 推定・利用者未確認、根拠 qa-settings-maintenance-ops-web-004)。本番の D1 の復旧は `docs/runbooks/prod-d1-schema-recovery.md` に従う。

#### Secrets and access

- Secrets: N/A: テストと文書に秘密情報を使わない。
- Access: 実データの持ち込みは `scripts/hooks/guard-real-data.sh` が止める。

#### Reliability and recovery

- 直し方の順: (1) 未保存の編集はリセット、(2) 1 つのルールの誤りは『このルールを元に戻す』で直前の保存値を下書きへ戻して保存 (決定 008)、(3) 設定全体の誤りは書き出した設定 JSON の復元か、バックアップ一覧の『比較』→『復元』(設定だけ、取引は消さない、決定 010)、(4) 取引を含む障害は D1 Time Travel を最後の手段にする (agent 推定・利用者未確認、根拠 qa-settings-maintenance-ops-web-004)。
- 回帰の検出: 追加するテストは旧実装 (1 ファイルの `Settings.tsx` と節ごとの `PUT /api/settings`) に当てて落ちることを確かめてから確定する。件数を固定する検査は対象が 0 件でないことも確かめる (本書の方針、既存の作り直しの前例に倣う)。
- Recovery: テストが落ちたら差し戻す。意味を変えるときは仕様を先に直す。

#### Infrastructure verification

CI で core・API・DOM のテストと lint・typecheck を通す。ローカルで `verify:full` を実行する。O3 (古い baseSavedAt の 409・履歴の追記のみ・元に戻す)、O4 (往復・拒否・退避 1 件・scheduled の状態と失敗・比較)、O5 (追加のみ・既存値の引継ぎ・401・413・外部送信 0 件・既存機能の DOM テスト) を観測点ごとにテストへ対応づけ、既知の逸脱・未実施は受入 PASS に数えない。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-settings-decision-008 | 設定の変更は追記のみの変更履歴で辿る | 行に更新日時・更新者の列だけ足す | 誰がいつ何を変えたかと直前値を 1 か所から出せる | 履歴は更新・削除されないことをテストで固定する |
| qa-settings-decision-007 | バックアップの失敗を一覧に『失敗』で出す | ログだけに残す | 利用者が画面で気づける | 失敗の記録を R2 に残す (`architecture/settings-infrastructure.md`) |
| qa-settings-maintenance-ops-web-003 | 既存の設定機能のテストを緑に保ち `verify:full` を緑にする | 作り直しに合わせて既存テストを消す | 画像外の既存機能が 1 つも消えないことを確かめられる | 移設の際にテストの参照先を直す |
| qa-settings-maintenance-ops-web-004 | 設定だけの誤りは復元と元に戻すで直し、Time Travel は最後の手段 (agent 推定・利用者未確認) | 誤りのたびに D1 を Time Travel で戻す | 取引を巻き戻さずに設定だけを直せる | 手順を `docs/settings-screen/` に残す |
| qa-settings-maintenance-ops-web-002 | 設定 JSON の版の移行関数を core に置き 1 世代まで受ける (agent 推定・利用者未確認) | 版違いを常に拒否する | 書き出したファイルが版上げ直後も使える | 2 世代前の JSON は拒否される |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI → Migrate → Deploy。
- Migration sequence: core の単体テスト (旧実装で落ちることの確認) → core の実装 → API 統合テスト → 追加 migration (0050 の次の番号から、C3) と API → DOM テスト → 画面の分割と既存機能の節への移設 → 文書の更新 (`docs/data-schema.md` に新表と列、`docs/ui-decisions.md` と `docs/settings-screen/` に画面の決定と証拠)。
- Rollback trigger/procedure: CI が落ちたら差し戻す。配信後の不具合は Worker と web を直前版へ戻す。migration は追加のみなので戻さない。

## Risks and verification

- Risk/assumption: 457 行の `Settings.tsx` を節ごとに分けると、`settings-restore.dom.test.tsx` と `backup-restore.dom.test.tsx` の参照先が変わる。期待値を緩めず参照先だけを直し、変えた理由を記録する。
- Risk/assumption: 既存の `backup-restore.dom.test.tsx` は、バックアップからの復元が初期移行と同じ `POST /api/restore` (全データ置換) に合流することを固定している。バックアップからの復元を設定だけにする (決定 010) とこの契約と衝突するため、契約を緩めて消すのではなく、変えた理由 (決定 010) を記録したうえで設定の復元の契約へ置き換え、初期移行の復元のテストは『その他の管理』側に残す。
- Risk/assumption: `verify:full` はローカルの vite 4175 を前提にし、起動していないと接続拒否で落ちる。CI とローカルで実行の前提を分けて記録する。
- Architecture fitness test: 変更履歴の表に UPDATE・DELETE を書く経路が無いこと。追加テストの件数と対象が 0 でないこと。
- Load/failure/security validation: 往復・拒否・失敗の記録のテストが CI の時間内に収まること。
