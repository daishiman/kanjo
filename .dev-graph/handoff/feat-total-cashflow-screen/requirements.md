# FINAL-UI 05 総収支画面 構成の全面反映 — 実装要件

- Feature: `feat-total-cashflow-screen`
- Package: `feature-package/feat-total-cashflow-screen`
- Handoff target: `task-graph`
- Snapshot: `sha256:ccd677d72151f4883bfb1d37a4c38232cf5711f48891d0d79664e5ab4985babf`
- System plan: `sha256:1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5`
- Readiness: **PASS**（missing sections 0、3 gate 同一 snapshot）

契約正本は `specs/spec-total-cashflow-screen.md`。本書は要件と system task の対応だけを持ち、実装コードや task spec を生成しない。

## 目的

家計と事業を合わせた本当の収支を、重複と除外の判断ごと 1 画面で確かめて月次クローズの『照合→総収支』を終えられるようにする。現行の総収支は 9 列月次表と重複・除外の一覧が中心で、前年同期比・判定作業の 3 ペイン・操作の取消を持たない。

## 到達状態

/analysis/total-cashflow が 05-total-cashflow.png の構成で描画され、総合/事業/家計の KPI と前年同期比が core と一致し (総合 = 事業 + 家計)、判定作業で単票・一括の同じ/別/除外を行い、画面を開いてから行った操作を新しい順に取り消せ、判定・除外・操作履歴が D1 に残ってバックアップと復元でも保たれ、規則が docs と境界値テストで固定された状態。

## 実装要件

### REQ-TC-001 05 総収支画面の構成とブロック描画

/analysis/total-cashflow を 05-total-cashflow.png どおりに、見出しと説明・データの見方リンク・5 タブ・総合/事業/家計のセグメント・選択中期間と前年同期の表示・KPI 3 枚・月次の収入/支出の棒と純収支の折れ線・判定作業・freee 除外一覧・自動一致の候補・進捗通知・下部選択バーで描画する。共通シェル・トークン・Button/PageShell の上に組み、既存 9 列月次表は『月次の内訳を表示』で開閉 (既定は閉じる) できる検算根拠として残す。共通ヘッダー/フッターの文言を画像に揃え、『完全一致候補』は『自動一致の候補』と表記する。各ブロックの描画と開閉、直書き色 lint 0 件を DOM テストと lint で確かめる。

- 根拠: FR-001 / O1 / AC-001 / qa-total-cashflow-decision-001 / 010 / 016
- 担当 task: `SYS-TCSCREEN-P02`、`SYS-TCSCREEN-P04`、`SYS-TCSCREEN-P05`、`SYS-TCSCREEN-P07`、`SYS-TCSCREEN-P09`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

### REQ-TC-002 セグメント別集計と前年同期比の単一定義

packages/core に総合/事業/家計の期間合計・月次系列・前年同期比 (previousYearPeriod: 開始月と終了月を 12 か月前へ。全月がデータ範囲にあるときだけ前年値、差額と率、前年値 0 で率 null) を純関数で置き、GET /api/total-cashflow が 1 回で返す。analysis-hub の previousPeriod は変えない。総合 = 事業 + 家計が期間合計と月次系列の双方で成り立つこと、前期 0・前期データ無しの境界を core テストで固定する。

- 根拠: FR-002 / O2 / AC-002 / BR-006 / qa-total-cashflow-decision-006
- 担当 task: `SYS-TCSCREEN-P02`、`SYS-TCSCREEN-P03`、`SYS-TCSCREEN-P04`、`SYS-TCSCREEN-P05`、`SYS-TCSCREEN-P07`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

### REQ-TC-003 3 ペインの判定作業と単票・一括判定

判定作業を 左 (件数付きナビ)・中央 (フィルタ・検索・チェック選択付き明細表)・右 (MF 明細と freee 対応候補の並列詳細・一致度・判定ボタン・直前の操作と元に戻す) の 3 ペインにし、単票と複数選択 (下部選択バー、一括は最大 200 件) で『同じ取引/別の取引/集計から除外』を行う。状態は画面の state に持ち URL に載せず API を再取得しない。狭幅は 左→中央→右 に縦積みする。判定後の総額が消し込み不変条件 (freee 正本・same の総額不変・different の独立残余加算・再取込後の再適用) を満たすことを DOM テストと API 統合テストで確かめる。

