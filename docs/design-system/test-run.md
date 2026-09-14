# テスト実行記録 (SYS-DSFOUND-P06)

Run reference: `docs/design-system/run-reference.json`

Phase3後のコマンド、終了状態、件数、実行時刻、対象commit/runtimeは上記参照先の `verification_run` を唯一の正本とする。本書へ実測値を複製しない。

`pnpm run design-system:fast` はP04/P05/P08の改善反復だけに使う短時間gateであり、S6の受入証跡にはしない。`pnpm run evidence:acceptance` は毎回現在の `pnpm run verify:full` を実行し、出力を `acceptance-worktree-full-s6-gate` として保持する。APIの変更有無はcore・web・lint・build・browser・previewの入力不変を証明しないため、full receiptの再利用条件にしない。

## 再現順

```bash
pnpm run design-system:fast
pnpm run evidence:acceptance
pnpm evidence:check
```

`evidence:acceptance` が実行する `verify:full` は test・typecheck・lint・build/budget・4本のbrowser check・preview smokeを含む。受入時に各コマンドを別途再実行しない。

集約した初回実行では、HALOの旧CSS文字列表記に固定したテスト1件が新しい意味トークン表現を拒否した。期待値を `EFFECT_COLOR.annotateHalo` 参照へ直し、web全体と影響範囲を再実行した経緯もverification runに残す。
