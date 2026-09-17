# 実装要件: feat-trends-screen

- Feature: `feat-trends-screen`
- Package: `.dev-graph/plans/feature-package-feat-trends-screen`
- Handoff target: task-graph
- Snapshot: `sha256:a3cbc5e433134fb660e44b03562b99eee6019c9825cf94a4a21a2f1b86c697fe`
- System plan: `sha256:ad9f046d57b0189604f64f5669609c5feb4462b9f403d3f31a053df4268349b4`
- Readiness: **PASS**（missing sections 0、3 gate 同一 snapshot）

契約の正本は `specs/spec-trends-screen.md` と `system-spec/`、task の正本は `tasks/feat-trends-screen/` の frontmatter である。本書は両者を要件単位で結ぶ索引で、実装コードは含まない。

## 目的

収支が『いつ・なぜ』変わったかを推移画面の 1 画面で掴めるようにし、指標を登録制にして収支以外の推移も同じ型で追えるようにする。

## 到達状態

- /analysis/trends が 07-trends.png の構成で描かれ、値が概況・総収支と一致する (S1、S2)。
- 指標定義の追加だけで画面と API に指標が現れる (S3)。
- 詳細パネルと選択バーから根拠の明細へ辿れ、条件は URL から復元される (S4)。
- 規則が docs と境界値テストで固定され、既存の検査がすべて緑である (S5、S6)。

## 前提

- 確定意思決定 17 件 (qa-trends-decision-001〜014、dec-trends-datasource-001、dec-trends-review-rows-001、dec-trends-judgement-source-001) を変更しない。変更が必要になったら spec を reopen してから着手する。
- architecture 8 章の scope には現行 repository に実在しない path 表記が 8 件ある (例: packages/web/src/lib/api.ts)。SYS-TRENDS-P01 の対応表で実在 path へ読み替え、architecture 本文は書き換えない。
- データ移行と D1 migration は無い。SYS-TRENDS-P08 で migration 追加が 0 件であることを確認する。
- previousYearPeriod は packages/core/src/analysis-hub.ts の previousPeriod の隣に新設する (period.ts ではない)。
- 着手前に origin/main を fetch し、trends・total-cashflow 周辺の変更が入っていれば P01 の対応表を更新する。

## 実装要件

### REQ-TR-001 画面構成と共通部品

/analysis/trends を 07-trends.png の構成 (期間タブ・問いの見出し・範囲/指標/比較対象の帯・KPI・チャート・詳細パネル・カテゴリ表・パレート・上位 3・選択バー) で描き、色・余白・部品はトークンと共通 Button/PageShell/chart の共通設定だけを使う。期間タブは usePeriod を操作する。

- 根拠: S1、非機能要件 (レスポンシブ)
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P07`、`SYS-TRENDS-P09`
- Source: FR1、FR2、FR8（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-002 指標の登録表

指標定義 (id・表示名・月次系列の取り出し方・符号と良し悪しの向き・内訳の軸) を packages/core の登録表に置き、収入・支出・純収支の 3 件を登録する。API は metric クエリで定義を引き、未登録は 400 invalid_metric。画面と API に指標 id の分岐を書かない。

- 根拠: S3、qa-trends-decision-003
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P08`
- Source: FR9（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-003 数値の出所と総収支との一致

数値は totalCashflowReport と同じ取引集合 (freee+MF の消し込み後) から数え、総合=事業+家計・純収支=収入-支出が成り立ち、期間合計は GET /api/total-cashflow と一致する。loadDataset と freee 系 4 表は 1 リクエストで 1 回ずつ読む。

- 根拠: S2、dec-trends-datasource-001、非機能要件 (性能)
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P03`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P06`
- Source: FR3、FR4（`specs/spec-trends-screen.md#目的と成功状態`）

### REQ-TR-004 比較期間と KPI

比較対象は前期間 (直前の同じ長さ) と前年 (前年の同じ月範囲)。前年は previousYearPeriod を analysis-hub.ts に新設し、Dataset を切って作る。全期間では comparePeriod を null にし、KPI の増減は最も変化が大きい月の前月差 (basis=peak_month_mom) とする。初期の選択月は最も変化が大きい月。

- 根拠: qa-trends-decision-006/007/010
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P07`
- Source: FR3、FR4（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-005 選択月の詳細パネルと出典

選択月の 3 指標と比較値、増減要因上位 3 と規則で作る説明文、データの出典 (MF は口座名と件数、freee は『freee』と件数、口座が空の freee 行は『—』で口座別の件数に数えない) を出す。

- 根拠: qa-trends-decision-002/014
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P09`
- Source: FR5（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-006 カテゴリ表と取引先の展開

カテゴリ別に直近 12 か月のスパークライン (期間末月から遡る 12 枠、データの無い月は空)・今回・比較・増減額・増減率・構成比・寄与度を出し、行の展開で取引先別の同じ列を出す。

- 根拠: qa-trends-decision-009
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`
- Source: FR6（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-007 パレート図と上位 3

増減額の絶対値の降順の棒と累計構成比の折れ線、増減が大きい上位 3 のカードを出す。既存の pareto の値は壊さず、追加フィールドで拡張する。

- 根拠: 非機能要件 (互換)
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`
- Source: FR7（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-008 明細への導線と /classify 絞込

