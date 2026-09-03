---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G1, G2, G3, G4, G5, G6, G7]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-016 |
| モバイル (mobile) | 対象外 | 理由: 専用モバイルアプリを提供せず、webのレスポンシブ表示で到達するためモバイル固有の要件を持たない |
| タブレット (tablet) | 対象外 | 理由: 専用タブレットアプリを提供せず、webのレスポンシブ表示で到達するためタブレット固有の要件を持たない |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 確定内容 (質疑録)

### qa-010 (対応セル: web)

**質問**: web のサーバ側処理は、4粒度の削除・上書き・undo・再収束に加えて、3点比較による変更元の判別と決め事の自動適用までをどう実装するか。

**回答**: 本章は qa-003 (削除・上書き・undo のサーバ処理) と qa-007 (3点比較と自動適用) を統合した内容を要件とする。(1) 4粒度の削除 (G1): 明細単位・取込単位・期間単位・全件の削除エンドポイントを設け、いずれも削除前に対象件数と影響範囲を返す事前確認 (preflight) を持つ。既存の import-lifecycle.ts の writer claim (利用者別単一 writer・TTL 15分) を削除にも適用し、取込と削除が同時に走らないようにする。(2) undo (G4): 削除・上書きの直前状態を退避テーブルへ書いてから本体を変更し、退避と本体変更を同じバッチに載せて原子性を確保する。(3) 再収束 (G5): 削除後に import_active_targets の指紋を巻き戻し、monthly_agg を実データから再計算する。(4) 変更元の判別 (G7): 取込時、明細ごとに base (前回取込原本値) / current (tx_edits の手当て) / incoming (新CSVの原本値) を属性ごとに突き合わせ、base == incoming なら手当てを維持、base != incoming かつ利用者が触っていない (当該列が NULL) なら incoming を採って base を進める、base != incoming かつ利用者が触っている場合だけ衝突として提示する (既定は手当て維持)。この3分岐により、先月と今月で内容が食い違っても衝突以外はすべて自動で決まる。(5) 決め事の自動適用 (G6): tx_edits も rules も当たらない明細は、正規化した取引先名を vendor_key として vendor_memory を引き、confidence が閾値以上なら自動適用し、閾値未満なら候補提示に留める。confidence は同一 vendor_key で同じ値が選ばれた回数 hit_count と自動適用が取り消された回数 disagree_count から算出し、利用者の回答があるたびに更新する。pinned の決め事は confidence によらず常に適用する。(6) 差分の算出 (G2): 上記判定の結果を、自動で決まった分と衝突分に分けて集計し、画面へ渡す。(7) 説明可能性 (G4): 判定ごとに自動判定か衝突かの別と採用根拠 (どの規則・決め事・分岐で決まったか) を監査記録へ残す。(8) D1 の制約遵守: Worker 1回の呼び出しあたりクエリは Free で 50 本のため、判定は取込単位でまとめ読みし、書戻しは SQLite の UPSERT (INSERT ... ON CONFLICT DO UPDATE) で存在確認の SELECT を省いて1文にまとめ、件数に応じて既存の planMultipartImportQueries と同じ考え方で分割実行する。学習・判定はすべて D1 内のデータだけで行い、明細を外部サービスや推論モデルへ送らない。

### qa-012 (対応セル: web)

**質問**: D4(vendor_memory の確信度)・D5(衝突を属性単位へ)・D6(base の遅延埋め)の確定を受けて、サーバ側の判定と再適用はどう振る舞うか。

