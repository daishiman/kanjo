---
graph_node_id: feat-diagnosis-screen
artifact_kind: feature
artifact_subtypes: []
title: 診断画面 (08-diagnosis) を改善アクション中心に作り直す
project_id: kanjo
domain: analysis
status: active
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags:
  - diagnosis
  - analysis
  - macro-feature
file_path: features/feat-diagnosis-screen.md
template_id: feature
template_version: 1.0.1
confirmation_status: confirmed
evaluation_status: pass
confirmation_evidence:
  evaluator: dev-graph/dev-graph-integrity-auditor@0.1.11
  evidence_ref: eval-log/run-dev-graph-decompose-audit-verdict.json
  evaluated_digest: 08f4c63b61367bf4feebdb1d14cfa3f4b49f4504a1c20c57833486b6fd87f92e
source_lineage:
  origin_kind: generated
  source_plugin: dev-graph
  source_path: specs/spec-diagnosis-screen.md
  source_version: 0.1.11
  source_digest: 08f4c63b61367bf4feebdb1d14cfa3f4b49f4504a1c20c57833486b6fd87f92e
  imported_at: "2026-09-18T01:41:17Z"
created_at: "2026-09-18T01:41:17Z"
updated_at: "2026-09-18T01:49:19Z"
depends_on: []
related_nodes:
  - spec-diagnosis-screen
  - arch-diagnosis-screen
resource_scope:
  - packages/core/src
  - packages/api/src/routes
  - packages/api/migrations
  - packages/web/src/pages/analysis
  - docs
purpose: 支出の問題点を見つけた後に何をすればよいかが決まらない状態を解消する。利用者は診断画面で、改善余地の大きい順に並んだ改善アクションと、その根拠と金額と手間を同じ画面で見比べ、どれに着手し何を見送るかをその場で決めて記録できるようにする。
goal: /analysis/diagnosis を開くと、健全性スコアとその内訳、改善余地の合計、年間改善インパクト降順の改善アクション表、削減を積み上げるウォーターフォール、診断根拠の表が 1 画面に揃い、各アクションの対応状況とメモが D1 に保存されて期間切替・再取込・再ログインをまたいで復元し、詳細パネルと選択バーから対象を絞った他画面へ遷移できる状態。
scope_in:
  - packages/core の検知器レジストリと diagnosis() の再構成 (FR-004)
  - 健全性スコアの 4 要素合成と内訳返却 (FR-005)
  - GET /api/diagnosis の新設と返却契約 (診断結果・健全性・シグナル・改善アクション・ウォーターフォール・診断根拠・遷移先経路名) (FR-007, FR-009, BR-001..BR-004, BR-009)
  - PATCH /api/diagnosis/actions/:action_key による対応状況・メモ・決定時刻の保存 (FR-008, BR-005..BR-007)
  - 改善アクションの判断を保持する D1 新表と migration (FR-008, BR-008)
  - /analysis/diagnosis 画面の再構成 (期間タブ・条件の帯・診断結果カード・健全性カード・主なシグナル・改善アクション表・ウォーターフォール・診断根拠表・完了すると変わる指標・詳細パネル・選択バー) (FR-001, FR-002, FR-003, FR-006)
  - URL searchParams による条件の保持と復元 (FR-010)
  - 既存の科目別プロファイル表と自動診断の開閉内への退避 (FR-011)
scope_out:
  - AI による改善提案の生成。外部送信および LLM 呼出しを行わない (spec スコープ Out / arch Non-goals)
  - 改善の実行そのものの代行 (解約手続きや契約変更の代行)
  - 今回登録する 6 種以外の検知器の実装。検知器の追加はレジストリの仕組みまでを本 feature の範囲とし、7 種目以降は別サイクルとする
  - 外部ベンチマーク (業種平均・世帯平均) との比較。健全性スコアは自分のデータだけから算出する (ADR-004)
  - 取引先の名寄せ規則
  - 共通シェルの作り直し
  - web 以外の platform 向けの専用アプリ
  - 診断以外の画面 (/classify, /budget, /subscriptions, /analysis/reconciliation, /analysis/total-cashflow) の内部仕様変更。本 feature は遷移の入口を渡すだけで、遷移先の画面は変更しない
  - キュー・イベント・スケジューラの導入 (仕様書「イベント・非同期処理」で明示的に非適用)
  - 改善余地の金額そのものの永続化。保存するのは利用者の判断 (状態・メモ・決定時刻) だけとする (ADR-002)
  - MF/freee 連携の取込仕様およびデータ取込画面の変更
  - 認証・認可方式の変更
