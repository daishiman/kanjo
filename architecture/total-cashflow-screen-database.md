---
graph_node_id: "arch-total-cashflow-screen-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "総収支画面 — 除外理由区分と操作履歴の D1 スキーマ"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "database"]
file_path: "architecture/total-cashflow-screen-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2ba109121f739e297f4606d918907edb59a493251a44ecf42584ba6042598649"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "2ba109121f739e297f4606d918907edb59a493251a44ecf42584ba6042598649", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["spec-total-cashflow-screen", "arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: ["migrations", "packages/api/src/db/schema.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/store.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/routes/imports.ts", "packages/api/src/schema-guard.ts", "packages/api/src/d1-limits.ts"]
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
classification_reason: "system-spec の database 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-screen-database.md"}]
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

総収支画面 — 除外理由区分と操作履歴の D1 スキーマ。正本は `system-spec/database.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-total-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-database-web-tc-observed-001。D1 (binding DB、drizzle-orm、packages/api/src/db/schema.ts)。判定は duplicate_verdicts (0036、user_id・tx_id・verdict、0037 で freee_key TEXT NULL を追加)、freee 側の二重登録除外は freee_deal_exclusions (0037、PRIMARY KEY (user_id, freee_key)、reason TEXT NOT NULL、created_at/updated_at)。最新 migration は 0040_review_snoozes_and_monthly_close_reviews.sql。集計値は保存しない (dec-aggregation-strategy-001)。毎日のバックアップは表を列挙して組み立て、判定・除外・操作履歴の表を含まない (qa-infrastructure-web-tc-observed-002)。
- Quality attribute priorities: G4 に資する。doctrine は Clean Architecture (freee_deal_exclusions の主キーと total_cashflow_operations の (user_id, created_at DESC) 索引で引き、取消照合を全件走査なしで行う) と Google SRE (追加だけの migration と既存行の移行で旧 Worker が新スキーマを読んでも壊れない順序、更新と履歴行を同じ batch)。設計知識は DDD card『永続化するのは利用者の判断であって派生値ではない』。
- Constraints: C5: migration は追加のみで既存データを失わず、migration gate と runtime schema guard を通す。 C3: 判断の再取込後の再適用を変えない。

## Goals and non-goals

- Goals:
  - G4: 除外理由を reason_code と memo に分け既存 reason を移す。操作履歴表を新設し条件付き取消を支える。3 表をバックアップと復元の対象に加える。
- Non-goals:
  - 一致度・区分・前期比・進捗など派生値の保存
  - MF 側の除外テーブル (qa-total-cashflow-decision-009)
  - 操作履歴の保持期限と古さの上限

## System context and boundaries

- Users/external systems: 総収支の route と、バックアップ・復元の経路が読み書きする。
- Trust/deployment/data boundaries: 全行を user_id で持ち、復元は 3 表を user_id 単位で入れ替える。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| duplicate_verdicts | same/different の判定 (既存) | D1 表 | packages/api | D1 |
| freee_deal_exclusions | freee 除外と reason_code・memo (reason は後方互換で残す) | D1 表 | packages/api | D1 |
| total_cashflow_operations | 判定・除外・戻す・取消の操作履歴 | D1 表 + 索引 (user_id, created_at DESC) | packages/api | D1 |
| migration 0041 | 列追加・既存行の移行・表と索引の新設 | SQL | migrations | migrate.yml の gate |
| バックアップ・復元の列挙 | 3 表のスナップショットと復元 write-set | store.ts・import-active.ts・import-lifecycle.ts・routes/imports.ts | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 取消は user_id と id の組で引き、他人の id や存在しない id は 404。
- Errors/resilience: 照合と batch の間に同じ id の 2 回目や別タブの新しい操作が割り込むと全ての文が 0 行になり、route は undone_at の更新件数 0 で 409 を返す。
- Observability/audit: 操作履歴が利用者の判断記録になる。items_json の自由文は取消に要る memo だけ。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: reason 列を残し、書込時は memo を正本として同じ値を入れる。旧バックアップに key が無ければ既存の行を残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: 下記 architecture-data.md を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

保存を足すのは利用者の判断そのものである除外理由の区分とメモ (qa-total-cashflow-decision-003) と、元に戻すための操作履歴 (qa-total-cashflow-decision-004) の 2 つに限る。規則は packages/core、スキーマは packages/api が所有する。

#### Logical and physical model

freee_deal_exclusions に reason_code TEXT NOT NULL DEFAULT 'other' (CHECK で transfer/internal/book_only/duplicate/other の 5 値) と memo TEXT を追加する。画面の表示語は 振替/内部移動/帳簿のみ/二重登録/その他。total_cashflow_operations は id TEXT PRIMARY KEY、user_id TEXT NOT NULL、kind TEXT NOT NULL CHECK (verdict/exclude/restore/undo)、items_json TEXT NOT NULL (対象ごとの操作前後の値。判定なら txId・before verdict/freeeKey・after、除外なら freeeKey・before 行の有無と reason_code/memo・after)、item_count INTEGER NOT NULL、undoes_id TEXT NULL、undone_at TEXT NULL、created_at TEXT NOT NULL。索引 (user_id, created_at DESC)。

#### Access and consistency

書込み 1 操作 = 判定/除外の更新と履歴 1 行を同じ D1 batch で行う。取消は、指定された id が user_id の一致する kind が undo でなく undone_at IS NULL の行のうち最新 (created_at の降順、同時刻は id の降順) の 1 行と一致するときだけ行う。照合の後に、対象の値の復元 → kind=undo (undoes_id=対象 id) の行の追加 → 対象行の undone_at の更新 の順の文を 1 つの D1 batch にし、3 種とも『対象行が存在し undone_at IS NULL で、対象より新しい kind が undo でない未取消行が同じ user_id に無い (NOT EXISTS)』条件付き。値の復元は、操作前に行が無かったものは DELETE … WHERE EXISTS、有ったものは INSERT … SELECT … WHERE EXISTS … ON CONFLICT DO UPDATE。出典は cloudflare-d1-batch (2026-06-22)。

#### Lifecycle and governance

操作履歴の保持は無期限で、利用者の判断記録のみ (集計値は保存しない方針と矛盾しない)。取消できる範囲 (画面を開いている間) は画面が持つ id の列で決まり、D1 側は古さの上限を持たない (qa-total-cashflow-decision-017)。undo の行は対象にならず、やり直しの経路は持たない (qa-total-cashflow-decision-013)。items_json は 1 操作最大 200 件で、D1_MAX_BOUND_PARAMS に合わせて分割する。

#### Migration and recovery

migration 0041 (番号は取込時点の main の最新 +1 で確定する) の追加のみで、既存行は memo = reason、reason_code = 'other' に移す。3 表を 0040 の前例が触れた全ての箇所に加える: JSON_SNAPSHOT_MUTATION_CONSUMERS、復元 write-set の DELETE と insertJsonRows、スナップショット SQL の行と件数、canonical-mutation-fence の consumers、routes/imports.ts の復元 payload の zod 検証と受け渡しと件数 (key は duplicateVerdicts・freeeDealExclusions・totalCashflowOperations)、書込み route からの invalidateJsonSnapshotQuery、schema-guard の EXPECTED_D1_MIGRATION。旧バックアップに key が無いときは null として既存の行を残し、key があれば空配列でもその集合で置き換え、形が不正なら復元全体を拒む。復元前に持っていた操作 id の列は再読込で消えるので、復元後に古い id で取り消すことは無い (qa-database-web-tc-inference-006・qa-total-cashflow-decision-018)。

#### Data verification

migration 適用後に既存除外の理由がメモとして読めること、同じ id の二重取消で 2 回目の各文が 0 行になること、照合後に新しい操作が入ると除外が戻らないこと、1 つ前の操作への遡りで DELETE … WHERE EXISTS が 1 行になること、復元で 3 表が復元時点に戻り key の無い旧バックアップで既存の行が残ることを統合テストで確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-total-cashflow-decision-003 | reason_code と memo に分け既存を memo・その他へ移す | 自由記述 1 列のまま | 区分と一括設定ができ既存理由を失わない | reason 列を後方互換で残す |
| qa-total-cashflow-decision-004 | 操作履歴を D1 に残す | 画面のメモリ上だけ | 判定・除外・戻すを記録できる | total_cashflow_operations を新設 |
| qa-total-cashflow-decision-018 | 3 表をバックアップに加える | 判定と除外だけ / 加えない | 復元しても判断と履歴が戻り総額が復元前の判断を反映する | 前例の全箇所に 3 表を足しバックアップが少し大きくなる |
| qa-database-web-tc-inference-006 | NOT EXISTS 条件付き文による 1 batch の取消と 3 表の変更箇所 | 条件なしの取消 | 照合と batch のすき間の割り込みでも意図しない操作を戻さない | inference-005 を置き換える (アシスタント推定) |

## Delivery, migration and rollback

- Build/deploy topology: migration は migrate.yml と feat-deploy-migration-gate の gate を通し、本番 Worker の配備より先に適用する。
- Migration sequence: migration 0041 (列追加と移行、表と索引) → schema-guard の EXPECTED_D1_MIGRATION と deletion-schema.test の期待値 → db/schema.ts → バックアップ・復元の列挙 → route の書込み。
- Rollback trigger/procedure: 追加のみで旧 Worker が読んでも壊れないため、アプリは直前のビルドへ戻せる。migration の巻き戻しは行わない。

## Risks and verification

- Risk/assumption: 変更箇所に packages/api/src/db/schema.ts と import-lifecycle-pure.test.ts の期待値が明記されていない (findings low)。decision-004 の決め手 (再読込後も直前の操作を表示) が decision-017 で薄れ、D1 に残す目的が聞き直されていない (findings low)。migration 番号は取込時点の main で確定する。
- Architecture fitness test: 派生値の列が増えていないこと、更新と履歴行が同じ batch にあること。
- Load/failure/security validation: 取消照合が索引で引けること、items_json の分割が D1_MAX_BOUND_PARAMS 内に収まること。
