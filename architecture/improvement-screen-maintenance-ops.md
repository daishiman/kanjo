---
graph_node_id: "arch-improvement-screen-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "改善リクエスト — 既存の品質ゲートを全て緑に保ち、0057 の適用前バックアップと戻し方を runbook に置き、夜間の完全消去の件数を個人情報なしの JSON ログで追えるようにする"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement", "maintenance-ops"]
file_path: "architecture/improvement-screen-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "9378171d665ec4a5fa5a26108bf44c7fb507274d6e423ea1798da20ef2937582"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "9378171d665ec4a5fa5a26108bf44c7fb507274d6e423ea1798da20ef2937582", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure"]
resource_scope: ["package.json", "packages/web/package.json", "docs/improvement-request.md", "docs/runbooks", "docs/ci-cd-operations.md", "architecture/arch-improvement-request-pipeline.md", "packages/core/src/improvement.ts", "packages/web/src/pages/Improvement.tsx", "packages/api/src/improvement-retention.test.ts", "packages/api/src/improvement-lifecycle.test.ts", "packages/api/src/scheduled-maintenance-budget.test.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/improvement-screen-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:47:00Z"}
serves_goals: ["G1", "G4"]
---

# Architecture overview

改善リクエスト — core・API・DOM のテストを足したうえで、`pnpm lint`・`typecheck`・`test`・`skills:test`・初期 JS 予算・`verify:full` を全て緑にする。0057 は表を作り直すので、D1 のバックアップ → migration → Worker のデプロイの手順と失敗時の戻し方を runbook に置く。`docs/improvement-request.md` を新しい画面・論理削除・完全消去に合わせて更新する。夜間の完全消去の結果 (対象件数・消した件数・失敗件数) は、既存の job ごとの JSON ログに本文・利用者 ID・R2 のキーを載せずに出す (qa-imp-maintenance-ops-web-001、qa-imp-decision-008)。`system-spec/maintenance-ops.md` は承認時入力、本書は検証の配分・運用文書・ログの制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 品質ゲートは root の `package.json` の `test` (:20、`test:aux` で `skills:test` も走る)・`typecheck` (:23)・`lint` (:24)・`skills:test` (:36)・`verify:full` (:40)。web の `build` (`packages/web/package.json:9`) は `build:bundle` → `check:js-budget` → `strip:manifest` の順で、初期 JS 予算は `build:bundle` の直後でしか測れない。`verify:full` は 4175 の vite が前提で、CI の headless Chrome は `pointer:none` である。改善要望の運用文書は `docs/improvement-request.md` (141 行) と `architecture/arch-improvement-request-pipeline.md`。夜間 job の結果は `packages/api/src/index.ts` で job ごとの JSON ログとして出る (`improvement_retention` は :290-307) (qa-imp-maintenance-ops-web-evidence-001)。
- 現状との差分: `packages/web/src/pages/Improvement.tsx` は 255 行の 1 ファイルで、`pages/improvement/` はまだ無い。`docs/improvement-request.md` の 1.4「添付はいつ消えるか」(:59) と 2.1「削除ジョブの相乗り先」(:69) は、完了から 30 日の添付の消去だけを書いている。`docs/runbooks/` に 0057 の手順は無い。`docs/ci-cd-operations.md:433` は `improvement_retention` を「改善要望の添付削除」と説明している。
- Quality attribute priorities: G1・G4 に資する。Google SRE (operations) に従い、不可逆な手順を runbook に書き、夜間処理の結果をログから追えるようにする。Clean Code card の『Appropriate abstraction / DRY』『Executable examples』『Continuous refactoring』を検証の配分と分割の進め方に適用する (章の適用記述。agent 推定・利用者未確認)。
- Constraints: vitest の expect (vitest-expect 5.0.1、2026-09-23 確認)。public repository のため実データをテスト・runbook・ログの例へ含めない (C4)。

## Goals and non-goals

- Goals:
  - G1: O1 の DOM テスト (画像の構成要素の存在と操作) を通す。
  - G4: O4 の API テスト (削除→元に戻す、削除中 0 件、他人 404、30 日の完全消去、バックアップの対象外) と、既存ゲート全ての exit 0。
  - G4: 0057 の適用前バックアップ・適用・デプロイ・戻し方を runbook に置く。
  - G4: 夜間の完全消去の件数をログで追えるようにする。
- Non-goals:
  - 新しい描画検査 script (`check:*`) の追加。章は `verify:full` への新しい検査を決めていない
  - 品質ゲートの閾値 (JS 予算など) の変更
  - 外部の監視サービスやアラートの追加

## System context and boundaries

