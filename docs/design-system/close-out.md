# 公開準備の単一入口 (SYS-DSFOUND-P13)

Run reference: `docs/design-system/run-reference.json`

公開前の人間向け確認は次の1コマンドだけを入口とする。このコマンドはread-onlyで、リポジトリや外部サービスを変更しない。

```bash
pnpm run design-system:status
```

結果を後続の機械検査で使う場合は `pnpm run design-system:status -- --json` を使う。出力は現在のfull S6証跡とそのコマンドidentity、machine token integrity、独立外部承認、実Git追跡状態、maintainer/external parity、配信workflowの承認digest拘束を個別に示し、未完了の場合はblockerとnext_actionsを返す。

statusがexit 0のときだけ公開準備完了と扱う。文書の成功記述やローカルJSONの自己記入は代用にしない。

現在は公開準備未完了である。特に `.github/workflows/deploy.yml` は外部承認receiptを承認対象digestに結び付けた上でこのstatus gateを実行する経路をまだ持たない。これは明示的な残存blockerであり、full証跡など他の条件が通っても公開準備完了とは判定しない。

Phase3ではcommit・push・PR・deploy・publishを行っておらず、本番URLに変更はない。承認と同期の完了後も既存のCloudflare配信経路を使い、CSP/API/DBは変更しない。

ロールバックが必要になった場合は、公開に使った単一PRのmerge commitをrevertする。APIとdatabase migrationは本変更の対象外なので、データロールバックは行わない。
