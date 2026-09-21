---
graph_node_id: "arch-ai-analysis-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "AI分析 — Ai.tsx を pages/ai/ へ分割し、core の判定結果を描くだけにする"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ai-analysis", "frontend"]
file_path: "architecture/ai-analysis-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "eba3e33334b9f5c6dcff8e1b78b8fff1804f2f52604edca0382f1a6158f36ef4"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "eba3e33334b9f5c6dcff8e1b78b8fff1804f2f52604edca0382f1a6158f36ef4", "imported_at": "2026-09-19T13:11:57Z"}
created_at: "2026-09-19T13:11:57Z"
updated_at: "2026-09-19T13:11:57Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-auth", "arch-ai-analysis-security", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Ai.tsx", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/period.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/ai-copy-log.dom.test.tsx", "packages/web/src/ai-report-structure.dom.test.tsx", "packages/web/src/ai-report-archive.dom.test.tsx", "packages/web/src/ai-task-collapse.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/ai-analysis-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T13:11:57Z"}
serves_goals: ["G1", "G3", "G4"]
---

# Architecture overview

AI分析 — Ai.tsx を pages/ai/ へ分割し、core の判定結果を描くだけにする。`system-spec/frontend.md` は承認時入力、本書はファイル分割・状態・取得・部品の制約を持つ。画面の逐語は spec-ai-analysis-screen の画面構成の節。

## Context and drivers

- Business/technical context: AI 画面は `AuthenticatedApp.tsx:23` で `lazy(() => import('./pages/Ai.js'))` により遅延読み込みされる。`Ai.tsx` (1277 行) は `AiPage`・`PromptCard`・`RunCard`・`ReportDetail`・`CompareView`・`ReportToc`・`FindingList` を 1 ファイルに持ち、`useQuery` で `/summary`・`/ai/tasks`・`/ai/reports` を取得する。既存の DOM テスト 4 本が `RunCard`・`FindingList`・`ReportText`・`AiPage` を `Ai.js` から直接 import している。共通の期間は `packages/web/src/period.tsx` の `usePeriod` / `PeriodPicker` が担う (qa-ai-frontend-web-evidence-001)。
- Quality attribute priorities: G1・G3・G4 に資する。Clean Architecture の依存方向を、web が段階の判定を持たない構成に適用する。
- Constraints: React + TanStack Query + React Router (7 系)。色はデザイントークン、ボタンは共通 `Button`、ページは `PageShell`。画面は遅延読み込みのまま。初期 JS 予算を緑に保つ。

## Goals and non-goals

- Goals:
  - G1: `Ai.tsx` を `packages/web/src/pages/ai/` 配下へ分割し (依頼・実行中の表・依頼の詳細・レポート一覧・取り込み・詳細・版履歴・版比較)、期間は `usePeriod` から取り旧 `PRESETS` を消す (qa-ai-decision-001)。
  - G3: 実行中の表の操作 (キャンセル・詳細・再実行・削除) を mutation にし、成功後に該当キーだけを無効化する。
  - G4: 取り込み・タブ・版履歴・版比較は core の結果を描くだけにし、選択中の依頼・レポート・タブを URL に持つ。
- Non-goals:
  - web での段階・進捗・版の説明・タブの振り分けの判定
  - サーバーへの下書き保存
  - 新しい UI ライブラリの導入

## System context and boundaries

- Users/external systems: 利用者のブラウザ、`/api/ai/*` と `/api/summary`。
- Trust/deployment/data boundaries: web は api が返す段階・進捗・T-番号・版の説明をそのまま描く。画面が持つ状態は選択中の依頼・レポート・タブ (URL) と補足指示の下書き (localStorage) だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `pages/Ai.tsx` (入口) | `AiPage` と既存テストが import する部品名を移設先から再エクスポートする | module | packages/web | Workers Assets (遅延 chunk) |
| `pages/ai/` 依頼 | 期間・補足指示・コピー・使用するデータのカード | React | packages/web | 同上 |
| `pages/ai/` 実行中の表 | ID・ステータス・期間・作成日時・進捗・依頼内容・操作 | React | packages/web | 同上 |
| `pages/ai/AiTaskDetailPage` | 依頼 1 件の段階・進捗・操作と、結果待ちならその依頼への取り込み | React | packages/web | 同上 |
| `pages/ai/AiReportPages` レポート一覧 | 検索・アーカイブ表示 | React | packages/web | 同上 |
| `pages/ai/` 詳細・版履歴・版比較 | 5 タブ・版の説明・2 版の並置 | React | packages/web | 同上 |

## Cross-cutting contracts

- Identity/access: 既存のセッションで `/api/*` を呼ぶ。
- Errors/resilience: 各段は読込・空・失敗の状態を持ち、1 段の失敗で他の段を止めない。localStorage の読み書きの例外は握って画面を止めない。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 秘密情報を持たない。トークンは依頼の発行応答でだけ受け取り、コピーの文面に入る。
- Compatibility/versioning: `AuthenticatedApp.tsx` の遅延読み込みの入口 (`./pages/Ai.js` の `AiPage`) を変えない。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/ai-analysis-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外 (`architecture/ai-analysis-security.md`)

