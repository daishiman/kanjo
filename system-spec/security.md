---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G2, G3, G4]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-budget-security-web-001。資するゴール: G2, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、セキュリティではスマートフォンの端末紛失時に端末内の予算と下書きをどう守るかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、セキュリティではタブレットの端末紛失時に端末内の予算と下書きをどう守るかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、セキュリティではWindows のアプリ配布の署名と自動更新の改ざん対策をどう組むかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、セキュリティではLinux のパッケージ配布の署名と改ざん対策をどう組むかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、セキュリティではmacOS の公証とサンドボックスの権限をどう設計するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 予算画面では、予算の保存をフェンスへ登録して取込の洗替えと重ならない形へ反映した (ASVS V11 業務ロジック)。自動提案の算出に外部送信の経路を作らず、端末に残る下書き (計画による調整の理由を含む) は保存成功とログアウトで消す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4

#### 主たる接地根拠: `qa-budget-security-web-001`

**問**

web の予算画面のセキュリティ要件は何か。

**答**

入力はすべて zod で検証し、年額・調整額は整数で範囲を制限し、科目名と計画による調整の理由は長さを制限して React の既定のエスケープで描画する。予算の保存は canonicalMutationFence に登録し、取込の洗替えと直列化する。取込データと予算を外部へ送信せず、自動提案は外部の LLM を呼ばずに決定論で出す (qa-budget-decision-003)。下書きには調整の理由が入るため、保存成功とログアウトで消し、サーバへは保存操作でだけ送る。CSP (packages/web/public/_headers) は緩めない。1 回の保存の行数に上限を置く。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 予算画面の数値を core の純関数 1 か所 (budget-screen) から導く。前期実績は選択した実績期間の科目別合計を 12 か月あたりに換算した額、自動提案は 前期実績 × (1 + 過去 12 か月の増減率) + 季節性補正 + 計画による調整 を千円に丸めた額で、各項を根拠として返す。見通しは実績のある月は実績、無い月は自動提案の月割 (季節性を反映) とし、今後の見通しの累計・過不足カテゴリ (見通し − 来期予算) ・調整によるインパクト (来期予算 − 自動提案) を同じ関数から出す。KPI は 年間収入予算 = 収入行の来期予算の和、年間支出予算 = 支出行の来期予算の和、予算純収支 = 収入予算 − 支出予算、防衛ライン余裕 = 年間収入予算 − 防衛ライン (既存 core の defenseLine の月額) × 12 とし、一覧の合計・KPI・グラフの年合計が一致することをテストで固定する。収入の行は取込データにある『売上高』と、現行の集計に系列が無いため実績 0 の手入力行として置く『その他収入』、支出の行は事業の経費科目 (data.biz.categories) とする。外部の LLM は呼ばない。
- **G3**: 予算を予算対象の 12 か月 (開始月 YYYY-MM) ごとに科目別の年額・計画による調整額・調整の理由で保存する表を D1 に追加のみの migration で設け、同じ期間は上書きし版は持たない。保存済みの行が無い期間を開いたときは既存 budgets の月額 × 12 を初期値として示す (既存行は書き換えない)。GET /api/budget-plans?start=YYYY-MM と PUT /api/budget-plans を設け、PUT は canonicalMutationFence に登録する。診断の予算カバー率と予算の着地見込みなど既存の budgets の読み手は、今月を含む予算対象の年額 ÷ 12 を返す core の関数を経由して同じ値を読む。
- **G4**: 予算の編集作業を失わない。来期予算の入力・この値を適用・実績から提案 (全行に自動提案を入れる)・計画による調整の入力は下書きとして端末の localStorage に予算対象の期間単位で自動保存し、下書きを自動保存した時刻と最終保存時刻を示し、保存に成功したら消し、次回に復元できる。未保存の項目数を保存バーに出し、この行を元に戻す (保存済みの値へ) ・すべてリセット / リセット (全行を保存済みの値へ、確認つき) を持ち、未保存のまま離れるときは確認する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | KPI・一覧・グラフ・見通しの数値が core の 1 か所から出て互いに一致する。 | core の単体テストで、同じ Dataset・実績期間・予算対象に対し 年間収入予算 + (−年間支出予算) = 予算純収支、一覧の来期予算の和 = KPI、グラフの月次予算の年合計 = KPI、防衛ライン余裕 = 年間収入予算 − defenseLine().line × 12、自動提案 = 千円丸め(前期実績 × (1 + 増減率) + 季節性補正 + 計画による調整) の各項、過不足カテゴリの差額 = 見通し − 来期予算、調整によるインパクト = Σ(来期予算 − 自動提案) が固定される。 |
| O3 | 予算が期間ごとに保存され、既存の読み手が同じ値を読む。 | API 統合テストで、PUT が期間ごとに保存し同じ期間は上書きされ、未認証 401・フェンス違反の拒否・不正値の 400 を確かめる。migration が既存行を 1 行も書き換えないことを検査し、保存行の無い期間で既存月額 × 12 が初期値になること、診断の予算カバー率が新しい表の値から出ることを確かめる。 |
| O4 | 編集中の作業が失われない。 | DOM テストで下書きの自動保存・復元・保存成功での消去・未保存 N 項目の件数・この行を元に戻す・すべてリセットの確認・離脱確認を確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Budget.tsx を pages/budget/ 配下へ分割し、見出し・期間タブ・予算対象・KPI 4 枚・月次グラフ・今後の見通し・予算一覧・科目パネル・過不足カテゴリ・調整によるインパクト・保存バーの構成に作り直す。期間タブを 2年 にすると前期実績と自動提案が過去 2 年の実績から計算し直される。
- **I2**: core に予算画面の算出 (仮称 budgetScreen) を新設し、前期実績・自動提案と根拠の内訳 (前期実績・増減率・季節性補正・計画による調整)・見通し・KPI・過不足カテゴリ・調整によるインパクトを 1 か所で出す。人件費の行を選ぶと、右のパネルでその内訳から推奨値が組み上がる様子と過去 12 か月の月別実績が見える。
- **I3**: 予算対象の期間別の年額表を追加のみの migration で設け、GET / PUT /api/budget-plans と fence 登録を行い、診断の予算カバー率など既存の budgets の読み手を同じ読み出し関数へ寄せる。
- **I4**: 来期予算を自動提案より下げると、調整によるインパクトに年間の支出抑制額と予算純収支が即座に出る。入力の途中で別画面へ移って戻ると、下書きが復元され未保存の項目数が出る。

