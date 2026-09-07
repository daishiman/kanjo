# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・0 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-TCF-P01`、`SYS-TCF-P02`、`SYS-TCF-P03`、`SYS-TCF-P04`、`SYS-TCF-P05`、`SYS-TCF-P06`、`SYS-TCF-P07`、`SYS-TCF-P08`、`SYS-TCF-P09`、`SYS-TCF-P10`、`SYS-TCF-P11`、`SYS-TCF-P12`、`SYS-TCF-P13`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-TCF-P01` None

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-TCF-P02` None

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-TCF-P03` None

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-TCF-P04` None

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-TCF-P05` None

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-TCF-P06` None

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-TCF-P07` None

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-TCF-P08` None

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-TCF-P09` None

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-TCF-P10` None

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-TCF-P11` None

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-TCF-P12` None

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-TCF-P13` None

