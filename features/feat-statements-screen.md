---
graph_node_id: "feat-statements-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "決算書画面 (11-statements) の作り直しと段階損益・CF 可否・負債 3 状態の core 単一化"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "statements", "feature"]
file_path: "features/feat-statements-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "87e3702283b442f03cc442cbaaf04ef806112b1fe361c30885e889428f879cf8"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-statements-screen.md", "source_version": "0.1.11", "source_digest": "5ff3457cefb6598f92de43f56aa1b3c1ce480953fa9484d56c6d730cad978e47", "imported_at": "2026-09-19T23:36:20Z"}
created_at: "2026-09-19T12:11:27Z"
updated_at: '2026-09-19T23:36:20Z'
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-backend", "arch-statements-database", "arch-statements-auth", "arch-statements-security", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
resource_scope: ["architecture/statements-auth.md", "architecture/statements-backend.md", "architecture/statements-database.md", "architecture/statements-frontend.md", "architecture/statements-infrastructure.md", "architecture/statements-maintenance-ops.md", "architecture/statements-security.md", "architecture/statements-ui-ux.md", "design/FINAL-UI/images/11-statements.png", "docs/data-schema.md", "docs/design-system.md", "docs/ui-decisions.md", "migrations", "packages/api/src/audit-log-d8.test.ts", "packages/api/src/audit-log.ts", "packages/api/src/balances-lifecycle.test.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/db/schema.ts", "packages/api/src/deletion-full-reset.ts", "packages/api/src/deletion-lifecycle.test.ts", "packages/api/src/deletion-lifecycle.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/balances.ts", "packages/api/src/schema-guard.ts", "packages/core/src/balances.ts", "packages/core/src/deletion.ts", "packages/core/src/index.ts", "packages/core/src/statements-screen.ts", "packages/core/src/statements.ts", "packages/core/test/balances-contract.test.ts", "packages/core/test/deletion-scope-contract.test.ts", "packages/core/test/statements-contract.test.ts", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/src/api.ts", "packages/web/src/common-shell-routes.dom.test.tsx", "packages/web/src/components/FinancialCharts.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/figure-guides.ts", "packages/web/src/mobile-financial-layout.test.ts", "packages/web/src/pages/Statements.tsx", "packages/web/src/pages/statements/", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/statements-balance-sheet.dom.test.tsx", "packages/web/src/styles.css", "specs/spec-statements-screen.md"]
purpose: "決算書画面を、『損益・資金・残高は、整合していますか？』という問いに 1 画面で答え、月次クローズと確定申告の前に損益計算書・キャッシュフロー計算書・貸借対照表の数字と根拠を辿り、足りない負債残高をその場で入れて決着させられる場にする。段階損益・前期比・構成比・計算式・主な内訳科目を core の 1 か所で算出し、CF が集計できないときは原因を件数つきで示し、負債残高を『未入力 / 0円 / 金額』の 3 状態で値を失わずに保存できる状態にする。"
goal: "/statements が 11-statements.png の全構成要素 (問いの見出しと説明文・期間の範囲表示と前後移動・KPI 4 枚 (売上高・営業利益は前期比の金額と %、現金増減は前期比の金額のみ、負債残高は前月末比の金額と % で減少を良化色、各々出典と対象期間 / 基準日)・3 計算書へのページ内ナビ (nav + aria-current、3 節は縦にすべて描画)・PL 表 5 行 5 列と行の展開とエクスポート・右の項目の詳細パネル・月別の損益推移グラフ・月次の損益計算書表 (万円・合計列)・CF の集計不能表示または営業 CF 概算・BS の負債 3 状態入力・下部の未保存バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、834px 幅の overlay で明示除外以外の視覚差を 0 件にし、数値と CF の可否・原因件数・負債の完了判定が core の純関数 1 か所 (statementsScreen) で算出されて GET /api/statements がその screen だけを返し、負債が PUT /api/balances/liabilities で項目単位に upsert され migration 0046 の状態列と liability_audit_log に保存され、入力上限・本文上限・監査・未認証拒否を持ち、旧画面の操作を失わずに置き換わった状態。"
scope_in: ["決算書画面 (11-statements.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。選択中のナビ項目と PL の行と基準月を URL に保ち、期間は既存 usePeriod を引き継ぐ。部品は packages/web/src/pages/statements/ 配下へ分ける", "ページ内ナビ (nav のリンク、選んだ 1 項目だけ aria-current=\"location\"、該当節の見出しへフォーカス、role=tab を使わない) と、PL 行の選択ボタン (aria-pressed)・行の展開 (aria-expanded)", "packages/core の純関数 statementsScreen (新設 statements-screen.ts): 勘定科目→区分の固定対応表・段階損益 (月別と期間合計)・前期比 (前期 0 / null で % は null)・構成比・計算式・主な内訳科目・出典と対象期間、KPI 4 枚 (負債は前月末比)、CF の可否と原因 3 種の件数 (原因が無ければ available)、BS の 3 状態と完了判定 (状態列追加前の金額 0 の行は zero 扱い)", "packages/api: GET /api/statements は {screen} だけを返す。ref=YYYY-MM を期間内へ丸めて screen.bs.referenceMonth で返す。PUT /api/balances/liabilities を送られた項目だけの upsert / 削除 (unset) に変え、zod strict・金額上限 1 兆円・本文 8 KiB (bodyLimit)・行数上限・監査 1 件・保存後の bs を返す", "migration 0046: balance_entries への status 列の追加 (既定 amount、既存行は書き換えない) と liability_audit_log の新設 (状態遷移と件数だけ、金額は残さない)。schema.ts・schema-guard の期待版・削除 / 全消去の対象表への追加", "負債の下書き: localStorage に kanjo.statements.liabilityDraft.<userId>.<YYYY-MM> で 800ms 後に自動保存し保存時刻を示す。リセット・保存成功で消し、ログアウトで接頭辞のキーを全て消す。未保存の項目数を下部の固定バーに出す", "PL の CSV エクスポート (当期・前期・差額・構成比と月次)。文字列セルの数式注入対策 (先頭 = + - @ タブ NUL に ' を前置) と RFC 4180 の引用、金額セルは数値のまま", "詳細パネルの『明細を開く』から明細仕分け画面 (Classify の ?category=&month=) への遷移", "区分の対応表・計算式・CF 原因の判定規則・画像との意図的な差 (§8) の docs (docs/data-schema.md・docs/ui-decisions.md) 記載、834px overlay の画像受入、検算済みフィクスチャ (売上高 12,480,000・営業利益 1,820,000 ほか) による core の契約テスト・API テスト・DOM テスト、既存テスト (statements-balance-sheet.dom.test.tsx ほか) の新しい文言・本文形への更新 (契約を緩めず旧実装で落ちることを確かめる)"]
scope_out: ["投資 CF・財務 CF の区分 (営業 CF の概算に留め、既存 cashFlow() の算出は変えない)", "勘定科目→区分の利用者による上書き (固定の対応表だけにする)", "サーバ側の下書き保存 (ブラウザ内に留め外部へ送らない)", "サイドバー / ヘッダー / フッター / 月次クローズ進捗 / 『改善を送る』の構造変更。ヘッダーの状態表示は画像では『税務ライン』『未処理』『最終更新』、既存 Layout.tsx と U7 では『防衛ライン』バッジ・『未記録』・『最終更新』と呼ぶ同じ要素で、どちらの文言にも変えない", "既存 audit_log の action 拡張 (CHECK 制約の再構築が要り Deploy の自動適用で止まるため、新表で扱う)", "他の画面 (総収支・推移・マトリックス・サブスク・診断・照合など) の作り直しと、web 以外のプラットフォーム"]
acceptance: ["S1 (G1): /statements で 11-statements.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件である。ページ内ナビは nav と aria-current で role=tab が 0 件、負債 KPI は前月末比で減少が良化色、現金増減 KPI に % が無い。834px 幅の overlay で、動的値と仕様 §8 の意図的差を除く視覚差が 0 件である。", "S2 (G2): 画面の KPI・PL 表・詳細パネル・月次表・グラフの数値が core の statementsScreen 1 関数の出力と一致し、段階損益の恒等式 (月別と合計)・前期比 (前期 0 で null)・未知科目は販管費・構成比の契約テストが検算済みフィクスチャで緑である。", "S3 (G3): CF が集計できない fixture で表とグラフが 0 件になり、原因 3 種の件数と解決方法 3 手順と取引データへのリンクが出る。原因が 1 つも無い fixture では available で営業 CF 概算の表とグラフが出て、settlementUnknown 単独でも unavailable になる。", "S4 (G4): 負債を 1 項目ずつ保存しても他項目の保存値が消えず、unset で行が消え、未入力と 0 円が保存後も区別されたまま BS と KPI に反映され、必須 3 項目の状態が未選択なら保存できず、下書きの復元・リセット・未保存件数の表示が緑である。", "S5 (G5): 負債保存で上限超過の金額と 8 KiB 超の本文が 400 / 413、未認証が 401、取込中が 409 になり、保存ごとに liability_audit_log へ金額を含まない 1 件が残り、ログアウトで下書きが消え、verify:full が緑である。"]
architecture_refs: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-backend", "arch-statements-database", "arch-statements-auth", "arch-statements-security", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "I1..I8 は同じ集計契約 (core の statementsScreen → GET /api/statements の screen-only 応答 → 画面の KPI・PL 表・詳細パネル・月次表・CF・BS) と同じ保存 (PUT /api/balances/liabilities の項目単位 upsert と migration 0046 の状態列・監査表) を起点に連鎖する 1 つの価値単位で、画面だけ・API だけでは『損益・資金・残高の整合をその場で確かめて決着させる』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-statements-screen.md"}]
tracker_binding: "beads"
beads_linkage:
  bd_issue_id: kanjo-oju
  linked_at: '2026-09-19T12:47:38Z'
  sync_state: synced
  github_mirror: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:11:27Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

