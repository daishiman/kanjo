---
kind: index
---

# システム構築仕様書 index

現行サイクルの system-spec は決定来歴と領域差分を保持する。状態は各章の frontmatter だけで管理する。

## 規範

- MF 事業判定: `specs/spec-mf-business-classification.md`
- トータル収支全般: `specs/spec-total-cashflow-system.md`
- 上位目的と決定来歴: `system-spec/00-requirements-definition.md`

## 技術章

| 領域 | 文書 | 本サイクルの差分 |
|---|---|---|
| backend | `backend.md` | 単一 resolver と間接依存 |
| database | `database.md` | schema 変更なし、要求時導出 |
| frontend | `frontend.md` | `src` / `bySource` の wire 写像 |
| ui-ux | `ui-ux.md` | 根拠と要確認の表示 |
| auth | `auth.md` | 既存境界内、新規入口なし |
| security | `security.md` | 比較時正規化と公開データ制約 |
| infrastructure | `infrastructure.md` | 配信設定・binding 変更なし |
| maintenance-ops | `maintenance-ops.md` | 正本、検証、復旧の責務分離 |

評価の詳細は `completeness-findings.json`、質疑の来歴は `spec-state.json` を参照する。
