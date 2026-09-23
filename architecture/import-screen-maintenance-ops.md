---
graph_node_id: "arch-import-screen-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "データ取込 — 規則を docs/import-screen/ と境界表のテストで固定し、上限の数値リテラルを字面の検査で core の 1 か所に閉じ込める"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["import-screen", "maintenance-ops"]
file_path: "architecture/import-screen-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "0e03da0aed7e1bed0f3e37eafeb8df1e8e76a249f5f35465d0b4060fae426293"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "0e03da0aed7e1bed0f3e37eafeb8df1e8e76a249f5f35465d0b4060fae426293", "imported_at": "2026-09-21T22:53:09Z"}
created_at: "2026-09-21T22:53:09Z"
updated_at: "2026-09-21T22:53:09Z"
depends_on: ["spec-import-screen"]
related_nodes: ["arch-import-screen-ui-ux", "arch-import-screen-frontend", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-auth", "arch-import-screen-security", "arch-import-screen-infrastructure"]
resource_scope: ["package.json", "docs", "scripts/ui-contract-ast.mjs", "packages/api/src/import-pipeline.test.ts", "packages/api/src/import-lifecycle.test.ts", "packages/api/src/import-diff.test.ts", "packages/api/src/import-history-discard.test.ts", "packages/api/src/deletion-lifecycle.test.ts", "packages/api/src/scheduled-maintenance-budget.test.ts", "packages/core/test/parsers.test.ts", "packages/core/test/fingerprint.test.ts", "packages/core/test/import-history-discard-contract.test.ts", "packages/web/src/pages/Import.dom.test.tsx", "packages/web/src/pages/import/import-screen.dom.test.tsx", "packages/web/src/pages/Import.deletion.test.tsx", "packages/web/src/pages/Import.discard.test.tsx", "packages/web/src/import-reimport.dom.test.tsx", "packages/web/test/import-multifile.dom.test.tsx", "packages/web/test/import-review-notice.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/import-screen-maintenance-ops.md"}]
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

データ取込 — 規則を docs/import-screen/ と境界表のテストで固定し、上限の数値リテラルを字面の検査で core の 1 か所に閉じ込める。`system-spec/maintenance-ops.md` は承認時入力、本書は規則の記録場所・境界テスト・回帰の範囲の制約を持つ。期待値の正本は `specs/spec-import-screen.md` (spec-import-screen) のテストと受入条件の節。

## Context and drivers

- Business/technical context: テストは packages/api の import-pipeline・import-lifecycle・import-diff・import-history-discard・deletion-* 群、packages/core の parsers・fingerprint・import-history-discard-contract、packages/web の `Import.*.test.tsx` 群。既存の文書は `specs/import-deletion-and-override-reapply.md`・`features/feat-import-deletion-override-reapply.md`・`architecture/arch-import-deletion-undo-boundary.md`。直近の画面作り直しは `docs/` 配下の画面名のディレクトリに規則を残している (qa-imp-maintenance-ops-web-evidence-001)。`verify:full` (`package.json`) は test・typecheck・lint・build と web の check 群・preview:smoke を順に走らせる。
- Quality attribute priorities: G1〜G6 に資する。Clean Code の『規則は名前と境界値テストで読めるようにする』と、Google SRE の operations (検証の入口を `verify:full` と CI に一本化) を適用する。
- Constraints: 新しい検証コマンドやワークフローは足さない。テストは旧実装で落ちることを確かめる。

## Goals and non-goals

- Goals:
  - G3: ファイルの状態・検証の段階・取込可否・要約・取込 1 回の結果の規則、1 回の取込 = 1 つの検査 ID の単位、行単位の追加と月単位の入れ替えの違い、仮置きの期限、上限値とレート制限、履歴の削除の意味を `docs/import-screen/` (新設) に明記し、core・API・DOM のテストで固定する。
  - G6: 上限値が core の `IMPORT_LIMITS` の 1 か所だけにあり、packages/web と packages/api の取込の経路に上限の数値リテラルが無いことを、既存の契約ガードと同じ字面の検査で固定する。web の送信前の判定と api の 413 が同じ境界値で同じ結果になることを、共通の境界表を両方のテストから読んで確かめる。
  - G1: 既存の取込・取り消し・破棄のテストを緑のまま保ち、初期 JS 予算 (CI 実測) と `verify:full` を通す。
- Non-goals:
  - 新しいワークフロー・検証コマンドの追加
  - 画像のモックの件数・ファイル名・日時を期待値にすること
  - 既存の取り消し (30 日) の規則の変更

