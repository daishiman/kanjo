---
graph_node_id: "arch-cash-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "現金入力 — 入力 2 枚と一覧を 17-cash.png の順に並べ、削除は行内確認と『元に戻す』で取り返せるようにする"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "ui-ux"]
file_path: "architecture/cash-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "5818a2ca9eda2ad5eca982405969af14a8ecb9211416f162b7aecc1a967d2e47"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "5818a2ca9eda2ad5eca982405969af14a8ecb9211416f162b7aecc1a967d2e47", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-frontend", "arch-cash-backend", "arch-cash-database", "arch-cash-auth", "arch-cash-security", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Cash.tsx", "packages/web/src/pages/cash", "packages/web/src/period.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/DataTable.tsx", "design/FINAL-UI/images/17-cash.png"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/cash-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G1", "G2"]
---

# Architecture overview

現金入力 — `/cash` を `17-cash.png` の順 (問いの見出し → 期間と対象期間カード → 通常入力 / 交通費入力のタブ → 入力 → 一覧 → 下部固定の追加バー) に並べ直し、削除を行内の確認とトーストの『元に戻す』で取り返せる操作にする。`system-spec/ui-ux.md` は承認時入力、本書は段の順序・状態の見せ方・削除と復元の見せ方の制約を持つ。文言と配置の逐語は spec-cash-screen の画面構成の節と文言の節。

## Context and drivers

- Business/technical context: 現行 `/cash` (`packages/web/src/pages/Cash.tsx`、724 行) は 1 ファイルに入力・交通費・一覧を持ち、担当者・業務の目的・下書き・元に戻すが無い。削除は物理削除で取り返せない (qa-cash-security-web-evidence-001)。`17-cash.png` は見出し『現金と交通費を、漏れなく記録しますか？』と説明、期間タブと対象期間カード、通常 / 交通費タブ、入力欄、一覧、下部固定の追加バーを持つ。画像の金額・件数・日付はモックである。
- Quality attribute priorities: G1・G2 に資する。Information Design の『task 頻度 × 失敗コストで段に順位を付ける』を段の順序に適用する (agent 推定・利用者未確認、design_applications)。WCAG 2.2 SC 1.4.1 (色だけで伝えない) を収支と削除中の見せ方に適用する。
- Constraints: 既存のデザイントークン・共通 `Button`・`PageShell`・`DataTable` の上に組む。狭い画面は既存 web のレスポンシブ規約 (段の縦積み、表の横スクロール) の中で扱う。web のみ (qa-cash-target-platforms-001)。

## Goals and non-goals

- Goals:
  - G1: `17-cash.png` の構成要素 (領収書欄を除く) をすべて描く。通常入力は 日付・事業/個人ラジオ・収支ラジオ・金額・内容・カテゴリ・担当者 (=名義)・メモ 0/200・『入力をクリア』・『現金明細を追加』・下書き保存時刻。交通費入力は 出発駅・到着駅・入替・片道運賃・往復・合計金額・業務の目的・メモ・『交通費として追加』。一覧は 月送り・キーワード・収支 / カテゴリ / 担当者 / 取込元の絞り込み・詳細検索・収入 / 支出 / 差額の合計・選択と一括削除・編集 / 削除・ページング (qa-cash-ui-ux-web-001)。
  - G2: 削除は行内で確認し、トーストの『元に戻す』で同じ行を戻す。入力途中の内容は下書きとして保存時刻を示す。
- Non-goals:
  - 領収書の添付・保管 (『領収書は freee に保管してください』と案内する。qa-cash-decision-001)
  - 画像のモックの金額・件数・日付の再現
  - スマートフォン・タブレット・デスクトップ向け専用アプリ

## System context and boundaries

