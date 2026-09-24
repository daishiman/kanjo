---
graph_node_id: "arch-improvement-screen-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "改善リクエスト — 上段に作成フォーム・下段に一覧と詳細の 2 ペインを置き、プライバシー確認 2 つとマスク対象の説明を送信の直前に、削除は『元に戻す』で取り返せるようにする"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement-screen", "ui-ux"]
file_path: "architecture/improvement-screen-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f228e7ca1ac08da4fb84742c5cf44eee0c152ab5f700cee69f9f4b75f48dc674"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "f228e7ca1ac08da4fb84742c5cf44eee0c152ab5f700cee69f9f4b75f48dc674", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Improvement.tsx", "packages/web/src/pages/improvement", "packages/web/src/components/ImprovementRequestButton.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Page.tsx", "design/FINAL-UI/images/20-improvement.png"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/improvement-screen-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:47:00Z"}
serves_goals: ["G1", "G2"]
---

# Architecture overview

改善リクエスト — `/improvement` を `20-improvement.png` どおり、問いの見出しと説明・使い方リンク・共通の期間の下に、上段の作成フォームと下段の一覧・詳細の 2 ペインを置く。狭い幅では縦に積む (qa-imp-ui-ux-web-001)。失敗コストが最も高い『個人情報を含んだまま送る』には、プライバシー確認 2 つとマスク対象の説明を送信ボタンの直前に置いて応える。2 つとも付けなければ送れない。次に高い『誤って消す』には、完了トーストの『元に戻す』で応える。状態は受付 / 対応中 / 完了 / 再確認の 4 つで、色に加えて必ず文字で示す (qa-imp-decision-001)。`system-spec/ui-ux.md` は承認時入力で、本書は段の順序・状態の見せ方・送信を止める理由と削除の見せ方の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 現行 `/improvement` (`packages/web/src/pages/Improvement.tsx`、255 行) は見出しが『改善要望』(:87) で、一覧と詳細だけを持つ。投稿は `components/ImprovementRequestButton.tsx` (374 行) の `<dialog>` モーダルで、件名 120 字と本文 4000 字を入力する。一覧に検索・状態別の件数タブ・ページングが無く、詳細にアクティビティ・関連する依頼・削除も無い。プライバシー確認とマスク対象の説明も無い。タブ名は `routeMetadata.ts:385` の『改善要望 | Focus Ledger』。`20-improvement.png` は問いの見出し・作成フォーム・一覧・詳細パネル・キャプチャの浮動パネル・選択中バー・コピー完了トーストを 1 画面に並べている (qa-imp-ui-ux-web-evidence-001)。
- Quality attribute priorities: G1・G2 に資する。Information Design の『task 頻度 × 失敗コストで束に順位を付ける』を段の順序に適用する (ui-ux 章の本章での適用。agent 推定・利用者未確認)。WCAG 2.2 の Use of Color と Apple HIG の『状態を色だけで伝えない』を、状態・件数タブ・送信不可の理由・削除とコピーの結果の見せ方に適用する。
- Constraints: 既存のトークンと共通部品の上に組む。直書き色の lint を 0 件に保つ (S1)。web のみ (qa-imp-decision-005)。共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) は変えず、画像の文言を期待値にしない (U7 対象外)。

## Goals and non-goals

- Goals:
  - G1: 画像の構成要素をすべて描く。作成フォーム (スクリーンショット任意と撮り直し / 削除、本文 0/1000、プライバシー確認 2 つ、自動マスキングの対象の説明、送信)、一覧 (ID・内容・関連ページの検索、すべて / 受付 / 対応中 / 完了 / 再確認の件数タブ、選択、ID・関連ページ・概要・状態・作成日・更新日の表、10 件ずつのページング)、詳細パネル (IMP 番号と状態、本文、添付画像と拡大、マスク済み診断情報、アクティビティ、関連する依頼、状態の変更・再発行・Claude Code 用 / Codex 用のコピー・削除)、空状態、読み込み失敗と再読み込み、キャプチャの浮動パネル (キャプチャする・範囲を選択する)、選択中バー、コピー完了トーストである。
  - G2: 送る前に何が伏せられるかを、送信ボタンの直前の説明で利用者が確かめられるようにする。撮影画像は伏字にした状態でフォームに出す (伏字の規則は `architecture/improvement-screen-security.md`)。
- Non-goals:
  - 共通シェルの文言の変更 (U7 対象外)
  - 関連する依頼の手動紐付け (qa-imp-decision-006)
  - 件名欄 (廃止。概要は本文の先頭行から core が切り出す。qa-imp-decision-002)
  - モバイル・タブレット・デスクトップ専用アプリ (qa-imp-decision-005)

