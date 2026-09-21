---
graph_node_id: "arch-statements-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "決算書 — 問いの見出しから根拠へ降りる 1 画面と、負債の 3 状態入力"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "ui-ux"]
file_path: "architecture/statements-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c0bfb4dcb73ff2a5fe9d619b8fc6b0bcf742184d11c5ec7eaae9a9c8889b2809"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "c0bfb4dcb73ff2a5fe9d619b8fc6b0bcf742184d11c5ec7eaae9a9c8889b2809", "imported_at": "2026-09-19T23:36:20Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T23:36:20Z"
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-frontend", "arch-statements-backend", "arch-statements-database", "arch-statements-auth", "arch-statements-security", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
resource_scope: ["packages/web/src/pages/statements/", "packages/web/src/pages/Statements.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Page.tsx", "docs/ui-decisions.md", "design/FINAL-UI/images/11-statements.png"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/statements-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:06:39Z"}
serves_goals: ["G1", "G3", "G4"]
---

# Architecture overview

決算書画面 — 問いの見出しから根拠へ降りる 1 画面と、負債の 3 状態入力。`system-spec/ui-ux.md` は承認時入力、本書は ui-ux 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-statements-screen.md`。

## Context and drivers

- Business/technical context: `packages/web/src/pages/Statements.tsx` は現在 `StatementsPage` の 2 行の re-export で、KPI・PL・CF・BS・負債入力は `pages/statements/*` に分割済みである。表示値は core の `statementsScreen`、CF 表示は `StatementsCf.tsx`、負債の 3 状態入力は `StatementsBs.tsx` が担う。657 行の単一実装で前期比・出典・段階損益・CF 原因・未入力判定を欠いていた点は再設計前の課題である。`design/FINAL-UI/spec/AUDIT.md:17` と基準画像は、その差分を追跡する根拠として残す。
- Quality attribute priorities: G1・G3・G4 に資する。Apple HIG の『明確さ』『階層』、WCAG 2.2 AA、WAI-ARIA APG の Tabs パターン (tablist を使わない根拠) と MDN の aria-current (ページ内ナビ)。
- Constraints: 既存のデザイントークン・共通 Button・PageShell・usePeriod の上に組む。直書き色は lint (check-design-tokens) が落とす。新しいチャートライブラリを足さない。

## Goals and non-goals

- Goals:
  - G1: 11-statements.png の構成 (spec 1.1〜1.11) を 1 画面で再現し、読込・空・失敗・前期欠損・保存中 / 失敗の各状態を持つ。
  - G3: CF が集計できないときは不能表示 (原因 3 種の件数・解決方法 3 手順・取引データを確認) に切り替え、表とグラフを出さない。
  - G4: 負債を項目ごとに『未入力 / 0円 / 金額を入力』の 3 択で入れ、未保存件数を下部固定バーに出す。
- Non-goals:
  - サイドバー・ヘッダー・フッター (共通シェル) の作り直し
  - 資産側 (現金・売掛金) の手入力 UI
  - 画像の誤った月次表ラベルと月見出しの再現 (`950`〜合計 `12,480` は千円値として整合するため、core の千円 fixture と web の万円換算を正本にする)

画像忠実度は、基準画像と同じ 834px 幅で overlay を行い、動的な金額・日付・グラフ値と
`docs/ui-decisions.md` の 6 件を除く差分が 0 件になったときだけ達成とする。現行証跡は構造と操作までで、画像忠実度は未達。

## System context and boundaries

- Users/external systems: 利用者 1 名。ブラウザのみ。
- Trust/deployment/data boundaries: 画面は API の `screen` を描くだけで、数値の計算を持たない。下書きはブラウザ内の localStorage に留める。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 期間バー + 見出し | 期間の範囲表示と前後移動 (同じ長さでずらす)、問い『損益・資金・残高は、整合していますか？』と説明文 | usePeriod | packages/web | web ビルド |
| KPI 4 枚 | 売上高・営業利益は前期比の金額と %、現金増減は前期比の金額のみ (画像どおり % なし)、負債残高は前月末比の金額と % で減少を良化色・増加を注意色。各々 出典と対象期間 / 基準日。必須未入力で負債は『未入力あり』 | props (screen.kpis) | packages/web | web ビルド |
| ページ内ナビ (画像のタブの見た目) | `<nav aria-label="計算書">` の 3 リンク (#pl / #cf / #bs)。選んだ項目だけ aria-current="location"、`?tab=` に保ち、該当節の見出し (tabIndex=-1) へ移動してフォーカス | URL | packages/web | web ビルド |
| PL 表 + 項目の詳細 | 5 行 × 当期・前期・差額・構成比、行の展開、`?row=` の選択で右パネル (金額・計算式・主な内訳 3 件・月別推移・出典・明細を開く) | props + URL | packages/web | web ビルド |
| 月別推移 + 月次表 | 売上高・売上原価の棒と営業利益の線、月次の損益計算書 (万円・合計列) | props | packages/web | web ビルド |
| CF セクション | 不能表示と営業 CF 概算の切替 | props (screen.cf) | packages/web | web ビルド |
| BS セクション | 未入力の警告バナー、基準月ピッカー、3 択の負債入力、エラー文、下書き時刻、リセット / 保存 | props + mutation | packages/web | web ビルド |
| 未保存バー | 未保存の項目数を下部に固定表示 | props | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: 既存の認証済みシェル配下。画面側で追加の認可判定を持たない。
- Errors/resilience: 一覧の失敗は PageState error、保存の失敗は BS セクション内に role=alert で理由を出し下書きを残す。前期が無い月は % を『—』にして金額差だけを出す。
- Observability/audit: N/A: 画面は実行時の信号を足さない (保存の監査は `architecture/statements-security.md`)。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: ルート `/statements` のまま。`?tab=` `?row=` `?ref=` を足すだけで既存リンクは壊れない。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/statements-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

SPA のクライアント描画。概要 (KPI) → PL 表と詳細 → 月次 → CF → BS の順に、概要から根拠へ降りる階層で縦に並べ、上部のナビは該当セクションへの移動として働く (3 セクションを常に描画し、隠さない。tablist は一度に 1 パネルだけを見せる前提なので使わない)。

#### Routes, screens and navigation

`/statements` のまま。`?tab=pl|cf|bs` `?row=<行 id>` `?ref=YYYY-MM` を URL に保ち、再読込・戻る・共有で復元する。『明細を開く』は `/classify?category=&month=` へ遷移する。CF 不能表示の『取引データを確認』は取引データ画面へ遷移する。

#### Component and design-system boundaries

節の移動は nav のリンクで、選んだ項目だけに aria-current="location" を付ける (role=tab を使わない)。PL の行の選択は勘定科目セル内の共通 Button に aria-pressed、`›` の展開は別の Button に aria-expanded を付ける。増減は符号と矢印を併記して色だけに頼らない。負債の 3 択は radio group (未入力 / 0円 / 金額を入力)、『金額を入力』のときだけ金額欄を出す。『0円と未入力は区別されます』を常に示す。色は既存トークン、ボタンは共通 Button、遷移は `Link className=btn`。

#### State and data flow

サーバ状態は TanStack Query、選択 (tab・row・ref) は URL、負債の入力中の値はローカル state + localStorage の下書き。未保存件数は保存済みの値と入力中の値の差分の項目数。

#### Backend integration

GET /api/statements (期間 + ref) の `screen` を 1 本読み、PUT /api/balances/liabilities で保存する。金額・% ・構成比・原因件数は API の値をそのまま描き、画面で足し直さない。

#### Performance and observability

決算書の部品はルート単位で分割読込し、初期 JS 予算 (js-budget) を超えない。取得中は各カードの骨格を保つ。

#### Frontend verification

DOM テストで、検算済みフィクスチャ (spec §6) の KPI・PL 5 行・月次表 (core の 8 月売上高 570,000 円を web では 57 万円と表示するなど)・詳細パネルの計算式と内訳・CF 不能表示の原因件数 (12 / 1 / 3)・負債の 3 状態と未入力あり・未保存バーの件数を確かめる。nav の aria-current が選んだ 1 項目だけに付くこと、role=tab が無いこと、行ボタンの aria-pressed、負債 KPI の『前月末比』ラベルと減少時の良化色、現金増減 KPI に % が無いことを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-statements-decision-006 | 3 セクションを縦に常時描画し、上部は nav + aria-current のページ内ナビにする | 本物のタブで他セクションを隠す / 見た目だけタブで role なし | 利用者が推奨案を選んだ。整合確認は PL・CF・BS を見比べる作業で、隠すと比較できない | 画像のタブの見た目は保ち、意味は nav。スクロールで aria-current を自動更新しない |
| qa-statements-decision-005 | 負債残高 KPI は前月末比の金額と % で、減少を良化色・増加を注意色にする | 画像どおり前期比で減少を赤 | 利用者が推奨案を選んだ。残高 (ストック) は 12 か月前と比べても意味が薄く、減少は改善 | 画像の文言と色から意図的に外れる (docs/ui-decisions.md に記録) |
| qa-statements-ui-ux-web-002 | 必須 3 項目のどれかが未入力なら KPI の負債残高を『未入力あり』にし合計を出さない | 画像どおり合計 2,300,000 を出す | 未入力を 0 とみなした合計は G4 の『0円と未入力を取り違えない』に反する | 画像と KPI の表示が意図的に異なる (spec 1.4 に明記) |
| qa-statements-image-observations-001 / qa-statements-monthly-pl-unit-001 | core の千円 fixture を数値の正本にし、web は円から万円へ換算する | 画像の `950`〜合計 `12,480` を万円として写す | 観察した事実: 数値は千円なら上部合計と整合するが、画像の単位ラベルと月見出しは不整合 | レイアウトは画像、単位と見出しは仕様・fixture を正本にする |
| qa-statements-decision-001〜004 | 負債は 3 項目必須 + その他は任意、下書きはブラウザ内、CF は既存の営業 CF 概算 + 原因別件数 | 全項目必須 / サーバ下書き / 直接法 CF | 利用者が推奨案を選んだ | その他の負債は未入力でも KPI を止めない |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド。
- Migration sequence: URL 契約 (tab・row・ref) → KPI → PL 表と詳細 → 月次 → CF 切替 → BS の 3 択入力と下書き → 未保存バー → 旧 KPI・旧 LiabilityForm の撤去と旧 DOM テストの更新。
- Rollback trigger/procedure: DOM テスト・js-budget・lint が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 3 セクション常時描画とページ内ナビで、スクロール位置と `?tab=` / aria-current が食い違う。ナビの操作を起点にだけ URL と aria-current を更新し、スクロール監視で書き換えない (agent-decisions-001)。
- Risk/assumption: 『未入力』を 0 と描くと利用者が 0 円と誤読する。数字の代わりに状態の文言を出す。
- Architecture fitness test: web に金額の和 (reduce) が無いこと。直書き色が無いこと。
- Load/failure/security validation: js-budget を超えないこと。`dangerouslySetInnerHTML` が本画面に無いこと。
