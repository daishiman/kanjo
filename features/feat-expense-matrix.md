---
graph_node_id: "feat-expense-matrix"
artifact_kind: "feature"
artifact_subtypes: []
title: "マトリックス画面 (06-matrix) の作り直しと core 集計・セル指向 API"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "expense-matrix", "feature"]
file_path: "features/feat-expense-matrix.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6c5ffc3ec380bd3af81af6212ae2e32268ebb0b738bc2653aca322c758aff0f6"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-expense-matrix-screen.md", "source_version": "0.1.11", "source_digest": "ac40e8a1d1ef41217ce096c3281c3c52365dd931e814c9092aa11e9084f0a306", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-17T21:53:31Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-frontend", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-auth", "arch-expense-matrix-security", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/06-matrix.png", "docs/data-schema.md", "docs/design-system.md", "docs/ui-decisions.md", "packages/api/src/auth.ts", "packages/api/src/routes/analytics.ts", "packages/core/src/analysis.ts", "packages/core/src/csv.ts", "packages/core/src/dataset.ts", "packages/core/src/design-tokens.ts", "packages/core/src/period.ts", "packages/core/test/analysis-contract.test.ts", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/matrix-legend.dom.test.tsx", "packages/web/src/matrix-visual.dom.test.tsx", "packages/web/src/pages/analysis/Matrix.tsx", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "specs/spec-expense-matrix-screen.md"]
purpose: "マトリックス画面を、『どの月・どのカテゴリに支出が偏っているか』という問いに一画面で答える道具にする。月×カテゴリ (または取引先) のヒートマップで偏りを見つけ、気になるセルを選んで金額・前月比・前年同月比・含まれる取引・出典まで降り、明細へ繋げるところまでを、切替と選択を URL に保ったまま行える状態にする。"
goal: "/analysis/matrix が 06-matrix.png の全構成要素 (問いの見出しと最終更新・期間タブ・切替 3 群・単位と濃淡凡例・行ヘッダ固定のヒートマップ表と合計/平均の行列・選択中セルの詳細パネル・偏りが大きい 3 点・下部の選択中バー・空状態) をトークンと共通部品で描画し、集計 (スコープ / 軸 / モード / 合計と平均 / 濃淡階級 / 偏り上位 3 点 / セル内訳) が core の純関数 1 か所で算出されて GET /api/matrix と GET /api/matrix/cell が返し、画面側の再集計が無くなり、切替と選択が URL から復元でき、既存の matrix CSV・総収支・推移の同一期間の金額と一致し、サイドバー等の共通シェルは表記統一のみで既存テストが緑のままの状態。"
scope_in: ["マトリックス画面 (06-matrix.png の全構成要素と読込・空・失敗の各状態) の作り直し。表示モード / 集計の対象 / 行の分類 / 選択中セルを URL クエリの単一の真実にし、期間は既存 usePeriod を引き継ぐ", "packages/core の matrix 集計純関数 (スコープ 事業/家計・軸 カテゴリ/取引先・モード 金額/構成比/前年差・行と列の合計と平均・7 階級の表全体共通スケール・偏り度スコアと同点解消・決定論の示唆テンプレート 6 パターン・セル内訳の絞り込み)", "packages/api の GET /api/matrix 拡張 (scope / axis / mode クエリ) と GET /api/matrix/cell の新設 (月 × 行キー × スコープ の内訳、取引上位 10 件と truncated、出典と明細導線)、既存 matrix CSV の同一 core 関数への付け替え", "表示期間の前後 12 か月まで読み広げた Dataset 構築 (期間外の前月比・前年同月比を実データがあれば参照する。集計範囲は表示期間のまま)", "クエリの列挙値検証と 400、key の完全一致と長さ上限、CSV の数式エスケープ、明細応答の no-store", "サイドバー等の表記を『マトリックス』へ統一 (routeMetadata の label と journeyHint を含む)。共通シェルの構造は変更しない", "集計規則・濃淡階級・偏り 3 点の選定規則と文テンプレート・未記帳月の扱いの docs 記載と、core の境界値テスト・API テスト・DOM テスト (既存 matrix-visual / matrix-legend の更新を含む)"]
scope_out: ["照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し (表記統一と数値の一致確認だけを扱う)", "新しいテーブル・集計結果の永続化・キャッシュ層の導入 (本サイクルは既存明細の読み取りだけで満たす)", "生成 AI による示唆文の作成 (決定論テンプレートで固定する)", "サイドバー・ヘッダー・フッターの構造の作り直し (表記ゆれの是正のみ)", "認証方式・権限分離の変更、および新しい外部依存やチャートライブラリの追加", "スマートフォン・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)"]
acceptance: ["S1 (G1): /analysis/matrix で 06-matrix.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件である。", "S2 (G2): 任意のセルを選ぶと詳細パネルと下部バーが同じ数値 (金額・前月比・前年同月比) を示し、含まれる取引の合計がセル金額と一致し、明細を開くが対象の月とカテゴリで絞った明細へ遷移する。", "S3 (G3): 偏りが大きい 3 点の選定規則が docs に明記され、境界値テストで固定され、表示中のスコープ・軸・期間と同じ条件で算出される。", "S4 (G4): 事業 / 家計 × カテゴリ / 取引先 の 2×2 のどの組合せでも、合計・平均が表の値と一致し、matrix CSV および総収支・推移の同一期間の金額と一致する (`全部 / 構成比 / 前年差` の scope 切替は決定2 により今サイクルの scope 外)。", "S5 (G5): サイドバー・ヘッダー・フッターの実装差分が表記統一のみで、`pnpm test` が全件緑である (画面を列挙しない。列挙は必ず漏れる)。"]
architecture_refs: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-frontend", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-auth", "arch-expense-matrix-security", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "I1..I7 は同じ集計契約 (core 純関数→GET /api/matrix と /api/matrix/cell→画面の切替・セル選択・詳細パネル) を起点に連鎖する 1 つの価値単位で、画面だけ・API だけでは『偏りを見つけてセルの内訳へ降りる』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-expense-matrix.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T11:55:20Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

