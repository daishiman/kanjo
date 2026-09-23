---
graph_node_id: "arch-cash-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "現金入力 — Cash.tsx を pages/cash/ に分け、表示条件を URL・下書きを localStorage に置き、数字は view-model 経由で core から受け取る"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "frontend"]
file_path: "architecture/cash-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "0f4a8db2cf8cf65afdf35b35472b1e08b63e067eb0b68c11e1f7722805e324ac"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "0f4a8db2cf8cf65afdf35b35472b1e08b63e067eb0b68c11e1f7722805e324ac", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-ui-ux", "arch-cash-backend", "arch-cash-database", "arch-cash-auth", "arch-cash-security", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Cash.tsx", "packages/web/src/pages/cash", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Layout.tsx", "packages/web/src/cash-duplicate.dom.test.tsx", "packages/web/src/cash-transit-regression.test.ts", "packages/core/src/cash-screen.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/cash-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G1", "G2", "G3"]
---

# Architecture overview

現金入力 — `packages/web/src/pages/Cash.tsx` (724 行) を `packages/web/src/pages/cash/` の 画面本体・`view-model.ts`・`draft.ts`・通常入力・交通費入力・一覧・`ResultNotices` に分ける。表示条件 (タブ・月・絞り込み・ページ) は URL の検索パラメータ、入力途中の内容は `localStorage` の下書きに置き、合計・絞り込み・ページ・入力経路・交通費合計は `view-model.ts` だけが core の `cash-screen` を呼んで受け取る。`system-spec/frontend.md` は承認時入力、本書はモジュール分割・状態の置き場所・API との結線の制約を持つ。

## Context and drivers

- Business/technical context: 現行 `Cash.tsx` は入力・交通費・一覧・合計を 1 ファイルに持ち、`queryKey: ['cash-entries']` (`Cash.tsx:466`) を読み、書込後に `qc.invalidateQueries()` (`Cash.tsx:479`) で全 query を無効化する。画面は遅延読込 (`AuthenticatedApp.tsx:37`)、ルートは `routeMetadata.ts:33-44` (id `cash` / path `/cash`)。分割の前例は `pages/classify/` の `view-model.ts`・`draft.ts`・`ResultNotices.tsx` (qa-cash-frontend-web-evidence-001)。
- Quality attribute priorities: G1・G2・G3 に資する。Clean Architecture (依存は web → core の一方向、判定は core) と Information Design を適用する (いずれも agent 推定・利用者未確認、design_applications)。
- Constraints: React 18 + react-router-dom 7 + TanStack Query 5。既存のトークン・共通部品。web のみ。

## Goals and non-goals

- Goals:
  - G1: 画面を部品単位に分け、`17-cash.png` の段ごとに 1 部品を対応させる (`architecture/cash-ui-ux.md`)。
  - G2: 入力途中の内容を `draft.ts` が自動保存し保存時刻を示し、再読込後に復元する。追加成功と『入力をクリア』で消す (qa-cash-frontend-web-001)。
  - G3: 画面の数字と判定を core の `cash-screen` から受け取り、web で計算しない。
- Non-goals:
  - 下書きのサーバー保存 (qa-cash-security-web-002)
  - 画面の即時読込化 (遅延読込のまま)
  - 他画面の期間・部品の作り替え

## System context and boundaries

