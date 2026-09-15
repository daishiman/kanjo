# 支出分析ハブ (03-analysis-hub) — 実装要件

- Feature: `feat-analysis-hub`
- Package: `feature-package/feat-analysis-hub`
- Handoff target: `task-graph`
- Snapshot: `sha256:cae799f4153f2ca24566a4bc9a599d979219850e1672df6bfa983c4909cde196`
- System plan: `sha256:20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c`
- Readiness: **PASS**（missing sections 0、3 gate 同一 snapshot）

契約正本は `specs/spec-analysis-hub.md`。本書は要件と system task の対応だけを持ち、実装コードや task spec を生成しない。

## 目的

支出分析の入口を、5 つの分析 (照合・総収支・マトリクス・推移・診断) のどこから見ればよいかを 1 画面で判断できるハブにする。利用者が支出分析を開いた時点で、期間の収支の結論と、各分析の要確認件数・変化・改善余地と優先度を見比べ、差異を消す→全体を掴む→偏りを見る→変化を追う→行動を決める の読み順で改善行動まで迷わず進める状態にする。

## 到達状態

/analysis が 03-analysis-hub.png の全構成要素をトークンと共通部品で描画し、?focus= で選択状態が再現され、ハブ表示中の通信は GET /api/analysis/hub の 1 本だけで、前期間比・優先度・正常判定・改善余地の規則が core の境界値テストと docs で固定され、5 タブ名が短縮形になりサイドバー子行の件数バッジが要確認件数と一致し、既存の test / typecheck / lint / check 系が緑のままの状態。

## 実装要件

### REQ-AH-001 ハブ画面の描画

/analysis で 03-analysis-hub.png の構成要素 (問いの見出し・URL コピー・5 タブ・収支サマリー・分析ルート一覧 5 行・選択中の分析パネル・読み順 5 ステップ・下部バー) をトークンと共通 Button/PageShell 経由で描画し、直書き色の lint を 0 件に保つ。/analysis から照合タブへの転送は廃止し、/analysis/:tab と旧 URL 転送は既存どおり動かす。

- 根拠: FR-001 / S1 / AC-001
- 担当 task: `SYS-ANHUB-P01`、`SYS-ANHUB-P03`、`SYS-ANHUB-P04`、`SYS-ANHUB-P05`、`SYS-ANHUB-P07`
- Source: `specs/spec-analysis-hub.md`、`features/feat-analysis-hub.md`

### REQ-AH-002 選択状態の URL 保持とコピー

?focus= の値でルート一覧の行・右パネル・下部バーの選択状態を再現し、行選択で URL を置き換え、不正な focus は既定値に落とす。URL コピーは現在の URL をクリップボードへ書き、金額・取引・期間を URL に載せない。

- 根拠: FR-002 / S2 / AC-002 / qa-analysis-hub-decision-001
- 担当 task: `SYS-ANHUB-P01`、`SYS-ANHUB-P04`、`SYS-ANHUB-P05`、`SYS-ANHUB-P07`
- Source: `specs/spec-analysis-hub.md`、`features/feat-analysis-hub.md`

### REQ-AH-003 core 集計純関数と集約 API

packages/core にハブ集計純関数 (期間合計・前期間比・5 視点の状態・優先度・改善余地) を置き、前期間計算 previousPeriod (直前の同じ長さ、1 か月でも欠けたら比較データなし) を api/ai/dataset.ts から core へ移す。GET /api/analysis/hub は認証ゲート配下・userId 絞り込みで期間メタと集計を返し、ハブ表示中の既存 5 API 呼出しを 0 件にする。

- 根拠: FR-003 / S3 / AC-003 / qa-analysis-hub-decision-002 / qa-backend-web-ah-decision-003
- 担当 task: `SYS-ANHUB-P02`、`SYS-ANHUB-P04`、`SYS-ANHUB-P05`、`SYS-ANHUB-P07`、`SYS-ANHUB-P08`
- Source: `specs/spec-analysis-hub.md`、`features/feat-analysis-hub.md`

### REQ-AH-004 判定規則の docs 固定と境界値テスト

優先度・マトリクス正常判定・改善余地の規則を docs に書き、要確認 0/1 件、未記録月 0/1、tradeoff 候補 0 件の境界で規則どおりの値を返すことを core テストで固定する。規則を変えるとテストが落ちる。

- 根拠: FR-004 / S4 / AC-004 / qa-analysis-hub-decision-003
- 担当 task: `SYS-ANHUB-P02`、`SYS-ANHUB-P04`、`SYS-ANHUB-P05`、`SYS-ANHUB-P07`
- Source: `specs/spec-analysis-hub.md`、`features/feat-analysis-hub.md`

### REQ-AH-005 タブ名の短縮形と件数バッジ

