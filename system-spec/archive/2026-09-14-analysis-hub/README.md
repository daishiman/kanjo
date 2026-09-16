# 退避サイクル: 2026-09-14-analysis-hub

支出分析ハブ design/FINAL-UI/images/03-analysis-hub.png の UI/UX 改善と、それに伴う集約 API (GET /analysis/hub) の確定仕様 (feat-analysis-hub、PR #50)。

本サイクルは PR #50 のマージで `system-spec/` 直下に置かれていた。2026-09-15 に総収支画面 design/FINAL-UI/images/05-total-cashflow.png のサイクルを始めるにあたり、直下を新サイクルへ明け渡すため退避した。

退避内容は main (1b16825) の `system-spec/` 直下とバイト単位で同一である (sha256 照合済み)。確定章の保護 hook を尊重し、原本の移動ではなく `git show HEAD:<path>` から新規ファイルとして複製した。`architecture/analysis-hub-*.md`・`specs/spec-analysis-hub.md`・`features/feat-analysis-hub.md` の source_digest は変わらず、source_path と evidence_ref だけを本ディレクトリへ付け替えた。

両サイクルの確定内容は互いに矛盾せず、支出分析ハブの仕様は実装の正本として引き続き有効である。

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
