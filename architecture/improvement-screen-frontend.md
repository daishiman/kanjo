---
graph_node_id: "arch-improvement-screen-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "改善リクエスト — pages/improvement/ に分けて core を呼ぶのは view-model だけにし、表示条件は URL を正本に、撮影は遅延読み込みの DOM 複製に伏字と範囲選択を足して画像はメモリだけに持つ"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement-screen", "frontend"]
file_path: "architecture/improvement-screen-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "466a7cf24271302e0a47c66f04c1421a69303d423d599985fcbc3d7481d91681"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "466a7cf24271302e0a47c66f04c1421a69303d423d599985fcbc3d7481d91681", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Improvement.tsx", "packages/web/src/pages/improvement", "packages/web/src/components/ImprovementRequestButton.tsx", "packages/web/src/components/ScreenshotAnnotator.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/capture-screen.ts", "packages/web/src/annotate-image.ts", "packages/web/src/diagnostics-buffer.ts", "packages/web/src/api.ts", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/improvement-screen-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:47:00Z"}
serves_goals: ["G1", "G3"]
---

# Architecture overview

改善リクエスト — `packages/web/src/pages/Improvement.tsx` (255 行) を `packages/web/src/pages/improvement/` に分ける。分け先は ImprovementPage・view-model・作成フォーム・一覧・詳細パネル・撮影パネル・選択中バー・トーストで、core を呼ぶのは view-model だけにする。選択中の依頼・タブ・検索語・ページは URL の検索パラメータを正本にし、変更の後は TanStack Query を invalidate する。撮影は既存の DOM 複製に伏字と範囲選択を足し、遅延読み込みにして初期 JS 予算を守る。撮った画像と本文は端末に保存せず、メモリにだけ持つ (qa-imp-frontend-web-001)。`system-spec/frontend.md` は承認時入力で、本書はモジュール分割・状態の置き場所・撮影の流れ・API との結線の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 現行 web は `pages/Improvement.tsx` の 1 ファイルに一覧と詳細を持つ。選択中の依頼は `useState` (:39) で、一覧は問い合わせ鍵 `['improvements']` (:43)、詳細は `['improvements', selected]` (:44-45)。撮影まわりは 3 つに分かれる。`capture-screen.ts` が DOM を複製して `[data-capture-hide]` の要素を落とし (:91)、`components/ScreenshotAnnotator.tsx` と `annotate-image.ts` が注釈を付け、診断は `diagnostics-buffer.ts` が集める。API 呼び出しは `api.ts:1332-1410` にある。右下の浮動ボタンは `Layout.tsx:523-527` で、`ImprovementRequestButton` を遅延読み込みしている (:40-42)。ルーティングは `AuthenticatedApp.tsx:63` (画面は :9-10 で遅延読み込み) と `routeMetadata.ts:370,385` (qa-imp-frontend-web-evidence-001)。分割の前例は `pages/cash/` で、`pages/Cash.tsx` は再輸出だけの入口になっている。
- Quality attribute priorities: G1・G3 に資する。Clean Architecture の依存方向 (web → core の一方向、導出は core) を適用する。Information Design の『加工』と『形式の比較選定』も適用し、一覧の形式には表を採る (frontend 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: React 18 + react-router-dom 7 + TanStack Query 5 (C1)。初期 JS 予算・verify:full・skills:test を緑に保つ。撮影はブラウザ内で完結させる (C4)。web のみ (qa-imp-decision-005)。

## Goals and non-goals

- Goals:
  - G1: 画面を部品単位に分け、`20-improvement.png` の段ごとに 1 部品を対応させる (`architecture/improvement-screen-ui-ux.md`)。
  - G3: 状態名・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスク規則を、core の improvement-screen から view-model 経由で受け取る。部品では計算しない。
- Non-goals:
  - 撮影画像・本文の端末保存 (localStorage 等) と下書き (qa-imp-frontend-web-001)
  - 撮影をサーバや外部サービスで行うこと (C4)
  - 画面の即時読込化 (遅延読み込みのまま)

## System context and boundaries

- Users/external systems: 利用者のブラウザ。
- Trust/deployment/data boundaries: web は API の応答と core の結果を描く。本文・関連ページ・診断はブラウザでマスクし、サーバでも辞書を含む core の規則で掛け直す。画像は撮影時の伏字と送信前の利用者確認が境界となり、サーバで画像内の情報を再マスクしない (`architecture/improvement-screen-security.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `pages/improvement/ImprovementPage` | 段の配置、URL の検索パラメータの読み書き | React + `useSearchParams` | packages/web | Workers Assets |
| `pages/improvement/view-model` | core の improvement-screen を呼び、画面用に写す | 純関数 | packages/web (導出は packages/core) | 同上 |
| 作成フォーム | 本文・画像の枠・確認 2 つ・送信 | React | packages/web | 同上 |
| 一覧 / 詳細パネル | 表・件数タブ・ページング、詳細の区画と操作 | React | packages/web | 同上 |
| 撮影パネル (遅延読み込み) | 全体と範囲選択の撮影、伏字、注釈 | React + `capture-screen.ts` / `annotate-image.ts` | packages/web | 同上 (別 chunk) |
| 選択中バー / トースト | 選択中の操作、『元に戻す』、コピー完了 | React | packages/web | 同上 |
| `pages/Improvement.tsx` | 再輸出だけの入口 | `export { ImprovementPage } ...` | packages/web | 同上 |

部品のファイル名は、章の部品名から付けた agent 推定・利用者未確認の名前である。

## Cross-cutting contracts

- Identity/access: 既存セッションの Cookie で API を呼ぶ。新しい端末保存は持たない。
- Errors/resilience: 一覧と詳細の読み込みに失敗したら再読み込みを出す。送信が 400 で返ったら欄ごとの理由を欄の近くに出し、入力と画像はメモリに残す。
- Observability/audit: 診断は既存の `diagnostics-buffer.ts` で集める。表示用の要約は core が作る。
- Configuration/secrets: N/A: 秘密情報を持たない。
- Compatibility/versioning: 経路 `/improvement` を保つ。URL に検索パラメータが無ければ、『すべて』タブ・検索なし・1 ページ目・未選択で開く (agent 推定・利用者未確認)。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/improvement-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外 (`architecture/improvement-screen-security.md`)

### Frontend architecture

#### Rendering and application pattern

core を呼ぶのは view-model だけにする。部品は view-model が返す値を描くだけで、状態名 (done→『完了』)・番号 (24→`IMP-024`)・日付の表示 (ISO 時刻→日付)・セッション ID の末尾 4 桁への写しを、部品の中では変換しない (frontend 章の本章での適用)。一覧は表とカードを比べたうえで、表を採る。ID・関連ページ・状態・日付の 6 列を見比べて選ぶ用途だからである。

#### Routes, screens and navigation

経路は `/improvement` のまま遅延読み込みを保つ (`AuthenticatedApp.tsx:9-10,63`)。選択中の id・タブ・検索語・ページは `useSearchParams` で URL に持ち、コンポーネント内の state に二重に持たない (react-router の useSearchParams)。キー名は agent 推定・利用者未確認とする。撮影パネルは `Layout.tsx` の右下の『改善を送る』から開く。撮った画像と関連ページはメモリ上で受け渡し、`/improvement` の作成フォームへ渡す (上流指針 application-architecture)。受け渡しの実装 (モジュール内の変数か React の context か) は章に無く、未決である。

#### Component and design-system boundaries

撮影は 2 通りある。`capture-screen.ts` の DOM 複製を拡張し、`data-capture-mask` を付けた要素を伏字にしてから画像にする (security 章)。範囲選択は、ポインタのドラッグとキーボード (矢印キーで矩形を動かし Enter で確定) の両方で操作できるようにする。画像化には canvas の `toBlob` を使う (MDN)。書き込み (`ScreenshotAnnotator.tsx`・`annotate-image.ts`) は作成フォームの画像の下に最初から出す。道具は枠・ペン・文字・マスク・移動で、書き込みは比率 (0..1) の配列として作成フォームが持つ。インラインと『拡大して書き込む』ダイアログの 2 つの `ScreenshotAnnotator` が同じ配列と操作履歴 (`AnnotationHistory`、最大 100) を共有し、『1つ戻す』は最後の操作を取り消す。プレビューと送信時の焼き込みは同じ `drawAnnotations` を通すので見た目が一致し、マスクの焼き込み失敗は送信を止める。ドラッグ中の下書き・掴んだ対象は state と ref の鏡像で持ち、pointerup の座標で確定する (速いドラッグで再描画より先に up が来ても落とさない) (利用者確認済み、2026-09-24)。色はトークン、ボタンは共通 `Button`。

#### State and data flow

サーバー状態は TanStack Query 5 で持つ。作成・状態の変更・再発行・コピー記録・削除・復元の後は、一覧と詳細の問い合わせを invalidate する (TanStack Query の query invalidation)。一覧の問い合わせ鍵には、URL のタブ・検索語・ページを含める (agent 推定・利用者未確認)。撮影画像・本文・確認のチェックはメモリにだけ持ち、画面を離れたら捨てる。

#### Backend integration

`api.ts` の改善要望の関数群 (:1332-1410) を置き換える。一覧は検索・タブ・ページを付けて呼び、作成は件名を送らない。削除と復元の関数を新しく足す。経路と応答の形は `architecture/improvement-screen-backend.md` に従う。

#### Performance and observability

撮影と範囲選択のコードは最初の描画に要らないので、遅延読み込みの chunk に入れる。今の `ImprovementRequestButton` と同じ扱いである。core の improvement-screen は、既存の *-screen と同じく初期バンドルに引き込まない形で export する。初期 JS 予算は `build:bundle` の直後の js-budget で確かめる。

#### Frontend verification

view-model の単体テストで、core の結果の写しを確かめる。DOM テストでは 3 つを確かめる。1 つ目は O1 の全構成要素と URL の往復。2 つ目は撮影用の複製から金額・取引先名・名義の文字が伏字になること (O2)。3 つ目は範囲選択のキーボード操作である。既存の `improvement-capture.dom.test.tsx` と `capture-screen.dom.test.ts` は新しい構成へ移し、期待値を緩めない。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-frontend-web-001 | `pages/improvement/` に分け、core を呼ぶのは view-model だけ | `Improvement.tsx` 1 ファイルのまま改修 | cash の前例と揃い、導出の置き場所が 1 つになる | 既存テストの移設が要る |
| qa-imp-frontend-web-001 | 選択中の依頼・タブ・検索・ページを URL の検索パラメータを正本にする | コンポーネント内の state (現行 `useState`) | 同じ URL を開けば同じ一覧と詳細が出る | キー名の互換を保つ必要がある |
| qa-imp-frontend-web-001 | 撮影は DOM 複製に伏字と範囲選択を足し、遅延読み込みにする | 撮影を初期バンドルに含める / 外部の撮影 | 初期 JS 予算を守り、画面を外部へ出さない | 撮影の開始時に chunk の読み込みを待つ |
| qa-imp-frontend-web-001 | 撮影画像と本文はメモリだけに持つ | 端末に下書きとして保存 | 伏字前後の画像や本文を端末に残さない | 画面を離れると入力は消える |
| qa-imp-decision-007 | 撮影は画面全体と範囲選択の両方 | 画面全体だけ | 画像のパネルと揃い、要らない部分を送らずに済む | 範囲選択のキーボード操作が要る |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web ビルドと Workers Assets。
- Migration sequence: core improvement-screen → view-model → 部品の分割と再輸出 → URL の検索パラメータ → API 関数の置き換え (検索・タブ・ページ、削除・復元) → 撮影パネルの伏字と範囲選択 → 右下の『改善を送る』からの受け渡し。
- Rollback trigger/procedure: DOM テスト・初期 JS 予算・verify:full のどれかが赤なら差し戻す。web は保存データを持たないので、差し戻しで失うものは無い。ただし API が 0057 後の形を返す間は、旧画面の件名表示が空になる。

## Risks and verification

- Risk/assumption: 部品が view-model を経由せずに core や自前の計算を使うと、表示と判定が割れる。`pages/improvement/` の配下で core を import するのが view-model だけであることを grep で確かめる。前例の `pages/cash/` では、`draft.ts` も core を import している。
- Risk/assumption: 伏字の対象要素に `data-capture-mask` を付け漏らすと、画像に個人情報が残る。付ける対象の列挙は security 章の管轄で、DOM テストで代表の画面を確かめる。
- Architecture fitness test: web に状態の遷移・番号の整形・件数・関連の計算が 0 件であること (O3 の grep)。
- Load/failure/security validation: 初期 JS 予算を CI の実測で確かめ、撮影コードが初期 chunk に入らないことを確かめる。
