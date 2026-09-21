---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G3, G4]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-statements-decision-006。裏付け質疑 (`qa_refs`): `qa-statements-decision-003`, `qa-statements-image-observations-001`, `qa-statements-frontend-web-002`, `qa-statements-agent-decisions-001`, `qa-statements-reopen-pass3-001`, `qa-statements-frontend-web-evidence-001`, `qa-statements-detail-parameters-001`, `qa-statements-csv-chars-001`, `qa-statements-screen-only-contract-001`, `qa-statements-monthly-pl-unit-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、フロントエンドではネイティブの描画基盤 (React Native など) と web との部品共有を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、フロントエンドではタブレット専用ビルドの分岐と画面幅ごとの部品差し替えを決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、フロントエンドでは Windows 向けのデスクトップ殻 (Electron など) への組込みを決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、フロントエンドでは Linux 向けの殻と描画エンジンの差を吸収する方法を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、フロントエンドでは macOS 向けの殻とネイティブメニューとの接続を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | Apple HIG の『利用者の操作に即座に応える』を負債入力のフィードバックへ反映した。3 択の選択で金額欄が即時に出入りし、変更から 800ms で下書きを保存して保存時刻を出し、未保存の件数を下部固定バーに数える。保存中はボタンを無効化して『保存中…』と出し、失敗は role=alert で理由を示して下書きを残す。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 依存方向を core (statementsScreen) ← api (statements route・balances route) ← web (決算書画面) の一方向へ反映した。web の部品 (KpiStrip・PlCard・PlDetailPanel・CashFlowSection・LiabilitySection・UnsavedBar) は screen の部分を props で受けて描くだけで、互いに計算結果を渡し合わない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G3, G4

#### 主たる接地根拠: `qa-statements-decision-006`

**問**

上部の『損益計算書 / キャッシュフロー計算書 / 貸借対照表』の切り替えをどう作りますか？

**答**

ページ内ナビ (推奨)。画像どおり 3 表を縦に全部描画し、上部は節へ移動するナビ (nav + aria-current) にする。(提示した他の選択肢: 本物のタブ = 選んだ 1 表だけを表示する tablist/tabpanel)

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり (2026-09-19T02:30:05Z 提示・02:41:21Z 回答) / 回答時刻: 2026-09-19T02:41:21Z)

#### 裏付け質疑: `qa-statements-decision-003`

**問**

『下書きを自動保存しました』の下書きをどこに保存するか。

**答**

ブラウザ内。localStorage に利用者ごとのキーで保存し、サーバへ送るのは『負債残高を保存』のときだけ。既存の Cash / Budget 画面と同じ方式で migration は不要。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-19T01:53:56Z)

#### 裏付け質疑: `qa-statements-image-observations-001`

**問**

design/FINAL-UI/images/11-statements.png から読み取れる、仕様の分かれ目になる事実は何か。

**答**

(1) 現金増減の KPI は『前期比 +¥120,000』で % が無い。(2) 負債残高の KPI は『前期比 -¥200,000 (-8.0%)』を赤で出している。(3) 上部の『損益計算書 / キャッシュフロー計算書 / 貸借対照表』はタブの見た目で、画面は PL の下に CF・BS が縦に続き 3 節すべてが描かれている。(4) CF の不能表示の原因は 3 行 (未仕訳の件数・現金口座データの月数・科目未設定の件数) で、決済方法の列については書かれていない。(5) 月次の損益計算書の表は行の和が合計列と一致しない。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T23:35:14Z` — SUPERSEDED OBSERVATION: 『月次の損益計算書の表は行の和が合計列と一致しない』は誤り。画像の 950〜合計 12,480 は千円値として各月合計と上部の 12,480,000円に整合する。画像の問題は単位ラベルが（万円）であることと、月見出しに 5月が重複して 8月が空欄なこと。現行の単位契約は qa-statements-monthly-pl-unit-001 を規範とする。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 11-statements.png の目視読み取り (エージェント) / 回答時刻: 2026-09-19T11:41:33Z)

#### 裏付け質疑: `qa-statements-frontend-web-002`

**問**

決算書画面のフロントエンド構成 (部品分割・データ取得・URL 状態・下書き) をどう組むか。

**答**