## System context and boundaries

- Users/external systems: 開発者と CI。
- Trust/deployment/data boundaries: 規則の正本は仕様書、実装の正本は core の `import-screen.ts` の関数と定数、利用者向けの説明は `docs/import-screen/`。3 者の一致をテストで確かめる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `docs/import-screen/` (新設) | 状態・段階・取込可否・要約・結果・上限・削除の意味の表 | Markdown | リポジトリ | 文書 |
| 共通の境界表 (新設) | 上限ちょうどと 1 超過の組を 1 か所に置く | テストの fixture | packages/core | CI |
| core の単体テスト | 状態の優先順位・結果の 3 区分・上限の判定 | vitest | packages/core | CI |
| API テスト | 検査・確定・追加・413・429・403・404・夜間保守 | vitest | packages/api | CI |
| DOM テスト | 5 段・下部バー・送信前の上限判定・状態の表示 | vitest (DOM) | packages/web | CI |
| 数値リテラルの字面検査 (新設) | web と api の取込の経路に上限の数値が無いこと | テスト | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: N/A: 本章は検証と記録の関心。
- Errors/resilience: 境界テストの失敗は差し戻しの条件にする。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 設定と秘密情報を持たない。
- Compatibility/versioning: 既存の DOM テストが `Import.js` から import する部品名は、移設先から再エクスポートするか、テストを新しい構成に合わせて書き直す (`architecture/import-screen-frontend.md`)。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Operations architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Operations architecture

#### Fixture authority

期待値の正本は仕様書のフィクスチャと共通の境界表で、画像 (`16-import.png`) の件数・ファイル名・日時はモックなので期待値にしない。状態と結果は `toBe`、要約は `toEqual` で比べる。

#### Documentation upkeep

`docs/import-screen/` に状態の優先順位・取込可否・結果の 3 区分・前回データを残すのオンとオフ・仮置きの期限 24 時間・上限値とレート制限・一括削除は記録だけ、を表で置く。core の関数と定数は同じ名前で書き、表の行とテストの期待値を 1 対 1 に対応させる。

#### Regression scope

境界テストは次を固定する (qa-imp-maintenance-ops-web-005、agent 推定。値は qa-imp-decision-006〜011 で確定)。

- 上限ちょうどと 1 超過: 10 / 11 ファイル、1 ファイル 25MB / 25MB+1 byte、合計 30MB / 30MB+1 byte を Content-Length ありと無しの両方、展開後 15MB / 15MB+1 byte、エントリ数 1,000 / 1,001 件、ファイル追加で検査 ID の累計が 10 / 11 ファイルと 30MB / 30MB+1 byte になる場合。Content-Length が無い要求は、本文を読む前ではなく上限 +1 byte を読んだ時点で止まることを注記し、テストはその時点の 413 を確かめる (評価の low の申し送り)。
- ファイル数と 1 ファイルの大きさの超過がパースより前に 413 になること。
- 検査 30 / 31 回目 (ファイル追加を含めて数える) と確定 5 / 6 回目、一括削除 100 / 101 件、ファイル名 255 / 256 文字、期限ちょうどの検査 ID。
- 他人の検査 ID と別の検査のファイル項目 ID、Origin 不一致。
- 前回データを残すのオンとオフで同じファイルを 2 回取り込んだときの行数、取込済みと同一内容のファイル、一部成功の結果、一括削除後に明細が残ること。
- 夜間保守で期限切れの仮置きと古い時間枠が 1 回 500 件まで消え、残りが翌日に回ること。

既存の取込・取り消し・破棄のテスト、lint (直書き色の検査を含む)・typecheck・初期 JS 予算を緑のまま保つ。

#### Operations verification

