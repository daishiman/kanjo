# FINAL-UI 19 使い方画面 作り直し — 実装要件

- Feature: `feat-guide-screen`
- Package: `feature-package/feat-guide-screen`
- Handoff target: `task-graph`
- Snapshot: `sha256:88f509652793e9015d4022278c6d537fea241faace4bb7140fbe03902daafb0a`(`.dev-graph/state/graph.json` の bytes、graph revision 3)
- System plan: `sha256:9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62`
- Readiness: **PASS**(missing sections 0、3 gate が同一 snapshot)

契約の正本は `specs/spec-guide-screen.md` である。本書は要件と system task の対応、および requirements 段階で確定した決定だけを持つ。実装コードも task spec も生成しない。13 task の内容は `.dev-graph/plans/feature-package-feat-guide-screen/task-specs/` を正本とし、本書はそれを書き換えない(published digest を保つ)。

## 目的

利用者が月次クローズの途中で画面の数字に迷ったとき、『この数字を、どう読み・どこへ戻ればよいですか？』の答えを 1 画面で得られるようにする。今見ている数字が何を含み何を除くか、どの期間のどこから来た値かを選択期間の実データで示し、該当する元画面へ 1 クリックで戻れるようにする。現行の `/guide` は `pages/Guide.tsx`(185 行)の 1 ファイルで、`/summary` と `/diagnosis` を期間なしで読んでいる。

## 到達状態

`/guide` が 19-guide.png の全構成要素をトークンと共通部品で描画し、画面の数値と文言が core の `guide-screen` から出る(API は `{ screen }` に写すだけ、web は描くだけ)。信頼度は 高 80 以上 / 中 50〜79 / 低 49 以下 の段階＋% で出る。要確認の閾値 80 による自動判定と防衛ラインの値は変えない。フッタ 1 文目は『取込データは外部送信しません』とし、AI 送信の補足を 3 か所に置く。`/api/guide` は利用者ごとに分離し、DB の表・列を 1 つも足さず、verify:full が緑である状態を目指す。

## requirements 段階の決定

### RD-GD-001 信頼度の段階＋% を出す画面の列挙(basis = user、2026-09-23)

spec の未決事項『信頼度を出す画面の列挙』(goal-spec OI-1・OI-2、qa-guide-decision-008 の後続)は、2026-09-23 の利用者回答で決着した。対象は**仕分けの信頼度(0〜100 の %)だけ**とする。

| # | 画面 | ファイルと行 (2026-09-23 現物) | 現行の表示 | 変更後 |
|---|---|---|---|---|
| 1 | 概況 要件テーブル | `packages/web/src/pages/Overview.tsx:209-210`(`confidenceClass`)、`:369-371`(描画) | `N%` と 80 以上 good / 60 以上 warning / それ未満 danger の色 | core の段階関数の結果で『段階＋%』を出す。色の境界も段階(高 80 以上 / 中 50〜79 / 低 49 以下)に揃え、web の 80/60 比較を消す |
| 2 | 概況の確認待ち | `packages/web/src/components/OverviewReviewQueue.tsx:141-157` | `N%` とメーター | 『段階＋%』とメーター |
| 3 | 明細仕分けの表 | `packages/web/src/pages/classify/TransactionTable.tsx:142-144`(`confidenceText`、定義は `pages/classify/view-model.ts:21`) | `N%`(要確認は文言を併記) | 『段階＋%』(要確認の文言は維持) |
| 4 | 明細仕分けの編集欄 | `packages/web/src/pages/classify/EditPanel.tsx:258`(見出し『信頼度の根拠』。本文は :259 の `row.basisText`) | 根拠の文だけで、% は出ていない(ファイル内に confidence の参照は 0 件) | 『信頼度の根拠』の欄に、同じ `ClassifyRow.confidence` から作った『段階＋%』を**新たに加える**(根拠の文は残す)。置き換えではなく追加であることを P02 の設計で明記する |

