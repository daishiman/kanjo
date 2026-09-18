# elegant-review フェーズ3 実行計画（保全記録）

この文書は、elegant-review フェーズ2 の分析結果のうち **会話の中にしか存在せず、要約で一度失われた部分**を復元して固定したものである。出所は phase2-system（read-only 担当）の送信便 3/4 通目と 4/4 通目、および裁定反映便。**原文と再構成を明示的に分けて収録する。** 再構成部分は「原文ではない」と各所で断ってある。

保全先をここにしたのは、`eval-log/` が `.gitignore:62` で除外されており、追跡されないと次に読む者へ届かないためである。

---

## セクション2 — 因果ループ図（原文）

### R1（構成増殖ループ・自己強化）

```
(1) feature 名が決まる
      ↓
(2) 137 行の骨格が 21 本へ展開される（task 13 本の 60% が全本共通行、architecture 8 本の 27% が全本共通行）
      ↓
(3) 構造は同一・テキストは別物の文書が大量に生まれる
      ↓
(4) 起点が画像（design/FINAL-UI/images/06-matrix.png）であってコードではない
      ↓
(5) 既存資産（chart-aggregates.ts / ReportChart.tsx / trend.ts / catProfile）が視界に入らない
      ↓
(6) 新規実装 + 新語彙（total / home / teal / movers）が書かれる
      ↓
(7)「この文書を正本とする」と宣言される（specs:55-57、sys-matrix-p05.md:54）
      ↓
   (1) へ戻る（次の feature も同じ骨格から始まる）
```

**断つべき辺は (4)→(5)。** 最小介入点は `tasks/feat-expense-matrix/sys-matrix-p01.md:69` の完了条件「**転記**」を「**既存資産インベントリ**」へ変えることである。P01 の成果物が「仕様を docs へ転記したもの」である限り、既存コードは一度も読まれない。ここを「この feature の語彙（濃淡・偏り・scope・軸）に対応する既存実装を全て列挙し、無い場合は無いと書く」に変えると、(5) の辺が切れる。**そしてこの形は feature 名に依存しないので、テンプレ骨格の 136 行に組み込める — R1 の増幅器そのものを、解決策の運搬手段に転用できる。**

### R2（正本の増殖ループ）

各文書が「この文書を正本とする」と宣言する → 宣言どうしが衝突する → どちらが正本かを決める文書が新たに要る → その文書もまた正本を宣言する。

今サイクルの実例: `specs:55-57`（仕様が core / API の正本）/ `sys-matrix-p05.md:54`（task frontmatter が唯一の正本）/ `docs/matrix/aggregation-rules.md`（集計規則の正本になる予定）/ `chart-aggregates.ts:1-5`（純関数が計算の正本）。**4つの正本宣言が、互いを参照せずに並立している。**

### R3（負債の繰り越しループ）

未決事項（OI-01〜OI-04）を「P04 で確定する」と書く → P04 は実装先行ではなくテスト先行の task なので、確定の根拠は仕様に無い → P04 が自分で決める → その決定は仕様へ戻らない → 次サイクルの仕様が再び未決を持つ。

### R4（変換層の剥落ループ・今回新規）

**③④ の発見は、単発の bug ではなくループである。**

```
(a) 正本の純関数が派生値（分母・階級値）を計算する
      ↓
(b) 中間の変換層（ChartSeries への詰め替え）が、派生値を運ぶ枠を持たない
      ↓
(c) 派生値が落ちる
      ↓
(d) 描画側は描くために自分で作り直す
      ↓
(e) 作り直した値は元と一致しない（bucketize が四半期へ畳むケース）
      ↓
(f) しかし見た目は「それらしく」出るので、誰も気づかない
      ↓
(g) 正本宣言（chart-aggregates.ts:1-5）はそのまま残る
      ↓
   (a) へ戻る（次の派生値も同じ経路で落ちる）
```

**(f) が balancing loop を殺している。** 本来なら (e) で「値が違う」と検出されるはずだが、濃淡は**連続量で、正解が目視で分からない**ため、誤りが誤りとして現れない。これが「β を閉じる作業は α と違って壊れたことに気づけない」ことの構造的な説明である。

**断つべき辺は (b)→(c)。** M4b の制約（階級値を型で運ぶ / 描画側に分母を渡さない）は、まさにこの辺を型で塞ぐ提案である。**R4 は R1 と独立したループで、R1 を断っても R4 は残る。** 逆に R4 を型で塞げば、次に誰かが同じ形の派生値を足したときにコンパイルが止まる。

### B1 / B2（効いていない balancing loop）

- **B1（削除）**: 新しいものを作ったら古いものを消す。今サイクルでは P08 の `resource_scope` に削除対象が入っていないため**物理的に作動しない**（M5）。
- **B2（既存テスト）**: 壊したらテストが落ちる。heatmap を検証するテストが repo 全体でゼロのため、濃淡の経路では**作動しない**（M4）。

**R1 / R4 が回り、B1 / B2 が止まっている** — これが今サイクルの構造である。フェーズ3 の C-1（テスト先行）は B2 を起動する作業、B-4（scope 拡張）は B1 を起動する作業。**どちらも「改善」ではなくブレーキの修理**であり、ブレーキが直る前に C-3（移設）を走らせてはいけない。

> **規則1〜4（`features/feat-expense-matrix.md` の `resource_scope` 節）は、この R4 の計画層での現れである。** 規則だけを残して R4 を落とすと、なぜその規則なのかが辿れなくなる。

---

## セクション3 — KJ法による構造化（原文）

74 件の発見を親和性で束ねた結果、6 群に落ち着いた。群の順序は「原因 → 増幅器 → 表出面」。

### 群A — 既存資産の不可視化（根本）

`chart-aggregates.ts` の 23 成果物での言及ゼロ / `catProfile` の z が §5.1 と逐語同一なのに新規実装として書かれている / `trend.ts` の `ExpenseScope` を知らずに `total` / `home` を発明 / `teal` という存在しないトークンを参照 / `report-html.ts` が scope 外。

**群Aの性格**: どれも「調べれば分かったこと」で、調べる契機が工程に無い。R1 の (4)→(5)。

### 群B — 契約語彙の分裂

`total` vs `all` / `home` vs `personal` / `マトリクス` vs `マトリックス` / `movers` vs 偏りスコア / `Trade-off` vs `Trade-on` / `normalize` の方針に名前が無い。

**群Bの性格**: 同じものに2つの名前があるか、違うものに同じ名前がある。**後者のほうが危険**で、`mode=all`（実額）と `ExpenseScope='all'`（事業+家計）が実例。

### 群C — `resource_scope` の齟齬（実行の可否を決める）

仕様の `resource_scope` がディレクトリ単位で個別ファイルを1つも指していない / P08 に削除対象が無い / `styles.css` / `ExportMenu.tsx` / `report-html.ts` / `api.ts` が全 23 成果物の scope 外 / `build_target_kind` が13本とも `application-code`。

**群Cの位置づけ（実行順序の逆説）**: 群C は群A より**先に**閉じなければならない。**根本原因を直す手が届く位置にない限り、根本原因は直せない。** フェーズ3 で B-4 が C 群の前に来る理由。

### 群D — テンプレ増殖（増幅器）

task 13本の 60% が全本共通 / architecture の 136 行が3サイクル（reconciliation / analysis-hub / expense-matrix）すべてで同一 / `tasks/` と `.dev-graph/plans/.../task-specs/` の本文が完全複製 / task 1本あたり固有行は平均21行（120行中）。

**群Dの性格**: 群A〜C の問題を**21倍に増幅**する。ただし M-P01 の介入（群A の対策）を骨格に載せれば、同じ 21 倍が**解決側にも効く**。

### 群E — 削除が起きない（蓄積器）

`matrixMovers` が残る / `chart-aggregates.ts` の `max` がデッドフィールドのまま `contract-test` に守られている / `Matrix.tsx` の置き換え先が決まっても削除 task が無い / `HowTo id="matrixMovers"` / 旧称 `マトリクス` が検索契約に固定されている。

**群Eの新しい発見（訂正後）**: `max` は「誰も使っていないから無害」ではない。**コメントが「この値で割る」と主張しているため、次の実装者を誤誘導する**（phase2-system 自身が M4 でこの誤りを犯し、実測で訂正された）。**デッドコードの害は実行時ではなく、読解時に出る。**

### 群F — 未検算の値が `confirmed` の印を持って流通している（表出面）

§9.1 の `grandTotal` / `grandAverage` の2行 / `yoyRate: 3.0` / 受入2 の `+300.0%` / 参照画像の合計欄 3 値（1,065.5 / 1,066.2 / 1,082.0）が閉じていない / F24（前年同月比はフィクスチャから原理的に算出不能）。

**群Fの性格**: 単なる「未検算」ではない。これらの値は `dec-matrix-fixture-authority` という**利用者決定の印**と `confirmation_status` を持って流通している。R1 の (7)「正本宣言」が、**検算されていない値にも正本の権威を与えてしまう**。

**群F と R4 の合流点（訂正で見えた構造）**: 群F は「人が転記した値が検算されない」、R4 は「機械が計算した値が途中で落ちる」。**どちらも「値の出所が追えないまま下流で使われる」という同じ形**である。群F の処方は「検算の辺を張る」（M1 / M10）、R4 の処方は「型で運ぶ」（M4b）。**前者は人の手続き、後者は機械の強制で、後者のほうが減衰しない。** 5-2 で群F に手を入れるときは、検算をテストにする（フィクスチャの三者一致を `matrix-contract.test.ts` の assertion にする）方向を推す。

### 訂正によって変わった思考法別の結論（差分のみ）

- **システム思考**: 「濃淡3実装」は誤り。実装は1つで、**宣言（`chart-aggregates.ts:1-5`）と実態の乖離**が問題。系の欠陥は重複ではなく**接続**にあった。
- **因果関係分析**: `row.max` が使われない原因は「描画側の怠慢」ではなく「変換層の型が枠を持たない」。**責任は落とした側ではなく、運べない器を設計した側にある。**
- **トレードオン**: `normalize='row'` と `'table'` は優劣ではなく、**両方に宣言済みの理由がある**（`ReportChart.tsx:203` のコメント）。統合とは片方を捨てることではなく、**選ぶ場所を1つにすること**。この定式化は訂正後も生き残った。
- **why思考**: 「なぜ β を今やるのか」の答えが「今ある重複を片付けるため」から「**今やらないと今サイクルで新たに重複が生まれるため**」に変わった。前者は延期できるが、後者は延期できない。
- **仮説思考**: 「①Matrix.tsx が濃淡を作る」は、`cell()` が `cls` を返すという**構造の一致**から立てた仮説で、`grep heat` を打てば1手で否定できた。**構造が似ていることを機能が同じであることの根拠にした**のが誤りの型。同じ型の誤りが仕様にもある（§3.5 のヘッダが「総合」なのに中身は事業7行 — 構造が表の形をしているので中身を見ずに総合と書かれた）。

