---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G1, G2, G3, G4, G5, G6, G7]
---

# データベース (database)

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

### qa-009 (対応セル: web)

**質問**: web のデータベース層と運用は、4粒度の削除・上書き・undo・監査・派生状態の再収束に加えて、手当ての継続的な再適用と変更元の自動判定までを、どのデータでどう支えるか。

**回答**: 本章は qa-002 (削除・undo・監査を支える永続化) と qa-006 (手当ての継続維持と3点比較を支える永続化) を統合した内容を要件とする。(1) 4粒度の削除 (G1): 明細単位・取込単位・期間単位・全件のいずれでも削除対象を特定できるよう、mf_transactions.import_id / freee_deals.import_id の由来参照を維持し、balance_entries と cash_entries についても由来の持ち方を実装時に確認して不足すれば append-only の連番 migration で追加する。(2) undo (G4): 削除・上書きの直前状態を D1 の退避テーブルへ保持する (決定 D1-undo-snapshot-store)。D1 Free は1データベース 500 MB が上限であり Time Travel も 7 日・データベース単位の復元にとどまるため、保持期間を有限にした自前の退避テーブルが必要である。削除1行につき退避1行の書込が加わり rows written を二重に消費するため、1日あたりの削除規模を Free の 10万 rows written/日 に対して見積もる。(3) 監査 (G4): 誰がいつ何をどれだけ削除・上書きしたかの記録テーブルを新設する。(4) 再収束 (G5): 削除時に import_active_targets の現行指紋を巻き戻し、monthly_agg を実データから再計算する。(5) 手当ての継続維持 (G6): 既存の tx_edits (user_id, tx_id, cls, category_major, category_mid, owner, base_major, base_mid) / rules / account_norm_map / institution_owners / category_options を土台に、取引先単位の決め事を蓄積する vendor_memory (user_id, vendor_key, cls, category_major, category_mid, owner, hit_count, disagree_count, confidence, source, pinned, last_applied_at, updated_at) を新設する。適用の優先順位は tx_edits > rules > vendor_memory > 取込原本値 とし、利用者が明示登録した規則を学習が上書きしない。(6) 変更元の自動判定 (G7): tx_edits へ base_cls / base_owner を追加して cls / category_major / category_mid / owner の4属性すべてに前回取込原本値を持たせ、base / current / incoming の3点比較を成立させる。あわせて日付・金額・保有金融機関・正規化した内容から安定同一性キー (stable_key) を算出して保持し、明細IDが振り直されても手当てが追随するようにする。算出は packages/core/src/fingerprint.ts の正規化方針に揃え、指紋版数を持たせて規則変更に追従する。(7) 巻き添え防止 (G3): 削除は手動記録 (tx_edits / rules / cash_entries / attachments) を巻き込まず、明細が消えても手当てが孤立しない参照の持ち方にする。(8) 差分の把握 (G2): 上記 base 値により、取込前に何がどう変わるかを算出できる。スキーマ追加はすべて既存テーブルの破壊的再定義を避け migrations/ へ連番で append-only に足す。運用としては、退避行・base 値・vendor_memory の保持期間、長期間当たらない vendor_key の棚卸し、誤学習時の巻き戻し (決め事の取消は即時反映し、過去に自動適用された明細は取消して再判定で戻せる)、および退避行の期限切れを確実に消す掃除経路を持つ。

### qa-013 (対応セル: web)

**質問**: D6(base の遅延埋め)・D7(undo 退避行の保持)の確定を受けて、保存側の持ち方と掃除の基準はどうなるか。

**回答**: 本 turn は D6・D7 の利用者決裁を受けた database の追補である。(1) base の保持 (G7): 明細は前回取込時の原本値 (base) を対象4属性について持つ。base を持たない既存明細に対する一括の書換 migration は行わない。再取込のたびに、その取込で突き合わせる明細のうち base を持たないものだけへ、取込直前の現行値を base として書き込む。既存明細の総数に依存した大規模書込を発生させないため、Cloudflare D1 無料プランの rows written 10万/日 に対して余裕を保てる。(2) undo 退避行の保持 (G4/G5): 削除・上書きの直前状態は D1 内の退避テーブルへ書き、保存先を増やさない。保持は期間と容量の二段構えとし、保持期間は 30 日、容量上限は退避テーブルの総量が 300 MB (1データベース上限 500 MB の 60%) に達した時点とする。いずれか先に到達した側で古い世代から掃除する。保持期間を有限にすることは DR-8 の要求であり、無期限保持は採らない。(3) 容量と書込の見積り (制約): 削除1行につき退避1行の書込が加わるため rows written を二重に消費する。1日あたりの削除対象は 5万行以内を前提として運用を始める。300 MB と 5万行/日 は運用開始時点の出発点であり、実際の退避行の増え方を見て見直す。(4) 既存資産との境界 (既存): balance_entries と cash_entries へ import_id を足さない。手動で入れた記録を取込単位の削除へ巻き込まないためである。(5) 保持期間 30 日は D1 の Time Travel が遡れる 7 日より長いため、その差である 23 日ぶんは退避テーブルが唯一の回復手段になる。退避テーブル自体の欠損に対する回復手段は別途扱う。