マトリックス画面を、『どの月・どのカテゴリに支出が偏っているか』という問いに一画面で答える道具にする。月×カテゴリ (または取引先) のヒートマップで偏りを見つけ、気になるセルを選んで金額・前月比・前年同月比・含まれる取引・出典まで降り、明細へ繋げるところまでを、切替と選択を URL に保ったまま行える状態にする。

規範 (要件・集計規則・確定意思決定) の正本は `specs/spec-expense-matrix-screen.md` と、そこから参照する仕様章である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/analysis/matrix が 06-matrix.png の全構成要素 (問いの見出しと最終更新・期間タブ・切替 3 群・単位と濃淡凡例・行ヘッダ固定のヒートマップ表と合計/平均の行列・選択中セルの詳細パネル・偏りが大きい 3 点・下部の選択中バー・空状態) をトークンと共通部品で描画し、集計 (スコープ / 軸 / モード / 合計と平均 / 濃淡階級 / 偏り上位 3 点 / セル内訳) が core の純関数 1 か所で算出されて `GET /api/matrix` と `GET /api/matrix/cell` が返し、画面側の再集計が無くなり、切替と選択が URL から復元でき、既存の matrix CSV・総収支・推移の同一期間の金額と一致し、サイドバー等の共通シェルは表記統一のみで既存テストが緑のままの状態。

## スコープ

- スコープ内:
  - マトリックス画面 (06-matrix.png の全構成要素と読込・空・失敗の各状態) の作り直し。表示モード / 集計の対象 / 行の分類 / 選択中セルを URL クエリの単一の真実にし、期間は既存 usePeriod を引き継ぐ
  - packages/core の matrix 集計純関数 (スコープ 事業/家計・軸 カテゴリ/取引先・モード 金額/構成比/前年差・行と列の合計と平均・7 階級の表全体共通スケール・偏り度スコアと同点解消・決定論の示唆テンプレート 6 パターン・セル内訳の絞り込み)
  - packages/api の `GET /api/matrix` 拡張 (scope / axis / mode クエリ) と `GET /api/matrix/cell` の新設 (月 × 行キー × スコープ の内訳、取引上位 10 件と truncated、出典と明細導線)、既存 matrix CSV の同一 core 関数への付け替え
  - 表示期間の前後 12 か月まで読み広げた Dataset 構築 (期間外の前月比・前年同月比を実データがあれば参照する。集計範囲は表示期間のまま)
  - クエリの列挙値検証と 400、key の完全一致と長さ上限、CSV の数式エスケープ、明細応答の no-store
  - サイドバー等の表記を『マトリックス』へ統一 (routeMetadata の label と journeyHint を含む)。共通シェルの構造は変更しない
  - 集計規則・濃淡階級・偏り 3 点の選定規則と文テンプレート・未記帳月の扱いの docs 記載と、core の境界値テスト・API テスト・DOM テスト (既存 matrix-visual / matrix-legend の更新を含む)
- スコープ外:
  - 照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し (表記統一と数値の一致確認だけを扱う)
  - 新しいテーブル・集計結果の永続化・キャッシュ層の導入 (本サイクルは既存明細の読み取りだけで満たす)
  - 生成 AI による示唆文の作成 (決定論テンプレートで固定する)
  - サイドバー・ヘッダー・フッターの構造の作り直し (表記ゆれの是正のみ)
  - 認証方式・権限分離の変更、および新しい外部依存やチャートライブラリの追加
  - スマートフォン・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)