## System context and boundaries

- Users/external systems: 利用者 (SH1) と、指示文をコピーして Claude Code / Codex に渡す開発兼運用者 (SH2)。撮影はブラウザの中で終わり、画面を外部へ送らない (C4)。
- Trust/deployment/data boundaries: 画面は core の improvement-screen が導いた状態・概要・IMP 番号・件数・ページ・関連・アクティビティ・診断要約を描くだけで、判定を持たない (`architecture/improvement-screen-frontend.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出しと期間 | 問いの見出し・説明・使い方リンク、共通の期間 | React | packages/web | Workers Assets |
| 作成フォーム | 画像の枠 (撮り直し / 削除)・本文 0/1000・プライバシー確認 2 つ・マスク対象の説明・送信 | React | packages/web | 同上 |
| 一覧 | 検索・5 つの件数タブ・選択・6 列の表・10 件ずつのページング | React | packages/web (導出は packages/core) | 同上 |
| 詳細パネル | IMP 番号と状態・本文・添付画像と拡大・診断要約・アクティビティ・関連する依頼・操作 | React | 同上 | 同上 |
| キャプチャの浮動パネル | 『キャプチャする』『範囲を選択する』 | React (右下の『改善を送る』から開く) | packages/web | 同上 |
| 選択中バー / トースト | 選択中の件数と操作、削除の『元に戻す』、コピー完了 | React | packages/web | 同上 |

## Cross-cutting contracts

- Identity/access: N/A: 本章は見せ方の関心 (`architecture/improvement-screen-auth.md`)。
- Errors/resilience: 一覧と詳細は読込・空・失敗の各状態を持ち、失敗時は再読み込みを出す。送信を止める理由 (プライバシー確認の欠け・本文の超過) は、送信ボタンの近くに文で示す。入力は消さない。
- Observability/audit: N/A: 新しい信号を足さない。
- Configuration/secrets: N/A: 秘密情報を持たない。
- Compatibility/versioning: 1000 字を超える既存の本文は詳細でそのまま読める (新規と編集だけ 1000 字で止める。qa-imp-decision-002)。既存の『対応しない』は『完了』として出し、理由はアクティビティに出る (qa-imp-decision-001)。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外 (`architecture/improvement-screen-security.md`)

### Frontend architecture

#### Rendering and application pattern

最も頻度が高いのは『困ったその場で 1 件送る』なので、作成フォームを一覧より上に置く。どの画面からでも右下の『改善を送る』で撮影でき、撮った後は同じフォームへ届く (I5)。一覧と詳細は左右に並べるので、選んだ依頼の状態・履歴・関連する依頼を一覧から目を離さずに追える。狭い幅では作成フォーム → 一覧 → 詳細の順に縦に積み、表は横スクロールの容器に入れる (qa-imp-frontend-web-001 の上流指針の反映)。

#### Routes, screens and navigation

経路は `/improvement` の 1 つ (`AuthenticatedApp.tsx:63`) のままにする。見出しとタブ名は『改善リクエスト』に揃える (U7)。今の値は `Improvement.tsx:87` の見出しと `routeMetadata.ts:385` のタブ名である。選択中の依頼・タブ・検索語・ページは URL に持つ (I1)。そのため再読込や共有をしても同じ一覧と詳細に戻る。関連する依頼を押すと、その依頼の詳細に切り替わる。撮り直しでは関連ページへ戻ってパネルを出す (U7)。

#### Component and design-system boundaries

状態 4 つ・件数タブ・表の状態列・詳細の状態表示には、必ず文字ラベルを添える。削除・『元に戻す』・コピー完了の結果も文で伝える (上流指針 presentation)。範囲選択はポインタのドラッグとキーボードの両方で操作できる (矢印キーで矩形を動かし、Enter で確定)。選んだ範囲は文字でも示す (frontend 章の上流指針)。色はトークン、ボタンは共通 `Button` を使う。

#### State and data flow

番号は `IMP-024` のように出し、値は core が整形する (qa-imp-decision-007)。3 桁 (999) を超えたときの桁数は章に無い (未決)。概要は本文の先頭行から最大 40 字 (qa-imp-decision-002)。関連する依頼は、同じ関連ページの他の依頼を新しい順に最大 3 件出す (qa-imp-decision-006)。診断は表示用の要約 (OS・ブラウザ・画面サイズ・利用環境・伏せたセッション ID) で出し、セッション ID は末尾 4 桁だけ見せる (G3、security 章)。画面はどれも core が返した値を描くだけで、部品の中では変換しない。

#### Backend integration

削除は論理削除で、トーストの『元に戻す』は削除で返った同じ id を復元へ渡す。同じ番号のまま戻る (qa-imp-decision-003)。経路の名前と形は `architecture/improvement-screen-backend.md` に置く。

#### Performance and observability

N/A: 本章は見せ方の関心で、読み込みの予算 (撮影コードの遅延読み込み) は `architecture/improvement-screen-frontend.md` に従う。

#### Frontend verification

O1 の DOM テストで次を確かめる。問いの見出し、作成フォームの全項目と本文の文字数、プライバシー確認 2 つが未チェックのとき送信できないこととその理由の文、マスキングの説明、一覧の検索 / 5 つの件数タブ / 表 / ページング、詳細パネルの全区画、空状態、読み込み失敗と再読み込み、キャプチャの浮動パネル、選択中バー、コピー完了トーストである。加えて、状態が文字で出ること、削除の後に『元に戻す』で行が戻ることも確かめる。書き込みの道具 (枠・ペン・文字・マスク・移動と 5 色、『1つ戻す』『拡大して書き込む』) は `improvement-annotate.dom.test.tsx` と `annotate-image.dom.test.ts` で、書いたものを掴んで動かせること・動かしても大きさと色が変わらないこと・『1つ戻す』で動かす前へ戻ることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-ui-ux-web-001 | 上段に作成フォーム、下段に一覧と詳細の 2 ペイン (狭い幅は縦積み) | 現行の一覧＋投稿モーダル | 最頻の『1 件送る』が最上段にあり、選んだ依頼を一覧から目を離さず追える | 画面の段数が増え、狭い幅で縦に長くなる |
| qa-imp-ui-ux-web-001 | プライバシー確認 2 つとマスク対象の説明を送信の直前に置き、2 つとも必須にする | 確認なしで送る / 送信後に知らせる | 失敗コストの最も高い個人情報の送信を、送る前に止める | 送信までに 2 手増える |
| 利用者依頼 (2026-09-24) | 書き込みは枠・ペン・文字・マスク・移動の 5 道具。移動は別の道具にし、『1つ戻す』は操作の取り消しにする | 描く道具のまま既存の枠をドラッグで動かす / 『1つ戻す』は最後の図形を消す | 描く道具でのドラッグは「新しく描く」か「動かす」か曖昧になる。図形を消す取り消しでは、移動の後に押すと図形ごと消えてしまう | 道具が 1 つ増える。取り消しの履歴を作成フォームが持つ |
| qa-imp-decision-001 | 状態を受付 / 対応中 / 完了 / 再確認にし、文字ラベルを必ず添える | 現行の未対応 / 対応中 / 対応済み / 対応しない | 画像のタブと揃い、色覚に依らず読める | 既存の『対応しない』は『完了』として出る |
| qa-imp-decision-003 | 削除は完了トーストの『元に戻す』で同じ番号のまま戻す | 確認ダイアログ＋物理削除 | 誤削除を取り返せ、確認の手間が小さい | API に復元の経路が要る |
| qa-imp-decision-002 | 件名欄を廃止し、本文 0/1000 だけを入力させる | 件名 120 字＋本文 4000 字を残す | 画像と揃い、概要は core が 1 か所で切り出す | 1000 字を超える既存の本文は読めるまま残る |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと Workers Assets。
- Migration sequence: 見出しと期間 → 作成フォーム (確認 2 つと説明) → 一覧 (検索・件数タブ・ページング) → 詳細パネル → 削除と『元に戻す』・コピー完了トースト → キャプチャの浮動パネルと範囲選択 → 空 / 失敗の状態と選択中バー。
- Rollback trigger/procedure: DOM テスト・直書き色の lint・初期 JS 予算のどれかが赤なら差し戻す。ただし 0057 適用後の DB は新しい状態値を持つ (`architecture/improvement-screen-database.md`)。そのため旧画面へ戻す前に、再確認の状態の扱いを確かめる。

## Risks and verification

- Risk/assumption: 状態を色だけで示すと、色覚特性やモノクロの環境で読めない。文字ラベルの存在を DOM テストで確かめる。
- Risk/assumption: 画像の金額・件数・番号 (IMP-024 など) はモックなので、期待値にしない。3 桁 (999) を超えたときの番号の桁数は未決である。
- Architecture fitness test: 直書き色 0 件 (lint)。部品の中で状態名・番号・概要を組み立てていないこと (`architecture/improvement-screen-frontend.md` の grep)。
- Load/failure/security validation: 狭い幅で 3 段が縦に積まれ、表が横スクロールになること。範囲選択がキーボードだけで確定できること。いずれも DOM テストで確かめる。
