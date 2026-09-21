---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2, G5]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-statements-foundation-002。裏付け質疑 (`qa_refs`): `qa-statements-foundation-001`, `qa-statements-decision-005`, `qa-statements-decision-006`, `qa-statements-maintenance-ops-web-002`, `qa-statements-agent-decisions-001`, `qa-statements-reopen-pass3-001`, `qa-statements-maintenance-ops-web-evidence-001`, `qa-statements-image-fidelity-evidence-001`, `qa-statements-migration-0046-001`, `qa-statements-monthly-pl-unit-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、保守運用ではモバイルアプリのバージョンごとの互換と、ストア審査を含むリリース手順を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、保守運用ではタブレット専用画面の回帰テスト (実機の画面幅) をどう回すかを決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、保守運用では Windows 版の更新失敗時の復旧手順とクラッシュ報告の扱いを決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、保守運用では配布形式ごとの動作確認と不具合報告の窓口を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、保守運用では macOS の版更新ごとの互換確認と公証のやり直し手順を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 決算書の回帰を CI の test・typecheck・lint・verify:full で止める形へ反映した。既存の statements-balance-sheet.dom.test.tsx と balances-lifecycle.test.ts は新しい文言と本文形へ書き換え、旧実装で落ちることを確かめてから緑にする。区分の対応表と計算式は docs/data-schema.md、UI の決定は docs/ui-decisions.md に残す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G5

#### 主たる接地根拠: `qa-statements-foundation-002`

**問**

上位概念 G1 と O1 を、3 決定 (負債=前月末比・減少は良化色 / ページ内ナビ / 現金増減は画像どおり金額のみ) に合わせて改訂した文面で承認しますか？ ほかの U1-U9 は変えない。

**答**

この文面で承認する (appr-foundation-statements-002)。G1:『KPI 4 枚 (売上高・営業利益は前期比の金額と %、現金増減は前期比の金額のみ (画像どおり)、負債残高は前月末比の金額と % で減少を良化色。各々 出典と対象期間または基準日)、3 計算書の節へ移動するページ内ナビ (画像のタブの見た目。3 節は縦にすべて描画)』。O1 測定:『KPI 4 枚 (G1 の比較先と表示規則、出典、対象期間 / 基準日)・3 計算書へのページ内ナビ (nav と aria-current)』。(提示した他の選択肢: 修正が必要)

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 改訂前後の文面を提示 (2026-09-19T02:42:17Z 提示・11:34:24Z 回答) / 回答時刻: 2026-09-19T11:34:24Z)

#### 裏付け質疑: `qa-statements-foundation-001`

**問**

決算書画面 (design/FINAL-UI/images/11-statements.png) を正本として画面・集計・API・保存を作り直す今サイクルの上位概念 U1-U9 (本質的目的 / 背景 / ゴール G1-G5 / 目標 O1-O5 / 成功基準 S1-S5 / 関係者 SH1-SH2 / 範囲 in 7・out 5 / 制約 C1-C5 / 具体的やりたいこと I1-I8) を、要件定義書の憲法として確定してよいか。

**答**

この内容で承認する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / U1-U9 要約を preview で提示 / 回答時刻: 2026-09-19T01:53:56Z)

#### 裏付け質疑: `qa-statements-decision-005`

**問**

負債残高 KPI の「前期比」は何と比べ、減少を何色で示しますか？ (画像は『前期比 -¥200,000 (-8.0%)』を赤で表示)

**答**

前月末比・減少は良化色 (推奨)。比較先は前月末で、ラベルを『前月末比』に変え、減少=良化色・増加=注意色とする。画像の文言と色から意図的に外れる点は ui-decisions.md に記録する。(提示した他の選択肢: 前月末比・色は画像どおり / 画像どおり前期比)

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり (2026-09-19T02:30:05Z 提示・02:41:21Z 回答) / 回答時刻: 2026-09-19T02:41:21Z)

#### 裏付け質疑: `qa-statements-decision-006`

**問**

上部の『損益計算書 / キャッシュフロー計算書 / 貸借対照表』の切り替えをどう作りますか？

**答**

ページ内ナビ (推奨)。画像どおり 3 表を縦に全部描画し、上部は節へ移動するナビ (nav + aria-current) にする。(提示した他の選択肢: 本物のタブ = 選んだ 1 表だけを表示する tablist/tabpanel)

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり (2026-09-19T02:30:05Z 提示・02:41:21Z 回答) / 回答時刻: 2026-09-19T02:41:21Z)

#### 裏付け質疑: `qa-statements-maintenance-ops-web-002`

**問**

決算書画面の品質をどう保ち、規則をどこに残すか。

**答**

core の契約テストで恒等式 (全月と合計)・前期比 (前期 0 / 欠損で null)・未知科目は販管費・構成比・CF 不能の原因件数と『原因が 1 つも無ければ可』・負債の unset と zero の区別を固定し、specs/spec-statements-screen.md の検算済みフィクスチャで画面を DOM テストする (ページ内ナビの aria-current と role=tab が無いこと、行の aria-pressed、負債 KPI の『前月末比』と色の向き、現金 KPI に % が無いことを含む)。API 統合テストで 1 項目保存で他項目が残ること・unset で行が消えること・上限超過 400・本文超過 413・未認証 401・監査 1 件・取込中 409 を確かめ、migration が既存行を書き換えないことを検査する。既存の statements-balance-sheet.dom.test.tsx・balances-lifecycle.test.ts・statements-contract.test.ts は新しい文言と本文形へ更新し、旧実装で落ちることを確かめる (契約を緩めない)。区分の対応表と計算式は docs/data-schema.md に、UI の決定は docs/ui-decisions.md に記録する。pnpm lint (直書き色の検査)・typecheck・初期 JS 予算・verify:full を通す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-statements-maintenance-ops-web-001 を置き換える訂正版。利用者が選んだのは appr-foundation-statements-001/002 (O1-O5 の測定) と qa-statements-decision-001・005・006 の範囲で、それ以外の具体化 (値・部品分割・名前・判定式・テスト観点) はエージェント判断 (qa-statements-detail-parameters-001・qa-statements-agent-decisions-001 に列挙)。 / 回答時刻: 2026-09-19T11:41:33Z)

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

#### 裏付け質疑: `qa-statements-maintenance-ops-web-evidence-001`

**問**

maintenance-ops 章の裏付けとして、既存の検証コマンドと決算書のテストについて何を観測したか。

**答**

ルートの package.json は test・typecheck・lint (biome と check-design-tokens などの独自検査、security:content)・verify:full を持つ。決算書を固定するテストは packages/core/test/statements-contract.test.ts・packages/core/test/balances-contract.test.ts・packages/web/src/statements-balance-sheet.dom.test.tsx (文言『貸借対照表の月別明細』『負債を入れる』『この月の負債を保存』と PUT 本文 {month:'2026-08', lines:[{category:'借入金', amount:30000}]} を固定)・packages/api/src/balances-lifecycle.test.ts・common-shell-routes.dom.test.tsx (StatementsPage の export)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T02:01:29Z)

#### 裏付け質疑: `qa-statements-image-fidelity-evidence-001`

**問**

11-statements.png どおりであることを、現行の証跡はどこまで検証しているか。

**答**

現行証跡が確認したのは構成要素・順序・操作・横はみ出し・重なりの不在であり、基準画像との pixel diff または overlay の許容差は定義も測定もしていない。したがって機能・構造の受入は別に判定できるが、画像忠実度を『達成』とは判定しない。834px 幅の基準画像と同じ条件で比較し、動的な金額・日付・グラフ値と仕様 §8 の意図的差分だけを除外した overlay レビューが完了するまで画像忠実度は未達とする。許容対象はその明示除外だけで、未計測のずれを数値閾値で暗黙に許容しない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: design/FINAL-UI/images/11-statements.png (834x1886)、docs/evidence/statements/*.png、check-financial-visuals.mjs の検査項目の照合 / 回答時刻: 2026-09-19T21:52:53Z)

#### 裏付け質疑: `qa-statements-migration-0046-001`

**問**

負債 3 状態の migration 番号は、実際のワークツリーで何番になったか。

**答**

0045_owner_labels.sql が先に存在するため、仕様の衝突時繰り下げ規則を適用し、実体は migrations/0046_liability_status.sql になった。現行の仕様・運用・schema guard・テスト参照は 0046 を使う。0045 という記述は生成済み計画の履歴を除き、現行契約として扱わない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: migrations/0045_owner_labels.sql と migrations/0046_liability_status.sql のワークツリー観測 / 回答時刻: 2026-09-19T21:52:53Z)

#### 裏付け質疑: `qa-statements-monthly-pl-unit-001`

**問**

画像の月次PLと core / web の間で、数値の単位と月見出しをどう確定するか。

**答**

画像の月次PLはラベルが（万円）だが、950〜合計12,480は千円値として上部の12,480,000円と整合する。したがって画像の不整合は単位ラベルと、5月が重複して8月が空欄の月見出しである。数値の正本は core contract fixture の千円配列とし、core は各値を1,000倍して円を返す。web は表示だけで円を10,000で割って万円へ丸め、950,000円を95万円、12,480,000円を1,248万円と表示する。画像の950〜12,480を万円として写さない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: design/FINAL-UI/images/11-statements.png の再読、packages/core/src/statements-screen.ts の fixture と packages/web/src/pages/statements/view-model.ts の表示変換の照合 / 回答時刻: 2026-09-19T23:35:14Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /statements を 11-statements.png どおりの画面にする。問いの見出し『損益・資金・残高は、整合していますか？』と説明文、期間の範囲表示と前後移動、KPI 4 枚 (売上高・営業利益は前期比の金額と %、現金増減は前期比の金額のみ (画像どおり)、負債残高は前月末比の金額と % で減少を良化色。各々 出典と対象期間または基準日)、3 計算書の節へ移動するページ内ナビ (画像のタブの見た目。3 節は縦にすべて描画)、PL 表 (勘定科目・当期・前期・差額・構成比、行の展開、エクスポート)、右の『項目の詳細』パネル (金額・計算式・主な内訳の勘定科目・月別の推移・データの出典・明細を開く)、月別の損益推移グラフ (売上高・売上原価の棒と営業利益の線)、月次の損益計算書表 (万円・合計列) を、既存のデザイントークン・共通 Button・PageShell・期間 (usePeriod) の上に組む。読込・空・失敗の各状態を持つ。
- **G2**: 決算書の数値を core の純関数 1 か所で算出し、GET /api/statements がその screen だけを返す。勘定科目→区分 (売上高 / 売上原価 / 販管費) の固定対応表 (青色申告決算書の区分に合わせ、仕入高など仕入系の科目だけを売上原価、ほかの経費を販管費とする) から段階損益 (売上高・売上原価・売上総利益・販管費・営業利益) を月別と期間合計で出し、直前の同じ長さの期間との前期比 (金額と %)・構成比・各行の計算式と主な内訳科目を出す。KPI の現金増減と負債残高、各数値の出典と対象期間 / 基準日も同じ関数から出す。対応表と計算式は docs とテストで固定する。
- **G5**: 負債の保存経路と画面の安全性を整える。既存の認証・セッション・CSRF 相当の防御 (SameSite=Strict の Cookie と JSON の Content-Type 検証) と取込との直列化を保ったまま、金額の上限、リクエストの大きさの上限、保存操作の監査ログを加える。下書きには利用者の識別子をキーに含め、ログアウトで消す。取込データや下書きを外部へ送らない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 決算書画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出しと説明文・期間の範囲表示と前後移動・KPI 4 枚・3 計算書へのページ内ナビ・PL 表・詳細パネル・損益推移グラフ・月次表・読込/空/失敗を確認する。加えて 834px 幅の基準画像と同条件のスクリーンショットを overlay し、動的な金額・日付・グラフ値と仕様 §8 の意図的差分だけを除外して、説明できない配置・余白・文字階層・色の差が 0 件であることを記録する。pixel 差の数値閾値は未計測差を暗黙に許容するため設けず、許容対象を明示除外に限定する。 |
| O2 | 段階損益と前期比を core が決定論的に算出する。 | core の契約テストで、売上高−売上原価=売上総利益、売上総利益−販管費=営業利益が月別と合計で一致し、前期比は直前の同じ長さの期間から算出され、前期が 0 のとき % は null になり、未知の科目は販管費に入ることが緑である。 |
| O5 | 負債の保存経路が入力の上限と監査を持つ。 | API テストで、上限を超える金額と大きすぎる本文が 4xx で拒否され、保存が監査ログに 1 件残り、未認証の保存が拒否されることが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Statements.tsx を、問いの見出し・期間の範囲表示と前後移動・KPI 4 枚・3 タブ・PL 表と詳細パネル・損益推移グラフ・月次表・CF セクション・BS セクション・下部の未保存バーの構成に作り直し、選択中のタブと PL の行を URL に保つ。
- **I2**: core に勘定科目→区分の固定対応表と段階損益・前期比・構成比・計算式・主な内訳科目・出典を返す純関数を置き、GET /api/statements がそれを返す。
- **I3**: 詳細パネルの『明細を開く』から、選んだ区分の科目と期間で絞った明細仕分け画面 (Classify の ?category=&month=) へ移動できる。
- **I4**: PL のエクスポートで、表示中の段階損益 (当期・前期・差額・構成比と月次) を CSV で書き出せる。
- **I7**: 入力中の負債を localStorage に利用者別のキーで下書き保存し、保存時刻・リセット・未保存件数の固定バーを出し、ログアウトで下書きを消す。
- **I8**: PUT /api/balances/liabilities に金額の上限と本文の大きさの上限を課し、保存を監査ログへ記録する。

### 本章に効く確定意思決定

- **D-statements-draft-storage**: 決算書の負債入力の下書き (『下書きを自動保存しました』) をどこに保存するか
  - 採択: ブラウザ内 (localStorage に利用者別キー) (`browser-localstorage`)
  - 目的適合: G4 の『入力中の値をブラウザ内に利用者ごとの下書きとして自動保存』をそのまま満たす。既存の period.tsx と同じ方式。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『規則は名前と境界値テストで読めるようにする』を、本サイクルで増える 3 つの規則の保守に適用した。(1) 勘定科目→区分の対応表は core の名前付き定数にし、未知の科目が販管費に入る境界をテストで固定する。(2) 前期比は前期 0・前期欠損で % が null になる境界をテストで固定する。(3) 負債の 3 状態は、1 項目だけ保存して他項目が残ること、unset で行が消えること、zero が 0 として合計に入ることを API テストで固定する。いずれも旧実装で落ちることを確かめてから緑にする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T02:05:18Z)

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

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| vitest-expect | 5.0.1 | Vitest (vitest.dev) | https://vitest.dev/api/expect.html | 2026-09-19T02:03:50Z | 2026-09-19T02:03:50Z |
