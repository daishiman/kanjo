---
graph_node_id: "arch-guide-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "使い方 — 問いの見出しの下に 4 ステップと元画面への戻り道を置き、総収支を実データで読み解かせ、信頼度は段階＋%・ヘッダは防衛ラインのまま・フッタは事実どおりにする"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "ui-ux"]
file_path: "architecture/guide-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "37aa1d855046a7d5b432aacf16f2c36fddccf269a12ab678d3f5139f71a78333"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "37aa1d855046a7d5b432aacf16f2c36fddccf269a12ab678d3f5139f71a78333", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-frontend", "arch-guide-backend", "arch-guide-database", "arch-guide-auth", "arch-guide-security", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Guide.tsx", "packages/web/src/pages/guide", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/glossary.ts", "packages/web/src/pages/Overview.tsx", "packages/web/src/pages/classify/TransactionTable.tsx", "design/FINAL-UI/images/19-guide.png"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/guide-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G1", "G2", "G4"]
---

# Architecture overview

使い方 — `/guide` を `19-guide.png` どおり、問いの見出し『この数字を、どう読み・どこへ戻ればよいですか？』の直下に 4 ステップ (取込む・整える・確認・計画) と『元画面を開く →』を置き、使い方ガイド (目次 6 項目＋『用語と目安』・月次の流れ・総収支の読み方・含まれるもの 3 枚・期間の表)・右カラム・よくある疑問 5 行・下部固定バーの順で見せる (qa-guide-ui-ux-web-002)。信頼度は『高 92%』のように段階を主・% を副にし (qa-guide-decision-008)、ヘッダは『防衛ライン：正常 / 注意 / 要対応』のまま (qa-guide-decision-010)、フッタ 1 文目は『取込データは外部送信しません』にする (qa-guide-decision-011)。`system-spec/ui-ux.md` は承認時入力、本書は情報の並び・表示の規則・共通シェルの文言の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 現行 `/guide` (`pages/Guide.tsx`、185 行) はベンチマーク表・略語・用語集の節表・データ充足度を縦に並べた辞書で、期間と連動しない。ヘッダは『防衛ライン：正常』(`components/Layout.tsx:430-449`、Term 付きの語は :434)、フッタ 1 文目は「アプリからは自動送信しません。AI実行時は確認した集計データを選択したAIへ渡します」(`Layout.tsx:498`)。信頼度は % と要確認の閾値 80 (`core/src/classify-status.ts:43`) で表示される。PageHeader 規約と直書き色の禁止は `display-contract.test.tsx:64-68` と `scripts/check-design-tokens.mjs` が課す (qa-guide-ui-ux-web-evidence-001)。
- Quality attribute priorities: G1・G2・G4 に資する。Information Design の『task 頻度 × 失敗コストで束に順位を付ける』を段の順序に適用する (ui-ux 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: Apple HIG の『状態を色だけで伝えない』(上流指針)。既存のトークン・共通部品。check-glossary (全用語が 1 画面以上で使われる)。

## Goals and non-goals

- Goals:
  - G1: 画像の全構成要素を描く。総収支の 3 枚と右カラムの数値は選択期間の実データで出す。
  - G2: 信頼度を段階＋% で見せ、防衛ラインの説明を算出 (直近 3 か月平均) どおりに書く (qa-guide-decision-009)。
  - G4: ヘッダは『防衛ライン』のまま、フッタ 1 文目を『取込データは外部送信しません』にし、AI 実行時に集計データを渡す補足をフッタの title・プライバシー欄・使い方画面の 3 か所に置く。
- Non-goals:
  - ヘッダの『取引ライン』化 (qa-guide-decision-010)
  - 防衛ラインの算出や表示値の変更 (qa-guide-decision-009)
  - サイドバーの並び・バッジ・月次クローズ進捗の変更
  - 利用規約・プライバシーの専用ページ

## System context and boundaries

- Users/external systems: 利用者のブラウザ。
- Trust/deployment/data boundaries: 画面は `/api/guide` の数値と core の定数の文言を描くだけ。フッタは共通シェル (`Layout.tsx`) の一部で全画面に出る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出しと期間 | タイトル・問いの見出し・説明、共通の期間と前後の矢印 | React | packages/web | Workers Assets |
| 4 ステップ | 取込む / 整える / 確認 / 計画 と『元画面を開く →』 | React | packages/web (文言は packages/core) | 同上 |
| 目次と本文 | 目次 7 項目、月次の流れ・総収支の読み方・含まれるもの・期間の表・用語と目安 | React | 同上 | 同上 |
| 右カラム | このページの数値 4 項目・関連ページ 5 件・ガイド内を検索 | React | 同上 | 同上 |
| よくある疑問 | 5 行 × 疑問 / データの出所 / 確認の条件 / 関連ページ | React | 同上 | 同上 |
| 下部固定バー | 現在のトピックと元画面へのボタン | React | packages/web | 同上 |
| 共通シェル (`Layout.tsx`) | ヘッダの防衛ライン、フッタの 1 文目と補足 | React | packages/web | 同上 |

## Cross-cutting contracts

- Identity/access: N/A: 表示の規則だけを扱う。認証は `architecture/guide-auth.md`。
- Errors/resilience: 数値の読み込みに失敗しても本文・目次・検索は読める。数値の枠に「取得できませんでした」と再読込を出す。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 秘密情報を持たない。
- Compatibility/versioning: 文言の変更はフッタ 1 文目とプライバシー欄の補足だけ。ヘッダの文言と防衛ラインの値は変えない。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

最も頻度が高い『画面の数字を見て、どこへ戻るか迷う』に応えるため、問いの見出しの直下に 4 ステップと『元画面を開く』を置き、下部固定バーからも現在のトピックの元画面へ 1 手で届くようにする。失敗コストが最も高い『総収支に振替や事業の支払いが混ざっていると誤読する』に応えるため、総収支の 3 枚を実データで出し、含まれるもの 3 枚を並べる。用語と目安は目次の末尾に下げる (qa-guide-decision-001)。

#### Routes, screens and navigation

4 ステップの行き先は 取込む→データ取込、整える→明細仕分け、確認→総収支、計画→予算。下部固定バーは 月次の流れ・総収支→総収支、照合→照合、仕分け→明細仕分け、予算→予算、データ出典→データ取込、用語と目安→収支分析 (qa-guide-ui-ux-web-003。いずれも agent 推定・利用者未確認)。関連ページは 総収支 / 明細仕分け / 照合 / 設定 / 収支分析 (画像どおり)。

#### Component and design-system boundaries

色はトークン、ボタンは共通 `Button`、ページは `components/Page.tsx` の PageShell と `PageHeader route="guide"`。状態を色だけで伝えない: 信頼度は段階の文字と %、ヘッダの防衛ラインは『正常 / 注意 / 要対応』の文字、ステッパーは完了の段に文字の印、純収支は符号。目次は幅 1024px 以上で左に固定、未満で本文の上の横スクロールのタブ (qa-guide-ui-ux-web-003、agent 推定・利用者未確認)。

#### State and data flow

文言 (節・ステップ・よくある疑問・期間の表・防衛ラインと信頼度の説明) は core の定数から、数値 (総収支・期間・最終更新・進捗) は `/api/guide` から描く。防衛ラインの説明は画像の『同期間の過去データとの比較で自動計算』を採らず、core の算出定数から『個人生活費の直近3か月平均＋事業固定費の平均』と組む (qa-guide-decision-009)。用語集の現行説明 (`glossary.ts:45-49`) も同じ定数から組む。

#### Backend integration

N/A: 本章の関心外 (`architecture/guide-backend.md`)。表示は `/api/guide` の応答の 5 項目と既存経路だけを使う。

#### Performance and observability

N/A: 本章の関心外 (`architecture/guide-frontend.md`)。

#### Frontend verification

DOM テストで 画像の全構成要素 (O1)、信頼度の『段階＋%』(O2)、ヘッダが『防衛ライン：正常』のまま (`common-shell.dom.test.tsx:154`)、フッタ 1 文目と 3 か所の補足 (O5) を確かめる。`common-shell.dom.test.tsx:182-185` の「外部送信しませんでは嘘になるので」のコメントと期待は、決定 011 に合わせて書き換える。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-guide-decision-008 | 信頼度を 3 段階＋% (高 80 以上 / 中 50〜79 / 低 49 以下、段階が主) で見せる | % だけ / 段階だけ | 画像と揃い、% の精度も失わない | 概況の 80/60 の色境界 (`Overview.tsx:209-210`) と衝突する (未決) |
| qa-guide-decision-009 | 防衛ラインの説明を算出どおりに書く | 算出を画像の過去年同月平均に変える | 数値を変えずに説明と計算を一致させる | 画像のよくある疑問の文言を採らない |
| qa-guide-decision-010 | ヘッダは『防衛ライン』のまま | 『取引ライン』へ変える | 用語集・予算・トレードオフと 1 語を保つ | 画像のヘッダと食い違う |
| qa-guide-decision-011 | フッタ 1 文目を『取込データは外部送信しません』にし、AI 送信の補足を 3 か所に置く | 現行文言のまま | 画像に合わせつつ事実を隠さない | common-shell のテスト更新が要る |
| qa-guide-decision-001 | 目次の末尾に『用語と目安』を置く | 用語集を別ページに分ける | 既存の辞書を失わず check-glossary を満たす | 目次が 7 項目になる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと Workers Assets。
- Migration sequence: 画面の骨格 → 本文の各節 → 右カラムとよくある疑問 → 下部固定バー → 信頼度の段階表示 → 共通シェルのフッタ。
- Rollback trigger/procedure: DOM テスト・`check:guide-screen`・直書き色の lint のどれかが赤なら差し戻す。

## Risks and verification

- Risk/assumption: 信頼度の色 (概況の 80/60) と段階 (80/50) が画面ごとに食い違うと、同じ % が画面で違う意味に見える。対象画面の列挙は requirements 段階の未決事項である。
- Risk/assumption: 診断画面 (`pages/analysis/diagnosis/ResultCards.tsx:33`) と AI 画面 (`pages/ai/AiContextAnalysis.tsx:22`) の「確度」は % を持たない列挙で、段階＋% の対象に含めるか未確定。
- Architecture fitness test: 直書き色 0、全用語の使用 (check-glossary)、PageHeader 規約 (`display-contract.test.tsx:64-68`)。
- Load/failure/security validation: 読込・失敗・検索 0 件の各状態を DOM テストで確かめる。
