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
| Web (web) | 確定 | 確定質疑: qa-budget-backend-web-001。資するゴール: G2, G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、バックエンドではスマートフォンの専用アプリ向けに予算の差分同期の API をどう切るかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、バックエンドではタブレットの専用アプリ向けにオフライン入力の衝突解決の API をどう切るかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、バックエンドではWindows のデスクトップアプリが直接ファイルへ予算を書き出す経路をどう持つかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、バックエンドではLinux のデスクトップアプリが直接ファイルへ予算を書き出す経路をどう持つかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、バックエンドではmacOS のデスクトップアプリが直接ファイルへ予算を書き出す経路をどう持つかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 予算画面では依存方向を core (予算画面の算出・予算の読み出し関数・defenseLine) ← api (画面用の取得・予算の保存) ← web の一方向へ反映した。診断の予算カバー率と着地見込みは予算の読み出し関数を参照し、同じ予算の値を 2 か所で作らない。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 予算画面の api では、予算の書込みを保存 route に閉じ、core は D1 を知らない予算の行集合と Dataset だけを受け取る形へ反映した。保存と JSON snapshot の無効化を同じ D1 batch に入れ、予算だけ変わってバックアップの指紋が古いままの状態を作らない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G5

#### 主たる接地根拠: `qa-budget-backend-web-001`

**問**

web の予算画面のバックエンド要件は何か。算出・API・既存の読み手との整合をどうするか。

**答**

core に予算画面の算出を純関数として新設し、Dataset・実績期間・予算対象・保存済みの予算・計画による調整から、前期実績・自動提案 (前期実績 × (1 + 増減率) + 季節性補正 + 計画による調整 を千円に丸めた額) とその各項・見通し (実績のある月は実績、無い月は自動提案の月割)・月次の実績と予算・今後の見通しの累計・KPI (年間収入予算・年間支出予算・予算純収支・防衛ライン余裕 = 年間収入予算 − defenseLine の月額 × 12)・過不足カテゴリ (見通し − 来期予算) ・調整によるインパクト (Σ(来期予算 − 自動提案)) を 1 回で返す (qa-budget-decision-002〜004)。行は収入 (売上高・その他収入) と支出 (事業の経費科目) で、その他収入は現行の集計に系列が無いため実績 0 の手入力行とする。api は画面用の取得 1 本と、予算対象の全行をまとめて上書きする保存 1 本を設け、zod で検証し、保存は canonicalMutationFence に登録する。保存行の無い期間は既存 budgets の月額 × 12 を初期値として返す (qa-budget-decision-001)。既存の budgets の読み手 (診断の予算カバー率・予算の着地見込み・analytics) は、今月を含む予算対象の年額 ÷ 12 を返すcore の読み出し関数を経由し、同じ値を 2 か所で計算しない。旧 GET/PUT /api/budgets と POST /api/budgets/suggest は互換のため残すが、画面は使わない。外部の LLM は呼ばない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 予算画面の数値を core の純関数 1 か所 (budget-screen) から導く。前期実績は選択した実績期間の科目別合計を 12 か月あたりに換算した額、自動提案は 前期実績 × (1 + 過去 12 か月の増減率) + 季節性補正 + 計画による調整 を千円に丸めた額で、各項を根拠として返す。見通しは実績のある月は実績、無い月は自動提案の月割 (季節性を反映) とし、今後の見通しの累計・過不足カテゴリ (見通し − 来期予算) ・調整によるインパクト (来期予算 − 自動提案) を同じ関数から出す。KPI は 年間収入予算 = 収入行の来期予算の和、年間支出予算 = 支出行の来期予算の和、予算純収支 = 収入予算 − 支出予算、防衛ライン余裕 = 年間収入予算 − 防衛ライン (既存 core の defenseLine の月額) × 12 とし、一覧の合計・KPI・グラフの年合計が一致することをテストで固定する。収入の行は取込データにある『売上高』と、現行の集計に系列が無いため実績 0 の手入力行として置く『その他収入』、支出の行は事業の経費科目 (data.biz.categories) とする。外部の LLM は呼ばない。
- **G3**: 予算を予算対象の 12 か月 (開始月 YYYY-MM) ごとに科目別の年額・計画による調整額・調整の理由で保存する表を D1 に追加のみの migration で設け、同じ期間は上書きし版は持たない。保存済みの行が無い期間を開いたときは既存 budgets の月額 × 12 を初期値として示す (既存行は書き換えない)。GET /api/budget-plans?start=YYYY-MM と PUT /api/budget-plans を設け、PUT は canonicalMutationFence に登録する。診断の予算カバー率と予算の着地見込みなど既存の budgets の読み手は、今月を含む予算対象の年額 ÷ 12 を返す core の関数を経由して同じ値を読む。
- **G5**: 予算の数値が他画面とずれない。ヘッダの防衛ラインと防衛ライン余裕は同じ defenseLine、診断の予算カバー率と予算画面の設定済み科目は同じ予算の読み出し関数から導き、既存の診断・概要・家計収支・総収支・決算書の数値テストが緑のままである。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | KPI・一覧・グラフ・見通しの数値が core の 1 か所から出て互いに一致する。 | core の単体テストで、同じ Dataset・実績期間・予算対象に対し 年間収入予算 + (−年間支出予算) = 予算純収支、一覧の来期予算の和 = KPI、グラフの月次予算の年合計 = KPI、防衛ライン余裕 = 年間収入予算 − defenseLine().line × 12、自動提案 = 千円丸め(前期実績 × (1 + 増減率) + 季節性補正 + 計画による調整) の各項、過不足カテゴリの差額 = 見通し − 来期予算、調整によるインパクト = Σ(来期予算 − 自動提案) が固定される。 |
| O3 | 予算が期間ごとに保存され、既存の読み手が同じ値を読む。 | API 統合テストで、PUT が期間ごとに保存し同じ期間は上書きされ、未認証 401・フェンス違反の拒否・不正値の 400 を確かめる。migration が既存行を 1 行も書き換えないことを検査し、保存行の無い期間で既存月額 × 12 が初期値になること、診断の予算カバー率が新しい表の値から出ることを確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Budget.tsx を pages/budget/ 配下へ分割し、見出し・期間タブ・予算対象・KPI 4 枚・月次グラフ・今後の見通し・予算一覧・科目パネル・過不足カテゴリ・調整によるインパクト・保存バーの構成に作り直す。期間タブを 2年 にすると前期実績と自動提案が過去 2 年の実績から計算し直される。
- **I2**: core に予算画面の算出 (仮称 budgetScreen) を新設し、前期実績・自動提案と根拠の内訳 (前期実績・増減率・季節性補正・計画による調整)・見通し・KPI・過不足カテゴリ・調整によるインパクトを 1 か所で出す。人件費の行を選ぶと、右のパネルでその内訳から推奨値が組み上がる様子と過去 12 か月の月別実績が見える。
- **I3**: 予算対象の期間別の年額表を追加のみの migration で設け、GET / PUT /api/budget-plans と fence 登録を行い、診断の予算カバー率など既存の budgets の読み手を同じ読み出し関数へ寄せる。
- **I4**: 来期予算を自動提案より下げると、調整によるインパクトに年間の支出抑制額と予算純収支が即座に出る。入力の途中で別画面へ移って戻ると、下書きが復元され未保存の項目数が出る。

