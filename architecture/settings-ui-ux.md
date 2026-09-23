---
graph_node_id: "arch-settings-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "設定 — 節ナビで 8 節を移り集計ルールの表と説明パネルを往復し保存バーで 1 回に確定する 1 画面"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "ui-ux"]
file_path: "architecture/settings-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "376a461e32d6277d040822ed6cd4d4b016c46332dece3f6f8c7c412114b754de"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "376a461e32d6277d040822ed6cd4d4b016c46332dece3f6f8c7c412114b754de", "imported_at": "2026-09-22T10:13:43Z"}
created_at: "2026-09-22T10:13:43Z"
updated_at: "2026-09-22T10:13:43Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-frontend", "arch-settings-backend", "arch-settings-database", "arch-settings-security", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-auth"]
resource_scope: ["packages/web/src/pages/settings/", "packages/web/src/pages/Settings.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/SelectionCheckbox.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/CategoryPicker.tsx", "packages/web/src/components/Term.tsx", "packages/web/src/glossary.ts", "packages/web/src/period.tsx", "docs/ui-decisions.md", "design/FINAL-UI/images/18-settings.png", "design/FINAL-UI/spec/AUDIT.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/settings-ui-ux.md"}]
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

設定 — 節ナビで 8 節を移り集計ルールの表と説明パネルを往復し保存バーで 1 回に確定する 1 画面。`system-spec/ui-ux.md` は承認時入力、本書は画面構成・操作の流れ・確認の挟み方・表示の約束の制約を持つ。目標の見た目は `design/FINAL-UI/images/18-settings.png`、逐語の正本は `specs/spec-settings-screen.md` (作成予定)。

## Context and drivers

- Business/technical context: 現行の `/settings` (`packages/web/src/pages/Settings.tsx`、457 行) は `.card` を縦に並べるだけで、節ナビ・『この設定の説明』・下部の保存バー・未保存件数を持たない。ルートは `routeMetadata.ts` の navGroup『管理』。共通ヘッダ (`Layout.tsx`) に期間タブ (`PeriodPicker`)・最終更新・検索・ダウンロード・ヘルプがあり、フッタも既存。予算画面に保存バー (`BudgetSaveBar`)・下書き・離脱確認の先例がある (qa-settings-ui-ux-web-evidence-001)。画面の決定は `docs/ui-decisions.md`、画像との監査は `design/FINAL-UI/spec/AUDIT.md` (『抽象的な分類に寄りすぎ。正規化、名義、最低月数、現金上書き、復元を具体化』) に残る。
- Quality attribute priorities: G1・G3・G4 に資する。Apple HIG presentation を適用し、並べ替えハンドルには上下移動ボタンを併設してドラッグ無しでも順序を変えられるようにする (WCAG 2.2 SC 2.5.7、https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)。バックアップの『成功』『失敗』『最新』は色だけでなく文字のバッジで示し、現金上書きの空欄と 0 の違いは凡例の文で説明する。
- Constraints: 画像の 6 節は画像どおりに作り、画像外の既存機能は『アカウント』『その他の管理』の 2 節に移して 1 つも消さない (qa-settings-decision-004)。共通シェル (サイドバー・ヘッダ・フッタ) は作り直さない。対象は web のみで、375px 幅でも崩れない (qa-settings-target-platforms-001)。

## Goals and non-goals

- Goals:
  - G1: 画面を (1) パンくず『管理 / 設定』と期間タブ、(2) 見出し『設定』・問い『集計ルールと復元設定を、安全に管理しますか？』・説明文、(3) 左の節ナビ 8 項目 (集計ルール・名義・統計・現金上書き・データ・バックアップ、続けてアカウント・その他の管理)、(4) 集計ルールの表、(5) 右の『この設定の説明』、(6) 名義、(7) 統計、(8) 現金上書き、(9) データ (出力 4 種) と復元、(10) バックアップ、(11) アカウントとその他の管理、(12) 下部の保存バー で構成する (qa-settings-ui-ux-web-003)。読込・空・失敗の各状態を持つ。
  - G3: 名義・統計・現金上書き・集計ルールの編集を 1 つの下書きに集め、保存バーに未保存 N 項目・変更をリセット・設定を保存を出す。リセットと未保存のまま離れるときは確認する。『このルールを元に戻す』は直前の保存値を下書きへ戻す (qa-settings-decision-008)。
  - G4: データ節に 設定 JSON・集計マトリクス CSV・取引 CSV・レポート HTML の 4 種を出し、復元は設定だけを受ける (qa-settings-decision-006)。バックアップ表は 日付・サイズ・ステータス・メモ・比較・復元 で、復元は設定だけを戻す (qa-settings-decision-007, 010)。復元の前に差分を見せて確認する。
- Non-goals:
  - 画像外の既存機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版からの初期移行) の削除や他画面への移動
  - 取引を含む全データの復元をバックアップ表から行うこと
  - 共通シェルの作り直し・web 以外の専用アプリ

## System context and boundaries

