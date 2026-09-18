---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G4]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-diagnosis-backend-web-001。資するゴール: G2, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS / Android)を提供していたなら、診断画面の本カテゴリでは端末向けに通信量を抑えた返却形と、オフライン時の再送を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS / Android)を提供していたなら、診断画面の本カテゴリでは端末向けに通信量を抑えた返却形と、オフライン時の再送を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末向けに通信量を抑えた返却形と、オフライン時の再送を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末向けに通信量を抑えた返却形と、オフライン時の再送を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末向けに通信量を抑えた返却形と、オフライン時の再送を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-foundation-diagnosis-001`

2026-09-17T21:57:21Z (回答直後の date -u 実測、選択時刻の上限値) 利用者が AskUserQuestion で診断画面サイクルの foundation (U1・G1-G6・対象外・制約) を『この内容で承認』と回答した。先行する利用者決定 (同日 2026-09-17T21:51:23Z より前の同一セッション): 健全性スコア=固定費比率30%・貯蓄率30%・収支の安定性25%・データカバー率15%の重みで 0-100 へ合成する規則ベースの指標とし内訳を開閉表示する、改善アクションの対応状況=D1 の新表 (照合の reconciliation_actions と同じ型) へ保存して期間切替と再取込をまたいで引き継ぐ。指標切替 (支出/収入/純収支) と旧統計表の開閉保持も承認に含まれる。

#### この承認を名指ししている質疑: `qa-target-platforms-diagnosis-001`

**問**

診断画面 (08-diagnosis) の作り直しは、どの platform を対象にしますか。web / mobile / tablet / desktop-windows / desktop-linux / desktop-macos の6 種それぞれについて、対象に含めるか外すかを決めてください。

**答**

対象は web のみとする。mobile / tablet / desktop-windows / desktop-linux / desktop-macos の 5 種は本サイクルの対象外とする。

理由: 本プロダクト kanjo は Cloudflare Workers 上の API (packages/api) と、ブラウザへ配信する SPA (packages/web、React 18 + react-router-dom 7) の 2 つだけで構成されており、専用アプリの成果物・配布経路・ビルド設定はリポジトリに存在しない。直前の総収支画面 (PR #55)・照合画面 (PR #54)・推移画面 (PR #56) の各サイクルも同じ理由で web のみを対象としており、本サイクルで方針を変える理由がない。上位概念の対象外 (scope.out) にも『web 以外の platform』を明記して利用者承認済み (appr-foundation-diagnosis-001)。

なお web はレスポンシブで提供するため、スマートフォンのブラウザからも閲覧できる。ここで対象外にしたのは『専用アプリという成果物』であって『小さい画面』ではない。小さい画面での表示は ui-ux / frontend の web セルで扱う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (上位概念 scope.out) + リポジトリ構成の観測 (packages/ 配下は api / core / web のみ) / 回答時刻: 2026-09-17T22:01:23Z)

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 検知と健全性スコアの合成を packages/core の純粋関数へ置き、route は Dataset 組み立てと入出力に限る。検知器は配列への登録で増え、diagnosis() 側に分岐が増えない構造にする。期間と条件は Dataset を切る方式で解決し、分析関数へ引数を配らない既存の設計をそのまま延長する。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 対応状況の読取りは Dataset を 1 回読む流れの中で join し、検知器ごとに問い合わせを増やさない。更新は PATCH の 1 経路に絞り、未知の action_key と未知の status を 400 で弾いてから書く。合計は同一 action_key を 1 度しか数えず、内部は円単位の整数で保持して丸めは表示時にだけ行う。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4

#### 主たる接地根拠: `qa-diagnosis-backend-web-001`

**問**

診断画面のバックエンドはどう作りますか。改善余地の検知器を登録制にするとは具体的に何をどう置くことですか。API の返却形と、健全性スコアの算出はどこで行いますか。

**答**

**責務の置き場所**: 計算は packages/core の純粋関数に置き、packages/api (Hono on Cloudflare Workers) は Dataset の組み立てとHTTP の入出力だけを行う。core は依存を持たない既存方針を守る。

**検知器レジストリ (G2)**: packages/core/src/analysis.ts の diagnosis() がいま持っている科目名の直書き分岐 (『サブスク・通信』なら cut、『研修費』なら invest) をやめ、検知器を配列へ登録する形にする。検知器は `{ id, label, detect(data: Dataset): Improvement[] }` の形で、diagnosis() は登録済み検知器を順に回して結果を連結するだけにする。初期登録は 6 種 — 固定費の見直し / 急増した費目 / 重複支払いの候補 / サブスクの重複候補 / 未分類明細 / 通信費の見直し。既存の tradeoffCandidates() が持つ 5 種 (subs_dup / subs_spike / budget_over / above_range / unexplained) は、この登録制へ寄せて重複実装を残さない。検知器を足すとき、api と web には変更を要さないことを受入条件にする。

**Improvement の形**: id (検知器 id + 対象キー) / action_key (永続化キー) / label / detail / severity / annualImpact (年間) / monthlyImpact (月額) / effort (手間 小・中・大) / confidence (信頼度 高・中・低) / evidence[] (何をどう比べたか: 指標名・実測値・比較値・期間・出典) / nextAction (経路と表示名) / status (永続化から join)。画面が種類を知らずに描けるだけの情報を、この構造だけで満たす。

**健全性スコア (G3)**: 固定費比率 30% + 貯蓄率 30% + 収支の安定性 25% + データカバー率 15% を 0-100 へ合成する。各要素は実測値を 0-100 の要素スコアへ正規化してから重みを掛け、寄与点を内訳として返す。区分は 健全 / 注意 / 要改善。境界値 (0・100・要素が算出不能なときの扱い) を境界値テストで固定する。

**API**: GET /diagnosis を拡張し、improvements[] / health{score, band, breakdown[]} / waterfall[] / signals[] (最大 3) / evidence[] / 既存の kpi・bep・entries・autoDiagnosis を返す。既存の期間絞り込みは Dataset を切る方式 (分析関数へ引数を配らない) を維持し、条件の帯 (範囲・指標・比較対象) も Dataset 側で解決する。対応状況の更新は PATCH /diagnosis/actions/:action_key で {status, note} を受ける。未知の action_key と未知の status は 400 で拒む。

**合計の規則**: 改善インパクトの合計は、対応済み・見送りの行を除外した金額の和とする。同じ支出を二重に数えないため、同一 action_key は 1 度しか数えない。丸めは表示時のみ行い、内部は円単位の整数で保持する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存実装の観測 (packages/core/src/analysis.ts の diagnosis()/tradeoffCandidates()、packages/api/src/routes/analytics.ts:408) + 利用者決定 (健全性スコアの重み) + G2/G3/G4 / 回答時刻: 2026-09-17T22:01:23Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 改善余地の見つけ方を登録制にする。検知器の定義 (id・表示名・課題文の作り方・年間改善インパクトの見積り方・対応の手間・優先度の決め方・次のアクションの行き先・根拠に使う数値と明細の取り出し方・信頼度の出し方) を packages/core に置き、今回は固定費の見直し・急増した費目・重複支払いの候補・サブスクの重複候補・未分類明細・通信費の見直しを登録する。画面・API・表は検知器の定義から描き、検知器を足すときに画面と API のコードに検知器 id の分岐を増やさない。
- **G3**: 健全性スコアを規則ベースの合成指標として定義する。固定費比率・貯蓄率・収支の安定性・データカバー率の 4 要素を、それぞれ定義済みの変換で 0-100 の要素スコアにし、定義済みの重み (30%/30%/25%/15%) で合成して 0-100 の総合スコアと区分 (健全・注意・要改善) を出す。画面はスコアだけでなく内訳 (要素ごとの実測値・要素スコア・重み・寄与点) を開閉で示し、どの要素が点を落としているかが読めるようにする。算式・重み・区分の境界は docs と境界値テストで固定し、外部の基準値に依存しない。
- **G4**: 改善アクションの対応状況を D1 に保存して引き継ぐ。検知器と対象から決まる安定した action_key を持つ新表を作り、利用者が選んだ状態 (未着手・対応中・対応済み・見送り) と任意のメモ・決定時刻を保存する。期間の切替・再取込・再ログインをまたいで同じ判断が復元され、対応済みと見送りは既定では一覧から畳まれて改善余地の合計にも入らない (畳んだ件数と金額は注記で示し、切替で再表示できる)。検知結果が消えた action_key の記録は消さずに残し、同じ課題が再発したときに前回の判断を示す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 検知器を足すときに画面と API を編集しなくてよい。 | 検知器定義を 1 件足したテストで、画面の表・ウォーターフォール・詳細パネルと API の返却に新しい課題が現れ、packages/web と packages/api のコードに検知器 id の分岐が 0 件であることを静的検査とテストで確認する。 |
| O3 | 健全性スコアが内訳まで再現可能である。 | 要素の実測値を与える境界値テストで、要素スコア・重み・寄与点・総合スコア・区分が算式どおりに一致し、寄与点の合計が総合スコアと一致する。画面の内訳表示が core の返却値と一致する。 |
| O4 | 対応状況が期間と再取込をまたいで引き継がれる。 | 対応中に変更 → 期間切替 → 再取込 → 再取得の順で API を叩く統合テストで、同じ action_key の状態・メモ・決定時刻が保持され、対応済みと見送りが既定の一覧から畳まれ改善余地の合計から除かれ、畳んだ件数と金額が注記に現れることを確認する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: 健全性カードに 0-100 のスコアと区分を出し、開閉で 4 要素の実測値・要素スコア・重み・寄与点の内訳を示す。
- **I5**: 主なシグナルを 3 件まで、順位付きで短文と根拠の数値つきで出す。
- **I6**: 改善アクションの優先順位の表を、# ・優先度 (高/中/低)・課題・年間改善インパクト・対応の手間 (高/中/低)・ステータス (未着手/対応中/対応済み/見送り、要確認は判断待ちの検知)・次のアクション の列で出し、行を選ぶと詳細パネルと選択バーが連動する。
- **I9**: 完了すると変わる指標として、年間支出・固定費比率・月次収支の平均・貯蓄率の before→after と差分を出す。
- **I12**: 改善アクションのステータスを画面から変更でき、変更は D1 の新表へ保存される。対応済みと見送りは既定で畳まれ、注記から再表示できる。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture の『業務規則を framework から独立させる』を、検知器レジストリの置き場所の決定に使った。6 種の検知器と健全性スコアの合成規則は依存を持たない packages/core の純粋関数に置き、Hono の route は Dataset の組み立てと HTTP 入出力だけを担う。現行 diagnosis() が科目名 (『サブスク・通信』『研修費』) を直書きで分岐しているのは、業務規則が実装の内側へ癒着した状態であり、検知器を足すたびに中心が壊れる。これを `{ id, label, detect(data) }` の登録配列へ置き換え、diagnosis() は登録順に回して連結するだけにすることで、検知器の追加が api / web のコード変更を要さないことを受入条件にできる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-17T23:25:04Z)

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
| hono-zod-validator | 0.9.1 | Hono (hono.dev) | https://hono.dev/docs/guides/validation | 2026-09-17T22:05:46Z | 2026-09-17T22:05:46Z |