**対象外**(変更しない):

- 診断 `pages/analysis/diagnosis/ResultCards.tsx:33`・`DetailPanel.tsx:90,111`、AI `pages/ai/AiContextAnalysis.tsx:148` の `CONFIDENCE_LABEL`(高/中/低)。これらは見積りの確からしさを表す別の概念で、% を持たない。現行のまま据え置く。
- 取引先の記憶 `VendorMemory.tsx:227`(0〜1 の小数)。
- `REVIEW_CONFIDENCE_THRESHOLD = 80`(`packages/core/src/classify-status.ts:43`)と由来ごとの信頼度の規則。

task への影響(published task-spec は書き換えず、requirements 層の決定として引き渡す):

- `SYS-GUIDE-P01`: 列挙は RD-GD-001 で確定済みである。P01 の Acceptance のうち『OI-1 の確定』と『80/60 色境界の扱い』は、`docs/guide-screen/design-decisions.md` へ RD-GD-001 を利用者確認済み(basis=user)として転記し、上表の行番号を着手時の現物で確かめ直すこと(ベースラインの確認)で満たす。改めて決め直さない。
- `SYS-GUIDE-P05`: write scope(resource_scope 26 件)には上表 4 ファイルと `pages/classify/view-model.ts` がすべて入っており、対象外のファイル(`ResultCards.tsx`・`DetailPanel.tsx`・`AiContextAnalysis.tsx`・`VendorMemory.tsx`)は 1 件も入っていないことを確かめた。P05 は対象外のファイルを書き換えない。
- `SYS-GUIDE-P04`: `guide-screen.dom.test.tsx` の『段階＋%』の検査対象は上表の 4 か所とする。
- `SYS-GUIDE-P08`: 読取専用の監査で、web に 80/60 の比較が 0 件になったことと、対象外の 3 画面が変わっていないことを確かめる。

これにより spec から持ち越した medium 指摘『信頼度を出す画面の列挙が未確定』(completeness-findings の foundation_trace、plan-findings の open_items_readiness・write_scope_breadth)は解消した。

## 実装要件

### REQ-GD-001 ガイドの内容を core の guide-screen 1 か所で導出する

`packages/core/src/guide-screen.ts` を新設し、次の要素を純関数で導く。節 7 つ(月次の流れ / 総収支 / 照合 / 仕分け / 予算 / データ出典 / 用語と目安)、4 ステップと行き先、よくある疑問 5 行、期間の表 4 行、このページの数値 4 項目、関連ページ 5 件、ガイド内検索である。`guide-sections.ts` の現在値の合成も core へ移す。web と api にこれらの導出が残らないことを grep で確かめ、構成は `guide-screen.test.ts` の `toEqual` で固定する。

- 根拠: S3 / G3 / FR-2〜FR-14 / I2 / qa-guide-decision-001 / qa-guide-backend-web-002
- 担当 task: `SYS-GUIDE-P02`、`SYS-GUIDE-P04`、`SYS-GUIDE-P05`、`SYS-GUIDE-P07`、`SYS-GUIDE-P08`
- Source: `specs/spec-guide-screen.md`、`features/feat-guide-screen.md`

### REQ-GD-002 GET /api/guide の新設と利用者分離

`GET /api/guide` は authGuard と `mustChangePasswordFence` の内側に置く。`loadScoped` の 1 回の `loadDataset` で読み、core の guide-screen に渡して `{ screen }` で返す。読み取りだけで、防衛ラインの値は計算しない。壊れた期間指定は全期間に倒す。contract test では次を固定する。期間あり・なし・壊れた期間の 3 通り、totals が総収支画面と一致すること、振替を除くこと、取込 0 件で 0 と null を返すこと、他の利用者のデータを 0 件返すこと、未認証で 401、一時パスワードで 403 になること。