- Users/external systems: 個人事業とその家族の家計を 1 人で管理する利用者本人。取込のたびに増える表記ゆれを直し、名義・統計・現金の扱いを決め、壊しても前日の状態や書き出したファイルから戻したい。
- Trust/deployment/data boundaries: 画面は API の値を表示し、未保存件数の数え方・『影響するもの』・空欄 / 0 の表記は core の算出結果を描くだけにする (`architecture/settings-frontend.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| (1)(2) 見出しと期間 | パンくず・期間タブ・見出し・問い・説明文 | `PageHeader` + `PeriodPicker` | packages/web | 静的配信 |
| (3) 節ナビ | 8 節への移動と現在節の強調 | 画面専用 | packages/web | 静的配信 |
| (4) 集計ルールの表 | チェックボックス・並べ替えハンドル (上下移動ボタン併設)・種別 (勘定科目 / 取引先)・元の表記・正規化後のカテゴリ select・削除・『+ ルールを追加』・一括削除 | `SelectionCheckbox` + `DataTable` + `CategoryPicker` | packages/web | 静的配信 |
| (5) この設定の説明 | 元の表記・正規化後のカテゴリ・影響するもの・最終更新と更新者・『このルールを元に戻す』・設定のヒント | 画面専用 + `Button` | packages/web | 静的配信 |
| (6)(7) 名義・統計 | 4 名義の表示名、統計の最小月数 (既定 6) と説明文 | 画面専用 + `Term` | packages/web | 静的配信 |
| (8) 現金上書き | 支払い・受け取りの 2 行に 上書き値 (空欄と 0 を区別)・適用範囲 (全期間 / 月指定)・メモ、空欄と 0 の凡例 | 画面専用 | packages/web | 静的配信 |
| (9) データと復元 | 出力 4 種 (うち 3 種は選択中の期間)、設定 JSON の読込み → 差分プレビュー → 確認 → 復元 | 画面専用 + `ConfirmDialog` | packages/web | 静的配信 |
| (10) バックアップ | 日付・サイズ・ステータス・メモ・比較・復元。比較は差分表示、復元は設定だけ | `DataTable` + `ConfirmDialog` | packages/web | 静的配信 |
| (11) アカウント・その他の管理 | 既存部品をそのまま移して置く | 既存部品 | packages/web | 静的配信 |
| (12) 保存バー | 未保存 N 項目・変更をリセット・設定を保存 | 画面専用 + `Button` + `ConfirmDialog` | packages/web | 静的配信 |

## Cross-cutting contracts

- Identity/access: 既存のセッションに乗る。アカウント節の利用者管理の見え方は既存の権限のまま (`architecture/settings-auth.md`)。
- Errors/resilience: 保存の失敗は保存バーに出し、下書きは残す。他所の更新との競合 (409) は保存できなかった旨を出して再取得する。復元の検証違反は何も変えずに理由の要約だけを出す。読込の失敗は `PageState` の失敗状態で再読込を促す。
- Observability/audit: 最終更新と更新者を説明パネルに出す。復元や移行で入った値の更新者は『システム』と表示する (qa-settings-decision-008)。
- Configuration/secrets: N/A: 画面に設定・秘密情報を持たない。
- Compatibility/versioning: 用語『集計ルール』『現金上書き』『元に戻す』は `glossary.ts` と `Term` で画面・API・テストに揃える。既存の設定機能の DOM テスト (`settings-restore.dom.test.tsx`・`backup-restore.dom.test.tsx`) を緑のまま保つ。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/settings-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/settings-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/settings-database.md`)
- Security: N/A: 本章の関心外 (`architecture/settings-security.md`)

### Frontend architecture

#### Rendering and application pattern

- 既存の SPA の 1 画面。画面の入口がデータを読み、(1)〜(12) の部品へ渡す。数値と文言の材料は API から受け取り、下書きの入力に応じた再表示だけを画面が受け持つ (`architecture/settings-frontend.md`)。
- 情報の優先順位は 未保存件数と保存 > 集計ルール > 復元・バックアップ > 他の節 とする (agent 推定・利用者未確認、根拠 qa-settings-ui-ux-web-004)。

#### Routes, screens and navigation

- `/settings` の 1 画面で完結させる。節ナビは画面内の見出しへの移動で、ルートを増やさない。
- 節ナビは sticky で幅 7〜8rem、説明パネルは 16〜18rem (agent 推定・利用者未確認、根拠 qa-settings-ui-ux-web-002)。
- 375px 幅では節ナビを上部の横並びにし、説明パネルは表の下へ回し、横スクロールは表の容器の中だけにする (agent 推定・利用者未確認、根拠 qa-settings-ui-ux-web-004)。

#### Component and design-system boundaries

- 共通部品 (`PageHeader` / `Button` / `ConfirmDialog` / `PeriodPicker` / `SelectionCheckbox` / `DataTable` / `CategoryPicker`) とデザイントークンを使い、画面専用の部品は `pages/settings/` に置く。画面専用の色・余白を作らない。
- 並べ替えはハンドルに上下移動ボタンを併設し、キーボードだけでも順序を変えられる。
- バックアップ表のバッジは最新 1 件に『最新』、成功に『成功』、失敗に『失敗』の文字を出す (agent 推定・利用者未確認、根拠 qa-settings-ui-ux-web-002)。
- ヒント文は画像の文言を使う (agent 推定・利用者未確認、根拠 qa-settings-ui-ux-web-002)。

