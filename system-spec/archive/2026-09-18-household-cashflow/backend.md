---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G5]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-household-backend-web-004。裏付け質疑 (`qa_refs`): `qa-household-backend-web-evidence-001`, `qa-household-backend-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、バックエンドではモバイル向けに家計の集計を小分けにした API (月単位のページング・差分同期) を設けるかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、バックエンドではタブレットの 2 ペイン表示向けに本体とカテゴリ詳細をまとめて返す API を設けるかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、バックエンドではデスクトップアプリの端末内キャッシュと同期するための版管理 API を設けるかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、バックエンドではデスクトップアプリからの長期トークン認証を受ける経路を設けるかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、バックエンドではネイティブ版のバックグラウンド更新向けに集計の差分通知を設けるかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 依存方向を core (householdSummary・区分詳細・振替の対推定) ← api (household route・owner-labels route) ← web (家計収支画面) の一方向へ反映した。旧 household(data) と HouseholdData を削除し、総収支画面と同じ台帳の行集合を入力にする純関数へ置き換える。台帳行へ名義を足すのは core の totalCashflowLedger の中で行い、api と web は名義の解決規則を持たない。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスを route 側に閉じ、householdSummary は D1 を知らない台帳の行集合だけを受け取る形へ反映した。前年同期間の読み取りは loadScoped の範囲拡張で行い、純関数には表示期間と前年の範囲を分けて渡す。freee の取引・判定・除外は総収支と同じ loadCashflowSources で読み、家計専用の SQL を増やさない。区分詳細の主な取引 5 件も同じ行集合の絞り込みで作る。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G5

#### 主たる接地根拠: `qa-household-backend-web-004`

**問**

家計の集計ロジックと API をどこに置き、どの契約で返すか。

**答**

家計の集計は core の新しい純関数 householdSummary (household-summary.ts) 1 か所に集め、入力は総収支画面と同じ totalCashflowLedger の行集合とする (利用者決定 qa-household-decision-001)。旧 household() と HouseholdData は置き換えて削除する。台帳行へ名義 (freee 行は business、MF 行は resolveTx の owner、未解決は unset) を追加する。1 回の呼び出しで家計全体・事業・個人の総額と月平均・年換算、前年同期間 (欠けた月があれば null)、月別系列と前年同月、生活費 6 区分 (対応表は core の定数 1 か所。qa-household-decision-007)、名義別収入、振替一覧と対推定 (同額・逆符号の入出金を組にする。qa-household-decision-003。日付の許容幅と同点の決め方は qa-household-backend-web-003 (agent 推定) を参照) を返す。数値は収入・支出を正本にし、差・率・構成比は計算値にする (qa-household-decision-006)。api は GET /api/household をこの形へ拡張し、選択時だけの GET /api/household/category (主な取引 5 件と区分の月合計) と GET / PUT /api/settings/owner-labels を設ける。期間は loadScoped、freee・判定・除外は loadCashflowSources で読み、クエリと本文は zod で検証する。不変条件 (総収支の総合と一致、事業 + 個人 = 家計全体、6 区分の和 = 総支出、名義別の和 = 総収入、振替は台帳に現れない) をテストで固定する。契約の正本は specs/spec-household-cashflow-screen.md §11-§12。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-backend-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-backend-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

#### 裏付け質疑: `qa-household-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行の家計集計と総収支台帳について何を観測したか。

**答**

GET /api/household は packages/api/src/routes/analytics.ts:528-531 で loadScoped の data を core の household(data) に渡して返すだけで、専用の zod 検証を持たない。household() は packages/core/src/analysis.ts:771-790、HouseholdData は同 529-548 にあり、事業入金と事業立替を家計へ含める独自定義で前年比較を持たない。総収支の台帳は packages/core/src/total-cashflow.ts の totalCashflowLedger (798 行目) で、TrendSourceRow (703 行目) は side・io・category・payee・amount・origin・account を持つが名義を持たない。前年同期間の欠損規則は totalCashflowScreen 内で previousYearPeriod の全月が既知のときだけ前年を出す (1050-1066 行目)。振替は MfTx.isTransfer (types.ts:80) で、isMfCountable (types.ts:92-94) が台帳から除く。名義の解決は classify.ts の resolveTx が owner を返す。総収支ルートは routes/total-cashflow.ts で loadCashflowSources から deals・verdicts・除外を読む。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-18T11:33:59Z)

#### 裏付け質疑: `qa-household-backend-web-003`

**問**

web の家計収支画面で、利用者が決めていない 振替の入出金の対推定の規則 を何にするか。

**答**

