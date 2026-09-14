---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G1, G4]
---

# セキュリティ

MF 事業判定の規範は `specs/spec-mf-business-classification.md`。本章は追加の安全境界だけを記録する。

- 取込境界の既存検証を維持する。
- trim は比較時の一時値だけに適用し、保存原本を変更しない。
- `src` は閉じた enum とし、任意の入力文字列を根拠欄へ反射しない。
- raw production data、行レベル値、秘密情報をログ・テスト記録・公開文書へ載せない。
- 手動編集を最優先にし、誤分類から回復可能にする。

新しい機微データ、公開面、権限は追加しない。
