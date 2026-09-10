---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G3]
---

# インフラ

MF 事業判定の規範は `specs/spec-mf-business-classification.md`。本 feature による Worker、binding、secret、migration、配信経路の変更はない。

- 通常の test、preview、CI/CD 経路を使う。
- **版の巻き戻し**は対象コミットを `git revert` して通常経路で再公開する。
- **MF 中項目判定の部分無効化**は別変更であり、rollback とは呼ばない。
- 実行時 feature flag は設けない。
