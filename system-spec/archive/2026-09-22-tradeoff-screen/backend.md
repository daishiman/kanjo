---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G4, G5]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-tradeoff-backend-web-001。裏付け質疑 (`qa_refs`): `qa-tradeoff-backend-web-evidence-001`, `qa-tradeoff-backend-web-003`, `qa-tradeoff-backend-web-004`, `qa-tradeoff-decision-010`, `qa-tradeoff-decision-011`, `qa-tradeoff-backend-web-005` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、backend では端末からの試算の差分同期 APIを決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、backend ではタブレットと web の同時操作の競合を解く APIを決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、backend ではデスクトップアプリ向けの API の版管理と後方互換の期間を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、backend では古い版のデスクトップアプリからの呼び出しの拒否を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、backend ではデスクトップアプリへの通知の APIを決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 依存方向を core (試算・防衛ラインへの影響・候補集計・推奨) ← api (analytics route の tradeoff 経路と上書きの保存経路) ← web (トレードオフ画面) の一方向へ反映した。画面内のインライン計算 (Tradeoff.tsx:66) を削除し、api と web が同じ純関数の結果を使う。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスを route 側に閉じ、純関数は D1 を知らない経費行・上書き・月の余裕だけを受け取る形へ反映した。候補の集計は freee_deals を期間と io=expense で絞った 1 回の読み取りで作る。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4, G5

#### 主たる接地根拠: `qa-tradeoff-backend-web-001`

**問**

web のトレードオフ画面の規則をどこに置き、どの契約で返すか。

**答**

試算 (毎月は月額×12、単発は発生月だけ計上、削減は選んだ候補の月額合計×12、年間の差額 = 新しい支出の年額 − 削減の年額)、防衛ラインへの影響 (defenseLine の月の余裕×12 から年間の差額を引き、0 以上で維持)、科目×取引先の候補集計と直近 3 か月平均・推移・必要度の推定・自動の理由、推奨の組み合わせの列挙・評価・順位・理由を packages/core の純関数に置く (qa-tradeoff-decision-001〜003, 005, 007, 009)。GET /api/tradeoff は候補 (上書き済みの必要度とメモを重ねたもの)・防衛ラインの月の余裕・最新の試算条件を返す。候補ごとの上書き (必要度・メモ) を保存する API を新設する (qa-tradeoff-decision-002)。POST /api/tradeoff は開始月・メモ・候補キーを受け、履歴として 1 行を追加する (qa-tradeoff-decision-008)。既存の defenseLine・/api/defense-line・tradeoffCandidates・tradeoffReview の数字は変えない。具体の規則は qa-tradeoff-backend-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-tradeoff-001) と決定 qa-tradeoff-decision-001〜009 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行のトレードオフ画面まわりについて何を観測したか。

**答**

GET /api/tradeoff (routes/analytics.ts:759-794) は {candidates, budgets, plans (最大 50), review} を返し、candidates は core の tradeoffCandidates (diagnosis-detectors.ts:735。kinds は subs_dup / subs_spike / budget_over / above_range / unexplained、amount は月額) の結果である。POST /api/tradeoff (analytics.ts:805-821) は試算を 1 行追加する。防衛ラインは core の defenseLine (analysis.ts:1076-1114、line = 個人平均 + 事業固定費平均、diff = 収入見込み − line の月額、status は ok / tight / danger / nodata) と GET /api/defense-line (analytics.ts:752) にある。core の Dataset.biz.expense は科目ごとの月次合計だけで取引先を持たないが、FreeeDeal 型 (types.ts:238 以降) は partner と accountNorm を持つ。試算の計算は core に無く画面内のインラインにある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-backend-web-003`

**問**

web のトレードオフ画面で、利用者が決めていない 候補の範囲・推移と必要度の推定規則・組み合わせの列挙と順位 を何にするか。

**答**

候補は分析期間の終了月から遡る 3 か月の freee 事業経費 (io=expense) を account_norm×partner で集計し、3 か月平均月額が 1,000 円以上のものを金額降順に最大 50 件とする。取引先が空なら『取引先なし』。推移は 3 か月の最初の月に対し最後の月が +10% 超で増加、−10% 未満で減少、それ以外は横ばい。必要度は科目の既定 (地代家賃・通信費・水道光熱費・租税公課・保険料・支払利息 = 高、外注費・支払手数料・消耗品費・荷造運賃 = 中、広告宣伝費・接待交際費・会議費・新聞図書費・研修費・旅費交通費・諸会費 = 低、その他 = 中) を置き、検知器の改善案に当たる候補は 1 段下げる。組み合わせは月額上位 12 件から 2〜4 件を列挙し (最大 781 通り)、年間削減額 ≥ 新しい支出の年額のものだけを残して、リスク (必要度 高 の件数) の昇順 → 実行のしやすさ (必要度 低 の件数) の降順 → 超過額の昇順 → 件数の昇順 → 候補キーの辞書順で並べ上位 4 件を返す。充足度は 削減の年額 ÷ 新しい支出の年額 の百分率。単発の新しい支出は年額 = 金額 (発生月だけ計上)。 これは agent の推定で、利用者は未確認である。画像と決定 001〜009 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-backend-web-004`

