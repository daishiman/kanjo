# サブスク最終デザイン監査

`design/FINAL-UI/images/09-subscriptions.png` を正本とし、匿名fixtureのlocal previewを1024 × 1536pxで撮影して同一入力へ連結した。

## 結果（密度再調整）

- comparison: `final-comparison-1024x1536.png`
- responsive: `final-375x1000.png`
- selected detail state: `final-1024x1536.png`
- machine audit: `final-audit.json`
- P0 / P1 / P2: 0 / 0 / 0
- document-level horizontal overflow: 1024px / 375pxとも0
- console error / runtime exception / failed resource: 0 / 0 / 0

coverage/updateは同じ71px高の横行、一覧は440px内部スクロールで約8行、見出しと合計はsticky、理由は代表1件だけを表示する。残り4件は既存の「見直し候補」filterへ移動し、実ブラウザで5行へ絞られselectへfocusすることを確認した。KPI iconは5件、1024pxでは一覧8列、trend、comparison、詳細、代表理由まで同一document内に収めた。

参照との差は匿名fixture由来の名称・金額・登録済み比較の空状態である。架空データは追加せず、subscriptions routeだけsidebar/gutterをcompact化して他routeへ波及させていない。