### 本章に効く確定意思決定

- **dec-budget-storage-unit**: 予算の保存単位をどうするか (期間を持たない科目別の月額 1 つか、予算対象の 12 か月ごとの年額か)。
  - 採択: 期間別の年額表を追加 (`opt-period-annual-table`)
  - 目的適合: 画像の予算対象 12 か月・年額入力と一致し、既存の月額を初期値に引き継げる。
- **dec-budget-income-scope**: 収入 (売上高・その他収入) も予算の対象にするか。
  - 採択: 収入も予算にする (`opt-include-income`)
  - 目的適合: 画像の売上高・その他収入の行と、年間収入予算・予算純収支・防衛ライン余裕の KPI を満たす。
- **dec-budget-suggestion-source**: 『AI・統計推奨』の値 (自動提案) をどう出すか。
  - 採択: 決定論＋計画調整の入力 (`opt-deterministic-with-plan`)
  - 目的適合: 決定論の根拠に加え、利用者が入力した計画による調整額と理由を推奨値と根拠に出せ、画像の根拠欄を満たす。
- **dec-budget-defense-margin**: KPI の『防衛ライン余裕』を何で数えるか。
  - 採択: 収入予算 − 防衛ライン × 12 (`opt-income-minus-line`)
  - 目的適合: ヘッダと同じ defenseLine を使い、年間収入予算が 1 年の防衛ラインをどれだけ上回るかを示す。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

OWASP ASVS の入力検証と業務ロジックの card を予算画面に適用した。年額・調整額・理由・開始月を zod で型と範囲を絞り、1 回の保存の行数に上限を置く。予算の保存はフェンスへ登録して取込の洗替えと重ならないようにし、自動提案は外部送信の無い決定論に限る。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:35:48Z)

### Secure by Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/secure-by-design.md`

#### 目的

利用者の注意や運用後のpatchへ安全性を押し付けず、systemのdefault、architecture、development lifecycleに安全な結果を組み込み、被害可能性と復旧費を下げる。

#### 解決する問題

- 認証・認可・data protectionが後付けで、business flowと矛盾する。
- defaultが過大権限/公開状態で、利用者の完全な設定に安全性が依存する。
- 単一防御の突破で全面侵害になり、検知・封じ込め・復旧の証拠が無い。
- dependency、secret、build、releaseの供給chain riskが製品境界外として放置される。

#### 適用条件

- identity、個人/機密data、金銭、外部入力、admin操作、multi-tenant boundaryを扱う全system。
- compromise時の影響がgoal、法規、信頼、運用継続を損なう。
- vendor/serviceを使う場合も、共有責任とfailure/exit planを明示できる。

#### 非適用条件

- security自体が不要なsystemは原則ない。asset/threatが極小ならcontrolを軽量化できるが、根拠付きrisk acceptanceが必要。
- controlがthreatを減らさず、accessibility/availability/safetyを重大に損なう場合はそのcontrolを採用しない。代替・補償統制を設計する。
- checklist準拠だけでproject固有のtrust boundaryとabuse caseを置き換えない。

#### トレードオフ・失敗モード

- friction、latency、delivery費、運用負荷が増えるため、risk reductionと明示的に釣り合わせる。
- security theaterとしてcontrol数だけ増やし、owner、evidence、responseを持たない。
- fail closedを無差別適用してavailability/safety incidentを起こす。degraded modeとbreak-glass監査が必要。
- secretを隠しても過大権限や長期credentialを残す、暗号化してもkey lifecycleを設計しない等の局所最適。
- free tier製品を価格だけで選び、audit、export、retention、MFA、incident support不足を見落とす。

#### goalへの寄与

- stakeholderの安全・信頼・継続性をsuccess criteriaへ変換し、threat/control/evidenceをgoalへトレースする。
- security controlは「導入済み」ではなく、阻止/検知/復旧時間、権限範囲、data exposureで効果を測る。
- 予算0制約でも、secure default、最小data、短命credential、標準機能、open-source検査を優先し、残余riskを隠さない。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| owasp-asvs | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/README.md | 2026-09-21T13:39:51Z | 2026-09-21T13:39:51Z |
