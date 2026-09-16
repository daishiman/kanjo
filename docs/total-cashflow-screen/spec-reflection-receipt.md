# 仕様反映の受領書 (総収支画面)

配信 (commit / push / draft PR) の直前に、本変更が仕様・設計へ与える影響を確認した記録。
**影響が無かったから何もしなかった**のか、**反映した結果いまの状態になっている**のかを
後から区別できるようにする。

- Beads: epic `kanjo-kui`、子 `kanjo-kui.1` .. `kanjo-kui.13`
- dev-graph: feature `feat-total-cashflow-screen`、node `SYS-TCSCREEN-P01` .. `P13`
- 対象 base: `main` (`origin/dev` は存在しない)

## 結論

**影響あり。すでに正規フローで反映済み。** 本受領書の時点で追加の反映は不要。

理由は単純で、本作業は `/dev-graph` の 11 verb を通して行っており、
`system-spec/` → `specs/` → `architecture/` → `features/` → `tasks/` の順に
**実装より先に**文書が生成・更新されているため。後追いで書き足したものではない。

## 反映先ごとの状態

| 反映先 | 反映の実体 | 経路 |
|---|---|---|
| `system-spec/` | 全 9 章 + `index.md` + `spec-state.json` + `completeness-findings.json` を総収支画面を含む世代へ更新 | `/dev-graph spec` (system-spec-harness 0.1.14 を引用) |
| `system-spec/archive/2026-09-14-analysis-hub/` | 旧世代 (支出分析ハブ) を退避 | 同上 |
| `specs/spec-total-cashflow-screen.md` | 新規。FR-001..008 / BR / スコープ外 | `/dev-graph node` (C02 単一 writer) |
| `architecture/total-cashflow-screen-*.md` (8 領域) | 新規。ui-ux / frontend / backend / database / auth / security / infrastructure / maintenance-ops | 同上 |
| `architecture/graph.json` | 総収支のノードと辺を追加 | 同上 |
| `features/feat-total-cashflow-screen.md` + `.context.json` | 新規。macro feature | `/dev-graph decompose` |
| `tasks/feat-total-cashflow-screen/` | P01..P13 の exact-13 package | `/dev-graph plan` (system-dev-planner) → `register-package` |
| `docs/total-cashflow-screen.md` ほか | 規則 docs・runbook・各 phase の記録 | 本作業 |

## 既存文書への追随 (再指定した lineage)

`system-spec/` の正本が総収支の世代へ入れ替わったため、
**支出分析ハブの文書が指していた出典が移動した**。放置すると
`check-graph-lineage` が落ち、より悪いことに「正本を指しているつもりで
別機能の章を読む」文書が残る。次の 10 ファイルの `source_lineage` /
`confirmation_evidence` / 本文の参照を `system-spec/archive/2026-09-14-analysis-hub/` へ再指定した。

- `specs/spec-analysis-hub.md`
- `features/feat-analysis-hub.md`
- `architecture/analysis-hub-{ui-ux,frontend,backend,database,auth,security,infrastructure,maintenance-ops}.md`

**内容は 1 文字も変えていない。**出典の所在だけを直している。

## 仕様に影響しないと判断したもの (理由つき)

| 差分 | 判断 | 理由 |
|---|---|---|
| `samples/*.csv`、`scripts/seed-local.mjs` | 仕様への影響なし | ローカル画面確認用の架空データ。本番経路に載らず、仕様の受入条件にも現れない |
| `scripts/hooks/guard-real-data.sh` | 仕様への影響なし | 検査器の誤検知修正。「date -u で実測した時刻」という監査記録の定型句が、同じ行の数量と結び付いて実データ扱いされていた。守る対象 (実データを公開文書へ持ち込まない) は変えていない |
| `packages/api/src/schema-guard.ts`、`deletion-schema.test.ts` | 仕様への影響なし | `EXPECTED_D1_MIGRATION` を `0041` へ進める機械的追随。migration 追加時に必ず伴う |
| `packages/web/src/display-contract.test.tsx` | 仕様への影響なし | `<PageHeader route=` の検出を正規表現へ。改行を挟む書き方でも拾えるようにしただけで、契約 (全業務ページが共通ヘッダーを使う) は同じ |
| `.dev-graph/render/index.html` ほか | 仕様への影響なし | graph の可視化成果物。正本は `.dev-graph/state/graph.json` |

## 未反映を承知で残したもの

| 項目 | 状態 | 理由 |
|---|---|---|
| `compareWorkbenchRows` の並び順 | 仕様に書いていない | 仕様が決めておらず、実装側で決めた設計判断。`docs/total-cashflow-screen.md` BR-003 に「仕様が決めていない」と明記して可視化した。仕様へ昇格させるかは利用者の判断 |
| P13 の本番適用 | 未実施 | draft PR の merge 後に行う。`close-out.md` 参照 |