---

## セクション6 — フェーズ3（`elegant-improvement-executor`）への引き渡し（原文）

### 6-1. 実行順序の制約（β の数え直しを反映）

**制約1（同時性・最重要）**: 決定1（`zOf` への統一）と決定4（`heatmap/` への統合）は、**片方だけをマージすると現状より悪化する。**

| マージ内容 | 濃淡 | 注目セル選定 | 合計 | 現状比 |
|---|---|---|---|---|
| 現状 | 1 | 2 | **3** | — |
| 新仕様のみ | 2 | 3 | **5** | +2 |
| 決定4のみ | 1 | 3 | **4** | **+1（悪化）** |
| 決定1のみ | 2 | 2 | **4** | **+1（悪化）** |
| 決定1 + 決定4 + 前提2/3/4 | 1 | 1 | **2** | -1 |

以前伝えた「片方では効かない（4→4）」は**弱すぎる表現だった**。正しくは**片方だけでは悪化する**。したがってフェーズ3では、C-2（`zOf`）と C-3（`heatmap/`）を**同一の PR に入れるか、両方が揃うまでどちらもマージしない**。

**制約2（前提3）**: heatmap の現行挙動を固定するテスト（M4）が緑になるまで `ReportChart.tsx` に触れない。ゲートは C-1。
**制約3（前提2）**: P08 の `resource_scope` 拡張（M5）が入るまで、`matrixMovers` / `styles.css:3385-3399` を削除できる task が存在しない。ゲートは B-4。
**制約4（前提4・新）**: `HeatGrid` の props 型を決める時点で M4b の制約1〜3 を満たしていなければならない。**後から型を絞るのは、描画側が既に分母を持ってしまった後では不可能**（③④ がまさにその状態）。ゲートは C-1 の設計レビュー。
**制約5（新）**: M1（前年分フィクスチャ）→ 受入2・3 の期待値算出 → §9.1 の `movers` の `yoyRate` → M10（`grandTotal` / `grandAverage`）は**完全な直列**。フィクスチャが動くと総計も動くため、M10 を先に確定させると二度手間になる。

### 6-2. 並列群 A（他のどれとも依存しない。同時起動可）

| id | 内容 | 対象ファイル |
|---|---|---|
| A-1 | `chart-aggregates.ts:15` のコメント訂正（M4c） | `packages/core/src/chart-aggregates.ts` |
| A-2 | `teal` → `accent の不透明度7段`（M14、承認G の後） | `architecture/expense-matrix-{frontend,ui-ux}.md` |
| A-3 | ADR ID の重複解消（29件中9件が4組で重複） | architecture 8本 |
| A-4 | `Trade-off` → `Trade-on` の統一（3本が割れている） | architecture 3本 |
| A-5 | `qa-matrix-frontend-web-003` の2行重複（`expense-matrix-frontend.md:138,139`） | 同上 |
| A-6 | CSV の列契約を §9 に追記（M15） | `specs/...` §9、`architecture/expense-matrix-backend.md:87` |

### 6-3. 文書直列群 B（順序に理由がある）

| 順 | id | 内容 | なぜこの順か |
|---|---|---|---|
| 1 | B-1 | 承認A〜G の判定を受けて、変更する項目を確定 | 承認結果で B-2 以降の内容が変わる |
| 2 | B-2 | M1: 前年分フィクスチャ追加 + 三者一致の再検算 | 以降のすべての期待値の土台（制約5） |
| 3 | B-3 | 仕様の書き換え（M2 未記帳月 / M3 `txCount` / M8 正規化方針 / M10 §9.1 / M11 `total` 一掃 / M12 `personal` / M4b の3制約） | B-2 の実測値が確定していないと §9.1 と受入2・3 を書けない |
| 4 | B-4 | task の `resource_scope` と `depends_on` の是正（M5 / M6 / M13 / M16） | 仕様が確定してから write scope を決める。**C 群はすべてこれの後**（触れる権限が無いファイルは触らない） |
| 5 | B-5 | 受入の書き換え（M17: S4 を 2×2、S5 を `pnpm test` 全件、受入2・3 を実計算値へ） | B-2 と B-3 の両方に依存 |
| 6 | B-6 | `.dev-graph/plans/.../task-specs/` 側への同期 | `tasks/` の複製元。先に直すと B-4 とぶつかる |

### 6-4. 実装直列群 C

| 順 | id | 内容 | なぜこの順か |
|---|---|---|---|
| 1 | C-1 | M4: `heat-model.test.ts` / `HeatGrid.dom.test.tsx` を**先に書き、現行 `ReportChart` の実装に対して緑にする**。同時に `HeatGrid` の props 型を M4b の制約で確定 | 制約2・制約4 のゲート。移行前の挙動が固定されていない状態で移設すると、壊れても気づけない |
| 2 | C-2 | M7: `zOf` / `zScores` を `analysis.ts` へ切り出し、`catProfile` を呼び出しへ置換 | 既存の診断テストが緑のまま通ることで、切り出しが等価であることを確認できる |
| 3 | C-3 | M4b/決定4: `components/heatmap/`（`heat-model.ts` / `HeatGrid.tsx` / `HeatLegend.tsx` / `heatmap.css`）を作り、`ReportChart.tsx:202-252` を `<HeatGrid normalize="row" bands={0}/>` へ置換。`styles.css:3385-3399` を `heatmap.css` へ移設 | C-1 のテストが移設前後で同じ値を出すことを検証する。**C-2 と同一 PR（制約1）** |
| 4 | C-4 | 決定3: `pages/analysis/matrix/` への分割。`HeatmapTable.tsx` は `HeatGrid` を `normalize="table" bands={7}` で使う。`SkewTop3.tsx` は `zScores` を使う | C-2 / C-3 の成果物を消費する側。先に作ると自前実装が生まれる |
| 5 | C-5 | 削除: `matrixMovers`（`financial-chart-model.ts:20,38`）、`Matrix.tsx`、`MatrixMoversChart`、`financial-chart-model.test.ts:3,18`、`figure-guides.test.ts:47-48` の載せ替え、`HowTo` の id 改名 | **削除が最後**。削除を先にすると置き換え先が無く、削除を省くと β が 2 に落ちない（制約3） |

### 6-5. 起動計画（波）

- **第1波（並列）**: A-1 〜 A-6 / B-1 の承認取り付け
- **第2波**: B-2（単独。ここが動くと下流の期待値が全部動く）
- **第3波（並列）**: B-3 / C-1
- **第4波**: B-4（C 群の write scope を開ける）
- **第5波**: C-2 + C-3（**同一 PR**）
- **第6波**: C-4
- **第7波**: C-5 → B-5 → B-6

**第5波を分割しないこと**が、この計画で唯一の「守らないと現状より悪くなる」制約である。

---

## 制約6（後続便で追加。セクション6 原文には含まれていない）

**P05 と P08 が同一ファイル（`packages/web/src/styles.css`）を触るため、第5波と第6波は同一ブランチ上で直列。**

`styles.css:1214-1222` の `:has(.heatmap-scroll)` と `> div:not(.heatmap-scroll)` は、**`financial-figure` 側が heatmap の内部クラス名を知っている**形の結合で、どちらのファイルの関心事か決まらない。**移設は `:3385-3399` のみに留めるのが最小の傷。**

この結合は **R4（変換層の剥落）と同じ形の別例**である。一方が他方の内部名を知っていることで結合が成立しているので、処方も同じ — **クラス名ではなく props で振る舞いを渡す**。

> **M4b の4つ目の制約**: `HeatGrid` の外側レイアウトは `HeatGrid` のクラス名に依存しない（高さの扱いは親が props で受け取る）。

CSS の `:has()` / `:not()` による結合は依存の向きが双方向になるため、「どちらのファイルに置くか」に正解がない。ファイル分割で解けない唯一の種類の依存である。

---

## 追加回答（phase2-system が別枠で明示。原文ではなく再構成）

### (1) 識別子の全量

A-1〜A-6 / B-1〜B-6 / C-1〜C-5。**C-5 までで全部、C-6 以降は無い。** M1〜M17 は改善案の採番、N1〜N7 は 5-2、X1〜X5 は 5-3 の採番で、波とは別系列。

### (2) 各波の完了条件

| 波 | 完了条件 |
|---|---|
| 第1波 | A-1〜A-6 の6件がマージ済み、かつ承認判定が出ている |
| 第2波 | B-2 のフィクスチャで三者一致の再検算が閉じている（1,062.6 に相当する新しい値が3経路で一致） |
| 第3波 | B-3 が仕様へ入り、かつ C-1 のテストが現行 `ReportChart` の実装に対して緑（制約2のゲート）で、`HeatGrid` の props 型が M4b の制約1〜3 を満たすと設計レビューで確認されている（制約4のゲート） |
| 第4波 | B-4 が入り、C 群が触るファイルすべてが `resource_scope` に載っている（制約3のゲート） |
| 第5波 | C-2 と C-3 が同一 PR でマージされ、C-1 のテストが移設前後で同じ値を出す |
| 第6波 | C-4 が C-2 / C-3 の成果物を消費している（自前実装が無い） |
| 第7波 | C-5 の削除が済み、β が 2 になっている |

### (3) 制約の性質

**絶対制約は「第5波を分割しない」の1つだけ**（3→4 で悪化する）。制約2〜6 は「守らないと検出できなくなる」種類で性質が違う — 制約2・4 は壊れても気づけない、制約3 は触る権限が無い、制約5 は二度手間、制約6 はファイル競合。

### (4) 指標の定義

- **β** = 「同じ偏りが画面ごとに違う定義で計算されている」経路の数（濃淡の実装数 + 注目セル選定の実装数）。現在値 **3**（濃淡1 = `ReportChart.tsx` のみ / 注目セル選定2 = `matrixMovers` と `analysis.ts` の z）、下限 **2**、何もせず新仕様だけ足すと **5**。
- **α** = 「偏りが見えても明細に降りられない」（決定3 と `figure-guides.ts` の `act` の導線の話）。**波の計画は β だけを数えている。**

### (5) 確定した承認による上書き差分（原文は書き換えずに適用する）

