---
graph_node_id: "arch-statements-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "決算書 — 薄いページと `pages/statements/` の部品、1 本の取得と 1 本の保存、利用者別の下書き"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "frontend"]
file_path: "architecture/statements-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "e08a7544aa1da43742a06cd81aa8348b2c219aa4c1d153c69751660d9e010820"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "e08a7544aa1da43742a06cd81aa8348b2c219aa4c1d153c69751660d9e010820", "imported_at": "2026-09-19T23:36:20Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T23:36:20Z"
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-ui-ux", "arch-statements-backend", "arch-statements-database", "arch-statements-auth", "arch-statements-security", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
resource_scope: ["packages/web/src/pages/statements/", "packages/web/src/pages/Statements.tsx", "packages/web/src/period.tsx", "packages/web/src/statements-balance-sheet.dom.test.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/statements-frontend.md"}]
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

決算書画面 — 薄いページと `pages/statements/` の部品、1 本の取得と 1 本の保存、利用者別の下書き。`system-spec/frontend.md` は承認時入力、本書は frontend 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-statements-screen.md`。

## Context and drivers

- Business/technical context: `packages/web/src/pages/Statements.tsx` は `pages/statements/StatementsPage.tsx` の 2 行の re-export だけを持つ。KPI・PL・CF・BSは `StatementsKpis.tsx`・`StatementsPl.tsx`・`StatementsCf.tsx`・`StatementsBs.tsx` へ分割済みで、`GET /api/statements` の `screen` を描く。期間は `packages/web/src/period.tsx` の usePeriod、URL 状態と下書き・CSV だけを web が持ち、数値計算は core に集約する。657 行の単一ファイルと月単位の全削除保存は再設計前の課題である。
- Quality attribute priorities: G1・G3・G4 に資する。Clean Architecture の Dependency Rule (画面は計算規則を持たない)、Apple HIG の『操作に即座に応える』。
- Constraints: React 18 + react-router 7 + TanStack Query 5。既存トークン・共通部品。新しい外部依存を足さない (初期 JS 予算)。

## Goals and non-goals

- Goals:
  - G1: Statements.tsx を薄い組み立てにし、部品を `packages/web/src/pages/statements/` に分ける。
  - G3: CF セクションが `screen.cf.available` で不能表示と概算を切り替える。
  - G4: 負債の 3 状態入力・保存済みの値の初期表示・下書き・未保存件数。
- Non-goals:
  - 画面側での段階損益・前期比・構成比・原因件数の計算
  - 共通シェルの変更
  - 下書きのサーバ保存

## System context and boundaries

- Users/external systems: 利用者 1 名。ブラウザのみ。
- Trust/deployment/data boundaries: web は API の `screen` を描き、負債の保存を API へ送るだけ。下書きは localStorage に留め外部へ送らない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| StatementsPage | usePeriod と `?tab=` `?row=` `?ref=` を読み、部品を配置する | ルート `/statements` | packages/web | web ビルド |
| 取得と保存のフック (1 ファイル) | useQuery で GET /api/statements、useMutation で PUT /api/balances/liabilities、成功時に statements のクエリを invalidate | TanStack Query | packages/web | web ビルド |
| KpiStrip | KPI 4 枚 (比較先と色の規則は screen.kpis の値をそのまま描く) | props |
| StatementsNav | 画像のタブの見た目のページ内ナビ。`<nav aria-label="計算書">` の 3 リンク、選んだ 1 項目だけ aria-current="location"、節見出し (tabIndex=-1) へフォーカス移動 | URL | packages/web | web ビルド | packages/web | web ビルド |
| PlCard / PlDetailPanel | PL 表 (展開・エクスポート) と右の詳細パネル | props + URL | packages/web | web ビルド |
| PlTrendChart / MonthlyPlTable | 月別推移 (FinancialCharts の系列規約) と月次表。core の円値を 10,000 で割り万円表示 (`950,000円 → 95万円`、合計 `12,480,000円 → 1,248万円`) | props | packages/web | web ビルド |
| CashFlowSection | 不能表示と営業 CF 概算の切替 | props | packages/web | web ビルド |
| LiabilitySection | 基準月ピッカー・3 択・エラー文・下書き・リセット・保存 | props + mutation | packages/web | web ビルド |
| UnsavedBar | 未保存件数の下部固定バー、beforeunload | props | packages/web | web ビルド |
| 下書きストア | `kanjo.statements.liabilityDraft.<userId>.<YYYY-MM>` の読み書き (800ms の遅延)、ログアウト時の接頭辞一括削除 | 関数 | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: 既存の認証済みシェル配下。下書きのキーに userId を含める。
- Errors/resilience: 取得の失敗は PageState error。保存の失敗は LiabilitySection 内に role=alert で理由を出し、下書きを残す。localStorage が使えない (SecurityError・容量超過) ときは下書きを諦めて入力は続けられる。
- Observability/audit: N/A: 画面は実行時の信号を足さない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/statements は `{ screen }` だけの単一契約。旧キー (pl/cf/bs/period) を併記せず、web も `screen` 以外を参照しない。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/statements-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

SPA のクライアント描画。ページは配置だけを持ち、部品は screen の部分を props で受けて描くだけで、互いに計算結果を渡し合わない。

#### Routes, screens and navigation

`/statements` のまま。tab・row・ref は useSearchParams に保ち、同時に変えるときは 1 回の更新にまとめる。『明細を開く』は `/classify?category=&month=`。

#### Component and design-system boundaries

部品は `pages/statements/` 配下。チャートは既存 FinancialCharts の系列規約に乗せ、新しいチャートライブラリを足さない。色はトークン、ボタンは共通 Button、遷移は `Link className=btn`、本文は PageShell。

#### State and data flow

サーバ状態は TanStack Query (`['statements', period, ref]`)、選択は URL、負債の入力はローカル state。入力は 800ms の遅延で下書きへ保存し、保存時刻を出す。リセットで保存済みの値へ戻して下書きを消す。保存成功で下書きを消し、statements のクエリを invalidate する。

#### Backend integration

GET /api/statements の `{ screen }` だけを読む。`screen.bs.referenceMonth` が URL の `?ref=` と異なる (期間外・不正値を丸めた) ときは URL をその値で置き換える (replace)。PUT /api/balances/liabilities へ `{month, lines:[{category, status, amount?}]}` を送る。CSV エクスポートは web で組み、ASVS 5.0 1.2.10 に従い = + - @ タブ NUL で始まる文字列セルに ' を前置し、RFC 4180 で引用する (数値は数値のまま)。

#### Performance and observability

決算書の部品はルート単位で分割読込する。js-budget は build:bundle 直後に測る。

#### Frontend verification

DOM テスト: 検算済みフィクスチャで KPI・PL・月次表・詳細パネル・CF 不能表示・負債の 3 状態・未保存件数。nav の aria-current が 1 項目だけ・role=tab が無い・行ボタンの aria-pressed。丸められた ref で URL が置き換わること。下書きの復元・リセット・ログアウトでの消去。1 項目だけ変えて保存したとき PUT 本文にその項目だけが載ること。CSV の数式注入対策 (`=SUM(1)` のセルが `'=SUM(1)` になる)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-statements-frontend-web-002 | Statements.tsx を薄くし、部品を `pages/statements/` に分ける | 1 ファイルのまま拡張 | 再設計前の 657 行に詳細パネル・3 択・下書きを足すと変更が連動する | 部品の props が screen の部分型になる |
| qa-statements-frontend-web-002 / qa-statements-monthly-pl-unit-001 | 数値は API の screen を描き、月次表では円から万円への表示変換だけを行う | 画面で集計 / 画像値を万円として写す | core 1 か所で恒等式と前期比を保証し、表示単位の境界も固定する | 旧 KPI の画面側計算を消し、月次表は `95`〜合計 `1,248` と表示する |
| qa-statements-decision-003 | 下書きは localStorage の利用者別キーに 800ms の遅延で保存し、ログアウトで消す | サーバ下書き / sessionStorage | 利用者が推奨案 (ブラウザ内) を選んだ。タブを閉じても残る | 共有端末では同じブラウザに残るため、userId をキーに含めログアウトで消す |
| qa-statements-frontend-web-002 | CSV は web で組む | API で CSV を返す | 表示中の値をそのまま書き出せ、新しい経路が要らない | 数式注入対策を web の書き出し関数で担う |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド。
- Migration sequence: フック (取得・保存・invalidate) → 下書きストア → 部品を順に置換 → 旧 KPI・旧 LiabilityForm の撤去 → 旧 DOM テスト (`statements-balance-sheet.dom.test.tsx`) の更新。
- Rollback trigger/procedure: DOM テスト・js-budget・typecheck が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: useSearchParams の連続更新が同一 tick で積み上がらず、tab と row の片方が失われる。1 回の更新にまとめる。
- Risk/assumption: 下書きが保存済みの値より古いまま残り、保存済みの値を上書きして見せる。下書きを復元するときは保存済みの値と項目ごとに比べ、差のある項目を未保存として数えて固定バーに出す (黙って保存済みの値を隠さない)。
- Architecture fitness test: web に金額の和が無いこと。下書きキーに userId が含まれること。
- Load/failure/security validation: js-budget を超えないこと。localStorage が例外を投げても画面が落ちないこと。
