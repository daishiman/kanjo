---
graph_node_id: "arch-budget-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "予算 — KPI と過不足から一覧と科目パネルを往復し保存バーで確定する 1 画面"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "ui-ux"]
file_path: "architecture/budget-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "cdcb7210699bd4c8fedd6a834ad74b55bed23a17a36441417b285fdbd14665c1"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "cdcb7210699bd4c8fedd6a834ad74b55bed23a17a36441417b285fdbd14665c1", "imported_at": "2026-09-21T13:59:08Z"}
created_at: "2026-09-21T13:59:08Z"
updated_at: "2026-09-21T13:59:08Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-frontend", "arch-budget-backend", "arch-budget-database", "arch-budget-security", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-auth"]
resource_scope: ["packages/web/src/pages/budget/", "packages/web/src/pages/Budget.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/Term.tsx", "packages/web/src/glossary.ts", "packages/web/src/period.tsx", "docs/ui-decisions.md", "design/FINAL-UI/images/14-budget.png", "design/FINAL-UI/spec/AUDIT.md"]
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
classification_reason: "system-spec の ui-ux 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/budget-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T13:59:08Z"}
serves_goals: ["G1", "G2", "G4"]
---

# Architecture overview

予算 — KPI と過不足から一覧と科目パネルを往復し保存バーで確定する 1 画面。`system-spec/ui-ux.md` は承認時入力、本書は画面構成・操作の流れ・表示の約束の制約を持つ。目標の見た目は `design/FINAL-UI/images/14-budget.png`、逐語の正本は `specs/spec-budget-screen.md`。

## Context and drivers

- Business/technical context: 現行の予算画面 (`packages/web/src/pages/Budget.tsx`) は科目別の月額の入力と着地見込みを持つが、予算対象の期間・収入の行・KPI 4 枚・月次グラフ・科目パネル・過不足カテゴリ・調整によるインパクト・保存バーを持たない。共通部品は `components/Page.tsx` (`PageHeader` / `PageState` / `KpiCard`)・`Button.tsx`・`ConfirmDialog.tsx`・`Term.tsx` と用語集 `glossary.ts`、期間は `period.tsx` (`usePeriod` / `PeriodPicker`)。画面の決定は `docs/ui-decisions.md`、画像との監査は `design/FINAL-UI/spec/AUDIT.md` に残る。
- Quality attribute priorities: G1・G2・G4 に資する。Apple HIG presentation (差額と過不足は色だけで伝えず、+ / − の符号と『増加』『減少』の文言を併記する = WCAG 2.2 SC 1.4.1 (https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)。グラフの 4 系列は凡例の文字と並び順で区別し、実績と見通しの境目は縦線と期間の注記の両方で示す) を適用する。本章での適用は Visual hierarchy で、KPI と過不足で『どこを調整するか』を示し、一覧と科目パネルを往復して決め、すべてリセットは確認を挟み、未保存件数を常に見せる。
- Constraints: 画像の『AI・統計推奨』『AI提案と比較』は外部推論をしないため『自動提案』と表示する (qa-budget-decision-003)。見出し帯の『取引ライン』は既存ヘッダの『防衛ライン』のままとし、共通シェルは作り直さない。収入の行を一覧に含める (qa-budget-decision-002)。

## Goals and non-goals

- Goals:
  - G1: 画面を (1) パンくず『計画 / 予算』と期間タブ、(2) 見出し『予算』・問い『実績に合う予算へ、どこを調整しますか？』・説明文・予算対象、(3) KPI 4 枚、(4) 月次グラフと今後の見通し、(5) 予算一覧、(6) 科目パネル、(7) 過不足カテゴリ、(8) 調整によるインパクト、(9) 保存バー で構成する (qa-budget-ui-ux-web-001)。読込・空 (実績 0 か月)・失敗の各状態を持つ。
  - G2: KPI は 年間収入予算・年間支出予算・予算純収支・防衛ライン余裕 (年間収入予算 − 防衛ライン × 12) とし、防衛ライン余裕は ? で定義を示す (qa-budget-decision-002, 004)。科目パネルで自動提案の根拠 (前期実績・増減率・計画による調整・季節性補正・推奨値) を示す (qa-budget-decision-003)。
  - G4: 入力は下書きとして自動保存し、未保存 N 項目・最終保存時刻・下書きを自動保存した旨を保存バーに出す。この行を元に戻す・すべてリセット (確認つき)・未保存のまま離れるときの確認を持つ。
- Non-goals:
  - 提案の出所を『AI』と表示すること
  - 見出し帯の『取引ライン』の導入・共通シェルの作り直し
  - 他の画面の作り直し

