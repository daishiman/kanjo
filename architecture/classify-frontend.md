---
graph_node_id: "arch-classify-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "明細仕分け — pages/classify への分割と URL・サーバ状態・端末下書きの分離"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "frontend"]
file_path: "architecture/classify-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "331f13c5d50b4b0807e4b39c944536f191fe4680ef2fc901e924c804a0c8ec4c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "331f13c5d50b4b0807e4b39c944536f191fe4680ef2fc901e924c804a0c8ec4c", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-ui-ux", "arch-classify-backend", "arch-classify-database", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-auth"]
resource_scope: ["packages/web/src/pages/classify/", "packages/web/src/pages/Classify.tsx", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/period.tsx", "packages/web/src/api.ts", "packages/web/src/components/Page.tsx", "packages/web/src/components/SplitEditor.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/classification-invalidate.ts", "packages/web/src/components/Layout.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/classify-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G1", "G3", "G5"]
---

# Architecture overview

明細仕分け — pages/classify への分割と URL・サーバ状態・端末下書きの分離。`system-spec/frontend.md` は承認時入力、本書は画面の部品境界・状態の置き場所・API との結び方の制約を持つ。画面の見た目と操作の正本は `architecture/classify-ui-ux.md` と `specs/spec-classify-screen.md`。

## Context and drivers

- Business/technical context: 現行の仕分け画面は `packages/web/src/pages/Classify.tsx` の 1 ファイルで、`AuthenticatedApp.tsx` (24 行) で lazy に読み込まれ、`routeMetadata.ts` (46 行) に classify の経路がある。期間は `period.tsx` の `usePeriod` (121 行) と `PeriodPicker` (130 行) で共有され、localStorage に残る。共通部品は `components/Page.tsx` の `PageShell` / `PageHeader` / `PageState` / `KpiCard`、`SplitEditor.tsx`、`ConfirmDialog.tsx`、分類の変更後の無効化は `components/classification-invalidate.ts`。ナビのバッジは `Layout.tsx` (245 行) が `/review-queue` の `counts.classification` を読む。画面専用の一括操作バーは `pages/subscriptions/SelectionBar.tsx` と `pages/analysis/diagnosis/SelectionBar.tsx` に前例がある (qa-classify-frontend-web-evidence-001)。
- Quality attribute priorities: G1・G3・G5 に資する。判定と集計は core / API に置き、画面は表示と入力に限る (view-model の分離)。
- Constraints: React + TanStack Query + React Router の既存構成。デザイントークンは `scripts/check-design-tokens.mjs` の検査に従う。

## Goals and non-goals

- Goals:
  - G1: 仕分け画面を `packages/web/src/pages/classify/` 配下に分け、問い・KPI・絞り込み・一覧・編集パネル・一括操作バー・通知を画面専用部品として持つ。表示用の整形は `view-model.ts` に集める (qa-classify-frontend-web-001)。
  - G3: 一括保存の結果を明細ごとに受け、失敗した明細だけを選択に残して再送できるようにする。
  - G5: 絞り込み条件と選択を URL の検索パラメータに、サーバの値を TanStack Query に、入力途中の値を localStorage の下書きに置き、3 つを混ぜない。
- Non-goals:
  - 分類ステータス・信頼度・件数の画面での計算
  - 証憑の添付・プレビュー
  - 一括操作バーの共通部品化 (画面専用に留める)

## System context and boundaries

- Users/external systems: ログイン済みの利用者のブラウザ。API は同一オリジンの `/api/*`。
- Trust/deployment/data boundaries: 下書きは端末の localStorage に閉じ、サーバへ送らない。URL に載せるのは条件と明細 id だけで、金額やメモを載せない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `pages/classify/` の画面の入口 | 経路・期間・URL の条件を読み、部品を組む | React コンポーネント (lazy) | packages/web | 静的配信 |
| `view-model.ts` | API の応答を表示用の行・KPI・根拠の文へ整形する | 純関数 | packages/web | 静的配信 |
| 絞り込み | 分類ステータス・カテゴリ・所有者・支払方法・手動変更のみ・キーワード・保存フィルタ | React | packages/web | 静的配信 |
| 一覧と編集パネル | 50 件ずつの一覧、行を押して開く編集、分割 (`SplitEditor`)、履歴の表示 | React | packages/web | 静的配信 |
| 一括操作バー (画面専用) | 選択件数・一括の区分とカテゴリの変更・ルール化 | React (`pages/classify` 配下) | packages/web | 静的配信 |
| ルール作成とプレビュー | 条件・適用範囲・分割の型の入力とプレビューの表示 | React | packages/web | 静的配信 |
| 下書き | 明細単位の入力途中の値の保存と復元 | localStorage | 利用者の端末 | ブラウザ |

## Cross-cutting contracts

- Identity/access: 既存のセッションに乗る。未認証の応答は既存のログイン導線へ戻す。
- Errors/resilience: 一括保存は `{ results }` を読み、失敗分を行に表示して選択に残す。409 `canonical_write_busy` と 503 は既存の `PageState` の表示に従う。
- Observability/audit: N/A: 画面の計測を追加しない。変更の記録は取引の履歴が担う。
- Configuration/secrets: N/A: 画面に設定・秘密情報を持たない。
- Compatibility/versioning: 既存の `/classify` の URL を保ち、新しい検索パラメータは加法的に足す。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/classify-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/classify-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/classify-database.md`)
- Security: N/A: 本章の関心外 (`architecture/classify-security.md`)

### Frontend architecture

#### Rendering and application pattern

- Rendering: 既存の SPA (クライアント描画)。仕分け画面は lazy route に置く (agent 推定・利用者未確認、根拠 qa-classify-frontend-web-002)。
- Pattern: 画面の入口がデータ取得と URL を持ち、部品は props で受ける。整形は `view-model.ts` の純関数に置き、DOM テストと単体テストの両方で確かめる。

#### Routes, screens and navigation

- Routes: `/classify` を保つ。条件 (期間以外の絞り込み・並び・ページ) と選択は検索パラメータで持ち、URL を共有・再読込しても同じ一覧に戻る。選択は最大 50 件まで URL に載せる (agent 推定・利用者未確認、根拠 qa-classify-frontend-web-002)。
- Navigation: 期間は `usePeriod` を使い、他の画面と共有する。未保存の入力があるときの離脱確認は `useBlocker` と `beforeunload` の両方で行う (agent 推定・利用者未確認、根拠 qa-classify-frontend-web-002)。ナビのバッジは core の分類ステータス判定から出た未整理の件数を読む。

#### Component and design-system boundaries

- 画面専用部品は `pages/classify/` に置き、他の画面から import しない。一括操作バーも画面専用とし、既存の 2 つの `SelectionBar` と共通化しない。
- 共通部品は `PageShell` / `PageHeader` / `PageState` / `KpiCard` / `SplitEditor` / `ConfirmDialog` / `Button` / `Term` を使い、色・余白はデザイントークンに従う。
- 分類ステータスの表示は色だけに頼らず文字を添える (`architecture/classify-ui-ux.md`)。

#### State and data flow

- URL (検索パラメータ): 絞り込み・並び・ページ・選択。
- サーバ状態 (TanStack Query): 一覧・KPI・提案・保存フィルタ・履歴・ルール。変更の後は `classification-invalidate.ts` の無効化を使い、一覧・KPI・ナビのバッジ (`/review-queue`)・月次クローズを同時に読み直す。
- 端末の下書き (localStorage): キーは `kanjo:classify:draft:<txId>`、入力から 1 秒後に保存、30 日を過ぎた下書きは読込時に捨てる (agent 推定・利用者未確認、根拠 qa-classify-frontend-web-002)。保存に成功した明細の下書きは消す (qa-classify-decision-004)。localStorage が使えない環境でも画面は動く。
- 画面は件数・区分・信頼度を計算しない。表示する値はすべて API の応答から取る。

#### Backend integration

- `GET /api/transactions` (拡張) で一覧・区分・提案・信頼度・根拠・KPI を読む。
- 一括保存・ルールのプレビューと適用・保存フィルタ・履歴の経路は `architecture/classify-backend.md` に従う (経路名は agent 推定・利用者未確認、根拠 qa-classify-backend-web-002)。
- 呼出しは `packages/web/src/api.ts` の既存の関数群に足し、画面から `fetch` を直接呼ばない。

#### Performance and observability

- 一覧は 50 件ずつ読み、ルールのプレビューは最大 50 行を表示する (agent 推定・利用者未確認、根拠 qa-classify-ui-ux-web-002)。
- 画面は lazy route で分割し、初回の JS の増加を仕分けの経路に閉じる。
- 観測信号は追加しない。

#### Frontend verification

`packages/web/src/pages/classify/classify.dom.test.tsx` (予定) で、KPI 4 枚の件数が API の値と一致し、要確認のカードに『未整理のうち』が添えられること、KPI を押すとその分類ステータスで絞り込まれること、一括保存の部分失敗で失敗した明細だけが選択に残ること、下書きの復元と保存成功での消去、URL の再読込で同じ条件に戻ることを確かめる。既存の `classify-*.dom.test.tsx` と `classification-progress.dom.test.tsx` を新しい構成に合わせて保つか置き換える。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-classify-frontend-web-001 | 画面を `pages/classify/` に分け、整形を `view-model.ts` に集める | `Classify.tsx` 1 ファイルのまま拡張する | 部品ごとにテストでき、画面の判定の混入を見つけやすい | 既存の import と DOM テストを移す |
| qa-classify-frontend-web-001 | 条件と選択を URL、サーバの値を TanStack Query、入力途中を localStorage に分ける | 画面の state に全部を持つ | 再読込・共有・離脱に強く、置き場所で責務が決まる | 3 つの境界をテストで固定する |
| qa-classify-frontend-web-001 | 件数・区分・信頼度を画面で計算しない | 画面で API の行から数え直す | バッジ・月次クローズ・画面の件数がずれない | 表示の値は API の応答に依存する |
| qa-classify-frontend-web-002 | 下書きのキー・1 秒の遅延保存・30 日の破棄 (agent 推定・利用者未確認) | 保存ボタンまで保持しない | 入力途中の値を失わない | 端末の容量と共有端末への配慮が要る |
| qa-classify-frontend-web-001 | 一括操作バーを画面専用部品にする | 既存の `SelectionBar` と共通化する | 画面ごとの操作の違いを抱え込まない | 似た部品が 3 つ並ぶ |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web の静的配信 (`deploy.yml`)。
- Migration sequence: API の拡張の配信 → `pages/classify/` への分割 (旧表示のまま) → KPI と絞り込み → 編集パネルと下書き → 一括操作バー → ルール作成とプレビュー → 保存フィルタと履歴 → 旧 `Classify.tsx` の削除。
- Rollback trigger/procedure: DOM テストか画面の確認で不具合が出たら web の配信を直前版へ戻す。API は加法的な変更なので直前版の画面もそのまま動く。

## Risks and verification

- Risk/assumption: ナビのバッジ (`Layout.tsx`) は現行 `/review-queue` の保留を除いた件数を読み、期間に依存しない。仕様の『未整理の件数』と画面の KPI の未整理が同じ集合か (期間の有無) を `specs/spec-classify-screen.md` で決め、DOM テストで突き合わせる。
- Risk/assumption: 変更の後に `/review-queue` を無効化し忘れると、バッジだけ古い件数が残る。無効化は `classification-invalidate.ts` の 1 か所から行う。
- Architecture fitness test: `pages/classify/` の外から画面専用部品を import しないこと。画面に区分や信頼度の判定が無いこと。デザイントークンの検査が通ること。
- Load/failure/security validation: 3 年分の期間でも一覧が 50 件ずつ表示されること。localStorage が使えない環境でも保存ができること。
