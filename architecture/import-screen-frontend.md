---
graph_node_id: "arch-import-screen-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "データ取込 — Import.tsx を pages/import/ へ分割し、上限の判定も含めて core の結果を描くだけにする"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["import-screen", "frontend"]
file_path: "architecture/import-screen-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "a7e3437bf267934ab3c6b44de73a738606c8af419fba667ca59ef8e2f536cf31"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "a7e3437bf267934ab3c6b44de73a738606c8af419fba667ca59ef8e2f536cf31", "imported_at": "2026-09-21T22:53:09Z"}
created_at: "2026-09-21T22:53:09Z"
updated_at: "2026-09-21T22:53:09Z"
depends_on: ["spec-import-screen"]
related_nodes: ["arch-import-screen-ui-ux", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-auth", "arch-import-screen-security", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Import.tsx", "packages/web/src/pages/import", "packages/web/src/components/ImportDeletion.tsx", "packages/web/src/import-retry.ts", "packages/web/src/api.ts", "packages/web/src/api-client.ts", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/period.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/pages/Import.dom.test.tsx", "packages/web/src/pages/Import.deletion.test.tsx", "packages/web/src/pages/Import.discard.test.tsx", "packages/web/src/import-reimport.dom.test.tsx", "packages/web/test/import-multifile.dom.test.tsx", "packages/web/test/import-review-notice.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/import-screen-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:53:09Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5", "G6"]
---

# Architecture overview

データ取込 — Import.tsx を pages/import/ へ分割し、上限の判定も含めて core の結果を描くだけにする。`system-spec/frontend.md` は承認時入力、本書は部品の分け方・状態の置き場所・アップロードの送り方の制約を持つ。契約の正本は `specs/spec-import-screen.md` (spec-import-screen) の UI・状態遷移の節と API契約の節。

## Context and drivers

- Business/technical context: 現行の `packages/web/src/pages/Import.tsx` は `pages/import/ImportPage.tsx` を re-export し、画面部品・状態・API操作は `pages/import/` に分かれる。取得と更新は TanStack Query 5、ルーティングは react-router 7、期間は `period.tsx` の usePeriod と PeriodPicker。DOM テストは `Import.*.test.tsx` と `pages/import/*.dom.test.tsx` 群。サイドバーの取込バッジは /review-queue の counts.import を読む (qa-imp-frontend-web-evidence-001)。
- Quality attribute priorities: G1〜G6 に資する。Clean Architecture の依存方向を『web は取込の判定を持たない』構成に適用する。Apple HIG の共通部品の規則を表・ステッパー・結果カード・詳細ペイン・選択中バーに適用する。
- Constraints: 画面は遅延読み込みのまま。色はトークンだけ、ボタンは共通 Button、ページは PageShell。web に上限の数値リテラルを書かない。

## Goals and non-goals

- Goals:
  - G1: `Import.tsx` を `packages/web/src/pages/import/` 配下 (新設) へ分割する。部品はファイル選択・取込ファイル一覧・内容確認・取込結果・取込履歴・履歴詳細・選択中バー。
  - G2: 検査 → 確認 → 確定の 2 段階の流れにし、選んだファイルを 1 つの multipart 要求で送って、1 つの検査 ID とファイルごとの項目を受ける (qa-imp-decision-005)。
  - G3: ファイルの状態・検証の段階・取込可否・要約・取込 1 回の結果は core の純関数の結果を描くだけにする。送る前の上限判定も core の `import-screen.ts` (新設) の `IMPORT_LIMITS` と超過の理由を返す判定関数を import して行う。
  - G5: 履歴一覧と履歴詳細を別の query に分け、選択中の履歴を URL に持つ。
- Non-goals:
  - web に判定・上限の数値を書くこと
  - 画面の即時読み込み化 (遅延読み込みを維持する)
  - 共通シェルとサイドバーの構成の変更

## System context and boundaries

- Users/external systems: 利用者のブラウザと、同一オリジンの api (`/api/imports*`)。
- Trust/deployment/data boundaries: web は packages/core を import して上限値と判定関数を使うが、ファイルの状態や取込可否は api の応答 (core の導出結果) を描くだけにする。ファイル由来の文字列は React のエスケープで描く (`architecture/import-screen-security.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `pages/import/` の画面の入口 (新設) | 5 段と下部バーを組み立てる | React (遅延読み込み) | packages/web | Workers Assets |
| ファイル選択 | ドロップと選択、送る前の上限判定の呼び出し | React | 画面の状態 | Workers Assets |
| アップロード送信 | 1 要求の multipart を XMLHttpRequest で送り、進捗を配る | 関数 | 画面の状態 | Workers Assets |
| 取込ファイル一覧 / 内容確認 / 取込結果 | 検査結果と core の要約・結果を描く | React | api の応答 | Workers Assets |
| 取込履歴 / 履歴詳細 | 1 回 1 行と影響の 3 数値、原本・再取込・取り消し | React + TanStack Query | api の応答 | Workers Assets |
| 選択中バー | 選択中ファイル数・取込可能数・エラー数・取り込む | React | 画面の状態 | Workers Assets |
| core `import-screen.ts` (新設) | `IMPORT_LIMITS` と超過の理由を返す判定関数 | 純関数 | packages/core | web と api に同梱 |

## Cross-cutting contracts

- Identity/access: 既存のセッション Cookie で `/api/imports*` を呼ぶ。変更要求は同一オリジンから送る (`architecture/import-screen-auth.md`)。
- Errors/resilience: 413 と 429 は上限と待ち時間 (Retry-After) を文言で出す。取込可能が 0 件のとき取り込むボタンは押せない。
- Observability/audit: N/A: 新しい信号を足さない。
- Configuration/secrets: N/A: 画面は秘密情報を持たない。
- Compatibility/versioning: 既存の DOM テストが import する部品名は移設先から再エクスポートするか、テストを新しい構成に合わせて書き直す (qa-imp-frontend-web-005、agent 推定)。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/import-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/import-screen-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/import-screen-database.md`)
- Security: N/A: 本章の関心外 (`architecture/import-screen-security.md`)

### Frontend architecture

#### Rendering and application pattern

既存の SPA (React・react-router 7) のまま。/import の画面は `AuthenticatedApp.tsx` の遅延読み込みの経路に載せたまま、中身を `pages/import/` の部品に分ける。画面は core の導出結果を描くだけにする (Clean Architecture の Dependency Rule)。

#### Routes, screens and navigation

経路は /import の 1 つ。選択中の履歴は URL の検索パラメータに持つ。結果カードから総収支画面とサブスク画面へ移る導線は `architecture/import-screen-ui-ux.md` に従う。

#### Component and design-system boundaries

表は DataTable、ボタンは共通 Button、ページは PageShell (`components/Page.tsx`)、期間は `period.tsx` の既存部品を使う。新しい共通部品は足さず、取込に固有の部品は `pages/import/` の中に閉じる。

#### State and data flow

サーバーの状態 (履歴一覧・履歴詳細・検査結果) は TanStack Query に、選択中の履歴は URL に、選択中のファイルとアップロード進捗は画面の状態に置き分ける。確定・取り消し・削除の mutation 後に履歴と review-queue のキーを無効化し、サイドバーの取込バッジを追従させる (qa-imp-frontend-web-005、agent 推定)。

#### Backend integration

- 検査: 選んだファイルを 1 つの multipart 要求にまとめて XMLHttpRequest で送る。進捗は `upload.onprogress` の累計バイトを multipart に積んだ順のファイルへ割り当てて、ファイルごとの % を出す (fetch はアップロード進捗を取れないため)。アップロード中のキャンセルは要求全体を abort し、そのファイルを外した残りを送り直す。
- 上限: 送る前に core の `IMPORT_LIMITS` と判定関数で 1 ファイル 25MB・10 ファイル・合計 30MB を判定し、超えるものは送らずに取込不可と理由を出す。再試行と後からの追加は同じ検査 ID へ足す要求で行い、既存の項目と合わせた累計を同じ判定関数で判定する (qa-imp-decision-008)。
- 確定: 検査 ID・取り込むファイル項目 ID・前回データを残す (既定オン)・強制再取込を送る。
- `.txt` はタブ区切りまたはカンマ区切りの CSV として扱う。

#### Performance and observability

画面は遅延読み込みのまま (`AuthenticatedApp.tsx` の `lazy(() => import('./pages/Import.js'))` を `pages/import/` の入口へ向け替える) にし、初期 JS 予算 (CI 実測) を超えない。core の判定関数を取込の画面からだけ import し、初期チャンクへ入らないことを予算の実測で確かめる。

#### Frontend verification

DOM テストで 5 段・下部バー・読込・空・失敗の状態、送る前の上限超過の理由の表示、取込可能 0 件でボタンが押せないこと、413 と 429 の文言、ファイルごとの進捗 % を確かめる。web の送信前判定と api の 413 が同じ境界値で同じ結果になることは、共通の境界表を両方のテストから読んで確かめる (`architecture/import-screen-maintenance-ops.md`)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-decision-005 | 複数ファイルを 1 要求で送り、検査 ID を 1 つ受ける | 1 ファイル 1 要求 (現行) | 1 回の取込 = 1 つの検査 ID の形が保てる | 進捗をファイルへ割り当てる処理が要る |
| qa-imp-frontend-web-005 | XMLHttpRequest でアップロード進捗を取る (agent 推定) | fetch で送る | fetch はアップロード進捗を取れない | 送信部品だけ XMLHttpRequest になる |
| qa-imp-frontend-web-005 | 上限値と超過判定を core から import し web に数値を書かない (agent 推定) | web に定数を持つ | api の 413 と同じ境界で判定できる | core の定数の変更が web と api に同時に効く |
| qa-imp-decision-008 | 再試行と追加は同じ検査 ID へ足す | 全ファイルを送り直す | 送り直しが要らず 1 回 1 行を保てる | 累計の判定が要る |
| qa-imp-decision-003 | 確定はファイルを再送しない | 確定時に再アップロード | 通信量と待ち時間が半分になる | 仮置きの期限 (24 時間) を画面で扱う |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web のビルドと Workers Assets の配信。
- Migration sequence: core の `import-screen.ts` → api の検査・確定経路 → `pages/import/` の部品 → 既存の DOM テストの移設または書き直し → `Import.tsx` の旧来の即時取込の削除。
- Rollback trigger/procedure: DOM テスト・初期 JS 予算が落ちたら web の配信を戻す。

## Risks and verification

- Risk/assumption: 進捗の割り当ては multipart に積んだ順に依存する。順序を変えると別のファイルの % が進むので、積んだ順と表の順を同じ配列から作る。
- Architecture fitness test: `pages/import/` にステータスの文字列比較と上限の数値リテラルが無いこと。web が api の route を直接 import しないこと。
- Load/failure/security validation: 30MB ちょうどの選択で送信が始まり、1 byte 超えで送らずに理由が出ること。