**問**

qa-tradeoff-backend-web-003 の必要度の規則は、利用者が選んだ選択肢の説明 (qa-tradeoff-decision-002: 固定費で推移が横ばいなら高、スポットや減少傾向なら低) と食い違っている。これを利用者の選択に沿う規則へ直し、あわせて未確定だった covered の意味・サーバでの再計算・理由の文・検知器との対応付け・上書き保存の経路を決定論にするには何を置くか。

**答**

003 の必要度の規則 (科目名の固定表) は本 qa で置き換え、003 の他の規則 (候補の範囲・推移・組み合わせの列挙と順位・充足度・単発の年額) はそのまま使う。(1) 必要度の推定: 候補の科目 (account_norm) に既存の core の catProfile を当て、type と候補の推移 (003 の 3 か月の初月比) から決める。固定費で推移が横ばいか増加なら 高、スポットか推移が減少なら 低、それ以外 (準変動、または固定費で減少以外の組み合わせに当たらないもの) は 中。検知器の改善案に当たる候補は 1 段下げる (高→中、中→低、低は低のまま)。利用者が上書きした必要度があれば推定より優先する。(2) 検知器との対応付け: diagnosis-detectors の改善案の claimKeys に含まれる business:category:<科目> と候補の account_norm が一致すれば当たりとする (取引先は見ない)。(3) 関連ページ: 当たった改善案の nextAction.to をそのまま候補の関連ページにし、当たりが無い候補は関連ページを持たない。(4) 自動の理由の文: 『<type>・直近 3 か月は<推移>』を基本とし、当たりがあれば『・<改善案の label>』を続ける。利用者メモがあればメモを優先して表示する。(5) covered の意味: tradeoff_plans.covered は選んだ候補の月額合計 (円/月) とし、既存の tradeoffReview が翌月の経費の減少額 (月額) と比べる意味と揃える。(6) サーバでの再計算: POST /api/tradeoff はクライアントが送る covered・判定・候補の月額を信用せず、受け取った候補キーと開始月・支出の条件から core の同じ純関数で試算をやり直し、その結果を保存する。受け取った候補キーのうち現在の候補に無いものは 422 で拒否する。(7) 上書き保存の経路: PUT /api/tradeoff/candidates/:key (key は URL エンコードした候補キー) で必要度 (low/mid/high、または null で推定へ戻す) とメモを upsert し、成功後に web は tradeoff の query だけを無効化する。これは agent の推定で、利用者は未確認である。(1) は利用者が選んだ選択肢の説明文をそのまま規則に落としたもので、閾値 (catProfile の cv<0.6 / <1.5) は既存の core の値を使う。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: completeness evaluator の medium 指摘 (必要度の規則が利用者の選択と食い違う、covered の意味とサーバ再計算が未確定、理由・対応付け・関連ページ・上書き経路が未確定) を受けて、agent が既存コード (packages/core/src/analysis.ts の catProfile と tradeoffReview、diagnosis-detectors.ts の claimKeys と nextAction) に合わせて補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:39:50Z)

#### 裏付け質疑: `qa-tradeoff-decision-010`

