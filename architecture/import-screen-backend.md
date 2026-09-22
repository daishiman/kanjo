---
graph_node_id: "arch-import-screen-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "データ取込 — 検査と確定を 2 経路に分け、状態・要約・結果・上限値を core の import-screen.ts 1 か所で導く"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["import-screen", "backend"]
file_path: "architecture/import-screen-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f1e820c99e3f8424452e73decb691a16873c228b6f14aff5b491081f07d05755"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "f1e820c99e3f8424452e73decb691a16873c228b6f14aff5b491081f07d05755", "imported_at": "2026-09-21T22:53:09Z"}
created_at: "2026-09-21T22:53:09Z"
updated_at: "2026-09-21T22:53:09Z"
depends_on: ["spec-import-screen"]
related_nodes: ["arch-import-screen-ui-ux", "arch-import-screen-frontend", "arch-import-screen-database", "arch-import-screen-auth", "arch-import-screen-security", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops"]
resource_scope: ["packages/api/src/routes/imports.ts", "packages/api/src/routes/deletions.ts", "packages/api/src/import-pipeline.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/import-diff.ts", "packages/api/src/import-active.ts", "packages/api/src/import-history-discard.ts", "packages/api/src/import-lifecycle.test.ts", "packages/api/src/import-pipeline.test.ts", "packages/core/src/index.ts", "packages/core/src/identity.ts", "packages/core/src/csv.ts", "packages/core/src/subs.ts", "packages/core/src/total-cashflow.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/import-screen-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:53:09Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5", "G6"]
---

# Architecture overview

データ取込 — 検査と確定を 2 経路に分け、状態・要約・結果・上限値を core の import-screen.ts 1 か所で導く。`system-spec/backend.md` は承認時入力、本書は判定の置き場所と API 契約の制約を持つ。契約と規則の正本は `specs/spec-import-screen.md` (spec-import-screen) の API契約の節とビジネスルールと検証の節。

## Context and drivers

- Business/technical context: 作り直し前は `packages/api/src/routes/imports.ts` の `POST /imports` がファイルを直接確定し、force・keepOnShrink・resolutionPlan を読んでいた (qa-imp-backend-web-evidence-001)。現行は検査と確定を分け、新画面は `POST /imports/inspections` と `POST /imports/runs` を使う。旧 `POST /imports` は API 互換とローカル seed 用だけに残し、新画面は呼ばない。取込は `import_writer_claims` で直列化され、同時実行は 409 `import_busy` になる。
- Quality attribute priorities: G1〜G6 に資する。Clean Architecture の Dependency Rule (core ← api ← web) と data-access の境界 (永続化を route 側に閉じる) を適用する。
- Constraints: packages/core は依存ゼロの純関数。Cloudflare Workers (Hono) + D1 + R2。対象は freee と マネーフォワードの CSV で、銀行・カードは扱わない (qa-imp-decision-001)。

## Goals and non-goals

- Goals:
  - G3: ファイルの状態・検証の段階・取込可否・内容確認の要約・取込 1 回の結果 (全ファイル成功=成功、1 件以上成功かつ 1 件以上失敗=一部成功、全失敗=失敗) を `packages/core/src/import-screen.ts` (新設) の純関数に置く。上限値 (1 ファイル 25MB・10 ファイル・合計 30MB・展開後 1 ファイル 60MB・エントリ数 1,000 件) も同じファイルの定数 `IMPORT_LIMITS` に 1 か所だけ置き、超過の理由を返す判定関数を core に置く。
  - G2: `POST /imports/inspections` (検査)・`POST /imports/inspections/:id/files` (追加)・`DELETE /imports/inspections/:id/files/:fileId` (除外)・`POST /imports/runs` (確定) を足し、確定でファイルを再送させない (qa-imp-decision-003・-005・-008)。
  - G4: 前回データを残す=オンは MF 明細を mfStableKey、freee 取引を freeeDealKeys で既にある行を飛ばして新しい行だけを足し、オフは従来の月単位の入れ替えにする (qa-imp-decision-002)。
  - G5: `GET /imports/runs` で取込 1 回を 1 行、`GET /imports/runs/:id` で影響の 3 数値と含まれるファイルを返す。再取込・取り消し (30 日)・原本の取得は既存の経路を取込単位へ束ねる。一括削除は履歴の記録だけを消す (qa-imp-decision-004)。
- Non-goals:
  - 銀行・クレジットカードの明細の取込
  - MF 資産推移と JSON 復元の行単位の追加 (従来の動作のまま)
  - キュー・外部サービスの追加

## System context and boundaries

- Users/external systems: web (データ取込画面)。R2 (`FILES`) に原本と仮置きを置き、D1 に記録を持つ。
- Trust/deployment/data boundaries: core は D1 も R2 も知らず、パース結果・検査の記録・既存の同一性の鍵・現在時刻だけを受け取る。route が D1 と R2 を読み書きし、判定は core へ渡して JSON へ写すだけにする。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core `IMPORT_LIMITS` と超過判定 (新設) | 上限値の 1 か所と、ファイルの大きさと数 (追加では既存の項目を含む) から超過の理由を返す | 定数 + 純関数 | packages/core | web と Worker |
| core 状態・段階・取込可否 (新設) | ファイルごとの状態と検証の段階を記録から 1 つに決める | 純関数 | packages/core | 同一 Worker |
| core 要約・結果 (新設) | 内容確認の 7 項目と取込 1 回の結果 3 区分 | 純関数 | packages/core | 同一 Worker |
| `POST /imports/inspections` | 1〜10 ファイルを受け、順に検査して R2 に 24 時間仮置き、検査 ID とファイル項目を返す | Hono route | packages/api | Worker |
| `POST /imports/inspections/:id/files` | 同じ検査 ID へ追加 (累計で上限判定) | Hono route | packages/api | Worker |
| `DELETE /imports/inspections/:id/files/:fileId` | 確定前の項目を外す | Hono route | packages/api | Worker |
| `POST /imports/runs` | 検査 ID・ファイル項目 ID・前回データを残す・強制再取込で確定 | Hono route | packages/api | Worker |
| `GET /imports/runs` / `GET /imports/runs/:id` | 取込 1 回の一覧と詳細 | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 全経路が `/api/*` のセッションのフェンス配下で、利用者 ID で行を絞る (`architecture/import-screen-auth.md`)。
- Errors/resilience: 上限超過は 413 `payload_too_large`、レート超過は 429 `rate_limited` と Retry-After、他人・期限切れの ID は 404 `not_found`、クエリ予算超過と同時実行は 409。エラー応答に内部の SQL・スタックを含めない。
- Observability/audit: N/A: 新しい信号を足さない。取込 1 回の記録 (`import_runs`) と影響の 3 数値が監査の役を兼ねる。
- Configuration/secrets: 追加の秘密情報を持たない。上限値は環境変数ではなく core の定数に置く。
- Compatibility/versioning: 既存の `GET /imports`・`GET /imports/:id/original`・取り消しと破棄の経路は残し、取込単位の経路はそれを束ねる。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/import-screen-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/import-screen-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/import-screen-database.md`)
- Security: N/A: 本章の関心外 (`architecture/import-screen-security.md`)

### Backend architecture

#### Runtime and architecture pattern

判定は core、入出力は api の 2 層に分ける。web の送信前判定と api の 413 の判定 (hono/body-limit の maxSize を含む) はどちらも core の `IMPORT_LIMITS` と判定関数を import し、数値を書き写さない (qa-imp-backend-web-005、agent 推定)。

#### Domain and module boundaries

状態・段階・取込可否・要約・結果・上限は core の `import-screen.ts` に閉じ、api と web に同じ判定の重複実装を置かない。行単位の追加の同一性は既存の `core/identity.ts` の mfStableKey と freeeDealKeys に寄せ、api 側に同一性の規則を新しく書かない。『重複の可能性』は既存の duplicateMatchScore による二重計上候補の件数、『サブスク候補』は取込後の subsCandidates の新規件数とする。

#### API and service contracts

- 検査: ファイル数と 1 ファイルの大きさを本文を読んだ直後・パースの前に確かめ、1 ファイルずつ順にパース・検査して原本を R2 に 24 時間仮置きし、1 つの検査 ID とファイルごとの項目 (ファイル項目 ID・取込元・対象期間・サイズ・重複・バリデーション・明細数) を返す。
- 追加: 上限は検査 ID ごとの累計で 10 ファイル・合計 30MB まで。既にある項目のサイズを `import_inspection_files` から合計して判定し、この要求は検査のレート制限に数える (qa-imp-decision-008)。
- 確定: 検査 ID と取り込むファイル項目 ID と詳細設定を受ける。取込済みと同一内容 (content_hash が一致) のファイルは取込可能から外し、強制再取込のときだけ含める。
- 一覧と詳細: 取込 1 回を 1 行、詳細は影響の 3 数値 (新規追加・重複スキップ・サブスク候補) と含まれるファイル。一括削除は 1 要求 100 件まで (qa-imp-decision-010)。

#### Data and transaction behavior

確定は既存の書込の直列化 (`import_writer_claims`) の内側でファイルを順に書き、先に全ファイルのクエリ予算を合算して上限を超えるなら 1 件も書かずに 409 を返す。影響の 3 数値は確定時の値として `import_runs` に残す。検査は明細を 1 行も書かず、仮置きと検査の記録だけを残す。表と列の定義は `architecture/import-screen-database.md`。

#### Async processing

N/A: キューや遅延処理は無い。検査は 1 要求の中で 1 ファイルずつ順に処理する。期限切れの仮置きの片づけは既存の夜間保守 (cron) に載せる (`architecture/import-screen-infrastructure.md`)。

#### Security and resilience

合計 30MB は本文を読む前に hono/body-limit で、ファイル数と 1 ファイル 25MB は本文を読んだ直後・パースの前に、エントリ数 1,000 件と展開後 60MB は展開の前に止める (qa-imp-decision-006・-007・-009・-011)。同時に展開するのは 1 ファイルだけにする。レート制限と Origin の検査は入口に置く。詳細は `architecture/import-screen-security.md`。

#### Operations and verification

core 単体テストで状態・段階・取込可否・要約・結果 3 区分を `toBe` で固定する。API テストで、検査が明細を書かないこと、確定が検査 ID だけで取り込むこと、期限切れ・他人の検査 ID が拒否されること、確定応答消失後の同一選択の再送が二重取込せず同じ結果を返すこと、確定開始後の追加・削除が 404 になること、エラーのファイルが確定から外れること (O2)、前回データを残すのオンとオフの行数 (O4)、影響の 3 数値と一括削除後に明細が残ること (O5) を確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-decision-003 | 検査で仮置きし、確定は検査 ID だけで行う | 1 要求で即時書込 (現行) | 確かめてから取り込め、再送が要らない | 仮置きの期限と片づけが要る |
| qa-imp-decision-005 | 1 要求に検査 ID を 1 つ、ファイルごとの項目を持つ | 1 ファイル 1 検査 | 1 回の取込 = 1 検査 ID = 履歴 1 行が揃う | 項目 ID の検証が要る |
| qa-imp-backend-web-005 | 規則と上限値を core の `import-screen.ts` に置き、web と api が import する (agent 推定) | api と web にそれぞれ判定を書く | 判定の重複実装 0 件 (G3/S3) | core の変更が両方に効く |
| qa-imp-decision-002 | 前回データを残す=オンは既存の鍵で行単位の追加 | 月単位の入れ替えのみ | 同一期間の既存明細を残せる | 重複スキップの件数を数える |
| qa-imp-decision-008 | 同じ検査 ID へ追加でき、上限は累計 | 全ファイルを送り直す | 再試行の再アップロードが要らない | 追加経路が 1 本増える |
| qa-imp-decision-004 | 履歴は取込 1 回 1 行、一括削除は記録だけ | ファイル単位・明細も消す | 取り消しと片づけの意味が分かれる | 明細を戻すには各行の取り消しを使う |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) と packages/core のビルド。
- Migration sequence: core の `import-screen.ts` (上限・状態・要約・結果) → migration 0050 以降の表と列 (`architecture/import-screen-database.md`) → 検査と追加・除外の経路 → 確定の経路 → 取込 1 回の一覧と詳細 → web の切替 → 旧 `POST /imports` の即時取込の扱いを仕様書の互換性の節に従って決める。
- Rollback trigger/procedure: core / API テストが落ちたら差し戻す。表と列は追加だけなので、旧 Worker に戻しても新しい表を読まないだけで壊れない。

## Risks and verification

- Risk/assumption: 上限値が web と api に二重に書かれると、送信前の判定と 413 が食い違う。数値リテラルの字面検査で固定する (`architecture/import-screen-maintenance-ops.md`)。
- Architecture fitness test: core が D1 / R2 / Hono の型を参照しないこと。api の取込の経路に上限の数値リテラルが無いこと。
- Load/failure/security validation: 10 ファイル・合計 30MB の検査が CPU 時間とクエリ予算に収まること。確定のクエリ予算超過で 1 件も書かれないこと。
