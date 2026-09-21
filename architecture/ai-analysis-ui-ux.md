---
graph_node_id: "arch-ai-analysis-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "AI分析 — 一覧は依頼と実行中に絞り、依頼の詳細とレポートを専用経路へ分けて、依頼から版の比較までを辿れるようにする"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ai-analysis", "ui-ux"]
file_path: "architecture/ai-analysis-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "8d8e7d4342f36eec4744447668df09cecb29887de6b2649f7bd1eac2cb677829"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "5c6788a52947b35f54ae87183aa1e3e6f17ed9ff5e8ff0b86f3192ca418f7a06", "imported_at": "2026-09-19T13:11:57Z"}
created_at: "2026-09-19T13:11:57Z"
updated_at: "2026-09-19T13:11:57Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-frontend", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-auth", "arch-ai-analysis-security", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Ai.tsx", "packages/web/src/period.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/pages/subscriptions/SelectionBar.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/ai-analysis-ui-ux.md"}]
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

AI分析 — 一覧 (`/ai`) は 1.依頼と 2.実行中に絞り、依頼 1 件 (`/ai/tasks/:taskId`) とレポート (`/ai/reports`、`/ai/reports/:reportId`) を専用経路へ分けて、依頼から版の比較までを辿れるようにする。`system-spec/ui-ux.md` は承認時入力、本書は経路と段の順序・状態の見せ方・タブの振り分けの制約を持つ。文言と配置の逐語は spec-ai-analysis-screen の画面構成の節と文言の節。

## Context and drivers

- Business/technical context: 現行 `/ai` (`packages/web/src/pages/Ai.tsx`、1277 行) は独自の期間プリセット `PRESETS` (`Ai.tsx:53`) を持ち、依頼の状態は 結果待ち / 期限切れ / 受信済み の 3 値で、依頼番号・進捗・再実行が無い。結果の貼り付け欄は依頼カード (`RunCard`) ごとにあり、レポート詳細は目次 (`ReportToc`) つきの縦長 1 ページである。`12-ai.png` は問いの見出し・期間タブ・1.依頼 / 2.実行中 / 3.レポートの 3 段・下部の選択中バーを持ち、レポート詳細は 要約 / 根拠データ / 改善提案 / 関連リンク のタブと版履歴と『2つの版を比較』を持つ。画像の件数・日時・進捗はモックである (qa-ai-ui-ux-web-evidence-001)。
- Quality attribute priorities: G1・G3・G4 に資する。Information Design の『task 頻度 × 失敗コストで束に順位を付ける』を段の順序とタブの振り分けに適用する。WCAG 2.2 SC 1.4.1 (色だけで伝えない) を状態の見せ方に適用する。
- Constraints: 既存のデザイントークン・共通 `Button`・`PageShell` の上に組む。狭い画面は既存 web のレスポンシブ規約 (段の縦積み、表の横スクロール) の中で扱う。web のみ。

## Goals and non-goals

- Goals:
  - G1: `/ai` に 問いの見出し『AIに分析を依頼し、根拠と版を確認しますか？』と説明文、共通の期間タブ、1.依頼、2.実行中 を置き、依頼 1 件とレポートは専用経路へ分ける (`12-ai.png` の 3 段・選択中バーは、長文のレポートを一覧と同じ画面に載せない判断で置き換えた。2026-09-21 に利用者が承認)。
  - G3: 実行中の表の操作列に キャンセル / 詳細 / 再実行 / 削除 を置き、段階に応じて出し分ける。
  - G4: 取り込みを結果待ちの依頼の詳細へ置き、レポートを問い順の 5 タブ (要約 / 根拠データ / 背景仮説 / 改善提案 / 関連リンク) に振り分け、版履歴に補足指示の 1 行目を説明として出す。
- Non-goals:
  - 画像のモックの件数・日時・進捗の再現
  - スマートフォン・タブレット・デスクトップ向け専用アプリ
  - レポート JSON の見出し構成の変更

## System context and boundaries