- 根拠: S4 / G4 / API 契約 / I3 / O5 / qa-guide-auth-web-001 / qa-guide-backend-web-004
- 担当 task: `SYS-GUIDE-P02`、`SYS-GUIDE-P03`、`SYS-GUIDE-P04`、`SYS-GUIDE-P05`、`SYS-GUIDE-P07`
- Source: `specs/spec-guide-screen.md`、`features/feat-guide-screen.md`

### REQ-GD-003 /guide の全構成要素の描画と URL の保持

`pages/Guide.tsx` を `pages/guide/` 配下へ分割し、旧ファイルは再輸出 1 行にする。19-guide.png の全構成要素、読込・空・失敗・検索 0 件の各状態をトークンと共通部品で描く。総収支の 3 枚は選択期間の実データ(振替除外)を使う。選択トピックと検索語は URL の `topic` / `q` に保ち、再読込と共有で同じ表示に戻す。DOM テストで構成要素と URL の復元を固定し、直書き色は 0 件にする。

- 根拠: S1 / G1 / FR-1〜FR-17 / I1 / qa-guide-frontend-web-002 / qa-guide-ui-ux-web-002・003
- 担当 task: `SYS-GUIDE-P02`、`SYS-GUIDE-P04`、`SYS-GUIDE-P05`、`SYS-GUIDE-P07`、`SYS-GUIDE-P09`
- Source: `specs/spec-guide-screen.md`、`features/feat-guide-screen.md`

### REQ-GD-004 信頼度の段階関数と『段階＋%』表示

core に段階関数を 1 つだけ置く(80 以上が高、50〜79 が中、49 以下が低。範囲外と非数は『—』)。RD-GD-001 の 4 か所は段階を文字で示す『高 92%』の形で描く。49/50/79/80 の境界と、`REVIEW_CONFIDENCE_THRESHOLD` と高の下限がともに 80 であることを core 単体テストで固定する。要確認の自動判定の結果は変えない。

- 根拠: S2 / G2 / FR-16 / I4 / qa-guide-decision-005・008 / RD-GD-001
- 担当 task: `SYS-GUIDE-P01`、`SYS-GUIDE-P02`、`SYS-GUIDE-P04`、`SYS-GUIDE-P05`、`SYS-GUIDE-P07`、`SYS-GUIDE-P08`
- Source: `specs/spec-guide-screen.md`、`features/feat-guide-screen.md`

### REQ-GD-005 防衛ラインの算出定数と説明文の一致

`analysis.ts:1095` に直書きされた『直近 3 か月』(`pMonths.slice(-3)`)を core の名前付き定数に置き換え、値は変えない。使い方画面(よくある疑問・用語と目安)と用語集(`glossary.ts:45-49`)の説明文はその定数から組む。`defenseLine` の既存テストは値を変えずに通し、定数を変えると説明文も変わることをテストで固定する。`check-glossary` を通る書き方にする(`scripts/check-glossary.mjs` は scope 外で書き換えない)。

- 根拠: S2 / G2 / I5 / qa-guide-decision-009 / R-1
- 担当 task: `SYS-GUIDE-P02`、`SYS-GUIDE-P04`、`SYS-GUIDE-P05`、`SYS-GUIDE-P07`、`SYS-GUIDE-P08`
- Source: `specs/spec-guide-screen.md`、`features/feat-guide-screen.md`

### REQ-GD-006 共通シェルのフッタ文言と AI 送信の補足 3 か所

ヘッダは『防衛ライン』のままとする。フッタ 1 文目を『取込データは外部送信しません』にし、AI 送信の補足をフッタの title・プライバシー欄・使い方画面のデータ出典の 3 か所に置く。`common-shell.dom.test.tsx:182-185` の期待は P04 で新しい文言へ書き換え、P05 で緑にする。ヘッダの期待(:154)は変えない。

