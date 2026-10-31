---
graph_node_id: "arch-settings-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "設定 — 画面の入口が 1 本の取得を節ごとの部品へ配り 4 節の編集を 1 つの下書きに集めて 1 回で保存する"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "frontend"]
file_path: "architecture/settings-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "711a2fd0946231628d693ec05f71d6f7013ad9d4d589f3b06dc548264f76f000"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "711a2fd0946231628d693ec05f71d6f7013ad9d4d589f3b06dc548264f76f000", "imported_at": "2026-09-22T10:13:43Z"}
created_at: "2026-09-22T10:13:43Z"
updated_at: "2026-09-22T10:13:43Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-ui-ux", "arch-settings-backend", "arch-settings-database", "arch-settings-security", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-auth"]
resource_scope: ["packages/web/src/pages/settings/", "packages/web/src/pages/Settings.tsx", "packages/web/src/pages/PasswordChange.tsx", "packages/web/src/pages/budget/draft.ts", "packages/web/src/pages/budget/BudgetSaveBar.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/ExportMenu.tsx", "packages/web/src/components/SelectionCheckbox.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/CategoryPicker.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/api.ts", "packages/web/src/settings-restore.dom.test.tsx", "packages/web/src/backup-restore.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/settings-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-22T10:13:43Z"}
serves_goals: ["G1", "G3", "G4"]
---

# Architecture overview

設定 — 画面の入口が 1 本の取得を節ごとの部品へ配り 4 節の編集を 1 つの下書きに集めて 1 回で保存する。`system-spec/frontend.md` は承認時入力、本書は web の部品分割・状態の置き場・下書き・API との結線の制約を持つ。画面の構成は `architecture/settings-ui-ux.md`、逐語の正本は `specs/spec-settings-screen.md` (作成予定)。

## Context and drivers

- Business/technical context: `packages/web/src/pages/Settings.tsx` (457 行) は 1 ファイルに SettingsPage・NightlyBackups・LegacyRestoreNotice を持ち、`ClassificationSettings`・`UserAdmin`・`VendorMemorySettings`・`PasswordChangeForm` をカードとして縦に並べる。下書き・保存バー・節ナビは無い。予算画面は `pages/budget/` に入口・`draft.ts`・`BudgetSaveBar`・`view-model.ts` を分け、`Layout.tsx` がログアウトで `clearAllBudgetDrafts` を呼ぶ (qa-settings-frontend-web-evidence-001)。構成は React 18・react-router-dom 7 (BrowserRouter)・TanStack Query 5 で、状態管理ライブラリは持たない。
- Quality attribute priorities: G1・G3・G4 に資する。画面の入口 (container) と節ごとの表示部品を分け、部品は受け取った値を描くだけにする。`beforeunload` は未保存があるときだけ登録し、アプリ内リンクでの離脱は確認ダイアログで止める。下書きは localStorage に利用者単位で閉じる。
- Constraints: I1 (`pages/settings/` への分割) と I4 (予算の `draft.ts`・`BudgetSaveBar` を先例にした下書き) に従う。依存ライブラリを増やさない。既存部品 (`PasswordChangeForm`・`UserAdmin`・`ClassificationSettings`・`VendorMemorySettings`・未記帳月・HTML 版からの初期移行) は中身を変えずに『アカウント』『その他の管理』へ移す (qa-settings-decision-004)。

## Goals and non-goals

- Goals:
  - G1: `Settings.tsx` を `pages/settings/` に分け、画面の入口が画面用の取得 1 本を読み、節ごとの部品へ渡す (qa-settings-frontend-web-003)。
  - G3: 集計ルール・名義・統計・現金上書きの編集を 1 つの下書きに集める。保存バーから 1 回で送り、成功で下書きを消す。409 では下書きを残したまま最新を取り直す。
  - G4: 出力 4 種のうち集計マトリクス CSV・取引 CSV・レポート HTML は選択中の期間を渡し、設定 JSON は期間を持たない (qa-settings-decision-006)。復元は ファイル選択 → 差分プレビュー → 確認 → 本適用 の順に進める。
- Non-goals:
  - 画面で差分・照合・現金の解決を計算すること (core と API の責務、`architecture/settings-backend.md`)
  - 既存部品の作り直し
  - 状態管理ライブラリ・並べ替えライブラリの追加

## System context and boundaries

