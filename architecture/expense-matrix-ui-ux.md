---
graph_node_id: "arch-expense-matrix-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "支出マトリックス画面 — 情報の優先順位・ヒートマップの読ませ方・セル選択"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["expense-matrix", "ui-ux"]
file_path: "architecture/expense-matrix-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "940691e19ee39682e106476ef8be9117c203916c8f9cbd76bf06f63d76f9bd1b"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "940691e19ee39682e106476ef8be9117c203916c8f9cbd76bf06f63d76f9bd1b", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-16T11:55:20Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-frontend", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-auth", "arch-expense-matrix-security", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/06-matrix.png", "design/FINAL-UI/spec/DESIGN-SYSTEM.md", "docs/design-system.md", "docs/ui-decisions.md", "packages/web/src/pages/analysis/Matrix.tsx", "packages/web/src/components/Layout.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/expense-matrix-ui-ux.md"}]
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

支出マトリックス画面 — 情報の優先順位・ヒートマップの読ませ方・セル選択。`system-spec/ui-ux.md` は承認時入力、本書は UI/UX 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-expense-matrix-screen.md`。

## Context and drivers

- Business/technical context: 目標画面 `06-matrix.png` の縦積み (見出し → 切替群 → マトリクス → 選択中セルの詳細 → 偏りが大きい3点) を基準に、現行の読み取り専用表へ切替 3 群・セル選択・詳細・偏り 3 点・空状態・下部バーを与える。見た目の正本は画像、値の正本は design tokens、文言と寸法比の正本は `specs/spec-expense-matrix-screen.md`。
- Quality attribute priorities: G1・G2・G5 に資する。Information Design の『task 頻度 × 失敗コストで束に順位を付ける』、Apple HIG の『現在地と選択を見失わせない』『色だけに頼らない』、WCAG 2.2 AA (非テキストコントラスト・grid role) を適用する。
- Constraints: C2 (トークン・共通 Button・PageShell・WCAG 2.2 AA)。web SPA 1 系統のレスポンシブ。サイドバー・ヘッダー・フッターは既存実装をそのまま使い、表記統一 (『マトリクス』→『マトリックス』) 以外は触らない。

## Goals and non-goals

- Goals:
  - G1: 画像の全構成要素 (問いの見出し・期間タブ・切替 3 群・凡例・ヒートマップ表・合計と平均の行列・下部の選択中バー・空状態) と、読込・空・失敗の各状態を描く。
  - G2: 『選択中のセルの詳細』パネル (見出しとバッジ・3 メトリクス・取引一覧・データの出典・明細導線・閉じる) を与える。
  - G5: 共通シェルを変えずに載せ、表記ゆれの統一だけ行う。
- Non-goals:
  - サイドバー・ヘッダー・フッターの作り直し (既存踏襲)
  - 総収支・推移・診断・分析ハブの中身の作り直し
  - 専用アプリ (mobile / tablet / desktop) 向けの版面

## System context and boundaries

- Users/external systems: 利用者 1 名が月次クローズで支出の偏りを探し、偏っているセルの明細まで降りる。
- Trust/deployment/data boundaries: 画面は共通シェル内。外部への書き戻しは無く、降りる先は既存の明細仕分け画面。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出しカード | 問い『どの月・カテゴリに支出が偏っていますか？』・説明文・データの最終更新・再取得 | PageShell 見出し | packages/web | web ビルド |
| 切替群 (3 群) | 表示モード (全部 / 構成比 / 前年差)・集計の対象 (事業 / 家計)・行の分類 (カテゴリ / 取引先) | セグメント | packages/web | web ビルド |
| マトリクスカード | 濃淡凡例 (7 階級) + 月×行のヒートマップ表 (行ヘッダ固定・月列横スクロール・合計/平均の行列) | 表 | packages/web | web ビルド |
| 選択中のセルの詳細カード | 見出しとバッジ・支出金額/前月比/前年同月比・取引一覧・データの出典・明細を開く・閉じる | カード | packages/web | web ビルド |
| 偏りが大きい3点カード | 順位バッジ・対象・金額・前月比・前年同月比・要因の示唆 | リスト | packages/web | web ビルド |
| 下部の選択中バー | 選択中セル名・金額・前月比・前年同月比・『該当明細を確認 →』 | 固定バー | packages/web | web ビルド |
| 共通シェル | サイドバー・ヘッダー・フッター (既存のまま。表記統一のみ) | Layout | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: N/A: 表示範囲は認証済みシェルに従う。
- Errors/resilience: 表と偏り 3 点の失敗は PageState error、セル内訳だけの失敗は詳細カード内のインライン表示にする。読込は表の骨格を保った PageState loading とし、レイアウトを跳ねさせない。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存の色の凡例・未記帳月の扱い・期間選択 (usePeriod) を引き継ぐ。共通シェルの既存 DOM テストは表記統一の差分以外は無変更で緑のまま。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

縦積みの順序は task 頻度 × 失敗コストで決める。最も頻度が高いのは『偏りを探す』、最も失敗コストが高いのは偏りを見落としたまま月次クローズを終えること。そのため問いの見出し・期間タブ・切替 3 群を最上段に、直下にヒートマップ表を全幅で置く。選択して初めて要る『選択中のセルの詳細』は表の下、『偏りが大きい3点』はさらに下。凡例は濃淡を読む直前に要るため表の直上。狭幅ではセグメント群を縦積みにする。

#### Routes, screens and navigation

`/analysis/matrix`。パンくずとサイドバーは既存の共通シェルを使い、当該項目の表記だけ『マトリクス』→『マトリックス』へ揃える (routeMetadata の label と journeyHint も同語)。降りる導線は『明細を開く →』『該当明細を確認 →』で、選択中の年月と行キーを付けて明細仕分けへ遷移する。

#### Component and design-system boundaries

部品は既存の共通資産だけを使う (PageShell / DataTable / PageState / 共通 Button / Link className='btn' / Term / HowTo)。色は既存トークンのみで、濃淡の階級は `COLOR.accent` の不透明度 7 段を当てる (`chartDecorativeFill` 経由)。直書き色とチャートライブラリの追加を禁じる。

#### State and data flow

表本体のセル・合計列・平均列・合計行・平均行は万円 1 桁丸め + 『万』(例『28.5万』)、合計列は桁区切り (例『1,062.6万』)。画像は見出しに『単位：円』と書きながらセルを万円丸めで描いており表記が食い違うため、セル表記を正として見出しを『単位：万円』へ直す (数値の意味は変えない表記の是正)。円単位の実額を出すのは選択中のセルの詳細だけ (例『¥240,000』)。平均行の合計・平均セルは '-'。カテゴリの並びは固定順で『その他』を末尾に置く。

#### Backend integration

濃淡の階級も前月比も画面側で再計算せず、API が返した値と階級をそのまま描く (集計規則を画面が持たない)。

#### Performance and observability

セルを選んでから内訳が届くまでの間は、選択中バーの金額と比率を先に出し取引一覧の領域だけを読込表示にする (選択が効かなかったと誤解させない)。データの最終更新と再取得は見出しカード右上に置き、いま見ている数値の時点を常に確認できるようにする。

#### Frontend verification

O1 の DOM テスト (問いの見出しと説明文・期間タブ 4 つと対象範囲・表示モード 3 つ・集計の対象 3 つ・行の分類 2 つ・濃淡凡例・合計/平均の行列とセルの選択状態・下部バー・空状態の取込導線・読込/空/失敗)。O2 の DOM テスト (セル選択 → 見出し・金額・前月比・前年同月比・取引一覧の行・データの出典・明細を開く・閉じる、および未選択時にパネルと下部バーが出ないこと)。O5 の共通シェル既存テストが表記統一の差分だけで緑。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-matrix-heat-scale | 濃淡は表全体共通の 7 階級 (表示中の全データセルの最小〜最大を等分) | 月ごと (列ごと) に正規化 | 列をまたいで濃さを比較でき、特定の月だけ突出したセルが一目で分かる | 合計/平均の行列を階級算出から除外しないと本体セルが最下位階級へ潰れる |
| dec-matrix-out-of-range-comparison | 前月比・前年同月比は表示期間の前後 12 か月まで読み広げて実データがあれば参照 | 期間外は空欄 | 画像の選択セル (広告宣伝費 2026年03月 前年同月比 +300.0%) は期間外を参照しないと再現できない | 読み取り範囲が表示期間より広がる |
| dec-matrix-counterparty-axis | 取引先軸は期間合計の上位 20 + 『その他』1 行 | 全件表示 / 可変しきい値 | ヒートマップは一覧して偏りを見つける道具で、行数が画面に収まることが前提 | サーバ側で畳むため画面は行数を意識しない |
| qa-matrix-uiux-web-001 | 選択中セルは塗りではなく濃紺 2px の枠で示す | 塗りを変える | 塗りを変えると濃淡の情報が壊れる | 選択状態は枠と aria-selected と下部バーの 3 重で示す |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド。
- Migration sequence: 切替 3 群と URL 契約 → ヒートマップ表 (合計/平均の行列・行ヘッダ固定) → セル選択と枠 → 選択中のセルの詳細 → 偏りが大きい3点 → 下部の選択中バー → 空状態 → サイドバー表記統一。
- Rollback trigger/procedure: DOM テスト・check 系が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 濃淡を色だけに頼ると色覚特性・低コントラスト環境で情報が消える。セルへ常に数値を表示し、増減は矢印と符号付きの金額と率を併記して回避する。
- Architecture fitness test: 数値を伴わない濃淡が無いこと。切替 3 群のそれぞれで塗りつぶしの選択状態が 1 つだけであること。表を横スクロールしても行ヘッダ列が固定されていること。
- Load/failure/security validation: 狭幅でセグメント群が縦積みになり本文が横スクロールしないこと。WCAG 2.2 AA を維持すること。
