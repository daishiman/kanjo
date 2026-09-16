# 照合の件数ずれの切り分け

この手順は、次のような症状が出たときに原因を切り分けるためのものです。

- 照合画面・支出分析ハブ・概況 (サイドバーのバッジと月次クローズ) で、対応必要件数が合わない。
- 照合・除外・元に戻す操作をしても、件数が期待どおりに変わらない。

機能の見取り図は [`照合画面`](../reconciliation.md)、状態・件数・期間投影は [`specs/spec-reconciliation.md` の正本節](../../specs/spec-reconciliation.md#状態件数投影の正本)、計算詳細は [`data-schema.md`](../data-schema.md#照合の規則) を参照してください。この runbook は切り分け手順だけを持ち、規則を再定義しません。

## 前提となる仕組み

- 比較対象は全経路の `actionRequiredCount` です。`reviewCount` や `mfOnlyCount` を混ぜて比較しません。
- すべての経路が同じ判断・除外 bind と core の照合レポートを使うことを確認します。
- 期間付きの照合画面は期間投影、サイドバーと月次クローズは全期間投影です。投影範囲が違う値を直接比較しません。

## 1. まず症状を分類する

| 症状 | 最初に見る節 |
|---|---|
| 照合・ハブ・概況のうち 1 経路だけ数字が違う | §2 (API の 3 経路を並べる) |
| 月次クローズの件数が照合画面より多い | 画面は選択期間、月次クローズは全期間の `actionRequiredCount` か確認する |
| 操作したのに画面が変わらない | §3 (操作の応答) |
| 「元に戻す」が押せない、または 409 になる | §3 の取り消し |
| 再取込したら判断が外れた | §4 (結び直し) |
| 期待より多い・少ない (3 経路は同じ) | §5 (core) |
| 期間を変えると照合画面の件数は変わるが、月次クローズの件数は変わらない | 意図どおり。月次クローズは全期間で数える (`architecture-decision.md` §7 #5) |
| 総収支で判断した後、照合画面の件数が古い | §2 のキャッシュ。総収支の 4 つの操作は `refreshVerdictReaders` で照合とキューも無効化する |

## 2. API の 3 経路を並べる

ログインしたブラウザで次の経路を全期間指定で開き、`actionRequiredCount` を比べます。選択期間を比較する場合は、照合とハブに同じ期間クエリを指定し、概況の全期間ゲートとは直接比較しません。

| 経路 | URL | 見るフィールド |
|---|---|---|
| 照合 | `/api/reconciliation` | `kpi.actionRequiredCount`。診断時だけ `statusCounts.review` と `statusCounts.unprocessed` の和も照合する |
| 支出分析ハブ | `/api/analysis/hub` | `views.reconciliation.actionRequiredCount` (互換 alias がある間は値の一致も確認) |
| 概況 | `/api/review-queue` | `counts.reconciliation`、`closeStatus.steps.reconciliation.count`。どちらも全期間の同値 |

- 3 経路の件数が同じなのに画面の表示が違う場合は、web のキャッシュが原因です。判断した後に照合と分析系クエリが一緒に無効化されているか確認します。
- 3 経路の件数が違う場合は、どれかが core の `actionRequiredCount` を使わず再計算しています。次のテストで再現させます。

```bash
pnpm --filter @kanjo/api exec vitest run test/reconciliation.integration.test.ts
```

このテストは「`actionRequiredCount` は照合・ハブ・サイドバー・月次クローズで一致する」ことを、除外と取り消しの前後で検査します。

## 3. 操作の応答

開発者ツールの Network で、`POST /api/reconciliation/actions` の応答を見ます。

| 応答 | 意味 | 対処 |
|---|---|---|
| 200 で `saved: 0` | 対象がすべて件ごとに失敗した | `results[].reason` を見る |
| `reason: not_found` | 明細が存在しない (削除・再取込で消えた) | 画面を再読み込みする |
| `reason: tx_id_required` | その操作には MF の明細 id が必要 | freee だけの行には `exclude-freee` を使う |
| `reason: unstable_identity` | 同じ鍵に複数の明細が当たり、どれか決められない | 明細仕分けで明細を確かめてから、1 件ずつ操作する |
| `reason: freee_not_found` | freee の取引が見つからない (他人の取引の鍵を含む) | 画面を再読み込みする |
| `reason: no_candidate` | 「同じ」を送ったが freee の候補を指定していない | 詳細パネルで候補を確かめてから照合する。候補が無い明細は「別の取引」か除外にする |
| `reason: freee_not_pairable` | 指定した freee が向き違い、または日付が ±3 日の外 | 別の取引として処理する。金額違いは、向きと日付が合えば照合できる |
| `reason: duplicate_target` | 1 回の操作で同じ明細を二度指定した | 先の 1 件は保存済み。そのままでよい |
| `reason: freee_excluded` | 名指しの freee が照合から除外されている | freee 側の除外を戻してから照合するか、別の取引として処理する |
| `reason: freee_already_matched` | 名指しの freee が別の明細と照合済み、または同じ回の別の選択に先に取られた | 残った明細は freee に相手が無い。別の取引として処理するか、MFのみのまま置く |
| `reason: not_matchable` | 判定器が名指しの組を照合済みにしない (事業の明細でない等) | 別の取引として処理する。区分の誤りなら明細仕分けで直す |
| `reason: target_not_actionable` | 対応不要または処理済みの状態へ、照合・別取引を送った | 再読込し、要確認か未処理の行だけを選び直す |
| 400 | 件数が 0 件か 201 件以上、または形式違反 | 一括は 200 件までにする |
| 409 `canonical_write_busy` | 取込・復元の実行中 | 終わってから操作し直す |

取り消し (`POST /api/reconciliation/actions/:id/undo`) の応答は次のとおりです。

| 応答 | 意味 |
|---|---|
| 409 `action_not_latest` | その後に別の操作がある。取り消せるのは直前の 1 回だけ |
| 409 `action_already_undone` | すでに取り消した。取り消しは 1 段だけ |
| 409 `action_snapshot_invalid` | 操作の記録が読めない。手で行を直さず、画面から判断し直す |
| 409 `action_stale` | 操作の後に、総収支の画面・復元・別の操作で同じ明細の判断が変わった。後の判断を消さないため戻さない。明細ごとに判断し直す |
| 400 `invalid_action_id` | id が UUID の形でない (URL の手入力など) |
| 404 `action_not_found` | 90 日を過ぎて記録が消えたか、存在しない id |

## 4. 再取込で判断が外れたとき

- 判断は tx_id を優先し、tx_id が変わったときは現行版の stable_key で結び直します。
- 同じ stable_key に複数の明細が当たるときは、誤った明細に付けないように結び付けません。この場合、その明細は要確認・未処理・MFのみのいずれかに戻ります。これは安全側に倒した動作で、不具合ではありません。利用者にもう一度判断してもらいます。
- 結び直しの規則は `packages/api/src/routes/duplicate-verdict-bindings.ts` にあります。

## 5. core 系統

規則そのもの (一致度・日付の幅・類似度・キュー) を確かめるときは、core のテストを実行します。

```bash
pnpm --filter @kanjo/core exec vitest run test/reconciliation.test.ts
```

境界値と期待状態は仕様正本および core テストを参照します。runbook では失敗したテスト名と入力 fixture を記録し、規則の写しを追加しません。

## 6. 本番で起きたとき

- 本番 D1 を直接書き換えて件数を合わせないでください。判断と除外の 3 表は、利用者の判断の記録です。
- 利用者には、照合画面の「元に戻す」、または行ごとの判断のやり直しを案内します。
- 表示の不具合で Worker を戻す手順は [`close-out.md`](../reconciliation/close-out.md) にあります。migration 0041 の 2 表は残したまま戻せます。
