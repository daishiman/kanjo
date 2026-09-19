---
graph_node_id: "arch-household-cashflow-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "家計収支 — 問いから明細までの縦積みと選択の URL 保持"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["household-cashflow", "ui-ux"]
file_path: "architecture/household-cashflow-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "ebb1ebea580af83a7170eac3c6947c3a891ae1a0b179ad282733068323841195"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "8f63b6a76287ed9a738241c5371344a231b534404672337abe67d6ff7f97f4d8", "imported_at": "2026-09-18T12:24:49Z"}
created_at: "2026-09-18T12:24:49Z"
updated_at: "2026-09-18T12:24:49Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-frontend", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-auth", "arch-household-cashflow-security", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops"]
resource_scope: ["packages/web/src/pages/household/", "packages/web/src/pages/Household.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Page.tsx", "docs/ui-decisions.md", "design/FINAL-UI/images/10-household.png"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/household-cashflow-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:24:49Z"}
serves_goals: ["G1", "G3", "G4", "G5"]
---

# Architecture overview

家計収支画面 — 問いから明細までの縦積みと選択の URL 保持。`system-spec/ui-ux.md` は承認時入力、本書は UI/UX 制約を持つ。文言・数値・フィクスチャの正本は `specs/spec-household-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 目標画面 `10-household.png` の縦積み 7 段 (見出しと出典 → KPI と前年より → 推移と事業・個人の内訳 → カテゴリ表と詳細の 2 カラム → 名義別収入・振替・名義ラベルの 3 カラム → 前年との比較 → 下部の選択中バー) を基準にする。現行 `packages/web/src/pages/Household.tsx` (657 行・1 ファイル) は問いの見出し・出典カード・前年系列・カテゴリ詳細・振替一覧・名義ラベル編集・下部バーを持たず、ナビの表記は『累計収支』(qa-household-ui-ux-web-evidence-001)。
- Quality attribute priorities: G1・G3・G4・G5 に資する。Apple HIG の『色だけに頼らない』(増減に符号と矢印を必ず添える・前年系列は点線・凡例 5 系列に名前) と、Information Design の『task 頻度 × 失敗コストで束に順位を付ける』を適用する。
- Constraints: web SPA 1 系統 (qa-household-target-platforms-001)。既存のデザイントークン・共通 Button・PageShell の上に組む。サイドバー・ヘッダー・フッターは既存のまま、`/household` の名称だけ『家計収支』へ改める。

## Goals and non-goals

- Goals:
  - G1: 画像の全構成要素と、読込・空・失敗・前年比較不能の各状態を描く。ナビとパンくずを『家計収支』にする。
  - G3: 6 区分の表の行を選ぶと『カテゴリの詳細』パネルを開き、主な取引・すべて見る・集計の説明・分類ルールへの導線・閉じるを示す。
  - G4: 『名義ラベルを編集』のダイアログで 4 名義の表示名だけを変えられるようにする。
  - G5: 除外した振替の一覧と名義間 (『本人 → パートナー』『相手不明』) を示し、振替が収支に入らないことを確かめられるようにする。
- Non-goals:
  - 『累計収支』画面の新設 (qa-household-decision-004)
  - 共通シェル (サイドバー・ヘッダー・フッター) の作り直し
  - 画像の算術が閉じない欄を画像どおりに描くこと (計算値を正本にする。`specs/spec-household-cashflow-screen.md` §10)

## System context and boundaries

- Users/external systems: 利用者 1 名が家計の黒字が前年より良いか、いつ・何が変わったかを確かめ、区分の明細まで降りる。
- Trust/deployment/data boundaries: 画面は認証済みの共通シェル内。降りる先は既存の明細画面 (`/classify`)・取込履歴 (`/import`)・設定 (`/settings`)。外部サービスへの送信は無い。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出しカードと出典カード | 問い『家計の総収入・総支出・純収支は、どう変わりましたか？』と説明文、代表の取込元と他 N 件、`取込明細を確認 →` | PageShell 見出し | packages/web | web ビルド |
| KPI 行 | 総収入・総支出・純収支と月平均・年換算、『前年より』カード (前年差・率・矢印・決定論の一文) | KpiCard | packages/web | web ビルド |
| 月別の家計収支推移カード | 家計全体 / 事業 / 個人のタブ、凡例 5 系列、月送り、選択月の帯、下端の『事業と個人の内訳』と等式 | FinancialFigure | packages/web | web ビルド |
| 生活費カテゴリ表と詳細パネル | 6 区分の当期・前年・増減額・構成比・合計、行選択で開く詳細 (× で閉じる) | 表 + パネル | packages/web | web ビルド |
| 名義・振替・名義ラベルの 3 カラム | 名義別の収入、除外した振替 (名義間と相手不明)、名義ラベル編集ダイアログ | カード | packages/web | web ビルド |
| 前年との比較 | 3 枚の増減と決定論テンプレートの文章の要約 | カード | packages/web | web ビルド |
| 下部の選択中バー | 選択中の月・その月の純収支・`内訳の明細を確認 →` | 固定バー | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: N/A: 表示範囲は認証済みシェルに従う (`architecture/household-cashflow-auth.md`)。
- Errors/resilience: 本体の失敗は PageState error と再試行。カテゴリ詳細の取得失敗と名義ラベル保存の失敗は該当カード内のインライン表示にし、画面全体を失敗にしない。空 (選択期間の集計対象台帳行 0 件) は点線枠の空状態カードと `データ取込へ` (→ `/import`)。振替のみ・除外行のみの期間も空にする。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 期間段は既存 `usePeriod` / localStorage を正本とし、新しい期間状態を持たない。ブラウザ URL に載せるのは表示選択 `seg` / `month` / `cat` のみ。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

縦積みの順序は task 頻度 × 失敗コストで決める。最も頻度が高い問いは『今期の家計は黒字か、前年より良いか』なので KPI 3 枚と前年よりカードを最上段に置く。次に『いつ変わったか』を推移グラフで、続けて『何が増えたか』を 6 区分の表と詳細パネルで答える。名義別収入・振替・名義ラベルは頻度が低いが、振替を見落とすと収支を二重に数えたと誤解する失敗コストが高いので、除外の理由と相手不明を明示した 3 カラムにまとめる。狭幅では 2 カラム・3 カラムを縦積みにし、表は横スクロールコンテナへ入れる。

#### Routes, screens and navigation

`/household`。ナビ (`routeMetadata.ts`) の名称を『累計収支』から『家計収支』へ改め、グループは『整える』のまま、パンくずは `整える / 家計収支`。降りる導線はカテゴリの `すべて見る →` (月・区分で絞った `/classify`)、`内訳の明細を確認 →`、`取込明細を確認 →`、`分類ルールを確認 →`。振替はカード内に選択月の全件 (抜粋なし) を出すため、循環する `すべて見る` 導線を置かない。URL の逐語は `specs/spec-household-cashflow-screen.md` §5.3 / §6.2 / §8。

#### Component and design-system boundaries

色は既存トークンだけを使う。収入・増加の良い向きは accent / 成功色、支出・悪化は危険色、前年系列は同じ色の点線。支出の増加と収入の増加で色の意味が逆になるため、増減には必ず符号 (+ / −) と矢印を添え、文字だけで読めるようにする。名義ラベルのボタンは共通 Button の secondary。

#### State and data flow

タブ (`seg`) はグラフの系列だけを切り替え、KPI・内訳・表は常に家計全体を示す。月送り・棒の選択・下部バーは同じ選択月を共有し、既定は期間の最終月。表の行とグラフの棒はクリックとキーボード (Tab / Enter) で選べ、選択中の行は枠で示す。詳細パネルは期間合計 `current`、選択月合計 `monthTotal`、選択月の最大 5 件 `transactions` プレビューを混同しない。既定の選択と主な取引の並びは仕様書の規則に従う (正本は `specs/spec-household-cashflow-screen.md` §5.2 / §5.3。その値は agent 推定・利用者未確認 (根拠 qa-household-ui-ux-web-003))。

#### Backend integration

差・率・構成比・前年欠損の判定・名義の表示名は画面で再計算せず、API が返した値をそのまま描く。前年値が `null` の欄は `—` にする。

#### Performance and observability

カテゴリ詳細は選択時に取得し、取得中はパネル内にスケルトンを出す (選択が効かなかったと誤解させない)。本体の読込はカードの骨格を保った PageState loading にし、レイアウトを跳ねさせない。

#### Frontend verification

O1 の DOM テスト (問いの見出しと説明文・出典カード・期間タブ・KPI 3 枚と前年よりカード・タブ 3 つと凡例 5 系列と月送り・事業と個人の等式・カテゴリ表・名義別収入・選択月の振替全件一覧 (抜粋・循環導線なし)・名義ラベル設定・前年との比較・下部バー、および読込・空・失敗)。O3 の DOM テスト (行の選択をクリックとキーボードで行い、詳細パネルの `current` / `monthTotal` / 5 件プレビューの意味が分かれ、カテゴリのすべて見るが絞った明細 URL を指す)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-household-nav-name | `/household` を『家計収支』に改名する | 改名に加えて『累計収支』を新設 | 画像の見出しと一致し、画面を 1 つに保てる | パンくず・`figure-guides.ts`・用語集の記述を合わせる |
| dec-household-figure-source | 画像の算術が閉じない欄は収入・支出を正本に計算値を描く | 画像の純収支を正本にして前年の総支出を調整 | どの欄も算術で閉じる | 前年差・構成比・前年比率の一部が画像と変わる (§10) |
| dec-household-categories | 生活費は固定 6 区分 (その他は常に末尾) | 金額上位 5 大項目 + その他 | 画像の表と一致し、区分の意味が期間をまたいで一定 | 事業側の支出も『その他』に入り、詳細で内訳を分けて示す |
| dec-household-transfer-pairs | 振替は入出金の対を推定して名義間を示す | 名義間の欄を出さない | どこからどこへ動いたかまで見せて除外を確かめられる | 対にならない明細は『相手不明』と明示する |
| qa-household-ui-ux-web-004 | 選択 (`seg` / `month` / `cat`) を URL に保ち、増減は符号と矢印を併記する | 選択をコンポーネント内に持つ / 色だけで増減を示す | リロードと共有で同じ画面を復元でき、色覚特性に依らず読める | URL の既定値を仕様で決めておく必要がある |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド。
- Migration sequence: 見出しと出典 → KPI と前年より → 推移カードとタブ・月送り → 事業と個人の等式 → カテゴリ表と詳細パネル → 名義・振替・名義ラベルの 3 カラム → 前年との比較 → 下部バー → 状態 (読込・空・失敗・前年比較不能) → ナビ名称。
- Rollback trigger/procedure: DOM テスト・check 系が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 支出と収入で増加の色の意味が逆になるため、色だけでは読み違える。符号と矢印を常に併記して回避する。
- Architecture fitness test: 直書き色が 0 件であること。増減表示のすべてに符号が付くこと。ナビとパンくずに『累計収支』が残らないこと。
- Load/failure/security validation: 狭幅で 2 カラム・3 カラムが縦積みになり本文が横スクロールしないこと。前年欠損のとき前年欄が `—` になること。