Statements.tsx を薄い組み立てにし、packages/web/src/pages/statements/ に KpiStrip・PlCard (表と展開)・PlDetailPanel・PlTrendChart (FinancialCharts の系列規約に乗せる)・MonthlyPlTable・CashFlowSection (不能表示と概算の切替)・LiabilitySection (3 状態入力と基準月)・UnsavedBar を置く。データは TanStack Query で GET /api/statements の screen (期間クエリ + ref) を 1 本読み、数値の計算を web で重複実装しない。ページ内ナビの選択 (tab)・行・基準月は useSearchParams に保つ (ナビは nav のリンクと aria-current、行の選択は aria-pressed のボタン。基準月は api が丸めて返した月へ URL を置き換える)。負債の保存は useMutation で PUT し、成功時に statements のクエリを無効化する。下書きは localStorage の kanjo.statements.liabilityDraft.<userId>.<YYYY-MM> に 800ms の遅延で保存し (period.tsx の try/catch の書き方に倣う)、ログアウト処理でこの接頭辞のキーを消す。色はトークン、ボタンは共通 Button、遷移は Link className=btn、本文は PageShell。CSV は web で組み、数式注入対策で = + - @・タブ・NUL で始まる文字列セルに ' を付ける。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-statements-frontend-web-001 を置き換える訂正版。利用者が選んだのは qa-statements-decision-006 (ページ内ナビ)・003 (下書きはブラウザ内) と appr-foundation-statements-001/002 の範囲で、それ以外の具体化 (値・部品分割・名前・判定式・テスト観点) はエージェント判断 (qa-statements-detail-parameters-001・qa-statements-agent-decisions-001 に列挙)。 / 回答時刻: 2026-09-19T11:41:33Z)

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

#### 裏付け質疑: `qa-statements-frontend-web-evidence-001`

**問**

frontend 章の裏付けとして、既存の web の土台について何を観測したか。

**答**

packages/web は React 18 + react-router-dom 7 + TanStack Query 5。period.tsx は localStorage を STORAGE_KEY で try/catch つきで読み書きする (81-91 行)。Classify.tsx は ?month= と ?category= を初期値として読む (181-194 行)。ログアウトの呼出しは components/Layout.tsx にある。localStorage を使うのは period.tsx と pages/analysis/diagnosis/types.ts だけ。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T02:01:29Z)

#### 裏付け質疑: `qa-statements-detail-parameters-001`

**問**

ui-ux・frontend・backend・security の web-001 回答に含まれる具体値のうち、どれが利用者の決定で、どれがエージェントの具体化か。

**答**

