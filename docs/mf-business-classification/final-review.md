# MF事業判定 — 最終レビュー

判定対象は canonical spec、対象実装、匿名 fixture のテスト、公開安全な証跡である。

## 判定軸

- 矛盾なし: 分類、wire、要確認、復旧用語が正本と一致する。
- 漏れなし: 比較境界、優先順位、共通解決、集計、互換性を検査する。
- 整合性あり: core 型、API応答、web表示が同じ意味を使う。
- 依存関係整合: total-cashflow は `resolveTx` を介し、feature / task / lineage が実在参照へ到達する。

個別の成功値や実データ由来の値は本書へ複製しない。実行結果は `test-run.md`、受入対応は `acceptance.md`、証跡索引は `evidence.md` を正本とする。

正式 rollback は版の巻き戻しであり、MF中項目だけの停止は部分無効化として別変更にする。未解決事項がある場合は `close-out.md` の残リスクへ記録する。