- Users/external systems: 利用者 (web)。依頼の文面はコピーで外部のエージェントへ渡る。
- Trust/deployment/data boundaries: 画面は api が返す段階・進捗・T-番号・版の説明を描くだけで、判定を持たない (`architecture/ai-analysis-frontend.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出しと期間タブ | 問いの見出し・説明文・1年 / 2年 / 3年 / 任意と範囲の送り | `PageShell` + `PeriodPicker` | packages/web | Workers Assets |
| 1.依頼 | 補足指示 0/1000 と下書き自動保存、Claude Code 用 / Codex 用のコピー、使用するデータのカードと注記 | React | packages/web | 同上 |
| 2.実行中の表 | ID・ステータス・依頼期間・作成日時・進捗・依頼内容・操作 | React | packages/web | 同上 |
| 依頼の詳細 (`/ai/tasks/:taskId`) | 依頼 1 件の段階・進捗・操作、結果の取り込み、完了ならレポートの表示 | React | packages/web | 同上 |
| レポート一覧 (`/ai/reports`) | 一覧の検索とアーカイブ表示 | React | packages/web | 同上 |
| レポートの詳細 (`/ai/reports/:reportId`) | 5 タブ・版履歴・版比較・アーカイブ | React | packages/web | 同上 |

## Cross-cutting contracts

- Identity/access: N/A: 本章は見せ方の関心 (`architecture/ai-analysis-auth.md`)。
- Errors/resilience: 各段に読込・空・失敗の状態を持つ。取り込みの構文エラーは『10行目で不正な文字があります。入力内容は保持されています』の形で行と位置を文で示し、入力を消さない。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 秘密情報を持たない。
- Compatibility/versioning: 既存のレポート (受信済み・アーカイブ済み・版つき) を新しいタブで読めるようにする (S6)。連番の無い旧依頼は ID 欄に『旧』と作成日を出す。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

`/ai` は 1.依頼 → 2.実行中 の 2 段を縦に並べる。最も頻度が高い『依頼をコピーして AI に渡す』を最上段に置き、渡すデータの件数と『データは自動送信されません』の注記をコピーボタンの隣に置く (外へ出るものを確かめずにコピーする失敗コストが高い)。次に頻度が高い『今どこまで進んだか』は実行中の表で見せ、依頼を押すとその依頼の詳細で段階・進捗・次にすることを読む。長文のレポートは一覧と目的が違うため専用経路へ分け、読み返しは『保存済みレポート』から入る。

#### Routes, screens and navigation

経路は `/ai`、`/ai/tasks/:taskId`、`/ai/reports`、`/ai/reports/:reportId` の 4 つ。依頼とレポートはパスで表し、最新20件外のtaskも `/ai/tasks/:taskId` で開ける。検索パラメータに持つのはレポートのタブ (`tab`、要約のときは付けない) と、改訂の下書きに渡す `reanalyze` / `mode` だけ。取り込み先の既定は 実行中 → 待機中 → 最新の完了。一覧の検索はレポート名・要約内容・対象期間の部分一致。タイトル横の「AI分析の使い方」は画面内手順を開く。

#### Component and design-system boundaries

ステータスには文字を添え、進捗は共通部品で数値%と棒を示す。表の行全体はクリック・Enter・Spaceで選択できる。色はトークン、ボタンは共通 `Button`。`AiReportDetail` から版履歴・比較を独立部品へ分ける。

#### State and data flow

タブは問い順に振り分ける。要約 = 総評・主な発見・次に取るべきアクション (上位 3 件の次の一手)、根拠データ = 図表・5 節・データ不足、改善提案 = 要点 3 分類・前回の指摘、関連リンク = 必要な情報と各画面へのリンク。要約タブの下には関連ページへのリンクと版履歴を常に出す (qa-ai-decision-008)。版の説明は補足指示の 1 行目、無ければ v1『初回レポート』・v2 以降『最新のデータで再分析』(qa-ai-decision-007)。振り分けと説明は core が決め、画面は描くだけ。

#### Backend integration

取り込み先は選択中の依頼で、結果待ちが 1 件だけなら自動で選び、無ければ取り込みボタンを無効にする (qa-ai-decision-005)。使用するデータのカードは対象期間・freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数を出し、『使用データを確認』で既存のデータセット表示を開く (qa-ai-decision-004)。操作の可否は段階で決まり、削除は結果の無い依頼だけに出す (qa-ai-decision-003)。各操作の出し分けは spec-ai-analysis-screen の操作の節に従う。

#### Performance and observability

N/A: 本章は見せ方の関心で、読み込みの予算は `architecture/ai-analysis-frontend.md` に従う。

#### Frontend verification

DOM テストで見出しと `/ai` の 2 段の描画、依頼の詳細とレポート専用画面への遷移、ステータスの文字、進捗の % と棒、取り込みエラーの文と入力の保持、タブごとの内容、版比較の既定 (選択中の版と 1 つ前、v1 では比較ボタンを無効、agent 推定・利用者未確認、根拠 qa-ai-ui-ux-web-003) を確かめる。旧プリセット (月 / 四半期 / 13か月 / 5年) が画面に無いことを確かめる (S1)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ai-ui-ux-web-001 | 一覧は 1.依頼 + 2.実行中 に絞り、依頼 1 件とレポートを専用経路へ分ける (2026-09-21 に利用者が承認。旧: `12-ai.png` の 3 段と選択中バー) | `12-ai.png` どおりの 3 段と選択中バー、現行の依頼カードの縦並び | 一覧と長文の読み物で目的が違い、URL で再訪・共有できる | 取り込み欄は依頼の詳細に 1 つ、レポートは別 URL になる |
| qa-ai-decision-008 | タブを問い順に振り分ける | 目次つきの縦長 1 ページ | 何が分かったか → 根拠 → すべきこと → 手を打つ場所の順に読める | 5 節は根拠データのタブに入る |
| qa-ai-decision-005 | 取り込み先を、開いている結果待ちの依頼にする | 依頼ごとの貼り付け欄 | 欄が 1 つになり、取り込み先を取り違えにくい | 取り込み先が無いときはボタンを無効にする |
| qa-ai-decision-007 | 版の説明を補足指示の 1 行目から作る | レポート JSON に説明を足す | 契約と skill を変えずに版の違いを示せる | 補足指示が無い版は既定文になる |
| qa-ai-ui-ux-web-003 | 既定の選択・版比較・検索対象を決める (agent 推定・利用者未確認) | 選択なしで開く | 開いた直後に見るべき依頼が出る | 規則を docs と DOM テストで固定する |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと Workers Assets。
- Migration sequence: 見出しと期間タブ → 1.依頼 → 2.実行中の表と操作 → 依頼の詳細と結果の取り込み → レポート一覧 → レポートの詳細のタブ・版履歴・版比較。
- Rollback trigger/procedure: DOM テストが落ちたら差し戻す。保存データは変わらない。

## Risks and verification

- Risk/assumption: 状態を色だけで示すと色覚に依らず読めない。文字と数値を必ず添え、DOM テストで文字の存在を確かめる。
- Architecture fitness test: 画面に独自の期間プリセットが無いこと。色の直書きが無いこと (lint)。
- Load/failure/security validation: 狭い画面で段が縦に積まれ、実行中の表が横スクロールになることを既存のレスポンシブ規約の検査で確かめる。
