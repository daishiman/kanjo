# 退避サイクル: 2026-09-14-design-system-foundation

FINAL-UI 20 画面から抽出したデザインシステム基盤 (トークン正本・共通 Button・チャート系列色・共通シェル。feat-design-system-foundation、PR #49 で 2026-09-14 マージ済み) の確定仕様。次サイクル (支出分析ハブ画面 design/FINAL-UI/images/03-analysis-hub.png の UI/UX 改善と必要なバックエンド改善) を開始する際に退避した。

本サイクルの上位概念は「見た目を単一の共通定義へ集約する」であり、次サイクルの「支出分析の入口を 5 つの視点のハブとして組み直す」とは上位概念が入れ替わる。次サイクルは本サイクルのトークン・共通部品・チャート規約を前提として使うため、本サイクルの確定内容はそのまま実装の正本として有効である。退避内容は HEAD (2162fd2) のコミット済み内容と同一で、`architecture/design-system-*.md` の source_digest は変わらない。

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