- 数値リテラルの字面検査の指紋 (評価の low の申し送り。実装計画で確定する): バイト値の 3 表記 (MB の乗算式 `25 * 1024 * 1024` の形・10 進の積・リテラル `26214400` の形) と、取込の経路のファイルにある `maxSize:` と `.size >` の比較式を対象にする。10 や 1000 のようなありふれた値は、比較式の右辺に現れるときだけ数える。現行の `packages/api/src/routes/imports.ts:1410` の 25MB 判定でこの検査が落ちることを確かめてから、core への移設で緑にする。字面の読み取りは既存の `scripts/ui-contract-ast.mjs` と同じく TypeScript の AST を使う方針とする (agent 推定)。
- Worker のメモリの実測 (評価の low の申し送り): **完了 (OI-03)**。xlsx を `parseUpload` にかけて heap の増分を測った (`docs/import-screen/design-decisions.md` §8)。128MB に収まるのは展開後およそ 15MB (約 35,000 行) まで。後退策どおり展開後の上限を下げ、core の `IMPORT_LIMITS.maxExpandedBytes` の 1 か所を 15MB から 15MB へ変更した。値は利用者の判断 (A案) を経ている。
- 宣言と実長のずれ: hono/body-limit の宣言した Content-Length と実長のずれの扱いは出典の無い設計判断 (`architecture/import-screen-security.md`) なので、ずれた要求で上限を越えて読まないことを実測するテストを足すかを実装計画で決める。

### Infrastructure architecture (運用の観点)

基盤そのものの構成は `architecture/import-screen-infrastructure.md` が正本である。本節はそれを検証と回帰の運用から見た制約だけを持つ。

#### Environments and topology

検証は、ローカル・CI・本番の 3 つで行う。ローカルの `verify:full` は vite (4175) の起動を前提にし、CI は headless Chrome で DOM テストと preview:smoke を走らせる。データ取込画面のために新しい環境は足さない。

#### Compute and storage

N/A: 本章は計算資源と保存先を持たない。メモリの実測は上記 Operations verification に従う。フィクスチャは仕様書と共通の境界表を正本にし、実データを含めない (`scripts/hooks/guard-real-data.sh` の既存の運用に従う)。

#### IaC and delivery

検証の入口は既存の CI と `verify:full` だけで、新しいワークフローや検証コマンドは足さない。migration 0050 以降の反映は既存の Migrate → Deploy の手順に載せる。

#### Secrets and access

N/A: 検証と記録に秘密情報は要らない。テストのセッションはテストの中で作り、平文を文書やログに残さない。

#### Reliability and recovery

既存のテスト・初期 JS 予算・夜間保守の予算のテストのどれかが赤になったら差し戻す。差し戻しは Worker と web の配信を戻すだけで、表は落とさない。

#### Infrastructure verification

`verify:full` の緑と、Migrate の手順で新しい migration が `d1_migrations` に記録されることを確かめる。基盤の検証項目は `architecture/import-screen-infrastructure.md` に従う。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-maintenance-ops-web-005 | 規則を `docs/import-screen/` の表に置き、テストの期待値と揃える (agent 推定) | コードのコメントだけに書く | 利用者と開発者が同じ表を読め、ずれをテストが検知する | 規則の変更は表・core・テストの同時更新になる |
| qa-imp-maintenance-ops-web-005 | 上限の数値リテラルを字面の検査で web と api から締め出す (agent 推定) | レビューで目視 | 二重実装を CI で止められる | 指紋の定義を実装計画で決める |
| qa-imp-maintenance-ops-web-005 | 共通の境界表を web と api のテストから読む (agent 推定) | 各テストに値を書く | 送信前の判定と 413 が同じ境界で比べられる | 境界表が core のテスト支援に 1 つ増える |
| qa-imp-decision-011 | Content-Length の有無の両方で 30MB の境界を試す | Content-Length ありだけ | 本文を数えて止める経路も確かめられる | 無い場合は上限 +1 byte を読んだ時点で止まる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI と `verify:full`。
- Migration sequence: `docs/import-screen/` の表と共通の境界表 → core の単体テスト → 数値リテラルの字面検査 (旧実装で落ちることを確認) → API テスト → DOM テストの移設または書き直し → メモリの実測 → `verify:full`。
- Rollback trigger/procedure: 既存のテスト・初期 JS 予算・夜間保守の予算のテストのどれかが赤になれば差し戻す。

## Risks and verification

- Risk/assumption: DOM テストを新しい構成に書き直すとき、旧実装でも通る緩い期待値に変えてしまうと回帰を見逃す。書き直したテストが旧実装で落ちることを確かめる。
- Architecture fitness test: `docs/import-screen/` の表の行数と core の状態・結果の定義の要素数が一致すること。字面の検査が 0 件の違反を『0 件しか調べていない』と区別できるよう、検査した取込の経路のファイル数を件数で固定すること。
- Load/failure/security validation: 初期 JS 予算を CI 実測で確かめ、データ取込画面が遅延読み込みのままであること。xlsx の展開後のメモリは実測済み (OI-03。`docs/import-screen/design-decisions.md` §8)。
