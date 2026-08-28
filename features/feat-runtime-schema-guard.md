---
graph_node_id: "feat-runtime-schema-guard"
artifact_kind: "feature"
artifact_subtypes: []
title: "実行時スキーマ版数ガードと説明可能なエラー表示"
project_id: "kanjo"
domain: "backend"
status: "draft"
owners: []
tags: ["server-error-recovery"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-27T05:10:00Z"
updated_at: "2026-08-27T05:10:00Z"
depends_on: []
related_nodes: ["arch-schema-guard-error-contract"]
resource_scope: ["packages/api/src", "packages/web/src"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-runtime-schema-guard.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2dde6aca87626ee77917cc4d811146bbc79d62f262391261268ee904affb1c89"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "system-spec/index.md", "source_version": "0.1.9", "source_digest": "2dde6aca87626ee77917cc4d811146bbc79d62f262391261268ee904affb1c89", "imported_at": "2026-08-27T05:10:00Z"}
classification_confidence: 1.0
classification_reason: "C14 decompose がマクロ層 (feature/architecture) として明示生成したため分類は一意。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "blocked", "missing_sections": ["system-spec/completeness-findings.json の verdict: FAIL 解消と再評価"], "checked_at": "2026-08-27T05:10:00Z"}
purpose: "利用者が見たのは汎用のサーバーエラー文言だけで、自分の操作の誤りか待てば直るのかを判断できなかった。乖離時に次の行動が分かる応答を返す最後の防波堤を置く。"
goal: "session/token認証後の共通middlewareで版数照合が行われ、乖離時は認証済みの全D1利用エンドポイントが専用コードを返し、画面には待機を促す文言が出る。内部構造は応答にもログにも現れない。"
scope_in: ["認証後 middleware での版数照合", "期待版のビルド時確定", "期限付き isolate 内キャッシュ", "照合失敗時の fail-closed 503", "専用エラーコードの定義", "フロントの表示分岐追加", "乖離状態での動作確認"]
scope_out: ["乖離の自動修復", "実行時のマイグレーション適用", "技術的詳細の開示", "既存の汎用エラー表示の全面刷新"]
acceptance: ["乖離状態で POST /api/imports と GET /api/imports の双方が専用エラーコードを返す", "乖離状態でその他の認証済みD1利用エンドポイントも同じ専用コードを返す", "照合自体が失敗した場合も同じ専用503となり業務D1アクセスへ進まない", "照合の D1 問い合わせがキャッシュ有効期間内に 1 回に収まる", "public auth はguard対象外で認証前のschema照合がない", "token経路はai_tasksのBearer認証後かつpayload/reportの業務D1アクセス前にguardされる", "応答本文とログにテーブル名・スキーマ版数・スタックトレース・明細内容・金額が現れない", "画面に復旧作業中である旨と時間をおいた再試行を促す文言が表示される"]
architecture_refs: ["arch-schema-guard-error-contract"]
---

# 目的

今回の障害で利用者が見たのは「取込を実行できませんでした: サーバーエラーが発生しました」という一文だけだった。この文言からは、自分のファイルが悪いのか、操作を誤ったのか、待てば直るのかが判断できない。実際には取込と取込履歴の両方が同じ原因で落ちており、利用者は原因のない試行錯誤に時間を費やす。検査ゲートをすり抜けた乖離や、ゲート導入前から存在する乖離に対しても、利用者が次に何をすべきか分かる応答を返す最後の防波堤が要る。

## 到達状態

session 認証の直後、または token の `ai_tasks` 認証直後かつ payload/report の業務 D1 アクセス前に、スキーマ版数の照合が行われる。乖離時には認証済みの全 D1 利用エンドポイントが専用エラーコードを返す。public auth は対象外であり、認証前に schema 照合を行わない。token認証専用の `ai_tasks` readだけは認証成立に必要な境界としてguardより前に置く。利用者の画面には「システム更新の適用待ちであり、時間をおいて再度試せばよい」ことが伝わる文言が表示される。応答本文とログにテーブル名・スキーマ版数・スタックトレース・明細・金額は一切現れない。照合結果は isolate 内に期限付きでキャッシュする。

## スコープ

- スコープ内: public auth を除く認証済み D1 利用経路での版数照合、期待版のビルド時確定、期限付き isolate 内キャッシュ、照合失敗時の fail-closed 503、専用エラーコードの定義、専用コードをログとレスポンス双方へ載せる処理、フロント側の表示分岐 1 件の追加、乖離状態を再現した動作確認。
- スコープ外: 乖離の自動修復、実行時のマイグレーション適用、利用者への技術的詳細の開示、既存の汎用エラー表示の全面的な作り直し。

## 受入

- [ ] 乖離状態で `POST /api/imports` と `GET /api/imports` の双方が専用エラーコードを返す
- [ ] 乖離状態でその他の認証済み D1 利用エンドポイントも同じ専用コードを返す (検知漏れの経路がない)
- [ ] 照合自体が失敗した場合も同じ専用 503 となり、業務 D1 アクセスへ進まない
- [ ] 照合の D1 問い合わせがキャッシュ有効期間内に 1 回に収まる
- [ ] public auth は guard 対象外で、認証前に schema 照合が走らない
- [ ] 応答本文とログにテーブル名・スキーマ版数・スタックトレース・明細内容・金額が現れない
- [ ] 画面に復旧作業中である旨と時間をおいた再試行を促す文言が表示され、汎用サーバーエラー表示と区別できる
- [ ] session経路ではguardが認証後、token経路では`ai_tasks`のBearer認証後かつpayload/reportの業務D1アクセス前に置かれる

## アーキテクチャ参照

- `architecture_refs`: `arch-schema-guard-error-contract`

## 機能間依存

- `depends_on`: (なし)
- 依存理由: 本 feature は乖離が存在する状態でこそ価値を持つため、復旧の完了を待つ必要がない。むしろ復旧前に導入できれば、復旧までの間も利用者へ意味のある説明を返せる。`feat-prod-d1-schema-recovery` と並行して着手できる。

## Handoff

- per-feature planning: ready 時に `run-system-dev-plan` を `--feature-id feat-runtime-schema-guard` と repo 相対 `--feature-context features/feat-runtime-schema-guard.context.json` で起動する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-runtime-schema-guard` と共通 `feature_package_id` で C02 経由 atomic 登録する (expected/applied = 13)。
- 完了 rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が上記受入 7 件を満たす場合だけ done とする。