- 根拠: FR-003 / O3 / AC-003 / BR-009
- 担当 task: `SYS-TCSCREEN-P02`、`SYS-TCSCREEN-P03`、`SYS-TCSCREEN-P04`、`SYS-TCSCREEN-P05`、`SYS-TCSCREEN-P07`、`SYS-TCSCREEN-P09`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

### REQ-TC-004 freee 除外の理由区分とメモへの移行

freee 除外を対応する freee 取引側に、理由区分 reason_code (振替/内部移動/帳簿のみ/二重登録/その他 の許可リスト) とメモ memo (0〜200 字) に分けて単票・一括で設定する。migration 0041 で既存の自由記述 reason を memo と『その他』へ失わずに移す。除外した freee 取引の対応 MF 明細は公私仕分け (resolveTx) で数え、除外を考えない候補がちょうど 1 件でそれが除外済みの要確認明細は review から出して集計する。migration 適用後に既存除外の理由がメモとして読めることを統合テストで確かめる。

- 根拠: FR-004 / O4 / AC-004 / BR-005 / qa-total-cashflow-decision-003 / 009 / 014 / 015
- 担当 task: `SYS-TCSCREEN-P02`、`SYS-TCSCREEN-P03`、`SYS-TCSCREEN-P04`、`SYS-TCSCREEN-P05`、`SYS-TCSCREEN-P07`、`SYS-TCSCREEN-P08`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

### REQ-TC-005 操作履歴と画面を開いている間の取消

判定・除外・戻すの書込みと履歴 1 行を同じ D1 batch で total_cashflow_operations に残し、POST /total-cashflow/operations/{id}/undo は同じ user_id の未取消の最新書込み操作と id が一致するときだけ操作前の値へ戻す (不一致は何も変えず 409)。画面はその画面を開いてから成功した operationId の列が残る間だけ『元に戻す』を出し、押すたびに 1 つ前へ遡る (やり直し無し)。再読込や移動で列は消える。取消の前後で総額と判定件数が一致し、同じ id の再送・古い id で戻らず、再取込後も判定が再適用されることを API 統合テストで確かめる。

- 根拠: FR-005 / O4 / AC-004 / BR-008 / qa-total-cashflow-decision-004 / 013 / 017
- 担当 task: `SYS-TCSCREEN-P02`、`SYS-TCSCREEN-P03`、`SYS-TCSCREEN-P04`、`SYS-TCSCREEN-P05`、`SYS-TCSCREEN-P07`、`SYS-TCSCREEN-P12`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

### REQ-TC-006 判定・除外・操作履歴の 3 表バックアップ

duplicate_verdicts・freee_deal_exclusions・total_cashflow_operations の 3 表をバックアップと復元の対象に加える。復元で 3 表が復元時点へ戻り、key の無い旧バックアップでは既存の行が残ることを復元テストで確かめる。

- 根拠: FR-006 / O4 / AC-004 / qa-total-cashflow-decision-018
- 担当 task: `SYS-TCSCREEN-P02`、`SYS-TCSCREEN-P03`、`SYS-TCSCREEN-P04`、`SYS-TCSCREEN-P05`、`SYS-TCSCREEN-P07`、`SYS-TCSCREEN-P08`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

### REQ-TC-007 自動一致の候補と一致度の規則

自動一致の候補 (matched のうち by=auto の組) にソースフィルタ・全選択・一致度 (規則で算出した 78〜100 をそのまま %、内訳付き)・『選択した取引を同じ取引にする』を置き、確定は same の記録だけで matched の集合と総額を変えない。自動寄せの肯定条件は発生日一致かつ金額一致だけで支払先を使わず、口座は否定条件にだけ使う。一致度・3 区分・自動一致の規則を名前付き定数にして docs に書き、境界値テストで固定する (規則を変えるとテストが落ちる)。

- 根拠: FR-007 / FR-008 / O5 / AC-005 / BR-003 / qa-total-cashflow-decision-002 / 007 / 008 / 012
- 担当 task: `SYS-TCSCREEN-P02`、`SYS-TCSCREEN-P04`、`SYS-TCSCREEN-P05`、`SYS-TCSCREEN-P07`、`SYS-TCSCREEN-P08`、`SYS-TCSCREEN-P12`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

### REQ-TC-008 サイドバーの現在地と照合バッジの確認

サイドバーは画像に合わせた改修をせず、支出分析 > 総収支 が現在地になることと照合の件数バッジが要確認件数と一致することを DOM テストで確認するに留める。