**回答**: 本 turn は D4・D5・D6 の利用者決裁を受けた backend の追補である。(1) 衝突の粒度 (G2/G7): 3点比較の結果は明細単位の真偽1つではなく、対象4属性それぞれについて DR-10 の3分岐 (取込元だけが変わった / 利用者だけが変えた / 双方が変わった) のいずれかを返す形とする。明細単位の真偽を導出値として併存させない。真実の源を1つに保ち、画面と API で衝突件数が食い違う経路を作らないためである。戻り値型の変更は、これを読む分類 API・分類画面・既存試験へ同一の変更単位で追随させ、取込経路が動かない期間を作らない。属性が将来増えたときに3分岐の網羅が崩れないよう、属性の集合と3分岐を型で表し、分岐漏れが型検査で落ちる形にする。(2) base を持たない既存明細の扱い (G3/G7): base を持たない明細は、その取込を始める直前の現行値を base として埋めてから3点比較へ入る。埋め込みは必ず3点比較より前に置く。後に置くと、移行前の明細が初回だけ『利用者は触っていない』と誤って扱われ、取込元の値で手当てが上書きされる。埋め込みと本体更新は同じ書込単位に入れ、途中失敗で base だけが進んだ状態を残さない。埋める対象はその取込で突き合わせる明細に限られるため、書込量は取込1回の明細数 (通常幅 5,000 行) を超えず、既存データの規模に依存しない。移行完了という時点は存在しないため、base を持たない明細の残件数を進捗指標として持つ。(3) 決め事の自動適用の判定 (G6/G7): 取引先単位の決め事の確信度は confidence = hit_count / (hit_count + disagree_count) で求める。自動適用の条件は hit_count が 3 以上、かつ confidence が 0.80 以上とする。この2条件を満たさない決め事は自動適用せず候補提示に留める。判定は D1 内の算術で閉じ、明細内容を推論経路を含む外部へ一切渡さない (DR-14)。閾値は直近30日の自動適用に対する利用者取消率が 5% を超えたら 0.05 上げ、取消率 1% 未満が30日続いたら 0.05 下げる。可動域は 0.70 以上 0.95 以下とする。取消率の集計対象は自動適用された明細に限り、利用者が自分で入れた手当てを取り消した場合を混ぜない。(4) 制約 (既存): 上記のいずれの処理も、1回の Worker 呼び出しあたりの D1 クエリ本数を 50 本未満に保ち、明細内容・金額をログおよびエラー応答へ含めない。

### qa-016 (対応セル: web)

**質問**: D8(監査記録そのものの保持期間)の確定を受けて、監査記録は何をどの層へ残し、どれだけ保ち、どう掃除するか。undo 退避行の保持 (D7) との関係も含めて示すこと。

**回答**: 本 turn は D8 の利用者決裁を受けた backend / database / maintenance-ops の追補である。(1) 層の分割 (G4): 監査記録を操作ヘッダ (audit_log) と判定明細スナップショット (audit_log_detail) の2層に分ける。ヘッダは1回の削除・上書き操作につき1行とし、操作種別・対象範囲 (取込単位・期間単位・データ種別単位・全件のいずれか)・対象件数・実行時刻・結果だけを持つ。判定明細は明細ごとの属性別 before/after と採用根拠 (どの規則・決め事・3分岐で決まったか) を持つ。分けるのは、年をまたぐ振り返りで必要になるのが操作の事実だけであるのに対し、判定根拠は異常に気づいた直後にしか要らず、かつ1行あたりの重さが概ね 300 バイト対 2 キロバイトと6倍以上異なるためである。(2) 保持期間 (G4): 操作ヘッダは 400 日、判定明細は 90 日で掃除する。ヘッダを 400 日とするのは、確定申告の期をひとつ越えて『前年のいつ何を何件消したか』を辿れるようにするためである。判定明細を 90 日で切るのは、削除したはずの明細内容が監査記録の側に長期間残り続けることを避けるためでもある。(3) ヘッダの内容制限 (G3/G4): 操作ヘッダへ明細内容と金額を載せない。載せると 90 日で消すはずの情報が 400 日残り、利用者の削除の意図と記録の保持が食い違う。これは明細内容・金額をログおよびエラー応答へ含めないという既存の制約と同じ理由に立つ。(4) 掃除の実行 (G5): 掃除は層ごとに独立して走らせ、いずれも1回の Worker 呼び出しあたりの D1 クエリ本数が 50 本未満に収まるよう分割実行する。総量が 1データベース上限 500 MB の 60% にあたる 300 MB へ達した場合は、期間に達していなくても判定明細側から古い順に掃除する。この 300 MB は D7 の退避テーブルと同じ基準値だが、掃除の対象と経路は別であり、退避行の掃除と監査記録の掃除は相互に代替しない。(5) 監視 (G4/G5): 操作ヘッダと判定明細の行数・使用量を層ごとに確認する。層ごとに独立して掃除するため、片方が止まっても総量だけを見ていては気づけないためである。(6) 回復手段の限界 (G4): 400 日の滞留は D1 の Time Travel が遡れる 7 日を大きく越えるため、監査記録テーブル自体が欠損した場合は時点復旧では戻せない。(7) 見直し (G5): 400 日・90 日・300 MB および1行あたりのサイズ見積りは、実データのない段階で置いた出発点である。実際の増え方を見て見直すことを運用手順へ組み込む。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。**条項を引けないことは、その指針を適用できない理由にはならない**。本章の「本章での適用」節は、条項番号ではなく authority が導く上流原則を採否の根拠として書く。

