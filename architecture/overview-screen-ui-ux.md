---
graph_node_id: "arch-overview-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "概況画面改善 — 情報優先度と段階的開示"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "ui-ux"]
file_path: "architecture/overview-screen-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "64ea7905f3a80b52c4da93f2edf546595e67bc11a1c48e7d8f32ab9d0dc4042e"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/ui-ux.md", "source_version": "0.1.14", "source_digest": "c16e7904243093915bdbb78348fa5bdd042eaa945a52243250e54f29b454e1de", "imported_at": "2026-09-15T00:18:48Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-15T00:18:48Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-frontend", "arch-overview-backend", "arch-overview-database", "arch-overview-auth", "arch-overview-security", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/02-overview.png", "packages/web/src/pages/Overview.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/NavItem.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/styles.css"]
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
classification_reason: "system-spec の ui-ux 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。章の関心に合わせて subtype を frontend とし、architecture-frontend.md の節を Subtype architecture 節へ合成した。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/overview-screen-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G1", "G2", "G4", "G5"]
---

# Architecture overview

概況画面改善 — 情報優先度と段階的開示。正本は `system-spec/ui-ux.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-overview-screen.md`。

## Context and drivers

- Business/technical context: 見た目の正本は `design/FINAL-UI/images/02-overview.png`、表示順の正本は `system-spec/ui-ux.md#表示順の正本` である。利用場面は月初の月次クローズで、1280px 以上の画面を主とする。失敗コストが高いのは締めの誤認 (未処理が残っているのに終わったと思う) と、総額の定義のずれ (KPI と図で合計が合わない) である。
- Quality attribute priorities: G1, G2, G4, G5 に資する。結論先行 (U1) を最優先にし、次に件数の一致と迷わない遷移、既存要素の保持、アクセシビリティの順に置く。
- Constraints: C4: 色・寸法は design-tokens と check-design-tokens に従う。C6: CI の headless Chrome は pointer:none なので、ホバー前提の表示に頼らない。WCAG 2.2 AA (4.1.3 Status Messages、1.4.10 Reflow 320px) を守る。

## Goals and non-goals

- Goals:
  - G1: 総合/事業/家計の KPI と前 12 か月比を Hero 直下に置き、範囲切替を APG radio group で提供する。
  - G2: 推移の下に未処理カード・優先明細表・右パネル・固定アクションバーを置き、件数を 3 か所で一致させる。
  - G4: 02 の構成を共通シェルで再現し、既存 5 要素を段階的開示で残す。
  - G5: 読込・空・エラー状態と WCAG 2.2 AA、狭幅での右パネルのドロワー化を持つ。
- Non-goals:
  - 概況以外の 19 画面の作り替え
  - 専用アプリ (スマートフォン・タブレット・デスクトップ)
  - ダークテーマや新しいトークンの追加

## System context and boundaries

- Users/external systems: SH1 利用者 1 名が操作し、SH2 保守エージェントが実装する。外部システムは無い。
- Trust/deployment/data boundaries: 画面は認証後の共通シェル内に描画され、表示値は API 応答だけから得る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Hero / KPI strip | 結論と締めの進捗を最初に見せる | OverviewResponse の kpi / closeStatus | packages/web | web ビルド |
| Trend | KPI の月別根拠を直後に示す。移動平均は表示切替 | OverviewResponse の trend | packages/web | web ビルド |
| Review 3列 | 未処理の内訳・優先明細・選択中明細を同じ作業面に置く | ReviewQueueResponse | packages/web | web ビルド |
| 前年比較 / 支出内訳 2列 | 結論の比較根拠と原因を並べる。パレートは構成比表示 | OverviewResponse の yearComparison / breakdown | packages/web | web ビルド |
| details / action | 未決済と科目別年比較を初期は閉じ、最後に次の操作を置く | details 要素 / ReviewQueueResponse | packages/web | web ビルド |
| 防衛予測の警告 | caution/warn のときだけ KPI の上に role=alert で出す | defenseForecast.level | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: 認証後の共通シェル内だけで描画する。ロック中はバッジを取得しない。
- Errors/resilience: 領域ごとに読込・空・エラーを持ち、1 領域の失敗で画面全体を止めない。
- Observability/audit: 件数の変化は role=status で読み上げる。実行時の計測は追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 期間選択 (1年/2年/3年/任意) と共通シェルの挙動を変えない。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

既存の React SPA の概況ルート `/` を作り替える。物理順は `system-spec/ui-ux.md#表示順の正本` に従い、未決済と科目別年比較だけを details 要素で畳む。

#### Routes, screens and navigation

ルート `/` を維持する。右パネルの遷移ボタンから仕分け・照合・取込の各画面へ 1 操作で移る。サイドバーの概況項目に未処理件数バッジを付ける。

#### Component and design-system boundaries

KPI カード・バッジ・右パネル・固定アクションバーは共通シェルとトークンで描く。範囲切替は APG radio group (矢印キーで選択)、狭幅の右パネルは APG モーダルダイアログ、「詳しく見る」は APG disclosure に従う。

#### State and data flow

範囲 (総合/事業/家計) と期間は画面状態として持ち、範囲は 4 要素だけに効かせる。未処理件数は期間にも範囲にも依存しない。

#### Backend integration

GET /api/overview と GET /api/review-queue の応答をそのまま描画し、画面側で集計しない。

#### Performance and observability

details を初期は閉じ、初期描画を主要セクションに絞る。初期 JS 予算を超えない。

#### Frontend verification

check-financial-visuals.mjs で表示順、広幅の Review 3列・比較/内訳2列、横はみ出しなしを観測し、Overview を 8 幅 (320/360/375/390/768/1280/1600/zoom200) で描画して exit 0 (O4)。DOM テストで 3 か所の件数一致と role=status (O2)。

## Architecture decisions

決定本文・代替案・帰結の正本は `system-spec/00-requirements-definition.md` の決定表。本章は dec-overview-aggregation-scope (総合を既定に事業/家計へ切替、未処理キューには効かない) と dec-overview-legacy-elements (畳んで残す) を参照し、領域固有の制約だけを上節に記録する。

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと deploy.yml の経路で配信する。
- Migration sequence: API と core の集計が揃ってから Overview.tsx を差し替え、既存 5 要素を所定の層へ移す。
- Rollback trigger/procedure: 描画検査か DOM テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 「詳しく見る」に閉じた中身は見落とされやすい。details 要素の開閉状態で伝え、防衛予測は警告時に畳まず上に出す。
- Architecture fitness test: 320px で 2 方向スクロールが出ないこと (1.4.10) と、件数の変化が role=status で通知されること (4.1.3) を描画検査と DOM テストで確かめる。
- Load/failure/security validation: 読込・空・エラーの 3 状態を DOM テストで描画し、表示値の fixture は匿名・架空とする。