**問**

候補の必要度 (低 / 中 / 高) を自動で推定する規則はどれにするか。固定費 / 準変動 / スポットは既存 core の catProfile が月ごとのばらつきで判定する。選択肢: (a) 固定費で推移が横ばいか増加なら高、スポットか減少なら低、それ以外 (準変動など) は中 [推奨] / (b) 固定費で横ばいのときだけ高、スポットか減少なら低、それ以外 (固定費で増加、準変動) は中 / (c) 推移を見ず、固定費は高・準変動は中・スポットは低。

**答**

(a) を選ぶ。固定費で推移が横ばいか増加なら高、スポットか推移が減少なら低、それ以外 (準変動など) は中とする。qa-tradeoff-backend-web-004 の (1) の規則は本決定で利用者が確定した。同 qa の『選択肢の説明文をそのまま規則に落とした』という記述は正確でなく、『増加も高』『準変動は中』は本 qa で利用者が決めた。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 3 案と推奨案を提示し、利用者本人が (a) を選択。completeness evaluator の差し戻し (R3-reask) による追補。 / 回答時刻: 2026-09-21T22:24:40Z)

#### 裏付け質疑: `qa-tradeoff-decision-011`

**問**

診断の検知器が改善案を出した候補の必要度をどう扱うか。固定費見直しの検知器 (fixed_cost_review) は月 3 万円を超える固定費すべてに当たる。選択肢: (a) 必要度は下げず、理由の文と関連ページに改善案を添えるだけにする [推奨] / (b) 固定費見直しと通信費見直し以外の検知器に当たったときだけ 1 段下げる / (c) どの検知器でも 1 段下げる (qa-tradeoff-backend-web-004 の推定)。

**答**

(a) を選ぶ。検知器の改善案に当たっても必要度は下げない。当たった改善案は『損益・メモ』の自動の理由の文 (label) と関連ページ (nextAction.to) にだけ使う。qa-tradeoff-backend-web-004 の『検知器の改善案に当たる候補は 1 段下げる』と qa-tradeoff-backend-web-003 の同趣旨の規則は本決定で取り消す。必要度は qa-tradeoff-decision-010 の規則と利用者の上書きだけで決まる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 3 案と推奨案を提示し、利用者本人が (a) を選択。completeness evaluator の差し戻し (R3-reask) による追補。 / 回答時刻: 2026-09-21T22:24:40Z)

#### 裏付け質疑: `qa-tradeoff-backend-web-005`

**問**

web のトレードオフ画面で、判定 (verdict) の条件、検知器との対応付けで使う科目の正規化、差額の扱いをどう決めるか。

**答**