acceptance:
  - AC-001 既定条件で /analysis/diagnosis を開くと、期間タブ・見出し・条件の帯・診断結果カード・健全性カード・主なシグナル 3 件・改善アクション表・ウォーターフォール・診断根拠表・完了すると変わる指標・詳細パネル 3 タブ・選択バーが DOM テストで描画され、科目別プロファイルが開閉で表示され、直書き色の lint が 0 件である
  - AC-002 検知器定義を 1 件足したテストで、表・ウォーターフォール・詳細パネル・API 返却に新しい課題が現れ、packages/web と packages/api のコードに検知器 id の分岐が 0 件である
  - AC-003 境界値テストで要素スコア・重み・寄与点・総合スコア・区分が算式どおり一致し、寄与点の合計が総合スコアと一致する (0・100・要素が算出不能の各点を固定する)
  - AC-004 対応中へ変更した後に期間切替・再取込・再取得を行う統合テストで、同じ action_key の状態・メモ・決定時刻が保持され、対応済みと見送りが既定一覧から畳まれ合計から除かれ、畳んだ件数と金額が注記に現れる
  - AC-005 詳細パネルと選択バーからの遷移で 5 画面が対象を絞った状態で開き、条件が URL から復元される
  - AC-006 3 指標 かける 3 範囲 かける 2 比較対象のどの組合せでも画面の数値が core の返却値と一致し、総合 = 事業 + 家計 が成り立ち、期間合計が同じ期間の総収支画面の値と一致する
architecture_refs:
  - arch-diagnosis-screen
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: 確定済み specification/architecture 一対から導出した単一のマクロ機能単位であり、purpose/goal/scope/acceptance/architecture_refs を第一級に持つため artifact_kind=feature に一意に定まる。P01..P13 の phase task は本ノードに含めず system-dev-planner へ委譲する。
classification_candidates: []
tracker_binding: beads
beads_linkage: null
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence:
  policy: manual
  status: open
  source: null
  completed_at: null
  reconciled_at: null
  evidence_refs: []
implementation_readiness:
  status: complete
  missing_sections: []
  checked_at: "2026-09-18T01:49:19Z"
---

# 目的

支出の問題点を見つけた後に何をすればよいかが決まらない状態を解消する。現在の診断画面は科目別プロファイルと自動診断の一覧を出すだけで、金額の大きさ・着手の手間・根拠の確かさが別々の場所にあり、どれから手を付けるかの判断が画面の外に出てしまっている。

利用者は改善アクションを年間改善インパクトの降順で見比べ、その根拠 (どのデータソースの、どの期間の、どれだけの範囲を見た結果か) と対応の手間を同じ画面で確認し、着手するものと見送るものをその場で決めて記録する。決めた内容は次に開いたときにも残っている必要がある。判断の記録がないと、同じ課題を毎回ゼロから読み直すことになるためである。

## 到達状態

/analysis/diagnosis を開くと、次が 1 画面に揃っている。

- 健全性スコア (0-100) と 4 要素の内訳 (実測値・要素スコア・重み・寄与点)。算出不能な要素があるときは、その要素を除いて重みを正規化した旨が画面に出る。
- 改善余地の合計と、年間改善インパクト降順の改善アクション表 (番号・優先度・課題・年間改善インパクト・対応の手間・ステータス・次のアクション)。
- 表と同じ並び順で削減を積み上げるウォーターフォール (左端に改善余地の合計、右端に改善後の支出見込み)。
- 診断根拠の表 (データソース・対象期間・カバー率・主な内容)。各行はデータ取込の該当ソースへ辿れる。
- 主なシグナル (最大 3 件)、完了すると変わる指標、詳細パネル、選択バー。

各アクションの対応状況 (未着手 / 対応中 / 対応済み / 見送り)・メモ・決定時刻は D1 に保存され、期間切替・再取込・再ログインをまたいで復元する。対応済みと見送りは既定で畳まれ、改善余地の合計から除外され、畳んだ件数と金額が注記に出る。

期間・範囲・指標・比較対象・選択した課題・畳みの切替は URL の searchParams に保持され、再読み込みと共有で同じ表示に戻る。

## スコープ

- スコープ内: frontmatter の `scope_in` に列挙した 8 項目 (core の検知器レジストリ、健全性スコアの合成、GET /api/diagnosis、PATCH /api/diagnosis/actions/:action_key、D1 新表と migration、画面の再構成、URL 条件の保持、既存表示の開閉内への退避)。
- スコープ外: frontmatter の `scope_out` に列挙した 12 項目。内訳は 2 系統ある。
  - 仕様書「スコープ」Out とアーキテクチャ Non-goals から引き継いだ 7 項目: AI による改善提案の生成 (外部送信・LLM 呼出しを行わない)、改善の実行そのものの代行、今回登録する 6 種以外の検知器の実装、外部ベンチマークとの比較、取引先の名寄せ規則、共通シェルの作り直し、web 以外の platform 向け専用アプリ。
  - 本 feature の境界として追加した 5 項目: 遷移先画面の内部仕様、キュー・イベント・スケジューラ、改善余地の金額そのものの永続化、MF/freee 取込仕様、認証・認可方式。
