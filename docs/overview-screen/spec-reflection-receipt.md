# 概況画面 仕様反映の受領書 (SYS-OVERVIEW-P13)

main (PR #50 支出分析ハブ) を概況ブランチへ取り込み、draft PR を出す前に、本変更が仕様・設計へ影響するかを判定した記録です。

- Beads: kanjo-8c2 (kanjo-8c2.1..13)
- dev-graph: feat-overview-screen (SYS-OVERVIEW-P01..P13)
- 判定日: 2026-09-15

## 1. 結論

**仕様本文の変更は無し。仕様の置き場所 (system-spec の退避) と由来パスの付け替えだけを反映しました。**

概況の確定仕様は内容を変えずに `system-spec/archive/2026-09-14-overview-screen/` へ退避しています。`system-spec/` の直下には、先に main へマージされた支出分析ハブの仕様が残ります。

## 2. 反映したもの

| 対象 | 変更 | 理由 |
|---|---|---|
| `system-spec/archive/2026-09-14-overview-screen/` (13 ファイル + README) | 作業ツリーで確定した概況仕様をバイト単位で同一のまま配置 | PR #50 が直下を支出分析ハブの仕様に置き換えた。直下を奪い合わず、先にマージされた方を直下に残す (過去サイクルの退避と同じ規約) |
| `architecture/overview-screen-*.md` (8 件)、`specs/spec-overview-screen.md`、`features/feat-overview-screen.md` | frontmatter の `source_lineage.source_path` と `confirmation_evidence.evidence_ref` を退避先へ付け替え。digest は不変 | PR #50 が design-system 基盤の退避で行った付け替えと同じ形 |
| `architecture/graph.json` | main のノード (analysis-hub 8 件を含む) に、概況の architecture 8 件を足した和集合。概況ノードの `source_path` は退避先 | 両ブランチがそれぞれ 8 ノードを追加していた |

確定章の保護 (`status: confirmed` の章は R4-reopen 経由でのみ変更) に従い、直下にあった概況の確定章は書き換え・削除していません。退避先へは新規ファイルとして置きました。

## 3. 仕様への影響が無いと判断したもの

| マージで生じた差分 | 判断 | 根拠 |
|---|---|---|
| 分析 API の重複判断の結び付けを `routes/duplicate-verdict-bindings.ts` の `bindDuplicateVerdicts` に一本化 (概況側は `total-cashflow.ts` から export した `bindVerdicts` を使っていた) | 影響なし | tx_id 優先 → 現行版 stable_key の 2 段解決という定義は同じ。未処理キューの照合件数 (FR-002) の数え方は変わらない |
| サイドバーの「照合」子項目の件数バッジを、概況の未処理キュー由来から支出分析ハブの `reviewCount` 由来へ統一 | 影響なし | 概況仕様 FR-007 / AC-002 が求めるのは「サイドバーの概況項目」のバッジで、`GET /api/review-queue` の件数と一致すること。概況項目・取込・仕分けのバッジはそのまま。照合子項目の二重バッジを避けた |
| `viewports.mjs` の検査幅を両側の和集合 (430・641・820・900・1023・1024・1180 を含む) に拡大 | 影響なし (検査が強くなる方向) | FR-006 の判定は「VIEWPORT_CASES の全幅で exit 0」。幅が増えても基準は緩まない |
| `check-financial-visuals.mjs` の API 差し替えに `/api/overview`・`/api/review-queue` と `/api/analysis/hub` を両方置く | 影響なし | 架空データの差し替えだけで、仕様の値ではない |

## 4. 反映しなかったもの

- 概況の計画成果物 (`.dev-graph/plans/feature-package-feat-overview-screen/`、`tasks/feat-overview-screen/`) 本文中の `system-spec/...` 参照は、計画時点の記録として書き換えていません。package の source digest を保つためです。
- `samples/*.csv` の改行コード差分、`.dev-graph/render/*`、`docs/design-system/*.json` の作業ツリー差分は、概況と無関係か main 側の同等変更で置き換わるため、コミットしていません。
