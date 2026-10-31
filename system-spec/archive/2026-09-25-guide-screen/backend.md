---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-guide-backend-web-002。裏付け質疑 (`qa_refs`): `qa-guide-backend-web-evidence-001`, `qa-guide-backend-web-004` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、backend では専用アプリの版ごとに /api/guide の応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、backend では専用アプリの版ごとに /api/guide の応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、backend では専用アプリの版ごとに /api/guide の応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、backend では専用アプリの版ごとに /api/guide の応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、backend では専用アプリの版ごとに /api/guide の応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | api の analyticsRoute に GET /api/guide を足し、既存の /summary や /defense-line と同じく loadScoped → core → JSON の 3 段に揃える形へ反映した。loadDataset の呼び出しは loadScoped の 1 回のまま増やさない。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | /api/guide は loadScoped が返す期間で切った data だけを読み、防衛ラインの値は新たに計算しない形へ反映した。防衛ラインの読み取り経路 (/defense-line・予算・トレードオフ・ヘッダ) は現行のまま 1 本も増やさない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3

#### 主たる接地根拠: `qa-guide-backend-web-002`

**問**

使い方画面の変更で API と core をどう分けるか (qa-guide-decision-008・009 を反映した取り直し)。

**答**

core に guide-screen を新設し、節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・検索を純関数で導く。api は analyticsRoute に GET /api/guide を足し、loadScoped の結果を core に渡して JSON に写すだけにする。信頼度の段階関数と期間の前後移動 (shiftedPeriod) も core に置く。core の defenseLine の算出 (直近 3 か月平均) と /defense-line の応答は変えず、その算出期間を core の名前付き定数として公開し、ガイドと用語集の説明文はその定数から組む。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 appr-foundation-guide-003 と決定 qa-guide-decision-001・005・007〜011 の範囲に収まる確定内容。qa-guide-backend-web-001 の防衛ライン変更の前提 (qa-guide-decision-004) を利用者が覆したため、reopen 後に取り直した。answered_at は記録直前に実測した時刻。 / 回答時刻: 2026-09-23T13:14:47Z)

#### 裏付け質疑: `qa-guide-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行実装について何を観測したか。

**答**

集計系の経路は packages/api/src/routes/analytics.ts に集まり、/summary (137)・/overview (252)・/defense-line (749) などが loadScoped で期間を切った Dataset を core に渡して JSON にする。/defense-line は期間で切った data だけで defenseLine を計算する。budget-screen.ts:284 と Layout のヘッダも defenseLine を使う。期間の前後移動は web 側 pages/statements/view-model.ts:121 の shiftedPeriod にだけある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-23T12:37:28Z)

#### 裏付け質疑: `qa-guide-backend-web-004`

**問**

/api/guide の応答の具体を何にするか (防衛ラインの基準月の推定を除いた取り直し)。

**答**

応答は { screen } の 1 形で、screen に period (applied・label・定義文)・totals (income・expense・net、振替除外)・dataUpdatedAt・sources (データの出所の文言)・closeStatus (月次の流れの進捗) を持つ。節や FAQ の本文は core の定数で web も同じ定数を読めるが、数値は必ず API の値を使う。防衛ラインの説明文は core の算出定数 (直近 3 か月) から組み、/api/guide は防衛ラインの値を新たに計算しない。 これは agent の推定で、利用者は未確認である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。qa-guide-backend-web-003 の防衛ライン基準月の推定は qa-guide-decision-009 で前提ごと不要になったため除いた。 / 回答時刻: 2026-09-23T13:14:47Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 説明と計算を一致させる。信頼度を 高 (80 以上) / 中 (50〜79) / 低 (49 以下) の 3 段階＋% で全画面に見せる。防衛ラインの算出 (個人生活費と事業固定費の直近 3 か月平均) は変えず、ガイドの説明を実装どおりに書く。ガイドの文言は信頼度の段階と防衛ラインの算出を core の同じ定数から引く。
- **G3**: 画面の数字と文言の対応を core の 1 か所から導く。ガイドの節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・検索を core の純関数 (guide-screen) に置き、API は JSON に写すだけ、web は描くだけにする。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 信頼度が 3 段階で全画面に出て、防衛ラインの説明が算出と一致する。 | core の単体テストが信頼度の段階境界 (49/50/79/80) を固定し、明細仕分けなど信頼度を出す画面の DOM テストが『段階＋%』で通る。ガイドと用語集の防衛ラインの説明が core の算出定数 (直近 3 か月) から導かれることを単体テストで固定し、防衛ラインの既存テストは値を変えずに通る。 |
| O3 | ガイドの導出が core の 1 か所に集まる。 | core の guide-screen の単体テストが節・よくある疑問・期間の表・このページの数値・検索を固定し、web と api に同じ導出の重複が無い (guide-sections.ts の現在値合成は core へ移る)。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に guide-screen を新設し、節・ステップ・よくある疑問・期間の表・このページの数値 (選択中の期間・期間の定義・データの出所・最終更新)・関連ページ・ガイド内検索を純関数で導く。guide-sections.ts の現在値合成を core へ移す。
- **I3**: GET /api/guide を追加し、選択期間の総収入・総支出・純収支 (振替除外)・最終更新・データの出所を core の guide-screen で JSON に写す。利用者ごとに分離し期間クエリを検証する。
- **I4**: core に信頼度の段階関数 (高/中/低) を置き、信頼度を出す全画面を『段階＋%』表示にする。自動判定の閾値は変えない。
- **I5**: 防衛ラインの算出 (個人生活費と事業固定費の直近 3 か月平均) を説明する文言を core の算出定数から引き、使い方画面と用語集の説明を実装どおりにする。defenseLine の算出と数値は変えない。
- **I7**: 期間の前後移動 (shiftedPeriod) を core へ移し、決算書と使い方画面で共有する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を、使い方画面の数値と説明文の置き場所に適用した。ガイドの節・現在値・検索と、信頼度の段階・期間の前後移動は入出力のない計算なので core に置き、api の GET /api/guide は loadScoped の結果を core に渡して JSON に写すだけにする。防衛ラインは算出を変えず、その算出期間 (直近 3 か月) を core の名前付き定数として公開し、ガイドと用語集の説明文を同じ定数から組むので、説明と計算が画面ごとにずれない。API Design card の『資源ごとに 1 つの形を返す』は /api/guide の応答を { screen } の 1 形に揃えることに当て、DDD card のユビキタス言語は画面・用語集・ヘッダで『防衛ライン』の 1 語を保つことに当てた (qa-guide-decision-010)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T13:15:27Z)

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
| hono-routing | 4.13.8 | Hono (honojs) (github.com) | https://github.com/honojs/hono/blob/main/package.json | 2026-09-23T12:39:53Z | 2026-09-23T12:39:53Z |
