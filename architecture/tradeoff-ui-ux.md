---
graph_node_id: "arch-tradeoff-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "トレードオフ — 画像の構成要素を 1 画面に並べ、差額と防衛ラインを文字で伝える"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "ui-ux"]
file_path: "architecture/tradeoff-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2682e1d737675bd52781e250e8d536b0b04dc4c1189477e902a9778332afe050"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "2682e1d737675bd52781e250e8d536b0b04dc4c1189477e902a9778332afe050", "imported_at": "2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Tradeoff.tsx", "packages/web/src/pages/tradeoff", "packages/web/src/period.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/pages/subscriptions/SelectionBar.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/tradeoff-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:35:02Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---
# Architecture overview

> 本書は spec から生成した領域別投影であり、規則の正本ではない。差異は `specs/spec-tradeoff-screen.md` を優先し、spec 変更後に再生成・同期する。

トレードオフ — 画像の構成要素を 1 画面に並べ、差額と防衛ラインを文字で伝える。`system-spec/ui-ux.md` は承認時入力、本書は画面の構成・文言・状態の制約を持つ。文言と状態の正本は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の「UI・状態遷移」の節。

## Context and drivers

- Business/technical context: 現行 `packages/web/src/pages/Tradeoff.tsx` (257 行) は内容・金額・単発 / 毎月の入力、検知器の改善案を写した候補のチェック一覧、月額同士の 2 値判定 (`covered >= amt`)、保存済み試算の一覧と翌月の突合を持つ。15-tradeoff.png の開始月・メモ、候補表の列と検索・カテゴリ絞込・全クリア、必要度と推移、推奨の組み合わせ、右側の試算結果、防衛ラインへの影響、計算の前提と計算例、選択中バーが無い (qa-tradeoff-ui-ux-web-001)。
- Quality attribute priorities: G1〜G4 に資する。状態を色だけで伝えない (WCAG 2.2 SC 1.4.1)。
- Constraints: `docs/design-system.md` のトークン・共通 Button・PageShell (C2)。画像の金額と取引先名はモック (C7)。

## Goals and non-goals

- Goals:
  - G1: 見出しと問い・分析期間カード・1〜3 の段・計算例・右の試算結果・下の選択中バーを画像の配置で出す。
  - G2: 右パネル・選択中バー・計算例に同じ試算結果を出す。差額が正なら『年間 X 円の支出増になります』、0 以下なら『年間 X 円を捻出できます』(qa-tradeoff-decision-009、文言は agent 推定・利用者未確認)。
  - G3: 必要度を文字と色、上書き済みに『手動』の印、推移を矢印と文字で出す。
  - G4: 推奨の組み合わせを選ぶと理由の文と関連ページへのリンクを出す。
- Non-goals:
  - 保存一覧と翌月の突合の表示 (qa-tradeoff-decision-004)
  - 共通シェルの作り直し

## System context and boundaries

- Users/external systems: 利用者と家族 (SH1 / SH2)。外部システムは無い。
- Trust/deployment/data boundaries: 画面は数字を計算しない。core の試算関数と GET の応答を描画するだけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出しと分析期間カード | 問い・説明文・`usePeriod` の期間 | React | packages/web | 静的配信 |
| 1.新しい支出を設定 | 5 入力 (既定: 毎月・翌月) | React | packages/web | 静的配信 |
| 2.見直し候補の選択 | 検索・カテゴリ絞込・全クリア・8 列の表・10 件と『すべて表示』 | React | packages/web | 静的配信 |
| 3.推奨の組み合わせ | 5 列の表・理由の文・関連ページ | React | packages/web | 静的配信 |
| 計算例 | 毎月と単発の 2 例 | React | packages/web | 静的配信 |
| 試算結果パネル | 年額 2 つ・差額と警告・防衛ラインへの影響・計算の前提 | React | packages/web | 静的配信 |
| 選択中バー | 件数・年間削減額・年間差額・クリア・この条件で試算 | React | packages/web | 静的配信 |

## Cross-cutting contracts

- Identity/access: N/A: 画面は既存の認証済みレイアウトの内側 (`architecture/tradeoff-auth.md`)。
- Errors/resilience: 読込・空・失敗を PageState で出す。防衛ラインのデータが無いときは『記帳済みの月が無いため、防衛ラインへの影響は計算できません』とし判定と色を出さない (qa-tradeoff-ui-ux-web-004、agent 推定・利用者未確認)。
- Observability/audit: N/A: 画面に計測を足さない。
- Configuration/secrets: N/A。
- Compatibility/versioning: 経路 `/tradeoff` と概要画面からの導線は変えない。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

左 3 段と計算例、右の試算結果、下の選択中バーの 3 領域。狭い画面では段を縦に積み、表を横スクロールにする (qa-tradeoff-ui-ux-web-001)。

#### Routes, screens and navigation

`/tradeoff` 1 画面。関連ページは検知器に当たった候補の `nextAction.to` へのリンクで、当たりの無い候補は欄を空にする (qa-tradeoff-ui-ux-web-004)。

#### Component and design-system boundaries

色は design-tokens のトークンだけ。ボタンは共通 Button。表は既存の DataTable の流儀、選択中バーはサブスク・診断の SelectionBar の流儀に揃える。

#### State and data flow

入力と選択は画面の状態。数字は core の試算関数の結果だけ。詳細は `architecture/tradeoff-frontend.md`。

#### Backend integration

GET の候補・防衛ライン・最新の記録を描画する。契約は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の API 契約。

#### Performance and observability

候補表は既定 10 件 (agent 推定・利用者未確認)。遅延読み込みのまま。

#### Frontend verification

DOM テストで全構成要素・読込 / 空 / 失敗・選択 0 件で選択中バーが無いこと・nodata の文・保存一覧と突合が無いことを確かめる (O1)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-tradeoff-ui-ux-web-001 | 画像の構成で 1 画面にする | 段ごとの別画面 | 問いに 1 画面で答え切れる | 表の横スクロールが要る |
| qa-tradeoff-decision-004 | 保存一覧と突合を出さない | 現行の一覧と突合を残す | 画面の焦点が試算に絞られる | 突合の DOM テストの意図を置き換える |
| qa-tradeoff-decision-009 | 差額の正を支出増の警告にする | 画像の符号 | 『新しい支出 − 削減』で読み違えない | 画像の符号は期待値にしない |
| qa-tradeoff-ui-ux-web-003 | 候補 10 件・既定 毎月 / 翌月・選択中バーは 1 件以上で出す (agent 推定・利用者未確認) | 全件表示 | 表が短く保たれる | 『すべて表示』が要る |
| qa-tradeoff-ui-ux-web-004 | nodata では判定と色を出さず文を出す (agent 推定・利用者未確認) | 余裕 0 として判定 | 無いデータで『維持』を出さない | 試算と推奨は出し続ける |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web の静的配信。
- Migration sequence: core の試算・候補・推奨 → API → 画面の部品 → 旧 Tradeoff.tsx の置き換え。
- Rollback trigger/procedure: DOM テストか直書き色の lint が落ちたら差し戻す。

## Risks and verification

- Risk/assumption: 3 か所 (右パネル・選択中バー・計算例) の数字がずれる。すべて core の同じ関数の結果を描画し、DOM テストで同じ値を確かめる。
- Architecture fitness test: web に ×12 や差額の式が無いことを grep で確かめる (O2)。
- Load/failure/security validation: 利用者の文字列は React の既定エスケープで描画する (`architecture/tradeoff-security.md`)。
