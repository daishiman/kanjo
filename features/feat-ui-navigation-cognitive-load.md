---
graph_node_id: "feat-ui-navigation-cognitive-load"
artifact_kind: "feature"
artifact_subtypes: []
title: "共通ナビゲーションと認知負荷の改善"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
owners: []
tags: ["navigation", "sidebar", "progressive-disclosure", "editing-safety"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-29T15:34:00Z"
updated_at: "2026-08-29T15:34:00Z"
depends_on: []
related_nodes: ["spec-ui-navigation-cognitive-load", "arch-ui-navigation-experience", "arch-ui-navigation-frontend"]
resource_scope: ["packages/web/src"]
purpose: "長い文字中心のサイドバー、親子routeの二重選択、常時表示情報の過多により、利用者が現在地・次の操作・安全な編集方法を判断しづらい状態を解消する。"
goal: "全画面(15route + 3タブ = 18単位)で現在地が一意かつアイコンとラベルで識別でき、重要情報と主操作を先に理解し、必要時だけ詳細や編集UIへ進める。"
scope_in: ["/taxと/tax/receiptsのcurrent一意化", "全routeの型付きアイコン", "sidebarのicon-label-group spacing", "情報優先度と段階表示の共通パターン", "編集対象・保存・取消・危険性の明示", "desktop/mobile/zoom/keyboardの回帰確認", "見る群3画面の/analysis/:tabへの統合", "画面検索(Cmd+K)"]
scope_out: ["会計計算変更", "API変更", "データモデル変更", "認証変更", "インフラ変更", "専用ネイティブアプリ", "通常遷移をmodal化", "本番deployとPR作成"]
acceptance: ["/tax/receiptsでcurrent navが領収書の残り1件だけになる", "全route(15route + 3タブ = 18単位)に意味の異なるiconと可視labelがある", "icon-label間隔とnav行高・group間隔が共通tokenで整う", "currentがaria-current=pageと色以外の手掛かりを持つ", "全18単位で目的・重要状態・主操作が初期表示から失われない", "補足情報は文脈を保つ段階表示になり通常遷移をmodalが遮らない", "編集surfaceで対象・保存・取消・危険性・処理結果を識別できる", "unit・DOM・build・UI contract・主要viewport visual確認がPASSする"]
architecture_refs: ["arch-ui-navigation-experience", "arch-ui-navigation-frontend"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-ui-navigation-cognitive-load.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"dev-graph-integrity-auditor","evidence_ref":".dev-graph/receipts/decompose.json","evaluated_digest":"9fff22c22336a1058e11df49bd411fc2b3bf35e90dba62e3978b025f327af4f2"}
source_lineage: {"origin_kind":"generated","source_plugin":"dev-graph","source_path":"specs/ui-navigation-cognitive-load.md","source_version":"0.1.9","source_digest":"9fff22c22336a1058e11df49bd411fc2b3bf35e90dba62e3978b025f327af4f2","imported_at":"2026-08-29T15:34:00Z"}
classification_confidence: 1.0
classification_reason: "C14 decomposeが承認済みwantを単一のマクロfeatureへ分解したため分類は一意。"
classification_candidates: []
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"open","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status":"complete","missing_sections":[],"checked_at":"2026-08-29T15:34:00Z"}
---

# 目的

収支管理に不慣れな利用者でも、長いナビゲーションから迷わず現在地と次の操作を見つけ、情報量に圧倒されず安全に閲覧・編集できるようにする。

## 到達状態

全画面(15route + 3タブ = 18単位)のroute metadata、共通Layout、アイコン、spacing、段階表示、編集surfaceが一貫し、税務画面の二重activeがなく、主要情報と主操作が常に先に理解できる。

## スコープ

- スコープ内: sidebar/mobile nav、icon registry、current判定、情報階層、progressive disclosure、editing safety、accessibilityとvisual regression。
- スコープ外: 会計/API/data/auth/infrastructure、専用native app、PR作成、本番deploy。

## 受入

状態の凡例: **充足**=証跡で確認済み / **部分**=構造は検証したが実描画での確認が未実施 / **実装不要と判定**=現行実装が既に条件を満たすと判断し、理由を証跡に記録済み。チェック済み(`[x]`)は充足と実装不要と判定のみ。

**画面数の更新(2026-08-30)**: 「見る」群の3画面(増減マトリクス/支出トレンド/統計診断)を `/analysis/:tab` へ統合したため、**17route → 15route + 3タブ**。受入条件の文言中の「17route」「全17ページ」は、統合後は「15route + 3タブ = 18単位」として読む。統合の判断は `docs/ui-decisions.md` の「決定の更新(2026-08-30)」に記録。