### 条項引用の可否 (clause citation)

本節の判定基準は「`fetched-references.json` に実体のある取得記録があるか」の一点である。現在の取得対象は 7 件 (`cloudflare-d1-limits` / `cloudflare-d1-pricing` / `cloudflare-r2-pricing` / `cloudflare-r2-limits` / `git-merge-three-way` / `sqlite-upsert` / `cloudflare-workers-ai-pricing`) であり、doctrine anchor の authority (OWASP ASVS / Apple Human Interface Guidelines / Clean Architecture / Google SRE) はいずれも含まれない。また `system-spec/retrieval-evidence/` はこの作業ツリーに存在しない。

> **訂正記録 (2026-09-02)**: 本節の従前の記述は、OWASP ASVS と Apple HIG について「取得済み (`retrieval-evidence/owasp-asvs.json`, 67761 B / `retrieval-evidence/apple-hig.json`, 17681 B)」とバイト数付きで書き、Google SRE の sre-book について「取得済みなのは目次」と書いていた。独立監査 (C05) がこれらの現物不在を指摘し、`system-spec/retrieval-evidence/` 自体が存在しないこと、履歴上も当該2ファイルが一度も存在しないこと (`git log --all --diff-filter=A` で 0 件)、`fetched-references.json` の取得対象が 7 件であること (従前の記述は「8 件」としていた) を確認したため、取得済みの主張とバイト数・観測内容の記述をすべて撤回する。取得していないものを取得済みと書くことは、この章自身が戒める「取得していない内容を出典に帰属させること」そのものである。判定は下表のとおり「取得対象に無い」へ改める。

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| application-architecture | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | authority が書籍 (Clean Architecture, 2017) で、source_ref も URL ではなく書名と規則名の記述である。取得対象 7 件のいずれでもなく、この作業場所には書籍本文を取得する経路が無い。 |
| data-access | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | application-architecture と同一 authority (書籍)。取得経路が無い点も同じ。 |

- **application-architecture の反転先**: 反転先は無い。理由は難しさではなく、この作業場所が書籍本文を取得できないことにある。『取得対象に無い』と『取得経路が原理的に無い』を『条項引用不可』の一語へ潰すと、次に読む人が書籍を取りにいくか、取れるものを諦めるかのどちらかを必ず間違える。reason_class を消さないこと。
- **data-access の反転先**: 反転先は無い。理由は難しさではなく、この作業場所が書籍本文を取得できないことにある。『取得対象に無い』と『取得経路が原理的に無い』を『条項引用不可』の一語へ潰すと、次に読む人が書籍を取りにいくか、取れるものを諦めるかのどちらかを必ず間違える。reason_class を消さないこと。