- **A-2** の「承認G の後」は不要（承認G は降格済み）。無条件に実施可。
- **B-1** は完了済み（7件の判定が出ている）。
- **B-2 のフィクスチャは13ヶ月窓**で作る（`year13` 確定のため）。三者一致の再検算もその窓で行う。
- **C-3 の `<HeatGrid normalize="row" bands={0}/>` は原文のままで正しい**（濃さの基準が科目ごと・現状維持で確定したため）。
- **E（凍結）確定により制約に変更なし**。`catalog.ts` は丸ごと第3区分のまま。
- **A-6（CSV列契約を §9 に追記）の中身が13ヶ月で確定。**

### (6) 承認A に対応する作業（A-7）— 本記録で新設・依存を判定済み

承認A（表記ゆれの統一 = 「今回あわせて直す」）は**波のどこにも id が無かった**。実作業は「統一を実施し `route-search` に旧称の別名を追加する（作業量3倍、`ExportMenu.tsx:52` も巻き込む）」。**触るファイルの所在が2種類に割れているので、1つの id にまとめられない。** 次の2つに割る。

| id | 内容 | 波 | 判定理由 |
|---|---|---|---|
| **A-7a** | 文書側の表記統一（`マトリクス` → `マトリックス`）。specs / architecture / tasks / docs のみ | **第1波（並列群A）** | 触るのが文書だけで、コードの `resource_scope` を必要としない。他のどの id とも競合しない |
| **A-7b** | コード側（`route-search.ts` への旧称の別名追加、`ExportMenu.tsx:52` のラベル） | **第6波（C-4 と同一ブランチ）** | (i) `ExportMenu.tsx` は B-4 が `resource_scope` に載せるまで触れない（制約3）。(ii) 決定2 による URL 生成の単一関数化が同じ `ExportMenu.tsx` を書き換えるため、別の波で二度触ると制約6 と同型のファイル競合になる |

**A-7b を第7波（C-5）へ送らない理由**: C-5 は `HowTo` の id 改名を含み、旧称の別名追加と同じ「検索契約に固定された旧称」の問題を扱う。だが C-5 は削除の波であり、A-7b は追加である。削除の波に追加を混ぜると、`pnpm test` が落ちたときにどちらが原因か切り分けられない。

---

## 第1波の実行中に確定した訂正と判定（team-lead 判断・実測付き）

### (7) A-3 / A-5 は誤診だった。処方を列ヘッダの訂正へ置き換えた

ADR 表の ID の重複は、2種類に割れたうえ**どちらも重複ではなかった**。

- **章跨ぎ（`dec-matrix-heat-scale` ほか4組）**: 同じ決定の各章の側面を書いている正しい多重参照。潰すと相互参照が壊れる。
- **同一ファイル内（security 3行 / infrastructure 2行 / frontend 2行 / auth 2行）**: `spec-state.json` の qa_log を引くと、`qa-matrix-security-web-003` の `answer` は「(1) 列挙値違反は 400 (2) `key` は完全一致・LIKE 禁止 (3) CSV の `= + - @` をエスケープ」という**複数決定を含む1つの往復**である。表の3行はその (1)(2)(3)。`frontend-web-003` も同じで `:138` が (2)、`:139` が (3)。

**A-5 を指示どおり「2行重複の解消」として実行していたら、決定が1つ消えていた。**

真の欠陥は、**表の1列目のヘッダが `ADR` なのに中身は qa_ref（根拠の参照）だった**こと。決定の識別子ではないので決定ごとに一意にならないのが当然だった。処方は `expense-matrix-*` 8本のヘッダを `| Basis (qa_ref) | Decision | ... |` へ訂正する1点。**実施済み。**

`-005` 以降を新設しなかったのは、qa_log に各章 `-001`〜`-004` しか存在せず、新番号が実体のない参照になるため。

誤りの型は「**列名が ADR だから ADR ID が入っているはず**」= 名前の一致を対象の一致の根拠にした。セクション3 の「構造が似ていることを機能が同じであることの根拠にした」と同型。

### (8) A-4 は今サイクルの対象外

`Trade-off` は `expense-matrix-*` 8本・`specs/` ・`tasks/` ・`features/` で **0件**。すでに `Trade-on` に揃っている。残存3本（`arch-import-deletion-undo-boundary.md` / `arch-ui-navigation-experience.md` / `arch-override-reapply-three-way-merge.md`）は別 feature の既存文書で、このブランチの成果物ではない。**触らない。**

### (9) `dec-matrix-heat-scale` は B-3 の対象ではない（一度誤って対象に入れ、撤回した）

一度「ui-ux と backend が『表全体共通の7階級』と書いているのは、承認で確定した『科目ごと』と矛盾する」と判定したが、**誤りだった。**

決め手は「**合計/平均の行列を階級算出から除外する**」という但し書き。`accountMonthMatrix`（`chart-aggregates.ts`）が作る行は科目行と `'その他'` 行だけで、**合計行も平均行も無い**。この但し書きは AI レポートに対しては書きようがない。したがって `dec-matrix-heat-scale` は**新しいマトリックス画面**の決定である。裏づけとして、ui-ux が挙げる代替案は「列ごとに正規化」であって「行ごと」ではない。承認の「科目ごと」は行ごとなので、論じている場が違う。

**2つの濃淡が別の基準を持つことは今サイクルの設計そのものである。**

| 対象 | 基準 | 根拠 |
|---|---|---|
| C-4（新画面 `HeatmapTable.tsx`） | `normalize="table" bands={7}` | `dec-matrix-heat-scale` |
| C-3（AIレポート `ReportChart.tsx` 置換） | `normalize="row" bands={0}` | 承認「濃さの基準 = 科目ごと・現状維持」 |

`HeatGrid` に `normalize` と `bands` を props で持たせたのは、この2つを1つの部品で賄うためである。**`dec-matrix-heat-scale` を「行ごと」へ書き換えると新画面の設計が壊れる。**

誤りの型は (7) と同じ。ID が同じで語彙も同じ（濃淡・階級）なので、対象が違うことが見えなかった。

### (10) 除外制約がセクション6 のどこにも無い（本物の欠落・R4 の再発）

`dec-matrix-heat-scale` は3章そろって「合計/平均の行列を階級算出から除外する」と言い、帰結欄に「除外しないと本体セルが最下位階級へ潰れる」と失敗の形まで書いている。**この制約がセクション6 のどこにも無い。** C-4 の原文は `normalize="table" bands={7}` で使うとしか言わず、M4b の制約1〜4 にも無い。

これは **R4 そのものの形**である。正本（architecture）が制約を持つ → 運ぶ枠が無い → 落ちる → 濃淡は連続量なので目視で気づかない（本体セルが全部薄いだけで、それらしく見える）→ 正本の宣言だけが残る。

**判定: (a) と (b) を両方採る。片方だけにはしない。**

- **(a) → B-3（仕様）**: `HeatGrid` に除外の枠を足すのではなく、**階級を計算する側（新画面は API）の責務として仕様に書く**。`HeatGrid` には除外済みの階級値だけが渡る。props を足す案を採らないのは、除外の判断が「どの行が合計か」という表の意味の話であり、描画部品が知るべきことではないため。知らせた瞬間に `HeatGrid` が表の構造を理解する部品になる。
- **(b) → C-4 の完了条件**: 「合計/平均の行が最下位階級に潰れていないこと」の検査を1本足す。**階級値そのものを assert する形にすること**（見た目では判定できない）。

> **(b) は実現可能である。** P08 の `styles.css` で「自動検出手段が存在しない」と結論したケースとは違う。あちらはレイアウト結果の判定が要り、jsdom（`packages/web/package.json:39`）が高さを計算しないため原理的に書けなかった。今回は階級値の assert なので DOM のレイアウトを必要としない。

### (11) A-7 は新規ではなく、既に決まっていた項目だった

`architecture/expense-matrix-frontend.md:141` の `qa-matrix-frontend-web-004`「共通シェルは既存踏襲、表記のみ『マトリックス』へ統一」／帰結「`routeMetadata` の label と `journeyHint` も同語へ揃える」。

**A-7 は scope の追加ではなく、既に決まっていたのに波の計画へ落とし込まれていなかった項目。** A-7a / A-7b の分割（本記録 (6)）はそのまま使える。

**`packages/web/src/routeMetadata.ts` を A-7a へ入れる。** P05 の `resource_scope` に既にあるので B-4 のゲートに当たらず、第1波のまま実行できる。

ただし旧称は `packages/` 配下の **18 ファイル**に残っており、`routeMetadata.ts` の4か所だけでも性格が割れる。

| 箇所 | 扱い |
|---|---|
| `:231` `label: 'マトリクス'` | **対象**。画面名そのもの |
| `:239` `journeyHint: 'マトリクスで支出の構成を分析'` | **対象**。帰結欄が名指ししている当のもの |
| `:5` コメント「増減マトリクス・支出トレンド・統計診断は…」 | **保留** |
| `:364` コメント「サイドバーから消えたタブ(増減マトリクスなど)を…」 | **保留** |

**「増減マトリクス」が本画面の旧称か別画面の固有名かが未確定。** 後者なら承認A の対象外で、変えると別画面の名前を壊す。`analysis.ts` / `analysis-hub.ts` / `Trends.tsx` にも「マトリクス」があり同じ切り分けが要る。**A-7a の着手時に1件ずつ実測してから触ること。** 名前の一致を対象の一致の根拠にしない —— 本セッションで2度踏んだ型である。

`routeMetadata.ts:364` のコメントは別の意味でも効く。**旧称が検索契約に固定されている**（群E の該当項目）。`route-search.test.ts` が旧称で引けることを検査しているなら、A-7b の「旧称の別名を追加」はそのテストを緑に保つ必須条件であり、省くと落ちる。A-7b 着手時に実測する。

### (12) A-7 の範囲を確定した。割り方を「文書／コード」から「単独で閉じる／閉じない」へ変える

本記録 (11) で保留にしていた「増減マトリクス」の切り分けが**実測で決着した**。

**「増減マトリクス」は本画面の旧称である。別画面ではない。** 決め手は、**いま置き換えようとしているコードそのものにこの名前が付いている**こと。

```
packages/web/src/pages/analysis/Matrix.tsx:1   /** P2 増減マトリクス: 科目×月で「増えた/減った」を特定する */
packages/core/src/analysis.ts:175              /* ==== P2 増減マトリクス ==== */   ← matrix() の節の見出し
```

**`P2` という同じ識別子**を、C-5 で消す `Matrix.tsx` と C-2 で触る `analysis.ts` の当該節が共有している。補強3件: `pages/Analysis.tsx:4` と `routeMetadata.ts:5` が同じ「増減マトリクス・支出トレンド・統計診断」の3画面並びを書き、`route-icon-distinct.test.tsx:15` が本画面のアイコン `grid-2x2` に「増減マトリクス」を当てている。

