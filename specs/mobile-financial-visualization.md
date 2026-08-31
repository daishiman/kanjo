---
graph_node_id: "spec-mobile-financial-visualization"
artifact_kind: "specification"
artifact_subtypes: ["frontend"]
title: "モバイル財務可視化と意味同等性の仕様"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
owners: []
tags: ["mobile", "financial-visualization", "accessibility", "cognitive-load"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-30T09:25:39Z"
updated_at: "2026-08-30T09:25:39Z"
depends_on: []
related_nodes: ["arch-mobile-financial-experience", "arch-mobile-financial-frontend"]
resource_scope: ["packages/web/src", "packages/web/scripts"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/mobile-financial-visualization.md"
template_id: "specification"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-findings.json","evaluated_digest":"c85c48736c4c5c979dce3bc5cded486146687b04af1f8f13f3fb7a5d166fe3fc"}
source_lineage: {"origin_kind":"system-spec-harness","source_plugin":"system-spec-harness","source_path":"system-spec/index.md","source_version":"0.1.11","source_digest":"c85c48736c4c5c979dce3bc5cded486146687b04af1f8f13f3fb7a5d166fe3fc","imported_at":"2026-08-30T09:25:39Z"}
classification_confidence: 1.0
classification_reason: "C19 spec dispatchがconfirmed system-spec indexを、API変更なしのfrontend specificationとして一意に分類した。"
classification_candidates: [{"artifact_kind":"specification","confidence":1.0,"candidate_path":"specs/mobile-financial-visualization.md"},{"artifact_kind":"document","confidence":0.08,"candidate_path":"docs/mobile-financial-visualization.md"}]
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"open","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status":"complete","missing_sections":[],"checked_at":"2026-08-30T09:25:39Z"}
---

# 目的と成功状態

外出先や片手操作のモバイル環境でも、財務グラフ・比較図・高密度表が幅を理由に消えず、結論・期間・単位・異常・次の行動を短時間で理解できる。canvasを操作できない場合も、同じ集計値から作る要約・凡例・semantic tableでデスクトップと同じ財務上の結論へ到達できる。

## スコープ

- In: `packages/web` の全route、財務chart/figure、KPI、高密度表、legend、tooltip代替、safe-area、44px操作領域、zoom/keyboard/screen reader、匿名実Chrome回帰。
- Out: 会計計算、API、認証認可、D1/R2、Cloudflare構成、ネイティブiOS/Android、本番deploy、実データfixture。

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 財務上の結論 | 期間・単位・符号・比較基準を含む、変化・異常・次の確認先の判断 |
| 意味同等表現 | canvasと同じ集計view-modelから生成する見出し要約・凡例・semantic table |
| 利用者 | 移動中や短い空き時間に収支状態を確認する本人。会計やグラフに不慣れな人、支援技術利用者を含む |

## ユースケースとユーザーフロー

1. 利用者はモバイルで画面を開き、初期表示の結論・期間・単位・異常を確認する。
2. 必要な場合だけ詳細chart、凡例、値の表を段階的に読み、見直す対象を決める。
3. chartを操作できない利用者も、読み上げ可能な要約と表から同じ判断を完了する。

## 機能要件

- `FR-001`: 全財務chart/figureを360px・375px・390pxで非表示または0寸法にしない。
- `FR-002`: 各figureに可視見出し、結論要約、期間、単位、凡例、同一view-model由来のsemantic tableを持たせる。
- `FR-003`: 狭幅ではtick間引き、凡例再配置、高さ調整、局所scroll、カード化を使うが、主要series・符号・比較基準を失わない。
- `FR-004`: 高密度表はページ全体を横あふれさせず、見出し文脈を保つ局所scrollまたは意味単位のカードへ変換する。
- `FR-005`: safe-areaと固定tabbarで本文最終行、主操作、popover、tooltip代替を隠さない。

## 非機能要件

- Performance: 既存Chart.js 4/react-chartjs-2を維持し、外部chart/UI runtimeを追加せずbundle budgetを回帰させない。
- Availability/Reliability: Resizeや表示切替後もcanvasの可視幅・高さを正値に保ち、検査不能をPASSにしない。
- Accessibility/Usability: WCAG 2.2 AA相当、320 CSS px reflow、200% zoom、keyboard、focus-visible、非色依存、coarse pointer主要操作44×44 CSS px以上。
- Security/Privacy: 匿名fixtureだけを使用し、実明細・金額・口座・secretを成果物、ログ、画像へ含めない。
- Maintainability/Operability: chartとsemantic表を同一view-modelから生成し、会計値の二重計算を禁止する。

## UI・状態遷移

- 画面状態: loading→summary+figure、empty→理由+次の操作、error→対象+回復方法、ready→要約+chart+詳細表。
- viewport遷移: desktop/tablet/mobileで情報を削除せず、並び・密度・開示段階だけを変更する。
- reduced-motionでは装飾animationを無効化し、状態変化を文言とARIAで伝える。

## ビジネスルールと検証

- `BR-001`: 視覚簡略化で金額の符号、期間、単位、比較基準を変えない。
- `BR-002`: `display:none`で重要なfigureや警告を削除しない。代替表だけへ切り替える場合も同じ判断材料を保持する。
- `BR-003`: 情報優先順は結論→期間/単位→異常→次の行動→詳細値とし、装飾は意味を運ぶ場合だけ使う。

## API契約

N/A: 既存API responseとReact Query境界を維持し、表示変換だけを変更する。

## データモデル

- Entity/Value: 永続modelは変更しない。clientのchart view-modelがlabels、series、unit、period、summary、semantic rowsを所有する。
- Fields/Types/Nullability: 既存API型を入力にし、欠損時はempty/error状態へ明示的に分岐する。
- Relations/Constraints/Indexes: N/A: 永続schemaを変更しない。
- Ownership/Retention/Migration: Web bundle内の派生表示のみでmigrationなし。

## 認証・認可

- Authentication: 既存session契約を維持する。
- Authorization: 既存owner/tenant認可を維持し、表示層で回避しない。
- Tenant/data boundary: 取得済みの許可データだけを表示し、fixtureは匿名化する。

## エラー・例外・回復

- Error taxonomy: chart描画不能を無言で空白にせず、要約・表を残し再試行可能な表示へ落とす。
- Retry/Timeout/Fallback: API errorは既存PageState、canvas error/0寸法はsemantic表をfallbackとして維持する。
- Idempotency/Concurrency: 表示変換のみで書込なし。resizeを重ねてもseriesを重複追加しない。

## イベント・非同期処理

- Producer/Consumer: N/A: 新規event/queueは追加しない。
- Delivery/Ordering/Deduplication/DLQ: N/A: 既存query lifecycleだけを利用する。

## 可観測性

- Logs/Metrics/Traces/Audit: 匿名fixtureでfigure数、canvas bounding box、document overflow、44px領域、semantic要約の実測値を保存する。
- Alert/SLO dashboard: CIでviewport別回帰を検知し、非表示・0寸法・意味情報欠落を失敗にする。

## 互換性・移行・リリース

- Compatibility/versioning: route、API、会計計算、既存desktop操作を維持する。
- Migration/backfill: 不要。
- Rollout/rollback: Web component/CSS/test差分だけを配信し、回帰時は変更した共通surface単位で戻す。

## テストと受入条件

- [ ] `AC-001`: 360/375/390pxで対象figureの可視数がdesktopと意味的に一致し、0寸法が0件。
- [ ] `AC-002`: document横あふれ0、例外は明示した局所scroll containerだけ。
- [ ] `AC-003`: 各figureに要約・期間・単位・主要series・semantic tableがあり、canvas非依存で結論を読める。
  - **凡例チップの色が図のデータセット由来であることの根拠は2箇所に分かれる**。canvas は色を描くが問い合わせに答えない
    （Chart.js v4 の ESM ビルドは `Chart.instances` がモジュールスコープに閉じ、react-chartjs-2 は dataset を DOM に残さない）。
  - **厳密な突合**: `packages/web/src/mobile-financial-visualization.dom.test.tsx`。`<Chart>` に渡った datasets と
    `--series-color` を系列名で突合する（pareto は dataset 順が系列順と異なることを明示した上で突合）。
  - **実描画での破れの検出**: `packages/web/scripts/check-financial-visuals.mjs`。`fig-2` pareto / `fig-3` band /
    Subscriptions vendor は全チップが色を持ち2色以上であること、`fig-4` waterfall は値ごとに色が変わるため
    チップが色を主張しないことを確認する。
  - **全図一律の規則は置いていない**。Matrix の「増減額」も色なしが正しい状態であり、
    「チップに色が無い＝不合格」ではない。図ごとに期待が違うことを前提に読むこと。
- [ ] `AC-004`: 主要操作44px以上、focus-visible欠落0、色だけに依存する状態0、200% zoom情報欠落0。
  - 200% zoom の**唯一の根拠は `zoom200` ケース**とする (375x812 / `zoom: 2`、`packages/web/scripts/viewports.mjs:30`)。
    実ルート検証 `check-financial-visuals.mjs` が `Emulation.setPageScaleFactor` で倍率を適用して実施する。
  - 旧ラベル `200pct-equivalent` (320x640) は `deviceScaleFactor: 1` のままで倍率を適用しておらず
    **200% を再現していなかった**ため、本 AC の根拠に数えない。実体は reduced-motion の検査であり
    `reduced-motion` へ改名済み (`viewports.mjs:32`)。訂正の経緯は
    `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-07-acceptance.md`
    の「Addendum (2026-08-31) — 証跡の訂正」を参照。
  - 44px / focus-visible の根拠も、実在しないセレクタ `.financial-test-last-action` に対する
    空振り判定から、実装由来 DOM への実測アサーションへ置き換わっている (同 Addendum 訂正2)。
- [ ] `AC-005`: unit/DOM/build/desktop+mobile実Chrome回帰が匿名fixtureで全PASS。
- Contract/integration/e2e/security/performance: view-model単体、React DOM contract、既存route build、実Chrome viewport、機微情報guardを通す。

## 未決事項

- 実装後の実機Safariでの細かな文字組みと視覚的な美しさは、localhost確認時の人手レビュー対象とする。
