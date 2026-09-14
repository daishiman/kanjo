# 受け入れ確認 (SYS-DSFOUND-P07)

Run reference: `docs/design-system/run-reference.json`

機械検査は `pnpm run evidence:acceptance` で設定済みコマンドを再実行して判定する。人間のtoken承認、Git追跡済みrelease gate、最終4条件判定は未完了であり、実装者は承認済みと扱わない。実測値の正本は上記参照先の `verification_run` だけとする。

| AC | 実装境界 | 状態 | 証跡 |
|---|---|---|---|
| AC-001 / S1 | hex/rgb/hsl/CSS Color構文を含む直書き色を検出 | review待ち | verification runのlint |
| AC-002 / S2 | 全実描画chart consumerが意味系列・装飾fill helperを使用 | review待ち | chart contractとbrowser checks |
| AC-003 / S3 | coreを唯一の値正本とし、schema・関係不変条件・consumer一致を検査 | review待ち | core testとtoken check |
| AC-004 / S4 | 文字、Button/入力境界、意味系列のコントラスト | review待ち | contrast contract |
| AC-005 / S5 | route registry由来の20ルートがLayout/PageShellを使用 | review待ち | common-shell contract |
| AC-006 / S6 | 型・lint・package test・browser check・bundle予算 | review待ち | verification run |

標準の主・副・危険・text・submit操作は共通Buttonを通す。menu/tab/sort/toggle/category pickerなどARIA固有状態と一体のcontrolだけをnative buttonの例外とする。本文のreading/data幅、page gutter、body行高、Button 44px、chart motionは意味トークンのconsumerへ接続済み。