利用者が決めたのは 4 決定 (qa-statements-decision-001〜004) と U1-U9 の承認 (appr-foundation-statements-001) まで。次の値はエージェントが既存コードと公式資料から具体化した既定値で、利用者は個別に選んでいない: 金額上限 1 兆円 (表示と集計の桁あふれ防止)、本文上限 8 KiB (4 項目の本文は 1 KiB 未満。既存の /api/auth/* は 16 KiB)、下書き保存の遅延 800ms、詳細パネルの主な内訳 3 科目、月次表の万円丸め (合計列は円で合算してから丸める)、URL パラメータ名 (tab・row・ref)、下書きのキー名、区分対応表に載せる科目の列挙 (仕入高・期首商品棚卸高・期末商品棚卸高)。いずれも上位概念 G1-G5 と 4 決定に反しない調整値で、実装中に変えるときは specs/spec-statements-screen.md とテストを同時に変える。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: エージェントによる具体化の区分表示 (利用者への個別確認なし) / 回答時刻: 2026-09-19T02:18:27Z)

#### 裏付け質疑: `qa-statements-csv-chars-001`

**問**

CSV エクスポートの数式注入対策で ' を前置する先頭文字は何か (qa-statements-frontend-web-001 と qa-statements-security-web-001 は = + - @ だけを挙げている)。

**答**

OWASP ASVS 5.0 の 1.2.10 (fetched-references の owasp-asvs-csv-injection、2026-09-19T02:03:50Z 確認) に従い、= + - @ に加えてタブ (0x09) と NUL (0x00) で始まる文字列セルにも ' を前置する。qa-statements-frontend-web-001 と qa-statements-security-web-001 の『= + - @』はこの集合の一部だけを挙げた記述であり、正本は specs/spec-statements-screen.md §5 (= + - @・タブ・NUL) とする。金額のセルは数値のまま書き出し ' を付けない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 公式資料 (OWASP ASVS 5.0 1.2.10) と specs/spec-statements-screen.md §5 の照合 / 回答時刻: 2026-09-19T02:18:27Z)

#### 裏付け質疑: `qa-statements-screen-only-contract-001`

**問**

GET /api/statements の現行契約で、画面が参照しない旧 pl/cf/bs/period 等を screen と重ねて返す必要があるか。

**答**

不要。決算書画面の表示値は core の statementsScreen 出力だけを正本にしているため、GET /api/statements は {screen} だけを返す。旧キーを同時に返す後方互換は、同じ数値の二重契約と応答・型・テストの重複を残すので撤去する。PUT /api/balances/liabilities の応答 {ok, bs} は保存結果の契約として別に維持する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 2026-09-20 elegant review: 重複契約を除き、core→API→web の単一データフローへ収束する判断 / 回答時刻: 2026-09-19T21:52:53Z)

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
- **G3**: キャッシュフロー計算書が集計できないときは、画像の表示 (『キャッシュフロー計算書は、現在集計できていません』・主な原因・解決方法の 3 手順・取引データを確認) に切り替え、表とグラフを出さない。原因は core が判定し、未仕訳の取引件数・現金口座データの欠け・勘定科目が未設定の取引件数を件数つきで示す。集計できるときは既存の営業 CF 概算 (表とグラフ) を出す。
- **G4**: 貸借対照表の負債残高を、基準月ごと・項目ごとに『未入力 / 0円 / 金額』の 3 状態で入力・保存できるようにする。借入金・未払金・クレジット未払の 3 項目は状態の選択を必須とし、その他の負債は任意項目として残す。保存済みの値を読み込んで初期表示し、保存は項目単位で上書きして他の項目を消さない。基準月は期間内の任意の月を選べる。入力中の値はブラウザ内に利用者ごとの下書きとして自動保存し保存時刻を示し、リセットで保存済みの値へ戻し、未保存の項目数を画面下部の固定バーに出す。未入力の項目がある月は BS にデータ不足の表示を出し、純資産を出さない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 決算書画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出しと説明文・期間の範囲表示と前後移動・KPI 4 枚・3 計算書へのページ内ナビ・PL 表・詳細パネル・損益推移グラフ・月次表・読込/空/失敗を確認する。加えて 834px 幅の基準画像と同条件のスクリーンショットを overlay し、動的な金額・日付・グラフ値と仕様 §8 の意図的差分だけを除外して、説明できない配置・余白・文字階層・色の差が 0 件であることを記録する。pixel 差の数値閾値は未計測差を暗黙に許容するため設けず、許容対象を明示除外に限定する。 |
| O3 | CF が集計できないときに原因を件数つきで示す。 | core と DOM のテストで、集計不能の fixture で原因 3 種の件数と解決方法 3 手順と取引データへのリンクが出て CF の表とグラフが 0 件、集計可能な fixture では営業 CF の表とグラフが出ることが緑である。 |
| O4 | 負債残高の 3 状態入力が値を失わない。 | API と DOM のテストで、1 項目だけ保存しても他項目の保存値が残り、保存済みの値が初期表示され、『未入力』と『0円』が別々に保存・表示され、必須 3 項目の状態が未選択なら保存できず、下書きの復元・リセット・未保存件数の表示が緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Statements.tsx を、問いの見出し・期間の範囲表示と前後移動・KPI 4 枚・3 タブ・PL 表と詳細パネル・損益推移グラフ・月次表・CF セクション・BS セクション・下部の未保存バーの構成に作り直し、選択中のタブと PL の行を URL に保つ。
- **I3**: 詳細パネルの『明細を開く』から、選んだ区分の科目と期間で絞った明細仕分け画面 (Classify の ?category=&month=) へ移動できる。
- **I4**: PL のエクスポートで、表示中の段階損益 (当期・前期・差額・構成比と月次) を CSV で書き出せる。
- **I5**: core が CF の集計可否と原因 (未仕訳の件数・現金口座データの欠け・科目未設定の件数) を判定し、画面が集計不能表示と営業 CF 概算を切り替える。
- **I6**: 負債入力を基準月の月ピッカーと項目ごとの 3 択 (未入力 / 0円 / 金額を入力) に作り直し、migration 0046 で balance_entries に状態列を足し、PUT を項目単位の upsert にして保存済みの値を読み込む。
- **I7**: 入力中の負債を localStorage に利用者別のキーで下書き保存し、保存時刻・リセット・未保存件数の固定バーを出し、ログアウトで下書きを消す。

### 本章に効く確定意思決定

- **D-statements-draft-storage**: 決算書の負債入力の下書き (『下書きを自動保存しました』) をどこに保存するか
  - 採択: ブラウザ内 (localStorage に利用者別キー) (`browser-localstorage`)
  - 目的適合: G4 の『入力中の値をブラウザ内に利用者ごとの下書きとして自動保存』をそのまま満たす。既存の period.tsx と同じ方式。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の依存方向を、web が決算書の計算規則を持たない現在の構成に適用した。packages/web/src/pages/Statements.tsx は StatementsPage の 2 行の re-export だけを持ち、pages/statements/StatementsKpis.tsx・StatementsPl.tsx・StatementsCf.tsx・StatementsBs.tsx などの部品が GET /api/statements の screen を描く。657 行の単一ファイルで KPI や BS 判定を組んでいた構成は再設計前の課題であり、段階損益・前期比・構成比・CF の可否・負債の 3 状態は現在すべて core の statementsScreen が決める。web に残す判断は URL 状態、下書きと未保存件数、CSV のセル書き出しだけで、計算結果を変えない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 記録時刻: 2026-09-19T22:46:05Z)

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

### Information Design (表現物の情報設計) — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/information-design.md`

#### 目的

保持しているデータを、受け手が**その利用文脈で最短の認知コストで目的を達成できる形**へ翻訳する。「見た目を良くする」ことではなく、情報の意味的な順序付け・取捨選択・加工を設計判断として明示し、視覚表現をその写像として導出できる状態にする。

#### 解決する問題

- 保存形式 (DB の値・API のフィールド) をそのまま表示形式として採用し、受け手が頭の中で変換させられる (生年月日を見せて年齢を計算させる、絶対日時を見せて「何日前か」を計算させる)。
- 全要素が同じ大きさ・同じ濃度で並び、どこから見ればよいか分からない (強弱の欠如)。
- ラベル・罫線・説明文など「無くても伝わる要素」が削られず、本体の情報を圧迫する。
- 最初に一つの形式 (表・リスト・箇条書き・JSON ダンプ) を作ってしまい、他の形式との比較機会が失われる (早期形式固定)。
- 装飾が「今風に見せる」ために使われ、操作可能性・状態・重要度といった意味を運んでいない。
- 情報の物理的な近さがグループの意味と一致せず、無関係な要素が隣接して誤読を生む。
- 「設計」と「デザイン」を別工程・別担当に分割し、前工程の出力が後工程の到達可能な品質の上限を決めてしまう。

#### 適用条件

- 人間が読む表現物を生成・レビューするとき (UI 画面、report、slide、ダッシュボード、CLI 出力、通知、エラーメッセージ、仕様書)。
- 出せる情報量が受け手の一度に処理できる量を上回り、取捨選択が避けられないとき。
- 受け手と利用文脈が一つに定まる、または文脈ごとに別表現を作る余地があるとき。

#### 非適用条件

- 機械が消費する成果物 (JSON/DB スキーマ/ログの構造化フィールド) — ここでは網羅性・安定性・後方互換が優先し、削減や加工はむしろ有害。
- 監査・法定表示・原本性が要件で、**元の値をそのまま**提示する義務があるとき (加工は併記に留める)。
- 習熟した専任者が長時間・大量に操作する高密度業務画面。一覧性と一括操作の効率が学習容易性より重い場合、表形式・高密度・等価表示が正解になりうる (Nielsen のユーザビリティ 5 指標のうち efficiency を優先する状況)。
- 探索的な使い捨て成果物で、寿命が短く投資が回収できないとき。

#### トレードオフ・失敗モード

- **学習容易性 ⇄ 効率性**: 情報を削って強弱を付けるほど初見は分かりやすくなるが、熟練者の一覧性・一括操作は落ちる。どちらを取るかは context of use が決めるのであって、原則が決めるのではない。
- **加工 ⇄ 検証コスト**: 表示値を加工するほど元データとの突合テストが増える。加工の各件に「どの task を助けるか」を書けないなら加工しない。
- 優先順位付けを飛ばしたまま視覚変数だけ調整し、「なんとなく今風」だが読み順が崩れた表現物を作る (最頻の失敗)。
- 削減を進めすぎて、文脈を持たない受け手が識別できなくなる (会員 No. のラベルまで落とす等)。削減の停止条件は「ラベルなしで受け手が識別できるか」。
- 「シンプルにする」を目的化し、必要な状態表示・エラー理由・可逆性の手がかりまで削る。
- 原則を checklist 化して機械適用し、非適用条件 (高密度業務画面・監査表示) に当てはめて品質を落とす。
- 強弱を色だけで表現し、色覚特性・モノクロ印刷・低コントラスト環境で情報が消える。

#### goalへの寄与

- 要件定義段階で「この表現物の受け手・task・優先順位」を宣言させることで、実装後の主観的な「なんかダサい」を**設計判断への差し戻し**に変換できる (レビューが好みの表明でなくなる)。
- 順位・グループ・削除理由・加工理由が構造化データとして残るため、生成 AI・人間のどちらが作っても同じ根拠で検証できる。決定論ゲート (`../../../scripts/validate-information-priority.py`) が手順の順序制約 (装飾より前に順位が確定していること) を機械検査する。
- 成果は「見た目の評価」ではなく outcome で測る: 目的達成までの操作数・初見での到達率・誤操作率・問い合わせ件数。装飾の量では測らない。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| react-router-searchparams | 8.4.0 | React Router (Remix / Shopify) (reactrouter.com) | https://reactrouter.com/api/hooks/useSearchParams | 2026-09-19T02:03:50Z | 2026-09-19T02:03:50Z |
| web-storage-localstorage | 2026-07-28 | MDN Web Docs (Mozilla) (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage | 2026-09-19T02:03:50Z | 2026-09-19T02:03:50Z |
| tanstack-query | 5.103.1 | TanStack (tanstack.com) | https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations | 2026-09-19T11:43:20Z | 2026-09-19T11:43:20Z |