### 本章に効く確定意思決定

- **dec-budget-storage-unit**: 予算の保存単位をどうするか (期間を持たない科目別の月額 1 つか、予算対象の 12 か月ごとの年額か)。
  - 採択: 期間別の年額表を追加 (`opt-period-annual-table`)
  - 目的適合: 画像の予算対象 12 か月・年額入力と一致し、既存の月額を初期値に引き継げる。
- **dec-budget-income-scope**: 収入 (売上高・その他収入) も予算の対象にするか。
  - 採択: 収入も予算にする (`opt-include-income`)
  - 目的適合: 画像の売上高・その他収入の行と、年間収入予算・予算純収支・防衛ライン余裕の KPI を満たす。
- **dec-budget-suggestion-source**: 『AI・統計推奨』の値 (自動提案) をどう出すか。
  - 採択: 決定論＋計画調整の入力 (`opt-deterministic-with-plan`)
  - 目的適合: 決定論の根拠に加え、利用者が入力した計画による調整額と理由を推奨値と根拠に出せ、画像の根拠欄を満たす。
- **dec-budget-defense-margin**: KPI の『防衛ライン余裕』を何で数えるか。
  - 採択: 収入予算 − 防衛ライン × 12 (`opt-income-minus-line`)
  - 目的適合: ヘッダと同じ defenseLine を使い、年間収入予算が 1 年の防衛ラインをどれだけ上回るかを示す。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture の Dependency Rule を予算画面に適用した。前期実績・自動提案の各項・見通し・過不足・インパクト・KPI は入出力を持たない計算なので core に置き、api の route は zod で受けて D1 から組んだ入力を純関数へ渡し、結果を返すか書くだけにする。既存の予算の読み手も同じ core の読み出し関数を通すため、S5 の『他画面と同じ値』を単体テストで確かめられる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:35:48Z)

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
| hono-zod-validator | 0.9.1 | Hono (github.com) | https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md | 2026-09-21T13:39:51Z | 2026-09-21T13:39:51Z |