MF 由来は /classify へ月・範囲・category・payee (専用クエリ、完全一致、名寄せなし) で遷移し、freee 由来は /analysis/total-cashflow を開く。/classify は category と payee を URL から読み、既存の month・cls・q と組み合わせる。

- 根拠: S4、qa-trends-decision-004/011
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P03`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P07`
- Source: FR10、FR8（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-009 URL 状態と入力境界

範囲・指標・比較対象・選択月・選択カテゴリを URL に保持して再読込で復元する。形式違反の month と未知の scope/compare は既定値へ倒して 200、scope の別名 (all/biz/personal) を受ける。

- 根拠: Contract tests、qa-trends-decision-011
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P03`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P09`
- Source: FR1、FR2（`specs/spec-trends-screen.md#API`）

### REQ-TR-010 要確認の明細の扱い

要確認の MF 明細は推移の数値に含めず、期間と選択月の件数・金額 (totalCashflowReport の reviewCount・reviewAmount と一致) を帯と詳細パネルに出し、総収支画面へ導く。

- 根拠: dec-trends-review-rows-001
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P07`
- Source: FR2、FR3、FR5（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-011 傾向の判定の開閉と基準

既存の手を打つ順番と傾向判定は『傾向の判定を表示』の details に移し、MF 明細だけの trendsReport で計算したまま judgementBasis=mf_only を返し、見出しに基準を明記する。rows/pareto/breakdown と trend-contract.test.ts を壊さない。

- 根拠: dec-trends-judgement-source-001、qa-trends-decision-001
- 担当 task: `SYS-TRENDS-P02`、`SYS-TRENDS-P03`、`SYS-TRENDS-P04`、`SYS-TRENDS-P05`、`SYS-TRENDS-P08`
- Source: FR11（`specs/spec-trends-screen.md#機能要件`）

### REQ-TR-012 規則の docs 化・品質保証・配信

計算規則と説明文の規則を docs/trends-screen.md に表で書き、境界値テストで固定する。WCAG 2.2 AA・CSP・JS 予算・視覚検査を含む pnpm verify:full が緑で、migration を伴わず既存 deploy.yml で単一 PR として配信する。

- 根拠: S5、S6、非機能要件、互換性・移行・リリース
- 担当 task: `SYS-TRENDS-P06`、`SYS-TRENDS-P08`、`SYS-TRENDS-P09`、`SYS-TRENDS-P11`、`SYS-TRENDS-P12`、`SYS-TRENDS-P13`
- Source: FR12（`specs/spec-trends-screen.md#テストと受入条件`）

横断: `SYS-TRENDS-P10` が全要件を spec と突き合わせて最終レビューする。

## 実行グラフ

13 nodes、12 edges、1 root の直列依存。状態・資源・lineage は各 task frontmatter を正本とする。

| Task | 内容 | 依存 |
|---|---|---|
| SYS-TRENDS-P01 | 要件ベースライン確定と architecture の path 表記の対応表 | — |
| SYS-TRENDS-P02 | 指標の登録表・総収支と同じ取引集合の推移集計・GET /api/trends 拡張・/classify 絞込の設計決定記録 | SYS-TRENDS-P01 |
| SYS-TRENDS-P03 | 設計決定の独立レビュー (二つの基準の並存・総収支との一致・URL 状態) | SYS-TRENDS-P02 |
| SYS-TRENDS-P04 | 境界値付きの red テスト先行 (指標定義・比較期間・総収支との一致・画面ブロック・/classify 絞込) | SYS-TRENDS-P03 |
| SYS-TRENDS-P05 | 指標の登録表・推移集計・GET /api/trends 拡張・Trends.tsx の 10 ブロック・/classify 絞込の実装 | SYS-TRENDS-P04 |
| SYS-TRENDS-P06 | 全テスト・型検査・lint の実行記録 | SYS-TRENDS-P05 |
| SYS-TRENDS-P07 | 受入条件 S1〜S6 の検証 | SYS-TRENDS-P06 |
| SYS-TRENDS-P08 | 指標 id 分岐の除去確認と集計ロジックの重複整理 (migration 無しの確認) | SYS-TRENDS-P07 |
| SYS-TRENDS-P09 | アクセシビリティ・CSP・JS 予算・狭幅表示・クエリ入力境界の保証と視覚検査の更新 | SYS-TRENDS-P08 |
| SYS-TRENDS-P10 | 最終レビュー (spec との突合と差分の確認) | SYS-TRENDS-P09 |
| SYS-TRENDS-P11 | 証跡索引の作成 | SYS-TRENDS-P10 |
| SYS-TRENDS-P12 | 計算規則と説明文の規則の docs 化と画面監査表の更新 | SYS-TRENDS-P11 |
| SYS-TRENDS-P13 | 単一 PR での配信と close-out | SYS-TRENDS-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0 |
| C02 saved state | feature + 13 task が confirmed / pass / complete、registration expected 13 = applied 13 |
| validate-system-plan | pass、P01..P13、`sha256:ad9f046d57b0189604f64f5669609c5feb4462b9f403d3f31a053df4268349b4` |

1 周目は task artifact md 13 件の未実体化で blocked となり、C02 `run-dev-graph-node` の dry-run → 本実行で解消した。
