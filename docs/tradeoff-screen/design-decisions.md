# トレードオフ画面の設計判断

トレードオフ画面(`/tradeoff`)を作り直したときの判断理由と差分の記録。規則・契約・受入条件の正本は [`specs/spec-tradeoff-screen.md`](../../specs/spec-tradeoff-screen.md)、実行結果の正本は [`evidence.md`](evidence.md)。`architecture/tradeoff-*.md` と task / feature は生成投影である。

この文書は spec や evidence を置き換えず、それらの全文を繰り返さない。実装上の選択肢、選んだ理由、レビューで生じた差分だけを残す。

## 1. 受入の分解方針(P01)

feature の複合的な受入文は S1-a〜S6-c の独立判定へ分ける方針とした。受入条件そのものは spec「テストと受入条件」、日時・コマンド・判定は evidence §1〜§2を正本とし、ここでは重複掲載しない。「一部だけ満たした」を全体 PASS と数えないことがこの判断の要点である。

## 2. 持ち越し事項の担当と結論

| ID | 内容 | 担当 | 結論 |
|---|---|---|---|
| OI-01 | agent 推定・利用者未確認の値 | P01 | §3 の表に一覧化した。どれも実装を止める値ではないので、既定値で作り、利用者の確認を待つ |
| OI-02 | 候補キーの可逆性と長さ上限 | P03 | §4 の versioned JSON tuple・上限 300 字 |
| OI-03 | `tradeoff-review.dom.test.tsx` の書き換え | P04 | 消さずに『突合の表示が無いこと』を確かめる形へ書き換える。突合の数字の契約は `packages/core/test/tradeoff-review-contract.test.ts` が持ち続ける |
| OI-04 | migration 番号 0050 | P05 | 2026-09-22 に `origin/main`(f0e5a3b)を fetch した時点で最新は `0049_ai_report_invariants.sql`。0050 のまま使う予定だった。**その後 `main` に予算画面 (#67、0ed2d8c) が入り `0050_budget_plans.sql` を使ったため、main 取り込み時に 0051 へ繰り上げた** (§8「main の取り込み」)。並行ブランチが先に番号を使うと git の衝突には出ないので、merge の前(P13)にもう一度 fetch して番号を確かめる |

## 3. agent 推定の値と確認の担当

spec が **agent 推定・利用者未確認** と注記した値。実装は既定値で進め、利用者の確認で変わったら `docs/spec-v1.1.md` FR-09 の表・core の実装・テストの期待値を同じ変更で直す。確認の担当は利用者で、確認の場は PR のレビューとする。実装を止める値は無い。

| 値 | 既定 | 反映先 |
|---|---|---|
| 候補表の初期件数と『すべて表示』 | 月額降順の 10 件 | web `CandidateTable` |
| 文言(差額・nodata・空・422・復元時に外したキー) | spec の文のとおり | web、DOM テスト |
| 単発 / 毎月と開始月の既定 | 毎月、今日の翌月 | web `view-model` |
| 推移の初月 0 | 最終月が正なら増加、0 なら横ばい | core `tradeoffTrend` |
| 同額の並び | 候補キーの辞書順(コード単位の比較) | core `buildTradeoffCandidates` |
| 組み合わせの列挙範囲と順位 | 月額上位 12 件から 2〜4 件、5 段の順位、上位 4 件 | core `tradeoffCombos` |
| 充足度の丸め | 切り捨て | core `tradeoffCombos` |
| しやすさ・リスクの写し方 | §5 の表 | core、FR-09 |
| 推奨の理由の文 | 『N 件で年間 X 円を削減、必要度 高 を k 件含む』 | core |
| 関連ページの選び方 | 改善案の並び順で最初に当たったものの `nextAction.to` | core |
| 新表の形 | spec のデータモデルどおり | migration 0051 |
| 文字数と金額の上限 | 支出名 100、メモ 500、金額 1〜1 億の整数、keys 1〜50 件 | api の zod |
| PUT の経路と空メモ | `PUT /api/tradeoff/candidates/:key`、空メモは null | api |
| GET から `budgets`・`plans`・`review` を外す | 外す(`tradeoffReview` 関数と core テストは残す) | api |

## 4. 候補キー(P03、OI-02)

- 形: `tradeoffCandidateKey(account_norm, partner)` が `v1:${JSON.stringify([account_norm, partner])}` を返す。取引先が空でも tuple の第 2 要素は空文字として保持し、表示の『取引先なし』はキーに入れない。
- 理由: 区切り文字の出現位置に依存せず科目と取引先を可逆に分離でき、先頭の `v1:` で将来の形式変更も明示できる。`parseTradeoffCandidateKey(key)` は有効なキーを `{ account, partner }`、不正形式を `null` にする。URL には `encodeURIComponent` で載せる。
- 互換性: migration 0051 は未公開・未適用なので、旧 `account|partner` 形式との読み書き互換や移行分岐は持たない。
- 上限: 300 字(復号後の文字列長)。超えた候補は作らない(core が落とす)。受け取った側は 300 字超を 400 にする。
- 照合: POST の `keys` と PUT の `:key` は、その利用者・その期間の現在の候補のキーと完全一致で比べる。正規化はしない(候補を作る側が `account_norm` を使うので、同じ入力からは同じ文字列が出る)。定数は `TRADEOFF_CANDIDATE_KEY_MAX` とし、入力上限は `TRADEOFF_TITLE_MAX` / `TRADEOFF_MEMO_MAX` / `TRADEOFF_AMOUNT_MAX` / `TRADEOFF_CANDIDATE_LIMIT` とともに core から export する。

## 5. しやすさ・リスクの写し方(P02)

組み合わせに含む候補の件数を N、必要度 低 の件数を L、高 の件数を H とする。順位はこの写し方ではなく件数そのもので付ける。

| 表示 | 条件 |
|---|---|
| しやすさ 易しい | L × 2 ≥ N(半分以上が低) |
| しやすさ 普通 | 1 ≤ L かつ L × 2 < N |
| しやすさ 難しい | L = 0 |
| リスク 低 | H = 0 |
| リスク 中 | H = 1 |
| リスク 高 | H ≥ 2 |

## 6. 型と経路の設計(P02)

### core の純関数(`packages/core/src/tradeoff-screen.ts`)

| 関数 | 入力 | 返り値 | 使う部品 |
|---|---|---|---|
| `tradeoffCandidateKey(account, partner)` | 科目・取引先 | 候補キー | api(照合)、core |
| `parseTradeoffCandidateKey(key)` | 候補キー | `{ account, partner }` / `null` | api(検証)、core の契約テスト |
| `tradeoffTrend(first, last)` | 窓の最初と最後の月の額 | `down` / `flat` / `up` | core |
| `tradeoffNeed(type, trend)` | `catProfile` の type と推移 | `low` / `mid` / `high` | core |
| `buildTradeoffCandidates(data, rows, options)` | 期間適用済みの Dataset・freee 経費の行・上書き・改善案 | `TradeoffScreenCandidate[]` | api GET / POST / PUT、web `CandidateTable` |
| `tradeoffSimulation(input, monthlies, monthlyMargin)` | 新しい支出・選んだ候補の月額・防衛ラインの月の余裕 | 年額・削減・差額・判定・余裕・試算後・維持 / 割れる | web `SimulationPanel` と `SelectionBar`、api POST |
| `tradeoffCombos(candidates, annualCost)` | 候補・新しい支出の年額 | 上位 4 件の組み合わせ | web `RecommendationTable` |
| `tradeoffDefenseMargin(defense)` | `defenseLine(data)` | `{ monthlyMargin, status }` | api GET |
| `isValidTradeoffCovered(value)` | 数値 | 0〜1e10 の整数か | api POST |

web と api は年額・差額の式を持たず、上の関数を呼ぶだけにする(S2-a)。

### 経路

| 経路 | 入力 | 応答 | 失敗 |
|---|---|---|---|
| `GET /api/tradeoff` | 期間 query | 200 `{ candidates, defense, latest }` | 400 / 401 |
| `POST /api/tradeoff` | 期間 query、body `{ title?, amount, recurring, startMonth, memo, keys }` | 201 `{ ok, id, plan }` | 400 / 401 / 413 / 422 `unknown_candidate` / 500 `invariant_violation` |
| `PUT /api/tradeoff/candidates/:key` | 期間 query、body `{ need, memo }` | 200 `{ ok, candidate }` | 400 / 401 / 413 / 422 `unknown_candidate` |

### DDL(migration 0051)

```sql
ALTER TABLE tradeoff_plans ADD COLUMN start_month TEXT;
ALTER TABLE tradeoff_plans ADD COLUMN memo TEXT;
CREATE TABLE tradeoff_candidate_notes (
  user_id TEXT NOT NULL,
  candidate_key TEXT NOT NULL,
  need TEXT,
  memo TEXT,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX tradeoff_candidate_notes_user_key ON tradeoff_candidate_notes (user_id, candidate_key);
```

`need` の値域(`low` / `mid` / `high` / NULL)は既存表の流儀に合わせて zod で守り、CHECK 制約は置かない。

### 部品と core の返り値

| 部品(`packages/web/src/pages/tradeoff/`) | 表示する値 |
|---|---|
| `TradeoffPage.tsx` | 全体の状態(読込・失敗・復元)、選択の保持 |
| `NewExpenseForm.tsx` | 入力だけ(計算しない) |
| `CandidateTable.tsx` | `TradeoffScreenCandidate` の各欄、上書きの PUT |
| `RecommendationTable.tsx` | `tradeoffCombos` の返り値 |
| `SimulationPanel.tsx` | `tradeoffSimulation` の返り値 |
| `CalcExamples.tsx` | `tradeoffSimulation` を固定入力で呼んだ値 |
| `SelectionBar.tsx` | `tradeoffSimulation` の返り値(右パネルと同じオブジェクト) |

## 7. 設計レビューの指摘と反映(P03)

| 観点 | 指摘 | 反映 |
|---|---|---|
| クライアント値の信用 | POST の本文に `covered`・`verdict`・`selected.value` が残ると、画面の計算値がそのまま保存される | zod の形から外し、サーバが `buildTradeoffCandidates` と `tradeoffSimulation` で作り直した値だけを保存する。未知の欄は zod が落とす |
| 422 の条件 | 他の利用者のキーや期間外のキーの扱い | その利用者・その期間の現在の候補に 1 つでも無ければ 422、行を増やさない |
| 不変条件 | `covered` が負や小数・巨大値で保存される経路 | 保存の直前に `isValidTradeoffCovered` を確かめ、違反は 500 で保存しない |
| 候補の二重定義 | 候補の作り方を api と web の両方に書くと数字がずれる | core の `buildTradeoffCandidates` だけで作り、web は受け取った候補を表示・選択するだけ |
| 必要度の閾値の複製 | cv の閾値を写すと `catProfile` とずれる | `catProfile(data, account_norm).type` をそのまま使う |
| 既存数字の保全 | `tradeoffCandidates`・`defenseLine`・`tradeoffReview` を触ると他画面の数字が変わる | どれも変えない。`claimPart` は export を足すだけ |
| ログの秘匿 | 支出名・メモ・取引先名がエラーログに出る | 3 経路ともログを書き足さない。既存のエラーハンドラは code だけを残す |

## 8. レビュー起点の判断差分(P06〜P10、P13)

日時・コマンド・件数・判定は [`evidence.md`](evidence.md) だけに置く。本節は検証中に選択肢が変わった理由と、正本へ反映した差分だけを残す。evidence E1 は当時の作業ツリーに対する記録であり、その後の変更や公開状態を保証しない。

### P10 独立レビューと対処

独立した最終レビュー(コードを読むだけで、実行はしない)の判定は「条件付きで配信可」。高の指摘は 0 件。

| 重さ | 指摘 | 対処 |
|---|---|---|
| 中 | `latest` と両方 null の削除のテストが他の利用者の行を用意していない。`userId` の絞り込みを消しても緑のまま | 他の利用者の `tradeoff_plans`(id を大きくする)と上書きを先に入れ、`latest` に出ないこと・削除の後も残ることを確かめる形に直した。絞り込みを一時的に消すと 2 件とも落ち、戻すと緑になることを確かめた(変異検査。戻したあと `cmp` で元のファイルと一致) |
| 中 | 充足度の唯一の値が 120% で割り切れ、`Math.round` や `Math.ceil` に変えても通る | 割り切れない例(1,080,000 ÷ 640,000 = 168.75% → 168)を足した |
| 低 | `selected` に `label` を保存していない(spec の API 契約は `[{ key, label, value }]`) | spec に合わせて `label` を保存するようにした。結合テストの `SAVED` が、保存された `selected` の key・label・value を丸ごと突き合わせる |
| 低 | 413 と、`keys` の重複で 400 になるテストが無い | `keys` の重複は「同じ候補キーを 2 回含む keys は 400 で 1 行も増やさない」を追加。後続の E4 で POST / PUT の 64 KiB 超も追加し、413 と DB 副作用なしを固定した |
| 低 | 月額を丸めてから 1,000 円と比べる。1,000 + 1,000 + 999(平均 999.67 円)が候補に残る | 現行実装を契約として採用し、spec に「円単位へ四捨五入してから閾値と比較」と境界例を明記した |

レビューが「仕様どおりだが気になる」とした次の 2 点は、後続の Web 改善で非破壊の失敗表示へ統一した。

- メモは PUT 成功時だけ編集欄を閉じ、失敗時は入力値と再試行ボタンを残す。
- 取得済みデータがある背景再取得の失敗では画面をアンマウントせず、入力・選択・試算結果を残してインラインの警告を出す。初回取得に失敗してデータが無い場合だけ全画面の `PageState` を使う。

候補キーの衝突指摘は、§4 の versioned JSON tuple と可逆 parser へ変更して解消した。0051 は未公開・未適用のため、旧形式の互換分岐は追加していない。

同じ P10 の中で、`analytics-period.test.ts` の字面の契約(経路は `loadScoped` が返した期間適用後の Dataset を使う)に合うよう、候補の読み出しを `loadTradeoffCandidates(c, data)` に寄せた。

### 範囲外の変更

task の `write_scope` に無いファイルを、次の理由で変えた。

| ファイル | 変更 | 理由 |
|---|---|---|
| `packages/web/src/glossary.ts` | `budgetOver`・`unexplained` の 2 語を削除し、ガイドの「画面が出す判断」から外した | 旧トレードオフ画面だけが使っていた語で、作り直しで画面から消えた。`check-glossary` は画面に出ない語を辞書に残すことを禁じている |
| `packages/web/src/guide-sections.ts` | 上の 2 語の現在値の行を削除 | `GUIDE_CURRENT` は `Record<TermId, …>` なので、辞書から消した語は型検査で落ちる |
| `scripts/check-glossary.mjs` | ページヘッダーの `task` / `taskDetail` に別名が出る語も「使用」と数える | `subsDup`・`subsSpike` は `PageHeader` の `linkTerms` 経由で実際にホバーが出るのに、検査が字面の `<Term>` しか見ていなかった。語を消すか検査を実態に合わせるかを利用者に確かめ、「検査を実態に合わせる」の回答を得た |
| `packages/web/src/routeMetadata.ts` の tradeoff の `taskDetail` | 旧画面の文(予算超過・重複契約疑い…)を新画面の文へ | 旧画面の説明のまま残っていた。書き換えで用語リンクが 1 件減り、`route-task-detail.test` の下限 45 を割ったので「年換算」を含む文にした |
| `.dev-graph/plans/feature-package-feat-tradeoff-screen/implementation-readiness.json`、`plan-findings.json` | 絶対パスを `${CLAUDE_PLUGIN_CACHE}/…` と `.` に置き換えた | `security:content` が公開文書に書かれたホームディレクトリの絶対パスを拒否する(例示の文字列でも一致する)。AI 分析画面の同じファイルが前例。digest を固定している参照は無い |

### P13 配信

commit・push・draft PR の作成までを行う。merge と本番の Migrate / Deploy は行わない。merge の前に `origin/main` をもう一度 fetch し、0051 がまだ空いていることを確かめる(OI-04)。

### main の取り込み(P13 準備)

`main`(0ed2d8c、予算画面 #67)を `devgraph/feat-tradeoff-screen` へマージしたときの判断。

| 衝突 | 解決 | 理由 |
|---|---|---|
| migration 番号 0050 | こちらを `0051_tradeoff_notes.sql` へ `git mv`。`EXPECTED_D1_MIGRATION`・移行テスト名・`specs/`・`architecture/tradeoff-*.md`・`tasks/`・`docs/` を 0051 へ | 先に main に入った番号を優先する。`system-spec/` の章と `.dev-graph/plans/**`・`features/*` は digest 追跡・凍結の対象なので予定番号 0050 のまま据え置く(本文自身が「予定番号」と断っている) |
| `system-spec/` 直下(両方が現サイクルとして置き換え) | 直下はトレードオフのまま。予算サイクルの 14 ファイルを `system-spec/archive/2026-09-22-budget-screen/` へ退避し、`arch-budget-*` 8 件の `source_path` を付け替え(内容同一なので digest は据え置き) | 直下は「現行 1 世代」運用。AI 分析サイクルの退避と同じ手順 |
| `system-spec/archive/2026-09-22-ai-analysis-screen/README.md` | main 版を採用 | 退避内容は同一で、README の文面だけが違った |
| `architecture/graph.json` | node 単位の 3-way マージ(両側が同じ node を別々に変えた例は 0 件) | 150 node |
| `glossary.ts`・`guide-sections.ts` | main 版(`budgetSuggestion`・`defenseMargin` を追加、`variance`・`landing` を削除)から、こちらが消した `budgetOver`・`unexplained` を除く | 両方の意図を合わせる |
| `pages/Tradeoff.tsx` | こちら(入口の再 export だけ) | main の変更は旧画面の checkbox を共通 `SelectionCheckbox` へ置き換えたもので、旧画面ごと無くなった |
| `core/src/index.ts`・`docs/data-schema.md`・`docs/ui-decisions.md` | 両方を残す | 追加どうしの衝突 |
| `.dev-graph/render/index.html` | こちら | 現サイクルの task graph を描く生成物 |
