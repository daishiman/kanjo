# 送信JSONの形(POST 結果送信URL)— 第2版

すべての文字列はプレーンテキスト。HTMLタグは保存時に取り除かれる。正本は `packages/api/src/ai/contract.ts` の `reportInputSchema`。

```json
{
  "generatedBy": "claude-code",
  "model": "claude-fable-5",
  "title": "2025年8月〜2026年8月(13ヶ月・年次)の会計分析",
  "summary": "総評(3〜5行)。",
  "keyFindings": {
    "improvements": [
      { "label": "外注費が3ヶ月連続で増加", "amount": 120000, "note": "期間合計の +18%。単価改定か件数増かを確認", "priority": "high" }
    ],
    "wasted": [
      { "label": "Adobe の重複契約の疑い", "amount": 77760, "note": "年換算。同月に2件の請求", "priority": "high" }
    ],
    "quickWins": [
      { "label": "Adobe を1契約にまとめる", "amount": 38880, "note": "年換算の削減見込み。今月中に解約で反映", "priority": "high" }
    ]
  },
  "charts": [
    {
      "id": "expense-by-month",
      "kind": "bar",
      "title": "月別の事業経費",
      "unit": "yen",
      "labels": ["2025-08", "2025-09"],
      "series": [{ "label": "事業経費", "data": [412000, 398000] }]
    }
  ],
  "followUp": {
    "body": "前回(第1版)で指摘した Adobe の重複は 2026年7月に解消(請求が1件になった)。外注費の確認は未実施。",
    "items": [{ "label": "Adobe 重複の解消", "amount": 38880, "note": "実行済み", "priority": null }]
  },
  "sections": [
    { "id": "spend", "body": "…", "items": [{ "label": "外注費", "amount": 320000, "note": "事業経費の 41.2%", "priority": null }] },
    { "id": "change", "body": "…" },
    { "id": "reduction", "body": "…", "items": [{ "label": "Adobe(重複契約の疑い)", "amount": 77760, "note": "年換算", "priority": "high" }] },
    { "id": "split", "body": "…" },
    { "id": "subscriptions", "body": "…" }
  ],
  "needs": [
    { "gap": "個人の家賃が公私仕分けで未分類", "action": "公私仕分け画面で家賃の行を「個人」にする", "screen": "classify" }
  ],
  "dataGaps": ["前年同期(2024-08〜2025-07)の取込が無く、前年同月比は出せない"]
}
```

## 項目と上限

| 項目 | 必須 | 内容 / 上限 |
|---|---|---|
| `generatedBy` | 必須 | `claude-code` / `codex` など実行環境の名前(60字) |
| `model` | 任意 | 使用モデル名(120字) |
| `title` | 任意 | 省略時は「<期間ラベル>の会計分析」(120字) |
| `summary` | 必須 | 総評(3,000字) |
| `keyFindings` | 任意(推奨) | `improvements`(改善すべき点)/ `wasted`(無駄なコスト)/ `quickWins`(すぐ効く対策)。各 item 配列・各10件まで。`amount` は年換算などの金額インパクト、`priority` で優先順位 |
| `charts[]` | 任意(推奨) | 6件まで。`id`(40字・一意)/ `kind`(`bar` `line` `stackedBar`)/ `title`(120字)/ `unit`(`yen` 円 / `pct` パーセント値そのもの(12.3 = 12.3%)/ `count` 件数。省略時 `yen`)/ `labels`(1〜72件・各40字)/ `series`(1〜8本。`label` 60字、`data` は `labels` と同じ長さの数値配列。無い点は `null`) |
| `followUp` | 任意 | 再分析・同型の前回レポートがあるときだけ。`body`(6,000字)+ `items`(30件まで)。前回の指摘ごとに「解消 / 未実施 / 悪化」を書く。前回が無ければ省略か `null` |
| `sections[]` | 必須 | 5節すべて(`id`: `spend`, `change`, `reduction`, `split`, `subscriptions`)。順序は問わない(保存時に固定順)。`title` 任意(120字)/ `body` 必須(12,000字)/ `items` 60件まで |
| `sections[].items[]` / 各 item | — | `label`(必須・200字)/ `amount`(円・整数・`null` 可)/ `note`(1,000字)/ `priority`(`high` `mid` `low` `null`) |
| `needs[]` | 任意(推奨) | 30件まで。`gap`(足りない情報・300字)/ `action`(利用者がアプリで行う操作・500字)/ `screen`(操作する画面の id。下表以外は `null` 扱い) |
| `dataGaps[]` | 任意 | 判断に使えなかったデータ。40件・各500字 |

### `needs[].screen` に使える画面 id

| id | 画面 | 解消できること |
|---|---|---|
| `import` | データ取込 | 未取込の月・ファイル種別(freee 取引 / MF 明細)を足す |
| `classify` | 公私仕分け | MF 明細の 事業/個人・本人/妻 の仕分け、未分類の解消 |
| `settings` | 設定 | 金融機関の名義、家計の見込み収支、防衛線 |
| `budget` | 予算管理 | 科目別の予算 |
| `subscriptions` | サブスク分析 | サブスク一覧・ベンダー登録(別名の追加)・候補から「これはサブスク」 |
| `household` | 家計 | 生活費の内訳確認 |
| `overview` | 概況 | 全体の確認 |

## 応答

- `201 {"ok":true,"reportId":"…"}` — 受理。トークンはこの時点で使用済みになる。
- `400 {"error":{"code":"missing_sections","missing":[…]}}` — 節不足。同じトークンで再送できる。
- `400`(その他) — 形式エラー。`error.message` に従って直す(chart の `data` 長さ不一致・未定義の `kind` など)。
- `401` — トークンが無効・期限切れ・使用済み。利用者に指示文の再発行を依頼する。