決算書画面を、『損益・資金・残高は、整合していますか？』という問いに 1 画面で答え、月次クローズと確定申告の前に損益計算書・キャッシュフロー計算書・貸借対照表の数字と根拠を辿り、足りない負債残高をその場で入れて決着させられる場にする。段階損益・前期比・構成比・計算式・主な内訳科目を core の 1 か所で算出し、CF が集計できないときは原因を件数つきで示し、負債残高を『未入力 / 0円 / 金額』の 3 状態で値を失わずに保存できる状態にする。

規範 (要件・集計規則・確定意思決定) の正本は `specs/spec-statements-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/statements が 11-statements.png の全構成要素 (問いの見出しと説明文・期間の範囲表示と前後移動・KPI 4 枚 (売上高・営業利益は前期比の金額と %、現金増減は前期比の金額のみ、負債残高は前月末比の金額と % で減少を良化色、各々出典と対象期間 / 基準日)・3 計算書へのページ内ナビ (nav + aria-current、3 節は縦にすべて描画)・PL 表 5 行 5 列と行の展開とエクスポート・右の項目の詳細パネル・月別の損益推移グラフ・月次の損益計算書表 (万円・合計列)・CF の集計不能表示または営業 CF 概算・BS の負債 3 状態入力・下部の未保存バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、834px 幅の overlay で明示除外以外の視覚差を 0 件にし、数値と CF の可否・原因件数・負債の完了判定が core の純関数 1 か所 (statementsScreen) で算出されて GET /api/statements がその screen だけを返し、負債が PUT /api/balances/liabilities で項目単位に upsert され migration 0046 の状態列と liability_audit_log に保存され、入力上限・本文上限・監査・未認証拒否を持ち、旧画面の操作を失わずに置き換わった状態。

## スコープ

- スコープ内:
  - 決算書画面 (11-statements.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。選択中のナビ項目と PL の行と基準月を URL に保ち、期間は既存 usePeriod を引き継ぐ。部品は packages/web/src/pages/statements/ 配下へ分ける
  - ページ内ナビ (nav のリンク、選んだ 1 項目だけ aria-current="location"、該当節の見出しへフォーカス、role=tab を使わない) と、PL 行の選択ボタン (aria-pressed)・行の展開 (aria-expanded)
  - packages/core の純関数 statementsScreen (新設 statements-screen.ts): 勘定科目→区分の固定対応表・段階損益 (月別と期間合計)・前期比 (前期 0 / null で % は null)・構成比・計算式・主な内訳科目・出典と対象期間、KPI 4 枚 (負債は前月末比)、CF の可否と原因 3 種の件数 (原因が無ければ available)、BS の 3 状態と完了判定 (状態列追加前の金額 0 の行は zero 扱い)
  - packages/api: GET /api/statements は {screen} だけを返す。ref=YYYY-MM を期間内へ丸めて screen.bs.referenceMonth で返す。PUT /api/balances/liabilities を送られた項目だけの upsert / 削除 (unset) に変え、zod strict・金額上限 1 兆円・本文 8 KiB (bodyLimit)・行数上限・監査 1 件・保存後の bs を返す
  - migration 0046: balance_entries への status 列の追加 (既定 amount、既存行は書き換えない) と liability_audit_log の新設 (状態遷移と件数だけ、金額は残さない)。schema.ts・schema-guard の期待版・削除 / 全消去の対象表への追加
  - 負債の下書き: localStorage に kanjo.statements.liabilityDraft.<userId>.<YYYY-MM> で 800ms 後に自動保存し保存時刻を示す。リセット・保存成功で消し、ログアウトで接頭辞のキーを全て消す。未保存の項目数を下部の固定バーに出す
  - PL の CSV エクスポート (当期・前期・差額・構成比と月次)。文字列セルの数式注入対策 (先頭 = + - @ タブ NUL に ' を前置) と RFC 4180 の引用、金額セルは数値のまま
  - 詳細パネルの『明細を開く』から明細仕分け画面 (Classify の ?category=&month=) への遷移
  - 区分の対応表・計算式・CF 原因の判定規則・画像との意図的な差 (§8) の docs (docs/data-schema.md・docs/ui-decisions.md) 記載、834px overlay の画像受入、検算済みフィクスチャ (売上高 12,480,000・営業利益 1,820,000 ほか) による core の契約テスト・API テスト・DOM テスト、既存テスト (statements-balance-sheet.dom.test.tsx ほか) の新しい文言・本文形への更新 (契約を緩めず旧実装で落ちることを確かめる)
- スコープ外:
  - 投資 CF・財務 CF の区分 (営業 CF の概算に留め、既存 cashFlow() の算出は変えない)
  - 勘定科目→区分の利用者による上書き (固定の対応表だけにする)
  - サーバ側の下書き保存 (ブラウザ内に留め外部へ送らない)
  - サイドバー / ヘッダー / フッター / 月次クローズ進捗 / 『改善を送る』の構造変更。ヘッダーの状態表示は画像では『税務ライン』『未処理』『最終更新』、既存 Layout.tsx と U7 では『防衛ライン』バッジ・『未記録』・『最終更新』と呼ぶ同じ要素で、どちらの文言にも変えない
  - 既存 audit_log の action 拡張 (CHECK 制約の再構築が要り Deploy の自動適用で止まるため、新表で扱う)
  - 他の画面 (総収支・推移・マトリックス・サブスク・診断・照合など) の作り直しと、web 以外のプラットフォーム

## 受入

- [ ] S1 (G1): /statements で 11-statements.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件である。ページ内ナビは nav と aria-current で role=tab が 0 件、負債 KPI は前月末比で減少が良化色、現金増減 KPI に % が無い。834px 幅の overlay で、動的値と仕様 §8 の意図的差を除く視覚差が 0 件である。
- [ ] S2 (G2): 画面の KPI・PL 表・詳細パネル・月次表・グラフの数値が core の statementsScreen 1 関数の出力と一致し、段階損益の恒等式 (月別と合計)・前期比 (前期 0 で null)・未知科目は販管費・構成比の契約テストが検算済みフィクスチャで緑である。
- [ ] S3 (G3): CF が集計できない fixture で表とグラフが 0 件になり、原因 3 種の件数と解決方法 3 手順と取引データへのリンクが出る。原因が 1 つも無い fixture では available で営業 CF 概算の表とグラフが出て、settlementUnknown 単独でも unavailable になる。
- [ ] S4 (G4): 負債を 1 項目ずつ保存しても他項目の保存値が消えず、unset で行が消え、未入力と 0 円が保存後も区別されたまま BS と KPI に反映され、必須 3 項目の状態が未選択なら保存できず、下書きの復元・リセット・未保存件数の表示が緑である。
- [ ] S5 (G5): 負債保存で上限超過の金額と 8 KiB 超の本文が 400 / 413、未認証が 401、取込中が 409 になり、保存ごとに liability_audit_log へ金額を含まない 1 件が残り、ログアウトで下書きが消え、verify:full が緑である。

## アーキテクチャ参照

- `architecture_refs`: `arch-statements-ui-ux`, `arch-statements-frontend`, `arch-statements-backend`, `arch-statements-database`, `arch-statements-auth`, `arch-statements-security`, `arch-statements-infrastructure`, `arch-statements-maintenance-ops`
- 領域別の制約と既存実装の是正点は各ノードの本文 (`architecture/statements-ui-ux.md`, `architecture/statements-frontend.md`, `architecture/statements-backend.md`, `architecture/statements-database.md`, `architecture/statements-auth.md`, `architecture/statements-security.md`, `architecture/statements-infrastructure.md`, `architecture/statements-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-statements-screen` (feature ノードへの依存は無い)
- 依存理由: 区分の固定対応表・KPI の比較先 (負債は前月末比)・ページ内ナビの意味論・CF の可否規則と原因 3 種・負債の 3 状態と項目単位保存・監査を新表で持つこと・fixture の正本が確定していないと、core の返り値型・API 応答・migration・テストの期待値が実装中に揺れるため。総収支 (#55)・サブスク (#60, #61)・診断 (#59) は main に取り込み済みで、未完了の feature に依存しない。
- 重複の不在: 既存 feature 文書に決算書画面 (`Statements.tsx`・`/api/statements`・`/api/balances/liabilities`) をスコープに持つものは無い。CF は既存 `cashFlow()` を読むだけで算出を変えない。
- 並行サイクルとの接点: `0045_owner_labels.sql` が先に登録されたため、本 feature の実体は `migrations/0046_liability_status.sql` である。番号の再利用をせず、schema guard と運用参照も 0046 に統一する (C4)。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-statements-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-statements-screen --feature-context features/feat-statements-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-statements-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- `resource_scope` は本体ファイルに加え、export の呼び出し元・型で結ばれた宣言・新表を削除 / 全消去の対象へ足す先 (`deletion.ts`・`deletion-full-reset.ts`・`deletion-schema.test.ts`)・本体を import するだけのファイル (テストを含む) まで引いた。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S5 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (CSV のファイル名・グラフの色の割当・詳細パネルの主な内訳の件数など) は `specs/spec-statements-screen.md` と `system-spec/` の agent 判断 (qa-statements-agent-decisions-001) を正本とし、該当 task の契約テストで確定する。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