- Users/external systems: 利用者本人のブラウザ。API は同一 Worker の `/api/*`。
- Trust/deployment/data boundaries: 画面は API の応答と下書きだけを持ち、正本は D1 の値。下書きは端末の localStorage にだけ置き、サーバへは保存のときに送る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| SettingsPage (画面の入口) | 画面用の取得、下書きとの合成、保存・409・離脱確認、節ナビの現在節 | `useQuery` / `useMutation` | packages/web | 静的配信 |
| 集計ルール節の部品 | 表・選択・並べ替え (上下移動ボタン併設)・追加・削除・一括削除 | props (行と下書き操作) | packages/web | 静的配信 |
| 説明パネルの部品 | 選んだ行の『影響するもの』・最終更新・更新者・『このルールを元に戻す』 | props | packages/web | 静的配信 |
| 名義・統計・現金上書きの部品 | 4 名義、最小月数、支払い・受け取りの 2 行 | props | packages/web | 静的配信 |
| データ・復元の部品 | 出力 4 種、設定 JSON の読込みと差分プレビュー・確認 | `ExportMenu` と同じ期間の渡し方 + `ConfirmDialog` | packages/web | 静的配信 |
| バックアップの部品 | 一覧・比較・設定だけの復元 | `DataTable` + `ConfirmDialog` | packages/web | 静的配信 |
| 保存バー | 未保存 N 項目・リセット・保存 | `BudgetSaveBar` を先例にした画面専用部品 | packages/web | 静的配信 |
| 下書き | 利用者単位の保存・読み戻し・消去 | `pages/settings/draft.ts` (予算の `draft.ts` を先例) | packages/web (localStorage) | 静的配信 |
| 既存部品 | パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・初期移行 | 現行のまま | packages/web | 静的配信 |

部品と hook の名前は `specs/spec-settings-screen.md` で決める。下書きの hook は `useSettingsDraft` を仮称とする (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-004)。

## Cross-cutting contracts