### qa-016 (対応セル: web)

**質問**: D8(監査記録そのものの保持期間)の確定を受けて、監査記録は何をどの層へ残し、どれだけ保ち、どう掃除するか。undo 退避行の保持 (D7) との関係も含めて示すこと。

**回答**: 本 turn は D8 の利用者決裁を受けた backend / database / maintenance-ops の追補である。(1) 層の分割 (G4): 監査記録を操作ヘッダ (audit_log) と判定明細スナップショット (audit_log_detail) の2層に分ける。ヘッダは1回の削除・上書き操作につき1行とし、操作種別・対象範囲 (取込単位・期間単位・データ種別単位・全件のいずれか)・対象件数・実行時刻・結果だけを持つ。判定明細は明細ごとの属性別 before/after と採用根拠 (どの規則・決め事・3分岐で決まったか) を持つ。分けるのは、年をまたぐ振り返りで必要になるのが操作の事実だけであるのに対し、判定根拠は異常に気づいた直後にしか要らず、かつ1行あたりの重さが概ね 300 バイト対 2 キロバイトと6倍以上異なるためである。(2) 保持期間 (G4): 操作ヘッダは 400 日、判定明細は 90 日で掃除する。ヘッダを 400 日とするのは、確定申告の期をひとつ越えて『前年のいつ何を何件消したか』を辿れるようにするためである。判定明細を 90 日で切るのは、削除したはずの明細内容が監査記録の側に長期間残り続けることを避けるためでもある。(3) ヘッダの内容制限 (G3/G4): 操作ヘッダへ明細内容と金額を載せない。載せると 90 日で消すはずの情報が 400 日残り、利用者の削除の意図と記録の保持が食い違う。これは明細内容・金額をログおよびエラー応答へ含めないという既存の制約と同じ理由に立つ。(4) 掃除の実行 (G5): 掃除は層ごとに独立して走らせ、いずれも1回の Worker 呼び出しあたりの D1 クエリ本数が 50 本未満に収まるよう分割実行する。総量が 1データベース上限 500 MB の 60% にあたる 300 MB へ達した場合は、期間に達していなくても判定明細側から古い順に掃除する。この 300 MB は D7 の退避テーブルと同じ基準値だが、掃除の対象と経路は別であり、退避行の掃除と監査記録の掃除は相互に代替しない。(5) 監視 (G4/G5): 操作ヘッダと判定明細の行数・使用量を層ごとに確認する。層ごとに独立して掃除するため、片方が止まっても総量だけを見ていては気づけないためである。(6) 回復手段の限界 (G4): 400 日の滞留は D1 の Time Travel が遡れる 7 日を大きく越えるため、監査記録テーブル自体が欠損した場合は時点復旧では戻せない。(7) 見直し (G5): 400 日・90 日・300 MB および1行あたりのサイズ見積りは、実データのない段階で置いた出発点である。実際の増え方を見て見直すことを運用手順へ組み込む。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。**条項を引けないことは、その指針を適用できない理由にはならない**。本章の「本章での適用」節は、条項番号ではなく authority が導く上流原則を採否の根拠として書く。

### 条項引用の可否 (clause citation)

本節の判定基準は「`fetched-references.json` に実体のある取得記録があるか」の一点である。現在の取得対象は 7 件 (`cloudflare-d1-limits` / `cloudflare-d1-pricing` / `cloudflare-r2-pricing` / `cloudflare-r2-limits` / `git-merge-three-way` / `sqlite-upsert` / `cloudflare-workers-ai-pricing`) であり、doctrine anchor の authority (OWASP ASVS / Apple Human Interface Guidelines / Clean Architecture / Google SRE) はいずれも含まれない。また `system-spec/retrieval-evidence/` はこの作業ツリーに存在しない。

