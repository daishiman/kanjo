# 診断画面 — 仕様反映の受領書

- 記録日: 2026-09-18
- 対象ブランチ: `devgraph/feat-diagnosis-screen`
- base: `main`
- Beads: epic `kanjo-8bk` + `kanjo-8bk.1` .. `kanjo-8bk.13` (13 件、`dev-graph:SYS-DIAGNOSIS-SCREEN-P01`..`P13`)
- dev-graph node: `feat-diagnosis-screen`

## 判定: 仕様・設計への影響は「あり」

診断画面の作り直しは、画面の見た目だけでなく次の 3 点で契約そのものを変えている。したがって `system-spec/`・`specs/`・`architecture/` へ正規フローで反映した。

1. **判断の永続化という新しい状態を導入した**。改善アクションに対する利用者の判断 (`未着手`/`対応中`/`対応済み`/`見送り`) を D1 に残す。DB スキーマと API 契約が増えるため、設計層の記録が要る。
2. **改善余地の検知規則が二重に実装されていた**。`analysis.ts` の `tradeoffCandidates` と診断画面の独自ロジックが、同じ「改善の余地」を別々の定義で出していた。前者を削除し、`diagnosis-detectors.ts` の検知器レジストリ 1 本へ寄せた (ADR-001)。境界を文書化しないと、次に検知器を足す人が再び分岐を web/api 側へ書く。
3. **健全性スコアという新しい合成指標を定義した**。4 要素・重み 30/30/25/15 の規則ベース。算式が文書に無いと、数字の意味を後から誰も検算できない。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| system-spec | `system-spec/00-requirements-definition.md`、8 技術章、`index.md`、`spec-state.json`、`fetched-references.json` | 本サイクルの elicit → doc-fetch → compile を正規フローで通して再生成。前サイクル (マトリックス画面) の確定成果物は `system-spec/archive/2026-09-18-expense-matrix/` へ退避した |
| specs | `specs/spec-diagnosis-screen.md` (新規 287 行) | 画面仕様の正本。受入 AC-001..AC-006、業務規則 BR-001..BR-009、API 契約 |
| architecture | `architecture/arch-diagnosis-screen.md` (新規 167 行) | ADR-001 検知器レジストリ / ADR-002 判断だけ永続化 / ADR-003 D1 新表 / ADR-004 規則ベース健全性スコア / ADR-005 chart.js floating bar のウォーターフォール / ADR-006 楽観更新なし |
| architecture (graph) | `architecture/graph.json` | `arch-diagnosis-screen` を追加。93 → 94 ノード (`check-graph-lineage` で照合済み) |
| features | `features/feat-diagnosis-screen.md`、`features/feat-diagnosis-screen.context.json` (新規) | macro feature の purpose / goal / scope_in / scope_out / acceptance (S1..S6) |
| tasks | `tasks/feat-diagnosis-screen/sys-diagnosis-screen-p01.md` .. `p13.md` (新規 13 本) | exact-13 package の task spec |
| docs | `docs/diagnosis-screen.md`、`docs/diagnosis-screen-design.md`、`docs/diagnosis-screen-test-plan.md`、`docs/diagnosis-screen-evidence.md`、`docs/requirements-feat-diagnosis-screen.md`、本受領書 (いずれも新規)、`docs/spec-v1.1.md` (更新) | 見取り図・設計・テスト計画・証跡・要件と、製品全体の正本への反映 |
| migrations | `migrations/0043_diagnosis_action_states.sql` (新規) | `diagnosis_action_states`。主キー `(user_id, action_key)`、`status` は 4 語の CHECK、`note` は 500 字の CHECK |

## `docs/spec-v1.1.md` をどう更新したか

この文書は自ら「製品全体の目的・不変条件・画面/API 一覧の正本」と宣言しているため、断面ではなく現行として更新した。

- §4.1 画面一覧の P3 行: 画面名を「統計診断」から「診断」へ、1 タスクを「シグナルと判定基準を見て対応すべき科目を決める」から「次に改善すると最も効く一手を決め、根拠を確認して実行画面へ移る」へ。詳細は `diagnosis-screen.md` を指す一方向参照にした。
- FR-03 の「統計診断」行: 検知器レジストリ・健全性スコアの 4 要素と重み・ウォーターフォール・主なシグナル 3 件を追記した。従来の統計プロファイルは消さず「根拠タブへ残す」と明記した。消すと、既存の統計指標がどこへ行ったのかが読めなくなる。
- §API 一覧: `GET /diagnosis` の戻り値を画面 1 枚分へ改め、`PATCH /diagnosis/actions/:action_key` を追加した。

HTML 版の由来を述べる箇所 (§1 背景、移行対応表) の「統計診断」は**変えていない**。これは移植元の機能名であり、今の画面名ではない。

