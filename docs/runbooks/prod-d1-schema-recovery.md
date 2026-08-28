# 本番D1スキーマ復旧 — incident checklist

この文書は、今回の復旧で変化する値と証跡リンクだけを記録する薄いチェックリストです。
通常のMigrate、適用順序、rollback、Time Travel、秘密値の扱いは
[`CI/CD・本番運用ガイド`](../ci-cd-operations.md) が唯一の正本です。この文書へ同じ手順を転記しません。

## Incident control

| 項目 | 記録 |
|---|---|
| 状態 | `not_started` |
| 対象 | `production` / `kanjo-db` |
| incident責任者 | 未記入 |
| 作業開始時刻 | 未記入 |
| 作業終了時刻 | 未記入 |
| incident baseline | `.dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-01-remote-baseline.json`（P01で作成） |
| 承認対象manifest | `.dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-07-approved-pending-manifest.json`（P07で作成） |
| manifest未承認例 | [approved-pending-manifest.example.json](templates/approved-pending-manifest.example.json) |
| 復旧証跡 | `.dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-11-recovery-evidence.md`（P11で作成） |

この作業ではremoteの状態をまだ確認していません。過去に観測した番号範囲や、このリポジトリに現在あるファイルを
そのまま適用対象とみなしません。適用対象は、同一時点のremote inspectionとrepository headから作成し、
利用者が承認したmanifestだけです。

## Progress gates

- [ ] 作業中にアプリへ書き込みが入らない時間帯を確保した
- [ ] incident baselineにrepository head、ordered migrations digest、remote applied head、remote inspection証跡、ordered pending entriesを記録した
- [ ] 適用直前の全件exportを取得し、保管場所と取得時刻を復旧証跡へ記録した
- [ ] [`reconcile-row-counts.sh`](scripts/reconcile-row-counts.sh) の`capture`結果を適用前baselineとして記録した
- [ ] manifestのrepository head / ordered migrations digest / remote inspectionを適用直前に再取得し、差分がないことを確認した
- [ ] 承認者と承認時刻が記録され、manifest statusが`approved`になっている
- [ ] 利用者本人が正本のMigrate手順に従い、`APPLY`と承認済みmanifest JSONを入力して実行した
- [ ] 適用後の未適用件数が0である証跡を記録した
- [ ] `compare`結果が`pass`で、適用前から減少した主要テーブルが0件である
- [ ] 取込と取込履歴の正常応答を、明細内容を記録せずstatusと時刻だけで証跡化した
- [ ] 夜間backupの成功と当日snapshotの存在を、内容を記録せずstatusと時刻だけで証跡化した
- [ ] ローカルの全件exportを安全に削除し、削除確認だけを証跡化した

一つでも未確認、差分、判定不能、行数減少があれば進行を止めます。復元の要否と手順は
正本の[「ロールバックと復旧」](../ci-cd-operations.md#10-ロールバックと復旧)へ戻り、利用者承認なしに
restore、手動UPDATE/DELETE、migration適用を行いません。

## Evidence index

| 証跡 | 参照先 | 記録してよい内容 |
|---|---|---|
| 適用前remote inspection | incident baseline | migration名、件数、repository head、ordered migrations digest、取得時刻 |
| 適用直前export | recovery evidence | ローカル保管先への非公開参照、取得status、時刻 |
| 適用前行数 | recovery evidence | `capture` JSONへの参照 |
| 人間承認 | approved manifest | 承認者、承認時刻、承認対象entry |
| Migrate実行 | recovery evidence | 実行者、runへの参照、status、時刻 |
| 適用後remote inspection | recovery evidence | 未適用件数、取得status、時刻 |
| 行数突合 | recovery evidence | `compare` JSONへの参照、減少件数、status、時刻 |
| API/夜間backup確認 | recovery evidence | status、時刻、非secretの実行参照 |
| export削除確認 | recovery evidence | status、時刻 |

証跡へ行内容、金額、摘要、ファイル名、R2 key、認証情報、ダンプ本体を貼り付けません。
行数突合scriptの引数と出力形式は `bash docs/runbooks/scripts/reconcile-row-counts.sh --help` を正本とします。
