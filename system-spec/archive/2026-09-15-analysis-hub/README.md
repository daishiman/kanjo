# 退避サイクル: 2026-09-15-analysis-hub

支出分析ハブ画面 (design/FINAL-UI/images/03-analysis-hub.png。feat-analysis-hub、PR #50 で 2026-09-15 マージ済み) の確定仕様。次サイクル (照合画面 design/FINAL-UI/images/04-reconciliation.png の UI/UX 改善と必要なバックエンド改善) を開始する際に退避した。

本サイクルの上位概念は「支出分析の入口を 5 つの視点のハブとして組み直す」であり、次サイクルの「照合画面で帳簿と口座の差異を一件ずつ解消できるようにする」とは上位概念が入れ替わる。次サイクルは本サイクルのハブ集約 API (GET /analysis/hub)・5 タブ名・サイドバー子行の件数バッジを前提として使うため、本サイクルの確定内容はそのまま実装の正本として有効である。退避内容は HEAD (cc0d5e3) のコミット済み内容を `git show` で書き出したものと同一である。

退避したファイル:

- `00-requirements-definition.md`
- `auth.md`
- `backend.md`
- `completeness-findings.json`
- `database.md`
- `fetched-references.json`
- `frontend.md`
- `index.md`
- `infrastructure.md`
- `maintenance-ops.md`
- `security.md`
- `spec-state.json`
- `ui-ux.md`
