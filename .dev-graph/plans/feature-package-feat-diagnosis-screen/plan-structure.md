# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・0 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-DIAGNOSIS-SCREEN-P01`、`SYS-DIAGNOSIS-SCREEN-P02`、`SYS-DIAGNOSIS-SCREEN-P03`、`SYS-DIAGNOSIS-SCREEN-P04`、`SYS-DIAGNOSIS-SCREEN-P05`、`SYS-DIAGNOSIS-SCREEN-P06`、`SYS-DIAGNOSIS-SCREEN-P07`、`SYS-DIAGNOSIS-SCREEN-P08`、`SYS-DIAGNOSIS-SCREEN-P09`、`SYS-DIAGNOSIS-SCREEN-P10`、`SYS-DIAGNOSIS-SCREEN-P11`、`SYS-DIAGNOSIS-SCREEN-P12`、`SYS-DIAGNOSIS-SCREEN-P13`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-DIAGNOSIS-SCREEN-P01` 診断画面の要件確定と受入条件の分解

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-DIAGNOSIS-SCREEN-P02` 検知器レジストリ境界と実装アーキテクチャの確定

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-DIAGNOSIS-SCREEN-P03` 画面構成と API 契約の設計レビュー

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-DIAGNOSIS-SCREEN-P04` 境界値・contract・統合テストの設計

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-DIAGNOSIS-SCREEN-P05` 検知器レジストリ・健全性スコア・2 endpoint・D1 新表・診断画面の実装

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-DIAGNOSIS-SCREEN-P06` テスト実行と緑化

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-DIAGNOSIS-SCREEN-P07` 受入条件 AC-001 から AC-006 の判定

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-DIAGNOSIS-SCREEN-P08` tradeoffCandidates の統合と D1 migration の整理

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-DIAGNOSIS-SCREEN-P09` CI ゲートの緑維持と js-budget の確認

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-DIAGNOSIS-SCREEN-P10` 最終レビューと差分の確認

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-DIAGNOSIS-SCREEN-P11` 証跡の集約

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-DIAGNOSIS-SCREEN-P12` docs の更新と運用手順の記載

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-DIAGNOSIS-SCREEN-P13` 本番反映 (Migrate APPLY から Deploy)

