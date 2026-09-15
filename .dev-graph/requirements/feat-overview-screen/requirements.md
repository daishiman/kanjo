# FINAL-UI 02 概況画面 月次クローズ起点化 — 実装要件

- Feature: `feat-overview-screen`
- Package: `feature-package/feat-overview-screen`
- Handoff target: `task-graph`
- Snapshot: `sha256:f9c0fa42e0992ddaedbe86b248a60b7614c024263089ac04dc8ced4daf7c0c86`
- System plan: `sha256:ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6`
- Readiness: **PASS**（missing sections 0、3 gate 同一 snapshot）

契約正本は `specs/spec-overview-screen.md`。本書は要件と system task の対応だけを持ち、実装コードや task spec を生成しない。

## 目的

概況を「数字を眺める分析画面」から月次クローズの作業起点に変える。開いた瞬間に直近 12 か月の収支の結論と「次に直すこと」が分かり、未処理 0 まで概況から迷わず進める状態にする。現行の概況は GET /api/summary から core の overview() を呼び、事業だけを表示している。

## 到達状態

総合/事業/家計の KPI・推移・年次比較・支出内訳が単一の定義で検算一致し、仕分け・照合・取込の確認が全期間で 1 つの未処理キューに集約されてバッジ・カード・アクションバーの件数が一致し、「後で確認」と月次レビューが D1 に保存されてバックアップと復元でも保たれ、02 のレイアウトが共通シェル・トークン・部品で 8 幅すべてで描画される状態。

## 実装要件

### REQ-OV-001 概況集計の単一定義と検算一致

core の純関数で選択範囲 (総合/事業/家計、既定は総合) の月別系列から KPI (総収入・総支出・純収支と前 12 か月比)・推移・年次比較・支出内訳 (上位 5 + その他) を作る。総合は totalCashflowReport、事業は freee、家計は MF 家計側を使い、同一 fixture で 4 要素の総額差 0 を core 単体テストで確かめる。

- 根拠: FR-001 / O1 / AC-001 / dec-overview-aggregation-scope
- 担当 task: `SYS-OVERVIEW-P02`、`SYS-OVERVIEW-P04`、`SYS-OVERVIEW-P05`、`SYS-OVERVIEW-P07`
- Source: `specs/spec-overview-screen.md`、`features/feat-overview-screen.md`

### REQ-OV-002 全期間の未処理キュー集約

仕分け確認 (reviewPending、clsSrc=既定)・照合確認 (totalCashflowReport の review)・取込確認 (import_runs.status=failed) を全期間で数えて 1 つのキューへ集約し、照合→仕分け→取込、同種別内は金額絶対値の降順、同額は日付の新しい順に並べる。バッジ・カード・アクションバーの件数一致と期間 1年→3年での不変を DOM テストで確かめる。

- 根拠: FR-002 / O2 / AC-002
- 担当 task: `SYS-OVERVIEW-P02`、`SYS-OVERVIEW-P03`、`SYS-OVERVIEW-P04`、`SYS-OVERVIEW-P05`、`SYS-OVERVIEW-P07`
- Source: `specs/spec-overview-screen.md`、`features/feat-overview-screen.md`

### REQ-OV-003 「後で確認」の内容指紋付き保留

保留を内容指紋 (金額・日付・内容) と共に D1 review_snoozes に保存して件数から除き、指紋不一致または利用者の解除で無効にする。月境界では自動解除しない。指紋変更時の再計上を core 単体テスト、保留操作で 3 か所の件数が同時に減ることを DOM テストで確かめる。

- 根拠: FR-003 / O2 / O3 / AC-002 / AC-003 / dec-review-state-storage
- 担当 task: `SYS-OVERVIEW-P02`、`SYS-OVERVIEW-P04`、`SYS-OVERVIEW-P05`、`SYS-OVERVIEW-P07`、`SYS-OVERVIEW-P08`
- Source: `specs/spec-overview-screen.md`、`features/feat-overview-screen.md`

### REQ-OV-004 月次クローズ 4 ステップと月次レビューの保存

データ取込・仕分け 0・照合 0・月次レビュー行ありの 4 ステップをデータから判定し (保留中の明細はステップ判定では未完了)、月次レビューを D1 monthly_close_reviews に保存する。判定表を core 単体テスト、バックアップ→全消去→復元の往復で保留と月次レビューが残ることを API テストで確かめる。

- 根拠: FR-004 / O3 / AC-004
- 担当 task: `SYS-OVERVIEW-P02`、`SYS-OVERVIEW-P04`、`SYS-OVERVIEW-P05`、`SYS-OVERVIEW-P07`、`SYS-OVERVIEW-P08`
- Source: `specs/spec-overview-screen.md`、`features/feat-overview-screen.md`

### REQ-OV-005 推奨科目の決定論的な信頼度

vendor_memory 一致率 (百分率と「過去 N 件中 M 件」) → ルール一致 → MF中項目「事業」始まりの事業区分 → 推奨なし の 4 段で信頼度を決め、乱数・時刻・外部送信を使わない。同一入力で同一出力、根拠なしは推奨なしを core 単体テストで確かめる。

- 根拠: FR-005 / O5 / AC-006 / dec-recommendation-confidence-source
- 担当 task: `SYS-OVERVIEW-P02`、`SYS-OVERVIEW-P04`、`SYS-OVERVIEW-P05`、`SYS-OVERVIEW-P07`
- Source: `specs/spec-overview-screen.md`、`features/feat-overview-screen.md`

