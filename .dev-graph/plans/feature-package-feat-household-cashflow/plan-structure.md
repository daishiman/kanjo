# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## このタスクの目的と、導入で得られる価値

### 技術的な詳細 (エンジニア向け)
- **目的 (何をするか)**:
  - 家計収支画面を、『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る場にする。
  - 期間を選ぶと家計全体の総額と前年差を最初に掴み、月別推移で『いつ』、事業と個人・生活費カテゴリ・名義別の収入で『どこが』動いたかを確かめ、振替を二重に数えていないと納得したうえで、選んだ月やカテゴリの明細へ一直線に降りられる状態にする。
  - 家計全体の数字は総収支画面の『総合』と必ず一致させる。
- **到達状態 (Goal)**: /household が 10-household.png の全構成要素 (問いの見出しと出典カード・期間タブ・KPI 3 枚と前年差・月別推移 (家計全体 / 事業 / 個人のタブ、当期の棒と純収支の折れ線、前年の点線、月送り)・事業 + 個人 = 家計全体の内訳・生活費 6 区分の表とカテゴリの詳細パネル・名義別の収入・振替の除外一覧・名義ラベルの設定・前年との比較・下部の選択中バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、集計が totalCashflowLedger を正本とする core の純関数 1 か所で算出されて GET /api/household と GET /api/household/category が返し、名義の表示名が owner_labels 表と GET / PUT /api/settings/owner-labels で家計・設定・明細の全画面に効き、URL の seg / month / cat と usePeriod / localStorage の期間から選択が復元でき、ナビ・パンくずが『家計収支』になり、既存の総収支・推移・マトリックス・分析ハブのテストが緑のままの状態。

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・0 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-HOUSEHOLD-P01`、`SYS-HOUSEHOLD-P02`、`SYS-HOUSEHOLD-P03`、`SYS-HOUSEHOLD-P04`、`SYS-HOUSEHOLD-P05`、`SYS-HOUSEHOLD-P06`、`SYS-HOUSEHOLD-P07`、`SYS-HOUSEHOLD-P08`、`SYS-HOUSEHOLD-P09`、`SYS-HOUSEHOLD-P10`、`SYS-HOUSEHOLD-P11`、`SYS-HOUSEHOLD-P12`、`SYS-HOUSEHOLD-P13`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-HOUSEHOLD-P01` 要件ベースライン確定と持ち越し 4 件の着手時整理

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-HOUSEHOLD-P02` household-summary 純関数・3 経路 API・owner_labels・URL 単一真実のワークストリーム設計決定記録

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-HOUSEHOLD-P03` 集計契約・API 契約・名義表示名契約・URL 契約の独立レビュー

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-HOUSEHOLD-P04` core 不変条件・API 契約・migration・DOM の失敗テスト先行作成 (持ち越し 4 件を契約テストで固定)

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-HOUSEHOLD-P05` household-summary 純関数・3 経路 API・owner_labels・家計収支画面・旧参照除去の最終実装

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-HOUSEHOLD-P06` 全テストと型検査と lint の実行記録

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-HOUSEHOLD-P07` 受入基準 S1 から S6 の検証

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-HOUSEHOLD-P08` 重複・旧参照の読取専用監査

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-HOUSEHOLD-P09` アクセシビリティ・入力検証・変更系フェンス・JS バンドル予算の保証確認

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-HOUSEHOLD-P10` 独立最終レビュー

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-HOUSEHOLD-P11` 再現可能な証跡索引の作成

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-HOUSEHOLD-P12` 集計規則・6 区分の対応表・振替の対推定・名義表示名の docs 最終同期

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-HOUSEHOLD-P13` 単一 PR での配信と migration 適用とクローズアウト

