# System task overlay: 旧 Classify.tsx 参照・証憑欄・重複判定ロジックの読取専用監査

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-screen
- owners: ["daishiman"]
- tags: ["classify-screen", "p08", "audit"]
- related_nodes: ["arch-classify-auth", "arch-classify-backend", "arch-classify-database", "arch-classify-frontend", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-security", "arch-classify-ui-ux", "spec-classify-screen"]
- parent_feature: feat-classify-screen
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-screen/sys-classify-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

旧 pages/Classify.tsx への参照、証憑欄の再導入、分類判定ロジックの重複実装が無いことを、コード変更を伴わずに監査する。

## 背景

証憑の再導入は goal-spec の scope_out で明示的に禁止されている。分類ステータス・信頼度・根拠の判定は classifyStatus / overview.ts の core 純関数 1 か所に限定する契約があり、api・web での重複判定を許さない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Entry gate: staging run run-feat-classify-screen-20260919T142500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 旧参照・証憑欄の監査を実施する
- Backend: applicable: 重複判定ロジックの監査を実施する
- API: N/A: 監査対象は core/web が中心
- Data: N/A: 監査対象は core/web が中心
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: 本 task の監査対象外（P09 で扱う）
- Quality: applicable: 監査結果を記録し、既知逸脱を PASS に含めない
- Documentation: applicable: 監査結果を docs へ記録する
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Deploy unit/environment: N/A: 読取専用監査のみ
- Compatibility/migration/backfill: N/A: コード変更を伴わない

## 成果物

- Produced artifacts:
- docs/classify-screen/design-decisions.md
- Consumed artifacts:
- packages/web/src/pages/classify/
- packages/core/src/classify-status.ts
- Write scope/touches:
- docs/classify-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (証憑の再導入、外部 LLM 呼び出し、共通シェルの作り直し、照合画面の変更、専用アプリ、画像ヘッダーの文言変更、AI分析/改善リクエスト項目の追加)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 旧 pages/Classify.tsx への参照が repository 内で 0 件である。
- 証憑欄（ファイル選択）が画面に無く、案内文言のみが出ることを再確認している。
- 分類ステータス・信頼度・根拠の判定が classify-status.ts と overview.ts の core 純関数以外で再実装されていない。
- P06 / P07 の証跡が最終コードに対応し、既知逸脱・未実施・一部適合が PASS に含まれていない。
- Automated commands:
- rg 'pages/Classify.tsx' の参照検査
- P06 / P07 の証跡と git diff の照合
- Required evidence:
- docs/classify-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 監査記録に誤りがあれば docs の追記だけを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-classify-screen.md
- Architecture: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Feature: feat-classify-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-P07
