# 中項目による事業判定 — 運用手引き

規則の正本は `specs/spec-mf-business-classification.md`。この手引きは日常の確認と切り分けだけを説明する。

## 毎月の確認

1. 公私仕分け画面で、判定根拠の内訳と未確認件数を見る。
2. `中項目` 由来の明細を必要に応じて確認する。
3. 個別に異なる判断をする場合は手動編集する。手動編集は自動判定より優先される。
4. トータル収支画面で、要確認の件数と金額を一組で確認する。

## ローカルで画面を確認する

`scripts/seed-local.mjs` は、中項目が `事業` で始まる明細を収入1件・支出2件、毎月投入する
(`事業・受託` / `事業・情報サービス` / `事業・外注費`)。これらの `内容` はどの既定ルールの
キーワードにも当たらない語にしてある。ルールが先に当たると根拠が `ルール` になり、
中項目由来で判定されたのかが画面から読めなくなるため。

```sh
pnpm run preview
```

別のterminalでローカル専用の招待を作り、表示されたlocalhost URLで本人登録を完了する。
初期パスワードの直接投入は行わない。管理者はTOTPを通すまでセッションが出ないため、
投入には member の identity を使う。

```sh
node scripts/seed-admin.mjs
node scripts/seed-admin.mjs --email member@kanjo.local --role member
export KANJO_SEED_EMAIL=member@kanjo.local
read -rs 'KANJO_SEED_PASSWORD?Local password: '
export KANJO_SEED_PASSWORD
node scripts/seed-local.mjs
unset KANJO_SEED_EMAIL KANJO_SEED_PASSWORD
```

パスワードは招待承諾画面で本人が決め、command、文書、issueへ書かない。
詳細は[`mobile-financial-visualization-test.md`](../runbooks/mobile-financial-visualization-test.md#4-ローカル招待を承諾し匿名テストデータを投入)に従う。

公私仕分け画面の根拠内訳に `中項目` が3件現れ、トータル収支画面で当月の事業収入に
その入金が含まれ、家計収入には含まれないことを確認する。

## 想定と違うとき

`GET /api/transactions` の明細行にある `src` を確認する。

- `手動`: 通常の個別編集、または materialize 済みの取引先メモリである。必要なら内部の `origin` で `vendor_memory` の由来を区別する。
- `ルール`: 適用ルールを確認する。
- `中項目`: MF の中項目を確認する。比較時には前後空白を除去する。
- `既定`: 手動・ルール・取引先メモリ・中項目のどれにも一致していない。

`vendor_memory` は独立した `src` 値ではない。`clsSrc` は内部実装名であり、API や問い合わせでは `src` を使う。実データの行、金額、取引先名を公開 issue や文書へ貼らない。

## 復旧用語

前版へ全体を戻すのは「版の巻き戻し」。MF 中項目だけを止めるのは「部分無効化」で、別変更として扱う。
