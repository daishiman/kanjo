# 退避サイクル: 2026-09-22-ai-analysis-screen

AI分析画面 (design/FINAL-UI/images/12-ai.png。feat-ai-analysis-screen、PR #66) の確定仕様。
データ取込画面 (design/FINAL-UI/images/16-import.png) のサイクルを始める際に、本サイクルの章を
`system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『AIに分析を依頼し、根拠と版を確認しますか？』という問いに 1 画面で答え切る」、
データ取込サイクルの U1 は「『複数の明細ファイルを、安全に取り込みますか？』という問いに 1 画面で答え切る」で、
上位概念が入れ替わる。

AI分析は取り込み済みの台帳から集計値を作って外へ持ち出す出口、データ取込はその台帳へ明細を入れる入口であり、
両者は矛盾しない。本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の方法

`main` (f0e5a3b) の `system-spec/` 直下 13 ファイルを `git show HEAD:<path>` で本ディレクトリへ複写した。
本 README 以外は `main` の tree とバイト単位で同一 (sha256 照合済み)。
`architecture/graph.json` の `arch-ai-analysis-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-ai-analysis-screen.md`
- 設計: `architecture/ai-analysis-*.md`