- 番号引用の注記: `scope_in` の `FR-007` (診断根拠) は API 項目と画面項目の双方に意図して重ねている。診断根拠はサーバが返す内容と画面の表の両方にまたがり、どちらか一方だけでは充足しないためである。

## 受入

- [ ] `AC-001` 既定条件の描画と直書き色 lint 0 件 (S1)
- [ ] `AC-002` 検知器 1 件追加で画面と API に波及し、web/api に検知器 id の分岐 0 件 (S2)
- [ ] `AC-003` 健全性スコアの要素スコア・重み・寄与点・総合・区分が算式どおりで、寄与点合計が総合と一致 (S3)
- [ ] `AC-004` 対応状況・メモ・決定時刻が期間切替と再取込をまたいで保持され、畳みと合計除外が注記付きで成立 (S4)
- [ ] `AC-005` 5 画面への絞り込み遷移と URL からの条件復元 (S5)
- [ ] `AC-006` 3 指標 かける 3 範囲 かける 2 比較対象で core と画面が一致し、総合 = 事業 + 家計、総収支画面と期間合計が一致 (S6)

受入の判定に効くビジネスルールの対応 (本文は複製せず仕様書を参照する):

| ビジネスルール | 内容の要旨 | 主に効く受入 |
|---|---|---|
| `BR-001` | 改善インパクト合計は対応済みと見送りを除外し、同一 action_key を二重に数えない | AC-004 |
| `BR-002` | 丸めは表示時のみ、内部は円単位の整数 | AC-006 |
| `BR-003` | 要確認の明細は事業にも家計にも数えず、件数と金額を注記で示す | AC-006 |
| `BR-004` | 総合 = 事業 + 家計、期間合計が総収支画面と一致 | AC-006 |
| `BR-005` | status は 4 語の完全一致だけを受け、不一致は 400 | AC-004 |
| `BR-006` | action_key はレジストリが生成しうる形だけを受け、不一致は 400 | AC-002, AC-004 |
| `BR-007` | note は長さ上限を設け、超過は 400。保存時に加工しない | AC-004 |
| `BR-008` | 検知されなくなった action_key の行は削除せず残し、再検知で判断が復帰する | AC-004 |
| `BR-009` | 主なシグナルは 3 件まで | AC-001 |

## アーキテクチャ参照

- `architecture_refs`: `arch-diagnosis-screen` (ADR-001 検知器レジストリの外出し / ADR-002 判断だけを保存 / ADR-003 D1 新表 / ADR-004 健全性スコアを自分のデータだけから / ADR-005 chart.js floating bar でウォーターフォール / ADR-006 楽観更新をしない)
- 仕様 (`related_nodes`): `spec-diagnosis-screen` (FR-001..FR-011 / BR-001..BR-009 / AC-001..AC-006 / API 契約 diagnosis-get, diagnosis-action-patch)
- 参照方式: 本ノードは仕様本文を複製せず、`architecture_refs` と `related_nodes` の lineage 参照だけを持つ (MM-12)。

## 機能間依存

- `depends_on`: なし (空配列)
- 依存理由: 本サイクルのマクロ分解で生成した feature はこの 1 件のみであり、他 feature の完了を前提とする順序制約が存在しない。参照する specification/architecture は feature ではなく、機能間依存ではなく `architecture_refs` と `related_nodes` で表す。既存画面 (/classify, /budget, /subscriptions, /analysis/reconciliation, /analysis/total-cashflow) は本 feature のスコープ外で、変更を伴わない遷移先として扱うため依存に数えない。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-diagnosis-screen` と repo 相対の `--feature-context features/feat-diagnosis-screen.context.json` で起動する。人間による `/system-dev-plan` の実行結果も同じ登録経路として受理し、`graph_node_id` と `source_digest` を冪等キーに二重登録を防ぐ。
- 生成物: P01..P13 の exact 13 executable task specs と 13-node の intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-diagnosis-screen` と共通の `feature_package_id` で C02 経由の atomic 登録とし、expected/applied ともに 13 を必須とする。
- 完了 rollup: exact 13 が全て done で、P07/P10/P11 の evidence が上記 `AC-001`..`AC-006` を満たす場合だけ本 feature を done とする。