- Identity/access: 下書きのキーに利用者 ID を含め、ログアウトで消す。`Layout.tsx` の `clearAllLiabilityDrafts`・`clearAllBudgetDrafts` と並べて設定の下書き消去を呼ぶ (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-004)。
- Errors/resilience: 保存が 409 なら『他の画面で更新されました』を出して最新を取り直し、下書きは残す (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-004)。復元の検証違反と 413 は何も変えずに理由を出す。
- Observability/audit: N/A: 画面は観測信号を出さない。更新者と最終更新は API の値を描く。
- Configuration/secrets: N/A: 画面は設定・秘密情報を持たない。
- Compatibility/versioning: 下書きは版つきで保存し、版が合わない下書きは読まずに捨てる。既存の DOM テスト (`settings-restore.dom.test.tsx`・`backup-restore.dom.test.tsx`) を緑のまま保つ。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/settings-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/settings-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/settings-database.md`)
- Security: N/A: 本章の関心外 (`architecture/settings-security.md`)

### Frontend architecture

#### Rendering and application pattern

- 既存の SPA (Vite + React 18) の 1 画面。入口が取得・下書き・保存を持ち、部品は props を描く。表示の値 (影響するもの・空欄 / 0 の区別・更新者) は API 応答をそのまま使う。
- 全体を 1 ファイルに戻さない。`Settings.tsx` は入口の再輸出か削除にし、`routeMetadata.ts` の settings (navGroup『管理』) は変えない。

#### Routes, screens and navigation

- `/settings` の 1 ルート。節ナビは画面内の見出しへの移動で、`IntersectionObserver` で現在の節を追う (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-002)。
- 未保存があるときだけ `beforeunload` を登録し、アプリ内の移動は確認ダイアログで止める (予算画面の先例)。

#### Component and design-system boundaries

- 共通部品 (`PageHeader` / `Button` / `ConfirmDialog` / `PeriodPicker` / `SelectionCheckbox` / `DataTable` / `CategoryPicker`) を使い、画面専用部品は `pages/settings/` に閉じる。
- 並べ替えは HTML の Drag and Drop とボタンで作り、ライブラリを足さない (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-002)。上下移動ボタンを併設する (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-004)。
- 既存部品は import 先を変えるだけで中身を変えない (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-004)。

#### State and data flow

- サーバの値は TanStack Query のキャッシュ、編集中の値は下書きに置き、表示は 2 つを合成した値を描く。
- 下書きのキーは `kanjo:settings:draft:{userId}`、版 v1、有効期間 30 日、書込みの間引きは 800ms (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-002)。
- 保存には取得時の保存時刻 (`baseSavedAt`) を添え、成功したら下書きを消してキャッシュを無効化する。『このルールを元に戻す』は直前の保存値を下書きへ入れるだけ (qa-settings-decision-008)。
- 未保存件数はフィールド単位で数える (`architecture/settings-ui-ux.md`)。

#### Backend integration

- 取得 1 本・保存 1 本・変更履歴・設定 JSON の出力・復元の preview と本適用・バックアップの一覧・比較・preview・本適用を `api.ts` から呼ぶ。パス名は `architecture/settings-backend.md` に従う (agent 推定・利用者未確認、根拠 qa-settings-backend-web-004)。
- 出力の期間は `ExportMenu` の `withPeriod` と同じ渡し方にする (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-004)。
- 差分プレビューは API の返した差分を描く。画面で差分を作らない。

#### Performance and observability

- 画面の取得は 1 本にし、節ごとに取得を分けない。変更履歴は行を選んだときだけ取る。
- 観測信号は追加しない。

#### Frontend verification

DOM テストで、4 節の編集が 1 つの未保存件数にまとまること、リセットで下書きが消えること、保存成功で下書きが消えること、409 で下書きが残り最新を取り直すこと、未保存があるときだけ離脱確認が出ること、ログアウトで下書きが消えること、版違いの下書きを読まないこと、上下移動ボタンで順序が変わること、出力 3 種に期間が渡り設定 JSON に渡らないこと、復元が preview → 確認 → 本適用の順にしか進まないことを確かめる。既存部品のテストと `settings-restore.dom.test.tsx`・`backup-restore.dom.test.tsx` が緑であることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-settings-frontend-web-003 | `pages/settings/` に入口と節ごとの部品を分け、取得 1 本を配る | 1 ファイルのまま拡張 / 節ごとに取得 | 保存の単位と表示の値が揃い、部品を単独で試せる | 入口が下書きと保存を一手に持つ |
| qa-settings-decision-008 | 4 節の編集を 1 つの下書きに集め、1 回で保存する | 節ごとに保存 | 未保存件数と 409 の扱いが 1 か所になる | 既存部品の個別保存と単位が異なる |
| qa-settings-frontend-web-002 | 下書きを localStorage に利用者単位・版つき・期限つきで置く (agent 推定・利用者未確認) | sessionStorage / サーバの下書き表 | 再読込でも消えず、サーバの表を増やさない | 共用端末ではログアウトでの消去が要る |
| qa-settings-frontend-web-002 | 並べ替えは HTML の DnD とボタンで作る (agent 推定・利用者未確認) | 並べ替えライブラリを追加 | 依存を増やさず、ボタンで SC 2.5.7 を満たす | タッチ端末の DnD はボタンに頼る |
| qa-settings-decision-004 | 既存部品は中身を変えずに 2 節へ移す | 作り直す | 既存のテストと動きを保てる | 見た目の揃え方が節で異なる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web の静的配信。API の新しいパスと同じ変更で出す。
- Migration sequence: `pages/settings/` の骨格と既存部品の移設 → 画面用の取得 → 4 節の部品 → 下書き・保存バー・409・離脱確認 → データ・復元 → バックアップ → `Layout.tsx` のログアウト消去。
- Rollback trigger/procedure: DOM テストか保存の不具合が出たら web を直前版へ戻す。下書きは版つきなので旧版では読まれない。

## Risks and verification

- Risk/assumption: 既存部品は内部で個別に保存し、保存バーの未保存件数に入らない。利用者が保存バーで全部が保存されたと誤解しうる (`architecture/settings-ui-ux.md`)。
- Risk/assumption: 下書きの版と画面用の取得の形がずれると、読み戻した下書きが最新に合わない。取得の形を変えるときは下書きの版を上げる。
- Risk/assumption: API のパス名と hook 名は -004 の推定。`specs/spec-settings-screen.md` で確定してから結線する。
- Architecture fitness test: 部品が API を直接呼ばないこと (入口だけが呼ぶ)。`pages/settings/` の外に画面専用部品が無いこと。依存ライブラリが増えないこと。
- Load/failure/security validation: 集計ルールが上限行数でも入力が遅れないこと。保存・復元の失敗と 409 で下書きが残ること。別利用者の下書きが読まれないこと。
