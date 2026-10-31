---
graph_node_id: "feat-improvement-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "改善リクエスト画面 (20-improvement) の作り直しと状態・番号・一覧・マスクの導出の core 単一化、論理削除と元に戻す"
project_id: "kanjo"
domain: "improvement"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement", "improvement-screen", "feature"]
file_path: "features/feat-improvement-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "87ea555fde6a19594aa701ea277fe37b48f8615e6bdc793c0a32e958f828f205"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-improvement-screen.md", "source_version": "0.1.11", "source_digest": "d06729052e261c353c3be4518d84b171fdb72b29d659048d979e111d5485018c", "imported_at": "2026-09-23T14:02:50Z"}
created_at: "2026-09-23T14:02:50Z"
updated_at: "2026-09-23T14:02:50Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
resource_scope: [".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "architecture/improvement-screen-auth.md", "architecture/improvement-screen-backend.md", "architecture/improvement-screen-database.md", "architecture/improvement-screen-frontend.md", "architecture/improvement-screen-infrastructure.md", "architecture/improvement-screen-maintenance-ops.md", "architecture/improvement-screen-security.md", "architecture/improvement-screen-ui-ux.md", "design/FINAL-UI/images/20-improvement.png", "docs/improvement-request.md", "migrations", "package.json", "packages/api/src/audit-log-d8.test.ts", "packages/api/src/audit-log.ts", "packages/api/src/db/schema.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/improvement", "packages/api/src/improvement-backup-exclusion.test.ts", "packages/api/src/improvement-lifecycle.test.ts", "packages/api/src/improvement-orphan-sweep.ts", "packages/api/src/improvement-redaction.test.ts", "packages/api/src/improvement-retention.test.ts", "packages/api/src/index.ts", "packages/api/src/routes/improvement.ts", "packages/api/src/scheduled-maintenance-budget.test.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/schema-guard.test.ts", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/core/src/improvement-screen.ts", "packages/core/src/improvement.ts", "packages/core/src/index.ts", "packages/core/test/improvement-highlights-contract.test.ts", "packages/core/test/improvement-screen.test.ts", "packages/web/package.json", "packages/web/scripts", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/api.ts", "packages/web/src/capture-screen.ts", "packages/web/src/common-shell-routes.dom.test.tsx", "packages/web/src/components/ImprovementRequestButton.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/improvement-capture.dom.test.tsx", "packages/web/src/pages/Improvement.tsx", "packages/web/src/pages/improvement", "packages/web/src/routeMetadata.ts", "packages/web/src/styles.css", "specs/spec-improvement-screen.md"]
purpose: "改善リクエスト画面を、利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、使っていて困ったことを、そのとき見えていた画面 (個人情報を伏せた画像) と診断情報ごと 1 画面で送り、送った依頼の状態・履歴・関連する依頼を同じ画面で追い、Claude Code / Codex がそのまま着手できる指示文として取り出せる場にする。送る前に何が伏せられるかを確かめられ、送った後も誤って消した依頼を戻せることで、改善の経路から個人情報と記録の欠けを無くす。"
goal: "/improvement が 20-improvement.png の構成 (問いの見出しと説明・使い方リンク・共通の期間・作成フォーム (スクリーンショットと撮り直し/差し替え/削除・本文 0/1000・プライバシー確認 2 つ・自動マスキングの説明・送信)・一覧 (検索・すべて/受付/対応中/完了/再確認の件数タブ・選択・表・10 件ずつのページング)・詳細パネル (IMP 番号と状態・本文・添付画像と拡大・マスク済み診断・アクティビティ・関連する依頼・状態変更・再発行・Claude Code 用 / Codex 用のコピー・削除)・空状態・読み込み失敗と再読み込み・画面キャプチャの浮動パネル・選択中バー・コピー完了トースト) を共通シェルの文言を除いてトークンと共通部品で描画し、状態・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクが core の improvement-screen (とマスクを拡張した improvement.ts) 1 か所で導かれて API と web が写すだけになり、migration 0053 (状態の CHECK 張り替えと wontfix→完了の移し替え・利用者ごとの連番・論理削除の列・件名の NULL 許容・アクティビティの表) と削除・復元の経路で削除した依頼が同じ番号のまま戻り、削除中の行が全ての読み取り経路から外れ、30 日後に夜間の improvement_retention で行・履歴・R2 の画像が消え (夜間予算 49 は audit_header_retention の読み取り 1 本を回して維持、D-imp-008)、画像・本文・診断から個人情報がブラウザとサーバの両方で伏せられた状態。"
scope_in: ["改善リクエスト画面 (20-improvement.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。packages/web/src/pages/Improvement.tsx を packages/web/src/pages/improvement/ 配下 (ImprovementPage・view-model・作成フォーム・一覧・詳細パネル・撮影パネル・選択中バー・トースト) へ分割し、選択中の依頼・タブ・検索・ページを URL に保つ。見出しを『改善リクエスト』に揃える (I1)", "作成フォームを画面内へ置く。件名欄を廃止し本文 1000 字、概要は本文 1 行目から core で最大 40 字を切り出す。プライバシー確認 2 つの必須化と自動マスキングの対象の説明 (qa-imp-decision-002)", "画面キャプチャの浮動パネル (キャプチャする・範囲を選択する)。右下の『改善を送る』(Layout.tsx) からどの画面でもパネルを出し、撮影後に画像と関連ページを持って /improvement の作成フォームへ移る。撮り直しは関連ページへ戻ってパネルを出す。ImprovementRequestButton.tsx のモーダルはパネルの入口に変える (I5)", "撮影用 DOM 複製の伏字 (data-capture-mask) と、本文・診断情報のマスク規則の拡張 (金額・電話・住所・取引先名の辞書・個人名の辞書)。ブラウザとサーバで同じ core の規則を掛ける (I3)", "packages/core/src/improvement-screen.ts の純関数 (状態の体系と遷移・概要・IMP 番号・検索・件数タブ・ページング・関連する依頼・アクティビティ・診断の表示用要約) (I2)", "migration 0053 (状態の CHECK 張り替えと wontfix→完了の移し替え・理由のアクティビティ記録・利用者ごとの連番・論理削除の列・件名の NULL 許容・アクティビティの表)。schema.ts と runtimeSchemaGuard の期待 migration を 0053 へ進める (I4)", "API: DELETE /api/improvements/:id の論理削除と復元の新設、一覧 (検索・件数・ページング)・詳細 (履歴・関連する依頼)・作成・状態変更・再発行の拡張、全ての読み取り経路への削除中の行の除外 (I4)", "入力検証 (本文 1000 字・プライバシー確認 2 つ・状態の候補・画像の形式と 2MB) を core と API の zod で揃え、他の利用者の依頼を 404 にする (I6)", "夜間の完全消去を既存の improvement_retention に相乗りさせ、audit_header_retention の読み取りを 1 本減らして夜間予算 49 を維持する (D-imp-008)。BACKUP_SNAPSHOT_SQL に改善リクエストの表を入れない不変条件を保つ", "core・API・DOM のテストと、docs/improvement-request.md・runbook の更新"]
scope_out: ["共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) の変更。画像の文言は期待値にしない (U7)", "改善を起点にした自動修正・自動 PR 作成と、外部の課題管理サービスへの連携 (2026-09-02 サイクルの範囲外を維持)", "関連する依頼の手動紐付け。自動導出だけにする (qa-imp-decision-006)", "複数利用者の間での依頼の共有と権限分離。単一利用者の運用を維持する", "モバイル・タブレット・デスクトップ専用アプリ。狭い幅はレスポンシブ web で扱う (qa-imp-decision-005)", "新しい Cron・新しい資格情報の種類・R2 のキーの形の変更"]
acceptance: ["S1 (G1): /improvement で 20-improvement.png の構成要素 (共通シェルの文言を除く) がすべて描画され、色・余白・部品はトークンと共通部品経由で、直書き色の lint が 0 件、読込 / 空 / 失敗の各状態とプライバシー確認 2 つが未チェックのとき送信不可であることが DOM テストで固定されている。", "S2 (G2): 送信された画像・本文・診断情報に、口座情報・取引先名・金額・個人名・メールアドレス・電話番号・住所・秘匿値が 1 件も残らず、クライアントのマスクを飛ばした投稿にもサーバで同じ規則が掛かることが core・DOM・API のテストで固定されている。", "S3 (G3): 状態・概要・番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクが core だけで計算され、API と web はその結果を写すだけで、web と api に同じ計算の重複が無い (grep で 0 件)。", "S4 (G4): 他の利用者の依頼の取得・変更・削除・復元が 404、不正な入力 (空の本文、1000 字超、プライバシー確認の欠け、候補外の状態、形式外・2MB 超の画像) が 400 になり、削除した依頼は『元に戻す』で同じ id と番号のまま戻り、削除中の行が一覧と件数に 0 件、30 日経過の完全消去で R2 の画像と履歴が消える。", "S5 (全体): migration 0053 の適用で既存の行・R2 の画像・トークンが失われず (wontfix は完了へ移り理由が履歴に残る)、夜間予算テストが total === PLAN_MAX (49) を固定し、BACKUP_SNAPSHOT_SQL に改善リクエストの表が無く、pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0 で、旧 Improvement.tsx とモーダルにあった操作がすべて新しい構成から実行できる。受入は実行済みの最新のテスト証跡だけで判定する。"]
architecture_refs: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "状態と番号・概要・一覧・関連・マスクの導出 (core) → 削除・復元と全読取経路の除外・入力検証 (API) → 連番・論理削除・履歴の表と状態の張り替え (migration 0053) → 夜間の完全消去 (improvement_retention の相乗り) → 作成フォーム・一覧・詳細・撮影パネル (画面) が、同じ『削除中の行を読まない』契約と同じ core のマスク規則を起点に連鎖する 1 つの価値単位で、画面だけ・API だけでは『画面の文脈を保ったまま個人情報を伏せて改善を共有し、追い、戻せる』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-improvement-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T14:02:50Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# 目的

改善リクエスト画面を、利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、使っていて困ったことを、そのとき見えていた画面 (個人情報を伏せた画像) と診断情報ごと 1 画面で送り、送った依頼の状態・履歴・関連する依頼を同じ画面で追い、Claude Code / Codex がそのまま着手できる指示文として取り出せる場にする。送る前に何が伏せられるかを確かめられ、送った後も誤って消した依頼を戻せることで、改善の経路から個人情報と記録の欠けを無くす。

規範 (要件・業務規則・確定意思決定 qa-imp-decision-001〜007・D-imp-008) の正本は `specs/spec-improvement-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/improvement が 20-improvement.png の構成 (問いの見出しと説明・使い方リンク・共通の期間・作成フォーム (スクリーンショットと撮り直し/差し替え/削除・本文 0/1000・プライバシー確認 2 つ・自動マスキングの説明・送信)・一覧 (検索・すべて/受付/対応中/完了/再確認の件数タブ・選択・表・10 件ずつのページング)・詳細パネル (IMP 番号と状態・本文・添付画像と拡大・マスク済み診断・アクティビティ・関連する依頼・状態変更・再発行・Claude Code 用 / Codex 用のコピー・削除)・空状態・読み込み失敗と再読み込み・画面キャプチャの浮動パネル・選択中バー・コピー完了トースト) を共通シェルの文言を除いてトークンと共通部品で描画し、状態・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクが core の improvement-screen (とマスクを拡張した improvement.ts) 1 か所で導かれて API と web が写すだけになり、migration 0053 (状態の CHECK 張り替えと wontfix→完了の移し替え・利用者ごとの連番・論理削除の列・件名の NULL 許容・アクティビティの表) と削除・復元の経路で削除した依頼が同じ番号のまま戻り、削除中の行が全ての読み取り経路から外れ、30 日後に夜間の improvement_retention で行・履歴・R2 の画像が消え (夜間予算 49 は audit_header_retention の読み取り 1 本を回して維持、D-imp-008)、画像・本文・診断から個人情報がブラウザとサーバの両方で伏せられた状態。

## スコープ

- スコープ内:
  - 改善リクエスト画面 (20-improvement.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。packages/web/src/pages/Improvement.tsx を packages/web/src/pages/improvement/ 配下 (ImprovementPage・view-model・作成フォーム・一覧・詳細パネル・撮影パネル・選択中バー・トースト) へ分割し、選択中の依頼・タブ・検索・ページを URL に保つ。見出しを『改善リクエスト』に揃える (I1)
  - 作成フォームを画面内へ置く。件名欄を廃止し本文 1000 字、概要は本文 1 行目から core で最大 40 字を切り出す。プライバシー確認 2 つの必須化と自動マスキングの対象の説明 (qa-imp-decision-002)
  - 画面キャプチャの浮動パネル (キャプチャする・範囲を選択する)。右下の『改善を送る』(Layout.tsx) からどの画面でもパネルを出し、撮影後に画像と関連ページを持って /improvement の作成フォームへ移る。撮り直しは関連ページへ戻ってパネルを出す。ImprovementRequestButton.tsx のモーダルはパネルの入口に変える (I5)
  - 撮影用 DOM 複製の伏字 (data-capture-mask) と、本文・診断情報のマスク規則の拡張 (金額・電話・住所・取引先名の辞書・個人名の辞書)。ブラウザとサーバで同じ core の規則を掛ける (I3)
  - packages/core/src/improvement-screen.ts の純関数 (状態の体系と遷移・概要・IMP 番号・検索・件数タブ・ページング・関連する依頼・アクティビティ・診断の表示用要約) (I2)
  - migration 0053 (状態の CHECK 張り替えと wontfix→完了の移し替え・理由のアクティビティ記録・利用者ごとの連番・論理削除の列・件名の NULL 許容・アクティビティの表)。schema.ts と runtimeSchemaGuard の期待 migration を 0053 へ進める (I4)
  - API: DELETE /api/improvements/:id の論理削除と復元の新設、一覧 (検索・件数・ページング)・詳細 (履歴・関連する依頼)・作成・状態変更・再発行の拡張、全ての読み取り経路への削除中の行の除外 (I4)
  - 入力検証 (本文 1000 字・プライバシー確認 2 つ・状態の候補・画像の形式と 2MB) を core と API の zod で揃え、他の利用者の依頼を 404 にする (I6)
  - 夜間の完全消去を既存の improvement_retention に相乗りさせ、audit_header_retention の読み取りを 1 本減らして夜間予算 49 を維持する (D-imp-008)。BACKUP_SNAPSHOT_SQL に改善リクエストの表を入れない不変条件を保つ
  - core・API・DOM のテストと、docs/improvement-request.md・runbook の更新
- スコープ外:
  - 共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) の変更。画像の文言は期待値にしない (U7)
  - 改善を起点にした自動修正・自動 PR 作成と、外部の課題管理サービスへの連携 (2026-09-02 サイクルの範囲外を維持)
  - 関連する依頼の手動紐付け。自動導出だけにする (qa-imp-decision-006)
  - 複数利用者の間での依頼の共有と権限分離。単一利用者の運用を維持する
  - モバイル・タブレット・デスクトップ専用アプリ。狭い幅はレスポンシブ web で扱う (qa-imp-decision-005)
  - 新しい Cron・新しい資格情報の種類・R2 のキーの形の変更

## 受入

- [ ] S1 (G1): /improvement で 20-improvement.png の構成要素 (共通シェルの文言を除く) がすべて描画され、色・余白・部品はトークンと共通部品経由で、直書き色の lint が 0 件、読込 / 空 / 失敗の各状態とプライバシー確認 2 つが未チェックのとき送信不可であることが DOM テストで固定されている。
- [ ] S2 (G2): 送信された画像・本文・診断情報に、口座情報・取引先名・金額・個人名・メールアドレス・電話番号・住所・秘匿値が 1 件も残らず、クライアントのマスクを飛ばした投稿にもサーバで同じ規則が掛かることが core・DOM・API のテストで固定されている。
- [ ] S3 (G3): 状態・概要・番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクが core だけで計算され、API と web はその結果を写すだけで、web と api に同じ計算の重複が無い (grep で 0 件)。
- [ ] S4 (G4): 他の利用者の依頼の取得・変更・削除・復元が 404、不正な入力 (空の本文、1000 字超、プライバシー確認の欠け、候補外の状態、形式外・2MB 超の画像) が 400 になり、削除した依頼は『元に戻す』で同じ id と番号のまま戻り、削除中の行が一覧と件数に 0 件、30 日経過の完全消去で R2 の画像と履歴が消える。
- [ ] S5 (全体): migration 0053 の適用で既存の行・R2 の画像・トークンが失われず (wontfix は完了へ移り理由が履歴に残る)、夜間予算テストが total === PLAN_MAX (49) を固定し、BACKUP_SNAPSHOT_SQL に改善リクエストの表が無く、pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0 で、旧 Improvement.tsx とモーダルにあった操作がすべて新しい構成から実行できる。受入は実行済みの最新のテスト証跡だけで判定する。

## アーキテクチャ参照

- `architecture_refs`: `arch-improvement-screen-ui-ux`, `arch-improvement-screen-frontend`, `arch-improvement-screen-backend`, `arch-improvement-screen-database`, `arch-improvement-screen-auth`, `arch-improvement-screen-security`, `arch-improvement-screen-infrastructure`, `arch-improvement-screen-maintenance-ops`
- 領域別の制約と既存実装の是正点は各ノードの本文 (`architecture/improvement-screen-ui-ux.md`, `architecture/improvement-screen-frontend.md`, `architecture/improvement-screen-backend.md`, `architecture/improvement-screen-database.md`, `architecture/improvement-screen-auth.md`, `architecture/improvement-screen-security.md`, `architecture/improvement-screen-infrastructure.md`, `architecture/improvement-screen-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-improvement-screen` (feature ノードへの依存は無い)
- 依存理由: 状態の体系と wontfix の移し替え・件名の廃止と概要の切り出し・論理削除と 30 日の完全消去・マスクの対象 7 種・関連する依頼の導き方・IMP 番号の採番・夜間予算の枠の回し方の決定が確定していないと、core の返り値型・API 応答・migration 0053 の列・テストの期待値が実装中に揺れるため。
- 先行 feature: `feat-improvement-request` (2026-09-02 サイクル。migration 0029・core/improvement.ts・routes/improvement.ts・Improvement.tsx・投稿モーダルを構築) は main に取り込み済みで、本 worktree の state graph には載っていない。本 feature はその実装を作り直す後続であり、未完了の feature に依存しないため `depends_on` には入れない。
- 重複の不在: 既存の feature はいずれも改善リクエスト画面の作り直しを scope_in に持たない。feat-improvement-request の成果物 (トークン・R2 のキーの形・バックアップ除外・孤児の掃除) は維持し、再実装しない。共通の usePeriod と PageShell / Layout は使うだけで構造を変えない (Layout は『改善を送る』の入口の差し替えだけ)。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-improvement-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-improvement-screen --feature-context features/feat-improvement-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-improvement-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- `resource_scope` は本体ファイルに加え、Improvement.tsx と投稿モーダルの import 先 (api.ts・capture-screen.ts・routeMetadata・styles.css)、それらを import するファイル (AuthenticatedApp.tsx・Layout.tsx と DOM テスト)、improvement_requests を読む経路 (routes/improvement.ts・improvement/・store.ts・孤児の掃除) とそのテスト、runtimeSchemaGuard、夜間予算と audit_header_retention (audit-log.ts)、反映手順の workflow まで引いた。新設予定の `packages/core/src/improvement-screen.ts`・`packages/core/test/improvement-screen.test.ts`・`packages/web/src/pages/improvement/` は予定の置き場所であり、名前は該当 task の設計で確定する。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S5 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (本文で「agent 推定・利用者未確認」と注記した値: 一覧を期間で絞らないこと、コピー時の再発行、DELETE と restore の経路、409 の返し方、0053 のファイル名と表の名前、関連ページの画面名の置き場所、agentGuard の 401 と章の 404 の食い違いなど) は `specs/spec-improvement-screen.md` の未決事項を正本とし、該当 task の契約テストで確定する。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
- 実装中の追補 (2026-09-24、利用者依頼): 撮った画像への書き込みを、番号の印から「枠・ペン・文字・マスク・移動の 5 道具と 5 色、操作の取り消し、拡大して書き込むダイアログ」へ広げた。仕様は `specs/spec-improvement-screen.md` の FR-27、設計は `architecture/improvement-screen-frontend.md` と `docs/improvement-screen/design-decisions.md` の 10 章。本 feature の scope_in (撮影と送信前の確認) の内側の変更で、新しい API・表・権限は無い。
