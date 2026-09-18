---
graph_node_id: "arch-subscriptions-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "サブスク画面 — 見直し候補を先に読ませる縦の並び・詳細パネル・検出理由カード"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "ui-ux"]
file_path: "architecture/subscriptions-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c57c493d5fccb5546f47fbcffb51582dfc2f062eb0e9a6e19d3aa556bf35321c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "c57c493d5fccb5546f47fbcffb51582dfc2f062eb0e9a6e19d3aa556bf35321c", "imported_at": "2026-09-18T07:04:09Z"}
created_at: "2026-09-18T07:04:09Z"
updated_at: "2026-09-18T07:04:09Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-frontend", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-auth", "arch-subscriptions-security", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/09-subscriptions.png", "design/FINAL-UI/spec/DESIGN-SYSTEM.md", "docs/design-system.md", "docs/ui-decisions.md", "packages/web/src/pages/Subscriptions.tsx", "packages/web/src/components/SubVendors.tsx", "packages/web/src/components/Layout.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:04:09Z"}
serves_goals: ["G1", "G2", "G3"]
---
# Architecture overview

サブスク画面 — 見直し候補を先に読ませる縦の並び・詳細パネル・検出理由カード。`system-spec/ui-ux.md` は承認時入力、本書は UI/UX 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-subscriptions-screen.md`。

## Context and drivers

- Business/technical context: 現行 `packages/web/src/pages/Subscriptions.tsx` (305 行) は、重複・急増の検知アラート (:118-133)、KPI 4 枚 (:137-163。1 枚目は `s.now.monthlyTotal` = 最新月の実支払、2 枚目は `annualized`、4 枚目の売上比の補足は『目安 10〜15%以内』)、ベンダー別の表 (:185 の列名は『年換算(直近月額×12)』)、ベンダー別の月次積み上げ棒 (:238-)、前年比較表 (:287-)、`SubVendorsPanel` (:296) を縦に並べる。未登録候補は `packages/web/src/components/SubVendors.tsx` (614 行) の `SubsCandidatesPanel` が別パネルで出す。参照画像 `design/FINAL-UI/images/09-subscriptions.png` の問いの見出し・KPI 5 枚・カバー率カード・一覧と右の詳細パネル・カテゴリ別推移・年換算比較・検出理由カード・下部の選択中バーのうち、現行にあるのは KPI の一部と推移 (ベンダー別) だけである。サイドバーは `packages/web/src/components/Layout.tsx:56` で『整える』群に置かれ、:246-247 がバッジに `reviewQueue.subscriptionCandidates` を出す。
- Quality attribute priorities: G1・G2・G3 に資する。Apple HIG / Information Design の『問いに答える順に並べ、最上位の判断を最初に読ませる』『要素ごとに残す・落とす・加工するを決める』『色だけに頼らない』、WCAG 2.2 AA を適用する。
- Constraints: 既存のデザイントークン・共通 Button・PageShell・PageState・期間タブ (usePeriod) の上に組む。web SPA 1 系統のレスポンシブ (qa-subs-target-platforms-001)。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。ロゴ (サービスのアイコン) 画像は取得も表示もしない。

## Goals and non-goals

- Goals:
  - G1: 画像の全構成要素 (問いの見出し『毎月の固定費に、重複や見直し候補はありますか？』と説明文・KPI 5 枚と前期間比・カバー率カード 3 区分と最終更新・再取得・一覧 (検索 / ステータス絞込 / 行チェック / 9 列 / 合計行)・月次のサブスク支出推移・年換算の比較) と、読込・空・失敗の各状態を描く (spec §3〜§8, §11)。
  - G2: 一覧で選んだサブスクの『サブスクの詳細』パネル (概要 / 取引履歴 / 関連データのタブ、正規化名と生の取引名、月額の推定と年換算、直近の取引 3 件と『すべて見る (N件)』、データソース別件数、『名称を統合』『候補として確認』、閉じる) と、生の取引名を選んだときの下部バー『N件の取引を選択中』を与える (spec §6, §10)。
  - G3: 見直し候補の件数を KPI 5 枚目と一覧の候補バッジの 2 か所で先に読ませ、理由は『サブスク候補の検出理由』カードの定型文で読ませる (spec §3, §5, §9)。
- Non-goals:
  - サイドバー・ヘッダー・フッター・月次クローズ進捗の作り直し (既存踏襲。サイドバーのバッジの数え方は `architecture/subscriptions-backend.md`)
  - ロゴ・ベンダー名の頭文字・代替の図形の描画
  - AI による理由文の生成
  - 専用アプリ (mobile / tablet / desktop) 向けの版面

## System context and boundaries

- Users/external systems: 利用者 1 名が月次クローズの『整える』で、毎月の固定費に重複や見直し候補があるかを確かめ、候補ごとに確認・除外・統合を決める。
- Trust/deployment/data boundaries: 画面は共通シェル内。外部サービスへの取得 (ロゴ・AI) は持たない。操作の書き込み先は既存の /api/sub-vendors 系と新設の見直し判断 API だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出しカード | 問いの見出し・説明文・期間タブ | PageShell 見出し | packages/web | web ビルド |
| KPI 5 枚 | 月額のサブスク合計・年換算の合計 (前期間比つき)・直近 12 か月の支払額・売上比 (補足『売上に占める割合』)・見直し候補 N 件 (spec §3) | KpiCard | packages/web | web ビルド |
| カバー率カード | 銀行口座 / クレジットカード / 電子マネーの % と (分子/分母)、分類できない口座の件数、最終更新・再取得 (spec §4) | カード | packages/web | web ビルド |
| サブスク一覧 | 検索・ステータス絞込・行チェック・9 列・候補バッジ (『見直し候補』/『確認済み』)・合計行 (spec §5) | 表 | packages/web | web ビルド |
| サブスクの詳細パネル | 3 タブ・正規化名とカテゴリの編集・生の取引名・直近の取引・データソース別件数・2 操作・閉じる (spec §6) | パネル | packages/web | web ビルド |
| 月次のサブスク支出推移 | カテゴリ別の積み上げ棒と凡例 (spec §7) | チャート | packages/web | web ビルド |
| 年換算の比較 | カテゴリ別の月額 / 年換算 / 構成比 / 前期間比と合計行 (spec §8) | 表 | packages/web | web ビルド |
| サブスク候補の検出理由カード | 定型文の理由・『候補を採用』『候補から除外』『この候補を詳しく見る』(spec §9) | カード | packages/web | web ビルド |
| 下部の選択中バー | 『N件の取引を選択中』・選択チップの解除・選択した N 件を統合・選択を解除 (spec §10) | 固定バー | packages/web | web ビルド |
| 共通シェル | サイドバー・ヘッダー・フッター (既存のまま) | Layout | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: N/A: 表示範囲は認証済みシェルに従う (`architecture/subscriptions-auth.md`)。
- Errors/resilience: 読込中は各カードの骨格を保つ表示、データ 0 件は一覧の位置に空状態、一覧の取得失敗は PageState の error とする (spec §11)。詳細パネルだけの取得失敗はパネル内に留める。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 旧 UI の機能は失わず画像の部品へ移す — 別名・対象科目の編集と四半期見直しは詳細パネルの『関連データ』タブへ、重複・急増アラートは検出理由カードへ、未登録候補パネルはステータス絞込『未登録の候補』へ (dec-subs-legacy-ui)。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

縦の並びは画像どおり 見出し → KPI 5 枚 → カバー率 → 一覧と右の詳細パネル → 推移と検出理由 → 年換算比較 とする。画面の問いは『重複や見直し候補はあるか』なので、最上位の判断である見直し候補の件数を KPI 5 枚目と一覧の候補バッジの 2 か所で先に読ませる。月額・年換算・直近 12 か月・売上比は規模の把握、カバー率は数字を信じてよいかの前提として候補より手前に置く。ロゴの位置には何も置かず、ベンダー名の頭文字も描かず、名称と金額の列に幅を回す。

#### Routes, screens and navigation

`/subscriptions`。詳細パネルは一覧で行を選んだときだけ開き、選択は URL (`?vendor=<照合キー>`) に保って再読込でも復元する。× で閉じると URL から消す。検出理由カードの『この候補を詳しく見る』は同じ `?vendor=` を立てて詳細パネルを開く。サイドバー・パンくずは既存の共通シェルを使う。

#### Component and design-system boundaries

部品は既存の共通資産だけを使う (PageShell / PageState / KpiCard / DataTable / 共通 Button / Term / HowTo)。色は既存トークンのみ。詳細パネルのタブは WAI-ARIA の tabs パターン (左右の矢印キーで移動、Tab でパネルへ)。ステータス絞込の選択肢は『すべてのステータス / 見直し候補 / 登録済み / 未登録の候補』。候補バッジと前期間比の増減は色だけで区別させず、文字と記号を必ず併記する。

#### State and data flow

見直し候補は 未判断 / 確認済み の 2 状態。確認済みにした候補は一覧に残し、候補バッジを『確認済み』に変える。KPI『見直し候補 N 件』とサイドバーのバッジは未判断の候補だけを数え、確認済みは数えない。『候補を採用』と『候補として確認』は登録済みベンダーでは同じ confirmed、『候補から除外』は dismissed。未登録の候補では『候補を採用』が既存のベンダー登録、『候補から除外』が既存の候補除外になる (qa-subs-review-decision-002)。KPI 2 枚目の見出しは『売上比』のまま、補足だけを『売上に占める割合』と書く (qa-subs-kpi-caption-001)。

#### Backend integration

金額・前期間比・カテゴリ・カバー率・候補とその理由文は画面側で再計算せず、API が返した値をそのまま描く。一覧の合計行・KPI 月額・年換算比較の合計は同じ定義の値で、画面が足し直した値で置き換えない (dec-subs-kpi-definition)。

#### Performance and observability

詳細パネルの取得中は、一覧で選んだ行の名称と月額を先に出し、タブ内の領域だけを読込表示にする (選択が効かなかったと誤解させない)。最終更新と再取得はカバー率カードに置き、いま見ている数値の時点と取込の抜けを同じ場所で確かめられるようにする。

#### Frontend verification

O1 の DOM テスト (問いの見出しと説明文・KPI 5 枚と前期間比・カバー率 3 区分と最終更新と再取得・一覧の検索 / ステータス絞込 / 9 列 / 合計行・推移の凡例と棒・年換算比較の合計行・読込 / 空 / 失敗、ロゴ画像要素 0 件)。O2 の DOM テスト (行選択 → 詳細パネル 3 タブと 2 操作、生の取引名 2 件選択 → 『2件の取引を選択中』→ 統合 API 呼出し、閉じる / 選択を解除で状態が戻る)。O3 の件数一致 (KPI 件数・一覧バッジ・検出理由カード)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-subs-review-candidate | 見直し候補を KPI 5 枚目・一覧の候補バッジ・検出理由カードの 3 か所に同じ結果で出す | 検出理由カードだけに出す | 画面の問いに対する答えを最初に読ませ、理由は後で読ませる | 3 か所の件数が食い違わないことを O3 で固定する |
| qa-subs-review-decision-002 | 確認済みは一覧に残しバッジを『確認済み』に変え、件数からは外す | すべて残す / すべて外す | 判断済みの契約を一覧で追えつつ、件数は残りの判断だけを示す | バッジに 2 語、件数は未判断だけ |
| qa-subs-kpi-caption-001 | KPI 2 枚目の補足を『売上に占める割合』とする | 画像どおり『総支出に占める割合』 | 見出し『売上比』と定義 (サブスク ÷ 売上) に合わせる。画像のこの 1 語だけを例外とする | 画像との差分はこの 1 語に限る |
| dec-subs-legacy-ui | 旧 UI を詳細パネル・検出理由カード・ステータス絞込へ吸収して撤去 | 旧パネルを画面下に残す | 画面が画像どおりになり、旧機能の操作は失われない | 移設先の対応表で欠落を検査する (`architecture/subscriptions-maintenance-ops.md`) |
| qa-subs-uiux-web-006 | ロゴの位置には何も置かず、頭文字も描かない | 頭文字の丸・既定アイコン | 画像取得をしないため、代替の図形で場所を取らない | 名称と金額の列に幅を回す |
| dec-subs-category | カテゴリ列・推移・年換算比較のカテゴリは core の辞書 + 利用者の上書き | 画面側で推定 | 取込直後から埋まり、詳細パネルで直せば以後は上書きが勝つ | 詳細パネルにカテゴリの変更操作を置く |
| dec-subs-coverage | カバー率は % と (分子/分母) を併記し、分類できない口座は別に件数を示す | % のみ | 数字を信じてよいかの前提を 2 種の数値で示す | カード 3 区分 + 分類不能の件数 |
| dec-subs-fixture-authority / dec-subs-kpi-definition / dec-subs-persistence | 画像は構成・文言・配置の正本、数値は検算済み fixture。KPI 月額は推定月額の和。操作の保存先は既存表の延長 | 画像の数値をそのまま期待値にする | 画像の合計欄は閉じていない | UI テストの金額は fixture から取る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド。
- Migration sequence: 問いの見出しと KPI 5 枚 → カバー率カード → 一覧 (検索・ステータス絞込・候補バッジ・合計行) → 詳細パネル (3 タブ・URL 選択) → 下部の選択中バー → カテゴリ別推移と年換算比較 → 検出理由カード → 旧 UI (アラート・前年比較表・SubVendorsPanel・SubsCandidatesPanel) の撤去。
- Rollback trigger/procedure: DOM テスト・check-financial-visuals が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 現行はサイドバーのバッジ (未登録候補の件数、上限 20) と画面の見直し候補が別の数で、画像の『見直し候補 2 件』とも一致しない。定義を 1 つの関数へ寄せるまで両者は食い違う (`architecture/subscriptions-backend.md`)。
- Risk/assumption: 旧 UI を撤去すると、別名・対象科目の編集と四半期見直しの入口が一時的に失われうる。関連データタブへの移設と旧テストの移設を同じ変更で行う。
- Architecture fitness test: ロゴ画像要素が 0 件であること。候補バッジと前期間比に文字と記号が併記されていること。KPI 件数・一覧バッジ・検出理由カード・サイドバーのバッジの件数が同一入力で一致すること。
- Load/failure/security validation: 狭幅で本文が横スクロールしないこと (表は自身の横スクロール容器の中)。WCAG 2.2 AA を維持すること。
