# 統計・背景仮説・外部調査の手順

`contextAnalysis` を同じ入力から再現可能に組み立てるための正本。会計金額の事実源は取得JSONだけであり、ヒアリングと外部情勢は背景仮説に限定する。

## 1. 問いを1つに固定する

1. 意思決定(`decision`)、指標(`metric`)、比較対象(`comparison`)、範囲(`range`)を1文ずつ書く。
2. 問いを次の1型に分類する: `distribution`(分布) / `comparison`(比較) / `relationship`(関係) / `decomposition`(分解) / `trend`(推移) / `concentration`(集中) / `anomaly`(異常)。
3. 利用者の回答は `interviewFacts` に質問と回答の対で記録する。未回答は推測しない。

## 2. 探索から反証へ進む

1. 取得JSONで内訳(どこが動いたか)を確認する。
2. `relationship` や「なぜ」の背景説明が必要な問いだけ、主仮説(`role=primary`)と対立仮説(`role=alternative`)を作り、同じ数字で両方を判定する。分布・記述・単純比較で原因を問わない場合は `causalHypotheses=[]` とし、原因を追加しない。
3. 背景候補は「量×率、構成、周期、制度、経済価格、外部衝撃、行動、市場、技術、組織運用、測定」の順で洗う。
4. 時期、量反応、一貫性、機序、比較相手、別説明を点検する。
5. 仮説ごとに `cause`(背景) → `mechanism`(作用経路) → `outcome`(観測指標)、`falsificationCondition`(崩れる条件)、`validationAction`(次に確かめること)を書く。未検証の辺は画面で点線になるため、本文も「仮説」「関連」「寄与」と表現し「原因である」と断定しない。

## 3. 統計的な表現と保留条件

- 現行の取得JSONで主に使えるのは CV(変動係数)、z値、傾き、移動平均。そのほかの統計結果は取得JSONに計算済みである場合だけ使う。
- 効果量・95%区間・p値が全てある場合は、効果量→95%区間→p値の順で読む。Welch、Mann-Whitney、Holm補正を自分で計算・推測しない。
- `n < 10`、Welch検定とMann-Whitney検定の方向/判定が一致しない、または `lowExpected=true` なら「保留」とし、方向を断定しない。
- 因果推論は行わない。このレポートで言えるのは関連・寄与と、次に検証する仮説まで。

## 4. 根拠水準と外部調査

- `data_confirmed`: 取得JSONで確認。`evidenceRefs` はJSON内の根拠名。
- `user_reported`: 利用者回答。`evidenceRefs` は `interviewFacts.id`。取込データで確認した事実とは分ける。
- `published_source`: 公表資料で確認。`externalEvidence.id` を `evidenceRefs` から参照。
- `assumption`: 想定。仮説全体の半数以下にする。

確度は `low`=主要な別説明が残る、`medium`=時期・一貫性・比較の複数が合うが交絡が残る、`high`=複数の独立根拠と反証確認が揃う、の基準で付ける。`high` でも因果の断定はしない。

外部調査がOFFなら、検索せず `externalResearch="off"` / `externalEvidence=[]` とする。ONのときだけ、次を守る。

1. 検索語は業種・地域・期間・一般経済指標に限る。取引先名・個人名・具体金額・明細を送らない。
2. 公的資料→業界/学術資料→報道の順で探す。対象期間、定義、速報/確定の別を取込データと合わせる。
3. `externalEvidence` にタイトル、URL、公表日(分かる場合)、取得日、主張、関連を記録する。支持資料と反証資料を同じ基準で探す。
4. 外部資料の数値を `fact`、`basis`、`amount`、`expectedEffect` の根拠にしない。

## 5. 図を選ぶ

1. 先に「この図で何を1文で伝えるか」を決め、1図1論点にする。
2. 取得JSONの `charts` で `available=true` のカタログ図だけを参照する。円グラフ、2軸、3Dは使わない。
3. 背景仮説はUIの `cause → mechanism → outcome` で表す。未検証の関係なので辺は点線、確度・反証・次の確認を同時に示す。

## 6. 送信前チェック

`analysisDepth` は5節や必須根拠を削る指定ではなく、取り上げる論点数と限界の掃き方を変える。

| 深度 | keyFindings | statisticalFacts / interpretations | 背景仮説 | 5節の items |
|---|---|---|---|---|
| `concise` | 各区分1件を目安 | 合1〜3件 | why問いだけ主1+対立1 | 契約の最低行数 |
| `standard` | 各区分1〜3件 | 合3〜6件 | why問いは主1+対立1〜2 | 最低行数を満たし、意思決定に必要な主要内訳 |
| `detailed` | 各区分1〜5件 | 合5〜10件 | why問いは主1+対立2〜3、限界と反証を詳細化 | データがあれば最低行数+2件まで追加 |

根拠が足りないときは件数合わせをせず、`gap` / `dataGaps` / `needs` で不足を示す。`analysisDepth` が無い指示は `standard` と解釈するが、送信JSONには必ず明記する。

- 会計数値の事実は取得JSONのみか。
- `statisticalFacts.id` と `interpretations.factRefs` が整合し、解釈に限界があるか。
- `statisticalFacts` / `interpretations` は0件でも配列を送る。出せる事実が無いときは作らず、理由と解消操作を `dataGaps` / `needs` に書く。
- 支持と反証、別説明、反証条件があるか。
- 公表資料にURLと取得日があるか。外部調査OFFなら出典が0件か。
- `cause` / `mechanism` / `outcome` が仮説の実内容を示しているか。
- `validate-report.py --data <取得JSON>` が exit 0 か。
