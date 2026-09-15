---
graph_node_id: "arch-analysis-hub-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "支出分析ハブ — 情報の優先順位とハブ画面構成"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub", "ui-ux"]
file_path: "architecture/analysis-hub-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "acc099afc910ebed34dafffde2fd75d5faf4747799d43e54c6368dda4a1edb45"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "acc099afc910ebed34dafffde2fd75d5faf4747799d43e54c6368dda4a1edb45", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/03-analysis-hub.png", "design/FINAL-UI/spec/AUDIT.md", "design/FINAL-UI/spec/FUNCTION-MATRIX.md", "design/FINAL-UI/spec/DESIGN-SYSTEM.md", "packages/web/src/pages/Analysis.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Layout.tsx", "packages/web/src/period.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/analysis-hub-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:23:44Z"}
serves_goals: ["G1", "G2", "G5"]
---

# Architecture overview

支出分析ハブ — 情報の優先順位とハブ画面構成。正本は `system-spec/ui-ux.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-analysis-hub.md`。

## Context and drivers

- Business/technical context: design/FINAL-UI/images/03-analysis-hub.png は上から、ヘッダー、期間、見出し『支出のどこから確認しますか？』、URL コピー、5 タブ (下線)、収支サマリーと『純収支とは？』パネル、分析ルート一覧 (# / 視点 / 目的 / 現在の状態 / 要確認の優先度 / 次の操作)、右の選択中の分析パネル (わかること / データソース: 銀行口座・クレジットカード・電子マネー決済・現金入力 / 対象外: 振替取引・内部移動 / 開く)、読み順 5 ステップ、下部固定バー、サイドバー子行 (照合の件数 5) で構成される。FINAL-UI の spec は AUDIT.md が現行を『要改善』とし、PROMPTS.md は主役を『分析ルート表』、DESIGN-SYSTEM.md は右パネル 320px と『短い問い → 結論 → 主操作』を定める。期間は既存 PeriodPicker が localStorage (kanjo:period) に持つ。
- Quality attribute priorities: G1・G2・G5 に資する。HIG の現在地表示 (aria-current と下線) と、WCAG 2.2 の『色だけに頼らない』(増減は符号と色、優先度は文字のバッジ) を適用する。情報の強弱で主役を示し、画像の縦の並びは崩さない。
- Constraints: C2: tokens・Button・PageShell・--aside-panel-w 320px を使い、WCAG AA (文字 4.5:1、部品 3:1)。 C3: 現在地は 1 件、role=tab を手組みしない。

## Goals and non-goals

- Goals:
  - G1: 画像の構成要素をすべて描画し、情報の優先順位を ①ルート一覧の状態と優先度 ②収支サマリー ③選択中の分析パネル ④読み順 とする。
  - G2: 選択中の分析を一覧・右パネル・下部バーで一致させ、URL で再現できる。
  - G5: 5 タブ名を短縮形にし、サイドバー子行に要確認件数のバッジを出す。
- Non-goals:
  - 5 タブ詳細画面の見た目の作り直し
  - 支出分析以外のサイドバー文言と月次クローズ進捗の形
  - 期間選択の UI と保存先の変更

## System context and boundaries

- Users/external systems: 利用者 1 名。月次クローズで支出分析を開き、どこから確認するかを決める。
- Trust/deployment/data boundaries: 画面は AuthenticatedApp の共通シェル内。表示する値はハブ API の応答と routeMetadata の静的定義だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 問いの見出しと URL コピー | 画面の問いと共有手段を示す | PageHeader / Button | packages/web | web ビルド |
| 収支サマリー | 期間の総収入・総支出・純収支と前期間比 (②) | KpiCard | packages/web | web ビルド |
| 分析ルート一覧 | 5 視点の目的・現在の状態・優先度・次の操作 (①主役) | 表 | packages/web | web ビルド |
| 選択中の分析パネル | わかること・データソース・対象外・開く (③、320px) | 右パネル | packages/web | web ビルド |
| 分析の読み順と下部バー | 5 ステップの読み順 (④) と選択中分析の主操作 | リスト / 固定バー | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: N/A: 画面の表示範囲は認証済みシェルに従う。
- Errors/resilience: 前期間の月が欠けたら『比較データなし』と表示し 0% と誤読させない。クリップボードの失敗は画面で知らせる。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: /analysis/:tab と旧 URL 転送を維持し、詳細タブの見た目を変えない。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

既存 SPA の共通シェル内に、PageShell で縦 1 列のハブを描く。広い幅では一覧の右に選択中の分析パネルを置く。

#### Routes, screens and navigation

/analysis がハブ、/analysis/:tab が詳細。タブは下線と aria-current で現在地を 1 件だけ示す。行の選択は ?focus= を置き換え、『○○を開く』で詳細へ進む。

#### Component and design-system boundaries

トークン・Button・PageShell・KpiCard を使い、右パネル幅は --aside-panel-w 320px。直書き色を使わない。増減は符号と色、優先度は文字のバッジで示す。

#### State and data flow

選択中の分析は URL の focus を唯一の状態とし、一覧の選択行・右パネル・下部バーが同じ値を読む。各視点の わかること・データソース・対象外 は routeMetadata の静的定義を読む。

#### Backend integration

収支サマリー・一覧の状態と優先度・サイドバーのバッジは GET /api/analysis/hub の 1 応答から描く。

#### Performance and observability

狭幅 (68px アイコンレール・下部タブ) では ③ を一覧の下へ落とし、④ を縦積みにして横スクロールを出さない。

#### Frontend verification

DOM テストで画像の構成要素の描画・右パネルの 3 項目・現在地 1 件・短縮タブ名とバッジを確かめ、check:mobile-layout で狭幅の横スクロールが無いことを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ui-ux-web-ah-decision-005 | 優先順位を ①ルート一覧 ②収支サマリー ③選択中パネル ④読み順 とし、画像の縦の並びは保つ | サマリーを主役 / 差を付けない | 『どこから見るか』を決める画面なので一覧を主役にし、並びは画像に合わせる | 主役は視覚的な強さで示し、狭幅では ③④ を下げる |
| qa-analysis-hub-decision-001 | /analysis をハブにし ?focus= で選択を持つ | 転送を残し全タブ上部にハブ要素 | 入口を 1 画面にまとめられる | 一覧・パネル・下部バーの選択を一致させる |
| qa-analysis-hub-decision-004 | 5 タブ名とサイドバー子行だけ短縮形に揃える | 全体を合わせる / 変えない | 分析まわりの文言を画像に合わせ、他画面を動かさない | 件数バッジは要確認 1 件以上の視点だけ |

## Delivery, migration and rollback

- Build/deploy topology: typecheck、vite build、check 系の既存順序で配信する。
- Migration sequence: api のハブ route の後、routeMetadata の短縮 label と静的定義 → ハブの画面構成 → 狭幅の並び替え → サイドバーのバッジ → DOM テストの順に進める。
- Rollback trigger/procedure: DOM テストか check:mobile-layout / check:financial-routes が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration の巻き戻しは不要。

## Risks and verification

- Risk/assumption: ui-ux.web の qa_refs に置換済みの qa-ui-ux-web-ah-inference-002 が残る (completeness-findings medium)。その本文の細部 (純収支説明パネルの狭幅折りたたみ、金額の等幅数字など) は利用者確定ではないため、採る場合は docs/design-system の観測事実へ接地させるか利用者確認に回す。
- Architecture fitness test: 画像の構成要素がすべて描画され、現在地が 1 件で、優先度が文字のバッジで示されることを DOM テストで固定する。
- Load/failure/security validation: 直書き色の lint 0 件、既存 check 系が緑、狭幅で横スクロールしないこと (S1, S6)。