## System context and boundaries

- Users/external systems: 来期の予算を計画する利用者本人。診断画面から `?account=` で遷移してくる。
- Trust/deployment/data boundaries: 画面は API の値を表示し、KPI・自動提案・過不足を計算しない (`architecture/budget-frontend.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| (1)(2) 見出しと予算対象 | パンくず・期間タブと期間送り・見出し・問い・説明文 2 文・予算対象 (12 か月の開始月と『来期の12か月の予算を編集できます。』) | `PageHeader` + `PeriodPicker` | packages/web | 静的配信 |
| (3) KPI 4 枚 | 年間収入予算・年間支出予算・予算純収支・防衛ライン余裕 (? で定義) | `KpiCard` + `Term` | packages/web | 静的配信 |
| (4) 月次グラフと今後の見通し | 収入 実績 / 収入 予算 / 支出 実績 / 支出 予算の棒と見通し (収支) の折れ線、境目の縦線と期間の注記。累計収入・累計支出・累計純収支と見通しコメント | 画面専用 (SVG) | packages/web | 静的配信 |
| (5) 予算一覧 | カテゴリ検索・実績から提案・すべてリセット。列は選択・#・カテゴリ・前期実績・来期予算 (保存済み)・自動提案・差額・見通し・来期予算 (入力) | 画面専用 | packages/web | 静的配信 |
| (6) 科目パネル | 提案の根拠 / 関連データのタブ・自動提案と前期差・この値を適用・推奨の根拠・計算の詳細・計画による調整額と理由・過去 12 か月の月別実績・主な根拠データ・適用前の値・この行を元に戻す・閉じる | 画面専用 | packages/web | 静的配信 |
| (7) 過不足カテゴリ | 支出の増加が見込まれる / 支出の減少が見込まれる のタブと件数、#・カテゴリ・見通し・差額・要因 | 画面専用 | packages/web | 静的配信 |
| (8) 調整によるインパクト | 自動提案と比べた年間の支出差・予算純収支・差の大きい科目・注意書き | 画面専用 | packages/web | 静的配信 |
| (9) 保存バー | 未保存 N 項目・最終保存時刻と下書きの自動保存・リセット・予算を保存 | 画面専用 + `Button` + `ConfirmDialog` | packages/web | 静的配信 |

## Cross-cutting contracts

- Identity/access: 既存のセッションに乗る。
- Errors/resilience: 保存の失敗は保存バーに出し、下書きは残す。取込中の競合 (409) は保存できなかった旨を出して再試行を促す。読込の失敗は `PageState` の失敗状態で再読込を促す。
- Observability/audit: N/A: 画面に観測信号を追加しない。最終保存時刻を保存バーに出す。
- Configuration/secrets: N/A: 画面に設定・秘密情報を持たない。
- Compatibility/versioning: 用語は `glossary.ts` と `Term` で揃える。防衛ラインの語と値はヘッダと同じものを使う。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/budget-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/budget-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/budget-database.md`)
- Security: N/A: 本章の関心外 (`architecture/budget-security.md`)

### Frontend architecture

#### Rendering and application pattern

- 既存の SPA の 1 画面。画面の入口がデータを読み、(1)〜(9) の部品へ渡す。数値は API から受け取り、下書きの入力に応じた再表示だけを画面が受け持つ (`architecture/budget-frontend.md`)。

#### Routes, screens and navigation

- `/budget` の 1 画面で完結させる。予算対象の既定は実績期間の終了月の翌月から 12 か月 (agent 推定・利用者未確認、根拠 qa-budget-ui-ux-web-002)。
- 一覧の行を押すと科目パネルを開き、診断からの `?account=` はその行を選んで科目パネルを開く。過不足カテゴリの行を押すと一覧の該当行を選ぶ。
- Ctrl+K (macOS は ⌘K) でカテゴリ検索へ移る (agent 推定・利用者未確認、根拠 qa-budget-ui-ux-web-002)。

#### Component and design-system boundaries

- 共通部品 (`PageHeader` / `KpiCard` / `Button` / `ConfirmDialog` / `PeriodPicker` / `Term`) とデザイントークンを使い、画面専用の部品は `pages/budget/` に置く。画面専用の色・余白を作らない。
- 差額は + を赤系・− を緑系にし、符号の文字も併記する (agent 推定・利用者未確認、根拠 qa-budget-ui-ux-web-002)。過不足のタブは『増加』『減少』の文言で区別する。
- グラフの 4 系列は凡例の文字と並び順で区別し、実績と見通しの境目は縦線と期間の注記の両方で示す。
- 提案の表示名は『自動提案』とする。

