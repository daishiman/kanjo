---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G4, G5]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-statements-decision-005。裏付け質疑 (`qa_refs`): `qa-statements-decision-001`, `qa-statements-decision-004`, `qa-statements-foundation-002`, `qa-statements-backend-web-002`, `qa-statements-agent-decisions-001`, `qa-statements-reopen-pass3-001`, `qa-statements-backend-web-evidence-001`, `qa-statements-detail-parameters-001`, `qa-statements-zero-amount-legacy-001`, `qa-statements-kpi-liability-basis-001`, `qa-statements-screen-only-contract-001`, `qa-statements-monthly-pl-unit-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、バックエンドではモバイルアプリ向けのオフライン同期 API と版ごとの互換を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、バックエンドではタブレット向けに別の応答形 (画面幅別の要約) を出すかを決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、バックエンドでは Windows 版がローカルに持つ集計とサーバ集計の一致方法を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、バックエンドでは Linux 版のローカル保存とサーバの同期契約を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、バックエンドでは macOS 版のローカル保存とサーバの同期契約を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 依存方向を core ← api の一方向へ反映した。statementsScreen は Dataset・freee 取引・残高行・基準月だけを受け、D1 も Hono も知らない。GET /api/statements は表示正本を二重化せず {screen} だけを返し、旧 pl/cf/bs/period 契約は撤去する。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスを route 側に閉じる形へ反映した。前期の範囲は loadScoped の all を applyPeriod で切って作り、決算書専用の SQL を増やさない。負債の保存は送られた項目だけを (user_id, month, side, category) で upsert / 削除し、source=mf の行と送られていない項目には触れない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4, G5

#### 主たる接地根拠: `qa-statements-decision-005`

**問**

負債残高 KPI の「前期比」は何と比べ、減少を何色で示しますか？ (画像は『前期比 -¥200,000 (-8.0%)』を赤で表示)

**答**

前月末比・減少は良化色 (推奨)。比較先は前月末で、ラベルを『前月末比』に変え、減少=良化色・増加=注意色とする。画像の文言と色から意図的に外れる点は ui-decisions.md に記録する。(提示した他の選択肢: 前月末比・色は画像どおり / 画像どおり前期比)

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり (2026-09-19T02:30:05Z 提示・02:41:21Z 回答) / 回答時刻: 2026-09-19T02:41:21Z)

#### 裏付け質疑: `qa-statements-decision-001`

**問**

PL の『売上原価』と『販管費』をどう分けるか。現行 PL は 売上 / 経費グループ / 利益 だけで売上原価の区分が無い。

**答**

固定の対応表にする。core に勘定科目→区分の固定表を置き (仕入高など仕入系→売上原価、残り→販管費)、表と計算式は docs とテストで固定する。青色申告決算書の区分に合わせる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-19T01:53:56Z)

#### 裏付け質疑: `qa-statements-decision-004`

**問**

CF が集計できるときは何を表示するか (画像は集計できないときの表示だけ)。

**答**

既存の営業 CF 概算と原因別件数。集計できるときは今の営業 CF 概算 (表とグラフ) を出し、集計できないときは画像の表示に切り替え、未仕訳の件数・口座データの欠け・科目未設定を件数つきで出す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-19T01:53:56Z)

#### 裏付け質疑: `qa-statements-foundation-002`

**問**

上位概念 G1 と O1 を、3 決定 (負債=前月末比・減少は良化色 / ページ内ナビ / 現金増減は画像どおり金額のみ) に合わせて改訂した文面で承認しますか？ ほかの U1-U9 は変えない。

**答**

この文面で承認する (appr-foundation-statements-002)。G1:『KPI 4 枚 (売上高・営業利益は前期比の金額と %、現金増減は前期比の金額のみ (画像どおり)、負債残高は前月末比の金額と % で減少を良化色。各々 出典と対象期間または基準日)、3 計算書の節へ移動するページ内ナビ (画像のタブの見た目。3 節は縦にすべて描画)』。O1 測定:『KPI 4 枚 (G1 の比較先と表示規則、出典、対象期間 / 基準日)・3 計算書へのページ内ナビ (nav と aria-current)』。(提示した他の選択肢: 修正が必要)

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 改訂前後の文面を提示 (2026-09-19T02:42:17Z 提示・11:34:24Z 回答) / 回答時刻: 2026-09-19T11:34:24Z)

#### 裏付け質疑: `qa-statements-backend-web-002`

**問**

決算書の集計と負債保存のバックエンド (core の関数と API 契約) をどう定めるか。

**答**

core に statementsScreen(input) を新設し、勘定科目→区分の固定対応表 (青色申告決算書の売上原価欄に載る仕入高・期首/期末商品棚卸高を売上原価、売上系を売上高、それ以外と未知の科目を販管費) から段階損益を月別と合計で出し、恒等式 (売上総利益=売上高−売上原価、営業利益=売上総利益−販管費) を保つ。前期比は直前の同じ長さの期間 (api が applyPeriod(all, 前期範囲) で Dataset を切って渡す) との金額と % (現金増減は金額のみ、負債残高だけは前月末比) で、前期 0 / 欠損は % を null。構成比・計算式・主な内訳科目・出典・KPI 4 枚・CF の可否と原因 (未仕訳件数・現金口座の欠け {月数, 決済列なし}・科目未設定件数。どれかが立つときだけ不可、どれも立たなければ可)・BS の項目別 3 状態も同じ関数が返す。GET /api/statements は既存の pl/cf/bs/period を残し screen を足す (後方互換)。クエリに ref=YYYY-MM (基準月、期間外・不正は最終月へ丸め、丸めた月を bs.referenceMonth で返す)。PUT /api/balances/liabilities は {month, lines:[{category, status: unset|zero|amount, amount?}]} の zod strict で、送られた項目だけを upsert / 削除し他項目と source=mf 行に触らない。応答は保存後の bs。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED: 『旧 pl/cf/bs/period を残し screen を足す』という後方互換方針は qa-statements-screen-only-contract-001 により非規範化された。現行 GET /api/statements の契約は {screen} だけで、旧キーは返さない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-statements-backend-web-001 を置き換える訂正版。利用者が選んだのは qa-statements-decision-001 (区分=固定対応表)・004 (CF=営業 CF 概算+原因別件数)・005 (負債 KPI=前月末比) と appr-foundation-statements-001/002 の範囲で、それ以外の具体化 (値・部品分割・名前・判定式・テスト観点) はエージェント判断 (qa-statements-detail-parameters-001・qa-statements-agent-decisions-001 に列挙)。 / 回答時刻: 2026-09-19T11:41:33Z)

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

#### 裏付け質疑: `qa-statements-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行の決算書 API と負債保存について何を観測したか。

