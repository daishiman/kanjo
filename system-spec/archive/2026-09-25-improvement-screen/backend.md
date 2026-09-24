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
| Web (web) | 確定 | 確定質疑: qa-imp-backend-web-001。裏付け質疑 (`qa_refs`): `qa-imp-backend-web-evidence-001`, `qa-imp-decision-001`, `qa-imp-decision-003`, `qa-imp-decision-006` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、backend ではその端末からの API 呼び出しをネイティブのトークン保管で認証する方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、backend ではその端末からの API 呼び出しをネイティブのトークン保管で認証する方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、backend ではその端末からの API 呼び出しをネイティブのトークン保管で認証する方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、backend ではその端末からの API 呼び出しをネイティブのトークン保管で認証する方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、backend ではその端末からの API 呼び出しをネイティブのトークン保管で認証する方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | routes/improvement.ts から一覧の絞り込みと件数の計算を外し、core の improvement-screen を唯一の計算元にする形へ反映した。状態の変更・再発行・削除・復元の各経路は、core が許した遷移だけを D1 batch 1 つで書き (依頼の行と履歴の行を同じ batch に入れる)、結果を JSON に写す。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 削除中の行を読まない条件 (deleted_at IS NULL) を、improvement_requests を読む全経路 (一覧・件数・詳細・画像・指示文・コピー記録・状態・agent の 2 経路・関連する依頼) に掛ける形へ反映した。経路の一覧を仕様に持ち、経路ごとの API テストで条件の抜けを検出する。取引先名の辞書は、作成時に利用者自身の transactions.partner だけを 1 本のクエリで読む。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4

#### 主たる接地根拠: `qa-imp-backend-web-001`

**問**

backend の web の方針を次の内容で確定してよいか。

**答**

一覧 (検索・件数タブ・10 件ずつ)、詳細 (履歴と関連する依頼 3 件)、作成、状態の変更 (遷移の可否は core が判定)、再発行、コピー記録、削除、復元を zod で検証する。判定と導出は core の improvement-screen に置き、API は結果を JSON に写すだけにする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 8 カテゴリの web 方針を表で提示し、AskUserQuestion の選択肢『この8カテゴリで確定 (推奨) / 修正して再提示』から利用者が『この8カテゴリで確定』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:16:38Z)

#### 裏付け質疑: `qa-imp-backend-web-evidence-001`

**問**

backend の web について、現行の実装と画像の差分は何か。

**答**

現行 api は packages/api/src/routes/improvement.ts に、POST /improvements (multipart, L130)・一覧 GET (L242)・詳細 GET :id (L254)・画像 GET :id/screenshot (L267)・指示文 POST :id/prompt (L311)・コピー記録 POST :id/copied (L359)・状態 POST :id/status (L374)・agent 用 GET :id/agent/data (L443) と :id/agent/screenshot (L472) を持つ。DELETE は無く、一覧に検索・件数・ページングも無い。指示文は improvement/contract.ts の buildImprovementPrompt (L185) が組み立てる。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: repo の現物 (該当ファイルと行) と design/FINAL-UI/images/20-improvement.png を読んで観測した事実。answered_at は記録直前に実測した時刻。 / 回答時刻: 2026-09-23T13:17:45Z)

#### 裏付け質疑: `qa-imp-decision-001`

**問**

画像の状態タブ (受付 / 対応中 / 完了 / 再確認) を現行の 4 状態 (未対応 / 対応中 / 対応済み / 対応しない) とどう対応させるか。

**答**

受付 / 対応中 / 完了 / 再確認 の 4 状態にする。再確認は『利用者の確認待ち』(開発側が直したので利用者が確かめる段階)。既存の対応しない (wontfix) は完了へ移し、理由をアクティビティに残す。30 日削除の起点は完了のまま。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 3 件と推奨案を提示し、利用者が『再確認=利用者の確認待ち (推奨)』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:05:47Z)

#### 裏付け質疑: `qa-imp-decision-003`

**問**

詳細パネルの『削除』をどう扱うか (物理削除 / 論理削除)。

**答**

論理削除にし、完了トーストの『元に戻す』で同じ番号のまま戻す。削除から 30 日後に夜間処理で本文・画像・履歴を完全消去する。削除中の依頼は一覧・件数・agent 経路のどこからも読まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案を提示し、利用者が『論理削除＋元に戻す (推奨)』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:05:47Z)