#### State and data flow

- 一覧の並びは収入の行が先頭、支出は前期実績の降順 (agent 推定・利用者未確認、根拠 qa-budget-ui-ux-web-002)。
- 過不足は各タブで |差額| の上位 5 件を出す (agent 推定・利用者未確認、根拠 qa-budget-ui-ux-web-002)。
- 来期予算の入力・この値を適用・実績から提案・計画による調整は下書きに入り、KPI・グラフ・見通し・インパクト・未保存件数へ即座に反映する。保存成功で下書きを消す。

#### Backend integration

- 表示の数値は画面用の取得 1 本の応答を使い、保存は予算対象の期間ごとに 1 回で送る (`architecture/budget-backend.md`)。
- 見通しコメントと過不足の要因は API が数値から決定論で組んだ文を表示する。

#### Performance and observability

- 画面幅 1024px 未満では右の科目パネルを一覧の下に積む (agent 推定・利用者未確認、根拠 qa-budget-ui-ux-web-002)。
- 観測信号は追加しない。

#### Frontend verification

DOM テストで、(1)〜(9) が揃うこと、問いと説明文の文言、KPI が 4 枚で防衛ライン余裕に定義の ? があること、収入の行 (売上高・その他収入) が一覧にあること、行を押すと科目パネルが開き計算の詳細の 5 項目が出ること、`?account=` で該当行が開くこと、差額が符号の文字でも示されること、過不足のタブに『増加』『減少』の文言があること、表示名が『自動提案』で『AI』が無いこと、すべてリセットが確認を挟むこと、未保存件数が入力に応じて変わることを確かめる。`design/FINAL-UI/images/14-budget.png` と画面を目視で突き合わせ、差分を `design/FINAL-UI/spec/AUDIT.md` の形で記録する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-budget-ui-ux-web-001 | 画面を (1)〜(9) の 1 画面で構成する | 科目の詳細や過不足を別画面にする | KPI を見たまま科目を調整し保存まで進める | 1 画面の部品が多くなる |
| qa-budget-decision-002 | 収入の行を一覧に含め、KPI を収入・支出・純収支・防衛ライン余裕の 4 枚にする | 支出だけの予算 | 画像どおりの KPI が一覧の和から出る | 『その他収入』は実績 0 の手入力行になる |
| qa-budget-decision-003 | 表示名を『自動提案』にし、計算の詳細で根拠の各項を示す | 『AI・統計推奨』と表示する | 外部推論をしない実装と一致し、根拠を追える | 画像と文言が一部異なる |
| qa-budget-ui-ux-web-001 | 差額と過不足は色に加えて符号と『増加』『減少』の文言で示す | 色だけで示す | 色覚に依らず読める (SC 1.4.1) | 符号と文言の分だけ幅を使う |
| qa-budget-ui-ux-web-002 | 収入先頭・支出は前期実績の降順、過不足は上位 5 件、1024px 未満はパネルを下に積む (agent 推定・利用者未確認) | 科目名順 / 全件表示 | 影響の大きい科目から目に入る | 並びと件数を仕様とテストで揃える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web の静的配信。
- Migration sequence: (1)〜(3) 見出し・予算対象・KPI → (5) 一覧 → (6) 科目パネル → (4) グラフと見通し → (7)(8) 過不足とインパクト → (9) 保存バーと下書き → `docs/ui-decisions.md` と `design/FINAL-UI/spec/AUDIT.md` の更新。
- Rollback trigger/procedure: DOM テストか目視の確認で不具合が出たら web を直前版へ戻す。

## Risks and verification

- Risk/assumption: 差額の色 (+ を赤系・− を緑系) は支出の行では妥当だが、収入の行では増加が良い方向になる。収入の行で色の意味を変えるかは `specs/spec-budget-screen.md` で決め、DOM テストで固定する。
- Risk/assumption: 画像は 1 画面に多くの部品を並べるため、1024px 未満で科目パネルを一覧の下に積むと、行を選んでもパネルが画面外になる。選んだときにパネルへ移るかを仕様で決める。
- Risk/assumption: 『その他収入』は実績 0 のため前期実績・自動提案・差額が 0 になり、見通しコメントや過不足に意味のない行が出うる。表示の扱いを仕様で決める。
- Architecture fitness test: 画面に『AI』の表示が無いこと。差額の表示に符号の文字があること。共通シェル (ヘッダ・ナビ) の差分が無いこと。
- Load/failure/security validation: 3 年分の期間でも一覧・グラフ・科目パネルが表示されること。保存の失敗で下書きが残ること。
