# 概況画面 リリースと巻き戻し (SYS-OVERVIEW-P13)

概況画面の変更を本番へ出す単位、配信経路、巻き戻し手順の記録です。
デプロイと D1 migration の一般則は `docs/ci-cd-operations.md` が正本で、ここでは概況に固有の判断だけを書きます。

## 1. 配信単位

- **1 本の PR** にまとめます。migration 0040・API・web・テスト・文書は互いに前提を持つため、分けると中間状態 (表だけある / 画面だけある) が本番に出ます。
- PR 本文には dev-graph の graph_node_id (SYS-OVERVIEW-P01..P13) を記載し、default branch (`main`) を対象にします。
- 配信先: Cloudflare Workers `kanjo-console` と D1 `kanjo-db`。

## 2. 配信経路 (`.github/workflows/deploy.yml`)

| 順 | ステップ | 概況での扱い |
|---|---|---|
| 1 | `pnpm --filter @kanjo/web build:artifact` | 本番を触らない build を migration より前に行う |
| 2 | `node .github/scripts/plan-auto-migration.mjs` | 0040 は `CREATE TABLE IF NOT EXISTS` 2 文だけで、破壊的所見 0 → `decision=apply` |
| 3 | `pnpm run db:checkpoint` | Time Travel の復元地点を記録 |
| 4 | `pnpm run db:migrate:remote` | 0040 を自動適用 |
| 5 | `check-d1-migrations.mjs` | 未適用 0 を確認 |
| 6 | `wrangler deploy` | Worker (`EXPECTED_D1_MIGRATION = 0040_...`) を配信 |
| 7 | smoke 2 回 | 反映待ち後と旧実行環境の終了待ち後 |

## 3. リリース前の確認 (ローカル実行結果)

| コマンド | 結果 |
|---|---|
| `pnpm --filter @kanjo/web run build:artifact` | 成功 (`dist/` 生成、manifest 除去) |
| `pnpm --filter @kanjo/web run build:bundle && pnpm --filter @kanjo/web run check:js-budget` | 109.29 KiB / 110 KiB (main 取り込み後) |
| `pnpm run github-scripts:test` | 42 / 42 pass (`plan-auto-migration.test.mjs` を含む) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` / `pnpm run test:aux` | exit 0 (main 取り込み後) |
| AC-001..AC-007 | [`acceptance.md`](acceptance.md) のとおり |

取り込み前に AC-007 を未達にしていた既存失敗 3 件 ([`test-run.md`](test-run.md) §2) は、main 取り込み後の再実行 (同 §5) で解消しました。
画面の実描画検査 (`check-financial-visuals`) も取り込み後に再実行して合格しました。draft PR の CI が緑になってから Ready for review にし、Beads (kanjo-8c2) は main へのマージ後に閉じます。
仕様への影響の判断は [`spec-reflection-receipt.md`](spec-reflection-receipt.md) に記録しています。

## 4. 巻き戻し

### 4.1 画面・API の不具合 (通常はこれ)

Worker だけを直前のビルドへ戻し、**`review_snoozes` と `monthly_close_reviews` は残します**。

```bash
pnpm --filter @kanjo/api exec wrangler deployments list
pnpm --filter @kanjo/api exec wrangler rollback <直前の version-id>
```

残してよい理由:

- 0040 は表の追加だけで、既存の表・列を変えていません。旧 Worker は 2 表を参照しないので動作に影響しません。
- 旧 Worker の schema guard は `0039_account_login.sql` を期待しますが、判定は「適用済みの版が期待以上なら ready」です。0040 が適用済みでも 503 になりません (`packages/api/src/schema-guard.ts`)。
- 2 表は利用者の判断 (後で確認・月次レビュー) の記録です。消すと再配信時に判断が失われます。

緊急 rollback の後は、該当 PR の squash commit を `git revert` した PR を作り、リポジトリと本番を一致させます。

### 4.2 D1 を戻す必要がある場合

0040 は破壊的変更を含まないため、D1 の restore は原則不要です。
どうしても必要なときは `docs/ci-cd-operations.md` §10.2 に従い、手順 3 で記録した復元地点と影響範囲の承認を得てから行います。
2 表を DROP する reverse migration は用意しません。

## 5. リリース後の確認

1. 概況で未処理件数がバッジ・カード・アクションバーの 3 か所で一致する。
2. 「後で確認」→ 3 か所が同時に減る → 「解除」で戻る。
3. 月次クローズで「レビュー済みにする」が保存され、再読込後も残る。
4. 件数ずれの報告があれば [`../runbooks/overview-review-queue-mismatch.md`](../runbooks/overview-review-queue-mismatch.md) で切り分ける。
