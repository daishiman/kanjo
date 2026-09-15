# 支出分析ハブ テスト・型検査・lint 実行記録 (SYS-ANHUB-P06)

- 実行日時: 2026-09-14T21:44:19Z (UTC, 実測)
- 基準コミット: `2162fd2` (origin/main と同一) + 本 feature の未コミット変更
- 実行順: architecture/analysis-hub-maintenance-ops.md の verify:full に合わせ test → typecheck → lint

## 結果サマリー

| コマンド | exit | 要約 |
|---|---|---|
| `pnpm -r test` (core / api / web) | 0 | core 579 passed・6 skipped / api 529 passed / web 549 passed。失敗 0 |
| `pnpm test` (上記 + test:aux) | 1 | パッケージ分は全件 green。test:aux の delivery:test だけが `check-design-tokens` で失敗 (下記 F1) |
| `pnpm typecheck` | 0 | core / api / web すべて Done |
| `pnpm lint` | 1 | `check-design-tokens` で停止 (F1)。停止位置より後ろは個別に実行して記録した |

### lint の段ごとの結果

| 段 | exit | 備考 |
|---|---|---|
| `biome check .` | 0 | 389 files, No fixes applied |
| `sync-project-skills --check` | 0 | 配布先は正本と一致 |
| `check-glossary` | 0 | 59 語すべて画面で使用 |
| `check-report-css` | 0 | 正本と一致 |
| `check-graph-lineage` | 0 | 53 ノード一致・孤児 0 |
| `check-design-tokens` | 1 | F1 |
| `check-design-system-document-contract` | 0 | 個別実行 |
| `check-design-system-delivery --worktree-content` | 0 | 個別実行。13 canonical nodes・18 staging hashes 一致 |
| `check-design-system-run-references` | 0 | 個別実行 |
| `security:content` (`guard-real-data.sh --scan-public-docs`) | 2 | F2 |

## 回帰の有無

既存の analysis-tabs / navigation-ux / common-shell-routes を含む web 74 ファイルがすべて green。
P05 で分析タブの表示名を仕様の新名称 (総収支・推移・マトリクス) へ揃えたため、旧ラベルを期待していた次のテストを新名称とハブ前提へ更新した。

- `packages/web/src/analysis-tabs.dom.test.tsx` — `/analysis` はハブを描く前提へ変更
- `packages/web/src/navigation-ux.dom.test.tsx` — `総収支`
- `packages/web/src/common-shell.dom.test.tsx` — `トータル収支` → `総収支`

## 失敗の切り分け (本 feature の変更が原因ではないもの)

### F1: `check-design-tokens` — spec-state の digest 不一致

> 2026-09-15 解消: 再承認ではなく承認記録の参照先を archive へ付け替えた。詳細は [close-out.md](close-out.md) 3-1。

- メッセージ: `external reference record digest differs: system-spec/spec-state.json`
- 根拠: `docs/design-system/token-approval.json` が記録する digest は HEAD 版 `spec-state.json` の SHA-256 (先頭 `ebb1719358de`) と一致し、作業ツリー版 (先頭 `392bbe4a9ed1`) とは一致しない。
- 原因: 支出分析ハブの仕様サイクルで `system-spec/spec-state.json` が更新されたが、デザイントークン承認記録は旧 digest のまま。コード変更 (`packages/`) とは無関係。
- 扱い: 本 task の write scope 外。commit 前にトークン承認記録の再承認 (digest 更新) が必要な事項として close-out へ引き継ぐ。

### F2: `security:content` — 公開文書にローカル絶対パス

> 2026-09-15 解消: 4 件とも匿名化し `security:content` は緑。詳細は [close-out.md](close-out.md) 3-1。

値は表示せず、ファイルと行だけを記録する。

| ファイル | 追跡 | 行 |
|---|---|---|
| `.dev-graph/plans/feature-package-feat-analysis-hub/plan-findings.json` | 未追跡 | 65, 67 |
| `.dev-graph/state/plan-evidence/run-20260914-anhub-readiness.json` | 未追跡 | 54 |
| `.dev-graph/state/plan-findings/run-20260914-anhub.json` | 未追跡 | 65, 67 |
| `system-spec/completeness-findings.json` | 追跡 (作業ツリーで変更) | 7 |

- 根拠: `system-spec/completeness-findings.json` の HEAD 版は該当 0 件で、作業ツリー版だけが該当する。残り 3 件は計画サイクルが出力した未追跡ファイル。
- 原因: 仕様・計画ハーネスが評価記録に実行環境の絶対パスを書き出した。実データ (明細・金額) の混入ではない。
- 扱い: 本 task の write scope 外。commit 前に該当値を repo 相対パスへ匿名化する事項として close-out へ引き継ぐ。

## テストが旧実装を落とすかの検算 (mutation)

緑であることが「何も調べていない」ことと区別できるよう、実装を意図的に壊してテストが赤になるかを確認し、確認後に元へ戻した。

| 対象 | 壊し方 | 結果 |
|---|---|---|
| core `analysis-hub.ts` M1 | hubPriority の `count > 0` を `count > 1` へ | 赤 (検出) |
| core `analysis-hub.ts` M2 | annualSavings の年換算 `* 12` を `* 1` へ | 赤 (検出) |
| core `analysis-hub.ts` M3 | previousPeriod の開始月を 1 か月ずらす (`- n` → `- n + 1`) | 赤 (検出) |
| web `Analysis.tsx` W1 | `focusOf` の検証を外し、`?focus=` の値をそのまま使う | 当初は生存 → テスト強化後に赤 |
| web `Analysis.tsx` W2 | 行選択の `{ replace: true }` を外し履歴を積む | 当初は生存 → テスト強化後に赤 |

W1 / W2 を検出するため `packages/web/src/analysis-hub.dom.test.tsx` に「不正 focus で押下状態の行が既定 1 件だけ」「行選択の navigation type が REPLACE」の検査を足した。

## 判定

本 feature のコード変更に起因する失敗は 0 件。残る失敗 F1 / F2 はどちらも仕様・計画サイクルの成果物に起因し、commit 前の対応事項として SYS-ANHUB-P13 の close-out に記録する。
