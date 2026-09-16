---
graph_node_id: "arch-analysis-hub-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "支出分析ハブ — URL の focus 保持とクエリ共有"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub", "frontend"]
file_path: "architecture/analysis-hub-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-15-analysis-hub/completeness-findings.json", "evaluated_digest": "b9b122b5848ffd56ad081b04ac30e02cb44176b490a61cdb8d583ee226c670ef"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-15-analysis-hub/frontend.md", "source_version": "0.1.14", "source_digest": "b9b122b5848ffd56ad081b04ac30e02cb44176b490a61cdb8d583ee226c670ef", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/pages/Analysis.tsx", "packages/web/src/pages/analysis", "packages/web/src/period.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/analysis-tabs.dom.test.tsx", "packages/web/src/navigation-ux.dom.test.tsx", "packages/web/src/common-shell-routes.dom.test.tsx", "docs/ui-decisions.md"]
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
classification_reason: "system-spec の frontend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/analysis-hub-frontend.md"}]
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

支出分析ハブ — URL の focus 保持とクエリ共有。正本は `system-spec/frontend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-analysis-hub.md`。

## Context and drivers

- Business/technical context: packages/web は React 18 + react-router-dom 7 + TanStack Query 5 の SPA。AuthenticatedApp が /analysis と /analysis/:tab を AnalysisPage に割り当て、Analysis.tsx は /analysis で照合タブへ Navigate している。routeMetadata に APP_ROUTES・ANALYSIS_TABS・DEFAULT_ANALYSIS_TAB・LEGACY_ROUTE_REDIRECTS (/reconciliation・/matrix・/trends・/diagnosis)・SEARCH_ROUTES がある。pages/analysis/*.tsx の各 API は遅延読み込み。usePeriod() が selection・key・withPeriod を持ち、期間は localStorage で全画面共有する。Page.tsx (PageShell・PageHeader・TaskCopy・PageState・KpiCard・PageActions)・Button.tsx・DataTable・charts が共通部品で、--aside-panel-w 320px は未使用。クリップボード書込の既存実装がある。
- Quality attribute priorities: G1・G2・G5 に資する。HIG の『選択状態は URL で再現でき、履歴を汚さない』を適用し、?focus= を setSearchParams の replace: true で書く。サーバ状態は TanStack Query に一本化し、サイドバーとハブで同じ queryKey を共有する。
- Constraints: C2: 色・余白・部品はトークンと共通 Button/PageShell 経由、WCAG AA。 C3: 表示していないタブの API は呼ばない。role=tab を手組みしない。現在地は 1 件。ハブ API は例外として docs/ui-decisions.md に明記する。

## Goals and non-goals

- Goals:
  - G1: /analysis を 03-analysis-hub.png どおりのハブにし、照合タブへの転送を廃止する。
  - G2: 選択中の分析を ?focus= で保持し、URL コピーで同じ分析を再現できる。/analysis/:tab と旧 URL 転送は維持する。
  - G5: 5 タブ名を短縮形 (照合/総収支/マトリクス/推移/診断) にし、サイドバー子行に件数バッジを付ける。
- Non-goals:
  - 5 タブ詳細画面の中身の作り直し
  - 支出分析以外のサイドバー文言と月次クローズ進捗の形
  - 期間の保存先の変更 (localStorage を維持し URL に載せない)
  - ネイティブアプリ

## System context and boundaries

- Users/external systems: 利用者 1 名。呼出し先は GET /api/analysis/hub と、詳細タブを開いたときの既存 5 API。
- Trust/deployment/data boundaries: 静的アセットとして Worker から配信する。URL に載せるのは focus (タブ id) だけで、期間・金額は載せない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| AnalysisHub | /analysis のハブ画面 (サマリー・ルート一覧・選択中パネル・読み順・下部バー) | React コンポーネント | packages/web | web ビルド |
| routeMetadata | ANALYSIS_TABS の短縮 label と、各視点の わかること・データソース・対象外 の静的定義 | TypeScript 定数 | packages/web | web ビルド |
| Layout サイドバー子行 | 要確認 1 件以上の視点に件数バッジを出す | React コンポーネント | packages/web | web ビルド |
| useQuery ['analysis-hub', 期間 key] | ハブとサイドバーで共有するサーバ状態 | TanStack Query | packages/web | web ビルド |
| 既存 5 タブ詳細 | /analysis/:tab の詳細 (変更しない) | React コンポーネント | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: AuthenticatedApp 配下だけにハブとバッジ用クエリを置く。
- Errors/resilience: 不正な focus は既定値に落とす。クリップボード拒否は画面で知らせる。前期間比が null のときは『比較データなし』を出す。
- Observability/audit: N/A: 実行時の信号を追加しない。検証は DOM テストと check 系に置く。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: /analysis/:tab と LEGACY_ROUTE_REDIRECTS を維持する。期間の localStorage キーを変えない。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

既存の SPA (CSR)。/analysis はハブ、/analysis/:tab は既存の遅延読み込みの詳細タブとして描き分ける。

#### Routes, screens and navigation

Analysis.tsx の /analysis → 照合タブの Navigate を廃止し、ハブを描画する。行選択は setSearchParams({ focus }, { replace: true })。『開く』とタブは /analysis/:tab へ進む。focus は ANALYSIS_TABS の id の許可リストで検証する。

#### Component and design-system boundaries

PageShell・PageHeader・Button・KpiCard などの共通部品とトークンを使い、右パネルは --aside-panel-w 320px を使う。タブは既存のタブ実装を使い role=tab を手組みしない。

#### State and data flow

期間は usePeriod() (localStorage)、選択中の分析は URL の ?focus=、サーバ状態は queryKey ['analysis-hub', 期間 key]。focus は queryKey に含めない。総収支の判定・freee 除外・取込の成功後に invalidateQueries({ queryKey: ['analysis-hub'] }) を呼び、staleTime を設けて画面遷移ごとの再取得を抑える。

#### Backend integration

ハブ表示中は GET /api/analysis/hub の 1 本だけを withPeriod 付きで呼び、既存 5 API を呼ばない。サイドバーのバッジも同じクエリを読む。

#### Performance and observability

初期 JS 予算 (check:js-budget) を超えない。詳細タブの遅延読み込みを維持する。

#### Frontend verification

DOM テストでハブ要素の描画 (O1)、?focus= の再現・replace・不正値の既定化・URL コピー (O2)、ハブ表示中の既存 5 API 呼出し 0 件 (S3)、タブ文言とバッジ (O5) を確かめる。analysis-tabs / navigation-ux / common-shell-routes の DOM テストを新文言で更新する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-analysis-hub-decision-001 | /analysis をハブにし、?focus= で選択を URL に持つ | 転送を残し全タブ上部にハブ要素を常時表示 | 入口を 1 画面にまとめ、詳細タブの中身を変えずに済む | 転送の廃止と既存テストの維持を両立させる |
| qa-analysis-hub-decision-004 | 分析まわり (5 タブ名とサイドバー子行) だけ短縮形に揃える | サイドバー全体と月次クローズも合わせる / 文言を変えない | 範囲を分析に限ると他画面のテストを動かさずに済む | 3 つの DOM テストの文言を更新する |
| qa-frontend-web-ah-decision-003 | Layout とハブで queryKey を共有し、C3 の例外を docs に明記、更新成功で invalidate、staleTime を設ける | バッジは支出分析内だけ | どの画面でもバッジを出しつつ呼出しを 1 本に保つ | staleTime の値は実装時に決める |

## Delivery, migration and rollback

- Build/deploy topology: typecheck、vite build、check:js-budget の既存順序で配信する。
- Migration sequence: api のハブ route が先に入った後、routeMetadata の label と静的定義 → ハブ画面と focus → サイドバーのバッジと invalidate → DOM テスト更新と docs/ui-decisions.md の例外追記の順に進める。
- Rollback trigger/procedure: DOM テストか check 系が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。スキーマ変更が無いので migration の巻き戻しは不要。

## Risks and verification

- Risk/assumption: staleTime の値と算定基準が章に無い (completeness-findings low)。invalidate の範囲と staleTime の方針は decision-003 に束ねられており、reopen 時に分割する。
- Architecture fitness test: ハブ表示中のネットワーク呼出しがハブ API 1 本で既存 5 API が 0 件であることを DOM テストで固定する。
- Load/failure/security validation: check:mobile-layout / check:financial-routes の対象に /analysis を含め、狭幅で横スクロールしないことを確かめる (S6)。