- Users/external systems: 利用者のブラウザ。
- Trust/deployment/data boundaries: web は `/api/cash-entries` 系の JSON を受けて描くだけ。下書きは端末の `localStorage` に留まりサーバーへ送らない (`architecture/cash-security.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `pages/cash/CashPage.tsx` (画面本体) | 段の配置、URL の検索パラメータの読み書き | React + `useSearchParams` | packages/web | Workers Assets |
| `pages/cash/view-model.ts` | core の `cash-screen` を呼び、合計・絞り込み・ページ・入力経路・交通費合計を画面用に写す | 純関数 | packages/web (計算は packages/core) | 同上 |
| `pages/cash/draft.ts` | 下書きの保存・復元・消去と保存時刻 | `localStorage` | packages/web | 同上 |
| 通常入力 / 交通費入力 | 入力欄と送信 | React | packages/web | 同上 |
| 一覧 | 月送り・検索・絞り込み・選択・編集 / 削除・ページング | `DataTable` | packages/web | 同上 |
| `pages/cash/ResultNotices.tsx` | 追加・削除・復元の結果と『元に戻す』 | React | packages/web | 同上 |

## Cross-cutting contracts

- Identity/access: 既存セッションの Cookie で API を呼ぶ。下書きのキーに利用者 id を含め、ログアウト時に消す (qa-cash-security-web-003、agent 推定・利用者未確認)。ログアウトの入口は `components/Layout.tsx:145`。
- Errors/resilience: API の 400 は欄の近くに文で示し入力を保つ。404 (他人・完全消去済み) はトーストで示し一覧を読み直す。`localStorage` の読み書きは try で囲み、使えない環境でも入力はできる。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 秘密情報を持たない。下書きに保存するのは入力途中の項目値だけ。
- Compatibility/versioning: 現行 URL `/cash` を保つ。検索パラメータが無ければ既定 (通常入力・対象期間の最新月・1 ページ目) で開く。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/cash-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外 (`architecture/cash-security.md`)

### Frontend architecture

#### Rendering and application pattern

`view-model.ts` だけが core を呼ぶ。部品は view-model が返す値を描き、合計や絞り込みを自分で計算しない。これで G3 (数字は core の 1 か所) を web 側の依存の向きで守る。

#### Routes, screens and navigation

経路は `/cash` のまま遅延読込を保つ。タブ・月・絞り込み (キーワード・収支・カテゴリ・担当者・取込元・詳細検索の範囲)・ページは `useSearchParams` で URL に持つ (react-router 8.4.0 の useSearchParams)。絞り込みを変えたらページを 1 に戻す。

#### Component and design-system boundaries

色はトークン、ボタンは共通 `Button`、表は `DataTable`。分割後の各部品は 1 段に 1 つ対応させる。

#### State and data flow

サーバー状態は TanStack Query 5 (5.103.2) で持つ。追加・更新・削除・復元・一括の後は現金明細と集計の query を無効化する (qa-cash-frontend-web-001)。現行の全 query 無効化 (`Cash.tsx:479`) から対象を絞る。下書きは `draft.ts` が入力のたびに `localStorage` に保存し、保存時刻を示す。追加成功と『入力をクリア』で消す。

#### Backend integration

`GET /api/cash-entries` の一覧、`POST` / `PUT` (owner・transit_purpose を含む)、`DELETE` (論理削除)、`POST /:id/restore`、`POST /bulk-delete`、`POST /bulk-restore` を使う (`architecture/cash-backend.md`)。一括の id は API の上限 100 件 (qa-cash-backend-web-003、agent 推定・利用者未確認) を越えて送らない。

#### Performance and observability

初期 JS 予算を守るため画面は遅延読込のまま。core の `cash-screen` は画面の chunk に入る。

#### Frontend verification

view-model の単体テストで core の結果の写しを、DOM テストで 下書きの復元・保存時刻・クリア・ログアウト時の消去、URL の往復、書込後の query 無効化を確かめる。既存の `cash-duplicate.dom.test.tsx`・`cash-transit-regression.test.ts` を緑のまま移す。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-cash-frontend-web-001 | `pages/cash/` に分け、view-model だけが core を呼ぶ | `Cash.tsx` 1 ファイルのまま改修 | classify の前例と揃い、判定の置き場所が 1 つになる | import 経路が変わり、既存テストの移設が要る |
| qa-cash-frontend-web-001 | 表示条件を URL の検索パラメータに持つ | コンポーネント内 state | 再読込・共有で同じ表示に戻る | パラメータ名の互換を保つ必要がある |
| qa-cash-frontend-web-001 | 下書きを `localStorage` に自動保存する | サーバー保存 | 送信せずに入力を失わない | 端末をまたいで引き継がない |
| qa-cash-security-web-003 | 下書きのキーに利用者 id を含めログアウト時に消す (agent 推定・利用者未確認) | 共通キー | 共有端末で他人の下書きが見えない | ログアウト処理に消去を足す |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと Workers Assets。
- Migration sequence: core `cash-screen` → `view-model.ts` → 部品分割 (見た目は据え置き) → URL の検索パラメータ → `draft.ts` → 削除と復元の結線。
- Rollback trigger/procedure: DOM テスト・初期 JS 予算・`check:cash-screen` のどれかが赤なら差し戻す。下書きは端末内なので差し戻しで失われない。

## Risks and verification

- Risk/assumption: 部品が view-model を経由せず core や自前計算を使うと数字が割れる。部品から core を import しないことを lint か grep の検査で確かめる。
- Risk/assumption: `localStorage` が使えない環境 (プライベートブラウズ等) では下書きが残らない。入力自体は妨げない。
- Architecture fitness test: `pages/cash/` 配下で core を import するのが `view-model.ts` だけであること。
- Load/failure/security validation: 初期 JS 予算を CI 実測で確かめ、現金入力画面が遅延読込のままであること。