## 受入

- [ ] S1 (G1): /analysis/matrix で 06-matrix.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件である。
- [ ] S2 (G2): 任意のセルを選ぶと詳細パネルと下部バーが同じ数値 (金額・前月比・前年同月比) を示し、含まれる取引の合計がセル金額と一致し、明細を開くが対象の月とカテゴリで絞った明細へ遷移する。
- [ ] S3 (G3): 偏りが大きい 3 点の選定規則が docs に明記され、境界値テストで固定され、表示中のスコープ・軸・期間と同じ条件で算出される。
- [ ] S4 (G4): 事業 / 家計 × カテゴリ / 取引先 の 2×2 のどの組合せでも、合計・平均が表の値と一致し、matrix CSV および総収支・推移の同一期間の金額と一致する (`全部 / 構成比 / 前年差` の scope 切替は決定2 により今サイクルの scope 外)。
- [ ] S5 (G5): サイドバー・ヘッダー・フッターの実装差分が表記統一のみで、`pnpm test` が全件緑である (画面を列挙しない。列挙は必ず漏れる)。

## アーキテクチャ参照

- `architecture_refs`: `arch-expense-matrix-ui-ux`, `arch-expense-matrix-frontend`, `arch-expense-matrix-backend`, `arch-expense-matrix-database`, `arch-expense-matrix-auth`, `arch-expense-matrix-security`, `arch-expense-matrix-infrastructure`, `arch-expense-matrix-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/expense-matrix-ui-ux.md`, `architecture/expense-matrix-frontend.md`, `architecture/expense-matrix-backend.md`, `architecture/expense-matrix-database.md`, `architecture/expense-matrix-auth.md`, `architecture/expense-matrix-security.md`, `architecture/expense-matrix-infrastructure.md`, `architecture/expense-matrix-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-expense-matrix-screen` (feature ノードへの依存は無い)
- 依存理由: 濃淡の 7 階級・偏り度スコアと同点解消・示唆テンプレート 6 パターン・取引先軸の上位 20 + その他・期間外参照・フィクスチャの正本という 6 件の決定が確定していないと、core の返り値型・API 応答・テストの期待値が実装中に揺れるため。支出分析ハブ (PR #50) と照合画面 (PR #54) は main に取り込み済みで、未完了の feature に依存しない。
- 重複の不在: `feat-analysis-hub` の scope_out に「5 タブ各詳細画面の中身の作り直し (各画面のサイクル)」が明記されており、本 feature はその次サイクルに当たる。ハブ・総収支・推移とは数値の一致を取るだけで機能を重複させない。
- 後続: 推移・診断の各タブ画面を FINAL-UI どおりに作り直す feature は次サイクル候補であり、本サイクルでは起票しない。

## 実行順序と承認の記録

### P01..P13 の `depends_on` について

現在の 13 task の `depends_on` は `P01:[] P02:[P01] ... P13:[P12]` の完全な一直線である。**これは実測した依存関係ではなく、安全側に倒した既定値である。** 実際には P01..P03 の文書系と P04 のテスト作成の間など、同時に進められる区間が存在する。

この並びのまま本サイクルを実行する判断をした理由は、`depends_on` が scheduler の ready-set 計算と worktree lease の両方の入力になっており、実依存を確かめずに書き換えると、順序だけでなく**ファイル所有の排他まで同時に緩む**ためである。並列化の利得より、実依存を測らずに保護を外す危険のほうが大きいと判断した。

次にこの並びを読む者は、**一直線であることを「調べた結果そうだった」と解釈してはならない。** 並列化を行う場合は、各 task の `resource_scope` の交わりと成果物の入出力関係を実測してから `depends_on` を書き直すこと。

### 本サイクルで確定した承認 7 件

| 論点 | 決定 | 決定者 |
|---|---|---|
| 画面の表記ゆれの統一 | 今回あわせて直す | 利用者 |
| 費用の表の期間 | 直近 13 ヶ月 (既存の `year13` プリセットに揃える) | 利用者 |
| 家計側の取引先軸 | 出す (取引先名の正規化範囲は OI-04 として P04 で確定) | 利用者 |
| 濃淡の共通化 | 新しい表と AI レポートで同じ部品に寄せる | 利用者 |
| AI レポートへの数値の配線 | 今回は凍結する | 委任により決定 |
| CSV の列 | 画面と同じ 13 ヶ月にそろえる (`前年比(年換算)` 列は残す) | 委任により決定 |
| 濃さの基準 | 科目ごと (現行を維持) | 委任により決定 |

配線の凍結と濃淡の共通化が両立するのは、共通部品が「値の並びと分母を受け取り、濃さの階級だけを返す」形をとるためである。生の値と分母を返す形にすると受け手が再び割り算を持つことになり、除いたはずの重複が戻る。

### `resource_scope` に 13 ファイルを追加した理由と、追加だけでは直らないもの

本サイクルで 13 task の `resource_scope` に 13 ファイルを追加した。**これは実例を塞いだだけで、抜けを生んだ仕組みは直っていない。**

抜けの原因は、`resource_scope` が「その task の説明文に名前が出てくるファイル」と完全に一致していたことである。仕様は「何を作るか」を書く文書なので、**その変更の巻き添えで必ず書き換わるファイルは原理的に書かれない。** 引く工程が無かったので落ちた。分類 (`domain`) の誤りはこの欠落の別の顔であって、原因ではない。実際、`domain` が正しい P05 でも同じ抜け方をしていた (`packages/core/src/report-html.ts:14,126` が `matrix()` を呼んでいるのに scope に無かった)。

次のサイクルで同じ抜け方をしないために、scope に挙げた各ファイルから次を引くこと。今回の抜けはこれで機械的に出る。

1. **そのファイルが export する名前の呼び出し元**。`report-html.ts` はこれで出る。
2. **新設する部品が使う CSS クラス名**。`styles.css` はこれで出る。
3. **型で結ばれた宣言**。`figure-guides.ts:136` の `export type FigureId = keyof typeof FIGURE_GUIDES` のように、片方を変えると他方が型で落ちる関係。`figure-guides.ts` はこれで出る。
4. **そのファイルを import している側をすべて引く。** 1-3 はいずれも「このファイルが外へ出している名前」をたどる向きなので、**本体を import するだけで何も export しないファイルには原理的に届かない。** 今回追加した 13 本のうち `figure-guides.test.ts` / `route-search.test.ts` / `financial-chart-model.test.ts` / `mobile-financial-visualization.dom.test.tsx` の 4 本がこれに当たり、1-3 のどれでも出ない。

4 を別立てにしているのは、1-3 だけを手順にすると被参照の向きが丸ごと落ちるためである。今回の実例では追加分の 3 割がこれに当たった。**現時点でこの形を持つのがテストばかりなのは、今の製品がたまたまそうだというだけであって、規則の性質ではない。** 設定の登録表、エントリ点の束ね、生成物の入力など、import するだけで export しないファイルが増えれば同じ落ち方をする。ここを「テストを引く」と読み替えないこと。読み替えた瞬間に、テスト以外が引かれなくなる。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-expense-matrix-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-expense-matrix --feature-context features/feat-expense-matrix.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-expense-matrix` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S5 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (偏り度スコアの標準偏差の下限値・構成比と前年差の丸め桁・セル内訳の `detailHref` の実際のクエリ形・取引先名の正規化の適用範囲) は `specs/spec-expense-matrix-screen.md` の未決事項を正本とし、該当 task の契約テストで確定する。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。

## 実装状況 (2026-09-18)

exact-13 (`SYS-MATRIX-P01`..`P13`) を一巡し、単一 PR で配信する。受入の判定は
[`../docs/matrix/evidence-index.md`](../docs/matrix/evidence-index.md) の「2. 受入基準の判定」、
仕様・設計への反映の判定は
[`../docs/matrix/spec-reflection-receipt.md`](../docs/matrix/spec-reflection-receipt.md)。

| 受入 | 判定 |
|---|---|
| S1 | 達成 |
| S2 | **未達** (セル選択 → 詳細パネル → 明細遷移が未実装) |
| S3 | 達成 |
| S4 | 部分達成 (`scope` は決定 2 で今サイクル外、`axis` は未実装のため既定の 1 組合せのみ) |
| S5 | 達成 |

`scope_in` のうち **`packages/api` の拡張 (`GET /api/matrix` の scope / axis / mode、`GET /api/matrix/cell` の新設) は着手していない**。
`packages/api/` の差分は 0 行で、画面は既存の `GET /matrix` をそのまま呼んでいる。
「URL クエリを単一の真実にする」も同様に未着手 (受入 5)。

完了 rollup の条件 (exact 13 全 done かつ S1〜S5 の evidence) は**満たしていない**ため、
本 feature は done にせず、S2 / 受入 5 / API 拡張 / 軸切替を次サイクルへ持ち越す。
`specs/spec-expense-matrix-screen.md` の記述は実装に合わせて緩めていないので、そのまま次の入力になる。
