# System task overlay: 受入基準 S1 から S4 の検証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-guide-screen
- owners: ["daishiman"]
- tags: ["guide-screen", "p07", "acceptance"]
- related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
- parent_feature: feat-guide-screen
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-guide-screen/sys-guide-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入 S1〜S4 を実行済みの最新のテスト証跡と画面の描画検査で判定し、合否と証跡の所在を記録する。

## 背景

受入は実行済みの最新のテスト証跡だけで判定する。未実施・一部適合・既知の逸脱が 1 件でも残る項目は PASS にしない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen, SYS-GUIDE-P06
- Entry gate: staging run plan-feat-guide-screen-20260923T1350Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-GUIDE-P06 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: 画像の例示値 (総収支の金額・期間・最終更新・バッジ・ヘッダの『取引ライン』・防衛ラインの『同期間の過去データとの比較』) は期待値にしない (spec の『画像の値のうち期待値にしないもの』)。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Deploy unit/environment: N/A: 検証記録のみで配布物を持たない
- Compatibility/migration/backfill: DB の表・列・migration を足さない (C2、qa-guide-database-web-002)。schema-guard.ts の EXPECTED_D1_MIGRATION は据え置き、既存行の書き換えと backfill は 0 件

## 成果物

- Produced artifacts:
- docs/guide-screen/design-decisions.md
- Consumed artifacts:
- docs/guide-screen/design-decisions.md
- specs/spec-guide-screen.md
- Write scope/touches:
- docs/guide-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-GUIDE-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-GUIDE-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-GUIDE-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-GUIDE-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-guide-screen.context.json の scope_out (利用規約・プライバシーの専用ページ、ガイド本文の管理画面や DB 保存、自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更、防衛ラインの算出変更、共通ヘッダの呼称変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、DB の表・列・migration の追加、モバイル・タブレット・デスクトップ専用アプリ、税務判断)
- feature の resource_scope の外にあるファイル (scripts/check-glossary.mjs・docs/data-schema.md・migrations など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S4 の各項目に合否と証跡の所在が記録されている。
- S1: /guide で 19-guide.png の構成要素がすべて描画され、総収支の 3 枚が選択期間の実データ (振替除外) と一致し、直書き色の lint が 0 件であることが check:guide-screen と DOM テストで確認されている。
- S2: 信頼度 49/50/79/80 が 低/中/中/高 になり、P01 で確定した画面で『段階＋%』が出て、防衛ラインの値と要確認の自動判定が変わらないことが実測で確認されている。
- S3: grep で、web と api にガイドの節・よくある疑問・期間の表・現在値の合成・信頼度の段階の境界比較が guide-screen と段階関数以外に 0 件である。
- S4: ヘッダが『防衛ライン』のまま、フッタ 1 文目と AI 送信の補足 3 か所が読め、他の利用者のセッションで /api/guide が数値を返さないことが確認されている。既知の逸脱・未実施・一部適合が 1 件でも残る受入項目は PASS にしない。
- Automated commands:
- pnpm test
- pnpm --filter @kanjo/web run check:guide-screen
- Required evidence:
- docs/guide-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-guide-screen.md
- Architecture: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Feature: feat-guide-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-GUIDE-P06