#### State and data flow

- 『未保存』は変更したフィールド単位で数え、行の追加・削除は 1 行 1 項目とする (agent 推定・利用者未確認、根拠 qa-settings-ui-ux-web-002)。
- 現金上書きのメモは 100 字を上限に数えて『n/100』と出す (agent 推定・利用者未確認、根拠 qa-settings-ui-ux-web-002)。上書き値の空欄は『上書きしない』、0 は『0 円で上書き』と凡例で言い分ける。
- 行を選ぶと説明パネルがその行を映す。『このルールを元に戻す』は直前の保存値を下書きへ入れるだけで、保存で確定する。
- 統計の最小月数は既定 6 のまま表示し、画像の 12 は入力例として扱う (qa-settings-decision-009)。

#### Backend integration

- 表示の値は画面用の取得 1 本の応答を使い、全節の保存は 1 回で送る (`architecture/settings-backend.md`)。
- 比較と差分プレビューは API が返した差分をそのまま描き、画面で差分を計算しない。

#### Performance and observability

- 観測信号は追加しない。
- 集計ルールの行数上限は `architecture/settings-security.md` の上限に従い、表は一覧の容器の中でだけスクロールする。

#### Frontend verification

DOM テストで O1 (パンくず・期間タブ・問いの見出し・節ナビ 8 項目・集計ルール表の全列と操作・説明パネルの全欄・名義 4 欄・統計・現金上書き 2 行・出力 4 種・復元・バックアップ表の 6 列・保存バー、読込・空・失敗) を確かめる。加えて、上下移動ボタンで順序が変わること、バッジに文字があること、空欄と 0 が別の表示になること、リセット・行の削除・復元の前に確認が出ることを確かめる。375px の画面で横スクロールが表の容器の中だけであることを確かめ、`design/FINAL-UI/images/18-settings.png` と目視で突き合わせて差分を `design/FINAL-UI/spec/AUDIT.md` の形で記録する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-settings-decision-004 | 画像の 6 節の後ろに『アカウント』『その他の管理』を足し、既存機能を移して残す | 画像の 6 節だけにして他画面へ移す | 機能を 1 つも消さず、移動先ごとの改修が要らない | 節ナビが 8 項目になり画像より長い |
| qa-settings-decision-001 | 勘定科目と取引先を 1 つの表で扱い、種別の列を持つ | 勘定科目だけ / 取引先だけの表 | 表記ゆれの直し先が 1 か所になる | 説明パネルの『影響するもの』が種別で変わる |
| qa-settings-decision-006, 010 | 復元は設定 JSON もバックアップも設定だけで、差分プレビューと確認を挟む | 全データを戻す | 取引が消えず、戻す前に何が変わるかが見える | 全データの初期移行は『その他の管理』に別に残る |
| qa-settings-ui-ux-web-003 | 並べ替えに上下移動ボタンを併設し、状態は文字のバッジで示す | ドラッグだけ / 色だけ | ドラッグ無し・色覚に依らず操作と判別ができる (SC 2.5.7) | 行とバッジの幅を使う |
| qa-settings-ui-ux-web-004 | 375px で節ナビを上部横並び、説明パネルを表の下へ回す (agent 推定・利用者未確認) | 節ナビを隠してメニューに畳む | 節の数が一目で分かり、横スクロールを表に閉じられる | 行を選んでもパネルが画面外になりうる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web の静的配信。
- Migration sequence: (1)〜(3) 見出しと節ナビ → (4)(5) 集計ルールと説明パネル → (6)〜(8) 名義・統計・現金上書き → (12) 保存バーと下書き → (9)(10) データ・復元・バックアップ → (11) 既存機能の移設 → `docs/ui-decisions.md` と `design/FINAL-UI/spec/AUDIT.md` の更新。
- Rollback trigger/procedure: DOM テストか目視の確認で不具合が出たら web を直前版へ戻す。

## Risks and verification

- Risk/assumption: 375px で説明パネルを表の下へ回すと、行を選んでもパネルが画面外になる。選んだときにパネルへ移るかを `specs/spec-settings-screen.md` で決める。
- Risk/assumption: バックアップ表の日付は現行の R2 キー (UTC の日付) から作られ、JST 2:00 の実行では JST の日付と 1 日ずれうる。表示する日付の基準を仕様で固定する (`architecture/settings-infrastructure.md`)。
- Risk/assumption: 『その他の管理』に移す既存部品は内部で個別に保存しており、保存バーの未保存件数に入らない。節ごとに保存の単位が違うことを見出しか注記で示す。
- Architecture fitness test: 節ナビが 8 項目で画像の 6 節が先頭に並ぶこと。バッジに文字があること。直書き色が 0 件であること (`scripts/check-design-tokens.mjs`)。共通シェルの差分が無いこと。
- Load/failure/security validation: 集計ルールが上限行数でも表と説明パネルが動くこと。保存・復元の失敗で下書きが残ること。