### Frontend architecture

#### Rendering and application pattern

クライアント描画の SPA のまま、AI分析画面は遅延 chunk に閉じる。`pages/Ai.tsx` は入口として残し、中身を `pages/ai/` へ移す。段階・進捗・版の説明・タブの振り分け・JSON エラー位置は core の純関数の結果 (api 経由または core の直接 import) を描くだけにする。

#### Routes, screens and navigation

経路は `/ai` のまま。選択中の依頼・レポート・タブは `useSearchParams` の検索パラメータに持ち、再読込で復元する。URL に依頼が無ければ 実行中 → 待機中 → 最新の完了 の順で最初の 1 件を選ぶ (agent 推定・利用者未確認、根拠 qa-ai-ui-ux-web-003)。

#### Component and design-system boundaries

ページは `PageShell`、ボタンは共通 `Button`、色はトークンだけにする。表はサブスク画面 (`pages/subscriptions/` など) と同じ流儀で組む。ステータスには文字を添え、進捗は数値の % と棒の両方で示す。レポートの文字列は React の既定のエスケープで描き、`dangerouslySetInnerHTML` を使わない。

#### State and data flow

サーバー状態は TanStack Query で 依頼一覧・レポート一覧・レポート詳細・使用するデータ の 4 つに分ける。キャンセル・再実行・削除・取り込み・アーカイブの mutation の後は、該当する依頼一覧とレポート一覧のキーだけを `invalidateQueries` で無効化する。補足指示の下書きは localStorage に自動保存し、依頼の発行時に消す (qa-ai-decision-006)。キーに利用者 ID を含め、1000 文字を超える値は保存しない (agent 推定・利用者未確認、根拠 qa-ai-security-web-003)。

#### Backend integration

`GET /ai/tasks` の段階・進捗・T-番号、`GET /ai/inventory` の件数、`POST /ai/tasks/:id/cancel` と `/retry`、`DELETE /ai/tasks/:id`、`POST /ai/tasks/:id/paste` を呼ぶ。取り込み先は選択中の依頼で、結果待ちが 1 件だけなら自動で選び、無ければボタンを無効にする (qa-ai-decision-005)。契約の逐語は `architecture/ai-analysis-backend.md` と spec-ai-analysis-screen の API 契約の節。

#### Performance and observability

画面は遅延読み込みのままで初期 JS に入らない。分割した部品は同じ chunk に入り、初期 JS 予算 (CI 実測) を緑のまま保つ。レポート詳細はタブごとに描き、選ばれていないタブの重い図表を描かない。

#### Frontend verification

DOM テストで `/ai` の 2 段と専用画面への遷移、ステータスの文字、取り込みエラーの行と位置の文と入力の保持、5 タブの振り分け、版比較の既定 (選択中の版と 1 つ前、v1 では無効)、専用 URL とタブ (`tab`) からの復元を確かめる。既存 DOM テスト 4 本は `pages/Ai.tsx` からの再エクスポートで通すか、新しい構成に合わせて書き直し、書き直したテストが旧実装で落ちることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ai-frontend-web-001 | `Ai.tsx` を `pages/ai/` へ分割し入口だけを残す | 1 ファイルのまま改修 | 部品ごとに読めてテストできる。遅延読み込みの入口とテストの import を壊さない | 入口に再エクスポートが残る |
| qa-ai-frontend-web-001 | 選択を URL の検索パラメータに持つ | コンポーネント内の state | 再読込と共有で同じ画面に戻れる | 選択の変更がナビゲーションになる |
| qa-ai-decision-006 | 下書きを localStorage に置く | サーバーに保存 | サーバーの契約と表を増やさない | 別の端末には引き継がれない |
| qa-ai-decision-001 | 期間を `usePeriod` に統一し旧 `PRESETS` を消す | 独自プリセットを残す | 他画面と期間の操作が揃う | 月・四半期・13か月・5年の選択肢が無くなる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと Workers Assets。
- Migration sequence: `pages/ai/` へ部品を移設し入口から再エクスポート → `usePeriod` への置き換え → 実行中の表と操作 → 取り込み → 詳細のタブ・版履歴・版比較 → 依頼とレポートの専用経路と `tab` → 旧 `PRESETS` と `ReportToc` の削除。
- Rollback trigger/procedure: DOM テスト・初期 JS 予算・`verify:full` のどれかが赤なら差し戻す。サーバーの状態は変えない。

## Risks and verification

- Risk/assumption: web に段階の判定が残ると、api と表示が食い違う。web に段階の比較 (時刻と現在時刻の比較など) が無いことを検索で確かめる。
- Architecture fitness test: `pages/ai/` が色を直書きしないこと (lint)。`dangerouslySetInnerHTML` が無いこと。`AuthenticatedApp.tsx` の入口が変わっていないこと。
- Load/failure/security validation: localStorage が例外を投げる環境 (プライベートブラウズなど) でも画面が描けることを DOM テストで確かめる。