**答**

packages/api/src/routes/analytics.ts:627-650 の GET /api/statements は loadScoped (data と all と period を返す) の data から profitAndLoss・cashFlow・buildBalanceSheet を返す。packages/api/src/routes/balances.ts の PUT /api/balances/liabilities は zod strict・最大 4 行で、その月の manual 負債を全削除してから挿入するため、1 種類だけ送ると他の種類が消える。core の statements.ts は profitAndLoss (77 行)・cashFlow (157 行、決済列が無いと settlementUnknown) を持ち、tax-accounts.ts の 6 グループに売上原価は無い。balances.ts の LIABILITY_CATEGORIES はクレジットカード未払金・借入金・未払金・買掛金・その他の負債。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED OBSERVATION: これは refactor 前の実装観測であり、現行契約ではない。現行 GET /api/statements は statementsScreen の {screen} だけを返し、旧 pl/cf/bs/period は返さない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T02:01:29Z)

#### 裏付け質疑: `qa-statements-detail-parameters-001`

**問**

ui-ux・frontend・backend・security の web-001 回答に含まれる具体値のうち、どれが利用者の決定で、どれがエージェントの具体化か。

**答**

利用者が決めたのは 4 決定 (qa-statements-decision-001〜004) と U1-U9 の承認 (appr-foundation-statements-001) まで。次の値はエージェントが既存コードと公式資料から具体化した既定値で、利用者は個別に選んでいない: 金額上限 1 兆円 (表示と集計の桁あふれ防止)、本文上限 8 KiB (4 項目の本文は 1 KiB 未満。既存の /api/auth/* は 16 KiB)、下書き保存の遅延 800ms、詳細パネルの主な内訳 3 科目、月次表の万円丸め (合計列は円で合算してから丸める)、URL パラメータ名 (tab・row・ref)、下書きのキー名、区分対応表に載せる科目の列挙 (仕入高・期首商品棚卸高・期末商品棚卸高)。いずれも上位概念 G1-G5 と 4 決定に反しない調整値で、実装中に変えるときは specs/spec-statements-screen.md とテストを同時に変える。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: エージェントによる具体化の区分表示 (利用者への個別確認なし) / 回答時刻: 2026-09-19T02:18:27Z)

#### 裏付け質疑: `qa-statements-zero-amount-legacy-001`

**問**

migration 0045 の適用前に金額 0 で保存された既存の手入力負債行 (status 列の既定値で 'amount' になる) を、画面と集計でどう扱うか。

**答**

(status='amount', amount=0) の組を『0円』(zero) と同じ扱いで表示・完了判定する。現行 UI で 0 を入れて保存した行は利用者が値を入れた項目であり、未入力ではないため。行は書き換えない (C4。UPDATE を含む migration は Deploy の自動適用判定で止まる)。次にその項目が保存されたとき status='zero' で上書きされる。core の契約テストでこの扱いを固定する (specs/spec-statements-screen.md §3.4・§7)。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: 『状態列の適用前に amount=0 で保存された行』の互換処理は有効だが、状態列を追加する実 migration は migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: エージェントによる既存データの扱いの決定 (C4 と G4 から導出。利用者への個別確認なし) / 回答時刻: 2026-09-19T02:18:27Z)

#### 裏付け質疑: `qa-statements-kpi-liability-basis-001`

**問**

KPI 4 枚のうち負債残高だけ前期比を前月末比にするのはなぜか。

**答**

負債残高は期間の流量ではなく基準日時点の残高 (ストック) だから。売上高・営業利益・現金増減は期間の合計なので直前の同じ長さの期間と比べるが、残高を 12 か月前の残高と比べても今月の入力漏れや急増に気づけない。前月末に必須項目の未入力があるとき、または前月末の行が 1 件も無いときは前期比を — とする (specs/spec-statements-screen.md §1.3)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: エージェントによる比較基準の決定 (G1 と画像の『基準日：2026年8月末』から導出。利用者への個別確認なし) / 回答時刻: 2026-09-19T02:18:27Z)

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

- **G2**: 決算書の数値を core の純関数 1 か所で算出し、GET /api/statements がその screen だけを返す。勘定科目→区分 (売上高 / 売上原価 / 販管費) の固定対応表 (青色申告決算書の区分に合わせ、仕入高など仕入系の科目だけを売上原価、ほかの経費を販管費とする) から段階損益 (売上高・売上原価・売上総利益・販管費・営業利益) を月別と期間合計で出し、直前の同じ長さの期間との前期比 (金額と %)・構成比・各行の計算式と主な内訳科目を出す。KPI の現金増減と負債残高、各数値の出典と対象期間 / 基準日も同じ関数から出す。対応表と計算式は docs とテストで固定する。
- **G3**: キャッシュフロー計算書が集計できないときは、画像の表示 (『キャッシュフロー計算書は、現在集計できていません』・主な原因・解決方法の 3 手順・取引データを確認) に切り替え、表とグラフを出さない。原因は core が判定し、未仕訳の取引件数・現金口座データの欠け・勘定科目が未設定の取引件数を件数つきで示す。集計できるときは既存の営業 CF 概算 (表とグラフ) を出す。
- **G4**: 貸借対照表の負債残高を、基準月ごと・項目ごとに『未入力 / 0円 / 金額』の 3 状態で入力・保存できるようにする。借入金・未払金・クレジット未払の 3 項目は状態の選択を必須とし、その他の負債は任意項目として残す。保存済みの値を読み込んで初期表示し、保存は項目単位で上書きして他の項目を消さない。基準月は期間内の任意の月を選べる。入力中の値はブラウザ内に利用者ごとの下書きとして自動保存し保存時刻を示し、リセットで保存済みの値へ戻し、未保存の項目数を画面下部の固定バーに出す。未入力の項目がある月は BS にデータ不足の表示を出し、純資産を出さない。
- **G5**: 負債の保存経路と画面の安全性を整える。既存の認証・セッション・CSRF 相当の防御 (SameSite=Strict の Cookie と JSON の Content-Type 検証) と取込との直列化を保ったまま、金額の上限、リクエストの大きさの上限、保存操作の監査ログを加える。下書きには利用者の識別子をキーに含め、ログアウトで消す。取込データや下書きを外部へ送らない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 段階損益と前期比を core が決定論的に算出する。 | core の契約テストで、売上高−売上原価=売上総利益、売上総利益−販管費=営業利益が月別と合計で一致し、前期比は直前の同じ長さの期間から算出され、前期が 0 のとき % は null になり、未知の科目は販管費に入ることが緑である。 |
| O3 | CF が集計できないときに原因を件数つきで示す。 | core と DOM のテストで、集計不能の fixture で原因 3 種の件数と解決方法 3 手順と取引データへのリンクが出て CF の表とグラフが 0 件、集計可能な fixture では営業 CF の表とグラフが出ることが緑である。 |
| O4 | 負債残高の 3 状態入力が値を失わない。 | API と DOM のテストで、1 項目だけ保存しても他項目の保存値が残り、保存済みの値が初期表示され、『未入力』と『0円』が別々に保存・表示され、必須 3 項目の状態が未選択なら保存できず、下書きの復元・リセット・未保存件数の表示が緑である。 |
| O5 | 負債の保存経路が入力の上限と監査を持つ。 | API テストで、上限を超える金額と大きすぎる本文が 4xx で拒否され、保存が監査ログに 1 件残り、未認証の保存が拒否されることが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に勘定科目→区分の固定対応表と段階損益・前期比・構成比・計算式・主な内訳科目・出典を返す純関数を置き、GET /api/statements がそれを返す。
- **I3**: 詳細パネルの『明細を開く』から、選んだ区分の科目と期間で絞った明細仕分け画面 (Classify の ?category=&month=) へ移動できる。
- **I4**: PL のエクスポートで、表示中の段階損益 (当期・前期・差額・構成比と月次) を CSV で書き出せる。
- **I5**: core が CF の集計可否と原因 (未仕訳の件数・現金口座データの欠け・科目未設定の件数) を判定し、画面が集計不能表示と営業 CF 概算を切り替える。
- **I6**: 負債入力を基準月の月ピッカーと項目ごとの 3 択 (未入力 / 0円 / 金額を入力) に作り直し、migration 0046 で balance_entries に状態列を足し、PUT を項目単位の upsert にして保存済みの値を読み込む。
- **I7**: 入力中の負債を localStorage に利用者別のキーで下書き保存し、保存時刻・リセット・未保存件数の固定バーを出し、ログアウトで下書きを消す。
- **I8**: PUT /api/balances/liabilities に金額の上限と本文の大きさの上限を課し、保存を監査ログへ記録する。

### 本章に効く確定意思決定

- **D-statements-draft-storage**: 決算書の負債入力の下書き (『下書きを自動保存しました』) をどこに保存するか
  - 採択: ブラウザ内 (localStorage に利用者別キー) (`browser-localstorage`)
  - 目的適合: G4 の『入力中の値をブラウザ内に利用者ごとの下書きとして自動保存』をそのまま満たす。既存の period.tsx と同じ方式。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を決算書集計の置き場所に適用した。勘定科目→区分の固定対応表、段階損益、前期比、構成比、計算式、主な内訳科目、CF の可否と原因件数、負債の 3 状態は、いずれも入出力を持たない計算なので core の statementsScreen 1 か所に置く。前期の Dataset は api が loadScoped の all から applyPeriod で切って渡し、純関数に期間の解釈を配らない。api の GET /api/statements と PUT /api/balances/liabilities は zod で受けた値を純関数や D1 に渡して JSON に写すだけにする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T02:05:18Z)

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
| hono-body-limit | 4.13.8 | Hono (hono.dev) | https://hono.dev/docs/middleware/builtin/body-limit | 2026-09-19T11:43:20Z | 2026-09-19T11:43:20Z |