- Users/external systems: 開発者 (ローカルの `pnpm` 系)、GitHub Actions (`ci.yml`・`deploy.yml`・`migrate.yml`)、運用者 (runbook を読み、`migrate.yml` を手動で起動する)、Cloudflare のログ (夜間 job の JSON ログを読む場所)。
- Trust/deployment/data boundaries: runbook とテストの fixture は public repository に載るので、実データ・実際の利用者 ID・R2 のキーを書かない。本番 D1 を変える操作は `migrate.yml` の `APPLY` 確認を通す。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core の単体テスト (`packages/core/test/`) | 状態の遷移・概要・番号・件数・関連・マスクを例で固定する | vitest | packages/core | CI |
| API テスト (`packages/api/src/improvement-*.test.ts`) | 境界 (404・400・論理削除・完全消去・バックアップの対象外) の観測できる結果 | vitest | packages/api | CI |
| DOM テスト (`packages/web/src/*.dom.test.tsx`) | 画像の構成要素の存在と操作 | vitest + DOM | packages/web | CI |
| 既存ゲート (`package.json` の lint〜verify:full) | 用語・秘匿・型・予算・描画の既存検査 | pnpm scripts | repo | ローカル / CI |
| runbook (`docs/runbooks/`) | 0057 の適用前バックアップ・適用・デプロイ・戻し方 | Markdown | docs | repo |
| 運用文書 (`docs/improvement-request.md`、`architecture/arch-improvement-request-pipeline.md`) | 利用者向けの保持期限の説明と、運用向けのジョブとログの説明 | Markdown | docs | repo |
| 夜間の JSON ログ (`index.ts` の `improvement_retention`) | 完全消去の対象件数・消した件数・失敗件数 | `console.log(JSON.stringify(...))` | packages/api | api Worker |

## Cross-cutting contracts

- Identity/access: N/A: 運用手順は新しい権限を足さない。本番 D1 の変更は `migrate.yml` の既存の確認 (`APPLY`・`approved_manifest`) による。
- Errors/resilience: runbook に、0057 の適用が途中で失敗したときに Time Travel の復元地点へ戻す手順と、`EXPECTED_D1_MIGRATION` が設定画面の 0056 を指す旧版を出す手順を書く。
- Observability/audit: 夜間ログの `improvement_retention` に完全消去の 3 つの件数を足す (項目名は backend 側で決める)。本文・利用者 ID・R2 のキー・トークンを載せない。`audit_header_retention` のログから `beforeBytes` が消えることを `docs/improvement-request.md` 2.2 または `docs/ci-cd-operations.md` に書く。
- Configuration/secrets: N/A: 新しい設定・秘密情報を持たない。
- Compatibility/versioning: `docs/improvement-request.md` の見出し番号 (1.1〜2.4) は他文書から参照されうるので、節を足す場合も既存の番号を崩さない (推定。参照元の全件は未確認)。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/improvement-screen-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/improvement-screen-backend.md`)
- Infrastructure: 下記 Operations architecture と Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/improvement-screen-database.md`)
- Security: N/A: 本章の関心外 (`architecture/improvement-screen-security.md`)

### Operations architecture

#### Fixture authority

テストの例は core の定数 (`IMPROVEMENT_RETENTION_DAYS` など、`packages/core/src/improvement.ts:55-82`) から作り、同じ値をテストに書き写さない。マスクの例に使う取引先名・名義・口座・電話・住所は架空の値にする (C4)。ローカルの seed で `samples/*.csv` を直接直さない。

#### Documentation upkeep

`docs/improvement-request.md` を次のとおり直す。1.1 に件名欄の廃止・本文 1000 字・プライバシー確認 2 つ、1.4 に論理削除と『元に戻す』・削除から 30 日の完全消去、2.1 に完全消去の相乗りと予算の回し方 (audit_header_retention 3→2、improvement_retention 3→4)、2.2 にログの新しい件数、2.4 に `pages/improvement/` と 0057 を足す。`docs/ci-cd-operations.md:433` の説明に完全消去を足す。`architecture/arch-improvement-request-pipeline.md` は本書群 (`architecture/improvement-screen-*.md`) への参照を足す (推定。既存文書をどこまで書き換えるかは章が決めていない)。

#### Regression scope

core は判定を例で固定し、API は境界の観測結果だけを見て、DOM は画像の構成要素の存在と操作だけを見る。状態の遷移・概要・番号・件数・関連・マスクが web と api に無いことを grep で 0 件と確かめる (O3)。`Improvement.tsx` は一度に書き換えず、`pages/improvement/` へ部品ごとに移し、1 回ごとに lint・typecheck・test を緑にしてから次へ進む。既存テストのうち、現行の仕様を固定しているもの (本文 4000 字、画像だけを落とす扱い、`wontfix`、予算の 3 本、`EXPECTED_D1_MIGRATION` の 0052) は新しい仕様に合わせて書き換え、書き換えた理由をテスト名に残す。

#### Operations verification

`pnpm lint`・`pnpm typecheck`・`pnpm test` (`skills:test` を含む)・`pnpm --filter @kanjo/web build` (JS 予算)・`pnpm verify:full` が全て exit 0 (O4)。`verify:full` は 4175 の vite を起動してから走らせる。CI の headless Chrome は `pointer:none` なので、`(pointer: fine)` に頼る表示を DOM テストで前提にしない。新しいテストは旧実装で落ちることを確かめる。

