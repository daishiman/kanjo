# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・0 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-IMPREQ-P01`、`SYS-IMPREQ-P02`、`SYS-IMPREQ-P03`、`SYS-IMPREQ-P04`、`SYS-IMPREQ-P05`、`SYS-IMPREQ-P06`、`SYS-IMPREQ-P07`、`SYS-IMPREQ-P08`、`SYS-IMPREQ-P09`、`SYS-IMPREQ-P10`、`SYS-IMPREQ-P11`、`SYS-IMPREQ-P12`、`SYS-IMPREQ-P13`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-IMPREQ-P01` 改善要望の実行要件ベースライン確定

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-IMPREQ-P02` 4層の境界とデータ契約の設計

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-IMPREQ-P03` 境界設計の独立レビュー

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-IMPREQ-P04` 受入条件を検証へ写す試験設計

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-IMPREQ-P05` 撮影・診断・受け渡し・失効の実装

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-IMPREQ-P06` 検証の実行と失敗の解消

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-IMPREQ-P07` 受入条件15件の判定

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-IMPREQ-P08` 既存資産への相乗りと重複の整理

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-IMPREQ-P09` 秘匿値と保持期間の品質保証

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-IMPREQ-P10` 変更全体の最終レビュー

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-IMPREQ-P11` 証跡の収集と保全

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-IMPREQ-P12` 利用手順と運用手順の記載

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-IMPREQ-P13` 配信条件の確定と保留判断

