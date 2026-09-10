---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G4, G5]
---

# 保守運用管理

MF 事業判定の規範は `specs/spec-mf-business-classification.md`。

- 運用手順: `docs/mf-business-classification/runbook.md`
- 検証記録: `docs/mf-business-classification/test-run.md`
- リリース判断: `docs/mf-business-classification/close-out.md`
- 状態: `features/feat-mf-business-classification.md` の frontmatter

判定の切り分けには `/api/transactions` の `src` を使う。具体的な取込値や中項目名を運用文書へ複製しない。規則変更時は canonical contract と契約テストを更新し、architecture 文書へ規則本文をコピーしない。
