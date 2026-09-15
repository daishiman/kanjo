---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G3, G4]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-backend-web-ah-observed-001。裏付け質疑 (`qa_refs`): `qa-analysis-hub-decision-002`, `qa-analysis-hub-decision-003`, `qa-backend-web-ah-inference-002`, `qa-backend-web-ah-decision-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではアプリ向けに GET /analysis/hub の応答形を別版で保つかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではアプリ向けに GET /analysis/hub の応答形を別版で保つかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではアプリ向けに GET /analysis/hub の応答形を別版で保つかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではアプリ向けに GET /analysis/hub の応答形を別版で保つかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではアプリ向けに GET /analysis/hub の応答形を別版で保つかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の依存方向を、core (ハブ集計・previousPeriod) ← api (route) ← web (表示) の一方向に反映した。前期間の定義を api/ai から core へ移すことで、AI の前期間比とハブの前期間比が同じ関数を通り、定義がずれる経路を無くす。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスを route 側の loadScoped と freee 系 3 テーブルの読取りに限り、core のハブ関数は D1 を知らない Dataset と配列だけを受け取る形に反映した。ハブのために新しいリポジトリ関数や SQL を増やさず、既存 /total-cashflow と同じ読取りを再利用する。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4

#### 主たる接地根拠: `qa-backend-web-ah-observed-001`

**問**

ハブの『現在の状態』と収支サマリーに使えるドメイン関数と API は現行どこまであり、何が無いか。

**答**

API は Hono の Cloudflare Worker (packages/api/src/index.ts)。/api/* に authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence を掛けてから analyticsRoute・totalCashflowRoute 等をマウントする。analytics.ts の loadScoped(c) は loadDataset(D1, userId) の全データに core の resolvePeriodQuery (from/to/year/span) と applyPeriod を掛け、PeriodMeta (applied/label/full/years/monthCount) を返す。あるもの: 照合の要確認件数 = /business-spend の summary.reviewCount と unbooked.length (core expense-projection.ts buildExpenseProjection)。総収支の重複候補件数 = /total-cashflow の review.length と月別 reviewCount/reviewAmount (core total-cashflow.ts totalCashflowReport(data, deals, bindVerdicts(verdictRows, data.mfTx), exclusions)。route は freee_deals・duplicate_verdicts・freee_deal_exclusions を userId で読み、期間の月に含まれる deal だけを渡す)。期間の月別 totalIncome/totalExpense/totalBalance (合計を返す API は無い)。改善候補 = core analysis.ts 1292 行 tradeoffCandidates(data) (amount は月あたりの捻出期待額、GET /tradeoff で公開)。前期間計算 = packages/api/src/ai/dataset.ts の previousPeriod(p) (直前の同じ長さ)・yearAgoPeriod(p) (12 か月前) で、AI 用に api 内に閉じ core には無い。無いもの: 期間合計の総収入/総支出/純収支を返す API、前 12 か月比、優先度、マトリクスの正常判定 (matrix() に判定は無く unrecordedExpMonths だけ)、数値の改善余地 (diagnosis().autoDiagnosis[].value は『目安 ▲3〜5万円/月』の文字列)、5 視点をまとめて返す集約エンドポイント。loadScoped は期間で切ったデータしか渡さないため、前期間比には all からの前期間切り出しが要る。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/{index.ts,routes/analytics.ts,routes/total-cashflow.ts,ai/dataset.ts,store.ts}, packages/core/src/{period.ts,total-cashflow.ts,expense-projection.ts,analysis.ts}。 / 回答時刻: 2026-09-14T11:38:26Z)

#### 裏付け質疑: `qa-analysis-hub-decision-002`

**問**

ハブの『現在の状態』列と前 12 か月比を出すデータはどこで計算するか。選択肢: (A) core に純関数を足し GET /analysis/hub が 1 回で 5 視点の状態・収支サマリー・前 12 か月比を返す。前期間の計算は api/ai/dataset.ts から core へ移す (推奨) / (B) API は変えずハブ表示時に既存 5 本を同時に呼び、前 12 か月比と改善余地は省く。

**答**

(A) 集約 API を新設 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-14T11:33:07Z)

#### 裏付け質疑: `qa-analysis-hub-decision-003`

**問**

画像の『優先度 (高/中)』『マトリクスの正常判定』『診断の改善余地 (金額)』は現行実装に定義が無い。どう定めるか。選択肢: (A) 単純な規則で定義する: 優先度は照合・総収支が要確認 1 件以上なら高・0 件なら中、他 3 視点は中。マトリクスは未記録月 0 なら正常。改善余地は既存 tradeoffCandidates の月額合計 × 12 の年額。規則は docs に明記しテストで固定する (推奨) / (B) 状態は件数と前 12 か月比だけにし、優先度・正常判定・改善余地は出さない。

**答**

(A) 単純な規則で定義 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-14T11:33:07Z)

#### 裏付け質疑: `qa-backend-web-ah-inference-002`

**問**

期間が 1 年以外 (2 年・3 年・任意) のとき、画像の『前 12 か月比』は何と比べるか。

**答**

既存 previousPeriod(p) と同じく『直前の同じ長さの期間』と比べ、表示ラベルは期間の月数から『前 N か月』とする (1 年選択時は画像どおり『前12か月』)。前期間の月がデータ範囲に 1 か月も無い場合は比較値を null とし画面は『比較データなし』を出す。一部だけある場合は存在する月だけで比べず null とする (欠けた期間との比較で増減率を誇張しないため)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントが 2026-09-14 に、利用者決定 qa-analysis-hub-decision-002 (前期間計算を core へ移す) と観測 qa-backend-web-ah-observed-001 (previousPeriod の定義) から導いた推測。利用者の明示選択ではない。 / 回答時刻: 2026-09-14T11:38:26Z)

#### 裏付け質疑: `qa-backend-web-ah-decision-003`

**問**

収支サマリーの『前12か月比』は、期間に 2年・3年・任意を選んだとき何と比べるか。選択肢: (A) 直前の同じ長さ。2年なら直前の2年で、ラベルは『前24か月』。既存 previousPeriod と同じ定義。前期間の月が1か月でも欠けたら『比較データなし』(推奨) / (B) 12か月前の同じ長さ (yearAgoPeriod)。季節はそろうが、2年以上では比較期間が選択期間と重なる / (C) 1年選択時だけ比較し、他は比較欄を出さない。

**答**

(A) 直前の同じ長さ を選択した。比較先は previousPeriod(p) (選択期間の直前にある同じ月数の期間) で、表示ラベルは『前 N か月』(N = 選択期間の月数。1年選択時は『前12か月』)。前期間の月がデータ範囲に 1 か月でも欠ける場合は比較値を null とし、画面は『比較データなし』を出す。G3 の『前 12 か月比』は 1 年選択時の表示例であり、比較先の定義はこの決定を正本とする。本決定は agent-inference だった qa-backend-web-ah-inference-002 を利用者の選択で置き換える。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の差し戻しを受けた再質問)。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-14T11:57:13Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: ハブに必要な集計を packages/core の純関数と、1 回で返す集約 API (GET /analysis/hub) に置く。期間の収支サマリーと前 12 か月比、5 視点それぞれの現在の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前 12 か月比・診断の改善余地) と優先度を返し、ハブ表示中に 5 タブ分の既存 API を呼ばない。
- **G4**: 優先度・マトリクスの正常判定・改善余地を単純で説明可能な規則として定義し、規則を docs に明記してテストで固定する。優先度は照合と総収支が要確認 1 件以上なら高・0 件なら中、他の 3 視点は中。マトリクスは未記録月 0 なら正常。改善余地は tradeoffCandidates の月額合計 × 12 の年額。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | core に analysisHub(dataset) 相当の純関数を置き、API に GET /analysis/hub を足す。 | core 単体テストが期間合計・前 12 か月比 (前期間データ無しは null)・5 視点の状態・優先度・改善余地を固定データで検証し、API 統合テストが認証付きで 200 と期間メタを返し、ハブ表示中の DOM テストで既存 5 API への呼出しが 0 件である。 |
| O4 | 判定規則を docs に書き、境界値をテストで固定する。 | 要確認 0 件/1 件、未記録月 0/1、tradeoff 候補 0 件の境界でテストが規則どおりの値を返し、規則を変えるとテストが落ちる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 期間の収支サマリーに総収入・総支出・純収支と前 12 か月比 (増減率と前期間の金額) を出し、純収支の説明パネルを右に置く。前期間データが無い場合は比較を『比較データなし』と表示する。
- **I4**: core にハブ集計関数を置き、GET /analysis/hub が期間メタ・サマリー・5 視点の状態・優先度を返す。前期間の計算は core へ移し AI 側もそれを使う。
- **I5**: 優先度・マトリクス正常判定・改善余地の規則を docs/ui-decisions.md (または docs 配下の分析ハブ文書) に書き、境界値テストで固定する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を、ハブ集計の置き場所に適用した。期間合計・前期間比・5 視点の状態・優先度・改善余地は入出力を持たない業務規則なので packages/core の純関数に置き、Hono の route (GET /api/analysis/hub) は loadScoped と freee 系 3 テーブルの読取りを行って core へ渡す外側の adapter に留める。AI 用として packages/api/src/ai/dataset.ts に閉じていた previousPeriod を core へ移すのも同じ規則による — 前期間の定義 (qa-backend-web-ah-decision-003) を API の内側に置くと、core のハブ関数が api に依存する逆向きの矢印になる。API Design Patterns card は、5 本の既存 API を束ねず集約エンドポイントを 1 本足す判断 (qa-analysis-hub-decision-002) に効き、応答を画面の必要量に絞ることでハブ表示中の往復を 1 回にした。DDD card の集約の考え方は、総収支の消し込み (freee 正本・未判断の重複候補を合計に入れない) を totalCashflowReport の不変条件ごと再利用し、ハブ側で件数を数え直さない判断に使った。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T11:57:54Z)

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
| hono-middleware | 4.13.7 | Hono (hono.dev) | https://hono.dev/docs/guides/middleware | 2026-09-14T11:44:16Z | 2026-09-14T11:44:16Z |