### Infrastructure architecture

#### Environments and topology

構成は変えない。ローカル (`wrangler dev` と 4175 の vite)、CI (`ci.yml`)、本番 (`deploy.yml`・`migrate.yml`)。

#### Compute and storage

N/A: 本章は計算資源と保存先を足さない。夜間処理の本数は `architecture/improvement-screen-infrastructure.md` による。

#### IaC and delivery

0057 の手順を runbook に書く。(1) Time Travel の復元地点を確かめる (`pnpm run db:checkpoint`、root `package.json` の `db:checkpoint`) 。(2) `migrate.yml` を `APPLY` と `approved_manifest` を付けて起動する。(3) `EXPECTED_D1_MIGRATION` を 0057 にした Worker をデプロイする。0057 は表を作り直すので `plan-auto-migration.mjs` の破壊的な判定に当たり、`deploy.yml` の自動適用には乗らない見込み (推定)。runbook の新しいファイル名は正本に無いので、`docs/runbooks/` 配下に置くことだけを決める (推定)。既存の `docs/runbooks/prod-d1-schema-recovery.md` と `templates/approved-pending-manifest.example.json` を参照する。

#### Secrets and access

N/A: 新しい秘密情報を持たない。本番 D1 への書き込みは GitHub Actions の既存の資格情報だけを使う。

#### Reliability and recovery

0057 の適用に失敗したら、Time Travel の復元地点へ戻し、取込画面の 0053 を前提にした旧 Worker の版をデプロイし直す。夜間の完全消去が失敗件数を出し続けたら、`docs/improvement-request.md` 2.3「失敗が続くときの切り分け」(:116) の手順に完全消去の項を足して切り分ける。

#### Infrastructure verification

`scheduled-maintenance-budget.test.ts` のログ検査 (:257) で、`improvement_retention` のログに完全消去の 3 件数があり、本文・利用者 ID・R2 のキーが無いことを確かめる。`runbooks:test` (root `package.json` の `test:aux`) は緑のまま。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-maintenance-ops-web-001 | core・API・DOM のテストを足し、既存ゲートを全て緑にする | 新規テストだけ緑 | 既存の用語・秘匿・予算・描画の検査が画面の作り直しを見張る | `verify:full` の時間は変わらない (新しい検査を足さない) |
| qa-imp-maintenance-ops-web-001 | 0057 の適用前バックアップ・適用・デプロイ・戻し方を runbook に書く | PR の説明だけに書く | 表の作り直しは不可逆で、手順を repo に残す必要がある | runbook が 1 本増える |
| qa-imp-maintenance-ops-web-001 | `docs/improvement-request.md` を更新する | 新しい文書を作る | 利用者と運用者が既に読む場所に置く | 1.4 と 2.1〜2.4 を書き換える |
| qa-imp-decision-008 | 完全消去の件数を既存の JSON ログに足し、個人情報を載せない | 別のログ job / 外部の監視 | 既存の読み方 (2.2 の確認手順) のまま追える | `audit_header_retention` のログから `beforeBytes` が消える |
| qa-imp-maintenance-ops-web-001 (Clean Code card) | `Improvement.tsx` を `pages/improvement/` へ部品ごとに移す | 一度に書き換える | 1 回ごとにゲートを緑にでき、戻しやすい | 移行の途中で 2 つの置き場が一時的に並ぶ |

## Delivery, migration and rollback

- Build/deploy topology: `ci.yml` (PR ゲート) → `migrate.yml` (0057 の手動適用) → `deploy.yml` (Worker のデプロイ)。
- Migration sequence: runbook を先に入れる → core・API・DOM のテストと実装 → 0057 を手動で適用 → Worker をデプロイ → 翌晩のログで件数を確かめる → `docs/improvement-request.md` を最終の姿に合わせる。
- Rollback trigger/procedure: ゲートのどれかが赤なら PR を止める。本番で 0057 が壊れたら runbook の戻し方 (Time Travel の復元地点、取込画面の 0056 前提の旧版) に従う。

## Risks and verification

- Risk/assumption: 既存テストを新しい仕様へ書き換えるときに、契約を緩めて緑にしてしまう。書き換えたテストが旧実装で落ちることを確かめる。
- Risk/assumption: `verify:full` は 4175 の vite が起動していないと `check:financial-routes` が接続拒否で落ちる。失敗を画面の不具合と取り違えない。
- Risk/assumption: 空の `*.test.ts` を置くと vitest が失敗し `verify:full` を止める。デバッグ用のテストは repo に置かない。
- Architecture fitness test: web と api に core の判定の写しが無いこと (grep で 0 件、O3)。`docs/improvement-request.md` の保持期限の記述が core の定数 (30 日) と一致すること。
- Load/failure/security validation: `security:content` (lint の中) で runbook とテストに実データが無いこと。夜間ログのテストで個人情報が載らないこと。
