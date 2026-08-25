# 送信JSONの形(POST 結果送信URL)— 第3版

すべての文字列はプレーンテキスト。HTMLタグは保存時に取り除かれる。正本は `packages/api/src/ai/contract.ts` の `reportInputSchema` と `normalizeReport`(保存時検査)。手元の検査は `scripts/validate-report.py`(同じ規則の写し)。

第3版で変わったこと: **図の数値を送らない**(`charts` はカタログ id と読み解きだけ)/ **要点は3段(事実→解釈→次の一手)を必須**/ **5節に最低行数**(足りなければ `gap` に理由)/ **文字数に下限**(短すぎる分析を拒否)。

```json
{
  "generatedBy": "claude-code",
  "model": "claude-fable-5",
  "title": "2025年8月〜2026年8月(13ヶ月・年次)の会計分析",
  "summary": "対象期間の事業経費は 4,980,000円(月平均 383,000円)で前年同期比 +8.1%。図2が示すとおり外注費が41%を占め、図3のとおり増加分の大半は外注費。図8のサブスクは横ばい。",
  "keyFindings": {
    "improvements": [
      {
        "label": "外注費が3ヶ月連続で増加",
        "fact": "外注費は 2026-06 180,000円 → 07 210,000円 → 08 240,000円",
        "basis": "biz.expenseByAccount.外注費 の直近3ヶ月",
        "interpretation": "件数増ではなく単価改定の可能性(支払先が同じ)。固定費化しつつある",
        "action": "外注先ごとの単価と件数を確認し、上限を月200,000円に設定する",
        "expectedEffect": 480000,
        "amount": 630000,
        "priority": "high",
        "chart": "contribution"
      }
    ],
    "wasted": [
      {
        "label": "Adobe の重複契約の疑い",
        "fact": "2026-07 に Adobe への支払いが 2件(6,480円 と 6,480円)",
        "basis": "subscriptions.alerts の重複疑い(中央値の1.8倍超)",
        "interpretation": "同一プランを2アカウントで契約している可能性",
        "action": "サブスク分析画面で Adobe の2件を確認し、片方を解約する",
        "expectedEffect": 77760,
        "amount": 77760,
        "priority": "high",
        "chart": "subs_vendor"
      }
    ],
    "quickWins": [],
    "notes": { "improvements": "", "wasted": "", "quickWins": "今月中に金額が確定する対策は上記 Adobe の解約に含めた" }
  },
  "charts": [
    { "catalogId": "composition", "caption": "外注費が全体の41%を占め、家賃と合わせて7割に達している" },
    { "catalogId": "contribution", "caption": "前期比 +372,000円 のうち外注費が +630,000円 で、他科目の減少を打ち消している" },
    { "catalogId": "subs_vendor", "caption": "サブスク合計は月 38,000円 前後で横ばい。Adobe の帯だけ 7月に厚い" }
  ],
  "followUp": {
    "body": "前回(第1版)で指摘した Adobe の重複は未解消(7月も2件)。外注費の上限設定は未実施。",
    "items": [{ "label": "Adobe 重複の解消", "amount": 77760, "note": "未実施", "priority": "high" }]
  },
  "sections": [
    { "id": "spend", "body": "…(80字以上)", "items": [{ "label": "外注費", "amount": 2040000, "note": "事業経費の 41.0%", "priority": null }, { "label": "地代家賃", "amount": 1440000, "note": "28.9%" }, { "label": "通信費", "amount": 312000, "note": "6.3%" }], "gap": null },
    { "id": "change", "body": "…", "items": [{ "label": "外注費 +630,000円", "amount": 630000 }], "gap": null },
    { "id": "reduction", "body": "…", "items": [{ "label": "Adobe(重複)", "amount": 77760, "priority": "high" }, { "label": "外注費の上限設定", "amount": 480000, "priority": "high" }], "gap": null },
    { "id": "split", "body": "…", "items": [], "gap": "個人支出の取込が無いため事業/個人・名義別の内訳は出せない(取込画面で MF 明細を追加すると出せる)" },
    { "id": "subscriptions", "body": "…", "items": [{ "label": "Adobe", "amount": 12960, "note": "月額。重複疑い" }], "gap": null }
  ],
  "needs": [
    { "gap": "個人の家賃が公私仕分けで未分類", "action": "公私仕分け画面で家賃の行を「個人」にする", "screen": "classify" }
  ],
  "dataGaps": ["前年同期(2024-08〜2025-07)の取込が無く、図5(前年同月比)は出せない(あと12ヶ月分)"]
}
```

## 項目と上限・下限

| 項目 | 必須 | 内容 / 制限 |
|---|---|---|
| `generatedBy` | 必須 | `claude-code` / `codex` など実行環境の名前(60字) |
| `model` | 任意 | 使用モデル名(120字) |
| `title` | 任意 | 省略時は「<期間ラベル>の会計分析」(120字) |
| `summary` | 必須 | 総評 **60〜1,200字**。出せた図を「図N」で1つ以上参照する |
| `keyFindings` | **必須** | `improvements`(改善すべき点)/ `wasted`(無駄なコスト)/ `quickWins`(すぐ効く対策)の3配列(各10件まで)+ `notes`。**0件の区分は `notes.<区分>` に理由を10字以上**(「該当なし」だけは不可) |
| `keyFindings.*[]`(要点1件) | — | `label`(200字)/ **`fact`(事実: 数値つき、10〜600字)**/ **`basis`(計算根拠: どのキーからどう出したか、5〜400字)**/ **`interpretation`(解釈、10〜800字)**/ **`action`(次のアクション、5〜600字)**/ `expectedEffect`(期待効果・円・整数・年換算・`null` 可)/ `amount`(影響額・円・整数・`null` 可)/ `priority`(`high` `mid` `low` `null`)/ `chart`(根拠となる図の `catalogId`・`null` 可) |
| `charts[]` | 任意(出せる図がある限り実質必須) | **8件まで**。`catalogId`(`references/chart-catalog.md` の id)/ `caption`(この図から言えること **15〜400字**)。数値・`labels`・`series`・`kind` は送らない(手元の検査で拒否。アプリ側は無視して保存しない)。`available=true` の図は `caption` と本文の「図N」参照が必須 |
| `followUp` | 任意 | 前回レポートがあるときだけ。`body`(6,000字)+ `items`(30件まで)。前回の指摘ごとに「解消 / 未実施 / 悪化」 |
| `sections[]` | 必須 | 5節すべて(`spend` `change` `reduction` `split` `subscriptions`)。`title` 任意(120字)/ `body` **80〜6,000字** / `items` 60件まで / `gap`(10〜400字・`null` 可) |
| `sections[].items` の最低行数 | — | `spend` **3** / `change` **1** / `reduction` **2** / `split` **2** / `subscriptions` **1**。満たせないときは `gap` にデータ不足の理由(何があれば出せるか)を書く。理由なしは拒否 |
| `sections[].items[]` / 各 item | — | `label`(必須・200字)/ `amount`(円・整数・`null` 可)/ `note`(1,000字)/ `priority` |
| `needs[]` | 任意(推奨) | 30件まで。`gap`(300字)/ `action`(500字)/ `screen`(下表の id。以外は `null` 扱い) |
| `dataGaps[]` | 任意 | 40件・各500字。出せなかった図は「図N はあと◯ヶ月分で出せる」と1行 |

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
- `400`(その他) — 形式エラー。`error.message` に従って直す(要点の4欄不足・最低行数未満・図の参照漏れ・未定義の `catalogId` など)。
- `401` — トークンが無効・期限切れ・使用済み。利用者に指示文の再発行を依頼する。