#### 裏付け質疑: `qa-imp-decision-006`

**問**

詳細パネルの『関連する依頼』をどう決めるか (手動で紐付ける / 自動で導出する)。

**答**

同じ関連ページの他の依頼を新しい順に最大 3 件、core で自動導出する。手動の紐付けは作らない。削除中の依頼は含めない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案を提示し、利用者が『同じ関連ページから自動 (推奨)』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:06:50Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 画面の数字と判定を core の 1 か所から導く。状態の体系と遷移、概要の切り出し、IMP 番号の表示、検索・件数タブ・ページング、関連する依頼、アクティビティの表示、診断情報の表示用要約 (OS・ブラウザ・画面サイズ・利用環境・伏せたセッション ID)、マスク規則を core の純関数に置き、API は JSON に写すだけ、web は描くだけにする。
- **G4**: 依頼と添付を安全に保つ。利用者ごとの分離、入力検証 (本文 1000 字・プライバシー確認 2 つ・画像の形式と大きさ)、削除は論理削除で『元に戻す』で戻し 30 日後に夜間処理で本文・画像・履歴を完全消去、使い捨てトークンの再発行、夜間バックアップへ添付を入れない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 画面の導出が core の 1 か所に集まる。 | core の improvement-screen の単体テストが状態遷移・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約を固定し、web と api に同じ計算の重複が無い (grep で 0 件)。 |
| O4 | 削除・分離・保持期限・既存ゲートを守る。 | API テストで削除→元に戻すで同じ id と番号が戻ること、削除中の行が一覧と件数に 0 件、他の利用者の依頼が 404、30 日経過の完全消去で R2 の画像と履歴が消えること、BACKUP_SNAPSHOT_SQL に改善リクエストの表が無いことが通り、pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に improvement-screen を新設し、状態の体系と許される遷移、概要の切り出し、IMP 番号の表示、検索・件数タブ・ページング、関連する依頼、アクティビティの表示、診断情報の表示用要約を純関数で導く。
- **I4**: migration 0054 で状態の CHECK の張り替え (wontfix→done の移し替え)、利用者ごとの連番、論理削除の列、アクティビティの表を足し、削除・復元・状態変更・再発行で履歴を書く API と夜間の完全消去を実装する。
- **I6**: 入力検証 (本文 1000 字・プライバシー確認 2 つ・状態の候補・画像の形式と大きさ) を core と API の zod で揃え、他の利用者の依頼を 404 にする。

### 本章に効く確定意思決定

- **D-imp-008**: 夜間 scheduledMaintenance の D1 予算は 49/49 (Free の 1 invocation あたり 50 クエリ、1 本は必ず残す) で満杯。削除した改善リクエストを 30 日後に行と履歴ごと消す DELETE を 1 本足すにはどうするか。
  - 採択: 他 job の枠を 1 本回す (`borrow-slot`)
  - 目的適合: G4 の完全消去をアプリのコードとテストに明示したまま満たす。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を、状態の遷移・概要・IMP 番号・検索・件数タブ・ページング・関連する依頼・アクティビティ・診断の表示用要約の置き場所に適用した。これらは入出力を持たない計算なので、core の improvement-screen 1 か所に置く。api は D1 と R2 の読み書きだけを担う。API Design Patterns card の『Resource and operation semantics』と『Error model』は、新しい経路の意味づけに当てた。削除は DELETE /api/improvements/:id で論理削除、復元は POST /api/improvements/:id/restore にする。どちらも同じ状態へ何度送っても結果が変わらない (冪等) ようにする。他の利用者の id と存在しない id はどちらも 404、zod の検証に落ちた入力は 400 にして、欄ごとの理由を返す。DDD card の『Aggregate』と『Domain Event』は、依頼と履歴の書き方に当てた。依頼の行と、状態の変更・再発行・削除・復元の履歴 1 行は、同じ D1 batch で書く。履歴は起きた事実として追記するだけで、書き換えない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T13:33:08Z)

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
| hono-zod-validator | 4.13.8 | Hono (hono.dev) | https://hono.dev/docs/guides/validation | 2026-09-23T13:21:07Z | 2026-09-23T13:22:20Z |