**したがって `routeMetadata.ts:5` と `:364` は承認A の対象である。** (11) の保留を解除する。

#### 統一対象は `マトリクス` → `マトリックス` のみ。`増減` は置換の対象外

**置換後の文字列を書いておく。**

| 置換前 | 置換後 |
|---|---|
| `マトリクス`（`:231` label など） | `マトリックス` |
| `増減マトリクス`（コメント類） | **`増減マトリックス`** |

`:231` の label は `マトリクス`、コメント類は `増減マトリクス` で**長さが違う**。承認A は表記のみの統一なので、`増減マトリクス` を label と同じ `マトリックス` へ縮めては**ならない**。縮めると画面名を変えたことになる。

`マトリクス` → `マトリックス` の一括置換が両方を同時に満たすので、機械的に行える。

#### 波及の全量（実測18ファイル・3層）

| 層 | 内容 | 件数 |
|---|---|---|
| **(A)** 利用者に見える文字列 | `routeMetadata.ts:231` label / `:239` journeyHint / `ExportMenu.tsx:52` / `Settings.tsx:323` | 4件 |
| **(B)** (A) を assert しているテスト | `analysis-hub.dom.test.tsx`（10か所）/ `analysis-navigation.integration.dom.test.tsx:133,135`（`:135` は `document.title` 完全一致 `'マトリクス \| 支出分析 \| Focus Ledger'`）/ `analysis-tabs.dom.test.tsx:92` / `layout-export-menu.dom.test.tsx:60` / `route-search.test.ts:23` | 5ファイル15か所 |
| **(C)** コメント・テスト名だけ | `analysis.ts:175` / `analysis-hub.ts:3,54` / `analysis-hub.test.ts:13,95,103` / `routeMetadata.ts:5,364` / `route-search.test.ts:12` / `route-icon-distinct.test.tsx:15` / `matrix-legend.dom.test.tsx:3` / `RouteIcon.tsx:22` / `ExportMenu.tsx:6` / `financial-chart-model.test.ts:6` / `Analysis.tsx:4,13` / `Matrix.tsx:1` / `Trends.tsx:34` / `analysis-navigation.integration.dom.test.tsx:18` | 残り |

**(A) の `Settings.tsx:323` も現在の `resource_scope` に載っていない**（全23成果物の scope 外）。**B-4 で載せる対象に含めること。** `ExportMenu.tsx` / `Matrix.tsx` / `Settings.tsx` の3箇所に同じ文字列があり、scope 内2・scope 外1 という配置は、直す側が漏れに気づけない形である。

**(B) の5ファイルはどれも現在の `resource_scope` に載っていない。** これは **規則4（被参照の向きを引く）が拾う対象そのもの**である。`routeMetadata.ts` は P05 の scope にあるが、そこから**呼び出し元をたどる向き**ではこの5ファイルは1つも出ない。テストは import するだけで export しないため。**B-4 の対象にこの5ファイルを追加すること。**

#### 割り方を変える（提案を採用）

A-7a を「文書側のみ」と定義していたが、**実測では閉じない**。(A) を1つでも変えると (B) が赤くなる。割り方を**「文書／コード」ではなく「単独で閉じる／閉じない」**へ変える。波の制約は依存で決まるので、こちらが正しい。

| | 内容 | 波 |
|---|---|---|
| **A-7a** | **(C) のみ** — コメント・テスト名の統一。単独で完結する | **第1波**（据え置き） |
| **A-7b** | **(A) + (B) + `route-search` の別名** — 見える文字列とその検査は同一の変更単位 | **第6波** |

**A-7b が大きくなっても第6波・C-4 と同一ブランチのままにする。** C-4（`HeatmapTable.tsx`）とはファイル競合が無いので C-4 が理由ではないが、**A-7b が `ExportMenu.tsx` と `Settings.tsx` を触る**ため、同じ2ファイルを触る CSV 側の作業（URL 生成の単一関数化）と同一ブランチである必要がある。決定要因は C-4 ではなく `ExportMenu.tsx` の競合である。

#### 別名は `routeMetadata` 側に置く（`route-search.ts` ではない）

`マトリックス` は `マトリクス` を**部分文字列として含まない**（`ッ` が入る）。label と journeyHint を統一した瞬間、旧称で引ける経路が消え `route-search.test.ts:23` (`expect(idsOf('マトリクス')).toContain('matrix')`) が赤くなる。**別名追加は省けない。**

置き場所は **`routeMetadata` 側**とする。`route-search.ts:8-9` が「追加のデータは持たない（二重管理を作らないため）」と**明文で戒めている**ため、`route-search.ts` に別名表を作るとこの戒めを正面から破る。`routeMetadata` に持たせれば正本が1つのまま保てる。

**テストを緩める案は採らない。** `route-search.test.ts:12` のコメント「統合が『増減マトリクスが消えた』に見えるので」が示すとおり、**旧称で引けることは利便ではなく統合の事故を防ぐ契約**である。

### (13) 仕様の正本が A-7 の範囲を限定していた。(12) の範囲を縮小し、A-7a を廃止する

「置換は冪等なので `grep -rn 'マトリクス'` が0件で完了判定できる」という提案を検証するため対象ディレクトリを実測したところ、**完了条件どころか範囲そのものが誤っていた**ことが判明した。

#### 決定的な事実 — 仕様が範囲を明示し、コメントの変更を禁じている

`specs/spec-expense-matrix-screen.md:319-321`（verbatim）:

```
- 表記統一のみ行う: サイドバーおよびルート定義の `マトリクス` → **`マトリックス`**
  画面内の表 (`月別×カテゴリ別 支出マトリクス`) やコード内コメントの語は変更しない。
```

裏づけ `architecture/expense-matrix-ui-ux.md:114`:「パンくずとサイドバーは既存の共通シェルを使い、**当該項目の表記だけ**『マトリクス』→『マトリックス』へ揃える (routeMetadata の label と journeyHint も同語)」。

**(12) で確定した「(C) コメント・テスト名の統一」は、仕様が名指しで禁じている作業だった。** A-7a は**廃止する**（第1波から除く）。「一括置換で機械的に行える」という判定も撤回する。置換対象は列挙で指定する。

#### 実測 — 旧称は今サイクルの外に広く存在する（`grep` 0件は原理的に達成できない）

| 場所 | 件数 | 判定 |
|---|---|---|
| `system-spec/` | 142 | 対象外（収集記録。既に `マトリックス` 130件と併存） |
| `.dev-graph/` | 62 | 対象外（状態・計画） |
| `packages/` | 44 | (12) の3層。うち対象は下表のみ |
| `docs/` | 29 | **対象外**（`analysis-hub` / `reconciliation` など**別 feature**） |
| `specs/` 21 / `architecture/` 17 / `tasks/` 15 / `features/` 11 | | **大半が別 feature**（`feat-reconciliation` 13本、`feat-analysis-hub`、`ui-navigation` 系）。今サイクル分は下記のみ |
| `README.md` 2 / `.gitignore:11` | | 対象外。`.gitignore` の `増減マトリクス.csv` は**取り込む側のファイル名**で、`packages/` のどのコードも発行していない（実測0件） |

今サイクルの成果物内の旧称は、すべて**画面内の表の名前**か**仕様が「変更しない」と宣言している当の文**であり、対象外:
`spec-expense-matrix-screen.md:119,123,193,289,293,301,319,321,376` / `expense-matrix-ui-ux.md:57,59,84,114` / `expense-matrix-frontend.md:91,120` / `expense-matrix-maintenance-ops.md:59`

**したがって「`grep -rn 'マトリクス'` が0件」は完了条件にできない。** 対象外の旧称が数百件あり、0にはならない。

#### 本物の矛盾を1件発見した（B-3 へ）

`architecture/expense-matrix-maintenance-ops.md:142`（verbatim）:

```
- Architecture fitness test: テスト内の期待値が §3.5 と一致していること。『マトリクス』表記が残っていないこと。
```

**この fitness test は仕様 `:319-321` と矛盾する。** 仕様は画面内の表とコード内コメントの語を**残す**と宣言しており、「残っていないこと」を検査すると必ず落ちる。**同じ章の `:59` 自身が「表記の不一致は是正する」と限定的に書いているのに、`:142` だけが全廃に読める。**

**B-3 で `:142` を仕様に合わせて訂正する**（検査対象を「サイドバーおよびルート定義」に限定する）。違反は**①矛盾なし**。

#### A-7 の確定範囲（(12) を差し替え）

| 対象 | 根拠 |
|---|---|
| `routeMetadata.ts:231` `label: 'マトリクス'` | ルート定義。仕様が名指し |
| `routeMetadata.ts:239` `journeyHint` | 同上。`ui-ux.md:114` が名指し |
| 上記を assert する **(B) 5ファイル15か所** | 変えれば赤くなる。同一の変更単位 |
| `routeMetadata` 側への**旧称の別名** | `route-search.test.ts:23` を緑に保つ必須条件 |

**すべて A-7b（第6波）。A-7a は無い。**

`ExportMenu.tsx:52` / `Settings.tsx:323` の「マトリクスCSV」は**仕様のどの分類にも入っていない**（サイドバーでもルート定義でもなく、画面内の表でもコメントでもない）。**B-3 で仕様 `:319-321` に一行足して分類を与えてから、A-7b で扱う。** 分類が無いまま触ると、仕様に無い変更になる。

#### 完了条件（`grep` 0件の代わり）

対象を列挙で指定しているので、**列挙した箇所が置換済みであること**と**`pnpm test` が緑**であることの2つ。(B) の15か所が検査の役目を果たす。**(C) 層に検査が無いことは問題ではない。(C) は対象外だからである。**

#### 誤りの型

(12) は **`grep` の結果だけを見て「旧称が18ファイルに散っている」を「18ファイルすべてが対象」と読んだ**。仕様が範囲を明示していたのに、仕様を引かずに実測だけで範囲を決めた。**実測は「何があるか」を答えるが「何を変えるべきか」は答えない。** 今サイクルで3度踏んだ「名前の一致を対象の一致の根拠にした」型の変種で、今回は**文字列の一致**を対象の一致の根拠にした。

### (14) (B) の15か所は均質ではない。3群に割れ、A-7b の対象は13か所

(13) で「(B) の15か所が検査の役目を果たす」としたが、**15か所は由来が3種類あり、そのまま一括で扱うと1か所が赤くなる。** 全件を行単位で実測した結果を確定版とする。

#### 群1 — `routeMetadata` の `label` から合成される **13か所**（A-7b の対象）

