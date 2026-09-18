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
| Web (web) | 確定 | 確定質疑: qa-matrix-backend-web-004。裏付け質疑 (`qa_refs`): `qa-matrix-backend-web-evidence-001`, `qa-matrix-backend-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、バックエンドでは端末内での再集計とサーバ集計の分担、オフライン時のセル内訳の取得可否を決める必要があった。対象を web のみとする利用者決定によりその検討は発生しない。集計は Worker 上の core 純関数に一本化する。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、バックエンドでは一度に取得する月数を増やしたときの応答サイズと分割取得の方針を決める必要があった。対象を web のみとする利用者決定によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、バックエンドではローカル実行時のデータ格納先と API の同梱可否を決める必要があった。対象を web のみとする利用者決定によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、バックエンドではローカル実行時のプロセス構成と D1 代替の保存先を決める必要があった。対象を web のみとする利用者決定によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、バックエンドではローカル実行時の権限とバックグラウンド集計を決める必要があった。対象を web のみとする利用者決定によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の依存方向を core (matrix 集計・偏り度スコア・セル内訳) ← api (matrix route) ← web (マトリックス画面) の一方向へ反映した。現行 matrix(data: Dataset) は事業固定で行が data.biz.categories に限られているため、scope と axis を引数に取り、行と列の合計と平均・階級境界・偏り上位 3 点を含む形へ拡張する。api は既存 GET /api/matrix をこの形へ広げ、セル内訳は別経路として足す。既存の CSV 出力は同じ純関数の結果から書き出し、画面と CSV で別々に集計しない。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスを route 側に閉じ、core の集計関数は D1 を知らない Dataset だけを受け取る形へ反映した。期間の前後 12 か月まで広げた読み取りも route の Dataset 組み立てで行い、純関数には『表示期間』と『比較のために読めた範囲』を区別した形で渡す。セル内訳の取得も同じ Dataset の絞り込みで組み、内訳専用の SQL を別に増やさない。取引先軸の上位 20 件 + その他への集約も純関数側で行い、route は集約後の行だけを JSON へ写す。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4

#### 主たる接地根拠: `qa-matrix-backend-web-004`

**問**

web のバックエンド要件は何か。マトリックスの集計 (スコープ・軸・モード・合計と平均・濃淡階級・偏り3点) とセル内訳をどこでどう算出し、どの API で返すかを確定する。 (このうち利用者が実際に選んだ部分)

**答**

利用者が本サイクルで選んだのは次の 5 点である。(1) 濃淡の階級は表示中のデータセルの最小〜最大を 7 階級に等分した、表全体で共通のスケールとする。合計行・平均行・合計列・平均列は階級の算出から除外する (含めると本体セルが最下位階級に潰れるため)。(2) 前月比・前年同月比の比較対象が表示期間の外にあっても、実データがあれば参照する。(3) 偏りが大きい 3 点は、月内偏り ((セル金額 − その月の平均) ÷ その月の標準偏差) と 行内偏り ((セル金額 − その行の平均) ÷ その行の標準偏差) の大きい方に、前月比が算出できる場合の増加ボーナス max(0, 前月比) を足したスコアの降順で選ぶ。(4) 要因の示唆は生成 AI を呼ばず、決定論のテンプレートへ金額・比率・件数を差し込んで作る。(5) 行の分類が『取引先』のときは、期間合計の上位 20 取引先 + 『その他』1 行に畳む。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion で選択した dec-matrix-heat-scale (1)、dec-matrix-out-of-range-comparison (2)、dec-matrix-outlier-score (3)、dec-matrix-insight-generation (4)、dec-matrix-counterparty-axis (5)。いずれも status=confirmed で user_decision を持つ。 / 回答時刻: 2026-09-16T11:14:15Z)

#### 裏付け質疑: `qa-matrix-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行の core 集計関数と API は何を返していて、どこを拡張する必要があるか。

**答**

packages/core/src/analysis.ts の matrix(data: Dataset): MatrixData は MatrixRow {label, isTotal, series, yearTotals, yoy} の配列を返し、行は data.biz.categories に 経費計 と 売上（記帳） を足したものである。MatrixData は months / unrecordedExpMonths / years / rows を持つ。packages/api/src/routes/analytics.ts は :418 で analyticsRoute.get('/matrix', ...) が c.json(matrix(data)) を返し、:648 で /export/matrix.csv を返す。拡張が要るのは、(1) 事業固定ではなく scope (total|biz|home) を受けること、(2) 行を取引先でも組めること (axis)、(3) 合計・平均を行方向と列方向の両方で返すこと、(4) 濃淡の階級境界を返すこと、(5) 偏り3点を返すこと、(6) セル単位の内訳を返す新エンドポイントである。現行に合計行 (isTotal) の概念はあるが、平均と列方向の集計、および濃淡スケールは存在しない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/core/src/analysis.ts:177-217 と packages/api/src/routes/analytics.ts:418,648 の読解 / 回答時刻: 2026-09-16T08:43:17Z)