- 根拠: S4 / G4 / FR-15 / I6 / qa-guide-decision-010・011 / R-2
- 担当 task: `SYS-GUIDE-P02`、`SYS-GUIDE-P03`、`SYS-GUIDE-P04`、`SYS-GUIDE-P05`、`SYS-GUIDE-P07`
- Source: `specs/spec-guide-screen.md`、`features/feat-guide-screen.md`

### REQ-GD-007 shiftedPeriod の core への移設

`shiftedPeriod` を `pages/statements/view-model.ts:121` から `packages/core/src/period.ts` へ移し、決算書と使い方画面で共有する。決算書の挙動は変えない。既存テスト(`statements-view-model.test.ts:93-100`)は core の `period-shift.test.ts` へ移すか、再輸出で通す。全期間と範囲の端では null を返す。

- 根拠: FR-1 / I7 / R-3
- 担当 task: `SYS-GUIDE-P02`、`SYS-GUIDE-P04`、`SYS-GUIDE-P05`、`SYS-GUIDE-P06`
- Source: `specs/spec-guide-screen.md`、`features/feat-guide-screen.md`

### REQ-GD-008 非機能制約・非退行・描画検査・運用文書と配信

満たす制約は次のとおり。

- 初期 JS 予算 110KiB を超えない。
- CSP(default-src 'self'・connect-src 'self')を変えない。
- 状態を色だけで伝えない。
- 検索語はサーバへ送らない。
- DB の表・列・migration を足さない(`EXPECTED_D1_MIGRATION` は据え置き)。

`check:guide-screen` を `packages/web/package.json` に足し、ルートの `verify:full` に組み込む。`pnpm lint`(check-glossary を含む)・`typecheck`・`test`・`verify:full` を exit 0 にする。docs は `docs/guide-screen/` だけに書き、要件ベースラインから単一 PR の配信までを証跡で辿れるようにする。

- 根拠: 非機能要件 / O4 / C2 / R-4 / qa-guide-maintenance-ops-web-001 / qa-guide-database-web-002
- 担当 task: `SYS-GUIDE-P01`、`SYS-GUIDE-P05`、`SYS-GUIDE-P06`、`SYS-GUIDE-P08`、`SYS-GUIDE-P09`、`SYS-GUIDE-P11`、`SYS-GUIDE-P12`、`SYS-GUIDE-P13`
- Source: `specs/spec-guide-screen.md`、`features/feat-guide-screen.md`

## 着手前提と持ち越し事項

handoff を止める不足(missing sections)は 0 件である。次の事項は未決のまま持ち越し、各担当 task の着手時に確かめる。推定のまま confirmed にしない。

### plan の open_items(goal-spec.json)

| ID | 内容 | 状態 | 是正担当 |
|---|---|---|---|
| OI-1 | 信頼度を出す画面の列挙 | **決着(RD-GD-001、basis=user)**。P01 は転記と行番号の確認だけを行う | SYS-GUIDE-P01(転記) |
| OI-2 | 概況 `confidenceClass` の 80/60 色境界 | **決着(RD-GD-001、basis=user)**。段階の境界に揃える | SYS-GUIDE-P01(転記) / SYS-GUIDE-P05(実装) |
| R-1 | 『直近3か月』が 3 か所に直書き | 未決(unresolved_precondition) | SYS-GUIDE-P02(設計) / SYS-GUIDE-P05(実装) |
| R-2 | `common-shell.dom.test.tsx:182-185` の旧フッタ期待 | 未決 | SYS-GUIDE-P04(書換) / SYS-GUIDE-P05(緑化) |
| R-3 | `shiftedPeriod` の移設と呼出元 | 未決 | SYS-GUIDE-P02(設計) / SYS-GUIDE-P05(実装) |
| R-4 | `check:guide-screen` の追加と verify:full への組み込み | 未決 | SYS-GUIDE-P05 |
| R-5 | arch-guide-maintenance-ops の resource_scope に feature 外の `docs/cash-screen`・`scripts/check-glossary.mjs` が、arch-guide-database に `migrations` が入っている | 未決。task はこれらを書き換えない。修正は architecture の再 import で行う | SYS-GUIDE-P12(記録) |
| Q-1 | `/api/guide` の応答の細部と `loadCloseStatus` の items の取り方 | agent 推定・利用者未確認 | SYS-GUIDE-P02 |
| Q-2 | トピック id の綴り、4 ステップと下部固定バーの行き先、目次の切替幅 1024px、ステッパーの塗り方 | agent 推定・利用者未確認 | SYS-GUIDE-P05 |
| Q-3 | 検索の対象と正規化、0 件の文言、URL の既定と `q` の 100 字切り詰め、データ 0 件の表示、期間の定義文 | agent 推定・利用者未確認 | SYS-GUIDE-P05 |
| Q-4 | AI 送信の補足の文言、段階関数と定数の名前、範囲外の扱い、閾値 80 と高の下限を共有するか | agent 推定・利用者未確認 | SYS-GUIDE-P02 |
| Q-5 | DOM テストのファイル名 `guide-screen.dom.test.tsx` | agent 推定・利用者未確認 | SYS-GUIDE-P04 |

