---
graph_node_id: "arch-expense-matrix-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "支出マトリックス画面 — URL 単一真実・2 本の取得・部品境界"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["expense-matrix", "frontend"]
file_path: "architecture/expense-matrix-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "e532dd19fe36b269cb64da9433bf854d7e576120457d6f095a5b7cebf75940dd"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "e532dd19fe36b269cb64da9433bf854d7e576120457d6f095a5b7cebf75940dd", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-16T11:55:20Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-auth", "arch-expense-matrix-security", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops"]
resource_scope: ["packages/web/src/pages/analysis/Matrix.tsx", "packages/web/src/period.tsx", "packages/web/src/components", "packages/core/src/design-tokens.ts", "docs/ui-decisions.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/expense-matrix-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T11:55:20Z"}
serves_goals: ["G1", "G2", "G5"]
---

# Architecture overview

支出マトリックス画面 — URL 単一真実・2 本の取得・部品境界。`system-spec/frontend.md` は承認時入力、本書はフロントエンド実装制約を持つ。画面仕様の正本は `specs/spec-expense-matrix-screen.md`。

## Context and drivers

- Business/technical context: 現行 `packages/web/src/pages/analysis/Matrix.tsx` は 174 行で、`/matrix` を 1 本だけ叩き、Mode ('val' | 'mom' | 'yoy') のローカル state で表示を切り替え、`cell(series, i)` で前月比・前年同月比を画面側で算出している。切替がローカル state に閉じているためリロードで失われ、偏りを見つけた画面を共有することもできない。
- Quality attribute priorities: G1・G2・G5 に資する。Clean Architecture の Dependency Rule (画面は集計規則を持たない)、Information Design の『状態は復元できる場所に置く』、Apple HIG の『待たせるときは何が起きているかを示す』を適用する。
- Constraints: C2 (既存トークン・共通部品・WCAG 2.2 AA)。React 18 + react-router-dom 7 + TanStack Query 5。新しい外部依存・チャートライブラリを増やさない (既存の JS バンドル予算)。

## Goals and non-goals

- Goals:
  - G1: 画像の全構成要素を既存のデザイントークン・共通 Button・PageShell の上に組み、読込・空・失敗の各状態を持つ。
  - G2: セル選択で詳細パネルを開き、含まれる取引・出典・明細導線を出し、閉じるで解除する。
  - G5: 共通シェルと既存資産 (usePeriod・色の凡例・未記帳月の扱い) を壊さずに載せる。
- Non-goals:
  - 集計規則の画面側実装 (core と API の責務)
  - 期間状態の新規導入 (既存 usePeriod をそのまま使う)
  - サイドバー・ヘッダー・フッターの作り直し

## System context and boundaries

- Users/external systems: 利用者 1 名。ブラウザのみ。
- Trust/deployment/data boundaries: web は API の応答を描くだけ。集計・階級・順位は越境させない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Matrix ページ | URL クエリから状態を導出し 2 本の取得を束ねる | react-router `useSearchParams` | packages/web | web ビルド |
| 切替群 | mode / scope / axis を URL へ書く | セグメント | packages/web | web ビルド |
| ヒートマップ表 | 行ヘッダ固定 + 月列の横スクロール、セルは選択可能 | DataTable + 既存 scroll-x 規約 | packages/web | web ビルド |
| 詳細パネル | セル内訳クエリの結果を描く | カード | packages/web | web ビルド |
| 下部の選択中バー | 詳細パネルと同じ値を出す | 固定バー | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: 既存の認証済みシェル配下。web 側で追加の認可判定を持たない。
- Errors/resilience: マトリクス取得とセル内訳取得は別のクエリキー・別のエラー表示にし、どちらが落ちたかを画面から判別できるようにする。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存の matrix-visual / matrix-legend のテストは新構成に合わせて更新し、色の凡例と未記帳月の扱いは維持する。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/expense-matrix-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

既存 SPA のページとして実装する。React state は URL から導出し、URL に無い派生状態を持たない。表示モードの値は再取得せず、同じ series から core の純関数で導く。

#### Routes, screens and navigation

`/analysis/matrix`。表示モード / 集計の対象 / 行の分類 / 選択中セルの 4 つを URL クエリ (`mode` / `scope` / `axis` / `cell=<行キー>:<YYYY-MM>`) の単一の真実とし、リロードと共有で失われないようにする。期間は既存 `usePeriod` をそのまま使い、本画面で新しい期間状態を持たない。

#### Component and design-system boundaries

既存の共通資産だけを使う (PageShell / DataTable / PageState / 共通 Button / Link className='btn' / Term / HowTo)。色は既存トークンのみで直書き色を作らず、ヒートマップの階級は `COLOR.accent` の不透明度 7 段を当てる (`chartDecorativeFill(COLORS.accent, opacity)` 経由。呼び出し側で 16 進 suffix を組み立てない)。セルは button 相当のロールで Tab / 矢印移動と Enter 選択に応答し、選択中は `aria-selected` と枠線で示す。

