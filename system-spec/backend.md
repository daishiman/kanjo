---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G1, G2, G4, G5, G6, G7]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-010 |
| モバイル (mobile) | 対象外 | 理由: 専用モバイルアプリを提供せず、webのレスポンシブ表示で到達するためモバイル固有の要件を持たない |
| タブレット (tablet) | 対象外 | 理由: 専用タブレットアプリを提供せず、webのレスポンシブ表示で到達するためタブレット固有の要件を持たない |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 確定内容 (質疑録)

### qa-010 (対応セル: web)

**質問**: web のサーバ側処理は、4粒度の削除・上書き・undo・再収束に加えて、3点比較による変更元の判別と決め事の自動適用までをどう実装するか。

**回答**: 本章は qa-003 (削除・上書き・undo のサーバ処理) と qa-007 (3点比較と自動適用) を統合した内容を要件とする。(1) 4粒度の削除 (G1): 明細単位・取込単位・期間単位・全件の削除エンドポイントを設け、いずれも削除前に対象件数と影響範囲を返す事前確認 (preflight) を持つ。既存の import-lifecycle.ts の writer claim (利用者別単一 writer・TTL 15分) を削除にも適用し、取込と削除が同時に走らないようにする。(2) undo (G4): 削除・上書きの直前状態を退避テーブルへ書いてから本体を変更し、退避と本体変更を同じバッチに載せて原子性を確保する。(3) 再収束 (G5): 削除後に import_active_targets の指紋を巻き戻し、monthly_agg を実データから再計算する。(4) 変更元の判別 (G7): 取込時、明細ごとに base (前回取込原本値) / current (tx_edits の手当て) / incoming (新CSVの原本値) を属性ごとに突き合わせ、base == incoming なら手当てを維持、base != incoming かつ利用者が触っていない (当該列が NULL) なら incoming を採って base を進める、base != incoming かつ利用者が触っている場合だけ衝突として提示する (既定は手当て維持)。この3分岐により、先月と今月で内容が食い違っても衝突以外はすべて自動で決まる。(5) 決め事の自動適用 (G6): tx_edits も rules も当たらない明細は、正規化した取引先名を vendor_key として vendor_memory を引き、confidence が閾値以上なら自動適用し、閾値未満なら候補提示に留める。confidence は同一 vendor_key で同じ値が選ばれた回数 hit_count と自動適用が取り消された回数 disagree_count から算出し、利用者の回答があるたびに更新する。pinned の決め事は confidence によらず常に適用する。(6) 差分の算出 (G2): 上記判定の結果を、自動で決まった分と衝突分に分けて集計し、画面へ渡す。(7) 説明可能性 (G4): 判定ごとに自動判定か衝突かの別と採用根拠 (どの規則・決め事・分岐で決まったか) を監査記録へ残す。(8) D1 の制約遵守: Worker 1回の呼び出しあたりクエリは Free で 50 本のため、判定は取込単位でまとめ読みし、書戻しは SQLite の UPSERT (INSERT ... ON CONFLICT DO UPDATE) で存在確認の SELECT を省いて1文にまとめ、件数に応じて既存の planMultipartImportQueries と同じ考え方で分割実行する。学習・判定はすべて D1 内のデータだけで行い、明細を外部サービスや推論モデルへ送らない。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| application-architecture | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | authority が書籍 (Clean Architecture, 2017) で、source_ref も URL ではなく書名と規則名の記述。fetched-references.json の取得対象 8 件のいずれでもなく、retrieval-evidence にも record が存在しない。この作業場所には書籍本文を取得する経路が無い。 |
| data-access | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | application-architecture と同一 authority (書籍)。取得経路が無い点も同じ。 |

- **application-architecture の反転先**: 反転先は無い。理由は難しさではなく、この作業場所が書籍本文を取得できないこと。fetched-but-no-body と not-in-fetch-targets は取得すれば塞がるが、これは塞がらない。3 種を『条項引用不可』の一語に潰すと、次に読む人が書籍を取りにいくか、取れるものを諦めるかのどちらかを必ず間違える。reason_class を消さないこと。
- **data-access の反転先**: 反転先は無い。application-architecture の reversal_note と同じ理由。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

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

#### 本章での適用

##### 確定内容 qa-010 (対応セル: web)

- 確定要件: 本章は qa-003 (削除・上書き・undo のサーバ処理) と qa-007 (3点比較と自動適用) を統合した内容を要件とする。(1) 4粒度の削除 (G1): 明細単位・取込単位・期間単位・全件の削除エンドポイントを設け、いずれも削除前に対象件数と影響範囲を返す事前確認 (preflight) を持つ。既存の import-lifecycle.ts の writer claim (利用者別単一 writer・TTL 15分) を削除にも適用し、取込と削除が同時に走らないようにする。(2) undo (G4): 削除・上書きの直前状態を退避テーブルへ書いてから本体を変更し、退避と本体変更を同じバッチに載せて原子性を確保する。(3) 再収束 (G5): 削除後に import_active_targets の指紋を巻き戻し、monthly_agg を実データから再計算する。(4) 変更元の判別 (G7): 取込時、明細ごとに base (前回取込原本値) / current (tx_edits の手当て) / incoming (新CSVの原本値) を属性ごとに突き合わせ、base == incoming なら手当てを維持、base != incoming かつ利用者が触っていない (当該列が NULL) なら incoming を採って base を進める、base != incoming かつ利用者が触っている場合だけ衝突として提示する (既定は手当て維持)。この3分岐により、先月と今月で内容が食い違っても衝突以外はすべて自動で決まる。(5) 決め事の自動適用 (G6): tx_edits も rules も当たらない明細は、正規化した取引先名を vendor_key として vendor_memory を引き、confidence が閾値以上なら自動適用し、閾値未満なら候補提示に留める。confidence は同一 vendor_key で同じ値が選ばれた回数 hit_count と自動適用が取り消された回数 disagree_count から算出し、利用者の回答があるたびに更新する。pinned の決め事は confidence によらず常に適用する。(6) 差分の算出 (G2): 上記判定の結果を、自動で決まった分と衝突分に分けて集計し、画面へ渡す。(7) 説明可能性 (G4): 判定ごとに自動判定か衝突かの別と採用根拠 (どの規則・決め事・分岐で決まったか) を監査記録へ残す。(8) D1 の制約遵守: Worker 1回の呼び出しあたりクエリは Free で 50 本のため、判定は取込単位でまとめ読みし、書戻しは SQLite の UPSERT (INSERT ... ON CONFLICT DO UPDATE) で存在確認の SELECT を省いて1文にまとめ、件数に応じて既存の planMultipartImportQueries と同じ考え方で分割実行する。学習・判定はすべて D1 内のデータだけで行い、明細を外部サービスや推論モデルへ送らない。
- 設計解釈の記録経路: `unrecorded`
- 設計原則の採否根拠: (未記録 — qa_log[].design_applications を writer 経由で補完すること)
- 資するゴール: G1, G2, G4, G5, G6, G7

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| git-merge-three-way | 2026-04-20 | Git (git-scm.com) | https://git-scm.com/docs/git-merge | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| sqlite-upsert | 2026-08-30 | SQLite (www.sqlite.org) | https://www.sqlite.org/lang_upsert.html | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
