# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 由来の派生ビュー。構造の正本は `task-graph.json`、状態の正本は `plan-structure-status.json`。再生成時も `nodes[].depends_on` の 12 edge・単一起点・順序をそのまま投影すること。上流 completeness が FAIL の間は blocked 表示を維持する。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=13 / pending=0
- route-report 数: 0
- 上流ゲート: `system-spec/completeness-findings.json` が FAIL のため、全 task は fail-closed で blocked。PASS 再評価まで実装着手・promotion を行わない。

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・12 依存エッジ。`task-graph.json#nodes[].depends_on` と同一の直列 DAG。
- 起点タスク (依存なし): `SYS-PDSR-P01` のみ
- 順序: `SYS-PDSR-P01 → P02 → P03 → P04 → P05 → P06 → P07 → P08 → P09 → P10 → P11 → P12 → P13`

## 成果物 ownership

| 成果物 | 唯一writer | その他の phase |
|---|---|---|
| `docs/runbooks/prod-d1-schema-recovery.md` | P05 | read-only consumer。P12 は SSOT とのリンクを引き継ぐだけ |
| `docs/runbooks/scripts/reconcile-row-counts.sh` | P05 | read-only validator。不備は P05 へ差し戻す |
| incident baseline | P01 | P02 以降が参照 |
| 人間承認済み pending manifest / 本番受入記録 | P07 | P08 以降が参照 |
| phase 固有 evidence | その phase | 他 phase は変更しない |

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ✗ `SYS-PDSR-P01` 復旧要件のベースライン確定

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ✗ `SYS-PDSR-P02` 適用順序と不変条件の設計

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ✗ `SYS-PDSR-P03` 復旧設計の独立レビュー

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ✗ `SYS-PDSR-P04` 行数突合と動作確認の検証設計

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ✗ `SYS-PDSR-P05` 復旧手順書と突合スクリプトの作成

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ✗ `SYS-PDSR-P06` ローカル環境での適用予行

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ✗ `SYS-PDSR-P07` 本番適用の受入判定

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ✗ `SYS-PDSR-P08` 既存データの互換確認と派生テーブルの初期状態

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ✗ `SYS-PDSR-P09` 品質・セキュリティ・運用準備の確認

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ✗ `SYS-PDSR-P10` 復旧完了の最終ゲート

## P11
> 🎯 何のため: 検証した証拠を残す
- ✗ `SYS-PDSR-P11` 再現可能な証跡の整備

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ✗ `SYS-PDSR-P12` 運用文書と引き継ぎの整備

## P13
> 🎯 何のため: リリースしてよいか判定する
- ✗ `SYS-PDSR-P13` 復旧後の稼働確認と事後観察
