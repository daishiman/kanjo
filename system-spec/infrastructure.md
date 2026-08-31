---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G4, G5]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-002 |
| モバイル (mobile) | 対象外 | 理由: 専用モバイルアプリを提供せず、webのレスポンシブ表示で到達するためモバイル固有の要件を持たない |
| タブレット (tablet) | 対象外 | 理由: 専用タブレットアプリを提供せず、webのレスポンシブ表示で到達するためタブレット固有の要件を持たない |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 確定内容 (質疑録)

### qa-002 (対応セル: web)

**質問**: web におけるデータベース層とインフラ層の要件は何か。取込単位・期間・種別・全件の削除、上書き、取り消し(undo)を支えるために、どのデータをどこに持つか。

**回答**: データベースは Cloudflare D1 (kanjo-db) 単一で、スキーマ変更の正本は migrations/ 配下の連番SQLである。既存の取込系は imports (取込履歴・r2_key・run_id・target_keys)、import_runs (run単位の状態)、import_writer_claims (利用者別の単一writer claim・TTL15分)、import_active_targets (domain×month の現行指紋)、明細側は mf_transactions / freee_deals (いずれも import_id を持つ)、balance_entries、cash_entries、派生は monthly_agg、手動記録は overrides / rules / tx_splits / attachments である。今回の削除機能を支えるため、(a) 取込単位の巻き戻しができるよう、削除対象の明細が由来 import_id を辿れること (mf_transactions.import_id / freee_deals.import_id は既存。balance_entries と cash_entries は由来の持ち方を実装時に確認し、無ければ append-only の連番migrationで追加する)、(b) 取り消し(undo)のために削除・上書きの直前状態を保持する領域を新設し、保持期間を持たせる、(c) 誰がいつ何をどれだけ削除・上書きしたかの監査記録テーブルを新設する、(d) 削除時に import_active_targets の現行指紋を必ず巻き戻す、(e) 削除後に monthly_agg を実データから再計算する、を要件とする。スキーマ追加は既存テーブルの破壊的再定義を避け、migrations/ へ連番でappend-onlyに足す。インフラは Cloudflare Workers (nodejs_compat) + D1 + R2 (kanjo-files) の構成で、取込の原本ZIP/CSVは R2 に保持され POST /restore で取込枠へ戻せる。undoスナップショットの置き場は、明細を含むためD1に持つかR2に持つかを設計判断とし、いずれでも保持期間経過後に確実に消える掃除経路を持たせる。D1 には1リクエストあたりのクエリ本数上限があり、既存の query budget 設計 (D1_FREE_QUERY_LIMIT=50 未満、planMultipartImportQueries/planRestoreImportQueries) を壊さない。削除も件数に応じて分割実行し、上限を超えない。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| reliability | 引用可 | 第 4 章 Service Level Objectives (https://sre.google/sre-book/service-level-objectives/) / 第 6 章 Monitoring Distributed Systems (https://sre.google/sre-book/monitoring-distributed-systems/) / 第 24 章 Distributed Periodic Scheduling with Cron (https://sre.google/sre-book/distributed-periodic-scheduling/) / 第 26 章 Data Integrity: What You Read Is What You Wrote (https://sre.google/sre-book/data-integrity/) |
| operations | **条項引用不可** — 取得対象に無い (取れば可になる) | この concern の source_ref は SRE Workbook (https://sre.google/workbook/) だが、fetched-references.json の取得対象 8 件に含まれていない。取得していないものの章番号は引けない。同じ Google SRE でも reliability が引く sre-book とは別の本であり、sre-book の目次で workbook を代用することはできない。 |

- **reliability の引用範囲**: 取得済みなのは目次 (table of contents) のみ。引用根拠にできるのは『その章が存在すること・章番号・章題・正規 URL』まで。章本文は未取得のため、章の中の主張を要約して要件文の根拠にすることはできない。それをやると、取得していない内容を出典に帰属させることになる (C05 が実在しない日付 2026-07-03 を公式表明値として書いたのと同じ形)。

- **operations が引用可になる条件**: targets[] に SRE Workbook を足して C02 で取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### Site Reliability Engineering — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/site-reliability-engineering.md`

#### 目的

実行基盤・環境・リソースの構成を、目標信頼性 (SLO) と運用負荷の観点から選び、稼働中の状態を観測して是正できる形にする。

#### 解決する問題

- 目標信頼性が未定義のまま冗長化・監視を積み、費用と運用負荷だけが増える。
- 環境 (本番/検証/ローカル) の差分が人の記憶に残り、本番でのみ再現する障害が生まれる。
- 稼働中の構成 (環境変数・binding・シークレット) を外から確認できず、障害時に仮説を検証できない。
- 復旧手順が実行されたことのない文書として存在し、実際の障害時に機能しない。
- 手作業の運用 (トイル) が担当者に固定化され、人の交代で運用品質が落ちる。

#### 適用条件

- 利用者に対する可用性・遅延の期待があり、逸脱を検知して是正する責任を負う。
- 環境が複数あり (本番・検証・ローカル)、差分が事故要因になり得る。
- 観測・デプロイ・復旧を自動化する余地があり、運用担当が継続的に関与する。

#### 非適用条件

- 利用者も稼働期間も限定された使い捨て環境に、SLO 運用とエラーバジェット会計を先行適用しない。
- 実測データが無い段階で SLO を数値確定しない (暫定値であることを明示して観測から始める)。
- マネージド基盤が既に保証している性質を、自前の冗長化で二重化しない (責任分界点を先に確認する)。

#### トレードオフ・失敗モード

- SLO を高く置きすぎ、変更速度と費用を不必要に犠牲にする。
- 監視項目を増やすこと自体を目的化し、誰も見ないダッシュボードとアラート疲れを生む。
- Infrastructure as Code を導入しても本番へ手作業変更を許し、宣言と実体が乖離する (drift)。
- 復旧手順を一度も実行せず、実際の障害時に前提条件の欠落が判明する。
- 稼働中ビルドの素性を確認する手段を用意せず、「コードは直っている」と「本番が直っている」を区別できなくなる。

#### goalへの寄与

- 基盤選定の判断を、製品名の比較ではなく目標指標への寄与として記述でき、後から根拠を検証できる。
- エラーバジェットにより、機能追加と安定化の優先順位を都度の力関係でなく事前合意で決められる。
- 稼働実体の観測手段を要件に含めることで、障害の切り分け時間を短縮し、原因究明のラウンド数を減らす。

---

#### 本章での適用

##### 確定内容 qa-002 (対応セル: web)

- 確定要件: データベースは Cloudflare D1 (kanjo-db) 単一で、スキーマ変更の正本は migrations/ 配下の連番SQLである。既存の取込系は imports (取込履歴・r2_key・run_id・target_keys)、import_runs (run単位の状態)、import_writer_claims (利用者別の単一writer claim・TTL15分)、import_active_targets (domain×month の現行指紋)、明細側は mf_transactions / freee_deals (いずれも import_id を持つ)、balance_entries、cash_entries、派生は monthly_agg、手動記録は overrides / rules / tx_splits / attachments である。今回の削除機能を支えるため、(a) 取込単位の巻き戻しができるよう、削除対象の明細が由来 import_id を辿れること (mf_transactions.import_id / freee_deals.import_id は既存。balance_entries と cash_entries は由来の持ち方を実装時に確認し、無ければ append-only の連番migrationで追加する)、(b) 取り消し(undo)のために削除・上書きの直前状態を保持する領域を新設し、保持期間を持たせる、(c) 誰がいつ何をどれだけ削除・上書きしたかの監査記録テーブルを新設する、(d) 削除時に import_active_targets の現行指紋を必ず巻き戻す、(e) 削除後に monthly_agg を実データから再計算する、を要件とする。スキーマ追加は既存テーブルの破壊的再定義を避け、migrations/ へ連番でappend-onlyに足す。インフラは Cloudflare Workers (nodejs_compat) + D1 + R2 (kanjo-files) の構成で、取込の原本ZIP/CSVは R2 に保持され POST /restore で取込枠へ戻せる。undoスナップショットの置き場は、明細を含むためD1に持つかR2に持つかを設計判断とし、いずれでも保持期間経過後に確実に消える掃除経路を持たせる。D1 には1リクエストあたりのクエリ本数上限があり、既存の query budget 設計 (D1_FREE_QUERY_LIMIT=50 未満、planMultipartImportQueries/planRestoreImportQueries) を壊さない。削除も件数に応じて分割実行し、上限を超えない。
- 設計解釈の記録経路: `unrecorded`
- 設計原則の採否根拠: (未記録 — qa_log[].design_applications を writer 経由で補完すること)
- 資するゴール: G4, G5

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-r2-pricing | 2026-08-07 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/pricing/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| cloudflare-r2-limits | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/platform/limits/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