テストが書いているのはリテラルだが、実行時に比較される値は `label` 由来なので、**label を変えた瞬間に落ちる。置換漏れを捕まえる検査として機能する。**

```
packages/web/src/analysis-hub.dom.test.tsx:264,271,282,286,302,312,325,327,336,430   (10)
packages/web/src/analysis-navigation.integration.dom.test.tsx:135   document.title 完全一致
packages/web/src/analysis-tabs.dom.test.tsx:92                      `${tab.label}のくわしい説明`
packages/web/src/route-search.test.ts:23                            SEARCH_ROUTES 経由
```

合成元（実測）: `pages/analysis-hub/AnalysisRouteTable.tsx:186,227,245` / `pages/analysis-hub/SelectedAnalysisPanel.tsx:53` / `pages/Analysis.tsx:79`。

#### 群2 — テスト内の自作モック **2か所**（対象外。触っても触らなくても結果が同じ）

```tsx
// analysis-navigation.integration.dom.test.tsx:18
vi.mock('./pages/analysis/Matrix.js', () => ({ MatrixPage: () => <p>マトリクス詳細パネル</p> }));
// :133
expect(await screen.findByText('マトリクス詳細パネル')).toBeTruthy();
```

**`マトリクス詳細パネル` は製品側に存在しない**（`grep "詳細パネル" --非テスト` = 0件）。`:133` は `:18` の自作文字列を探しているだけの**自己参照**で、`label` を変えても緑のまま。仕様 `:319-321` のどの分類にも当たらないので**触らない**。同ファイル `:12` に `照合詳細パネル` という対があり、そちらは今サイクル対象外なので揃えて残すほうが読める。

> **この2か所は「置換漏れ」に見える。** 群1と同じファイルにあり同じ語を含み、しかし変えてはならない。**直しても緑なので、間違いだと気づく機会がない。** 数字で「13か所が対象、2か所は自己参照モックで対象外」と書いておくこと。

#### 群3 — `layout-export-menu.dom.test.tsx:60` **1か所**（保留。束が違う）

`'マトリクスCSV'` は `ExportMenu.tsx:52` のリテラルを assert している（`getAllByRole('menuitem').map(textContent)` の完全一致配列）。**これは (13) で「B-3 で分類を足すまで保留」とした側に属する。**

A-7b を「(B) の15か所」として実行すると実害が出る:

- `:60` だけ直して `ExportMenu.tsx:52` を直さない → **このテストが赤くなる**
- 両方直す → **仕様に分類の無い変更**になり、(13) で避けた形に戻る

**`:60` は `ExportMenu.tsx:52` / `Settings.tsx:323` と同じ束**であり、B-3 の分類が入ってから3点同時に動かす。同じ第6波・同じブランチだが**束が違う**。

#### 件数の検算（15 と 13 の関係）

**引き算は1件だけである。** 群2 は2件だが、うち `:18` は (12) の分類で **(C) 層**に置いており、**(B) の15には最初から入っていない**。

```
(B) 15 − :133 (群2 のうち (B) に属するもの) − :60 (群3) = 13
```

**「群2 の件数 = 2」と「(B) から引く件数 = 1」は両立する。** 前者は分類の大きさ、後者は**2つの集合の交わりの大きさ**である。`15 − 2 − 1` と書くと算術が 12 になり、結論の 13 と食い違う。検算した人は「どちらかが誤り」とだけ分かり、**どちらが正しいかは分からない**。13 を疑って 12 に直されると対象が1件減り、**減るのがどれかも決まらないので置換漏れの位置が特定できない**。

> これは群2 の「直しても緑」と対をなす形である。あちらは**検査が付いているように見えて何も見ていない**。こちらは**検算できる形で書いてあるのに、検算すると間違いに導かれる**。

#### 完了条件の確定

**列挙は上記13か所を path:line で書き切る。** 「(B) の5ファイル」という粒度では群2が入る。`grep` 残数による完了判定は (13) で使えないと確定しており、ここでも使わない。

#### 誤りの型（(13) への追加）

(13) の自己分析は片側だけだった。**(B) の15か所という数え方自体が同じ型を踏んでいた。** `grep 'マトリクス'` で15か所を数え、全部が同じ性質だと扱ったが、由来は3種類で、**一致していたのは文字列だけ**だった。

**そして非均質さが見えたのは、範囲を仕様で絞った後である。** 18か所のままなら群2と群3の違いは全体に埋もれ、実行して赤が出るまで分からなかった。**範囲を狭めると中身の非均質さが見える**、という順序がある。

#### 手順に入れる2つの問い

今サイクルで**同じ型を5度**（列名 `ADR` / ID `-003` / 決定名 `heat-scale` / 文字列 `マトリクス` / 件数 `2`）踏んだ。頻度から見て注意で防げる種類ではないので、残りの波では手順に入れる。

1. **一致しているものを見つけたら、一致しているのが何であるかを言う** — 文字列か、識別子か、対象か。
2. **数を書くときは、数えているものが何であるかを言う** — 分類の大きさか、2つの集合の交わりの大きさか。

2つ目が要る理由は、件数のずれが**同じ構造から出た**ためである。「群2 の件数」と「(B) から引く件数」がどちらも 2 だと思い込んだが、前者は分類、後者は交わりだった。**名前が同じものを同じ集合の要素として数えている**、という点で 1つ目と同型である。

---

## (15) 第1波の実施結果（A-1 / A-2 / A-6）

ここから先は分析ではなく**実施の記録**である。

### A-1 — `packages/core/src/chart-aggregates.ts` の `max` 完了

`AccountMonthRow.max` のコメントを実測に合わせた。塞いだ誤解は2つ。**消したくなる人**（濃淡の基準に見えるが違う）と、**濃淡の実装を探している人**（実体は `ReportChart.tsx` が毎回自前で計算している）。唯一の読み手は `packages/core/test/chart-aggregates-contract.test.ts:61` の1本。`catalog.ts:597-603` は `max` も `total` も捨てている。削除は次サイクル送り（N7）。

### A-2 — `teal` の消去 完了（2本）

`design-tokens.ts` というファイルは**存在しない**。`teal` トークンも存在しない（`styles.css` 0件）。正本は `packages/web/src/components/charts.ts:81` の `COLORS` で、`COLORS.net` が `themeColor('accent')` を返すためコメント上「ティールの線」と呼ばれていただけである。**色名がコメントから仕様へ漏れ出た**形。

- `architecture/expense-matrix-frontend.md:116`
- `architecture/expense-matrix-ui-ux.md:118`

の2本を `COLOR.accent` の不透明度 7 段 / `chartDecorativeFill` 経由へ揃えた。`charts.ts:95-97` が「呼び出し側で16進 suffix を組み立てず、透明度の意図をこの境界に閉じる」と書いており、この一文が濃淡の唯一の許可された経路である。

なお `specs/spec-expense-matrix-screen.md` の `teal` 8か所は**対象外**。あちらは目標画像の色の描写であって実装指示ではない。

### A-6 — CSV の列契約 完了（§9.4 新設）

現行実装 `packages/api/src/routes/analytics.ts:648-669` の列は `科目 / 全期間の月 / 年計×年数 / 前年比(年換算)`。**月列も年計列も件数が期間で変わる**。

`specs/spec-expense-matrix-screen.md` §9.4 を新設し、17 列固定（`科目` + 13 か月 + `合計` + `平均` + `前年比(年換算)`）へ確定した。年計列を落とす根拠は、**13 か月窓が 2 年にまたがるので、年計が年の途中で切れた合計になる**こと。年をまたぐ比較は 17 列目が担う。

併せて §9.4 に入れたもの:
- 未記帳月のセルは空文字（`0` と書かない。`chart-aggregates.ts:4` の「0 は使わなかった、null はまだ入力していない」と同じ区別）
- `mode` は値の意味だけを変え列構成を変えない
- 先頭が `= + - @` になるセルのエスケープ（`qa-matrix-security-web-003` の3決定のうち1つ）

`architecture/expense-matrix-backend.md` 側は2箇所。`:87` の表セルへ列数を書き、`Compatibility/versioning` へ**これは加法的変更ではない**ことを明記した。既存 CSV を取り込むコードは存在しない（`.gitignore:11` の `増減マトリクス.csv` は**取り込む側**のファイル名で、`packages/` のどこも matrix.csv を読んでいない）ので、列の入替を後方互換の対象にしない。

### 検証

`validate-system-plan.py --staging .dev-graph/plans/feature-package-feat-expense-matrix` が `violations: []` / P01..P13 / `validated_digest: sha256:8cde5b2e…`。第1波の編集前と**同一 digest**であり、exact-13 契約は変わっていない。

---

## (16) 第2波の実施結果（B-2）

`specs/spec-expense-matrix-screen.md` §3.5 を 13 か月窓（`2025/08 - 2026/08`）のフィクスチャへ全面改訂し、Python で三者一致（行合計の和 / 列合計の和 / セル総和 = **1,139.4 万**）を機械検算して PASS。§9.1 の例示 JSON も実値へ差し替えた（`grandTotal: 11394000` / `grandAverage: 876462` / `heatScale: {min: 20000, max: 356000, steps: 7}`）。受入4 の階級帯も `26.4〜35.6万` へ更新。

以前ここにあった `10820000` は参照画像の合計欄の値で、画像のセル値の和とは一致していなかった。**例示であっても接地していない数値を仕様に置かない** — 読み手はそれを期待値として写すため。

## (17) 第3波の実施結果（B-3 / C-1）

### C-1 前半 — 現行挙動の固定

`packages/web/src/heatmap-behavior.dom.test.tsx` を新設し **4 tests / 4 passed**（`pnpm --filter @kanjo/web exec vitest run src/heatmap-behavior.dom.test.tsx`）。

着手前に判明した事実: `grep -rln "heatmap" --include=*.test.*` が **0 件**。ヒートマップを検証するテストは repo 全体に 1 本も無く、**移設の基準がそもそも存在しなかった**。固定した 5 点は「濃さの分母は行ごとの最大」「濃度は `(13 + ratio × 217) / 255`」「`null` と `max <= 0` は塗らない」「数値をセルの文字として併記」「`<details>` の表を二重に出さない」。

実測で判明した重要な事実: **現行の色は `COLORS.biz`（`#087f78`）**であり、仕様 §3.3 が指定する `COLOR.accent` とは別のトークンである。`HeatGrid` が色を props で受けないと、移設した瞬間に AI レポート側の見た目が変わる。

### B-3 — 仕様・architecture への反映

