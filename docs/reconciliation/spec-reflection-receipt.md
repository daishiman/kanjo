# 照合画面 仕様反映の受領書 (SYS-RECON-P13)

main を照合ブランチへ取り込み、draft PR を出す前に、本変更が仕様・設計へ影響するかを判定した記録です。

- Beads: kanjo-4hd (kanjo-4hd.1..13)
- dev-graph: feat-reconciliation (SYS-RECON-P01..P13)
- 判定日: 2026-09-16

## 1. 結論

**仕様への影響は「あり」。規範 (`specs/spec-reconciliation.md`) と説明文書へ反映済みです。設計 (`architecture/reconciliation-*.md`) と `features/feat-reconciliation.md` は変更していません。**

影響源は 2026-09-16 の利用者の指摘 2 件です。

1. 「複数選択したものの取引や照合ができない」
2. 「MoneyForward にあって freee に無い支出は特に何もする必要がないはずなのに、何も対応ができない」

いずれも画面の不具合ではなく、**状態語の定義と一括操作の可否条件という規範の欠落**でした。そのため仕様本文に反映しています。

## 2. 反映したもの

| 対象 | 変更 | 理由 |
|---|---|---|
| `specs/spec-reconciliation.md` BR-004 | 状態を 5 語 (未処理 / 要確認 / 照合済み / MFのみ / 除外) に分け、`MFのみ` を未処理・対応キューへ読み替えないことを明記 | 旧定義は「未処理」に『判断が要る』と『何もしなくてよい』の 2 意味が混在していた |
| 同 BR-005 | 解消率の分母から `MFのみ` と `除外` を外す | 対応不要の行が分母に入ると、正しく片付けても解消率が上がらない |
| 同 BR-006 | 月次クローズの照合ステップとサイドバーのバッジは `actionRequiredCount` (要確認 + 未処理) で判定し、`MFのみ` を数えない | 対応不要の行で月次クローズが閉じられなくなるのを防ぐ |
| 同 BR-009 | 一括は「照合」「別の取引として処理」「照合から除外」の 3 種。除外は除外済み以外をすべて送る。一括照合は同じ freee の候補を指す 2 件目以降を送らず、API は判定器で組めない「同じ」を保存せず理由を返す | 指摘 1・2 の直接の規範。可否条件を判断系 (同じ / 別の取引) と片付け系 (除外) で分けた |
| 同 API 契約 | 件ごとの失敗理由に `freee_excluded` / `freee_already_matched` / `not_matchable` を追加 | 保存前の試算で落ちた件の理由を利用者へ返すため |
| `docs/data-schema.md` | 状態 5 語の定義、キュー、KPI 事業支出の式 (除外を含む)、月次クローズの数え方、「同じ」の保存前試算 | 計算規則の説明正本 |
| `docs/reconciliation.md`・`docs/runbooks/reconciliation-mismatch.md`・`docs/reconciliation/{architecture-decision,requirements-baseline,evidence,test-run,close-out}.md`・`docs/reconciliation-icons.md` | MFのみの方針、一括除外、除外しても総収支の金額が変わらないこと、新しい失敗理由、実測値 | 運用・調査・証跡の追随 |
| `system-spec/archive/2026-09-15-analysis-hub/` と `architecture/analysis-hub-*.md`・`specs/spec-analysis-hub.md` の frontmatter | 支出分析ハブの確定仕様を退避し、`source_lineage.source_path` と `confirmation_evidence.evidence_ref` を退避先へ付け替え (digest は不変) | `system-spec/` 直下を照合サイクルの確定仕様が使うため。過去サイクル (概況・design-system) と同じ退避規約 |
| `architecture/graph.json` | `arch-reconciliation-*` 8 ノードを追加 | architecture ノードのみの従属投影。dev-graph macro graph に合わせる |

## 3. 反映しなかったもの (判断と理由)

| 対象 | 判断 | 理由 |
|---|---|---|
| `architecture/reconciliation-*.md` (8 件) | 変更しない | 指摘 2 件の影響は「どの状態にどの操作を許すか」という規範に収まる。部品構成・データ経路・保存先・権限境界という設計判断は変わっていない。確定章 (`confirmation_status: confirmed`) は R4-reopen 経由でのみ変更する規約にも従う |
| `features/feat-reconciliation.md` | 変更しない | 本書は実装単位の境界と依存だけを持ち、規範の正本は `specs/spec-reconciliation.md` と明記されている。scope_in / scope_out / acceptance の境界は動いていない (一括操作は元から scope_in) |
| `tasks/feat-reconciliation/sys-recon-p*.md` | 変更しない | 計画時点の記録であり、package の source digest を保つため本文を書き換えない。実行後の是正は本受領書と `docs/reconciliation/test-run.md` §6 に残す |
| `system-spec/` 直下の各章 | 内容変更なし | 照合サイクルで確定した章をそのまま置いている。今回の是正は確定章の記述と矛盾しない (状態語の細分は仕様側の BR で表現する) |
| `samples/*.csv` の改行差分 | commit しない | `seed-local.mjs` の生成物で、内容は同一 |

## 4. 品質ゲート

| コマンド | 結果 |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | exit 0 (core 645 pass / 6 skipped、api 582 pass、web 626 pass。2026-09-16 の最終通し実行の実測) |
| `build:bundle` → `check:js-budget` | exit 0、109.33 KiB / 110 KiB |

実行記録の詳細は [`test-run.md`](test-run.md)、再実行手順は [`evidence.md`](evidence.md) にあります。
