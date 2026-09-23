---
graph_node_id: "arch-import-screen-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "データ取込 — 選択・一覧・内容確認・結果・履歴の 5 段を問いの見出しの下に並べ、取り込む前に何が入るかを必ず見せる"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["import-screen", "ui-ux"]
file_path: "architecture/import-screen-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f14062b5b29edd57c4d2b9795cf43de5db309be4bcb263dc47cab8187ed1b26e"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "f14062b5b29edd57c4d2b9795cf43de5db309be4bcb263dc47cab8187ed1b26e", "imported_at": "2026-09-21T22:53:09Z"}
created_at: "2026-09-21T22:53:09Z"
updated_at: "2026-09-21T22:53:09Z"
depends_on: ["spec-import-screen"]
related_nodes: ["arch-import-screen-frontend", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-auth", "arch-import-screen-security", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Import.tsx", "packages/web/src/pages/import", "packages/web/src/components/ImportDeletion.tsx", "packages/web/src/period.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/pages/Import.dom.test.tsx", "packages/web/src/pages/import/import-screen.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/import-screen-ui-ux.md"}]
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

データ取込 — 選択・一覧・内容確認・結果・履歴の 5 段を問いの見出しの下に並べ、取り込む前に何が入るかを必ず見せる。`system-spec/ui-ux.md` は承認時入力、本書は画面の構成・状態の見せ方・段の順序の制約を持つ。表示の正本は `specs/spec-import-screen.md` (spec-import-screen) の UI・状態遷移の節と、画像 `design/FINAL-UI/images/16-import.png`。

## Context and drivers

- Business/technical context: 作り直し前の /import は `packages/web/src/pages/Import.tsx` の 1 ファイル (897 行) で、画像の 5 節構成と履歴詳細ペインを持たず、MF だけ別の差分 UI を出していた (qa-imp-ui-ux-web-evidence-001)。現行は `pages/import/` に 5 節・履歴詳細・選択中バーを分割し、差分 UI とその再送経路は新画面から削除した。
- Quality attribute priorities: G1〜G6 に資する。Information Design card の『task 頻度 × 失敗コストで束に順位を付ける』を段の順序に、Apple HIG の『状態を色だけで伝えない』をステータス・重複・バリデーション・結果カードに適用する。
- Constraints: 共通シェル (`packages/web/src/components/Layout.tsx` のヘッダーの防衛ライン、フッターの文言) は変えない。既存のデザイントークン・共通 Button・PageShell の上に組む。対象は freee と マネーフォワードの CSV で、案内から『銀行』を外す (qa-imp-decision-001)。

## Goals and non-goals

- Goals:
  - G1: 問いの見出し『複数の明細ファイルを、安全に取り込みますか？』・期間タブ・対象期間カード・3 段のステッパー (ファイル選択 / 内容確認 / 取込結果) と 1〜5 の節、下部の選択件数バーを画像どおりに描き、読込・空・失敗の各状態を持つ。
  - G2: 1.選択の直後に 3.取込内容の確認 (対象ファイル数と取込可能数・予定明細数・対象期間・影響する取込元・重複の可能性・サブスク候補・エラーのファイルは除外される注記) を常に見せ、取り込むボタンの手前に置く (qa-imp-decision-003)。
  - G5: 取込履歴を 1 回の取込 = 1 つの検査 ID = 1 行で見せ、詳細ペインに影響の 3 数値 (新規追加・重複スキップ・サブスク候補) を出す (qa-imp-decision-004・-005)。
  - G6: 上限を超えるファイルは送る前に取込不可として理由 (25MB 超・10 ファイル超・合計 30MB 超) を出す。数値は core の 1 か所の結果を描くだけにする。
- Non-goals:
  - 共通シェル (ヘッダー・フッター) の変更
  - 銀行・クレジットカードの明細の直接取込 (qa-imp-decision-001)
  - 画像の件数・ファイル名・日時をそのまま期待値にすること (画像はモック)

## System context and boundaries

