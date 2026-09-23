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
| Web (web) | 確定 | 確定質疑: qa-cash-backend-web-005。裏付け質疑 (`qa_refs`): `qa-cash-backend-web-evidence-001`, `qa-cash-backend-web-003`, `qa-cash-decision-006`, `qa-cash-decision-009` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、backend ではオフラインで作られた明細の後着と、論理削除・復元の競合解決を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、backend では複数端末から同じ明細を同時に編集したときの競合解決を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、backend では端末ごとの同期カーソルを返す APIを決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、backend では端末ごとの同期カーソルの失効規則を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、backend ではバックグラウンド同期用の差分取得 APIを決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | api の cash 経路から集計・絞り込みの計算を外し、core の cash-screen を唯一の計算元にする形へ反映した。論理削除・復元・一括削除・一括復元の各経路は、行の状態を変えて取引と集計を作り直すことだけを担い、canonical-mutation-fence に登録して既存の書込と同じ順序保証に乗せる。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 削除中の行を読まない条件を、cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に同じ deleted_at IS NULL として掛ける形へ反映した。読み取りの正本が 1 か所に集まっていないため、経路の一覧を仕様に持ち、経路ごとの API テストで条件の抜けを検出する。削除・復元・一括削除・一括復元の書き込みは、それぞれの経路 1 か所の D1 batch でだけ行う。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4

#### 主たる接地根拠: `qa-cash-backend-web-005`

**問**

削除中の行を読まない条件と一括復元を含めて、API は何を返し何を拒否するか。

**答**

core の cash-screen.ts が合計・絞り込み・ページング・入力経路・交通費の合計・入力検証を導き、API は JSON に写すだけにする。DELETE /api/cash-entries/:id は論理削除 (deleted_at を付けて同じ batch で取引と集計を作り直す)、POST /api/cash-entries/:id/restore は同じ id を戻し、POST /api/cash-entries/bulk-delete と POST /api/cash-entries/bulk-restore は 100 件までの id 配列を 1 batch で処理し、他の利用者の id や完全消去済みの id を 1 件でも含めば全体を 404 にする。削除中の行を読まない条件 (deleted_at IS NULL) を cash_entries を読む全経路 5 本 — loadCashEntries (store.ts。一覧と loadDataset が使う)、バックアップの BACKUP_SNAPSHOT_SQL (store.ts。エクスポートと夜間バックアップが共有)、取込時の設定スナップショット loadImportRestoreSettingsSnapshot (store.ts)、科目使用状況 loadCategoryUsageContext (routes/settings.ts)、PUT の既存行取得 (routes/cash.ts) — に掛け、PUT は削除中の行を 404 にする。新しい restore / bulk-delete / bulk-restore の経路は canonical-mutation-fence に登録し、既存の POST / PUT / DELETE と同じ書込の順序保証に乗せる。POST / PUT は owner と transit_purpose を受ける。例外は 1 つだけで、JSON 復元の『移行先の現金明細が 0 件か』の判定だけは削除中の行も数える (loadImportRestoreSettingsSnapshot の destination_counts に、削除中を含む現金明細の件数を 1 つ足す)。削除中の行が残っている間は現金明細を復元せず、理由を表示する。バックアップの id をそのまま INSERT して主キーが衝突し、復元全体が失敗することを防ぐためである。件数のほかに、削除中の行の中身はどの出力にも出さない (qa-cash-decision-009)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の承認 (appr-foundation-cash-004、qa-cash-decision-010) と、決定 qa-cash-decision-006 (一括復元) / 009 (JSON 復元の件数の例外) の範囲に収まる確定内容。前回の確定 (qa-cash-backend-web-004) に例外の記述を足した。JSON 復元の判定は routes/imports.ts と store.ts の現物で確認した。 / 回答時刻: 2026-09-21T22:45:23Z)

#### 裏付け質疑: `qa-cash-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行実装について何を観測したか。

**答**

cash の API は packages/api/src/routes/cash.ts の GET/POST /api/cash-entries と PUT/DELETE /api/cash-entries/:id。書込後は recomputeFromDeals / planRecomputeFromDeals で現金明細から導く取引と集計を同じ D1 batch で作り直し、JSON スナップショットを無効化する (:198-275)。導出の純関数は packages/core/src/cash.ts (309 行: cashToDeal・cashToTx・buildTransitEntry・findCashDealDuplicates など) にある。名義の語彙は packages/core/src/types.ts:114 の OWNER_VALUES (business / spouse / family) で、未設定 (null) を許す。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-backend-web-003`

**問**

web の現金入力画面で、利用者が決めていない 復元・一括削除の具体の上限と期限切れの扱いを何にするか。

**答**

一括削除は 1 回 100 件まで。完全消去済みの id の復元は 404 にする。復元時の科目が科目表から消えていても行は戻し、科目の検証は次の編集時に行う。 これは agent の推定で、利用者は未確認である。画像と決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-decision-006`

