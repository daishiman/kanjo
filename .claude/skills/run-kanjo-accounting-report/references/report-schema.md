# 送信JSONの形(POST 結果送信URL)

すべての文字列はプレーンテキスト。HTMLタグは保存時に取り除かれる。上限: `summary` 3,000字 / 各 `body` 12,000字 / `items` 各節60件 / `dataGaps` 40件。

```json
{
  "generatedBy": "claude-code",
  "model": "claude-fable-5",
  "title": "2026年8月(月次)の会計分析",
  "summary": "総評(3〜5行)。",
  "sections": [
    {
      "id": "spend",
      "body": "事業経費 合計 …円、個人支出 合計 …円。\n上位科目: …",
      "items": [
        { "label": "外注費", "amount": 320000, "note": "事業経費の 41.2%", "priority": null }
      ]
    },
    { "id": "change", "body": "前月比 …。前年同月比 …。要因: …" },
    {
      "id": "reduction",
      "body": "優先順位の考え方: …",
      "items": [
        { "label": "Adobe(重複契約の疑い)", "amount": 77760, "note": "年換算。月額が中央値の2.1倍", "priority": "high" }
      ]
    },
    { "id": "split", "body": "事業: 収入 … / 支出 …。個人: 収入 … / 支出 …。本人: …、妻: …。" },
    { "id": "subscriptions", "body": "直近月のサブスク合計 …円(年換算 …円)。整理候補: …" }
  ],
  "dataGaps": ["前年同月(2025-08)の個人支出が未取込"]
}
```

## 項目

| 項目 | 必須 | 内容 |
|---|---|---|
| `generatedBy` | 必須 | `claude-code` / `codex` など実行環境の名前 |
| `model` | 任意 | 使用モデル名 |
| `title` | 任意 | 省略時は「<期間>の会計分析」 |
| `summary` | 必須 | 総評 |
| `sections[]` | 必須 | 5節すべて(`id`: `spend`, `change`, `reduction`, `split`, `subscriptions`)。順序は問わない(保存時に固定順へ並ぶ) |
| `sections[].title` | 任意 | 省略時は既定の節名 |
| `sections[].body` | 必須 | 本文(改行・「- 」箇条書き可) |
| `sections[].items[]` | 任意 | `label`(必須) / `amount`(円・整数・null可) / `note` / `priority`(`high`,`mid`,`low`,null) |
| `dataGaps[]` | 任意 | 判断に使えなかったデータ |

## 応答

- `201 {"ok":true,"reportId":"…"}` — 受理。トークンはこの時点で使用済みになる。
- `400 {"error":{"code":"missing_sections","missing":[…]}}` — 節不足。同じトークンで再送できる。
- `400`(その他) — 形式エラー。`error.message` に従って直す。
- `401` — トークンが無効・期限切れ・使用済み。利用者に指示文の再発行を依頼する。