### system-spec の完了評価から持ち越した指摘(system-spec/completeness-findings.json)

| 重大度 | 内容 | 是正担当 |
|---|---|---|
| medium | 承認 appr-foundation-guide-002・003 で提示した文面の逐語記録(presented-options)が無い。承認した文面が現在の上位概念と一致するかを記録から確かめられない | SYS-GUIDE-P01(着手時に利用者へ現在の文言で再承認を求めるか、提示文面の写しを補うかを確認し、結果を docs に記す。system-spec 本体の補記は elicit/C01) |
| medium | 008〜011 の provenance(1 問ずつ問い直した)と presented-options-009(1 回の提示で 4 問を並べた)の表現が食い違う。結論は変わらない | SYS-GUIDE-P01(docs に事実の提示方法として記す。system-spec の補記は elicit/C01) |
| low | 覆された qa-guide-decision-002/003/004/006 と旧セル根拠に `superseded_by` が無く、追跡が一方向である | SYS-GUIDE-P12(docs 同期で後継の決定への対応表を記録。system-spec の補記は elicit/C01) |
| low | qa-guide-backend-web-002 は basis=user-decision だが、定数化などの具体は agent が導いた | SYS-GUIDE-P02(設計決定記録で『decision-009 から agent が導いた具体』と明記) |
| low | tanstack-query・hono・owasp-asvs の official_host が github.com で、org が正規かは機械的に判定できない | SYS-GUIDE-P12(参照一覧に公式サイト URL を併記するかを記録。system-spec の補記は doc-fetch/C02) |

### requirements 段階で見つけた指摘

| ID | 重大度 | 内容 | 是正担当 |
|---|---|---|---|
| RQ-F1 | medium | 既存の DOM テストが信頼度の旧表示『N%』を字面で固定している。該当は `pages/classify/classify.dom.test.tsx:257`(`['92%', '68%要確認', '—', '92%']` を textContent で完全一致)と `:399-400`(`getByText('92%')`・`'68%'`)、`overview-review-queue.dom.test.tsx:316,531,613` である。この 2 ファイルは P04(12 件)と P05(26 件)のどちらの resource_scope にも入っていない。RD-GD-001 の『段階＋%』を実装すると、少なくとも classify の :257 は落ちる | SYS-GUIDE-P02(表示の DOM 構造と、これら既存テストの扱いを設計で決める) / SYS-GUIDE-P04(書き換えが要る場合は、着手前に利用者の承認を得て write scope を広げる。黙って scope 外を書き換えない) |
| RQ-F3 | 情報 | `dev-graph-registration-receipt.json` の `graph_digest_after`(`sha256:20cff165…`)は、本書の snapshot(`88f50965…`、bytes の sha256)と値が違う。検算すると、receipt 側は canonical JSON(sort_keys・区切りの空白なし・ensure_ascii=False)の sha256 で、現行 graph から計算した値と一致する。graph は登録後に変わっていない(mtime も registered_at と同時刻)。要するに方式が違うだけで、drift ではない | 対応不要(handoff に `graph_canonical_digest` を併記) |
| RQ-F2 | low | R-5 と同じ drift が graph にも残っている。arch-guide-maintenance-ops の resource_scope に `docs/cash-screen`・`scripts/check-glossary.mjs` が、arch-guide-database に `migrations` が入っている。task の resource_scope には入っていないため、並行実行の lease には影響しない | architecture 再 import(dev-graph system-spec)/ SYS-GUIDE-P12(記録) |