## 仕様を実装に合わせて緩めなかった点

`specs/spec-diagnosis-screen.md` の AC-001..AC-006 はいずれも自動テストで固定済みで、今回は仕様側の記述を削っていない。

本番反映 (P13 = `kanjo-8bk.13`) は未実施である。`migrations/0043` はローカル D1 へ 0001〜0043 を通して適用し PASS しているが、本番の Migrate APPLY と Deploy は行っていない。日本語 4 語リテラルの CHECK 制約が本番 D1 で通ることは、ローカル範囲までしか接地していない。

## 検証結果

| 検査 | 結果 |
|---|---|
| `pnpm typecheck` | core / api / web すべて Done |
| `pnpm lint` (10 項目の `&&` チェーン) | 全 PASS。`Checked 493 files`、`check-graph-lineage: 94 ノードすべてが正本と一致`、デザイントークン直書き 0 件 / 131 ファイル、`公開文書の実データ参照チェック: OK` |
| core 診断テスト (detectors / health / scope-totals / expense-projection) | Test Files 4 passed、Tests 59 passed |
| api `test/diagnosis-screen.integration.test.ts` | Test Files 1 passed、Tests 17 passed |
| web 全テスト | Test Files 87 passed、Tests 716 passed |
| `pnpm build` (`check:js-budget` を含む) | PASS。初期 JS 102.97 KiB / 上限 110 KiB |
| ローカル実機 | `wrangler dev --local` (8788) で `GET /api/diagnosis` 200、`PATCH` 200 と保持、不正 status 400 を実測 (`docs/diagnosis-screen-evidence.md` §6) |

## commit の範囲

この worktree には、診断サイクル以前から取込・照合まわりの未コミット変更 (弱い同一性・stable_key・duplicate verdict など、`packages/core/src/{classify,fingerprint,reconciliation,parsers/mf}.ts`、`packages/api/src/import-*`、`packages/web/src/pages/analysis/reconciliation/`、`docs/reconciliation*`、`specs/spec-reconciliation.md`、`docs/product/backlog.md` ほか) が先行して存在する。

**これらは commit していない。** 診断サイクルに属する差分だけを対象にした。`docs/spec-v1.1.md` は両方の変更が同じファイルに載るため、診断に関わる 3 か所のハンクだけを index へ入れ、取込側の 1 ハンク (MF 弱い同一性の記述) は worktree に残した。

`samples/*.csv` はローカル seed で生成し直したが、git 正規化後の差分は 0 行だった。`packages/api/.dev.vars` は `.gitignore` 対象で追跡していない。

## main の取り込み (2026-09-18)

`origin/main` = ローカル `main` = `4e3583c`。本ブランチの `f58d4a9` が既にこれをマージ済みで、取り込みは差分 0 (no-op) だった。衝突なし。

## P13 (本番反映) の実際の経路

task spec (`tasks/feat-diagnosis-screen/sys-diagnosis-screen-p13.md`) は本番反映の手順を
「manifest → Migrate APPLY → Deploy」と書いているが、**今回の migration にこの経路は当てはまらない**。

- `.github/workflows/migrate.yml` は冒頭で「列や行を失う D1 変更だけを、承認 manifest つきで手動実行する。追加だけの migration は Deploy が自動適用するので、通常このworkflowは使わない」と宣言している。
- `migrations/0043_diagnosis_action_states.sql` は新表の `CREATE TABLE` のみで、既存の列・行を失わない (task spec の「スコープ外」にも「既存表の行書き換えは行わない」と明記されている)。
- `.github/workflows/deploy.yml` は main の CI 成功後に起動し、migration の適用を Worker 配信より**前**に行う (`schema-guard` が期待版に達するまで D1 経路を 503 で閉じるため)。

したがって P13 の実体は **PR #59 を `main` へ merge すること**であり、手動の Migrate APPLY は不要である。
task spec の記述は行書き換えを含む一般手順であって、本 migration の分類 (追加のみ) を反映していない。
task spec は system-dev-planner の生成物なので本サイクルでは書き換えず、実際の経路をここへ記録する。

P13 の完了判定は task spec 自身が `linked_pr_merged_all` (PR が既定ブランチへ merge された時点) と
定めており、merge 前に閉じられる phase ではない。`kanjo-8bk.13` と epic `kanjo-8bk` は open のままとした。

## 残課題

1. **P13 本番反映が未実施**。PR #59 の merge が前提 (上記のとおり手動 Migrate APPLY は不要)。
2. `duplicate_payment` 検知器が同額多発のデータで候補を出しすぎる傾向がある。claim 交差による排他は効いているが、しきい値の追い込みは次サイクル。
3. 比較対象 (`baseline`) は前 20 か月が不完全だと `null` になる。ローカル seed の範囲では常に `null` で、欠け月の扱いは実データでの確認が残る。
