---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G4, G5, G6, G7]
---

# 保守運用管理 (maintenance-ops)

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
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| operations | **条項引用不可** — 取得対象に無い (取れば可になる) | この concern の source_ref は SRE Workbook (https://sre.google/workbook/) だが、fetched-references.json の取得対象 8 件に含まれていない。取得していないものの章番号は引けない。同じ Google SRE でも reliability が引く sre-book とは別の本であり、sre-book の目次で workbook を代用することはできない。 |

- **operations が引用可になる条件**: targets[] に SRE Workbook を足して C02 で取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

---

#### 本章での適用

##### 確定内容 qa-009 (対応セル: web)

- 確定要件: 本章は qa-002 (削除・undo・監査を支える永続化) と qa-006 (手当ての継続維持と3点比較を支える永続化) を統合した内容を要件とする。(1) 4粒度の削除 (G1): 明細単位・取込単位・期間単位・全件のいずれでも削除対象を特定できるよう、mf_transactions.import_id / freee_deals.import_id の由来参照を維持し、balance_entries と cash_entries についても由来の持ち方を実装時に確認して不足すれば append-only の連番 migration で追加する。(2) undo (G4): 削除・上書きの直前状態を D1 の退避テーブルへ保持する (決定 D1-undo-snapshot-store)。D1 Free は1データベース 500 MB が上限であり Time Travel も 7 日・データベース単位の復元にとどまるため、保持期間を有限にした自前の退避テーブルが必要である。削除1行につき退避1行の書込が加わり rows written を二重に消費するため、1日あたりの削除規模を Free の 10万 rows written/日 に対して見積もる。(3) 監査 (G4): 誰がいつ何をどれだけ削除・上書きしたかの記録テーブルを新設する。(4) 再収束 (G5): 削除時に import_active_targets の現行指紋を巻き戻し、monthly_agg を実データから再計算する。(5) 手当ての継続維持 (G6): 既存の tx_edits (user_id, tx_id, cls, category_major, category_mid, owner, base_major, base_mid) / rules / account_norm_map / institution_owners / category_options を土台に、取引先単位の決め事を蓄積する vendor_memory (user_id, vendor_key, cls, category_major, category_mid, owner, hit_count, disagree_count, confidence, source, pinned, last_applied_at, updated_at) を新設する。適用の優先順位は tx_edits > rules > vendor_memory > 取込原本値 とし、利用者が明示登録した規則を学習が上書きしない。(6) 変更元の自動判定 (G7): tx_edits へ base_cls / base_owner を追加して cls / category_major / category_mid / owner の4属性すべてに前回取込原本値を持たせ、base / current / incoming の3点比較を成立させる。あわせて日付・金額・保有金融機関・正規化した内容から安定同一性キー (stable_key) を算出して保持し、明細IDが振り直されても手当てが追随するようにする。算出は packages/core/src/fingerprint.ts の正規化方針に揃え、指紋版数を持たせて規則変更に追従する。(7) 巻き添え防止 (G3): 削除は手動記録 (tx_edits / rules / cash_entries / attachments) を巻き込まず、明細が消えても手当てが孤立しない参照の持ち方にする。(8) 差分の把握 (G2): 上記 base 値により、取込前に何がどう変わるかを算出できる。スキーマ追加はすべて既存テーブルの破壊的再定義を避け migrations/ へ連番で append-only に足す。運用としては、退避行・base 値・vendor_memory の保持期間、長期間当たらない vendor_key の棚卸し、誤学習時の巻き戻し (決め事の取消は即時反映し、過去に自動適用された明細は取消して再判定で戻せる)、および退避行の期限切れを確実に消す掃除経路を持つ。
- 設計解釈の記録経路: `unrecorded`
- 設計原則の採否根拠: (未記録 — qa_log[].design_applications を writer 経由で補完すること)
- 資するゴール: G4, G5, G6, G7

## 最新ドキュメント出典

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