#### 裏付け質疑: `qa-matrix-backend-web-003`

**問**

web のバックエンド要件は何か。マトリックスの集計 (スコープ・軸・モード・合計と平均・濃淡階級・偏り3点) とセル内訳をどこでどう算出し、どの API で返すかを確定する。 (このうち agent が補完した設計判断の部分)

**答**

上記の利用者決定を満たすための実装配置は agent の設計判断であり、利用者へ選択肢として提示していない。(1) 算出は packages/core の純関数 1 か所に置く。matrix 集計関数は Dataset と {scope: total|biz|home, axis: category|vendor} を受け、months / rows (key, label, series, total, average) / columnTotals / columnAverages / grandTotal / grandAverage / heatScale {min,max,steps:7} を返す。scope は total = biz + home を必ず満たす。未記帳月は合計・平均・比率・濃淡から除外し、平均は未記帳月を除いた月数で割る。(2) 表示モード (全部 / 構成比 / 前年差) は同じ series から導く別の純関数とし、構成比はその月の合計に対する割合 (列合計 100%)、前年差は前年同月との差額で、前年同月が無ければ '—'。(3) 偏り3点の同点は 金額降順 → 新しい月 → 行の固定順で解く。標準偏差 0 の行・月はスコア 0 とし、未記帳月・合計行・平均行は対象外、候補が 3 件未満ならある分だけ返す。示唆のパターンは 急増 (前月比 ≥ +50%) / 増加 (+10% 以上 +50% 未満) / 継続高水準 (前月比 +10% 未満かつ行平均の 1.5 倍以上) / 減少後も高水準 (前月比 < 0 かつ 前年同月比 > 0) / 前年比のみ増 / その他 の 6 種に分ける。(4) API は Hono の Cloudflare Worker (packages/api/src/routes/analytics.ts) に置き、GET /api/matrix に既存の期間クエリへ scope / axis / mode を足して集計結果と movers と updatedAt を返す。セル内訳は GET /api/matrix/cell?month=&axis=&key=&scope= を新設し、amount / mom / yoy / badge / transactions (金額降順で上位 10 件と truncated) / sources / updatedAt / detailHref を返す。含まれる取引の合計はセル金額と一致させる。(5) 既存の GET /api/export/matrix.csv は同じ core 関数から生成し、画面と CSV で数値が食い違わないようにする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存コード (packages/core/src/dataset.ts、packages/api/src/routes/analytics.ts、既存の CSV 出力) の読解にもとづく agent の設計判断。利用者へ提示して選択を得たものではない。 / 回答時刻: 2026-09-16T11:14:15Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 『偏りが大きい 3 点』を core の純関数で算出して表示する。順位・対象 (カテゴリと年月)・金額・前月比・前年同月比・要因の示唆を、月内偏り (その月の平均と標準偏差) と行内偏り (その行の平均と標準偏差) の大きい方に増加ボーナスを足したスコアの降順で 3 件選ぶ。要因の示唆は AI を呼ばず、増減パターン (急増 / 増加 / 継続高水準 / 減少後も高水準 / 前年比のみ増 / その他) を判定して金額・比率・件数を差し込む決定論テンプレートで生成する。選定規則と文テンプレートを docs に明記しテストで固定する。
- **G4**: マトリックスの集計を core の純関数とセル指向の API に置き換える。月×(カテゴリ | 取引先)、総合 / 事業 / 家計、金額 / 構成比 / 前年差、行と列の合計と平均、濃淡の階級 (表示中の全データセルの最小〜最大を 7 階級に等分した表全体共通スケール。合計行・平均行・合計列・平均列は算出から除外)、偏り上位 3 点、セル内訳の取引と出典を 1 か所で算出し、GET /api/matrix をこの形へ拡張したうえで、セル内訳は選択時に取得する。取引先軸は期間合計の上位 20 取引先 + 『その他』1 行にまとめる。前月比・前年同月比は比較対象が表示期間の外にあっても実データがあれば参照する。既存の matrix CSV 出力と総収支・分析ハブ・推移の数値と突き合わせて一致させる。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 偏り上位 3 点を core の純関数で決め、境界値をテストで固定する。 | core 単体テストが、同値のときの順位付け・前月比が算出できない月・前年同月が無い場合・候補が 3 件未満の場合を検証し、画面の 3 行と一致する。 |
| O4 | core のマトリックス集計と API がスコープ・軸・モードを一貫して返す。 | core 単体テストで 総合=事業+家計 の合計整合・構成比の列合計が 1・前年差の対象外月 (未記帳・前年同月なし) の扱い・取引先軸のその他まとめ・濃淡階級の境界が検証され、API テストで期間とスコープと軸のクエリ、セル内訳の取得、既存 matrix CSV との金額一致が緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に matrix 集計関数を置き、スコープ (総合 / 事業 / 家計)・軸 (カテゴリ / 取引先)・モード (金額 / 構成比 / 前年差)・行列の合計と平均・濃淡階級・偏り上位 3 点を 1 か所で算出する。
- **I4**: GET /api/matrix を期間・スコープ・軸・モードのクエリで受け、セル内訳 (含まれる取引と出典) は選択時に別経路で取得する。既存の matrix CSV は同じ core 関数から生成する。
- **I7**: 集計規則・濃淡階級・偏り 3 点の選定規則・未記帳月の扱いを docs に記載し、core と DOM のテストで固定する。

