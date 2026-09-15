# 退避サイクル: 2026-09-14-overview-screen

概況画面 design/FINAL-UI/images/02-overview.png の UI/UX 改善と、それに伴うバックエンド・データベース改善 (未処理キュー API、後で確認の保留、月次レビューの記録。feat-overview-screen、Beads kanjo-8c2) の確定仕様。

本サイクルは支出分析ハブ (feat-analysis-hub、PR #50) と並行して 2026-09-14 に開始し、PR #50 が先に main へマージされて `system-spec/` 直下を支出分析ハブの仕様へ置き換えたため、概況のブランチを main へ取り込む際に退避した。直下を奪い合わずに、先にマージされた方を直下に残す。

本サイクルの上位概念は「概況を月次クローズの作業起点にする」(U1) で、支出分析ハブの「支出分析の入口を視点のハブとして組み直す」とは画面も上位概念も別である。両サイクルの確定内容は互いに矛盾せず、どちらも実装の正本として有効である。退避内容は作業ツリーで確定した内容とバイト単位で同一で、`architecture/overview-screen-*.md` と `specs/spec-overview-screen.md` の source_digest は変わらない (source_path と evidence_ref だけを本ディレクトリへ付け替えた)。

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