| 項目 | 反映先 |
|---|---|
| M2（未記帳月を平均・標準偏差から除外） | 仕様 §5.1 項目 1 |
| M3（`movers[].txCount`） | 仕様 §5.2 テンプレ直後・§9.1・§9.2 |
| M7（`zOf` / `zScores` への統一・診断の「要確認」は同じ z ≥ 2.0） | 仕様 §5.1 末尾 |
| M8（`normalize='table'` / `'row'` の命名と両方の理由・`heatScale` は表全体の実測 min/max） | 仕様 §3.3・§9.1 |
| M4b 制約 1〜4 + 色 props | 仕様 §3.3・`architecture/expense-matrix-frontend.md` |
| M9（`model.ts` に濃淡も偏りスコアも書かない） | `architecture/expense-matrix-frontend.md` + ADR 2 行 |
| M11（`scope=total` の一掃） | 仕様 §2.2・§3.5・§9.1・§9.2・§9.3、architecture の ui-ux / database / backend、`features/feat-expense-matrix.md` の S4 |
| M12（`home` → `personal`） | 同上（コード側 `packages/web/src/api.ts:161` の再定義は resource_scope 外のため B-4 待ち） |
| M17（S5 を `pnpm test` 全件緑へ） | `features/feat-expense-matrix.md` |
| 決定 1（偏り 3 点は規則が正本、表は画像の記録） | 仕様 §5 冒頭 |

**B-4 へ送った 1 件**: `features/feat-expense-matrix.context.json` にも `総合` が残っているが、これは plan 生成時のスナップショットで digest 検証の入力である。第3波で書き換えると `validate-system-plan.py` の再検証が要るため、第4波（resource_scope 是正と再検証を伴う波）でまとめて扱う。

### C-1 後半 — `HeatGrid` の props 型（制約4 のゲート）

```ts
export type HeatNormalize = 'table' | 'row';
export type HeatIntensity = number | null;  // null = 塗らない
export interface HeatScale { min: number; max: number; steps: number }

/** 分母を作る唯一の場所。scale は戻り値であって props ではない */
export function heatIntensities(
  series: readonly (number | null)[],
  normalize: HeatNormalize,
  opts?: { bands?: number; scale?: HeatScale },
): { intensities: HeatIntensity[]; scale: HeatScale };

/** 値と階級値が 1 つの型に同居する。片方だけ渡せない */
export interface HeatCell { value: number | null; intensity: HeatIntensity }
export interface HeatRow { key: string; label: string; cells: readonly HeatCell[] }

export interface HeatGridProps {
  columns: readonly string[];
  rows: readonly HeatRow[];
  color: string;                                   // '#rrggbb'
  formatValue: (value: number) => string;
  cellTitle?: (row: HeatRow, columnIndex: number) => string;
  selected?: { rowKey: string; column: string } | null;
  onSelect?: (rowKey: string, column: string) => void;
  className?: string;                              // 外側レイアウトは親が与える
}
```

設計レビューの結果（制約ごと）:

- **制約1** — `HeatGrid` の props に分母は無い。`scale` は `heatIntensities` の戻り値としてのみ存在し、API へ載る `heatScale`（§9.1）と同じ形をしている。
- **制約2** — 当初案は `values` と `intensities` を並列の配列で持たせていたが、これだと**長さの違う 2 本を渡せてしまい、`intensities` を空にして `values` だけ渡す経路が型で残る**。`HeatCell` に同居させる形へ改めた。片方だけを渡すことがコンパイルの時点でできない。
- **制約3** — `ChartSeries`（`{label, data}`）の型は変えない。`ReportChart` が `HeatGrid` の直前で `heatIntensities(sr.data, 'row')` を呼び `HeatCell[]` を組む。変換層は挟まず、階級化を描画直前へ寄せる。API とフロントの契約は動かない（M1 案B との整合）。
- **制約4** — 外側レイアウトは `className` 経由で親が与える。`HeatGrid` 内部のクラス名を親の CSS が狙う経路は無い。
- **色** — `color` を props で受ける。本画面は `COLOR.accent`、AI レポートは現行どおり `COLORS.biz`。

### 第3波の完了条件との突合

| 条件 | 状態 |
|---|---|
| B-3 が仕様へ入っている | 上表のとおり反映済み |
| C-1 のテストが現行 `ReportChart` に対して緑（制約2 のゲート） | 4/4 PASS |
| `HeatGrid` の props 型が M4b の制約1〜3 を満たすと設計レビューで確認（制約4 のゲート） | 上記のとおり確認。制約2 を満たすため型を 1 度修正した |

---

## (17-補) 決定3 の原文と確定した props 型の差分

決定3 の原文は「`HeatmapTable.tsx` は `HeatGrid` を `normalize="table" bands={7}` で使う」と書いているが、C-1 の設計レビューで確定した型では `normalize` も `bands` も `HeatGrid` の props ではなく `heatIntensities` の引数である。**確定型を採る** — `bands` は階級の定義、すなわち分母そのものなので、`HeatGrid` が受け取れば「描画側が分母を知っている」状態（制約1・2 が消そうとしたもの）に戻る。原文は決定3 を書いた時点の想定であり、制約4 のゲート（C-1 の設計レビュー）はまさにこれを詰めるために置かれている。

M12 の副産物として原文が挙げていた `packages/web/src/api.ts:161` の `ExpenseScope` 再定義（core から import せず二重管理になっている）は、第4波で P05 の `resource_scope` に `packages/web/src/api.ts` を入れてあるため scope は開いている。置換の実施は C-4。

---

## (18) 第4波の実施結果（B-4）

### resource_scope の是正

| task | 追加 | 除去 |
|---|---|---|
| P04 | `components/heatmap/heat-model.test.ts` / `heat-grid.dom.test.tsx` / `heatmap-behavior.dom.test.tsx` | — |
| P05 | `components/ReportChart.tsx` / `components/heatmap/{heat-model.ts,heat-grid.tsx}` / `figure-guides.ts`（M13）/ `pages/analysis/matrix.css` / `pages/analysis/matrix/{MatrixPage,MatrixTable,CellDetail,SkewTop3,SelectionBar}.tsx` と `{api,model}.ts`（決定3 の分割先） | — |
| P08 | `core/src/report-html.ts`（M6・影響確認）/ `components/ReportChart.tsx` / `components/heatmap/{heat-model.ts,heat-grid.tsx}` / `heatmap-behavior.dom.test.tsx` | `packages/core/src/heat-model.ts` |

P08 から外した `packages/core/src/heat-model.ts` は**存在しないファイル**だった。決定4 の移設先は `packages/web/src/components/heatmap/heat-model.ts` であり、core ではない。scope に書かれていた path は planner が置いた推測で、決定4 の確定内容と一致していなかった。

分割先のファイル名は既存の `pages/analysis/reconciliation/`（`api.ts` / `model.ts` / `ReconciliationPage.tsx` / パネル群 + 隣接する `reconciliation.css`）に倣った。決定3 の「reconciliation/ 型へ分割」を、名前の付け方まで含めて踏襲する。CSS の移設先を `matrix.css` としたことで、制約6（P05 と P08 が `styles.css` を共有する）の重なりも狭くなる。

**第4波の完了条件（制約3 のゲート）**: C-1 のテスト群、C-2 の `analysis.ts`、C-3 の `heatmap/`、C-4 の消費側、C-5 の削除対象（`matrixMovers` / `styles.css:3385-3399` / `financial-chart-model.{ts,test.ts}` / `ReportChart.tsx`）がすべて scope に載った。

### M16 — `build_target_kind` は契約フィールドではなかった

「13 本すべてが `application-code` になっている」という指摘は正しかったが、**`build_target_kind` は `task-graph.json` に存在しないフィールドである**（13 本すべて `None`）。task 文書の本文に `- Executor: ...` の 1 行として書かれているだけで、`validate-system-plan.py` は値を読み取って receipt に載せるだけ、`template-contract.json` にも enum が無い。

したがって「enum 値の確認が要る / exact-13 契約に触れるのでセクション7 の承認事項」という留保は不要だった。実体は本文 1 行の記述であり、P01/P02/P03/P06/P07/P09/P10/P11/P12/P13 の 10 本を `documentation handoff (build_target_kind=documentation)` へ是正した（application code を書くのは P04 / P05 / P08 の 3 本だけ）。

### M5 — `depends_on` の移動は行わなかった

M5 は P08 の `depends_on` を「P06 の後・P07 の前へ移す」としていたが、13 node の DAG は P01→P02→…→P13 の一直線で、validator は**機能内前方依存**を要求する。P07 が P08 を待つ形（`P07.depends_on = [P08]`）は後方依存になり契約違反になる。実現可能なのは `P08.depends_on = [P06]` として P07 と並行させる形だけで、これは「受入より前に削除を済ませる」という M5 の意図とは別物である。

第4波の完了条件に `depends_on` は含まれていないため、今回は変更していない。順序を変える必要が実際に生じた場合の選択肢として記録に留める。

### context.json の扱い（第3波から送った 1 件）

`features/feat-expense-matrix.context.json` の `総合` と S5 も feature 本文と揃えた。懸念していた digest への影響は**無かった** — `validate-system-plan.py` は `.dev-graph/plans/.../` 配下のファイルだけを digest の対象にしており、再実行後も `sha256:8cde5b2e…` / `violations: []` で不変である。

### 未同期として残したもの

`tasks/*.md` の frontmatter を直したため、`.dev-graph/state/graph.json` に投影済みの `resource_scope` が古い（P04 / P05 / P08 の 3 件）。graph への再投影は C02 単一 writer を通す必要があり、`.dev-graph/plans/.../task-specs/` 側の同期と同じ性質の作業なので、**B-6（第7波）でまとめて行う**。文書側が正本であり、乖離しているのは投影の側である。

---

## (19) 第5波の実施結果（C-2 + C-3・同一ブランチ）

制約1（絶対）に従い、C-2 と C-3 を分割せず同じ作業単位で入れた。片方だけでは β が 3→4 で悪化するため、コミット／PR も両者を1つにまとめる。

### C-2: 偏りの定義を `zOf` に一本化

`packages/core/src/analysis.ts` の `revenueIdx` の直後に 2 関数を追加した。

| 関数 | 用途 |
|---|---|
| `zOf(value, series)` | 系列の中でその値がどれだけ外れているか。診断の `要確認`（z >= 2）もマトリックスの偏り上位3点も、この1か所だけを使う |
| `zScores(series)` | 系列の各値の偏り。平均・標準偏差を系列全体で1度だけ取る（`zOf` を n 回呼ぶと n 回再計算になるため別に持つ） |