- Users/external systems: 利用者 1 人 (個人事業主)。freee と マネーフォワードから書き出した CSV・Excel・txt と、既存の ZIP・JSON 復元・MF 資産推移を持ち込む。
- Trust/deployment/data boundaries: 画面は api が返す core の導出結果 (ファイルの状態・検証の段階・取込可否・要約・結果) と、core の上限値の判定結果を描くだけで、判定を持たない。部品の配置と状態の置き場所は `architecture/import-screen-frontend.md`。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 問いの見出し・期間タブ・対象期間カード | 画面の問いと対象期間を示す | React | packages/web (period.tsx の既存部品) | Workers Assets |
| ステッパー | ファイル選択 / 内容確認 / 取込結果の現在位置を文字と番号で示す | React | packages/web | Workers Assets |
| 1.ファイルを選択 | ドラッグ&ドロップ・選択ボタン・対応形式・freee と MF の取得方法の案内・詳細設定 (強制再取込・前回データを残す=既定オン)・上限の注記 | React | packages/web | Workers Assets |
| 2.取込ファイル一覧 | # / ファイル名 / 取込元 / 対象期間 / ファイルサイズ / 重複チェック / バリデーション / ステータス / 操作 の 9 列 | DataTable | packages/web | Workers Assets |
| 3.取込内容の確認 | 要約 6 項目と除外の注記 | React | core の要約の結果 | Workers Assets |
| 4.取込結果 | 成功 / 失敗 / 重複の可能性 / サブスク候補の 4 枚カードと次の行き先 | React | core の結果 | Workers Assets |
| 5.取込履歴と詳細ペイン | 1 回 1 行の 7 列と、影響の 3 数値・原本・再取込・取り消し | DataTable と詳細ペイン | api の取込 1 回の記録 | Workers Assets |
| 下部の選択中バー | 選択中ファイル数・取込可能数・エラー数・選択をキャンセル・N ファイルを取り込む | React | 画面の状態 | Workers Assets |

## Cross-cutting contracts

- Identity/access: 画面は既存のセッションの内側にあり、本人の検査と履歴だけを描く (`architecture/import-screen-auth.md`)。
- Errors/resilience: 413 と 429 は上限と待ち時間 (Retry-After) を文言で出す。取込可能が 0 件のとき取り込むボタンは押せない。読込・空・失敗の状態を各節が持つ。
- Observability/audit: N/A: 新しい信号を足さない。取込 1 回の記録と影響の 3 数値が利用者向けの監査の役を兼ねる。
- Configuration/secrets: N/A: 画面は設定と秘密情報を持たない。上限の注記の数値は core の `IMPORT_LIMITS` (新設) から描く。
- Compatibility/versioning: /import の URL は変えない。選択中の履歴は URL の検索パラメータに持ち、再読み込みで同じ詳細が開く。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成 (画面構成と状態の見せ方の観点)
- Backend: N/A: 本章の関心外 (`architecture/import-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/import-screen-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/import-screen-database.md`)
- Security: N/A: 本章の関心外 (`architecture/import-screen-security.md`)

### Frontend architecture

#### Rendering and application pattern

既存の SPA (React) のまま、/import の画面を問いの見出し → 期間 → ステッパー → 1〜5 の節 → 下部バーの順に縦へ積む。狭い画面では段を縦に積んだまま、2.一覧と 5.履歴の表は横スクロールにする (qa-imp-ui-ux-web-004)。

#### Routes, screens and navigation

経路は /import の 1 つ。4.取込結果の『重複の可能性』カードは総収支画面、『サブスク候補』カードはサブスク画面へのリンクを持ち、『エラーのファイルのみ再試行』は同じ検査 ID へのファイル追加に進む。5.履歴で選んだ行は URL の検索パラメータに持つ。

#### Component and design-system boundaries

ボタンは共通 Button、表は DataTable、ページは PageShell、色はデザイントークンだけを使う。ステータスは 5 種 (アップロード中 n% / 検査中 / 取込準備完了 / 取込不可 / 取込済み) を文字とアイコンで併記し、重複チェックは『なし / n 件 / 取込済みと同一』、バリデーションは『OK / 警告 n / エラー n』と書く。色だけに頼らない (Apple HIG・WCAG 2.2 use of color)。操作はアップロード中=キャンセル、準備完了=削除、取込不可=再試行と削除 (qa-imp-ui-ux-web-004、agent 推定)。

