# System task overlay: core 境界値・上限の字面・API 契約・migration・DOM の失敗テスト先行作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-import-screen
- owners: ["daishiman"]
- tags: ["import-screen", "p04", "test-design"]
- related_nodes: ["arch-import-screen-auth", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-frontend", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops", "arch-import-screen-security", "arch-import-screen-ui-ux", "spec-import-screen"]
- parent_feature: feat-import-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-import-screen/sys-import-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

ファイルの状態と優先順位、取込可否、要約、結果、上限の境界 (10 / 11 ファイル、25MB / +1 byte、30MB / +1 byte、展開後 60MB / +1 byte、エントリ 1,000 / 1,001 件)、上限の数値リテラルの字面検査、検査と確定の契約、413・403・429、migration の更新 0 件、画面の DOM を失敗テストとして先に書く。

## 背景

上限の判定は web と api が同じ境界表から同じ結果を出す必要があるため、境界を toBe で固定してから実装する。旧実装で落ちることを確かめ、0 件しか調べていないテストを作らない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen, SYS-IMPORT-P03
- Entry gate: staging run run-import-screen-20260921T2311Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: DOM テストを書く
- Backend: applicable: core の境界値テストを書く
- API: applicable: API の契約テストを書く
- Data: applicable: migration の検査を書く
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: 413・Origin・レート制限・ファイル名の無害化のテストを書く
- Quality: applicable: テストが旧実装で落ちることを確かめる
- Documentation: N/A: docs は P12
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: N/A: テストのみ

## 成果物

- Produced artifacts:
- packages/core/test/import-screen.test.ts
- packages/api/src/import-screen.integration.test.ts
- packages/api/src/import-migration-0050.test.ts
- packages/web/src/pages/import/import-screen.dom.test.tsx
- packages/api/src/import-limits-literal.test.ts
- Consumed artifacts:
- docs/import-screen/design-decisions.md
- specs/spec-import-screen.md
- Write scope/touches:
- packages/core/test/import-screen.test.ts
- packages/api/src/import-screen.integration.test.ts
- packages/api/src/import-migration-0050.test.ts
- packages/web/src/pages/import/import-screen.dom.test.tsx
- packages/api/src/import-limits-literal.test.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPORT-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPORT-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPORT-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPORT-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (銀行・クレジットカードの明細ファイルの取り込みと、その対応サービスの案内、共通シェル、freee / マネーフォワードの API との自動連携、既存の取込形式、既存の imports と明細の行の書き換え、取消・破棄・差分プレビュー・手当ての継続再適用の規則そのものの変更、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 上限の境界がすべて toBe で書かれ、実装前は失敗する。
- 合計 30MB+1 byte が Content-Length ありと無しの両方で本文を読む前に 413 になるテストがある。
- 検査 31 回目と確定 6 回目が 429、Origin 不一致が 403 になるテストがある。
- migration 0050 の適用で既存行の更新が 0 件であるテストがある。
- web と api の取込の経路に上限の数値リテラルが無いことを字面で検査するテストがあり、検査の前の実装で落ちる。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/import-screen.test.ts
- packages/api/src/import-screen.integration.test.ts
- packages/api/src/import-migration-0050.test.ts
- packages/web/src/pages/import/import-screen.dom.test.tsx
- packages/api/src/import-limits-literal.test.ts

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-import-screen.md
- Architecture: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Feature: feat-import-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPORT-P03