## 実行グラフ

13 nodes の P01→P13 直列(依存は直前の 1 件だけ、root は P01)。状態・資源・lineage は各 task の frontmatter(`tasks/feat-guide-screen/sys-guide-pNN.md`)を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-GUIDE-P01 | 要件ベースライン確定と信頼度を出す画面の列挙の確定(RD-GD-001 の転記と行番号の確認) | — |
| SYS-GUIDE-P02 | guide-screen・段階関数・防衛ライン算出定数・shiftedPeriod 移設・GET /api/guide・フッタ文言の設計決定記録 | SYS-GUIDE-P01 |
| SYS-GUIDE-P03 | core 1 か所導出・API 写像・利用者分離・フッタ文言の独立設計レビュー | SYS-GUIDE-P02 |
| SYS-GUIDE-P04 | core 不変条件・/api/guide 契約・DOM・共通シェル文言の失敗テスト先行作成 | SYS-GUIDE-P03 |
| SYS-GUIDE-P05 | guide-screen.ts・段階表示・算出定数・GET /api/guide・/guide 画面・check:guide-screen の実装 | SYS-GUIDE-P04 |
| SYS-GUIDE-P06 | 全テスト・型検査・lint の実行記録 | SYS-GUIDE-P05 |
| SYS-GUIDE-P07 | 受入 S1〜S4 の検証 | SYS-GUIDE-P06 |
| SYS-GUIDE-P08 | 旧 Guide.tsx・guide-sections.ts の参照と直書き定数の残存の読取専用監査 | SYS-GUIDE-P07 |
| SYS-GUIDE-P09 | アクセシビリティ・検索語の扱い・外部送信・JS 予算の保証確認 | SYS-GUIDE-P08 |
| SYS-GUIDE-P10 | 独立最終レビュー | SYS-GUIDE-P09 |
| SYS-GUIDE-P11 | 再現可能な証跡索引の作成 | SYS-GUIDE-P10 |
| SYS-GUIDE-P12 | 信頼度の段階・防衛ラインの説明・/api/guide・未決事項の docs 最終同期 | SYS-GUIDE-P11 |
| SYS-GUIDE-P13 | 単一 PR での配信とクローズアウト | SYS-GUIDE-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0(graph revision 3) |
| C02 saved state | feature と 13 task がいずれも confirmed / pass / complete。registration は expected 13 に対し applied 13。13 task の source_digest は validated_digest と一致 |
| validate-system-plan | pass、P01..P13、`sha256:9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62`、violations 0 |

1 周目の開始時は task artifact(md)13 件が未実体化で、C11 が artifact_missing 13 件により blocked だった。graph の task node の値と task-spec 本文から、18設定(feat-settings-screen)と同じ書式で `tasks/feat-guide-screen/sys-guide-p01..p13.md` を投影して解消した。投影器は 18設定の 13 件をバイト一致で再現できることを検算済みである(`beads_linkage` は後の sync で付いた値なので null として比較)。graph.json は書き換えていない(revision 3 のまま、digest も不変)。