`catProfile` 内の `const z = sd > 0 ? (lastVal - m) / sd : 0;` を `const z = zOf(lastVal, vals);` へ置換した。**core 645 件が値を変えずに緑**であり、これが「同じ式が 2 か所に書かれていた」ことの裏付けになっている。ばらつきが無い系列（sd = 0）は「どの値も等しく普通」として 0 を返す規約を関数の doc に明記した。

### C-3: 濃淡を `components/heatmap/` へ統合

| ファイル | 役割 |
|---|---|
| `heat-model.ts` | 濃淡の**分母を作る唯一の場所**。`table`（表全体で 7 階級）と `row`（行最大が分母）の 2 つの正規化に名前を与えた |
| `heat-grid.tsx` | 塗る表部品。**分母を props に持たない**ので、描画側が再計算する余地が型で消えている |
| `heat-model.test.ts` | 18 件。7 階級の境界、縮退（全セル同額／塗れる値なし）、四半期ケース |
| `heat-grid.dom.test.tsx` | 8 件。塗りが intensity だけで決まること、色と外側レイアウトを親から受け取ること |

`ReportChart.tsx` の `HeatmapTable` は `HeatGrid` + `heatRow(..., 'row')` へ差し替え、ローカルの `shade` 関数を削除した。**`ChartSeries` の型は一切変えずに済んだ** — 制約3 の「変換層を通せないなら挟まない」に従い、`HeatGrid` の直前で生値から階級値を作る形にしたため。

### 境界の帰属を決めた（P04 の `open_item` を閉じた）

仕様 §3.3 は階級数（7）しか書いておらず、境界ちょうどの値がどちらの階級に属するかを決めていなかった。**半開区間 `[下限, 上限)` = 境界ちょうどは上位側**を採った。四捨五入で寄せると最上位と最下位だけ区間の幅が半分になり、「7 等分」という仕様の言葉と食い違うため。理由は `bandOf` の doc コメントに残した。

### `heatBandLowerBounds` を公開関数として切り出した

当初 `bandOf` は `Math.floor(((value - min) / (max - min)) * steps) + 1` で判定していたが、境界値テストが浮動小数で落ちた（`335000 / 7` が割り切れず、テスト側の `min + 幅 * (band-1)` と乗除の順序が違うだけで値がずれ、階級 6 の下限で階級 5 が返った）。

階級の境界を**式の副産物にせずデータとして 1 か所に持つ**形へ変えた。判定も §3.3 の濃淡凡例も同じ配列を見るので、ずれる余地そのものが無い。凡例は実際に表示する必要があるので、これは「テストを通すための細工」ではなく公開データとして持つのが本来の形である。

### a11y の是正（lint の指摘）

`<td onClick>` はマウスでしか押せず、`aria-selected` は `gridcell`/`option` 用の属性で素の `td` には効かない。`onSelect` があるときだけセル内に `<button type="button" aria-pressed={isSelected}>` を置く形へ変えた。`onSelect` が無ければ button を作らない（選べない表に選択の印を出さない）ことも固定した。

### 検証結果

| 対象 | 結果 |
|---|---|
| `heat-model` + `heat-grid` | 26 件緑 |
| `heatmap-behavior.dom.test.tsx`（C-1） | 4 件緑 = **移設前後で同じ値**（第5波の完了条件の後半） |
| web 全体 | 80 files / 648 件緑 |
| core 全体 | 645 件緑 / 6 skipped |
| `pnpm typecheck` | 緑（web / api とも Done） |
| `biome check .` | 431 files / 指摘 0 |

`heatmap-behavior.dom.test.tsx` は `shade` を**自前で定義**しており `ReportChart` から import していなかったため、移設で import の張り替えが発生しなかった。テストが実装の内部名に依存していなかったことが、移設の安全性をそのまま担保した形である。

### β の状態

移設しただけでは β は下がらない。C-5（`matrixMovers` と `styles.css:3385-3399` の削除）が済んで初めて 3 → 2 になる。現時点では「3 のまま、ただし新しい経路を増やさずに新仕様を載せられる土台ができた」が正確な記述である。

### lint 全体が赤いことについて（第5波とは独立）

`pnpm lint` は `biome check` の後に 8 本の自作チェックを連ねており、`check-graph-lineage.mjs` が `architecture/expense-matrix-*.md` 8 本の未登録を指摘して落ちる。これは第5波の変更と無関係で、(18) で B-6 へ送った graph.json への再投影と**同じ対象**である。B-6 は「整合のために望ましい作業」ではなく、**リポジトリのゲートが既に要求している作業**だと判明した。第7波の優先度をこの事実に合わせる。

---

## (20) 第6波の実施結果（C-4・第5波と同一ブランチ）

### 完了条件との突合

第6波の完了条件は「C-4 が C-2 / C-3 の成果物を消費している（自前実装が無い）」。これは満たした。

| 消費側 | 消費しているもの | 自前実装 |
|---|---|---|
| `pages/analysis/matrix/SkewTop3.tsx` | core の `matrixSkewTop`（= C-2 の `zOf` 一本化） | 無し（core を呼ぶだけ） |
| `pages/analysis/matrix/MatrixTable.tsx` | `components/heatmap/` の `HeatGrid` / `heat-model`（= C-3） | 無し |
| `pages/analysis/matrix/model.ts` | core の `matrix-derived` / `heat-scale` | 画面固有の整形のみ |

旧 `pages/analysis/Matrix.tsx` は削除（`git rm`）し、画面は `pages/analysis/matrix/` 配下の4ファイル（`MatrixPage` / `MatrixTable` / `SkewTop3` / `model`）へ分割された。決定3 の形に収まっている。

### 本波で下した設計判断（5件）

1. **real-browser gate の検査対象を「実装の形」から「画面の機能」へ移した**。`check-financial-visuals.mjs` の Matrix ブロックは `[data-financial-figure] canvas` の存在を見ていたが、これは部品を替えるたびに落ちる。新しい検査は「偏りが大きい3点で名指しされた科目が、下の月次表にも実在する」「濃淡が1色に潰れていない」「単位が『単位: 万円』である」を見る。目的（α を塞ぐ回路）が変わらない限り生き残る。
2. **旧称の別名は検索側だけが持つ**。`routeMetadata` の `label` には「マトリクス」を残さず、`route-search.ts` の `QUERY_ALIASES` で query を読み替える。正本に旧称を残すと二重管理になり、どちらが表示名かが曖昧になる。テストで「正本に旧称が無いこと」も固定した。
3. **`.matrix-table` を復活させず `.matrix-table-card` でスコープした**。`HeatGrid` は共通部品なので画面固有のクラス名を持ち込ませない。12rem の科目列は外側のカードから効かせる。
4. **偏り表を `scroll-x` に入れた**。6 列は 320〜390px に収まらない。ページ本体をはみ出させるのではなく、表の中で横へ送る（月次表と同じ扱い）。
5. **`chart-aggregates.ts` の `max` は消さずコメントで残した**（M4c）。消費者は契約テスト1本だけだが、削除は C-5 と同じ次サイクルの掃除に属する。今消すとそのテストが落ち、第6波の範囲を越える。

### 発見した不整合（計画に無かったもの）

**glossary の `yoy` が旧定義のままだった。** §3.2 に従って「前年比（年換算）」列を落としたところ、`check-glossary.mjs` が「辞書の `yoy` はどの画面でも使われていない」と落ちた。辞書を読むと定義が「年換算 ÷ 前年実績」で、新画面の**前年同月比**とは別物だった。`yoy` を「前年同月比」へ改め（`年換算` は別エントリとして存続。AI レポート・Subscriptions での用法は無傷）、`MatrixPage` の `ColorLegend` に `<Term id="yoy" />` を配線した。

これは「未使用語の検出」が「定義の誤り」を炙り出した例である。列を落とさなければ、旧定義のまま新しい語で表示され続けていた。

### 併せて実施した A-7b（表記ゆれ）

「マトリクス」→「マトリックス」を、画面に出る文字列・テストの期待値・gate スクリプトの照合語で統一した。**コード内コメントの語は仕様 §8 の禁止に従い変更していない**（(12) の誤りを繰り返さない）。

### 検証結果

| 対象 | 結果 |
|---|---|
| web 全体 | 82 files / 666 件緑 |
| core 全体 | 44 passed + 1 skipped / 658 件緑 + 6 skipped |
| `pnpm typecheck` | 緑（web / api とも Done） |
| real-browser gate（`mobile-financial-visualization-render`） | 緑 |
| `pnpm lint` | `check-graph-lineage` を除き緑（`check-glossary` は 59 語すべて使用） |

`check-graph-lineage` の FAIL は (19) と同じ B-6 の対象で、内訳は `arch-reconciliation-*` 8 件の `source_digest` 不一致と `architecture/expense-matrix-*` 8 件の未登録。

### typecheck が最後に1件残った理由

`model.test.ts` のフィクスチャが `yoy: null` を `as MatrixData['rows']` で押し通そうとしていた。断言キャストは変換ではなく comparable かの確認しかしないので、`null` → `number` は通らない。`yoy: 0` へ直してキャストを外したところ `MatrixData` の注釈だけで通った = フィクスチャが API の返す形と一致した。**キャストが外せたことが、型を欺いていたことの答え合わせになっている。**

---

## (21) 第7波の実施結果（C-5 → B-5 → B-6）

### C-5 — 削除と β の到達

計画が挙げた C-5 の対象のうち、`Matrix.tsx`・`figure-guides.test.ts` の載せ替え・`HowTo` の id 改名は第6波で済んでいた。本波で消したのは次の4つ。

| 対象 | 処置 |
|---|---|
| `financial-chart-model.ts` の `matrixMovers` / `MatrixMover` / `MatrixMovers` | 削除（`MatrixData` の import も不要になった） |
| `FinancialCharts.tsx` の `MatrixMoversChart` | 削除 |
| `financial-chart-model.test.ts` の増減マトリクスのテスト | 削除 |
| `styles.css` の `.matrix-movers-chart` | セレクタから外した（`.financial-figure__chart--horizontal` は残る） |

**β を定義どおり数え直した結果、2（下限）に到達した。**

| 経路 | 実装 | 消費者 |
|---|---|---|
| 濃淡 | `core/heat-scale.ts` の `heatScaleOf` → `components/heatmap/heat-model.ts` の `heatIntensities` | Matrix の `MatrixTable`、AI レポートの `HeatmapTable` |
| 注目セル選定 | `core/analysis.ts` の `zOf` / `zScores` | `matrixSkewTop`（委譲のみ）、`catProfile` |