#### State and data flow

画面の各節は、api が返す検査結果 (検査 ID とファイルごとの項目) と core の要約・結果を読んで描く。ステップの現在位置は検査の有無と確定の有無から決まり、画面で別に保存しない。状態の置き場所 (TanStack Query・URL・画面の状態) は `architecture/import-screen-frontend.md`。

#### Backend integration

検査は複数ファイルを 1 要求で送り、1 つの検査 ID とファイルごとの項目を受ける。確定は検査 ID と取り込むファイル項目 ID と詳細設定を送り、ファイルを再送しない (qa-imp-decision-003・-005)。取込不可のファイルの再試行と後からの追加は同じ検査 ID へ足し、送る前に既存の項目と合わせた累計 (10 ファイル・合計 30MB) を core の判定関数で判定して、超えるときは追加せずに理由を出す (qa-imp-decision-008)。

#### Performance and observability

アップロード中はファイルごとの進捗を数値の % で出す。画面は遅延読み込みのままにし、初期 JS 予算を超えない (`architecture/import-screen-maintenance-ops.md`)。

#### Frontend verification

DOM テストで、問いの見出し・期間タブ・対象期間カード・ステッパー 3 段・1.選択 (ドロップ領域・選択ボタン・対応サービス 2 件・詳細設定 2 項目)・2.一覧の 9 列・3.要約の 6 項目と除外の注記・4.結果の 4 枚のカード・5.履歴の 7 列と詳細ペイン・下部の選択件数バーが描かれ、読込・空・失敗の状態が緑であることを確かめる (O1)。案内に『銀行』が無いこと、ステータスが文字を持つことも確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-decision-003 | 検査と確定を分け、3.内容確認を取り込むボタンの手前に常に見せる | 選んだら即時に書き込む (現行) | 何が入るかを確かめずに取り込む失敗を防ぐ | 検査の仮置きと確定の 2 要求になる |
| qa-imp-decision-004 | 履歴は 1 回の取込で 1 行、一括削除は記録だけ | ファイル単位の行 (現行) | 複数ファイルの取込を 1 つの出来事として追える | 詳細ペインで含まれるファイルを出す |
| qa-imp-decision-002 | 詳細設定『前回データを残す』は既定オン (行単位の追加) | 既定オフ・月単位の入れ替え | 画像の既定と意味に合わせる | オフのときの月単位の入れ替えの説明を添える |
| qa-imp-decision-001 | 案内は freee と マネーフォワードだけにし『銀行』を外す | 画像どおり銀行を残す | 取り込めない取込元を案内しない | 画像との差を仕様書に記録する |
| qa-imp-ui-ux-web-004 | 上限の注記と超過の理由は core の判定結果を描くだけにする (agent 推定) | 画面に数値と判定を書く | web と api の判定が食い違わない | 注記の文言は core の定数から組む |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web のビルドと Workers Assets の配信。
- Migration sequence: core の状態・要約・上限の導出 → 検査と確定の api → 画面の 5 段と下部バー → 履歴の 1 回 1 行と詳細ペイン → 旧来の即時取込の導線を外す。
- Rollback trigger/procedure: DOM テストが落ちたら web の配信を戻す。api の新しい経路は旧画面から呼ばれないだけで壊れない。

## Risks and verification

- Risk/assumption: 画像のモックの件数・ファイル名を期待値にすると、実データで常に落ちるテストになる。期待値の正本は仕様書のフィクスチャにする。
- Architecture fitness test: web の取込画面にステータスの文字列比較や上限の数値リテラルが無いこと (`architecture/import-screen-maintenance-ops.md` の字面検査)。
- Load/failure/security validation: ファイル名に含めた HTML がテキストとして描かれること (`architecture/import-screen-security.md`)。