- 根拠: FR-008 / O5 / AC-005 / qa-total-cashflow-decision-011
- 担当 task: `SYS-TCSCREEN-P04`、`SYS-TCSCREEN-P05`、`SYS-TCSCREEN-P07`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

### REQ-TC-009 非機能制約・非退行・運用文書と配信

集計を core に置き api/web へ重複実装しない。GET は 1 回で d1-limits の制限内、取消照合は (user_id, created_at DESC) 索引で全件走査しない。migration は追加のみで migration gate と runtime schema guard (EXPECTED_D1_MIGRATION) を通す。WCAG 2.2 AA (文字 4.5:1、部品 3:1、判定状態の文字バッジ、前期比の符号と矢印)、CSP connect-src 'self'、初期 JS 予算、狭幅表示を維持し、外部送信とサンプル以外の実データ持込みを 0 にする。pnpm test / typecheck / lint と packages/web の check 系を緑に保ち、取消競合の切り分けを docs/runbooks に残し、要件ベースラインから単一 PR の配信までを証跡で辿れるようにする。

- 根拠: 非機能要件 / AC-006 / C1-C6
- 担当 task: `SYS-TCSCREEN-P01`、`SYS-TCSCREEN-P06`、`SYS-TCSCREEN-P08`、`SYS-TCSCREEN-P09`、`SYS-TCSCREEN-P11`、`SYS-TCSCREEN-P12`、`SYS-TCSCREEN-P13`
- Source: `specs/spec-total-cashflow-screen.md`、`features/feat-total-cashflow-screen.md`

## 着手前提

- SYS-TCSCREEN-P01 の着手時に spec の未決事項 8 件 (取消の 409 canonical_write_busy と 404 の画面での扱い、変更箇所の数え漏れ、承認 note の参照先、S4 の文言提示、除外済み候補が複数の明細と lastOperation の用途、前期比/前年同期比の表記、decision-004 と 017 の食い違い、未記入注記と出典メモ) の扱いを docs/total-cashflow-screen/requirements-baseline.md に記録する。推定のまま confirmed にしない。
- 確定意思決定 qa-total-cashflow-decision-001..018 (005 を除く 17 件) は変更せず、各要件の根拠として引用する。

## 実行グラフ

13 nodes、12 edges、1 root の直列依存。状態・資源・lineage は各 task frontmatter を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-TCSCREEN-P01 | 要件ベースライン確定と未決事項の着手時確認 | — |
| SYS-TCSCREEN-P02 | 総収支集計・判定作業 API・操作履歴テーブルの設計決定記録 | SYS-TCSCREEN-P01 |
| SYS-TCSCREEN-P03 | 設計決定の独立レビュー (不変条件・バックアップ・取消の競合) | SYS-TCSCREEN-P02 |
| SYS-TCSCREEN-P04 | 境界値付きの red テスト先行 (core 規則・API 取消と復元・画面ブロック) | SYS-TCSCREEN-P03 |
| SYS-TCSCREEN-P05 | 総収支集計・判定作業 API・操作履歴・migration 0041・TotalCashflow.tsx の実装 | SYS-TCSCREEN-P04 |
| SYS-TCSCREEN-P06 | 全テスト・型検査・lint の実行記録 | SYS-TCSCREEN-P05 |
| SYS-TCSCREEN-P07 | 受入条件 AC-001..AC-006 の検証 | SYS-TCSCREEN-P06 |
| SYS-TCSCREEN-P08 | 規則定数の整理と migration 0041・3 表バックアップの整合確認 | SYS-TCSCREEN-P07 |
| SYS-TCSCREEN-P09 | アクセシビリティ・CSP・JS 予算・狭幅表示・入力境界の保証 | SYS-TCSCREEN-P08 |
| SYS-TCSCREEN-P10 | 最終レビュー (spec との突合と差分の確認) | SYS-TCSCREEN-P09 |
| SYS-TCSCREEN-P11 | 証跡索引の作成 | SYS-TCSCREEN-P10 |
| SYS-TCSCREEN-P12 | 規則の docs 化と取消競合の runbook | SYS-TCSCREEN-P11 |
| SYS-TCSCREEN-P13 | 単一 PR での配信と close-out | SYS-TCSCREEN-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0 |
| C02 saved state | feature + 13 task が confirmed / pass / complete、registration expected 13 = applied 13 |
| validate-system-plan | pass、P01..P13、`sha256:1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5` |

1 周目は task artifact md 13 件の未実体化で blocked となり、C02 `run-dev-graph-node` の dry-run → 本実行で解消した。