## 適用された設計知識

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

---

### 上限が固定された管理型プラットフォームの割当枠 (容量・書込行数・呼び出しあたりクエリ本数・時点復旧の遡及幅) を、設計時に機能へ配分しきる考え方

- project candidate: `quota-bounded-capacity-design` (`deepened`)
- 解決対象: 無料枠や固定上限を持つ管理型プラットフォームでは、上限は運用中に増やせない。にもかかわらず容量・書込・クエリ本数の消費は機能ごとに独立して増えるため、どの機能へどれだけ割り当てたかを設計時に決めておかないと、個々の機能はどれも正しいのに全体として上限へ到達し、最後に足された機能が原因のように見える形で壊れる。本システムでは削除・上書き・undo 退避・監査記録の4つがいずれも書込と容量を消費し、しかも取込1回あたりの明細数に比例して増えるため、この配分を暗黙のまま進めると上限到達が避けられない。

#### 目的

固定上限を持つ管理型プラットフォーム上で、上限を運用時の監視対象ではなく設計時の配分対象として扱い、どの機能がどの枠をどれだけ消費してよいかを機能追加より前に決めきることで、上限到達を偶発事故ではなく設計判断の結果に変える。

#### 解決する問題

- 機能ごとに独立して消費される枠 (容量・書込行数・クエリ本数) の合計が、どの機能の担当者からも見えない
- 1回の呼び出しあたりのクエリ本数のような構造的上限は、到達してから直すと機能の作り直しになる
- 上限に対する余裕を『まだ十分空いている』という感覚で判断すると、消費が明細数に比例する機能を足した時点で急に到達する
- 回復手段 (時点復旧) の遡及幅と、機能が約束する回復可能期間が食い違ったまま確定してしまう

#### 適用条件

上限が固定され運用中に増やせないプラットフォーム上で、消費がデータ量に比例して増える機能を複数持つとき。とくに、同じ枠を複数の機能が独立して消費するとき。

#### 非適用条件

費用を払えば枠が連続的に伸びる環境、または消費が一定でデータ量に比例しない小規模な用途。この場合は設計時の配分より運用監視のほうが費用対効果が高い。

#### トレードオフ

配分を先に決めることで、後から『この機能にもう少し枠を回したい』という調整が設計変更になる。柔軟性を失う代わりに、上限到達を事前に検出できる。また、比例係数を出すために実データのない段階で見積りを置く必要があり、その見積りが外れると配分ごと見直しになる。

#### 失敗モード

- 配分を割合だけで決め、分母である上限が変わったときに絶対値へ翻訳し直さない
- 1操作あたりのクエリ本数を守るための分割実行を、通常時の件数だけで検証し、大量削除時に検証しない
- 総量上限へ到達したときの掃除を、期間による掃除と同じ経路にまとめてしまい、どちらの理由で消えたか利用者へ説明できなくなる
- 見積りを置いたことを記録せず、運用開始後に実測と突き合わせないまま初期値が固定化する
- 時点復旧の遡及幅を回復手段として数えたまま、それより長い保持期間を機能側で約束する

#### goalへの寄与

G4(削除・上書きが不可逆であることを踏まえ、実行後の取り消しと監査可能な記録を備え、誤操作から回復できる)に対し、回復可能期間と監査記録の保持期間を固定上限の中で成立する値として決める根拠を与える。G5(削除・上書き後も派生状態が実データと矛盾しない状態へ収束する)に対し、収束のための再計算と掃除を1回の呼び出しあたりのクエリ本数の中で完了させる分割実行の根拠を与える。

### 本章での適用

本章の確定セル (backend.web) が資するゴールは G1, G2, G3, G4, G5, G6, G7 である (正本は `spec-state.json` の `matrix.backend.web.serves_goals`。本節および frontmatter はこの値を写す)。以下の各項の「資するゴール」は、この集合の部分集合として、当該質疑が直接寄与する範囲を示す。

