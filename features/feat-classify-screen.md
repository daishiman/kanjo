---
graph_node_id: "feat-classify-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "明細仕分け画面 (13-classify) の作り直しと分類ステータス・信頼度・ルール適用の core 一本化"
project_id: "kanjo"
domain: "classify"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "rules", "bulk-save", "feature"]
file_path: "features/feat-classify-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "976c5b04bf7ef1a291c764e5880123f7f5f4698e74c9ff11a07053f83dd8b5aa"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-classify-screen.md", "source_version": "0.1.11", "source_digest": "58d6ff86fdfc9a0ee09f08b93921e338946b78263b6f65057658c8c06287795d", "imported_at": "2026-09-19T14:21:28Z"}
created_at: "2026-09-19T14:21:28Z"
updated_at: "2026-09-19T14:21:28Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-backend", "arch-classify-database", "arch-classify-auth", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-maintenance-ops"]
resource_scope: [".github/workflows/ci.yml", "design/FINAL-UI/images/13-classify.png", "docs/classify-screen/", "docs/data-schema.md", "docs/ui-decisions.md", "migrations", "packages/api/src/ai", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/d1-limits.ts", "packages/api/src/db/schema.ts", "packages/api/src/deletion-full-reset.ts", "packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/deletions.ts", "packages/api/src/schema-guard.ts", "packages/core/src/cash.ts", "packages/core/src/classify-status.ts", "packages/core/src/classify.ts", "packages/core/src/diagnosis-detectors.ts", "packages/core/src/index.ts", "packages/core/src/overview.ts", "packages/core/src/splits.ts", "packages/core/src/subs-screen.ts", "packages/core/src/types.ts", "packages/core/src/vendor-memory.ts", "packages/core/test", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/api.ts", "packages/web/src/components/Button.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/SplitEditor.tsx", "packages/web/src/components/Term.tsx", "packages/web/src/components/classification-invalidate.ts", "packages/web/src/glossary.ts", "packages/web/src/pages/Classify.tsx", "packages/web/src/pages/classify/", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "specs/spec-classify-screen.md"]
purpose: "取り込んだ明細のうち自動では決まらなかったものを、利用者が『なぜその提案なのか』を確かめながら素早く確定でき、確定した内容を次から自動で効くルールにでき、まとめて保存して一部が失敗しても失敗分だけやり直せ、入力の途中で画面を離れても作業を失わない状態にする。分類ステータスの定義・信頼度の算出・ルールの適用規則は core の純関数 1 か所と docs・テストで固定し、ナビのバッジ・月次クローズ・仕分け画面の件数をずらさない。"
goal: "/classify が 13-classify.png の全構成要素 (見出しと問い・期間タブ・KPI 4 枚 (未整理・要確認 (未整理のうち)・手動変更・完了)・絞り込みパネルと保存フィルタ・6 列の取引一覧と選択・ページ送り・編集パネル (証憑欄の代わりに『証憑は freee 側で管理します』)・一括操作バー・部分失敗の通知と失敗分だけの再試行・削除の取り消し・分割明細の編集・ルール適用プレビュー・下書きの自動保存と復元・読込 / 空 / 失敗) をトークンと共通部品で描画し、分類ステータスが core の classifyStatus 1 か所 (未整理 + 手動変更 + 完了 = 全件、要確認 ⊆ 未整理、信頼度は 0〜100 の整数か提案なしの null) から出てバッジと月次クローズもそれを使い、一括保存・履歴・ルールのプレビューと適用・保存フィルタの API が認証と変更系フェンスの内側で動き、migration 0046 が追加のみで既存行を書き換えず、外部送信 0 件で、既存の仕分け・照合・月次クローズ・家計収支・総収支の数値テストが緑のままの状態。"
scope_in: ["/classify の作り直し (13-classify.png の全構成要素と読込・空・失敗の各状態)。Classify.tsx (1188 行) を packages/web/src/pages/classify/ 配下へ分割し、期間は usePeriod / localStorage、絞り込み・ページ・選択は URL に保つ", "core の分類ステータス判定 classifyStatus の新設 (未整理・手動変更・完了の 3 区分の排他、未整理の内訳としての要確認 (信頼度 80 未満・衝突・矛盾)、提案どおりの確定は完了・提案と異なる確定は手動変更)", "提案・信頼度・根拠の算出を recommendationFor の拡張に一本化し、参照元 (診断・サブスクの core を含む) を壊さない", "ナビのバッジと月次クローズの『仕分け』を classifyStatus へ差し替える (現行の clsSrc=既定 と意味を変えない)", "GET /api/transactions の拡張 (絞り込み・50 件ずつ・提案・信頼度・根拠・ステータス・KPI)、PUT /api/transactions/:txId/edit と POST /api/rules の拡張", "POST /api/transactions/bulk (部分失敗の応答)・GET /api/transactions/:txId/history・POST /api/rules/preview・POST /api/rules/:id/apply (分割ルールを含む)・GET / POST / DELETE /api/saved-filters の新設。すべて認証・パスワード変更フェンス・変更系フェンスの内側で zod 検証", "migration 0046_classify_workbench.sql (追加のみ): saved_filters と tx_history の新設、rules への payee・scope・split_template_json、tx_edits への payment_method・matched_proposal の追加。runtimeSchemaGuard への反映", "下書きの端末保存と復元、未保存のまま離れるときの確認、削除の『元に戻す』", "分類ステータス・信頼度・ルール適用の規則の docs (data-schema.md・ui-decisions.md) 記載と、core 単体・API 統合・migration 検査・DOM テスト"]
scope_out: ["領収書・証憑の添付と保管 (#42 で廃止し freee 側で管理。利用者決定 qa-classify-decision-001)", "外部 LLM による提案 (取込データを外部へ送らない。利用者決定 qa-classify-decision-003)", "共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗表示) の見た目の作り直し (バッジと『仕分け』の件数の定義だけ扱う)", "取込処理・照合画面の変更 (照合側の明細を『仕分け』から除く現行規則は保つ)", "スマートフォン等の専用アプリ (web のみ)", "画像ヘッダーの『取引ライン：正常』への文言変更", "サイドバーの『AI分析』『改善リクエスト』項目"]
acceptance: ["S1 (G1): /classify に 13-classify.png の構成要素がすべて描画され、色・余白・部品はトークンと共通部品を通し、直書き色の lint が 0 件である。証憑欄は無く『証憑は freee 側で管理します』の案内がある。期間内の明細 0 件で空状態になる。", "S2 (G2): 同じ期間で 未整理 + 手動変更 + 完了 = 全件、要確認は未整理を超えず、ナビのバッジ・月次クローズの『仕分け』・画面の件数が同じ関数から出る。信頼度は全由来で 0〜100 の整数で、提案が無いときだけ null。外部送信は 0 件。", "S3 (G3): 一括保存の一部が失敗しても成功分は保存され、通知が成功件数と失敗件数を正しく示し、再試行は失敗分だけを送る。削除は元に戻せる。", "S4 (G4): ルール作成前のプレビューの件数・明細が適用後に変わった明細と一致し、手動変更の明細は変わらず、分割ルールの行の和は元の金額に一致する。", "S5 (G5): 保存フィルタと取引の履歴が D1 に残り、下書きは再読込後も復元でき、migration は追加のみで既存行の書き換えが 0 件である。", "S6 (G1-G5): 期間は usePeriod / localStorage、絞り込み・ページ・選択は URL から復元し、既存の仕分け・照合・月次クローズ・家計収支・総収支の数値テストが緑のままで、pnpm lint・typecheck・初期 JS 予算を CI で通す。既知の逸脱・未実施・一部適合は PASS に数えない。"]
architecture_refs: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-backend", "arch-classify-database", "arch-classify-auth", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "画面・core の classifyStatus・一括保存とルールの API・migration 0046 は同じ分類ステータスの契約 (3 区分 + 要確認の内訳、提案一致フラグ) を起点に連鎖する 1 つの価値単位で、画面だけ・API だけ・判定だけでは『明細を確かめて確定し、ルール化し、失敗分だけやり直す』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-classify-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:21:28Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

