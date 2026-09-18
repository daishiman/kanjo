# サブスク画面 — 仕様反映の受領書

- 記録日: 2026-09-18
- 対象ブランチ: `devgraph/feat-subscriptions-screen`
- base: `main` (`4e3583c`。`origin/main` = ローカル `main` = 分岐元で、取り込む差分は 0)
- Beads: epic `kanjo-fge`、子 `kanjo-fge.1` .. `kanjo-fge.13` (13 件、`dev-graph:SYS-SUBS-P01`..`P13`)
- dev-graph node: `feat-subscriptions-screen`

## 判定: 仕様・設計への影響あり → 反映済み

本サイクルは画面の作り直しに加え、保存 (migration 0043)・API (6 経路)・core の集計関数の新設を含む。
仕様・設計に影響するので、全層へ反映した。

## 何が変わったか (判定の入力)

1. **集計の正本を core 1 か所にした**。KPI・一覧・詳細・推移・比較・見直し候補・サイドバーのバッジを
   `packages/core/src/subs-screen.ts` の `subscriptionsScreen` から導く。web と api に集計は無い。
2. **保存を足した** (migration 0043)。`sub_vendors.category` と `sub_vendor_review_decisions` 表。
   既存の行は書き換えない。
3. **API を足した**。詳細の GET、統合 (別名の追加)、見直し判断の POST / DELETE、カテゴリの PUT。
4. **旧 UI を撤去した**。`SubVendors.tsx` と旧テスト 2 本を削除し、機能 (別名・対象科目・四半期見直し・
   未登録候補の採用 / 除外) を新しい画面の関連データタブと候補欄へ移した。
5. **P10 の最終レビューで契約を 4 つ足した**。集計と詳細の応答の `private, no-store`、
   名前変更での判断の付け替えと登録解除での削除、判断を表示中の期間で保存すること、
   バックアップ・復元への `category`・判断の追加。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| system-spec | `system-spec/00-requirements-definition.md`、8 技術章、`index.md`、`spec-state.json`、`fetched-references.json`、`completeness-findings.json` | 本サイクルの elicit → doc-fetch → compile を正規フローで通して再生成。前サイクル (マトリックス画面) の確定成果物は `system-spec/archive/2026-09-18-expense-matrix-screen/` へ退避した |
| specs | `specs/spec-subscriptions-screen.md` (新規) | 画面仕様の正本。本受領書の作成時に §13.1 (`no-store`)、§13.2 (判断の付け替え・削除・期間)、§14 (バックアップと復元) を P10 の修正に合わせて追記した |
| architecture | `architecture/subscriptions-{ui-ux,frontend,backend,database,auth,security,infrastructure,maintenance-ops}.md` (新規 8 本) | 8 技術章に対応する設計判断。本受領書の作成時に backend・database・security へ P10 の契約を追記し、security の別名上限を 50 × 120 文字に直した |
| architecture (graph) | `architecture/graph.json` | `.dev-graph/state/graph.json` からの投影。93 → 101 ノード |
| features | `features/feat-subscriptions-screen.md`、`.context.json` (新規) | macro feature の purpose / goal / scope / acceptance (S1..S5) |
| tasks | `tasks/feat-subscriptions-screen/sys-subs-p01.md` .. `p13.md` (新規 13 本) | exact-13 package の task spec |
| docs | `docs/subscriptions-screen.md`、`docs/evidence/subscriptions-screen.md`、`docs/evidence/subscriptions/` (いずれも新規)、本受領書 | 見取り図 (受入 19 項目・数値の定義・見直し候補の規則)・証跡・判定の記録 |
| docs (既存) | `docs/spec-v1.1.md`、`docs/data-schema.md`、`docs/design-system.md`、`docs/ui-decisions.md`、`design-qa.md` | 製品全体の正本の画面一覧 (P4)・FR-03・§10.3 と、表定義・図と表の規約 (推移の系列を上位 3 + その他に畳む、比較表と直近取引の並びの固定理由)・UI 決定の節・Design QA を実装に合わせた |

## 既存 docs の扱い

`docs/spec-v1.1.md` を更新したため、これを出典に持つ `arch-tax-preparation-boundary` の `source_digest` が
現物とずれた (`check-graph-lineage` が検出)。この node は確定申告の境界の設計で、今回変えた P4 行・FR-03 の
サブスク行・§10.3 のどれにも触れないので、章の内容は変えずに digest だけを打ち直した。

`docs/spec-v1.1.md` は「製品全体の目的・不変条件・画面/API一覧の正本」なので更新した。
P4 の画面名を「サブスク分析」から「サブスク」(`routeMetadata.ts` の `label`) に合わせ、
機能固有の詳細は `docs/subscriptions-screen.md` への一方向参照にした。
HTML 版の由来を述べる箇所 (§2 の機能一覧、移行対応表) の「サブスク分析」は移植元の機能名なので変えていない。

## 仕様を実装に合わせて緩めなかった点

- 判断を表示中の期間の指紋で保存するため、1 年以外で判断するとサイドバーのバッジ (直近 1 年) が減らないことがある。
  仕様どおりの挙動として記録し、どの期間で保存するかは後続課題に残した。
- AI 指示文の候補と画面の見直し候補は定義が違う (OI-03)。本サイクルでは AI 側を変えず、差を
  `docs/subscriptions-screen.md` に表で残した。

## 検証結果

`docs/evidence/subscriptions-screen.md` の「1. テスト実行記録」が本体。`pnpm verify:full` exit 0
(core 784 / api 636 / web 718 件、JS 102.95KiB / 110KiB)。本受領書の文書更新の後に `pnpm lint` と
`pnpm typecheck` を再実行し、どちらも exit 0 (`check-graph-lineage: 101ノードすべてが正本と一致`、`公開文書の実データ参照チェック: OK`)。

## Beads の状態

子 `kanjo-fge.1` .. `.12` は `bd-bridge.py --op close` で closed にした (理由: PR #60 で実装・検証済み)。
`kanjo-fge.13` (配信と migration 0043 の本番適用) と epic `kanjo-fge` は open のまま残し、
PR のマージと本番適用の後に閉じる。

## 残課題

1. 判断を保存する期間 (いまは表示中の期間)。
2. AI 指示文の候補との定義差 (OI-03)。
3. `pnpm run evidence:check` の stale (design-system の manifest の `base_revision` が `35fffe4`)。本 feature の前から残る不一致。
4. 本番 D1 への migration 0043 の適用。追加だけなので main へのマージ後に Deploy が自動適用する (`destructiveFindings` は 0 件)。手動の Migrate は不要。