#### 確定内容 qa-010 (対応セル: web)

- 確定要件: 本章は qa-003 (削除・上書き・undo のサーバ処理) と qa-007 (3点比較と自動適用) を統合した内容を要件とする。(1) 4粒度の削除: 明細単位・取込単位・期間単位・全件の削除経路を設け、いずれも削除前に対象件数と影響範囲を返す事前確認 (preflight) を持つ。既存の `import-lifecycle.ts` の writer claim (利用者別単一 writer・TTL 15分) を削除にも適用し、取込と削除が同時に走らないようにする。(2) undo: 削除・上書きの直前状態を退避テーブルへ書いてから本体を変更し、退避と本体変更を同じバッチに載せて原子性を確保する。(3) 再収束: 削除後に `import_active_targets` の指紋を巻き戻し、`monthly_agg` を実データから再計算する。(4) 変更元の判別: 取込時、明細ごとに base (前回取込原本値) / current (`tx_edits` の手当て) / incoming (新 CSV の原本値) を属性ごとに突き合わせ、base == incoming なら手当てを維持、base != incoming かつ利用者が触っていない (当該列が NULL) なら incoming を採って base を進める、base != incoming かつ利用者が触っている場合だけ衝突として提示する (既定は手当て維持)。(5) 決め事の自動適用: `tx_edits` も rules も当たらない明細は、正規化した取引先名を `vendor_key` として `vendor_memory` を引き、confidence が閾値以上なら自動適用し、閾値未満なら候補提示に留める。pinned の決め事は confidence によらず常に適用する。(6) 差分の算出: 判定結果を、自動で決まった分と衝突分に分けて集計し画面へ渡す。(7) 説明可能性: 判定ごとに自動判定か衝突かの別と採用根拠を監査記録へ残す。(8) 制約遵守: 1回の Worker 呼び出しあたりの D1 クエリは 50 本未満に保ち、判定は取込単位でまとめ読みし、書戻しは UPSERT で存在確認の SELECT を省いて1文にまとめ、件数に応じて既存の `planMultipartImportQueries` と同じ考え方で分割実行する。学習・判定はすべて D1 内のデータだけで行い、明細を外部サービスや推論モデルへ送らない。
- 設計解釈の記録経路: 本項の判定規則は不変条件 DR-1〜DR-16 (`specs/import-deletion-and-override-reapply.md`) を上位とし、本章はその実装側の解釈を担う。3点比較の構造は出典 `git-merge-three-way` (Git 2.55.0 公式マニュアル) の3方向マージを写像したものであり、base を共通祖先・current を自分側の変更・incoming を相手側の変更に対応させている。クエリ本数と書込行数の制約は出典 `cloudflare-d1-limits` に、UPSERT による1文更新は出典 `sqlite-upsert` に依拠する。
- 設計原則の採否根拠: **本章の上流指針 (concern=application-architecture / data-access, authority=Clean Architecture) が導く依存規則を採る**。削除・上書き・3点比較の判定規則は、Hono のルーティングや D1 のクエリ構築から独立した層に置き、外側 (HTTP・DB) が内側 (判定規則) に依存する向きだけを許す。この向きを守るのは、判定規則が本機能で最も試験したい部分でありながら、最も変わりにくい部分でもあるためである。**代替として「ルートハンドラ内に判定を直書きする」構成を採らなかった**理由は、同じ3分岐を取込経路と再取込経路と undo 経路の3か所で書くことになり、DR-10 の3分岐の網羅が経路ごとに崩れうるからである。**API Design Patterns からは事前確認 (preflight) と実行の分離を採る**。削除は不可逆であるため、対象件数と影響範囲を返す問い合わせと、実際に消す操作を別の操作として分ける。**代替の「確認フラグ付きの単一操作」を採らなかった**のは、フラグの取り違えが即座に不可逆な削除になるためで、G4 が求める誤操作からの回復可能性は、回復手段を足すより誤操作そのものを構造的に起こしにくくする側で先に満たす。**DDD からは集約境界を採る**。1回の削除操作が触れてよい範囲を取込単位の集約として定め、その内側だけを1バッチの原子性の対象とする。**代替の「明細を独立した実体として個別に消す」構成を採らなかった**のは、退避と本体変更が別バッチへ分かれ、途中失敗で退避だけが残る状態を作りうるからである。
- 資するゴール: G1, G2, G3, G4, G5, G6, G7

