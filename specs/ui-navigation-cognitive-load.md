---
graph_node_id: "spec-ui-navigation-cognitive-load"
artifact_kind: "specification"
artifact_subtypes: ["frontend"]
title: "共通ナビゲーションと認知負荷低減の仕様"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
owners: []
tags: ["navigation", "cognitive-load", "accessibility"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-29T15:30:44Z"
updated_at: "2026-08-29T15:30:44Z"
depends_on: []
related_nodes: ["arch-ui-navigation-experience", "arch-ui-navigation-frontend"]
resource_scope: ["packages/web/src"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/ui-navigation-cognitive-load.md"
template_id: "specification"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-findings.json","evaluated_digest":"3195ec958c81ee2127d451db2a30793dad647ed4d273c6bb0c5e423c0b7ff5e6"}
source_lineage: {"origin_kind":"system-spec-harness","source_plugin":"system-spec-harness","source_path":"system-spec/index.md","source_version":"0.1.12","source_digest":"3195ec958c81ee2127d451db2a30793dad647ed4d273c6bb0c5e423c0b7ff5e6","imported_at":"2026-08-29T15:30:44Z"}
classification_confidence: 1.0
classification_reason: "C19 spec dispatchがconfirmed system-spec indexを取り込んだため分類は一意。"
classification_candidates: []
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"open","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status":"complete","missing_sections":[],"checked_at":"2026-08-29T15:30:44Z"}
---

# 目的と成功状態

全画面で現在地と次の主操作を直感的に理解でき、必要な情報だけを追いながら安全に閲覧・編集できる。

**画面単位の定義(2026-08-30更新)**: 本仕様の「画面」は**15ルート+支出分析(`/analysis/:tab`)の3タブ=18単位**を指す。着手時点の17ルートのうち、増減マトリクス・支出トレンド・統計診断の3つは出口が同じ(見直す勘定科目を1つ選ぶ)ため`/analysis/:tab`へ統合した。以下、本文で「全route」「全単位」と書くときはこの18単位を指し、「15 route」と書くときはサイドバーに行を持つルートだけを指す。判断の理由は`docs/ui-decisions.md`、運用契約は`docs/ui-navigation-guidelines.md`が持つ。

## スコープ

- In: 共通サイドバー、モバイルナビゲーション、情報階層、段階表示、編集導線。
- Out: 会計計算、API、データモデル、認証、インフラ、専用ネイティブアプリ。

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| current item | 現URLに対応し1画面で最大1件だけ選択される項目 |
| 単位 | サイドバーに行を持つ15 routeと、支出分析の3タブを合わせた18個の画面単位 |
| 画面検索 | `Cmd+K` / `Ctrl+K`で開く、名前から画面単位へ直接移動する経路 |
| progressive disclosure | 主目的と警告を初期表示し補足を必要時だけ開示する設計 |
| 利用者 | 会計の専門知識がなくても収支確認・分類・申告準備を行う本人 |

## ユースケースとユーザーフロー

1. アイコンとラベルで画面を選び、遷移後の現在地を1件だけ認識する。
2. 画面目的・重要状態・主操作を先に確認し、補足を必要時だけ展開する。
3. 編集対象、保存、取消、危険操作を見分けて編集を完了または中止する。
4. 行き先の名前が分かっているときは、サイドバーを走査せず画面検索から直接移動する。
5. 支出分析では、同じ対象期間のまま3つの切り口(増減マトリクス・支出トレンド・統計診断)をタブで往復し、見直す勘定科目を1つ決める。

## 機能要件

- `FR-001`: `/tax/receipts`では「領収書の残り」だけをcurrentとし、親`/tax`を同時選択しない。
- `FR-002`: `APP_ROUTES`(15)と`ANALYSIS_TABS`(3)の全18単位に、意味の異なるアイコン識別子と可視ラベルを持たせる。一意性はアイコンキーではなく**図形の署名**で判定する(キーが違っても見た目が同じなら区別にならないため)。
- `FR-003`: アイコン・ラベル間隔、行高、グループ間隔を共通tokenで揃える。
- `FR-004`: currentは色だけに依存せず`aria-current=page`と形・コントラストで示す。
- `FR-005`: 全ページで画面目的、重要状態、主操作を優先し、補足を段階表示する。
- `FR-006`: 通常の画面移動をmodalで遮らず、確認または短い文脈編集だけにmodal/drawerを使う。
- `FR-007`: 編集UIは対象名、保存、取消、危険性、処理中・成功・失敗状態を識別できる。
- `FR-008`: 全ページから`Cmd+K` / `Ctrl+K`で画面検索を開き、ラベル・目的文・群名から18単位すべて(サイドバーに行を持たない3タブを含む)へ移動できる。検索対象は`routeMetadata.ts`の正本をそのまま使い、検索側に画面一覧を二重に持たない。
- `FR-009`: 支出分析は`/analysis/:tab`としてタブ状態をURLに持ち、リンクで組む。表示中のタブだけを描画し、APIも1本だけ呼ぶ。対象期間は`PeriodProvider`が持ちタブ間で保たれる。
- `FR-010`: 統合前の3画面が持っていた説明文(色の凡例、判定基準など)は`ANALYSIS_TABS`へ移し、タブごとの段階表示として保持する。画面を束ねるときに説明を捨てない。

## 非機能要件

- Performance: 外部icon runtimeを追加せず型付きinline SVG registryを使う。支出分析は表示中のタブのAPIだけを呼び、3本を束ねて同時に投げない。
- Accessibility/Usability: keyboard、focus-visible、200%拡大、reduced-motionを維持する。操作領域はタップ環境(`pointer: coarse`)と640px以下で44px、`pointer: fine`のデスクトップでは36pxとする(WCAG 2.5.5はAAAでポインタ環境には SC 2.5.8 の24pxが掛かるため)。画面検索はネイティブ`<dialog>`で組み、Escape・フォーカストラップ・背面の不活性化をブラウザ実装に任せる。候補は素のbuttonとし`role="listbox"`を手組みしない。
- Security/Privacy: 表示構造だけを変更し実データ・認証・API境界は変えない。
- Maintainability/Operability: route metadataと共通componentを正本にし全単位へ重複実装しない。画面数・タブ本数のような数値は`routeMetadata.ts`を正本とし、文書側で二重に持たない。

## UI・状態遷移

- Navigation: inactive→currentは厳密route matchでcurrent件数0または1。`/analysis/:tab`のいずれにいてもサイドバーのcurrentは「支出分析」1件。
- Tabs: `/analysis`は既定タブへ解決し、タブ移動は実際のページ遷移として履歴に残る。タブ内の表示切替(金額/前月比、事業/家計)はタブ切替で初期値へ戻る。
- Command palette: closed→open(検索欄にfocus)→移動またはEscapeでclosed。開くたびに前回の絞り込みを捨てる。
- Disclosure: collapsed→expanded→collapsed。重要警告と主操作はcollapsedでも見える。
- Editing: idle→editing→saving→saved/error。取消はidleへ戻る。
- Loading/Empty/Error: 既存PageStateを維持し次の行動を表示する。

## ビジネスルールと検証

- `BR-001`: ラベルをアイコンだけに置換しない。
- `BR-002`: 税務警告、保存結果、現在の編集対象を隠さない。
- `BR-003`: 現在地・重要度・操作可能性を運ばない装飾を増やさない。現在地の強調も同じ規準で数を絞り、背景と識別できないほど弱い手掛かり(白地に対し1.11:1など、hover状態と見分けられないもの)は足さない。
- `BR-004`: 画面を束ねるとき、束ねられた側の説明文を捨てない。
- `BR-005`: 出口(利用者が下す判断)が異なる画面、または書き込み操作を持つ画面を同じタブ帯に並べない。タブの切替は「同じ対象の別の見方」でなければならない。

## API契約

N/A: Web表示と操作導線だけを変更しAPIは変更しない。

## データモデル

- Entity/Value: `APP_ROUTES`に型付きicon識別子と、段階表示用の`taskDetail`を必須フィールドとして持つ。タブは`ANALYSIS_TABS`が同じ形で持ち、`SEARCH_ROUTES`が両者を画面検索向けに束ねる。旧URLの対応は`LEGACY_ROUTE_REDIRECTS`が持つ。
- Ownership/Retention/Migration: client metadataのみ。永続データ移行なし。

## 認証・認可

- Authentication/Authorization/Tenant boundary: 既存契約を維持する。

## エラー・例外・回復

- Error taxonomy: 新規backend errorなし。保存失敗は対象と再試行方法を表示する。
- Retry/Timeout/Fallback: icon描画に依存せずlabelで操作可能。
- Idempotency/Concurrency: 再遷移でcurrent件数が増えない。

## イベント・非同期処理

- Producer/Consumer: N/A。既存query/mutation lifecycleだけを利用する。
- Delivery/Ordering/Deduplication/DLQ: N/A。

## 可観測性

- Logs/Metrics/Traces/Audit: DOM contractと、実Chrome(CDP)で`getBoundingClientRect` / `getComputedStyle`から取った実測値を証跡化する。スクリーンショットの目視より再現性が高い。
- Alert/SLO dashboard: N/A。

## 互換性・移行・リリース

- Compatibility/versioning: 統合対象を除く既存route pathとlabelを維持する。統合した`/matrix` `/trends` `/diagnosis`は削除せず、`LEGACY_ROUTE_REDIRECTS`で各タブへ`replace`リダイレクトし、ブックマークの行き先を失わせない。
- Migration/backfill: 不要(client metadataのみ)。
- Rollout/rollback: Web bundle差分のみ。回帰時は共通UI差分を戻せる。

## テストと受入条件

- [x] `AC-001`: `/tax/receipts`でcurrent navが1件だけ。
- [x] `AC-002`: 全18単位にiconと可視labelがあり、図形の署名が一意である。
- [x] `AC-003`: currentが`aria-current=page`を持ち色なしでも識別できる。左帯のコントラストは3:1以上(実測6.46:1)。
- [x] `AC-004`: 全18単位で目的・主操作・重要警告が初期表示から失われず、`taskDetail`が段階表示で開く。
- [x] `AC-005`: 編集surfaceで対象、保存、取消、危険性、保存結果を識別できる。
- [x] `AC-006`: unit/DOM/build/UI contract/主要viewport visual確認がPASSする。
- [x] `AC-007`: `Cmd+K` / `Ctrl+K`で画面検索が開き、18単位すべてを名前と群名で引ける。サイドバーに行を持たない3タブも引ける。
- [x] `AC-008`: 旧URL `/matrix` `/trends` `/diagnosis` が対応するタブへリダイレクトされる。
- [x] `AC-009`: 統合で消えた3画面の説明文が`ANALYSIS_TABS`に残り、用語リンクの総数が検査で固定されている。

検証は**実Chrome(CDP)での実描画計測**による。CSSの正規表現照合(描画を一切見ていない)は全廃した。

## 未決事項

- **意匠の妥当性の人手レビューが未実施**。配色や余白が「美しいか」は計測で判定できない。
- **Chrome以外のブラウザでの描画差が未確認**。実描画検査はChromeのみで行っている。
- サイドバー総高は800px(15行×36px+群見出し4本)で、ノートPCのブラウザ実効高600〜700pxにはまだ収まらない。統合の成果は高さではなく、最上位の選択肢が「見る」群で8→6へ減ったことにある。