| 受入条件 | 対応FR/AC | 状態 | 根拠・残作業 |
|---|---|---|---|
| `/tax/receipts`のcurrentは「領収書の残り」1件だけ | FR-001 / AC-001 | 充足 | DOM testでcurrent数を固定済み |
| 全routeに意味の異なるiconと可視label | FR-002 / AC-002 | 充足 | 型のexhaustive check + `route-icon-distinct.test.tsx` が**図形の署名**で一意性を検査(キー一致では見た目の重複を見逃すため)。18icon、未使用0 |
| icon-label/nav-group spacingが共通tokenで一貫 | FR-003 / AC-003 | 充足 | tokenへの集約に加え、`scripts/check-mobile-layout.mjs` が**実描画で実測**(icon-label間隔・nav行高・tab icon寸法を375/360/375@zoom2/1280の4条件で計測) |
| currentは`aria-current=page`と色以外の手掛かりを持つ | FR-004 / AC-003 | 充足 | 実測により**強調6重のうち3つが逆効果**と判明し2重へ削減。左帯のコントラスト**6.46:1**(WCAG 1.4.11の3:1超)。強調の構成そのものを実描画テストで固定 |
| 全ページで目的・重要状態・主操作を初期表示 | FR-005 / AC-004 | 充足 | `taskDetail`による段階表示を全18単位に実装。`route-task-detail.test.tsx` が用語リンク総数(**53件**)とリンクゼロ単位0を固定 |
| 補足は段階表示し通常遷移をmodalで遮らない | FR-006 / AC-004 | 実装不要と判定 | 現行の遷移にmodalは挟まっておらず変更不要。判断は`evidence/phase-01-ui-audit.md`・`phase-03-design-review.md`と`docs/ui-navigation-guidelines.md`に記録 |
| 編集対象・保存・取消・危険性・処理結果を明示 | FR-007 / AC-005 | 実装不要と判定 | 既存のinline editorが対象名・保存・取消・未保存guard・処理結果を満たすため無変更。判断は`evidence/phase-05-implementation.md`ほかに記録 |
| unit/DOM/build/UI contract/主要viewport visual確認がPASS | AC-006 | 充足 | unit/DOM/build/UI contract: 52ファイル/296テストPASS。viewport visual: 実Chrome(CDP)による実描画検査3本が全合格 |

- [x] `/tax/receipts`のcurrentは「領収書の残り」1件だけ
- [x] 全routeに意味の異なるiconと可視label
- [x] icon-label/nav-group spacingが共通tokenで一貫
- [x] currentは`aria-current=page`と色以外の手掛かりを持つ
- [x] 全ページで目的・重要状態・主操作を初期表示
- [x] 補足は段階表示し通常遷移をmodalで遮らない — 実装不要と判定
- [x] 編集対象・保存・取消・危険性・処理結果を明示 — 実装不要と判定
- [x] unit/DOM/build/UI contract/主要viewport visual確認がPASS

### 「visual確認」の解釈について(2026-08-30)

以前の版は残りを「指定browser runtimeによる4幅のvisual確認(P07/P09)」に集約していたが、**`SYS-UINAV-P07.md` は特定のbrowser runtimeを指定していない**(要求は「主要viewportのvisual確認」)。本featureは実Chrome(CDP)で実際にレンダリングし、`getBoundingClientRect` / `getComputedStyle` で**数値として計測**する方式を採る。スクリーンショットの目視より再現性が高く、CSSの正規表現照合(=描画を一切見ていない)とは別物である。

ただし次の2点は、この方式でも**カバーしていない**:

- **意匠の妥当性**(配色や余白が「美しいか」)は計測では判定できない。人間のレビューが要る
- **Chrome以外のブラウザ**での描画差。検査はChromeのみ

- [ ] 上記2点の人手レビュー — 未実施(計測で代替できない領域)

## アーキテクチャ参照

- `architecture_refs`: `arch-ui-navigation-experience`, `arch-ui-navigation-frontend`

## 機能間依存

- `depends_on`: なし。
- 依存理由: 共有Web UIだけに閉じた単一featureで、確定spec/architectureは参照済み。

## Handoff

- per-feature planning: `/dev-graph plan --feature-id feat-ui-navigation-cognitive-load --feature-context features/feat-ui-navigation-cognitive-load.context.json`
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 共通`parent_feature`/`feature_package_id`でC02 atomic登録。
- 完了rollup: exact 13全doneかつP07/P10/P11 evidenceが受入8件を満たす場合だけdone。