#### 確定内容 qa-012 (対応セル: web)

- 確定要件: D4・D5・D6 の利用者決裁を受けた追補。(1) 衝突の粒度: 3点比較の結果は明細単位の真偽1つではなく、対象4属性それぞれについて DR-10 の3分岐のいずれかを返す形とする。明細単位の真偽を導出値として併存させない。戻り値型の変更は、これを読む分類 API・分類画面・既存試験へ同一の変更単位で追随させ、取込経路が動かない期間を作らない。属性の集合と3分岐を型で表し、分岐漏れが型検査で落ちる形にする。(2) base を持たない既存明細の扱い: base を持たない明細は、その取込を始める直前の現行値を base として埋めてから3点比較へ入る。埋め込みは必ず3点比較より前に置き、埋め込みと本体更新は同じ書込単位に入れる。埋める対象はその取込で突き合わせる明細に限られるため、書込量は取込1回の明細数 (通常幅 5,000 行) を超えない。移行完了という時点は存在しないため、base を持たない明細の残件数を進捗指標として持つ。(3) 決め事の自動適用の判定: confidence = hit_count / (hit_count + disagree_count)。自動適用の条件は hit_count が 3 以上、かつ confidence が 0.80 以上。閾値は直近30日の自動適用に対する利用者取消率が 5% を超えたら 0.05 上げ、取消率 1% 未満が30日続いたら 0.05 下げる。可動域は 0.70 以上 0.95 以下。取消率の集計対象は自動適用された明細に限る。
- 設計解釈の記録経路: 本項は decisions D4 (`D4-vendor-memory-confidence`)・D5 (`D5-conflict-attribute-granularity`)・D6 (`D6-base-backfill-migration`) の `user_decision` を上位とし、その帰結をサーバ側の振る舞いへ翻訳したものである。確信度の式と閾値の可動域は D4 の `recommendation.rationale` に、属性単位への変更は D5 に、遅延埋めの順序制約は D6 にそれぞれ根拠を持つ。
- 設計原則の採否根拠: **DDD のユビキタス言語を型へ落とす方針を採る**。「取込元だけが変わった」「利用者だけが変えた」「双方が変わった」という3分岐を、真偽値や文字列ではなく、その3つだけを取りうる型として表す。**代替の「衝突したかどうかの真偽値 + 詳細を別に持つ」構成を採らなかった**のは、真偽値と詳細が独立に更新されうる形になり、D5 が排したはずの「画面と API で衝突件数が食い違う」経路を型の側から再び開いてしまうからである。属性が将来増えたときに網羅が崩れないことを型検査で保証する点も、この採択の理由に含まれる。**Clean Architecture からは、遅延埋めを判定より前段の同一書込単位へ置く順序制約を採る**。**代替の「移行用の一括書換を先に流す」構成 (D6 の棄却案) を採らなかった**のは、既存明細数に比例した書込が rows written 10万/日 を圧迫するためであり、この判断は出典 `cloudflare-d1-limits` の固定上限に依拠する。
- 資するゴール: G2, G3, G6, G7

#### 確定内容 qa-016 (対応セル: web)

