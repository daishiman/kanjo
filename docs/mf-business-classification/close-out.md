# MF 事業判定の締め方

状態の正本は `features/feat-mf-business-classification.md` の frontmatter。本書は完了条件と引き渡し先だけを持ち、別の完了チェック状態を持たない。

## 完了条件

1. `specs/spec-mf-business-classification.md` の受入条件が匿名化 fixture の契約テストで確認できる。
2. typecheck、対象テスト、全テスト、preview の主要フローが通る。
3. `/api/transactions` の `src` / `bySource` と `/api/total-cashflow` の要確認表示が一致する。
4. raw production data、秘密情報、実データ由来の値が変更差分に含まれない。
5. リリース後の確認結果を `test-run.md` へ記録し、feature frontmatter の状態を一度だけ更新する。

## 復旧

- **版の巻き戻し**: 対象コミットを `git revert` し、通常の配信経路で再公開する。
- **MF 中項目判定の部分無効化**: `mf_mid` 分岐だけを止める別変更。正式な rollback とは区別し、別の受入とリリースを行う。

## プロモーション後の匿名化(完了条件4)

`features/feat-mf-business-classification.context.json` の受入条件 2 行に、実 CSV 由来の金額と件数が残っていた。
このファイルは gitignore 対象外のため、そのまま commit すると実際の収入額が git 履歴へ入る。
値を落とし、条件の意味だけを残す形へ書き換えた。

`pnpm lint` の `security:content` ゲートは書き換え前も緑だった。同ゲートは設計上、
ローカル絶対パスと Downloads 配下のファイル参照だけを見ており(`scripts/hooks/guard-real-data.sh` 冒頭のコメント)、
**金額や件数といった値は検出対象外**である。緑であることを条件4の根拠に使わないこと。

この書き換えでファイルの digest が変わり、プロモーション receipt 2 件
(`.dev-graph/plans/feature-package-feat-mf-business-classification/` の
`feature-package.json` と `system-build-handoff.json`)が記録する
`source_feature_digest` は、現物と一致しなくなった。

| 影響 | 判定 |
|---|---|
| `validate-system-plan.py` | 影響なし。staging 配下のファイルだけを hash し、`features/*.context.json` は読み直さない。`source_feature_digest` は package と handoff の識別子照合に素通しするだけ |
| `promote-system-plan.py` | 再プロモーション時のみ現物と突合する。その際は書き換え後のバイト列から算出されるため一致する |

receipt 側の digest は**書き換えていない**。promotion 時点の現物を証明するのが receipt の役割であり、
後から辻褄を合わせるとその意味が失われる。上表のとおり再検証されない値なので、
不一致は本節の記録で説明する。

## 仕様反映の受領書

最終レビュー実施時刻 2026-09-10T13:38:07Z、base コミット `462dd9d`。
変更差分を用途別に分け、仕様・設計への影響の有無と反映先を記録する。

| 変更群 | 仕様影響 | 反映先 / 判断理由 |
|---|---|---|
| `packages/core/src/{types,classify,total-cashflow}.ts`、`packages/api/src/routes/{classify,total-cashflow}.ts`、`packages/web/src/{api.ts,pages/Classify.tsx,pages/analysis/TotalCashflow.tsx}` | **あり** | `specs/spec-mf-business-classification.md`(新規)、`architecture/mf-business-*.md` 8件(新規)、`features/feat-mf-business-classification.md`(新規)、`tasks/feat-mf-business-classification/sys-mfbiz-p01..p13.md`、`docs/spec-v1.1.md`・`docs/data-schema.md`(P10)。いずれも `/dev-graph` の spec → decompose → plan → node の正規経路で生成・登録済み |
| `features/feat-total-cashflow.md`、`specs/spec-total-cashflow-*.md`、`architecture/total-cashflow-*.md`、`tasks/feat-total-cashflow/sys-tcf-p01.md` | **あり** | 旧記述にあった「MF 大項目で事業収入を判定する」前提を、新 spec が改訂する形へ書き換え。`related_nodes` に新 feature/spec を追加し、判定規則の正本を 1 本に寄せた |
| `system-spec/*`、`system-spec/archive/2026-09-10-.../` | **あり** | 前サイクルを archive し、本サイクルの確定章として再生成(利用者承認済みの方針)。`features/*.md` の `source_lineage` を archive 先へ張り替え済み |
| `scripts/seed-local.mjs`、`samples/sample-mf-2025.csv`、`samples/sample-mf-2026.csv` | **なし** | ローカル画面確認用の種データのみ。製品の判定式・API 応答形・集計規則を一切変えない。仕様の受入は匿名化 fixture の契約テストで固定されており、seed は入力に含まれない。運用手順としては `runbook.md` の「ローカルで画面を確認する」へ記載した。全 task の `resource_scope` 外であり、**範囲逸脱として本受領書に記録する** |
| `scripts/hooks/guard-real-data.sh`、`scripts/hooks/guard-real-data.test.sh`、`package.json` | **なし** | リポジトリ横断の品質ゲート(`security:content`)の追加であり、MF 事業判定の挙動と独立。全 task の `resource_scope` 外であり、**範囲逸脱として本受領書に記録する**。導入理由は本書「プロモーション後の匿名化」節のとおり |
| `.dev-graph/plans/*/plan-findings.json`(他 feature 分 6件)、`.dev-graph/render/index.html` | **なし** | 個人ホームの絶対パスを `${LOCAL_HOME}` へ置換しただけで、判定内容・digest 対象の意味は不変 |
| 既存テストファイル群(`packages/{core,api,web}` の `*.test.*`) | **なし** | `bySource` に `中項目` が加わったことへの追随。契約の正本は spec の受入条件であり、テストはその写し |
| `docs/product/backlog.md` | **なし** | 残課題の行き先。`close-out.md`「残課題の行き先」節が指定した置き場所 |

### 範囲逸脱の扱い

`scripts/` 配下の 2 群は、どの task の `resource_scope` にも含まれない。
`resource_scope` は promotion 済みで digest 固定のため後追いで書き換えず、
P13 の責務(完了条件・証跡・残リスクの集約)に従い本書へ記録する形をとった。
どちらも製品挙動を変えないため、spec/architecture の再プロモーションは行わない。

### 品質ゲートの再実行結果

| ゲート | 結果 |
|---|---|
| `pnpm typecheck` | 3 パッケージすべて Done |
| `pnpm test` | core 554 passed / 6 skipped、api 485 passed、web 429 passed、aux 41 pass / 0 fail |
| `pnpm lint` | biome 335 files・skills 同期・用語 59語・レポートCSS・graph lineage 29ノード・`security:content` すべて OK |

## 残課題の行き先

本 feature 外の改善は `docs/product/backlog.md` に一件一行で記録する。実行時 feature flag と除外リストは、必要性が確認された場合だけ別 feature とする。