### REQ-OV-006 02 レイアウトの共通シェル描画と段階的開示

02 のレイアウトを共通シェル・design-tokens・共通部品で描画する。防衛予測は caution/warn のときだけ KPI の上に role=alert、移動平均は推移の切替、パレートは支出内訳の構成比、未決済と科目別年比較は初期は閉じた「詳しく見る」(details) に置く。check-financial-visuals.mjs の Overview を VIEWPORT_CASES 8 幅で exit 0 にする。

- 根拠: FR-006 / O4 / AC-005 / dec-overview-legacy-elements
- 担当 task: `SYS-OVERVIEW-P02`、`SYS-OVERVIEW-P04`、`SYS-OVERVIEW-P05`、`SYS-OVERVIEW-P07`、`SYS-OVERVIEW-P09`
- Source: `specs/spec-overview-screen.md`、`features/feat-overview-screen.md`

### REQ-OV-007 サイドバー未処理バッジと共通部品

サイドバーの概況項目に未処理件数バッジを付け、バッジ・右パネル・固定アクションバーを components/ の共通部品にする。バッジが未処理キュー API と同じ件数を示し、ロック中は取得しないことを DOM テストで確かめる。

- 根拠: FR-007 / O2 / AC-002
- 担当 task: `SYS-OVERVIEW-P02`、`SYS-OVERVIEW-P04`、`SYS-OVERVIEW-P05`、`SYS-OVERVIEW-P07`
- Source: `specs/spec-overview-screen.md`、`features/feat-overview-screen.md`

### REQ-OV-008 非機能制約・非退行・運用文書と配信

初期 JS 110KiB 予算、CSP connect-src 'self' の維持、WCAG 2.2 AA (role=status / role=alert / 320px Reflow)、EXPECTED_D1_MIGRATION の同時更新による 503 回避を守り、pnpm test / typecheck / lint・check-initial-js-budget・index.test の CSP 差分検査を CI で緑に保つ。件数ずれの切り分け手順を docs/runbooks に残し、要件ベースラインから単一 PR の配信までを証跡で辿れるようにする。

- 根拠: 非機能要件 / AC-007 / S1
- 担当 task: `SYS-OVERVIEW-P01`、`SYS-OVERVIEW-P06`、`SYS-OVERVIEW-P08`、`SYS-OVERVIEW-P09`、`SYS-OVERVIEW-P11`、`SYS-OVERVIEW-P12`、`SYS-OVERVIEW-P13`
- Source: `specs/spec-overview-screen.md`、`features/feat-overview-screen.md`

## 着手前提

- `SYS-OVERVIEW-P01` の着手時に、未決事項 `low-u4-measure-numbering`(U4 の measure と C/SH 番号の利用者確認)と `low-reference-recheck`(w3c-csp3 / whatwg-web-storage の再照合)を確認し、`docs/overview-screen/requirements-baseline.md` に記録する。推定のまま confirmed にしない。
- 確定意思決定 4 件(`dec-overview-aggregation-scope` / `dec-overview-legacy-elements` / `dec-recommendation-confidence-source` / `dec-review-state-storage`)は変更せず、各要件の根拠として引用する。

## 実行グラフ

13 nodes、12 edges、1 root の直列依存。状態・資源・lineage は各 task frontmatter を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-OVERVIEW-P01 | 要件ベースライン確定と未決事項の着手時確認 | — |
| SYS-OVERVIEW-P02 | 概況 API・core 集計・D1 テーブルのワークストリーム設計決定記録 | SYS-OVERVIEW-P01 |
| SYS-OVERVIEW-P03 | API契約・データモデル設計の独立レビュー | SYS-OVERVIEW-P02 |
| SYS-OVERVIEW-P04 | core/API/DOM の失敗テスト先行作成 (O1-O5) | SYS-OVERVIEW-P03 |
| SYS-OVERVIEW-P05 | 概況集計・未処理キューAPI・D1 migration・Overview.tsx の実装 | SYS-OVERVIEW-P04 |
| SYS-OVERVIEW-P06 | 全テスト・型検査・lint の実行記録 | SYS-OVERVIEW-P05 |
| SYS-OVERVIEW-P07 | AC-001..AC-007 受入検証 | SYS-OVERVIEW-P06 |
| SYS-OVERVIEW-P08 | migration 0040 の前進のみ整合とバックアップ/復元対象の整理 | SYS-OVERVIEW-P07 |
| SYS-OVERVIEW-P09 | アクセシビリティ・CSP・初期JS予算・可観測性の保証確認 | SYS-OVERVIEW-P08 |
| SYS-OVERVIEW-P10 | 独立最終レビュー | SYS-OVERVIEW-P09 |
| SYS-OVERVIEW-P11 | 再現可能な証跡索引の作成 | SYS-OVERVIEW-P10 |
| SYS-OVERVIEW-P12 | docs/runbooks への切り分け手順とAPI文書の同期 | SYS-OVERVIEW-P11 |
| SYS-OVERVIEW-P13 | 単一 PR での配信とクローズアウト | SYS-OVERVIEW-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0 |
| C02 saved state | feature + 13 task が confirmed / pass / complete、registration expected 13 = applied 13 |
| validate-system-plan | pass、P01..P13、`sha256:ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6` |

1 周目は task artifact md 13 件の未実体化で blocked となり、C02 `run-dev-graph-node` の dry-run → 本実行で解消した。