取り込んだ明細のうち自動では決まらなかったものを、利用者が『なぜその提案なのか』を確かめながら素早く確定できるようにする。確定した内容を次から自動で効くルールにでき、まとめて保存して一部が失敗しても失敗分だけやり直せ、入力の途中で画面を離れても作業を失わない状態にする。分類ステータスの定義・信頼度の算出・ルールの適用規則は core の純関数 1 か所と docs・テストで固定し、ナビのバッジ・月次クローズ・仕分け画面の件数をずらさない。

規範 (要件・分類規則・確定意思決定・API 契約) の正本は `specs/spec-classify-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/classify が 13-classify.png の全構成要素をトークンと共通部品で描画し、分類ステータスが core の `classifyStatus` 1 か所から出てナビのバッジと月次クローズの『仕分け』もそれを使い、一括保存・履歴・ルールのプレビューと適用・保存フィルタの API が認証と変更系フェンスの内側で動き、migration 0046 が追加のみで既存行を書き換えず、外部送信 0 件で、既存の仕分け・照合・月次クローズ・家計収支・総収支の数値テストが緑のままの状態。

## スコープ

- スコープ内:
  - /classify の作り直し (13-classify.png の全構成要素と読込・空・失敗の各状態)。`Classify.tsx` (1188 行) を `packages/web/src/pages/classify/` 配下へ分割し、期間は `usePeriod` / localStorage、絞り込み・ページ・選択は URL に保つ
  - core の分類ステータス判定 `classifyStatus` の新設 (未整理・手動変更・完了の 3 区分の排他、未整理の内訳としての要確認、提案どおりの確定は完了・提案と異なる確定は手動変更)
  - 提案・信頼度・根拠の算出を `recommendationFor` の拡張に一本化する (参照元の診断・サブスクの core を壊さない)
  - ナビのバッジと月次クローズの『仕分け』を `classifyStatus` へ差し替える
  - `GET /api/transactions`・`PUT /api/transactions/:txId/edit`・`POST /api/rules` の拡張と、`POST /api/transactions/bulk`・`GET /api/transactions/:txId/history`・`POST /api/rules/preview`・`POST /api/rules/:id/apply`・`GET` / `POST` / `DELETE /api/saved-filters` の新設
  - migration `0046_classify_workbench.sql` (追加のみ) と `runtimeSchemaGuard` への反映
  - 下書きの端末保存と復元、未保存のまま離れるときの確認、削除の『元に戻す』
  - 規則の docs 記載と、core 単体・API 統合・migration 検査・DOM テスト
- スコープ外:
  - 領収書・証憑の添付と保管 (利用者決定 qa-classify-decision-001)
  - 外部 LLM による提案 (利用者決定 qa-classify-decision-003)
  - 共通シェルの見た目の作り直し (件数の定義だけ扱う)
  - 取込処理・照合画面の変更
  - スマートフォン等の専用アプリ (web のみ)
  - 画像ヘッダーの『取引ライン：正常』への文言変更、サイドバーの『AI分析』『改善リクエスト』項目

## 受入

- [ ] S1 (G1): /classify に 13-classify.png の構成要素がすべて描画され、直書き色の lint が 0 件。証憑欄は無く『証憑は freee 側で管理します』の案内がある。期間内の明細 0 件で空状態になる。
- [ ] S2 (G2): 同じ期間で 未整理 + 手動変更 + 完了 = 全件、要確認 ⊆ 未整理、バッジ・月次クローズ・画面の件数が同じ関数から出る。信頼度は 0〜100 の整数か提案なしの null。外部送信 0 件。
- [ ] S3 (G3): 一括保存の部分失敗で成功分は保存され、通知が件数を正しく示し、再試行は失敗分だけを送る。削除は元に戻せる。
- [ ] S4 (G4): ルールのプレビューと適用結果の明細集合が一致し、手動変更の明細は変わらず、分割ルールの行の和は元の金額に一致する。
- [ ] S5 (G5): 保存フィルタと取引の履歴が D1 に残り、下書きは再読込後も復元でき、migration は追加のみで既存行の書き換えが 0 件。
- [ ] S6 (G1-G5): 期間と URL から状態を復元し、既存の数値テストが緑のままで、lint・typecheck・初期 JS 予算を CI で通す。

受入の詳細 (AT-01〜AT-21) は `specs/spec-classify-screen.md` の「テストと受入条件」を正本とし、本書へ複製しない。

## アーキテクチャ参照

- `architecture_refs`: `arch-classify-ui-ux`, `arch-classify-frontend`, `arch-classify-backend`, `arch-classify-database`, `arch-classify-auth`, `arch-classify-security`, `arch-classify-infrastructure`, `arch-classify-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/classify-*.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-classify-screen` (feature ノードへの依存は無い)
- 依存理由: 分類ステータスの区分 (3 区分 + 要確認は未整理の内訳)・提案どおりの確定の扱い・証憑の非再導入・外部送信なしの信頼度・保存先 (フィルタと履歴は D1、下書きは端末) が確定していないと、core の返り値型・API 応答・migration の列・テストの期待値が実装中に揺れるため。
- 重複の不在: 既存 feature に明細仕分け画面を扱うものは無い。`feat-household-cashflow` とは数値テストが緑のままであることを確かめるだけで機能を重複させない。
- 後続: 無し。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-classify-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-classify-screen --feature-context features/feat-classify-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-classify-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S6 の evidence が揃う場合だけ done にする。
- 前提条件として持ち越す未決事項: Q-1 (vendor_memory が取込時に materialize した手当てを完了と手動変更のどちらにするか) は `classifyStatus` を実装する task の前提条件とし、決まるまでその分岐のテストを確定しない。Q-3 (ルールのプレビューの対象期間)・Q-4 (下書きを利用者で区切るか)・Q-5 (agent 推定値) は `specs/spec-classify-screen.md` の未決事項を正本とする。
- resource_scope の引き方: `recommendationFor` は診断 (`diagnosis-detectors.ts`) とサブスク (`subs-screen.ts`) の core からも呼ばれるため、先に scope へ含めた。plan では各 task の scope について、export 名の呼び出し元・import している側・型で結ばれた宣言を同じ手順で引くこと。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
