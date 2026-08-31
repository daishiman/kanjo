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
| Web (web) | 確定 | 確定質疑: qa-009 |
| モバイル (mobile) | 対象外 | 理由: 専用モバイルアプリを提供せず、webのレスポンシブ表示で到達するためモバイル固有の要件を持たない |
| タブレット (tablet) | 対象外 | 理由: 専用タブレットアプリを提供せず、webのレスポンシブ表示で到達するためタブレット固有の要件を持たない |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 確定内容 (質疑録)

### qa-009 (対応セル: web)

**質問**: web のデータベース層と運用は、4粒度の削除・上書き・undo・監査・派生状態の再収束に加えて、手当ての継続的な再適用と変更元の自動判定までを、どのデータでどう支えるか。

**回答**: 本章は qa-002 (削除・undo・監査を支える永続化) と qa-006 (手当ての継続維持と3点比較を支える永続化) を統合した内容を要件とする。(1) 4粒度の削除 (G1): 明細単位・取込単位・期間単位・全件のいずれでも削除対象を特定できるよう、mf_transactions.import_id / freee_deals.import_id の由来参照を維持し、balance_entries と cash_entries についても由来の持ち方を実装時に確認して不足すれば append-only の連番 migration で追加する。(2) undo (G4): 削除・上書きの直前状態を D1 の退避テーブルへ保持する (決定 D1-undo-snapshot-store)。D1 Free は1データベース 500 MB が上限であり Time Travel も 7 日・データベース単位の復元にとどまるため、保持期間を有限にした自前の退避テーブルが必要である。削除1行につき退避1行の書込が加わり rows written を二重に消費するため、1日あたりの削除規模を Free の 10万 rows written/日 に対して見積もる。(3) 監査 (G4): 誰がいつ何をどれだけ削除・上書きしたかの記録テーブルを新設する。(4) 再収束 (G5): 削除時に import_active_targets の現行指紋を巻き戻し、monthly_agg を実データから再計算する。(5) 手当ての継続維持 (G6): 既存の tx_edits (user_id, tx_id, cls, category_major, category_mid, owner, base_major, base_mid) / rules / account_norm_map / institution_owners / category_options を土台に、取引先単位の決め事を蓄積する vendor_memory (user_id, vendor_key, cls, category_major, category_mid, owner, hit_count, disagree_count, confidence, source, pinned, last_applied_at, updated_at) を新設する。適用の優先順位は tx_edits > rules > vendor_memory > 取込原本値 とし、利用者が明示登録した規則を学習が上書きしない。(6) 変更元の自動判定 (G7): tx_edits へ base_cls / base_owner を追加して cls / category_major / category_mid / owner の4属性すべてに前回取込原本値を持たせ、base / current / incoming の3点比較を成立させる。あわせて日付・金額・保有金融機関・正規化した内容から安定同一性キー (stable_key) を算出して保持し、明細IDが振り直されても手当てが追随するようにする。算出は packages/core/src/fingerprint.ts の正規化方針に揃え、指紋版数を持たせて規則変更に追従する。(7) 巻き添え防止 (G3): 削除は手動記録 (tx_edits / rules / cash_entries / attachments) を巻き込まず、明細が消えても手当てが孤立しない参照の持ち方にする。(8) 差分の把握 (G2): 上記 base 値により、取込前に何がどう変わるかを算出できる。スキーマ追加はすべて既存テーブルの破壊的再定義を避け migrations/ へ連番で append-only に足す。運用としては、退避行・base 値・vendor_memory の保持期間、長期間当たらない vendor_key の棚卸し、誤学習時の巻き戻し (決め事の取消は即時反映し、過去に自動適用された明細は取消して再判定で戻せる)、および退避行の期限切れを確実に消す掃除経路を持つ。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| data-access | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | application-architecture と同一 authority (書籍)。取得経路が無い点も同じ。 |
| reliability | 引用可 | 第 4 章 Service Level Objectives (https://sre.google/sre-book/service-level-objectives/) / 第 6 章 Monitoring Distributed Systems (https://sre.google/sre-book/monitoring-distributed-systems/) / 第 24 章 Distributed Periodic Scheduling with Cron (https://sre.google/sre-book/distributed-periodic-scheduling/) / 第 26 章 Data Integrity: What You Read Is What You Wrote (https://sre.google/sre-book/data-integrity/) |

- **reliability の引用範囲**: 取得済みなのは目次 (table of contents) のみ。引用根拠にできるのは『その章が存在すること・章番号・章題・正規 URL』まで。章本文は未取得のため、章の中の主張を要約して要件文の根拠にすることはできない。それをやると、取得していない内容を出典に帰属させることになる (C05 が実在しない日付 2026-07-03 を公式表明値として書いたのと同じ形)。

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

#### 本章での適用

##### 確定内容 qa-009 (対応セル: web)

- 確定要件: 本章は qa-002 (削除・undo・監査を支える永続化) と qa-006 (手当ての継続維持と3点比較を支える永続化) を統合した内容を要件とする。(1) 4粒度の削除 (G1): 明細単位・取込単位・期間単位・全件のいずれでも削除対象を特定できるよう、mf_transactions.import_id / freee_deals.import_id の由来参照を維持し、balance_entries と cash_entries についても由来の持ち方を実装時に確認して不足すれば append-only の連番 migration で追加する。(2) undo (G4): 削除・上書きの直前状態を D1 の退避テーブルへ保持する (決定 D1-undo-snapshot-store)。D1 Free は1データベース 500 MB が上限であり Time Travel も 7 日・データベース単位の復元にとどまるため、保持期間を有限にした自前の退避テーブルが必要である。削除1行につき退避1行の書込が加わり rows written を二重に消費するため、1日あたりの削除規模を Free の 10万 rows written/日 に対して見積もる。(3) 監査 (G4): 誰がいつ何をどれだけ削除・上書きしたかの記録テーブルを新設する。(4) 再収束 (G5): 削除時に import_active_targets の現行指紋を巻き戻し、monthly_agg を実データから再計算する。(5) 手当ての継続維持 (G6): 既存の tx_edits (user_id, tx_id, cls, category_major, category_mid, owner, base_major, base_mid) / rules / account_norm_map / institution_owners / category_options を土台に、取引先単位の決め事を蓄積する vendor_memory (user_id, vendor_key, cls, category_major, category_mid, owner, hit_count, disagree_count, confidence, source, pinned, last_applied_at, updated_at) を新設する。適用の優先順位は tx_edits > rules > vendor_memory > 取込原本値 とし、利用者が明示登録した規則を学習が上書きしない。(6) 変更元の自動判定 (G7): tx_edits へ base_cls / base_owner を追加して cls / category_major / category_mid / owner の4属性すべてに前回取込原本値を持たせ、base / current / incoming の3点比較を成立させる。あわせて日付・金額・保有金融機関・正規化した内容から安定同一性キー (stable_key) を算出して保持し、明細IDが振り直されても手当てが追随するようにする。算出は packages/core/src/fingerprint.ts の正規化方針に揃え、指紋版数を持たせて規則変更に追従する。(7) 巻き添え防止 (G3): 削除は手動記録 (tx_edits / rules / cash_entries / attachments) を巻き込まず、明細が消えても手当てが孤立しない参照の持ち方にする。(8) 差分の把握 (G2): 上記 base 値により、取込前に何がどう変わるかを算出できる。スキーマ追加はすべて既存テーブルの破壊的再定義を避け migrations/ へ連番で append-only に足す。運用としては、退避行・base 値・vendor_memory の保持期間、長期間当たらない vendor_key の棚卸し、誤学習時の巻き戻し (決め事の取消は即時反映し、過去に自動適用された明細は取消して再判定で戻せる)、および退避行の期限切れを確実に消す掃除経路を持つ。
- 設計解釈の記録経路: `unrecorded`
- 設計原則の採否根拠: (未記録 — qa_log[].design_applications を writer 経由で補完すること)
- 資するゴール: G1, G2, G3, G4, G5, G6, G7

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-limits | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/limits/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| cloudflare-d1-pricing | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/pricing/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
