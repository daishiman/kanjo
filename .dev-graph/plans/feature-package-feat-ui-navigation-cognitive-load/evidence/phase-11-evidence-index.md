# P11 検証証跡索引 — 停止

- Task: `SYS-UINAV-P11` / Beads `kanjo-ay0.11`
- Result: **STOP / P10未完**
- Privacy: 全証跡はsource、匿名fixture、件数、公開UI文言だけ。実明細・実金額・`.dev.vars`・secretなし。

| Phase | 状態 | 証跡 / 成果物 |
|---|---|---|
| P01 | PASS | `phase-01-ui-audit.md` |
| P02 | PASS | `phase-02-navigation-contract.md` |
| P03 | PASS | `phase-03-design-review.md` |
| P04 | PASS | `phase-04-test-design.md` |
| P05 | PASS | `phase-05-implementation.md`、Web 5成果物 |
| P06 | PASS | `phase-06-test-run.json` |
| P07 | STOP | `phase-07-acceptance.md`（browser runtime unavailable） |
| P08 | STOP | P07未完。共通metadata実装はP05で済んでいるがphase acceptance未実行 |
| P09 | STOP | `phase-09-quality-assurance.md` |
| P10 | STOP | `phase-10-final-review.md` |
| P11 | STOP | 本書。P10未完のため完全な索引として確定しない |
| P12 | STOP | `docs/ui-navigation-guidelines.md`は先行作成済み。P11未完のためphase acceptance未実行 |
| P13 | STOP | `phase-13-pr-readiness.md` |

再開点はP07。P07/P09の実ブラウザ証跡を追加後、P08から依存順に再判定する。

## 受入条件ごとの状態 (2026-08-30)

`STOP`は「全条件が未着手」を意味しない。無変更で充足と判定した条件と、visual証跡だけが欠けている条件を区別する。

| FR/AC | 状態 | 根拠 |
|---|---|---|
| FR-001 / AC-001 | 充足 | `phase-06-test-run.json`(DOM test) |
| FR-002 / AC-002 | 充足 | `phase-06-test-run.json`(型exhaustive + DOM test) |
| FR-003 / AC-003 | 部分 | 構造は`phase-06-test-run.json`。4幅visualが`phase-07-acceptance.md`でSTOP |
| FR-004 / AC-003 | 部分 | 同上。ARIAは固定済み、視認確認が未実施 |
| FR-005 / AC-004 | 進行中 | `taskDetail`による段階表示を実装中 |
| FR-006 | 実装不要と判定 | `phase-01-ui-audit.md`(通常遷移にmodalなし=現状維持)、`phase-03-design-review.md`、`phase-10-final-review.md` |
| FR-007 / AC-005 | 実装不要と判定 | `phase-01-ui-audit.md`・`phase-03-design-review.md`・`phase-05-implementation.md`(既存inline editorが対象名/保存/取消/未保存guard/処理結果を満たすため無変更)、`phase-10-final-review.md`で確認 |
| AC-006 | 部分 | unit/DOM/build/UI contractはPASS。主要viewport visualが未実施 |

条件と実装の対応は各task specの「対応する要求」節、最新の充足状況は`features/feat-ui-navigation-cognitive-load.md`の受入節を正本とする。

## `phase-06-test-run.json`のコマンドについて

記録されている`--maxWorkers=1`は実行時点(2026-08-30)のコマンドである。その後test基盤側で並列実行が可能になり当該フラグは削除された。証跡は当時の事実として書き換えず、現行の実行方法は`docs/ui-navigation-guidelines.md`の「リリース前チェック」を見る。