判定は年間の差額 (新しい支出の年額 − 削減の年額) が 0 以下なら covered (捻出できる)、正なら insufficient (不足) とし、既存 tradeoff_plans.verdict の enum をそのまま使う。検知器との対応付けは、候補の account_norm に diagnosis-detectors.ts の claimPart と同じ正規化 (trim → NFKC → 小文字化) を掛けてから、改善案の claimKeys の business:category:<科目> と比べる。正規化の関数は core から export して 1 か所にする。差額・判定・covered (選んだ候補の月額合計) はどれも導出値で、POST の本文では受け取らず、サーバが core で計算して保存する (qa-tradeoff-backend-web-004 の (6))。これは agent の推定で、利用者は未確認である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: completeness evaluator の low 指摘 (verdict の条件・claimPart 正規化・差額が導出値であること) を受けて、agent が既存コード (packages/core/src/diagnosis-detectors.ts:112 の claimPart、packages/api/src/routes/analytics.ts の verdict enum) に合わせて補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T22:24:40Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 試算の数字を core の純関数 1 か所で導く。毎月の支出は月額×12、単発の支出は発生月だけに計上し、見直しの削減は選択した候補の月額合計×12 で年額にする。年間の差額 = 新しい支出の年額 − 削減の年額。防衛ラインへの影響は、既存 defenseLine の月の余裕×12 を『防衛ライン余裕』、そこから年間の差額を引いた値を『試算後の余裕』とし、試算後が 0 以上なら維持、負なら割れると文字で示す。 差額の符号は『新しい支出の年額 − 削減の年額』で、正は支出増 (赤の警告)、負は捻出できる。
- **G3**: 見直し候補を事業経費の科目×取引先ごとに直近 3 か月の平均月額で作る。必要度 (低 / 中 / 高) と直近の推移 (過去 3 か月の減少 / 横ばい / 増加) を core が推定し、『損益・メモ』には検知器の改善案や推移から作る自動の理由を出す。利用者は必要度を上書きしメモを書け、それらは D1 に保存して自動の値より優先する。
- **G4**: 推奨の組み合わせを core の決まったルールで出す。候補 2〜4 件の組み合わせのうち年間削減額が新しい支出の年額以上になるものを選び、充足度・実行のしやすさ (必要度の低い候補が多いほど易しい)・リスク (必要度の高い候補を含むほど高い) で順位を付けて上位 4 件を示し、選んだ組み合わせの理由の文と関連ページ (サブスク・予算・明細) へのリンクを添える。アプリは LLM を呼ばない。
- **G5**: 試算条件と候補ごとの上書きを安全に記録する。『この条件で試算』を押すたびに条件 (支出名・金額・単発 / 毎月・開始月・メモ・選んだ候補・差額) を既存 tradeoff_plans へ履歴として追加し、画面は最新の 1 件を復元する。保存一覧と翌月の突合は画面から外すが、既存の行と突合の関数は消さない。列と表は追加のみの migration で足し、入力は zod で検証し文字数に上限を設け、利用者ごとに分離する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 試算の数字が core の 1 関数から出る。 | core の契約テストで、毎月 80,000 と削減 85,000/月 のとき 年額 960,000 / 1,020,000 / 年間の差額 −60,000 (捻出できる)、単発 300,000 と削減 50,000/月 のとき 年間の差額 −300,000、毎月 100,000 と削減 50,000/月 のとき +600,000 (支出増) が出ること、防衛ライン余裕と試算後の余裕と維持 / 割れるの境界 (0) を検査し、web と api に同じ計算が無いことを grep で確かめる。 |
| O3 | 候補と必要度・推移・理由が決定論で出て、上書きが優先される。 | core の契約テストで、科目×取引先の集計・直近 3 か月平均・推移の 3 区分・必要度の推定・理由の文を固定入力で検査し、api テストで上書きの保存と読み戻し、利用者間の分離を検査する。 |
| O4 | 推奨の組み合わせが決定論で並ぶ。 | core の契約テストで、同じ入力に同じ上位 4 件と同じ順位・評価・理由が返り、年間削減額が新しい支出の年額に届かない組み合わせが入らないことを検査する。 |
| O5 | 試算条件と上書きの記録が追加のみで安全に行われる。 | migration が CREATE TABLE / ALTER TABLE ADD COLUMN だけで、api テストで zod の上限・認証・利用者分離・最新 1 件の復元を検査し、既存の tradeoff_plans の行と tradeoffReview の契約テストが緑のままである。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に試算関数 (年額・差額・単発の計上・防衛ラインへの影響) を新設し、画面の右パネル・選択中バー・計算例がそれだけを読む。
- **I3**: core に科目×取引先の候補集計・推移・必要度・自動の理由を新設し、上書きの新表と保存 API を足す。
- **I4**: core に推奨の組み合わせの列挙・評価・順位・理由を新設し、関連ページへのリンクを出す。
- **I5**: tradeoff_plans に開始月・メモ列を足し、POST で履歴を追加、GET で最新 1 件を返して画面で復元する。保存一覧と突合の表示を外す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を、試算と推奨の置き場所に適用した。年額・差額・防衛ラインへの影響・候補の推移と必要度・組み合わせの順位は、freee の経費行と上書きと月の余裕だけから決まる入出力のない計算なので core の純関数に置き、api は D1 から経費行・上書き・最新の試算を読んで純関数へ渡し JSON に写すだけにする。こうすると右パネル・選択中バー・計算例が同じ関数の結果を示し、画面ごとに符号や丸めがずれる事故を単体テストで塞げる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:19:22Z)

### Clean Architecture — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-architecture.md`

#### 目的

