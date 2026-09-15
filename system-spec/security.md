---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G2, G3]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-security-web-ah-observed-001。裏付け質疑 (`qa_refs`): `qa-analysis-hub-decision-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは端末に残る集計データとクリップボードへ書く共有 URL の保護を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリでは端末に残る集計データとクリップボードへ書く共有 URL の保護を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリでは端末に残る集計データとクリップボードへ書く共有 URL の保護を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリでは端末に残る集計データとクリップボードへ書く共有 URL の保護を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリでは端末に残る集計データとクリップボードへ書く共有 URL の保護を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS の入力検証とデータ保護を、?focus= の許可リスト検証、URL に財務情報を載せないこと、クリップボード書込を利用者の明示クリックに限ることに反映した。ハブ API は外部サービスへ送信せず、secureHeaders を全体に掛ける既存構成を維持する。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3

#### 主たる接地根拠: `qa-security-web-ah-observed-001`

**問**

ハブで扱う情報のセキュリティ上の前提 (公開範囲・共有 URL・ヘッダー・外部送信) は何か。

**答**

index.ts は secureHeaders と requestId を全体に掛け、/api/* は認証と runtimeSchemaGuard の後にある。ハブ API は利用者本人の集計値だけを返し、外部サービスへ送らない (画像フッター『取込データは外部送信しません』と一致)。URL コピーが書く URL は /analysis?focus=<tab id> で、金額・取引・期間などの財務情報をクエリに含めない (期間は localStorage のまま)。共有された URL を他人が開いても認証が要り、自分のデータしか見えない。focus 値は ANALYSIS_TABS の id の許可リストで検証し、不正値は既定値に落とす (任意文字列を DOM へ反映しない)。クリップボード書込は利用者の明示クリック時だけ行う。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/index.ts, design/FINAL-UI/images/03-analysis-hub.png のフッター。focus を URL に持ち期間を URL に載せない点は利用者決定 qa-analysis-hub-decision-001 と承認 appr-foundation-analysis-hub-001 に基づく。 / 回答時刻: 2026-09-14T11:38:26Z)

#### 裏付け質疑: `qa-analysis-hub-decision-001`

**問**

支出分析ハブ (03-analysis-hub.png) は既存の 5 タブとどうつなげるか。現行は /analysis を開くと照合タブへ転送される。選択肢: (A) /analysis をハブにし、各行やタブの『開く』で既存 /analysis/:tab 詳細へ進み、選択中の分析を ?focus= で URL に持ち URL コピーで共有できる (推奨) / (B) 転送を残し 5 タブすべての上部にハブ要素を常時表示する。

**答**

(A) /analysis をハブにする を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-14T11:33:07Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 選択中の分析を URL (?focus=<tab id>) で保持し、URL コピー・再読込・戻る操作でも同じ分析が選ばれた状態を再現する。既存の /analysis/:tab 詳細と旧 URL の転送は壊さない。
- **G3**: ハブに必要な集計を packages/core の純関数と、1 回で返す集約 API (GET /analysis/hub) に置く。期間の収支サマリーと前 12 か月比、5 視点それぞれの現在の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前 12 か月比・診断の改善余地) と優先度を返し、ハブ表示中に 5 タブ分の既存 API を呼ばない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | /analysis がハブを描画し、/analysis/:tab と旧 URL の転送は既存どおり動く。 | DOM テストで /analysis がハブの見出し・サマリー・ルート一覧 5 行・読み順 5 ステップ・選択中の分析パネルを描画し、/analysis/reconciliation 等の既存 5 タブと旧 URL のテストが緑のままである。 |
| O2 | ?focus=<tab id> の読み書きと URL コピーを実装する。 | DOM テストで ?focus=total-cashflow を開くと総収支行と右パネルと下部バーが選択状態になり、行を選ぶと URL が置き換わり、不正な focus 値は既定値に落ち、URL コピーが現在の URL をクリップボードへ書く。 |
| O3 | core に analysisHub(dataset) 相当の純関数を置き、API に GET /analysis/hub を足す。 | core 単体テストが期間合計・前 12 か月比 (前期間データ無しは null)・5 視点の状態・優先度・改善余地を固定データで検証し、API 統合テストが認証付きで 200 と期間メタを返し、ハブ表示中の DOM テストで既存 5 API への呼出しが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: 分析ルート一覧の行選択で ?focus= を置き換え、右パネルと下部バーの内容を切り替える。URL コピーは現在の URL をクリップボードへ書き、成否を知らせる。
- **I3**: 期間の収支サマリーに総収入・総支出・純収支と前 12 か月比 (増減率と前期間の金額) を出し、純収支の説明パネルを右に置く。前期間データが無い場合は比較を『比較データなし』と表示する。
- **I4**: core にハブ集計関数を置き、GET /analysis/hub が期間メタ・サマリー・5 視点の状態・優先度を返す。前期間の計算は core へ移し AI 側もそれを使う。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『入力を許可リストで検証し、既定値へ落とす』を ?focus= に適用した。focus の値は ANALYSIS_TABS の id 5 種の許可リストで照合し、不正値は既定の分析に落として任意文字列を DOM や aria 属性へ反映しない。『攻撃面を増やさない』は URL コピーに当てた。コピーする URL に期間・金額・取引を載せず (期間は localStorage のまま)、navigator.clipboard.writeText は利用者の明示クリック時だけ呼ぶ。NotAllowedError のときは成否を画面で知らせ、例外を握りつぶさない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T11:57:54Z)

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
| clipboard-write-text | 2025-11-30 | Mozilla (MDN Web Docs) (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText | 2026-09-14T11:44:16Z | 2026-09-14T11:44:16Z |