### 本章に効く確定意思決定

- **dec-matrix-heat-scale**: ヒートマップの濃淡は何を基準に決めるか。表全体で共通のスケールにするか、月ごと (列ごと) に正規化するか。
  - 採択: 表全体で共通の 7 階級 (表示中の全データセルの最小〜最大を等分) (`opt-global-scale`)
  - 目的適合: G1 の『どの月・カテゴリに支出が偏っているか』という問いに直接答える。列をまたいで濃さを比較できるため、特定の月だけ突出しているセルが一目で分かる。
- **dec-matrix-insight-generation**: 偏りが大きい 3 点の『要因の示唆』をどう生成するか。AI 生成文にするか、決定論テンプレートにするか。
  - 採択: 増減パターンを判定し金額・比率・件数を差し込む決定論テンプレート (`opt-deterministic-template`)
  - 目的適合: G3 の『選定規則と文テンプレートを docs に明記しテストで固定する』を満たす。同じ入力から必ず同じ文が出る。
- **dec-matrix-out-of-range-comparison**: 前月比・前年同月比の比較対象が表示期間の外にある場合、期間外のデータを参照するか、比較を空欄にするか。
  - 採択: 表示期間の前後 12 か月まで読み取り範囲を広げて実データがあれば参照する (`opt-read-outside-range`)
  - 目的適合: 画像の選択セル (広告宣伝費 2026年03月) は前年同月比 +300.0% を表示しており、前年同月は表の期間外にある。参照しなければ画像を再現できない。
- **dec-matrix-counterparty-axis**: 行の分類を『取引先』に切り替えたとき、取引先が数百件ある場合に行をどう抑えるか。
  - 採択: 期間合計の上位 20 取引先 + 『その他』1 行に畳む (サーバ側で集約) (`opt-top20-plus-other`)
  - 目的適合: ヒートマップは一覧して偏りを見つける道具であり、行数が画面に収まることが前提。上位 20 件で支出の大半を覆える。
- **dec-matrix-outlier-score**: 『偏りが大きい 3 点』をどの規則で選ぶか。単純な金額順にするか、偏り度のスコア順にするか。
  - 採択: 偏り度スコア score(cell) = max(z_month, z_row) + max(0, mom_rate) の降順 (`opt-deviation-score`)
  - 目的適合: G3 の『月内偏りと行内偏りの大きい方に増加ボーナスを足したスコアの降順で 3 件選ぶ』をそのまま実装する。
- **dec-matrix-fixture-authority**: 参照画像 06-matrix.png の合計・平均欄はセル値の実計算と最大 19.4 万円ずれている (画像側の丸め誤差)。再現テスト用フィクスチャはセル値と合計欄のどちらを正本にするか。
  - 採択: セル値を正本とし、合計・平均欄を実計算値へ置き換える (`opt-cell-authority`)
  - 目的適合: 成功基準 S4『合計・平均が表の値と一致する』を toBe による厳密一致でテストできる。期待値が算術的に閉じているため、集計ロジックの誤りがそのままテスト失敗として現れる。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を集計の置き場所に適用した。月×(カテゴリ|取引先)の集計、総合/事業/家計の切り分け、金額/構成比/前年差の変換、行と列の合計と平均、濃淡の階級境界、偏り度スコアによる上位 3 点の選定は、いずれも入出力を持たない計算なので core の純関数に置く。api の route は期間と切替をクエリから受け取り、Dataset を組んで純関数へ渡し、結果を JSON の形へ写すだけにする。これにより同じ集計を CSV 出力と画面で二重に書かずに済み、既存の総収支・分析ハブ・推移との数値の一致も純関数の単体テストで確かめられる。セル内訳だけは取引の実体を返すため別の関数と別のエンドポイントに分ける。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-16T10:14:46Z)

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
| hono-zod-validator | 4.13.8 | Hono (hono.dev) | https://hono.dev/docs/guides/validation | 2026-09-16T09:23:00Z | 2026-09-16T10:13:57Z |