**問**

一覧の選択から一括削除した行を、削除完了トーストの『元に戻す』でどう戻すか。現行の仕様には 1 件ずつの復元しか無い。

**答**

一括復元の API を足す。POST /api/cash-entries/bulk-restore が一括削除と同じ id の配列 (100 件まで) を受け、他の利用者の id や完全消去済みの id を 1 件でも含めば全体を 404 にして何も戻さず、全件を 1 つの D1 batch で deleted_at を外して取引と集計を作り直す。トーストの『元に戻す』は一括削除した id をそのまま渡す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 (一括復元の API を足す・1 件ずつ復元を繰り返す・一括削除では元に戻すを出さない) と推奨案を提示し、利用者が「一括復元の API を足す (推奨)」を選択。answered_at は選択時刻の上界。 / 回答時刻: 2026-09-21T15:34:28Z)

#### 裏付け質疑: `qa-cash-decision-009`

**問**

JSON 復元は移行先の現金明細が 0 件のときだけバックアップの明細を id のまま入れる。削除中の行だけが残る利用者は 0 件と判定され、主キーが衝突して復元全体が失敗する。どう扱うか。

**答**

削除中も件数に数える。『空か』の判定だけは削除中の行を数え、削除中の行が残る間は現金明細を復元せず理由を表示する。削除中の行を他のどの出力にも出さない不変条件の例外は、この件数 1 つだけとする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 3 件 (削除中も件数に数える・復元前に削除中の行を消す・衝突した行だけ飛ばす) と推奨案を提示し、利用者が「削除中も件数に数える (推奨)」を選択。answered_at は選択時刻の上界。 / 回答時刻: 2026-09-21T22:44:32Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 記録が消えない。入力途中の内容はブラウザ内に自動保存して復元でき、削除は論理削除として一覧と集計から外したうえで『元に戻す』で同じ行を復活でき、30 日後に夜間処理で完全に消える。
- **G3**: 画面の数字と判定を core の 1 か所から導く。合計・絞り込み・ページング・入力経路・交通費の合計・入力検証を core の純関数に置き、API は JSON に写すだけ、web は描くだけにする。
- **G4**: 現金明細の入力と変更を安全に保つ。利用者ごとの分離、入力検証、削除・復元の権限確認、削除済み行を集計へ混ぜない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 下書きと論理削除で記録が欠けない。 | DOM テストで入力→再描画後に下書きが復元されること、API テストで削除→元に戻すで同じ id が一覧に戻ること、削除中の行が集計 (cashToDeal / cashToTx の入力) に 0 件であることが通る。 |
| O3 | 画面の導出が core の 1 か所に集まる。 | core の cash-screen の単体テストが合計・絞り込み・ページング・入力経路・交通費合計を固定し、web と api に同じ計算の重複が無い (grep で 0 件)。 |
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に cash-screen を新設し、合計 (収入・支出・差額)、絞り込み (キーワード・収支・カテゴリ・名義・入力経路・金額と日付の範囲)、ページング、入力経路、交通費合計を純関数で導く。
- **I3**: cash_entries に owner・transit_purpose・deleted_at を足す追加のみの migration 0050 (入力経路は列を持たず交通費の区間の有無から導く) と、削除・復元・一括削除・一括復元の API、削除中の行を読まない条件を cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に掛けること、夜間の完全消去を実装する。 JSON 復元の『空か』判定だけは削除中の行も数え、削除中の行が残る間は現金明細を復元しない (qa-cash-decision-009)。
- **I4**: 入力途中の内容をブラウザ内に自動保存し、保存時刻を表示し、復元する。『入力をクリア』で下書きも消す。
- **I5**: 削除をインライン確認にし、削除完了トーストの『元に戻す』で同じ行を復活させる。空状態では画面内だけのサンプル表示と『はじめての明細を入力』を出す。
- **I6**: 入力検証 (名義・業務の目的・カテゴリの候補、文字数、金額の範囲) を core と API の zod で揃え、他の利用者の行を 404 にする。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を、現金入力の合計・絞り込み・入力経路・交通費合計の置き場所に適用した。これらは明細の配列と条件だけから決まる入出力のない計算なので core の cash-screen 1 か所に置き、api は D1 の読み書き (論理削除・復元・一括削除・一括復元と、同じ batch での取引と集計の作り直し) だけを担って判定を持たない。画面の合計と API の応答が同じ関数から出るので、差額が画面と集計でずれることを単体テストで塞げる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:38:32Z)

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
| hono-zod-validator | 0.9.1 | Hono (honojs) (github.com) | https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
