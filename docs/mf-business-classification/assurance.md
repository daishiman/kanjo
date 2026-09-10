# 認証境界と運用保証

規範は `specs/spec-mf-business-classification.md`。本書は保証対象と確認方法だけを記録する。

## 境界

- 新規 endpoint、認証方式、ロール、secret、binding、DB migration は追加しない。
- `GET /api/transactions` と `GET /api/total-cashflow` は既存の `/api/*` 認証ガード内に置く。
- `src` は閉じた分類根拠であり、取込原文・資格情報・他利用者データを含めない。
- raw production data をテストログや公開文書へ出さない。

## 確認方法

- route mount と auth middleware の順序を API の契約テストで守る。
- `src` / `bySource` の値集合を core、API、web の型検査で守る。
- 匿名化 fixture だけで比較、優先順位、集計を検証する。

一般の認証仕様は `system-spec/auth.md`、入力・ログ方針は `system-spec/security.md` を参照し、本書へ複製しない。