> **訂正記録 (2026-09-02)**: 本節の従前の記述は、OWASP ASVS と Apple HIG について「取得済み (`retrieval-evidence/owasp-asvs.json`, 67761 B / `retrieval-evidence/apple-hig.json`, 17681 B)」とバイト数付きで書き、Google SRE の sre-book について「取得済みなのは目次」と書いていた。独立監査 (C05) がこれらの現物不在を指摘し、`system-spec/retrieval-evidence/` 自体が存在しないこと、履歴上も当該2ファイルが一度も存在しないこと (`git log --all --diff-filter=A` で 0 件)、`fetched-references.json` の取得対象が 7 件であること (従前の記述は「8 件」としていた) を確認したため、取得済みの主張とバイト数・観測内容の記述をすべて撤回する。取得していないものを取得済みと書くことは、この章自身が戒める「取得していない内容を出典に帰属させること」そのものである。判定は下表のとおり「取得対象に無い」へ改める。

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| data-access | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | application-architecture と同一 authority (書籍)。取得経路が無い点も同じ。 |
| reliability | **条項引用不可** — 取得対象に無い (取れば可になる) | authority の Google SRE Book (https://sre.google/sre-book/) は Web 公開だが、取得対象 7 件に含まれない。章題や章番号は広く知られているが、取得記録の無いものを出典として引くことはしない。 |

- **data-access の反転先**: 反転先は無い。理由は難しさではなく、この作業場所が書籍本文を取得できないことにある。『取得対象に無い』と『取得経路が原理的に無い』を『条項引用不可』の一語へ潰すと、次に読む人が書籍を取りにいくか、取れるものを諦めるかのどちらかを必ず間違える。reason_class を消さないこと。
- **reliability が引用可になる条件**: targets[] へ足して C02 で取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。

## 適用された設計知識

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

本章の確定セル (database.web) が資するゴールは G1, G2, G3, G4, G5, G6, G7 である (正本は `spec-state.json` の `matrix.database.web.serves_goals`。本節および frontmatter はこの値を写す)。以下の各項の「資するゴール」は、この集合の部分集合として、当該質疑が直接寄与する範囲を示す。

同じ qa-009 は maintenance-ops 章からも参照されるが、本章が担うのは「何をどう持つか」(表・列・参照・キー) であり、maintenance-ops 章が担うのは「持ったものを運用中にどう掃除し何を見張るか」である。両章で同じ文面を重複させない。

#### 確定内容 qa-009 (対応セル: web)

- 確定要件: 本章は qa-002 (削除・undo・監査を支える永続化) と qa-006 (手当ての継続維持と3点比較を支える永続化) を統合した内容のうち、永続化の構造を要件とする。(1) 削除対象の特定: 明細単位・取込単位・期間単位・全件のいずれでも対象を特定できるよう、`mf_transactions.import_id` / `freee_deals.import_id` の由来参照を維持する。`balance_entries` と `cash_entries` へは `import_id` を足さない。手動で入れた記録を取込単位の削除へ巻き込まないためである。(2) undo の退避先: 削除・上書きの直前状態を D1 内の退避テーブルへ保持する (決定 `D1-undo-snapshot-store`)。D1 Free は1データベース 500 MB が上限であり、Time Travel も 7 日・データベース単位の復元にとどまるため、保持期間を有限にした自前の退避テーブルが必要である。(3) 監査記録: 誰がいつ何をどれだけ削除・上書きしたかの記録テーブルを新設する (層の分割と保持は qa-016 で確定)。(4) 派生状態: 削除時に `import_active_targets` の現行指紋を巻き戻し、`monthly_agg` を実データから再計算できる持ち方にする。(5) 手当ての蓄積: 既存の `tx_edits` / `rules` / `account_norm_map` / `institution_owners` / `category_options` を土台に、取引先単位の決め事を蓄積する `vendor_memory` (user_id, vendor_key, cls, category_major, category_mid, owner, hit_count, disagree_count, confidence, source, pinned, last_applied_at, updated_at) を新設する。適用の優先順位は `tx_edits` > `rules` > `vendor_memory` > 取込原本値 とし、利用者が明示登録した規則を学習が上書きしない。(6) 3点比較の成立: `tx_edits` へ `base_cls` / `base_owner` を追加し、cls / category_major / category_mid / owner の4属性すべてに前回取込原本値を持たせる。あわせて日付・金額・保有金融機関・正規化した内容から安定同一性キー (`stable_key`) を算出して保持し、明細 ID が振り直されても手当てが追随するようにする。算出は `packages/core/src/fingerprint.ts` の正規化方針に揃え、指紋版数を持たせて規則変更に追従する。(7) 巻き添え防止: 削除は手動記録 (`tx_edits` / `rules` / `cash_entries` / `attachments`) を巻き込まず、明細が消えても手当てが孤立しない参照の持ち方にする。(8) migration の作法: スキーマ追加はすべて既存テーブルの破壊的再定義を避け、`migrations/` へ連番で append-only に足す。
- 設計解釈の記録経路: 本項は不変条件 DR-1〜DR-16 (`specs/import-deletion-and-override-reapply.md`) と decision D1 (`D1-undo-snapshot-store`) を上位とし、その永続化側の解釈を担う。退避先を D1 内に置く判断は D1 の `user_decision` に、500 MB / Time Travel 7 日 / rows written 10万・日 という制約は出典 `cloudflare-d1-limits` に依拠する。`stable_key` の正規化方針は既存実装 `packages/core/src/fingerprint.ts` を参照元とし、本仕様では版数を持たせる点だけを足している。
- 設計原則の採否根拠: **本章の上流指針のうち concern=reliability (authority=Google SRE) が導く「データ完全性は、保存の正しさではなく復旧できることで測る」原則を、持ち方の側へ採る**。削除・上書きの直前状態を退避テーブルとして持ち、派生状態 (`monthly_agg` / `import_active_targets`) は実データから再計算できる持ち方にする。**代替の「派生状態を正本として更新し続ける」構成を採らなかった**のは、派生が壊れたときに戻す先が無く、正しさを確かめる手段も無くなるからである。SRE Book を取得できていないため章番号は引けないが (「条項引用の可否」参照)、指針そのものは適用する。**DDD の集約境界を、削除が触れてよい範囲の線引きに採る**。取込に由来する明細を1つの集約とし、手動で入れた記録 (`cash_entries` / `balance_entries` / `attachments`) をその外側に置く。境界を分けたうえで、外側に `import_id` を持たせない。**代替として「すべての行へ `import_id` を持たせ、削除時に対象から除外する条件で守る」構成を採らなかった**のは、除外条件は書き忘れると静かに巻き込むのに対し、列を持たないことは構造として巻き込みを不可能にするからである。G3 (手動で入れた記録が意図せず失われない) は、条件で守るより境界で守るほうが破れにくい。**DDD のユビキタス言語を列名へ採る**。base / current / incoming という3点比較の語をそのまま `base_cls` / `base_owner` という列名へ写し、仕様書と表定義で同じ語が同じものを指すようにする。**代替の「前回値」といった一般語を採らなかった**のは、前回の取込値なのか前回の利用者操作値なのかが列名から判別できず、3分岐の解釈が実装者ごとに割れるためである。**append-only の連番 migration は、既存テーブルの破壊的再定義に対する明示的な棄却として採る**。稼働中の帳簿データに対する再定義は、失敗時に戻す手段が Time Travel の 7 日しかなく、G4 が求める回復可能性を満たせない。
- 資するゴール: G1, G2, G3, G4, G5, G6, G7

#### 確定内容 qa-013 (対応セル: web)

- 確定要件: D6・D7 の利用者決裁を受けた追補。(1) base の保持: 明細は前回取込時の原本値 (base) を対象4属性について持つ。base を持たない既存明細に対する一括の書換 migration は行わない。再取込のたびに、その取込で突き合わせる明細のうち base を持たないものだけへ、取込直前の現行値を base として書き込む。既存明細の総数に依存した大規模書込を発生させないため、rows written 10万/日 に対して余裕を保てる。(2) undo 退避行の保持: 保持は期間と容量の二段構えとし、保持期間は 30 日、容量上限は退避テーブルの総量が 300 MB (1データベース上限 500 MB の 60%) に達した時点とする。いずれか先に到達した側で古い世代から掃除する。保持期間を有限にすることは DR-8 の要求であり、無期限保持は採らない。(3) 書込量の見積り: 削除1行につき退避1行の書込が加わるため rows written を二重に消費する。1日あたりの削除対象は 5万行以内を前提として運用を始める。(4) 回復手段の重なり: 保持期間 30 日は Time Travel が遡れる 7 日より長いため、その差である 23 日ぶんは退避テーブルが唯一の回復手段になる。退避テーブル自体の欠損に対する回復手段は別途扱う。
- 設計解釈の記録経路: 本項は decision D6 (`D6-base-backfill-migration`) と D7 (`D7-undo-retention-window`) の `user_decision` を上位とし、その永続化側の帰結を担う。30 日・300 MB という具体値は D7 の `recommendation.rationale` に、遅延埋めを一括書換より優先する判断は D6 に記録されている。いずれも実データのない段階の見積りであり、D7 の `caveats` が運用開始後の見直しを前提としている。
- 設計原則の採否根拠: **quota-bounded capacity design から、枠の配分を割合と絶対値の両方で書く方針を採る**。退避テーブルの上限を「300 MB」とだけ書かず「1データベース上限 500 MB の 60%」と併記する。**代替の「絶対値だけを書く」記法を採らなかった**のは、提供元が上限を改定したときに、割合の意図 (総量の6割までを退避に使ってよい) が失われ、絶対値だけが根拠なく残るからである。**DDD の集約境界を base の埋め方にも適用する**。base の遅延埋めは、その取込が触れる集約の内側だけを対象とする。**代替の「全明細を対象とした一括の埋め込み」を採らなかった**のは、集約の外側まで一度に書き換えることになり、書込量が既存データ総量に比例して rows written の枠を使い切るためである。
- 資するゴール: G3, G4, G5, G7

#### 確定内容 qa-016 (対応セル: web)

- 実装同期: `migrations/0033_audit_log.sql` は列ごとの長さ、action/result/attribute/sourceの選択肢、
  不透明keyの形、利用者とheaderの複合外部キーをDB制約で固定する。無制限payload用のJSON列と
  明細本体・金額の列は追加しない。Drizzle対応は`auditLogs` / `auditLogDetails`。
  `import_deletion_operations`は30日のundo lifecycle metadataに役割を限定し、期限切れ時に
  `import_deleted_rows` / `import_deleted_targets`と同世代で削除する。400日の操作履歴の正本は`audit_log`とする。

- 確定要件: D8 の利用者決裁を受けた追補。(1) 監査記録を2つの表に分ける。`audit_log` は操作種別・対象範囲・対象件数・実行時刻・結果のみを持ち、明細内容と金額の列を持たない。`audit_log_detail` は明細ごとの属性別 before/after と採用根拠を持つ。列を持たせないことで、ヘッダ側へ明細内容が載る経路を構造として塞ぐ。(2) 保持は層ごとに異なり、`audit_log` は 400 日、`audit_log_detail` は 90 日とする。ヘッダを 400 日とするのは、確定申告の期をひとつ越えて前年の操作を辿れるようにするためである。(3) 総量が 300 MB (1データベース上限 500 MB の 60%) へ達した場合は、期間に達していなくても `audit_log_detail` 側から古い順に掃除する。この 300 MB は退避テーブルと同じ基準値だが、対象と経路は別であり、退避行の掃除と監査記録の掃除は相互に代替しない。(4) 監査記録には明細本体を複製しない (DR-9)。`audit_log_detail` が持つのは判定に関わった属性の before/after に限られる。(5) 表の追加は既存と同じく `migrations/` へ連番で append-only に足す。
- 設計解釈の記録経路: 本項は decision D8 (`D8-audit-log-retention`) の `user_decision` を上位とする。層ごとの1行あたりサイズ見積り (ヘッダ 約300バイト / 明細 約2キロバイト) と、月 3000 明細の利用で合計およそ 29 MB という試算は D8 の `cost_model.quantification` に記録されている。400 日という値は確定申告の周期に対する根拠を D8 の `recommendation.rationale` に持つ。
- 設計原則の採否根拠: **quota-bounded capacity design から、比例係数の異なるものを同じ保持規則に載せない方針を採る**。ヘッダと明細は1行あたりの重さが6倍以上異なり、必要とされる期間も年単位と数か月で異なる。**代替の「監査記録を1表にまとめ、D7 と同じ 30 日で掃除する」構成 (D8 の棄却案 `opt-d8-align-d7`) を採らなかった**のは、規則は1本で済む代わりに、年をまたぐ振り返りで監査記録が機能しなくなり、G4 が求める監査可能性を容量の都合だけで切り下げることになるためである。**DDD の集約境界を層の分割にも適用する**。ヘッダは操作という集約の根であり、明細はその内側の実体である。根だけが長く残る形にすることで、内側が消えても「何が行われたか」は残る。**代替の「行数上限で古い順に消す」構成 (`opt-d8-row-capped`) を採らなかった**のは、行あたりのサイズが層で大きく異なるため行数上限が容量上限として機能せず、利用者へ「いつまで遡れるか」を提示できないからである。
- 資するゴール: G1, G3, G4, G5

## 実装同期: 非有効な取込履歴の破棄 (2026-09-03)

`0034_import_discard_audit.sql` は操作ヘッダに `import_discard` を追加する。
対象attempt・空run・`duplicate_of`参照の更新とcleanup intentは同じD1 batchで確定し、
共有R2原本は最後の参照まで保持する。詳細契約は `specs/import-deletion-and-override-reapply.md` の DR-17 を正とする。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-limits | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/limits/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| cloudflare-d1-pricing | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/pricing/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