濃淡を塗る部品は `packages/web/src/components/heatmap/` の `HeatGrid` 1 本にまとめ、本画面と AI レポートの図 9 が同じ部品を使う。分母の作り方は `heat-model.ts` の `heatIntensities(series, normalize)` に閉じ、`normalize` は `'table'` (表全体で共通・本画面) か `'row'` (行ごと・AI レポート) を取る。props は次の 4 制約を満たす (仕様 §3.3 が正本):

- `HeatGrid` は分母 (`max` 等) を受け取らない。塗る値は `intensities` からしか来ない。
- 生の金額配列だけを渡して部品側に計算させる経路を作らない (型で消す)。
- 変換層 (`ChartSeries`) を通す経路では階級値が変換層を通過することを型で強制する。できないなら変換層を挟まず、`HeatGrid` の直前で階級化する。
- 外側レイアウトは `HeatGrid` のクラス名に依存しない。高さ・余白は親が props で受け取る。

色は props で受け取る (本画面は `COLOR.accent`、AI レポートは現行の `COLORS.biz`)。部品内に固定すると移設した時点で AI レポート側の見た目が変わる。

#### State and data flow

取得は TanStack Query 5 で 2 本に分ける — マトリクス本体 (`queryKey: ['matrix', period, scope, axis]`) は画面表示時に、セル内訳 (`queryKey: ['matrix-cell', period, scope, axis, cell]`) は選択が入るまで開始しない条件付き取得 (`enabled`) にする。同一パラメータの再取得はクエリキャッシュで吸収する。

`pages/analysis/matrix/model.ts` は JSX を持たず、責務は「API レスポンス → 表示用の行・列・選択状態」への写像だけとする。**ここに濃淡も偏りスコアも書かない** — 濃淡は `components/heatmap/heat-model.ts`、偏りスコアは `packages/core/src/analysis.ts` の `zScores` / `zOf` が持つ。層の名前が空いていると計算が流れ込むため、空けておくのではなく「置かない」と宣言する。

#### Backend integration

web は API が返した数値・階級・順位をそのまま描き、前月比も濃淡の階級も画面側で再計算しない (現行の `cell(series, i)` による画面側算出は廃する)。『明細を開く』『該当明細を確認』は選択中の年月と行キーを付けて明細仕分けへ `Link` で遷移する。

#### Performance and observability

表と偏り 3 点の読込中は表の骨格を保った読込表示にしてレイアウトを跳ねさせない。セル内訳の待ち時間は取引一覧の領域だけを読込表示にする。新しい外部依存を増やさず既存の JS バンドル予算を超えさせない。

#### Frontend verification

DOM テスト (`packages/web/src/matrix-*.dom.test.tsx`) で、切替 3 群・表の合計行/合計列/平均行/平均列・濃淡の階級・セル選択と詳細パネル・偏り 3 点・空状態・下部バー・読込/失敗、および URL 復元を検証する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-matrix-frontend-web-003 | 4 つの状態を URL クエリの単一真実にする | React ローカル state を維持 | リロードと共有で切替と選択が失われない | URL 契約が画面と API の両方の入力になる |
| qa-matrix-frontend-web-003 | 取得を表本体とセル内訳の 2 本に分け、内訳は条件付き取得 | 1 本にまとめて全セルの明細を返す | 初回応答が明細件数に依存しなくなる | 失敗表示とエラー境界を 2 系統持つ |
| dec-matrix-heat-scale | 階級は API が返し、画面は色を引くだけ | 画面側で最小〜最大を計算 | 画面と CSV と API で濃淡が食い違わない | 階級境界が API 契約の一部になる |
| qa-matrix-frontend-web-004 | 共通シェルは既存踏襲、表記のみ『マトリックス』へ統一 | シェルも作り直す | 既存テストを無変更で緑に保てる | routeMetadata の label と journeyHint も同語へ揃える |
| dec-matrix-heat-scale | 濃淡は `heatmap/` の 1 部品に寄せ、分母は `heatIntensities` だけが作る (`HeatGrid` は分母を受け取らない) | 画面ごとに濃淡を実装し続ける | 同じ偏りが画面ごとに違う定義で計算される経路が減る | props の型が制約であり、後から絞れないので最初に決める |
| dec-matrix-heat-scale | `model.ts` は写像だけを持ち、濃淡・偏りスコアを置かない | 画面の近くに計算を置く | 計算の置き場所が名前で一意になる | 新しい計算の追加時に置き場所の判断が要る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド。
- Migration sequence: URL 契約と usePeriod 接続 → 切替 3 群 → ヒートマップ表 → セル選択 → 詳細パネル (条件付き取得) → 偏りが大きい3点 → 下部バー → 空状態 → 既存 matrix-visual / matrix-legend テストの更新。
- Rollback trigger/procedure: DOM テスト・js-budget・check 系が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 画面側に集計が残ると API と数値が食い違う。`cell(series, i)` 相当の計算が web に残っていないことをレビューと検索で確かめる。
- Architecture fitness test: web に月次集計・階級決定・順位付けのコードが無いこと。URL を直接開いて切替と選択が復元されること。
- Load/failure/security validation: js-budget を超えないこと (build:bundle 直後に測る)。`dangerouslySetInnerHTML` を本画面のどこにも使わないこと。
