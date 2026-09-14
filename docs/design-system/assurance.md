# 非機能要件の確認 (SYS-DSFOUND-P09)

Run reference: `docs/design-system/run-reference.json`

実測値は上記参照先の `verification_run` だけを正本とする。

| 観点 | 根拠 |
|---|---|
| 初期JS予算 | build:bundle → check:js-budget |
| CSP | `packages/web/public/_headers`を変更しない |
| フォント | font-loading contract。既存IBM Plex Mono Latin 400/600を自己配信し、外部CDNを追加しない |
| 実データ混入 | security:content |
| コントラスト | contrast/chart/Button contracts |
| 狭幅・200%・reduced-motion | 4本のbrowser check |

`samples/` は追跡可能な公開fixture領域なので匿名化済みデータだけを置く。実データはgitignore対象の `data/` に置く。今回のPhase3作業ではsamplesの内容、data、local secretsを変更していない。