TRANSFER_PAIR_MAX_DAYS = 3。同額の出金と入金を日付差 3 日以内で対にし、候補が複数あるときは日付差 → 出金側の日付 → id の順で決める。対にならないものは相手不明とする。 これは agent の推定で、利用者は未確認である。画像と決定 001〜007 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様書 specs/spec-household-cashflow-screen.md を書く際に補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-18T12:02:30Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 家計の集計を core の純関数 1 か所に集め、総収支の台帳 (totalCashflowLedger) を正本にする。総収入・総支出・純収支と月平均・年換算、事業と個人の分解 (和が家計全体に一致)、前年同期間との比較 (前年に欠けた月があれば比較不能として null)、月別の収入・支出・純収支と前年系列、生活費カテゴリ 6 区分の集計と構成比・前年差、名義別の収入と前年差を同じ関数から算出し、GET /api/household をこの形へ拡張する。総収支画面の『総合』と家計画面の『家計全体』が同じ期間で同じ数字になることをテストで固定する。
- **G3**: 生活費カテゴリの行を選ぶと『カテゴリの詳細』パネルを出す。期間合計 `current`、選択月全件合計 `monthTotal`、選択月の最大 5 件プレビュー `transactions` を分離し、カテゴリのすべて見るは月とカテゴリで絞った明細へ遷移する。
- **G5**: 振替を家計の収入・支出から除外していることを利用者が確かめられるようにする。選択月に除外した振替を家計カード内に全件 (抜粋なし) 出し、振替用の循環する『すべて見る』導線は置かない。名義間は同額・逆符号・日付が近い振替 2 行を core の純関数で対にし、それぞれの口座の名義表示名から『本人 → パートナー』のように示す。対にならない行は『相手不明』と示す。スキーマは変えない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 家計の数字が総収支画面と一致し、等式が閉じる。 | core の単体テストで、同じ Dataset と期間に対し家計全体の総収入・総支出・純収支が totalCashflowLedger の総合と toBe で一致し、事業 + 個人 = 家計全体が全月で成り立ち、前年欠損月があるとき前年差が null になる。 |
| O3 | カテゴリ詳細が選択と同期し、明細へ遷移できる。 | DOM テストで `current` / `monthTotal` / 最大 5 件の `transactions` プレビューの分離と、カテゴリのすべて見るの月・カテゴリ絞り込みを確かめる。 |
| O5 | 振替の対推定が決定論で再現する。 | core の単体テストで、同額・逆符号・日付差の許容内の 2 行が対になり、許容外・同符号・3 行以上の競合が相手不明または一意な規則で解決され、同じ入力で同じ出力になる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Household.tsx を pages/household/ 配下へ分割し、問いの見出し・出典カード・KPI と前年差・推移チャート・事業と個人の等式・カテゴリ表と詳細パネル・名義別収入・振替除外・名義ラベル設定・前年との比較・下部の選択中バーの構成に作り直し、選択中の月とカテゴリとタブを URL に保つ。
- **I3**: core に household-summary (仮称) を新設し、totalCashflowLedger の行集合から家計全体・事業・個人の総額と月別系列、前年比較、生活費 6 区分、名義別収入を 1 か所で算出する。旧 household() の独自定義は置き換える。
- **I4**: 生活費 6 区分 (住居費 / 食費 / 光熱費 / 教育費 / 交通費 / その他) と MF 大項目の対応表を core に 1 か所だけ置き、docs に同じ表を載せる。
- **I5**: カテゴリ詳細の `current` / `monthTotal` / 最大 5 件の `transactions` プレビューを返す取得経路を設け、選択時にだけ取得する。カテゴリのすべて見るは明細画面を月・カテゴリ・対象で絞った URL で開く。
- **I7**: 振替の一覧と対推定を core の純関数にし、日付差の許容・同額・逆符号・一意性の規則を docs とテストで固定する。

### 本章に効く確定意思決定

- **dec-household-categories**: 生活費の区分をどう作るか。画像の固定 6 区分へ寄せるか、金額上位 5 大項目とその他にするか。
  - 採択: 固定 6 区分へ寄せる (`opt-fixed-six`)
  - 目的適合: G1 の画像の表と一致し、G3 の詳細パネルで区分の意味が期間をまたいで一定になる。
- **dec-household-figure-source**: 画像の数値が算術で閉じない欄をどう扱うか。収入・支出を正本に差を計算するか、画像の純収支を正本にして前年の総支出を調整するか。
  - 採択: 収入・支出を正本に差を計算する (−¥80,000) (`opt-compute-from-income-expense`)
  - 目的適合: G2 の『数字は台帳の行から作る』と一致し、どの欄も算術で閉じる。見た目の数値は一部画像と変わる。
- **dec-household-ledger-source**: 家計収支の数字を何から作るか。総収支画面の台帳を正本にするか、現行の household() を拡張するか。
  - 採択: 総収支の台帳を正本にする (`opt-ledger-source`)
  - 目的適合: G2 の『家計の集計を 1 か所に集め、総収支と同じ行から作る』に直接答える。総収支の総合と家計全体が同じ行集合から出るため、両画面の数字が一致する。
- **dec-household-transfer-pairs**: 振替の欄で名義間の移動を見せるか。入出金の対を推定して表示するか、名義間の欄を出さないか。
  - 採択: 入出金の対を推定して表示する (`opt-transfer-pair-estimate`)
  - 目的適合: G5 の『振替を家計の収入・支出から除外していることを確かめられる』に、どこからどこへ動いたかまで見せて答える。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を家計集計の置き場所に適用した。家計全体・事業・個人の総額、月平均と年換算、前年同期間の欠損判定、生活費 6 区分への写像、名義別収入、振替の対推定は、いずれも入出力を持たない計算なので core の householdSummary 1 か所に置く。入力は総収支画面と同じ totalCashflowLedger の行集合に限り、旧 household() の独自定義 (事業入金・事業立替を家計へ含める) は削除する。こうすると総収支の総合と家計全体が同じ行から出るため、両画面の数字の一致を toBe の単体テストで確かめられる。api の /household と /household/category は期間とクエリを zod で受け、loadScoped と loadCashflowSources で組んだ入力を純関数へ渡して JSON に写すだけにする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T11:37:52Z)

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
| hono-zod-validator | 0.9.1 | Hono (github.com) | https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md | 2026-09-18T11:59:07Z | 2026-09-18T11:59:07Z |
