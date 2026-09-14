---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G2]
---

# 認証(ログイン)

MF 事業判定の規範は `specs/spec-mf-business-classification.md`。本章は認証差分だけを記録する。

- 新規 endpoint、主体、権限区分は追加しない。
- `GET /api/transactions` と `GET /api/total-cashflow` は既存の `/api/*` 認証ガード内に留める。
- `src` は利用者自身の分類理由であり、認証情報や他利用者データを含めない。
- 認証方式・session・rate limit は変更しない。

確認は route mount と middleware 順序の既存契約テストで行う。認証の一般仕様を本 feature 文書へ複製しない。
