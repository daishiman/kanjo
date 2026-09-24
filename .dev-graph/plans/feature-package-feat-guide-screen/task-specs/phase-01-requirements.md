# System task overlay: 要件ベースライン確定と信頼度を出す画面の列挙の確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-guide-screen
- owners: ["daishiman"]
- tags: ["guide-screen", "p01", "preparation"]
- related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
- parent_feature: feat-guide-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-guide-screen/sys-guide-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

/guide の要件ベースラインを確定し、spec の未決事項『信頼度を出す画面の列挙』を requirements として確定させ、goal-spec.json の open_items を後続 phase の resolution_owner へ割り当てる。

## 背景

specs/spec-guide-screen.md は信頼度の段階 (高 80 以上 / 中 50〜79 / 低 49 以下) を決めたが、段階＋% を出す画面の一覧を確定していない (completeness-findings の medium)。概況 Overview.tsx:209-210 の confidenceClass は 80/60 の色境界で、新しい 50 境界と衝突する。この列挙が決まらないと P04 のテスト対象と P05 の write_scope が揺れる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Entry gate: staging run plan-feat-guide-screen-20260923T1350Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: 信頼度を出す画面の列挙 (OI-1) は本 task で requirements として確定し、docs に採用した画面の一覧と除外した画面の理由を書く。対象候補は 明細仕分けの表 (classify/TransactionTable.tsx:103,142)・編集欄 (classify/EditPanel.tsx:258)・概況の確認待ち (components/OverviewReviewQueue.tsx:141-158)・概況 (Overview.tsx:328,370)。診断 (pages/analysis/diagnosis/ResultCards.tsx:33) と AI 画面 (pages/ai/AiContextAnalysis.tsx:22 の CONFIDENCE_LABEL) の『確度』は % を持たない列挙で、含めるかを本 task で決める。
Blocker: 概況 Overview.tsx:209-210 の confidenceClass (80 以上 good・60 以上 warning・それ未満 danger) は新しい 50 境界と衝突する (55% が段階では中なのに色は danger)。色の境界を段階に合わせるかを本 task で決め、docs に記す。
Open risk: /api/guide の応答の細部・トピック id の綴り・4 ステップと下部固定バーの行き先・目次の切替幅 1024px・ステッパーの塗り方・検索の正規化・0 件の文言・URL の既定と切り詰め・データ 0 件の表示・期間の定義文・AI 送信の補足の文言・段階関数と定数の名前・範囲外の扱い・DOM テストのファイル名は agent 推定・利用者未確認のまま docs に転記し、resolution_owner task へ引き継ぐ。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: applicable: 本 phase の主責務として扱う
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: DB の表・列・migration を足さない (C2、qa-guide-database-web-002)。schema-guard.ts の EXPECTED_D1_MIGRATION は据え置き、既存行の書き換えと backfill は 0 件

## 成果物

- Produced artifacts:
- docs/guide-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-guide-screen.md
- features/feat-guide-screen.md
- Write scope/touches:
- docs/guide-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-GUIDE-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-GUIDE-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-GUIDE-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on は無く、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-guide-screen.context.json の scope_out (利用規約・プライバシーの専用ページ、ガイド本文の管理画面や DB 保存、自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更、防衛ラインの算出変更、共通ヘッダの呼称変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、DB の表・列・migration の追加、モバイル・タブレット・デスクトップ専用アプリ、税務判断)
- feature の resource_scope の外にあるファイル (scripts/check-glossary.mjs・docs/data-schema.md・migrations など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S4 が検証可能な文として docs に列挙され、各文に対応する spec の節 (機能要件 FR-1〜FR-17・ビジネスルール・API 契約・テストと受入条件) が付いている。
- 信頼度を出す画面の列挙 (OI-1) が確定し、対象画面ごとに ファイルと行・現行の表示・変更後の『段階＋%』表示・色の扱いが表で記されている。診断と AI 画面の『確度』を含めるか否かとその理由が記されている。
- 概況 Overview.tsx:209-210 の 80/60 色境界の扱い (段階の 80/50 に揃えるか据え置くか) が決まり、決定が利用者確認済みか agent 推定かが区別して書かれている。
- goal-spec.json の open_items 全件が docs に原文の意味を保って転記され、各件の resolution_owner task (SYS-GUIDE-P02〜P05・P12) が割り当てられている。
- REVIEW_CONFIDENCE_THRESHOLD = 80 (classify-status.ts:43) を変えないこと、DB の追加をしないことが制約として明記されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/guide-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-guide-screen.md
- Architecture: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Feature: feat-guide-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし
