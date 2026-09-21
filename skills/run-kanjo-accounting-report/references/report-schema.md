# 送信JSONの形(POST 結果送信URL)— 第4版

すべての文字列はプレーンテキスト。HTMLタグは保存時に取り除かれる。正本は `packages/api/src/ai/contract.ts` の `reportInputSchema` と `normalizeReport`(保存時検査)。手元の検査は `scripts/validate-report.py`(同じ規則の写し)。

第4版は第3版の5節・要点・図に `contextAnalysis` を追加した。会計金額の事実と外部背景を分離し、因果は断定せず反証可能な仮説として送る。

```json
{
  "generatedBy": "claude-code",
  "model": "claude-fable-5",
  "analysisDepth": "standard",
  "title": "2025年8月〜2026年8月(13ヶ月・年次)の会計分析",
  "summary": "対象期間の事業経費は 4,980,000円(月平均 383,000円)で、前年同期比 +8.1% でした。増加分の大半は外注費で説明できます。\n- 図2のとおり外注費が 2,040,000円(41.0%)で最大、家賃と合わせて7割です\n- 図3のとおり前期比 +372,000円 のうち外注費が +630,000円 を占めます\n- 図8のサブスクは月 38,000円 前後で横ばいです",
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
    "body": "前回(第1版)の指摘2件はいずれも未解消です。\n- Adobe の重複契約は7月も2件のままです\n- 外注費の月次上限の設定は未実施です",
    "items": [{ "label": "Adobe 重複の解消", "amount": 77760, "note": "未実施", "priority": "high" }]
  },
  "sections": [
    { "id": "spend", "body": "リード1〜2文。\\n- 箇条書き2行以上(80字以上・下の「本文の書き方」)", "items": [{ "label": "外注費", "amount": 2040000, "note": "事業経費の 41.0%", "priority": null }, { "label": "地代家賃", "amount": 1440000, "note": "28.9%" }, { "label": "通信費", "amount": 312000, "note": "6.3%" }], "gap": null },
    { "id": "change", "body": "…", "items": [{ "label": "外注費 +630,000円", "amount": 630000 }], "gap": null },
    { "id": "reduction", "body": "…", "items": [{ "label": "Adobe(重複)", "amount": 77760, "priority": "high" }, { "label": "外注費の上限設定", "amount": 480000, "priority": "high" }], "gap": null },
    { "id": "split", "body": "…", "items": [], "gap": "個人支出の取込が無いため事業/個人・名義別の内訳は出せない(取込画面で MF 明細を追加すると出せる)" },
    { "id": "subscriptions", "body": "…", "items": [{ "label": "Adobe", "amount": 12960, "note": "月額。重複疑い" }], "gap": null }
  ],
  "needs": [
    { "gap": "個人の家賃が公私仕分けで未分類", "action": "公私仕分け画面で家賃の行を「個人」にする", "screen": "classify" }
  ],
  "dataGaps": ["前年同期(2024-08〜2025-07)の取込が無く、図5(前年同月比)は出せない(あと12ヶ月分)"],
  "contextAnalysis": {
    "externalResearch": "off",
    "questionType": "trend",
    "question": {
      "decision": "外注費の上限を見直すか決める",
      "metric": "外注費の月次推移",
      "comparison": "直近3ヶ月とその前3ヶ月",
      "range": "2025-09〜2026-08"
    },
    "interviewFacts": [{ "id": "interview-change", "source": "user_reported", "question": "対象期間の変化", "answer": "6月に新規案件が始まった" }],
    "statisticalFacts": [{ "id": "fact-outsourcing-trend", "statement": "外注費は直近3ヶ月連続で増加した", "basis": "monthlyCategories.businessExpense の外注費", "evidenceRefs": ["monthlyCategories.businessExpense"] }],
    "interpretations": [{ "statement": "外注依存が高まった可能性がある", "factRefs": ["fact-outsourcing-trend"], "limitation": "案件別の発注量は取込データにない" }],
    "externalEvidence": [],
    "causalHypotheses": [{
      "role": "primary",
      "hypothesis": "新規案件と外注費の増加が関連した可能性がある",
      "cause": "新規案件の開始",
      "mechanism": "内部工数の不足を外注で補った",
      "outcome": "外注費の月次額が増えた",
      "evidenceFor": ["案件開始後の3ヶ月で外注費が増えた"],
      "evidenceAgainst": ["案件別の外注費は取込データにない"],
      "confounders": ["契約単価の改定でも説明できる"],
      "falsificationCondition": "案件別に見て新規案件の外注費が増えていない",
      "evidenceLevel": "data_confirmed",
      "evidenceRefs": ["monthlyCategories.businessExpense"],
      "confidence": "low",
      "validationAction": "案件別の発注記録と突合する"
    }, {
      "role": "alternative",
      "hypothesis": "契約単価の改定と外注費の増加が関連した可能性がある",
      "cause": "外注先の契約単価改定",
      "mechanism": "同じ発注量でも支払額が増えた",
      "outcome": "外注費の月次額が増えた",
      "evidenceFor": ["外注費は増えている"],
      "evidenceAgainst": ["単価の内訳は取込データにない"],
      "confounders": ["新規案件の開始でも説明できる"],
      "falsificationCondition": "契約書の単価に変更がない",
      "evidenceLevel": "data_confirmed",
      "evidenceRefs": ["monthlyCategories.businessExpense"],
      "confidence": "low",
      "validationAction": "契約書と請求書を突合する"
    }]
  }
}
```

## 本文の書き方(`summary` / `sections[].body` / `followUp.body`)

この3つの本文だけが自由記述で、画面(`ReportText`)は **行頭が `- ` の行を箇条書き**、それ以外を段落として描く。**同じ指示から毎回同じ見た目を再現する**ため、書き方を次に固定する。`scripts/validate-report.py` が機械的に落とすので、守れているかを目視で確かめる必要はない。

| 規則 | 内容 | 違反時 |
|---|---|---|
| 記法 | 箇条書きは**行頭 `- ` だけ**。`・` `*` `•` `1.` `(1)` は使わない | NG(画面が箇条書きとして描かないため) |
| 最低行数 | `summary` **3行以上** / `sections[].body` **2行以上** / `followUp.body` **2行以上** | NG |
| リード文 | 箇条書きの**前に結論を述べる地の文1〜2文**を置く。箇条書きだけの本文は不可 | NG |
| 1行の長さ | 箇条書き1行は **120字以内**。超えるなら段落へ移すか2行に割る | NG |
| 入れ子 | しない(画面は1階層しか描かない)。深い話は次の行か段落へ | — |

書き方の型:

```
<結論を述べるリード文。数字を1つ入れる。>
- <事実(金額・比率・増減)。1行1論点>
- <事実>
- <事実>
```

- 1行1論点にする。「かつ」「また」でつないだ行は2行に割る。
- 各行に金額(`123,456円`)か比率(`12.3%`)か増減(`+12,000円(+8.1%)`)のどれかを入れる。数字の無い行は感想になりやすい。
- 「図N」の参照は箇条書き行の中に置いてよい(画面がリンクにする)。
- Markdown の見出し・表・コードフェンス・HTML は本文全体で使えない(検査で落ちる)。

`keyFindings` の `fact` / `basis` / `interpretation` / `action` は**1つずつが1論点**なので箇条書きにしない(画面がカードの各行として描く)。`items[].note` と `dataGaps[]` も1件1行なので同じ。

## 項目と上限・下限

| 項目 | 必須 | 内容 / 制限 |
|---|---|---|
| `generatedBy` | 必須 | `claude-code` / `codex` など実行環境の名前(60字) |
| `analysisDepth` | 必須 | `concise` / `standard` / `detailed`。画面の既定は `standard` |
| `model` | 任意 | 使用モデル名(120字) |
| `title` | 任意 | 省略時は「<期間ラベル>の会計分析」(120字) |
| `summary` | 必須 | 総評 **60〜1,200字**。出せた図を「図N」で1つ以上参照する。書き方は上の「本文の書き方」 |
| `keyFindings` | **必須** | `improvements`(改善すべき点)/ `wasted`(無駄なコスト)/ `quickWins`(すぐ効く対策)の3配列(各10件まで)+ `notes`。**0件の区分は `notes.<区分>` に理由を10字以上**(「該当なし」だけは不可) |
| `keyFindings.*[]`(要点1件) | — | `label`(200字)/ **`fact`(事実: 数値つき、10〜600字)**/ **`basis`(計算根拠: どのキーからどう出したか、5〜400字)**/ **`interpretation`(解釈、10〜800字)**/ **`action`(次のアクション、5〜600字)**/ `expectedEffect`(期待効果・円・整数・年換算・`null` 可)/ `amount`(影響額・円・整数・`null` 可)/ `priority`(`high` `mid` `low` `null`)/ `chart`(根拠となる図の `catalogId`・`null` 可) |
| `charts[]` | 任意(出せる図がある限り実質必須) | **10件まで(カタログ数)**。`catalogId` / `caption`(15〜400字)。図の数値は送らない。`available=true` の図は `caption` と本文の「図N」参照が必須 |
| `contextAnalysis` | 第4版で必須 | 問い / 利用者回答 / `statisticalFacts` / `interpretations` / 外部出典 / 主・対立仮説。`statisticalFacts` と `interpretations` は0件でも配列自体は必須。出せない理由は `dataGaps` / `needs` に書く |
| `causalHypotheses[]` | 任意 | 仮説を出す場合は `primary` と `alternative` を各1件以上。`cause` / `mechanism` / `outcome` / 支持 / 反証 / 交絡 / 反証条件 / 根拠水準 / 根拠参照 / 確度 / 次の確認を持つ |
| `followUp` | 任意 | 前回レポートがあるときだけ。`body`(6,000字・上の「本文の書き方」)+ `items`(30件まで)。前回の指摘ごとに「解消 / 未実施 / 悪化」 |
| `sections[]` | 必須 | 5節すべて(`spend` `change` `reduction` `split` `subscriptions`)。`title` 任意(120字)/ `body` **80〜6,000字**(上の「本文の書き方」)/ `items` 60件まで / `gap`(10〜400字・`null` 可) |
| `sections[].items` の最低行数 | — | `spend` **3** / `change` **1** / `reduction` **2** / `split` **2** / `subscriptions` **1**。満たせないときは `gap` にデータ不足の理由(何があれば出せるか)を書く。理由なしは拒否 |
| `sections[].items[]` / 各 item | — | `label`(必須・200字)/ `amount`(円・整数・`null` 可)/ `note`(1,000字)/ `priority` |
| `needs[]` | 任意(推奨) | 30件まで。`gap`(300字)/ `action`(500字)/ `screen`(下表の id か `null`。それ以外は手元の検査で NG、アプリでは `null` 扱い) |
| `dataGaps[]` | 任意 | 40件・各500字。出せなかった図は「図N はあと◯ヶ月分で出せる」と1行 |

### `needs[].screen` に使える画面 id

| id | 画面 | 解消できること |
|---|---|---|
| `import` | データ取込 | 未取込の月・ファイル種別(freee 取引 / MF 明細)を足す |
| `classify` | 公私仕分け | MF 明細の 事業/個人・事業/妻/家族 の仕分け、未分類の解消 |
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
