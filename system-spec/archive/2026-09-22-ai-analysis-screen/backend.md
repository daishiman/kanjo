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
| Web (web) | 確定 | 確定質疑: qa-ai-backend-web-001。裏付け質疑 (`qa_refs`): `qa-ai-backend-web-evidence-001`, `qa-ai-backend-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、backend では端末からの長いポーリングを避けるための依頼の状態変化の通知 APIを決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、backend ではタブレットと web で同じ依頼を同時に操作したときの競合規則を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、backend ではデスクトップアプリ向けの API 版管理と後方互換の期間を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、backend ではデスクトップアプリ向けの API 版管理と、古い版からの呼び出しの拒否を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、backend ではデスクトップアプリから AI エージェントを直接起動する経路の要否を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 依存方向を core (段階の導出・T-番号・版の説明・タブの振り分け・JSON エラー位置) ← api (ai route と agent route) ← web (AI分析画面) の一方向へ反映した。api の taskStatus と web の状態文言を削除し、両者が同じ純関数の結果を使う。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスを route 側に閉じ、段階の純関数は D1 を知らない依頼の記録 (時刻列と現在時刻) だけを受け取る形へ反映した。使用するデータの件数は期間で絞った既存の表の件数読み取りで作り、AI 用の SQL を増やさない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G5

#### 主たる接地根拠: `qa-ai-backend-web-001`

**問**

AI 依頼の段階・操作・使用するデータの規則をどこに置き、どの契約で返すか。

**答**

段階と進捗の導出 (待機中 0 / 実行中 50 / 実行中 75 / 完了 100 / 失敗 / キャンセル、qa-ai-decision-002)、T-番号の整形、版の説明の導出 (qa-ai-decision-007)、レポートのタブへの振り分け (qa-ai-decision-008)、JSON 取り込みエラーの行・位置の算出を packages/core の純関数に置き、api の taskStatus はこれに置き換える。GET /ai/tasks は段階・進捗・T-番号を返す。POST /ai/tasks/:id/cancel はトークンを無効にして行を残し、POST /ai/tasks/:id/retry は同じ期間と補足指示で新しい依頼とトークンを返す。DELETE /ai/tasks/:id は結果の無い依頼だけを消す (qa-ai-decision-003)。GET /ai/inventory は期間の使用するデータ (freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数) を返す (qa-ai-decision-004)。エージェントのデータ取得で取得時刻を、形式エラーの差し戻しで差し戻し時刻と回数を記録する。期間は usePeriod の範囲をそのまま受け、前年比較に要る範囲は API が導く (qa-ai-decision-001)。レポート JSON 契約 v3 と skill は変えない。具体の優先順位と数え方は qa-ai-backend-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-ai-analysis-001) と決定 qa-ai-decision-001〜008 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行の AI 依頼の状態判定と経路について何を観測したか。

**答**

packages/api/src/routes/ai.ts の taskStatus (ai.ts:68-72) は used_at があれば done、expires_at を過ぎれば expired、それ以外 waiting の 3 値だけを返す。レポートの形式エラーは reportValidator (ai.ts:40-56) が 400 invalid_report と issues 最大 20 件で返すが、差し戻しの事実は記録しない。エージェントのデータ取得 GET /ai/tasks/:id/data (ai.ts:476) も取得時刻を記録しない。DELETE /ai/tasks/:id (ai.ts:373-411) は結果待ちの依頼を行ごと削除し (画面では『取り消し』と呼ぶ)、受信済みは 409 already_done で拒否する。再実行の経路は無い。AI へ渡すデータは packages/api/src/ai/dataset.ts が組み、冒頭 (dataset.ts:2) に『集計値だけ。明細行・摘要・ルール・編集は含めない』とある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-backend-web-003`

**問**

web の AI分析画面で、利用者が決めていない 段階の判定の優先順位と、使用するデータの数え方 を何にするか。

**答**