変化しやすいUI、DB、framework、外部サービスから、長く保持したい業務ルールとuse caseを隔離し、技術交換やテストを目的達成の阻害要因にしない。

#### 解決する問題

- 業務ルールがcontroller/ORM/UI lifecycleへ埋まり、単体で検証できない。
- 外部技術変更が内側のuse caseまで波及し、置換費用を予測できない。
- 入出力形式やvendor型が境界を越え、責務と所有者が曖昧になる。

#### 適用条件

- business ruleが外部I/Oより長寿命で、UI/DB/providerの変更可能性がある。
- 複数delivery channelや外部integrationから同じuse caseを再利用する。
- 重要なpolicyを高速・決定論的にテストする価値が、境界導入費を上回る。

#### 非適用条件

- 寿命の短い検証用prototypeで、交換可能性より学習速度が明確に優先される。
- domain ruleがほぼ無い単純変換scriptで、port/adapterが実質的な抽象を生まない。
- 外部製品そのものがsystemの目的で、抽象化すると必要機能が失われる。ただしsecurity/audit boundaryは別途必要。

#### トレードオフ・失敗モード

- 境界、DTO、mapping、dependency injectionの量が増え、小規模systemでは認知負荷が先行する。
- 「4層を作ること」が目的化すると、変化軸のないinterfaceやpass-through use caseが増える。
- domain modelを万能化してdelivery固有の制約を隠すと、現実のlatency/transaction/error semanticsを見失う。
- portを外側が定義したりinner layerがORM型を返したりすると、名前だけcleanな依存逆転になる。

#### goalへの寄与

- `essential_purpose`に直結するpolicyを外部詳細から守り、goal達成ロジックの検証を速くする。
- 制約に「vendor lock-in低減」「複数platform」「高い変更頻度」がある場合、変更範囲と移行riskを局所化する。
- 適用判断は「何層あるか」でなく、守るgoal、予想される変更、boundary testで観測する。

---

### API Design Patterns — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/api-design-patterns.md`

#### 目的

consumerとproviderの独立変更を支える安定した契約を作り、再試行、失敗、並行更新、pagination、evolutionを予測可能にする。

#### 解決する問題

- resource/operationの意味、error、null、time、identifierがendpointごとに揺れる。
- timeout後の再試行で二重処理が起き、clientが成功/失敗を判断できない。
- collection増大や並行更新でoffset paginationと全件responseが破綻する。
- version/evolution方針がなく、provider変更がconsumerを突然壊す。

#### 適用条件

- 複数client/team/organizationが独立releaseで同じservice boundaryを利用する。
- network failureとretryが通常事象で、operation結果の重複や不明状態を制御する必要がある。
- contractの長期互換性とobservabilityが局所的な実装簡潔性より重要。

#### 非適用条件

- 同一process内のprivate callで、network boundaryや独立versioningが存在しない。
- hard real-time stream、双方向session、巨大event flowなど、request/response RESTが問題形状に合わない。
- 単純CRUD表面化がdomain invariantを迂回させる場合。use-case operationまたは別interaction modelを選ぶ。

#### トレードオフ・失敗モード

- version、idempotency ledger、schema governance、compatibility testに運用費がかかる。
- 「名詞URL」だけ守ってtransaction、authorization、error semanticsを設計しない表層RESTになる。
- offset paginationは簡単だが大規模/更新中datasetで遅延・重複・欠落を起こす。
- idempotency keyのscope/TTL/payload bindingが曖昧だと、別requestを誤って同一視する。
- breaking changeを新versionで逃がし続けると、複数version保守とsecurity patch負担が増える。

#### goalへの寄与

- mobile/web/desktop間で一貫したbusiness capabilityを共有し、platform別再実装を減らす。
- reliability goalにはretry-safe operationと明示的error、delivery goalにはcontract testとadditive evolutionを結ぶ。
- 選択はAPI様式の流行でなく、consumer、latency、consistency、offline、security、cost constraintsへの適合で評価する。

---

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| hono-zod-validator | 0.9.1 | Hono (honojs) (github.com) | https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md | 2026-09-21T15:23:17Z | 2026-09-21T15:23:17Z |