ANALYSIS_TABS の label を 照合/総収支/マトリクス/推移/診断 にし、サイドバー支出分析の子行に要確認 1 件以上の視点だけ件数バッジを付ける。Layout とハブは queryKey ['analysis-hub', 期間 key] を共有し、ハブ API を C3 の例外として docs に明記する。既存 DOM テスト (analysis-tabs / navigation-ux / common-shell-routes) は新文言で更新する。

- 根拠: FR-005 / S5 / AC-005 / qa-analysis-hub-decision-004 / qa-frontend-web-ah-decision-003
- 担当 task: `SYS-ANHUB-P04`、`SYS-ANHUB-P05`、`SYS-ANHUB-P07`、`SYS-ANHUB-P12`
- Source: `specs/spec-analysis-hub.md`、`features/feat-analysis-hub.md`

### REQ-AH-006 視点ごとの静的説明

各視点の『わかること・主なデータソース・対象外のデータ』を routeMetadata の静的定義とし、選択中の分析パネルが 3 項目を表示する。

- 根拠: FR-006 / S1 / AC-001
- 担当 task: `SYS-ANHUB-P01`、`SYS-ANHUB-P04`、`SYS-ANHUB-P05`、`SYS-ANHUB-P07`
- Source: `specs/spec-analysis-hub.md`、`features/feat-analysis-hub.md`

### REQ-AH-007 既存品質の非退行と非機能制約

既存の pnpm test / typecheck / lint と packages/web の check 系 (thead / mobile-layout / financial-figure / financial-routes) を緑のまま保ち、狭幅 (68px アイコンレール・下部タブ) で横スクロールさせない。WCAG 2.2 AA、優先度は文字バッジで示し色だけに頼らない。Worker・binding・cron・デプロイ経路と D1 スキーマは変えない。

- 根拠: S6 / AC-006 / 非機能要件
- 担当 task: `SYS-ANHUB-P06`、`SYS-ANHUB-P09`、`SYS-ANHUB-P11`、`SYS-ANHUB-P13`
- Source: `specs/spec-analysis-hub.md`、`features/feat-analysis-hub.md`

横断 task: `SYS-ANHUB-P03` (全要件の設計を横断する設計レビュー)、`SYS-ANHUB-P10` (全要件と成果物を突合する最終レビュー)

## 着手前提

- SYS-ANHUB-P05 着手前に、ハブ API クエリの staleTime の方針 (値と算定基準) を docs/analysis-hub/architecture-decision.md に記録する (spec 未決事項)。
- ui-ux.md の inference 由来の細部 (純収支説明パネルの狭幅折りたたみ・金額の等幅数字など) は、既存 docs/design-system の観測事実へ接地させるか利用者確認を得てから実装する。推定のまま confirmed にしない。

## 実行グラフ

13 nodes、12 edges、1 root の直列依存。状態・資源・lineage は各 task frontmatter を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-ANHUB-P01 | 要件ベースラインの確定 | — |
| SYS-ANHUB-P02 | アーキテクチャ決定記録の確定 | SYS-ANHUB-P01 |
| SYS-ANHUB-P03 | 設計レビューの実施と記録 | SYS-ANHUB-P02 |
| SYS-ANHUB-P04 | 先行失敗テストの設計と追加 | SYS-ANHUB-P03 |
| SYS-ANHUB-P05 | 実装 (core集計・previousPeriod移設・API・ハブ画面) | SYS-ANHUB-P04 |
| SYS-ANHUB-P06 | 全テスト・型検査・lintの実行と記録 | SYS-ANHUB-P05 |
| SYS-ANHUB-P07 | AC-001..AC-006 の受入検証 | SYS-ANHUB-P06 |
| SYS-ANHUB-P08 | previousPeriod 重複実装の除去 | SYS-ANHUB-P07 |
| SYS-ANHUB-P09 | 品質保証 (アクセシビリティ・性能予算・チェック系) | SYS-ANHUB-P08 |
| SYS-ANHUB-P10 | 最終レビューと要件突合 | SYS-ANHUB-P09 |
| SYS-ANHUB-P11 | 証跡の集約 | SYS-ANHUB-P10 |
| SYS-ANHUB-P12 | 運用ドキュメントの更新 (ui-decisions・既存テスト文言) | SYS-ANHUB-P11 |
| SYS-ANHUB-P13 | リリース判断とクローズアウト | SYS-ANHUB-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0 |
| C02 saved state | feature + 13 task が confirmed / pass / complete、registration expected 13 = applied 13 |
| validate-system-plan | pass、P01..P13、`sha256:20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c` |

1 周目は task artifact md 13 件の未実体化、2 周目は task md frontmatter の必須 6 キー欠落 (78 件) で blocked となり、いずれも C02 `run-dev-graph-node` の差分書込みで解消した。