- 実装同期: `packages/api/src/audit-log.ts` の `buildAuditStatements` は、検証済みのヘッダ1文と
  80KiB以下に分けた属性明細のまとめ書き文、および`queryCount`を返す。delete / undo /
  import-resolutionの呼び出し側が同じD1 batchと既存query plannerへ追加する。previewは書かず、
  取込確定は3点比較のkeep/incoming・rule・vendor memoryが実際に決めた属性だけを不透明keyで同居させる。
  `GET /data/operations`は`audit_log`のdelete/undoヘッダを正本とし、取消可能期間のdeleteに限ってundo metadataをjoinする。

- 確定要件: D8 の利用者決裁を受けた追補。(1) 監査記録を操作ヘッダ (`audit_log`) と判定明細スナップショット (`audit_log_detail`) の2層に分けて書く。ヘッダは1回の削除・上書き操作につき1行とし、操作種別・対象範囲・対象件数・実行時刻・結果だけを持つ。判定明細は明細ごとの属性別 before/after と採用根拠 (どの規則・決め事・3分岐で決まったか) を持つ。(2) 操作ヘッダへ明細内容と金額を載せない。載せると 90 日で消すはずの情報が 400 日残り、利用者の削除の意図と記録の保持が食い違う。これは明細内容・金額をログおよびエラー応答へ含めないという既存の制約と同じ理由に立つ。(3) 判定明細の書込は、判定そのものと同じ取込単位のまとめ書きに載せ、明細1件ごとに1文を発行しない。1回の Worker 呼び出しあたりの D1 クエリ 50 本未満という制約を、監査記録の書込が単独で使い切らないようにするためである。
- 設計解釈の記録経路: 本項は decision D8 (`D8-audit-log-retention`) の `user_decision` を上位とし、その帰結のうち書込側の責務を本章が担う。保持期間そのものと掃除の実行は database 章および maintenance-ops 章が担い、本章は「何をどちらの層へ書くか」と「書込がクエリ本数の枠をどれだけ使うか」を確定する。層ごとの1行あたりのサイズ見積り (ヘッダ 約300バイト / 明細 約2キロバイト) は D8 の `cost_model.quantification` に記録されている。
- 設計原則の採否根拠: **Clean Architecture の境界を監査記録にも適用する**。判定規則は「何を根拠に決めたか」を戻り値として返すに留め、それをどの層のどのテーブルへ書くかは外側が決める。**代替の「判定規則の中から直接監査記録へ書く」構成を採らなかった**のは、判定規則が保存先を知ることになり、保持期間の変更 (D8 は運用開始後の見直しを前提としている) が判定規則の変更として現れてしまうからである。**quota-bounded capacity design からは、構造的上限と総量上限を別の手段で守る区別を採る**。1回の呼び出しあたりのクエリ本数という構造的上限は本章のまとめ書きで守り、総量上限は保持期間と掃除で守る。**代替の「監査記録の書込も件数に応じて分割実行する」だけの対処を採らなかった**のは、分割は構造的上限しか守らず、400日ぶんの総量には効かないためである。
- 資するゴール: G1, G3, G4, G5

## 実装同期: 非有効な取込履歴の破棄 (2026-09-03)

帳簿データの取消とは別に、`failed` / `duplicate` のattemptだけをpreflightと確認指紋付きで破棄する。
実行時は利用者別writer fence内でactive・canonical・undo参照を再検証し、共有R2原本は最後の参照まで保持する。
詳細契約は `specs/import-deletion-and-override-reapply.md` の DR-17 を正とする。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| git-merge-three-way | 2026-06-29 | Git (git-scm.com) | https://git-scm.com/docs/git-merge | 2026-08-30T00:00:00Z | 2026-09-02T00:00:00Z |
| sqlite-upsert | unverified | SQLite (www.sqlite.org) | https://www.sqlite.org/lang_upsert.html | 2026-08-30T00:00:00Z | 2026-09-02T00:00:00Z |