- Users/external systems: 利用者 (web)。領収書は freee 側で保管し、本画面は案内文だけを持つ。
- Trust/deployment/data boundaries: 画面は core の cash-screen が導いた合計・絞り込み・ページ・入力経路・交通費合計を描くだけで、判定を持たない (`architecture/cash-frontend.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出しと期間 | 問いの見出し・説明文・1年 / 2年 / 3年 / 任意と対象期間カード | `PageShell` + `PeriodPicker` | packages/web | Workers Assets |
| 入力タブ | 通常入力 / 交通費入力の切替 | React | packages/web | 同上 |
| 通常入力 | 日付・事業/個人・収支・金額・内容・カテゴリ・担当者・メモ・クリア・追加・下書き保存時刻 | React | packages/web | 同上 |
| 交通費入力 | 出発駅・到着駅・入替・片道運賃・往復・合計・業務の目的・メモ・追加 | React | packages/web | 同上 |
| 現金明細の一覧 | 月送り・検索・4 種の絞り込み・詳細検索・合計・選択・編集 / 削除・ページング | `DataTable` | packages/web | 同上 |
| 下部固定の追加バー / トースト | 追加の主操作、削除と一括削除の『元に戻す』 | `ResultNotices` | packages/web | 同上 |

## Cross-cutting contracts

- Identity/access: N/A: 本章は見せ方の関心 (`architecture/cash-auth.md`)。
- Errors/resilience: 各段に読込・空・失敗の状態を持つ。入力検証のエラーは欄の近くに文で示し、入力を消さない。削除の失敗はトーストで示し、行を一覧に残す。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 秘密情報を持たない。
- Compatibility/versioning: 既存行 (owner が NULL) は担当者欄に『未設定』と出す (qa-cash-database-web-003、agent 推定・利用者未確認)。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

段は `17-cash.png` の順に縦に並べる。最も頻度が高い『今日使った現金を 1 件入れる』を最上段の入力に置き、次に『入れた記録を確かめる』一覧を置く。追加の主操作は下部固定バーにも置き、長い一覧を下へ読み進めた後でも入力へ戻らずに追加できるようにする。失敗コストが最も高い削除は行内で確認し、確定後もトーストの『元に戻す』で取り返せる (qa-cash-decision-003)。

#### Routes, screens and navigation

経路は `/cash` の 1 つで、ルート定義は `packages/web/src/routeMetadata.ts:33-44` (id `cash`) のまま。タブ・月・絞り込み・ページは URL の検索パラメータに持ち、再読込と共有で同じ表示に戻る (`architecture/cash-frontend.md`)。月送りは共通期間の範囲を越えない (qa-cash-ui-ux-web-003、agent 推定・利用者未確認)。

#### Component and design-system boundaries

収支は色に加えて『収入』『支出』の文字と符号で示す。削除中の行は一覧から外し、トーストに件数と『元に戻す』を文で示す。一括削除も 1 つのトーストで全件を戻す (qa-cash-ui-ux-web-003、agent 推定・利用者未確認)。トーストの表示時間は `ResultNotices` の既定に従う (同、agent 推定・利用者未確認)。色はトークン、ボタンは共通 `Button`。

#### State and data flow

1 ページは 20 件 (qa-cash-ui-ux-web-003、agent 推定・利用者未確認)。業務の目的の候補は『客先訪問』『打ち合わせ』『仕入れ・買い出し』『研修・セミナー』『その他 (40 字)』(同、agent 推定・利用者未確認)。担当者の既定は事業なら business、個人なら未選択 (qa-cash-database-web-003、agent 推定・利用者未確認)。合計・絞り込み・ページ・入力経路は core が決め、画面は描くだけ。

#### Backend integration

削除・復元・一括削除・一括復元はそれぞれ `DELETE /api/cash-entries/:id`、`POST /api/cash-entries/:id/restore`、`POST /api/cash-entries/bulk-delete`、`POST /api/cash-entries/bulk-restore` を呼ぶ (qa-cash-decision-006)。『元に戻す』は削除で返った id をそのまま復元へ渡す。

#### Performance and observability

N/A: 本章は見せ方の関心で、読み込みの予算は `architecture/cash-frontend.md` に従う。

#### Frontend verification

DOM テストで 見出しと各段の描画、領収書の案内文、担当者の『未設定』、行内の削除確認、トーストの『元に戻す』で行が戻ること、一括削除が 1 つのトーストで戻ること、収支の文字表示を確かめる。空状態は画面内だけのサンプル表示と『はじめての明細を入力』を出し、サンプルは保存も集計もされない (qa-cash-ui-ux-web-001 / 003)。描画は `check:cash-screen` で確かめる (`architecture/cash-maintenance-ops.md`)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-cash-ui-ux-web-001 | 段を `17-cash.png` の順に並べ、下部固定の追加バーを置く | 現行の 1 ファイル・入力と一覧の並び | 頻度の高い入力が最上段、長い一覧の後でも追加できる | 入力欄が 2 か所 (段と下部バー) から届く |
| qa-cash-decision-001 | 領収書欄の代わりに『領収書は freee に保管してください』と案内する | 領収書の添付欄を作る | 保管の正本を freee に一本化し、ファイルを受け取らない | 画像の領収書欄は描かない |
| qa-cash-decision-003 | 削除は行内確認 + トーストの『元に戻す』 | 確認ダイアログ + 物理削除 | 誤削除を取り返せ、確認の手間が小さい | API に復元経路が要る |
| qa-cash-ui-ux-web-003 | 20 件 / ページ・業務の目的の候補・一括の 1 トースト・月送りの範囲 (agent 推定・利用者未確認) | 件数や候補を画面ごとに変える | 既存画面と揃い、テストで固定できる | 規則を DOM テストで固定する |
| qa-cash-decision-002 | 担当者を名義 (owner) として出す | 担当者を自由入力にする | 既存の名義の語彙 (business / spouse / family) と揃う | 既存行は『未設定』になる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと Workers Assets。
- Migration sequence: 見出しと期間 → タブと通常入力 → 交通費入力 → 一覧と合計 → 削除確認とトースト → 空状態と下部固定バー。
- Rollback trigger/procedure: DOM テストか `check:cash-screen` が落ちたら差し戻す。保存データは変わらない (論理削除中の行は API 側で扱う)。

## Risks and verification

- Risk/assumption: 収支や削除中を色だけで示すと色覚に依らず読めない。文字と符号を必ず添え、DOM テストで文字の存在を確かめる。
- Risk/assumption: 20 件・業務の目的の候補・トースト時間は agent 推定・利用者未確認で、利用者の確認で変わり得る。値は core と画面の定数 1 か所に置く。
- Architecture fitness test: 画面に独自の期間プリセットが無いこと。色の直書きが無いこと (lint)。
- Load/failure/security validation: 狭い画面で段が縦に積まれ、一覧が横スクロールになり、下部固定バーが入力を覆わないことを既存のレスポンシブ規約の検査で確かめる。
