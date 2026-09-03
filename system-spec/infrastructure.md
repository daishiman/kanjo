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

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。**条項を引けないことは、その指針を適用できない理由にはならない**。本章の「本章での適用」節は、条項番号ではなく authority が導く上流原則を採否の根拠として書く。

### 条項引用の可否 (clause citation)

本節の判定基準は「`fetched-references.json` に実体のある取得記録があるか」の一点である。現在の取得対象は 7 件 (`cloudflare-d1-limits` / `cloudflare-d1-pricing` / `cloudflare-r2-pricing` / `cloudflare-r2-limits` / `git-merge-three-way` / `sqlite-upsert` / `cloudflare-workers-ai-pricing`) であり、doctrine anchor の authority (OWASP ASVS / Apple Human Interface Guidelines / Clean Architecture / Google SRE) はいずれも含まれない。また `system-spec/retrieval-evidence/` はこの作業ツリーに存在しない。

> **訂正記録 (2026-09-02)**: 本節の従前の記述は、OWASP ASVS と Apple HIG について「取得済み (`retrieval-evidence/owasp-asvs.json`, 67761 B / `retrieval-evidence/apple-hig.json`, 17681 B)」とバイト数付きで書き、Google SRE の sre-book について「取得済みなのは目次」と書いていた。独立監査 (C05) がこれらの現物不在を指摘し、`system-spec/retrieval-evidence/` 自体が存在しないこと、履歴上も当該2ファイルが一度も存在しないこと (`git log --all --diff-filter=A` で 0 件)、`fetched-references.json` の取得対象が 7 件であること (従前の記述は「8 件」としていた) を確認したため、取得済みの主張とバイト数・観測内容の記述をすべて撤回する。取得していないものを取得済みと書くことは、この章自身が戒める「取得していない内容を出典に帰属させること」そのものである。判定は下表のとおり「取得対象に無い」へ改める。

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| reliability | **条項引用不可** — 取得対象に無い (取れば可になる) | authority の Google SRE Book (https://sre.google/sre-book/) は Web 公開だが、取得対象 7 件に含まれない。章題や章番号は広く知られているが、取得記録の無いものを出典として引くことはしない。 |
| operations | **条項引用不可** — 取得対象に無い (取れば可になる) | この concern の source_ref は SRE Workbook (https://sre.google/workbook/) で、取得対象 7 件に含まれない。同じ Google SRE でも reliability が指す sre-book とは別の本であり、片方で他方を代用することはできない。 |

- **reliability が引用可になる条件**: targets[] へ足して C02 で取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。
- **operations が引用可になる条件**: targets[] へ足して C02 で取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。

## 適用された設計知識

- `ref-system-design-knowledge/references/resource-map.yaml` — 本章 (infrastructure) を指す `read_when` の索引が resource-map に無いため、seed card は割り当たらない。代わりに本仕様で深化した project candidate のカードを以下に載せる。

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

本章の確定セル (infrastructure.web) が資するゴールは G4, G5 である (正本は `spec-state.json` の `matrix.infrastructure.web.serves_goals`。本節および frontmatter はこの値を写す)。以下の各項の「資するゴール」は、この集合の部分集合として、当該質疑が直接寄与する範囲を示す。

同じ qa-002 は database 章の出発点でもあるが、本章が担うのは「どの実行環境・保存先を、どの上限のもとで、どう配分するか」であり、表・列・参照の定義そのものは database 章 qa-009 が、掃除と監視の運用は maintenance-ops 章が担う。両章で同じ文面を重複させない。

#### 確定内容 qa-002 (対応セル: web)

- 確定要件: 本章は qa-002 のうち実行基盤と枠の配分を要件とする。(1) 構成: Cloudflare Workers (nodejs_compat) + D1 (kanjo-db) + R2 (kanjo-files) の既存構成を変えない。削除機能のために新しい保存先や新しい実行環境を導入しない。(2) スキーマ変更の正本: `migrations/` 配下の連番 SQL を正本とし、追加は append-only で足す。既存テーブルの破壊的再定義を避けるのは、稼働中の帳簿データに対する再定義が失敗した場合、戻す手段が D1 の Time Travel (7 日・データベース単位) しかないためである。(3) 原本の保持: 取込の原本 ZIP / CSV は R2 に保持され、`POST /restore` で取込枠へ戻せる既存経路を維持する。取込結果を削除しても原本は R2 に残るため、「消したあとにもう一度取り込み直す」が回復手段のひとつとして成立する。この経路は undo とは別系統であり、undo が退避テーブルによる直前状態への巻き戻しであるのに対し、こちらは原本からの再構成である。(4) 退避先の選択: undo 退避の置き場は D1 と R2 のいずれも取りうるが、決定 `D1-undo-snapshot-store` により D1 内とする。いずれの選択でも、保持期間経過後に確実に消える掃除経路を持たせることを本章の要件とする。(5) クエリ本数の枠: D1 には1リクエストあたりのクエリ本数上限があり、既存の query budget 設計 (`D1_FREE_QUERY_LIMIT` は 50 未満、`planMultipartImportQueries` / `planRestoreImportQueries`) を壊さない。削除も件数に応じて分割実行し、上限を超えない。(6) 枠の配分方針: D1 Free の 1データベース 500 MB・全体 5 GB・rows written 10万/日・1呼び出しあたり 50 クエリ・Time Travel 7 日 という固定上限に対し、機能追加のたびに枠を「余っているぶんだけ使う」のではなく、用途ごとの取り分をあらかじめ決める。退避テーブルへ 300 MB (500 MB の 60%)、監査記録へも同じ 300 MB を上限として与える配分は、この方針の具体化として database 章 qa-013 / qa-016 が確定している。
- 実装同期: 夜間 scheduled は7 jobを `packages/api/src/scheduled-maintenance-budget.ts` の単一表で配分し、同一 invocation の上界を46 queries（Free上限50に4本の余白）とする。内訳は backup 1 / attachment 20（3件、`2+6n`）/ password throttle 1 / improvement 3 / undo retention 12 / audit header 3 / audit detail 6。`D1Database.batch()` は内包statement数で数える。回復資産であるbackupを先に `await` し、その後の6 jobを独立してsettleする。
- 設計解釈の記録経路: 本項は出典 `cloudflare-d1-limits` および `cloudflare-r2-limits` の固定上限を与件とし、`quota-bounded-capacity-design` の知識カード (上限が固定された管理型プラットフォームにおける割当枠の設計時配分) をその適用形として参照する。カードが挙げる4種の枠 — 容量・書込行数・呼び出しあたりのクエリ本数・時点復旧の遡及幅 — は、本章では (6) の 500 MB、(6) の 10万行/日、(5) の 50 クエリ、(2) の Time Travel 7 日 にそれぞれ対応する。decision `D1-undo-snapshot-store` の `user_decision` が退避先の選択を確定しており、本章はその前提となる基盤側の制約を記録する。
- 設計原則の採否根拠: **本章の上流指針 (concern=reliability / operations, authority=Google SRE) が導く「基盤の変更は、失敗したときに戻せる形でのみ行う」原則を採る**。スキーマ変更を append-only の連番 migration に限り、既存テーブルの破壊的再定義を避ける。**代替の「都度、最適な形へテーブルを定義し直す」進め方を採らなかった**のは、稼働中の帳簿データに対する再定義は失敗時の戻し先が Time Travel の 7 日しかなく、戻せない変更になるからである。SRE Book / SRE Workbook を取得できていないため章番号は引けないが (「条項引用の可否」参照)、指針そのものは適用する。**同じ上流指針が導く「容量の枯渇は障害として扱う」原則を採る**。枠の消費を機能追加のたびに配分し直し、上限到達を運用の想定内へ置く。**quota-bounded capacity design から、枠を設計時に配分する方針を採る**。500 MB を「上限」としてではなく「配り切る対象」として扱い、退避・監査・本体それぞれの取り分を先に決める。**代替の「上限に近づいたら対処する」運用を採らなかった**のは、固定上限のプラットフォームでは上限へ触れた時点で書込が失敗しており、対処のための変更 (掃除の追加・保持期間の短縮) そのものが実行できない状態になりうるからである。枠を使い切ってから考える設計は、考える手段ごと失う。**同じ原則から、構造的上限と総量上限を別の手段で守る区別を採る**。1呼び出しあたり 50 クエリという構造的上限は分割実行で、500 MB という総量上限は保持期間と容量上限で守る。**代替の「分割実行だけで両方に備える」対処を採らなかった**のは、分割は総量に一切効かないためである。**Clean Architecture から、時点復旧を機能の回復手段として数えない方針を採る**。Time Travel はデータベース単位・7 日の復元であり、「利用者が誤って消した1回の取込だけを戻す」という要求を満たさない。**代替の「Time Travel があるので undo の退避は不要」という判断を採らなかった**のは、粒度 (データベース全体 vs 1操作) と期間 (7 日 vs 30 日) の双方で要求と一致せず、G4 が求める回復可能性を基盤の機能で代替したことにできないからである。基盤が提供する回復と、機能が約束する回復は別物として重ねる。
- 資するゴール: G4, G5

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-r2-pricing | 2026-08-07 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/pricing/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| cloudflare-r2-limits | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/platform/limits/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