数えているのは実装ファイルの数ではなく**定義が分岐しうる経路の数**である。`heatScaleOf` と `heatIntensities` は2関数だが、後者は前者の出力しか受け取らないので分岐しない。

### C-5 で塞いだ穴 — 契約テストの題材の載せ替え

`mobile-financial-visualization.dom.test.tsx` の3件は `MatrixMoversChart` を**題材として** `FinancialFigure` 共通の契約（canvas を読めなくても結論・期間・単位・系列・次の行動・正確な表が届く）を検査していた。Matrix 固有の検査ではないので、消せば契約が無検査になる。題材を `CashFlowCharts` の1つ目の figure（月別の利益と営業CF・2系列×2ヶ月で同じ構造）へ載せ替え、載せ替えが緑になってから削除へ進んだ。

削除の前に「そのテストは何を守っていたのか」を問う手順が働いた例である。第6波の `matrix-visual.dom.test.tsx` と同じ形。

### B-5 — 受入の書き換え（M17）

**受入2 は検算の結果、書き換え不要だった。** §3.5 のフィクスチャから実計算すると 24.0 − 12.0 = +12.0万（+100.0%）、24.0 − 6.0 = +18.0万（+300.0%）で、仕様の値と一致する。B-2 のフィクスチャが受入2 と整合していたということ。

**受入3 は書き換えた。** 「偏りが大きい3点が §5 の 3 行を出す」という書き方は、§5 に2つある表のうち**画像記録の表**を指してしまう。利用者決定は「規則を正本にし表を差し替え」なので、参照先を §5.1 の規則の出力に変えた。期待値は core の `matrixSkewTop` に §3.5 のフィクスチャを実際に流して得た値である（2026-09-17 実行）。

| 順位 | 対象 | 金額 | 前月比 | 前年同月比 |
|---|---|---|---|---|
| 1 | 広告宣伝費 (2026年3月) | 24.0万 | +100.0% | — |
| 2 | 外注費 (2025年12月) | 11.5万 | +26.4% | — |
| 3 | その他 (2026年3月) | 8.5万 | +19.7% | — |

§5 が B-3 で書いた「規則を適用すると 1 位 広告宣伝費 / 2 位 外注費 / 3 位 その他になる」は**実測で裏付けられた**。推定ではなかった。

前年同月比が3行とも `—` になる理由も仕様へ書いた。窓（2025/08〜2026/08）の中で前年同月を持つ月は 2026/08 だけで、それが上位3件に入らない。§3.5.1 の窓外参照（2025/03 広告宣伝費 6.0）は受入2 の詳細カード専用であり、この表の算出には関与しない。

**S4 を 2×2 へ縮めた**（`features/feat-expense-matrix.md` の `acceptance` と `## 受入` の両方）。決定2 で `scope=total` を今サイクルの scope から外したので、「全部 / 構成比 / 前年差」の軸は受入の条件に残せない。S5 は既に `pnpm test` 全件の形だったので変更しない。

### B-5 で見つかった仕様と実装のギャップ（未解決・第7波の範囲外）

**`HeatGrid` は `selected` / `onSelect` を props に持っているのに、`MatrixTable` がどちらも渡していない。** 制約4（M4b）で「後から型を絞るのは不可能」として先に決めた props がそこにあるのに、繋がれていない。

その結果、次の2つが未実装である。

| 仕様 | 内容 | 指標との関係 |
|---|---|---|
| 受入2 / §4 | セルを選ぶと詳細カード（金額・前月比・前年同月比・取引件数・支払手段）が出る | **α の本体**。偏りを見つけた後、そのセルの中身へ降りる段 |
| 受入5 | 3つの切替・期間タブ・セル選択が URL に載り、リロードで復元する | 選択状態の共有・復帰 |

**受入を実装に合わせて緩めることはしなかった。** 受入は契約であり、実装が満たしていないなら不足しているのは実装の側である。α は「波の計画が数えていない」指標（§(2) の指標の定義に明記がある）なので、第7波の完了条件にも入っていない。次サイクルで P02 / P03 の task として扱うのが筋。

第6波までに作った「偏り表の科目が月次表に実在する」は α の**手前**までで、降りる段そのものはまだ無い、というのが正確な現状である。

### B-6 — グラフの系譜合わせ

計画は B-6 を「`.dev-graph/state/graph.json` への `resource_scope` 再投影 + 未登録 macro ノードの登録 + `arch-reconciliation-*` の digest 打ち直し」として立てていたが、**現物を見たところ対象が違っていた**。

`check-graph-lineage` が読むのは `architecture/graph.json` であって `.dev-graph/state/graph.json` ではない。前者は後者からの**投影** (従属成果物、`projection_note` に明記) である。`.dev-graph` 側には `arch-expense-matrix-*` 8 件も `resource_scope` の是正済みの値も既に入っていた。つまり B-6 の実体は「C02 への登録」ではなく「投影の実行」だった。

#### digest 不一致 8 件 — 打ち直しは 1 件も要らなかった

`arch-reconciliation-*` の記録 digest は、**230baaa (PR #54) 時点の `system-spec/<章>.md` と 8 件すべて一致した**。ずれていたのは記録ではなく正本の側で、照合サイクルを `system-spec/archive/` へ退避しないままマトリックスサイクルの `system-spec/` を生成したことが原因である。過去 11 サイクルはすべて `archive/<日付>-<名前>/` を指しており、退避が抜けていたのは照合サイクルだけだった。

検査が出すメッセージは「正本の変更を章へ取り込んだうえで digest を打ち直してください」だが、**この指示に従うのは誤りだった**。起きていたのは「同じ正本が更新された」ことではなく「正本が別サイクルのものへ入れ替わった」ことで、打ち直せば照合画面の章がマトリックス画面の仕様を正本にしていることになる。処置は `system-spec/archive/2026-09-16-reconciliation/` への退避 (13 ファイル、230baaa から `git show` で書き出し) と `source_path` の付け替えだけで、digest は 8 件とも無変更のまま一致した。

**検査のメッセージは「何がずれているか」を答えるが「なぜずれたか」は答えない。** (12) の A-7 で「実測は何があるかを答えるが何を変えるべきかは答えない」と書いたのと同じ形が、今度は検査の側で出た。

#### 投影 8 件

`.dev-graph/state/graph.json` の architecture ノードのうち投影先に無い 8 件を、投影側の 10 フィールド形式 (`id` / `artifact_kind` / `artifact_subtypes` / `title` / `file_path` / `status` / `confirmation_status` / `evaluation_status` / `source_lineage` / `referenced_by`) へ写した。`referenced_by` は feature の `architecture_refs` から逆算する。差分は 192 行追加・8 行削除で、既存 69 ノードの整形に巻き添えは出ていない (投影先 77 ノード / `architecture/*.md` 77 件・孤児 0)。

#### 連鎖して出た security:content の FAIL

`pnpm lint` は `&&` の連鎖なので、`check-graph-lineage` を直すまでその後ろは一度も走っていなかった。緑にした結果、隠れていた `security:content` の FAIL が初めて表に出た。内訳は 2 種類。

| 対象 | 内容 | 処置 |
|---|---|---|
| `plan-findings.json` / `implementation-readiness.json` 計 3 箇所 | planner が記録した plugin cache とリポジトリルートの絶対パス | `${CLAUDE_PLUGIN_CACHE}` / `${REPO_ROOT}` へ匿名化 (dev-graph C24 の「absolute stored path 0 件」契約とも整合) |
| `system-spec/spec-state.json` 10 行 | ガードの誤検知 | ガードの premise 語を絞った (利用者判断) |

ガードの premise+quantity 検査は #44 (MF 明細サイクル) で、当時 `spec-state.json` に実 CSV の件数・金額が書かれていたのを止めるために入った。今回触れた 10 行は premise 語がすべて一般語の「実データ」1 語で、同居していた数量は §3.5 の**架空フィクスチャ** (`¥120,000` / `¥240,000`) と表の行数 (「その他」1 行、上位 20 取引先) だった。実データの値は 1 件も無い。

利用者判断は**「ガードの premise を絞る」**。`実測値` / `実測` / `実データ` を premise から外し、個人の口座・明細そのものを指す `実CSV` / `実明細` / `実入力` / `実ファイル` / `実取引` / `実口座` に限った。適用範囲 (`spec-state.json` と `mf-business-classification` 限定) は変えていない。

**緩めた検査が本来の対象をまだ落とすことを、先に確かめてから緩めた。** danger 3 行 (実CSV 1,082 件 / 実明細 ¥240,000 / 実口座 3 件 ¥120,000) と safe 3 行を持つ疑似 `spec-state.json` を作って新旧 premise を当て、danger 3 件は新旧とも落ち、消えたのは safe の誤検知 2 件だけであることを確認した。`spec-state.json` 側 (利用者の承認回答の記録を含む) には手を入れていない。

### 第7波の検証結果

| ゲート | 結果 |
|---|---|
| `pnpm --filter @kanjo/web exec vitest run` | 82 files / 665 tests 緑 |
| `pnpm --filter @kanjo/core exec vitest run` | 44 passed + 1 skipped / 658 passed + 6 skipped |
| `pnpm typecheck` | core / api / web すべて Done |
| `pnpm lint` | **全 10 項目 PASS** (biome / skills / glossary / report-css / graph-lineage / design-tokens / document-contract / delivery / run-references / security:content) |

`pnpm lint` が全項目通ったのは、このサイクルに入ってから初めてである。

### 第7波の完了条件との突合

| 条件 | 結果 |
|---|---|
| C-5 の削除が済んでいる | 済 (`matrixMovers` / `MatrixMoversChart` / テスト / CSS。残存参照 grep 0 件) |
| β が 2 になっている | 到達 (濃淡 1 経路 + 注目セル選定 1 経路。下限) |

**残っているのは α で、これは波の計画が数えていない指標である。** 受入2 の詳細カードと受入5 の URL 復元が未実装で、`MatrixTable` が `HeatGrid` の `selected` / `onSelect` を渡していない。第7波の完了条件はすべて満たしたが、仕様 §10 の受入が全部緑になったわけではない — この 2 つは次サイクルの実装対象として残る。

---

## 保全にあたっての注記

- (1)〜(14) は **read-only 分析の結論**である。実ファイルへの変更は (15) 以降に記録する（第1波 A-1 / A-2 / A-6 は実施済み）。
- セクション2・3・6 は phase2-system の原文をそのまま収録した。追加回答 (1)〜(5) と制約6 の本文は、phase2-system 自身が「再構成であって原文ではない」と断ったもの。(6) の A-7 判定は team-lead（本セッション）の判断である。
- **唯一の絶対制約: 第5波（C-2 + C-3）を分割しないこと。**