段階は キャンセル (canceled_at あり) → 完了 (used_at あり) → 失敗 (期限切れ) → 実行中 75% (rejected_at あり) → 実行中 50% (data_fetched_at あり) → 待機中 0% の順で最初に当たったものとする。使用するデータは、期間内の freee 取引の件数、期間内で集計対象の MF 明細の件数 (振替と除外を除く)、期間内に出現した科目の種類数、期間内に出現した取引先の種類数とする。 これは agent の推定で、利用者は未確認である。画像と決定 001〜008 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-19T12:36:49Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 依頼の段階と進捗を core の純関数 1 か所で記録から導く。発行済みでデータ未取得 = 待機中 0%、データ取得済み = 実行中 50%、形式エラーで差し戻し = 実行中 75%、受信 = 完了 100%、結果なしで期限切れ = 失敗、取り消し = キャンセル。依頼には利用者ごとの連番から T-0001 形式の ID を振る。
- **G3**: 依頼の操作を画面で決着できるようにする。キャンセルはトークンを無効にして行を残し、再実行は同じ期間と補足指示で新しい依頼を発行し、削除は結果の無い依頼だけを消す (受信済みは削除不可)。依頼の発行とプロンプトのコピーを 1 操作にする。
- **G5**: データの扱いと安全を固める。使用するデータのカードは実データ (対象期間・freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数) を新しい API で返し、AI へは集計値だけを渡す。エージェント用と貼り付けの経路に body の上限を設け、キャンセル済み・期限切れのトークンを拒否する。段階を導くための列 (連番・データ取得時刻・差し戻し時刻と回数・取消時刻) は追加のみの migration で足す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 依頼の段階と進捗が記録から一意に決まる。 | core の単体テストで、6 つの段階 (待機中 0 / 実行中 50 / 実行中 75 / 完了 100 / 失敗 / キャンセル) が記録の組合せから toBe で導かれ、期限切れと受信・取消の優先順位が境界ケースで固定される。 |
| O3 | キャンセル・再実行・削除が規則どおりに効く。 | API テストで、キャンセル後のトークンがデータ取得とレポート送信で拒否され行が残ること、再実行が同じ期間と補足指示の新しい依頼を作ること、受信済みの依頼の削除が拒否されることを確かめる。 |
| O5 | データの件数が実データと一致し、外部へ出るのは集計値だけである。 | API テストで、使用するデータの件数が同じ期間の D1 行数と一致し、エージェントへ渡すデータセットに明細行と摘要が含まれず、上限を超える body が 413 で止まることを確かめる。migration は追加のみで既存行の書き換えが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に依頼の段階と進捗を導く純関数と T-番号の整形を新設し、api の taskStatus と web の表示をこれに寄せる。
- **I3**: キャンセル (トークン無効化・行を残す) と再実行 (同じ期間と補足指示で新規発行) の API を足し、実行中の表の操作列から呼ぶ。発行とコピーを 1 操作にする。
- **I6**: 使用するデータの件数 API を足し、エージェント経路と貼り付け経路へ body 上限を掛け、追加のみの migration で段階の記録列を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を、依頼の段階と進捗の置き場所に適用した。段階 (待機中 0 / 実行中 50 / 実行中 75 / 完了 100 / 失敗 / キャンセル) は ai_tasks の時刻列と現在時刻だけから決まる入出力のない計算なので core の純関数 1 か所に置き、api の taskStatus (done / expired / waiting の 3 値) はこれに置き換える。T-番号の整形・版の説明 (補足指示の 1 行目か既定文)・レポートのタブへの振り分け・JSON 取り込みエラーの行と位置も同じく core に置く。api はキャンセル・再実行・使用するデータの経路で D1 を読み書きし、判定は純関数へ渡して JSON に写すだけにする。こうすると画面の表示と agentGuard の拒否が同じ判定から出るため、キャンセル済みなのに画面では実行中に見えるといったずれを単体テストで塞げる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T12:38:49Z)

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
| hono-zod-validator | 0.9.1 | Hono (honojs) (github.com) | https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md | 2026-09-19T12:40:44Z | 2026-09-19T12:40:44Z |
