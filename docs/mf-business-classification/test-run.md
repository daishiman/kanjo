# MF 事業判定 — 検証記録

受入条件の正本は `specs/spec-mf-business-classification.md`。本書は直近の実行結果だけを持ち、要件本文や実データ値を複製しない。

## 検証対象

- 比較時 trim と接頭辞判定
- `manual > rule > vendor_memory > mf_mid > default`
- `resolveTx` を介した公私仕分けとトータル収支の一致
- `/api/transactions` の `src` と `summary.progress.bySource`
- 要確認集合と `reviewCount` / `reviewAmount`
- core、API、web の型整合

## 実行結果の書式

実行時刻、コミット、コマンド、成否だけを記録する。raw production data のファイル名、行、金額、取引先、口座情報は記録しない。失敗時はテスト名と匿名化した原因分類だけを残す。

現時点の結果は親工程の統合検証で更新する。feature の完了状態は `features/feat-mf-business-classification.md` の frontmatter だけで管理する。
