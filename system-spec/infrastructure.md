---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G1, G4]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-statements-decision-007。裏付け質疑 (`qa_refs`): `qa-statements-infrastructure-web-002`, `qa-statements-agent-decisions-001`, `qa-statements-reopen-pass3-001`, `qa-statements-infrastructure-web-evidence-001`, `qa-statements-migration-0046-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、インフラではアプリストアへの配布と、プッシュ通知で月次の決算の整合を知らせる基盤を持つかを決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、インフラではタブレット向けの別ビルドと配布経路を持つかを決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、インフラでは Windows 向けインストーラのビルドと更新配信の基盤を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、インフラでは Linux 向けパッケージのビルドとリポジトリ配信を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、インフラでは macOS 向けのビルド・公証・更新配信の基盤を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | migrations/0046_liability_status.sql を追加のみに限り、Deploy の自動適用で止まらず、巻き戻しも新列・新表を使わないだけで済む形へ反映した。runtimeSchemaGuard の必須列に balance_entries.status と liability_audit_log を加え、migration 適用前の Worker が新しい保存経路を中途半端に動かさないようにする。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 決算書の部品をルート単位で分割読込し、CI の初期 JS 予算 (js-budget) を超えない形へ反映した。配信は既存の ci.yml・deploy.yml・migrate.yml の流れに乗せ、新しい監視やジョブは足さない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G4

#### 主たる接地根拠: `qa-statements-decision-007`

**問**

負債残高の保存・削除の記録 (監査ログ) をどう残しますか？

**答**

新表・金額は残さない (推奨)。migration 0045 で liability_audit_log を追加し、誰がいつどの月のどの項目を 保存/0円/未入力 にしたかだけを記録し、金額は残さない。既存 audit_log の CHECK 変更は表の再構築 (Deploy 自動適用で止まる) が要るため避ける。(提示した他の選択肢: 新表・金額も残す / 記録しない)

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: 新表で金額を残さない決定は有効だが、実 migration は migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり (2026-09-19T02:30:05Z 提示・02:41:21Z 回答) / 回答時刻: 2026-09-19T02:41:21Z)

#### 裏付け質疑: `qa-statements-infrastructure-web-002`

**問**

決算書画面の変更をどの基盤でどう配信・反映するか。

**答**

既存の Cloudflare Worker (packages/api、D1 の DB binding) と web の静的配信をそのまま使い、新しい基盤・外部サービスは足さない。migration 0045 は ADD COLUMN と CREATE TABLE だけなので Deploy の自動適用判定で止まらずに適用される。反映は既存の ci.yml・deploy.yml・migrate.yml の流れに乗せ、初期 JS 予算 (js-budget) を超えないよう決算書の部品はルート単位で分割読込する。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: 追加のみの配信方針は有効だが、適用対象は migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-statements-infrastructure-web-001 を置き換える訂正版。利用者が選んだのは qa-statements-decision-007 (migration は CREATE TABLE の追加だけ) と appr-foundation-statements-001 (C4) の範囲で、それ以外の具体化 (値・部品分割・名前・判定式・テスト観点) はエージェント判断 (qa-statements-detail-parameters-001・qa-statements-agent-decisions-001 に列挙)。 / 回答時刻: 2026-09-19T11:41:33Z)

#### 裏付け質疑: `qa-statements-agent-decisions-001`

**問**

pass-3 の差し戻しを直すときに、利用者の決定を具体化するためエージェントが決めた点は何か。

**答**

(a) 行の選択は勘定科目セル内のボタンと aria-pressed で示す (表の行は aria-selected を持てないため)。(b) ページ内ナビは選んだ項目だけに aria-current="location" を付け、スクロール位置で自動更新しない。選択時は節見出し (tabIndex=-1) へフォーカスを移す。(c) ref が期間外・不正なら期間の最終月に丸め、丸めた月を bs.referenceMonth で返し web は URL をその値へ置き換える。(d) CF は原因 3 種 (未仕訳件数・現金口座の欠け {月数, 決済列なし}・科目未設定件数) のどれかが立つときだけ不可にし、決済方法の列が無い場合 (既存 settlementUnknown) は 2 番目の原因に添えて表示する。原因が 1 つも無ければ可 (原因の無い不能表示を出さない)。(e) liability_audit_log の列は id・user_id・actor_user_id・month・changed_json・occurred_at で、changed_json は項目ごとの状態遷移と件数。(f) 画像との差 (負債 KPI の文言と色・ナビの意味論・行の選択・月次表の数値・CF 原因・監査) を spec §8 と docs/ui-decisions.md に記録する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: エージェントによる具体化 (利用者決定 qa-statements-decision-005〜007 と WAI-ARIA / 既存コードからの導出。利用者への個別確認なし) / 回答時刻: 2026-09-19T11:41:33Z)

#### 裏付け質疑: `qa-statements-reopen-pass3-001`

**問**

決算書画面サイクルの web × 8 セルを再オープンする理由は何か。

**答**

完成度 evaluator の pass-3 (FAIL) の high 指摘 H1: 8 セルの主根拠 qa-statements-<cat>-web-001 は basis=user-decision だが、利用者が代替案を見ずにエージェントが具体化した設計 (監査の新表、ref の丸め、タブの構成、負債 KPI の色の向き、現金 KPI の %) を含む。3 点は利用者に選択肢を示して決定を得た (qa-statements-decision-005〜007、foundation-002)。残りはエージェント判断として qa-statements-agent-decisions-001 に分けた。各セルを reopen し、利用者決定を主根拠に、訂正版の回答 web-002 (agent-inference) を補助根拠として確定し直す。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: エージェントによる再オープン理由の記録 (evaluator 指摘の転記) / 回答時刻: 2026-09-19T11:41:33Z)

#### 裏付け質疑: `qa-statements-infrastructure-web-evidence-001`

**問**

infrastructure 章の裏付けとして、既存の配信と反映の仕組みについて何を観測したか。

**答**

.github/workflows には ci.yml・deploy.yml・migrate.yml がある。api は packages/api/wrangler.jsonc の Worker で D1 を DB binding として使う。.github/scripts/plan-auto-migration.mjs は pending migration の SQL を静的に判定し、行を失う・書き換える文を含むと自動適用を止める。直近の #58 で初期 JS 予算の CI 実測値を記録している。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T02:01:29Z)

#### 裏付け質疑: `qa-statements-migration-0046-001`

**問**

負債 3 状態の migration 番号は、実際のワークツリーで何番になったか。

**答**

0045_owner_labels.sql が先に存在するため、仕様の衝突時繰り下げ規則を適用し、実体は migrations/0046_liability_status.sql になった。現行の仕様・運用・schema guard・テスト参照は 0046 を使う。0045 という記述は生成済み計画の履歴を除き、現行契約として扱わない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: migrations/0045_owner_labels.sql と migrations/0046_liability_status.sql のワークツリー観測 / 回答時刻: 2026-09-19T21:52:53Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /statements を 11-statements.png どおりの画面にする。問いの見出し『損益・資金・残高は、整合していますか？』と説明文、期間の範囲表示と前後移動、KPI 4 枚 (売上高・営業利益は前期比の金額と %、現金増減は前期比の金額のみ (画像どおり)、負債残高は前月末比の金額と % で減少を良化色。各々 出典と対象期間または基準日)、3 計算書の節へ移動するページ内ナビ (画像のタブの見た目。3 節は縦にすべて描画)、PL 表 (勘定科目・当期・前期・差額・構成比、行の展開、エクスポート)、右の『項目の詳細』パネル (金額・計算式・主な内訳の勘定科目・月別の推移・データの出典・明細を開く)、月別の損益推移グラフ (売上高・売上原価の棒と営業利益の線)、月次の損益計算書表 (万円・合計列) を、既存のデザイントークン・共通 Button・PageShell・期間 (usePeriod) の上に組む。読込・空・失敗の各状態を持つ。
- **G4**: 貸借対照表の負債残高を、基準月ごと・項目ごとに『未入力 / 0円 / 金額』の 3 状態で入力・保存できるようにする。借入金・未払金・クレジット未払の 3 項目は状態の選択を必須とし、その他の負債は任意項目として残す。保存済みの値を読み込んで初期表示し、保存は項目単位で上書きして他の項目を消さない。基準月は期間内の任意の月を選べる。入力中の値はブラウザ内に利用者ごとの下書きとして自動保存し保存時刻を示し、リセットで保存済みの値へ戻し、未保存の項目数を画面下部の固定バーに出す。未入力の項目がある月は BS にデータ不足の表示を出し、純資産を出さない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 決算書画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出しと説明文・期間の範囲表示と前後移動・KPI 4 枚・3 計算書へのページ内ナビ・PL 表・詳細パネル・損益推移グラフ・月次表・読込/空/失敗を確認する。加えて 834px 幅の基準画像と同条件のスクリーンショットを overlay し、動的な金額・日付・グラフ値と仕様 §8 の意図的差分だけを除外して、説明できない配置・余白・文字階層・色の差が 0 件であることを記録する。pixel 差の数値閾値は未計測差を暗黙に許容するため設けず、許容対象を明示除外に限定する。 |
| O4 | 負債残高の 3 状態入力が値を失わない。 | API と DOM のテストで、1 項目だけ保存しても他項目の保存値が残り、保存済みの値が初期表示され、『未入力』と『0円』が別々に保存・表示され、必須 3 項目の状態が未選択なら保存できず、下書きの復元・リセット・未保存件数の表示が緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Statements.tsx を、問いの見出し・期間の範囲表示と前後移動・KPI 4 枚・3 タブ・PL 表と詳細パネル・損益推移グラフ・月次表・CF セクション・BS セクション・下部の未保存バーの構成に作り直し、選択中のタブと PL の行を URL に保つ。
- **I3**: 詳細パネルの『明細を開く』から、選んだ区分の科目と期間で絞った明細仕分け画面 (Classify の ?category=&month=) へ移動できる。
- **I4**: PL のエクスポートで、表示中の段階損益 (当期・前期・差額・構成比と月次) を CSV で書き出せる。
- **I6**: 負債入力を基準月の月ピッカーと項目ごとの 3 択 (未入力 / 0円 / 金額を入力) に作り直し、migration 0046 で balance_entries に状態列を足し、PUT を項目単位の upsert にして保存済みの値を読み込む。
- **I7**: 入力中の負債を localStorage に利用者別のキーで下書き保存し、保存時刻・リセット・未保存件数の固定バーを出し、ログアウトで下書きを消す。

### 本章に効く確定意思決定

- **D-statements-draft-storage**: 決算書の負債入力の下書き (『下書きを自動保存しました』) をどこに保存するか
  - 採択: ブラウザ内 (localStorage に利用者別キー) (`browser-localstorage`)
  - 目的適合: G4 の『入力中の値をブラウザ内に利用者ごとの下書きとして自動保存』をそのまま満たす。既存の period.tsx と同じ方式。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。配信構成 (Worker・静的配信・D1) と binding を変えず、新設は同一 Worker 内の既存 2 経路の拡張と migrations/0046_liability_status.sql だけである。0046 を ADD COLUMN と CREATE TABLE に限ったのは、Deploy 前の自動適用判定が行の書き換え・削除を含む SQL を止める運用に合わせ、承認 manifest を要する復旧手順を発生させないためである。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T22:35:37Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-19T02:03:50Z | 2026-09-19T02:03:50Z |
