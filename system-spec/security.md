---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G4, G6]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-diagnosis-security-web-001。資するゴール: G4, G6 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS / Android)を提供していたなら、診断画面の本カテゴリでは端末内に残る明細と対応状況の保護、およびアプリ配布経路の改竄対策を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS / Android)を提供していたなら、診断画面の本カテゴリでは端末内に残る明細と対応状況の保護、およびアプリ配布経路の改竄対策を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末内に残る明細と対応状況の保護、およびアプリ配布経路の改竄対策を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末内に残る明細と対応状況の保護、およびアプリ配布経路の改竄対策を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末内に残る明細と対応状況の保護、およびアプリ配布経路の改竄対策を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-foundation-diagnosis-001`

2026-09-17T21:57:21Z (回答直後の date -u 実測、選択時刻の上限値) 利用者が AskUserQuestion で診断画面サイクルの foundation (U1・G1-G6・対象外・制約) を『この内容で承認』と回答した。先行する利用者決定 (同日 2026-09-17T21:51:23Z より前の同一セッション): 健全性スコア=固定費比率30%・貯蓄率30%・収支の安定性25%・データカバー率15%の重みで 0-100 へ合成する規則ベースの指標とし内訳を開閉表示する、改善アクションの対応状況=D1 の新表 (照合の reconciliation_actions と同じ型) へ保存して期間切替と再取込をまたいで引き継ぐ。指標切替 (支出/収入/純収支) と旧統計表の開閉保持も承認に含まれる。

#### この承認を名指ししている質疑: `qa-target-platforms-diagnosis-001`

**問**

診断画面 (08-diagnosis) の作り直しは、どの platform を対象にしますか。web / mobile / tablet / desktop-windows / desktop-linux / desktop-macos の6 種それぞれについて、対象に含めるか外すかを決めてください。

**答**

対象は web のみとする。mobile / tablet / desktop-windows / desktop-linux / desktop-macos の 5 種は本サイクルの対象外とする。

理由: 本プロダクト kanjo は Cloudflare Workers 上の API (packages/api) と、ブラウザへ配信する SPA (packages/web、React 18 + react-router-dom 7) の 2 つだけで構成されており、専用アプリの成果物・配布経路・ビルド設定はリポジトリに存在しない。直前の総収支画面 (PR #55)・照合画面 (PR #54)・推移画面 (PR #56) の各サイクルも同じ理由で web のみを対象としており、本サイクルで方針を変える理由がない。上位概念の対象外 (scope.out) にも『web 以外の platform』を明記して利用者承認済み (appr-foundation-diagnosis-001)。

なお web はレスポンシブで提供するため、スマートフォンのブラウザからも閲覧できる。ここで対象外にしたのは『専用アプリという成果物』であって『小さい画面』ではない。小さい画面での表示は ui-ux / frontend の web セルで扱う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (上位概念 scope.out) + リポジトリ構成の観測 (packages/ 配下は api / core / web のみ) / 回答時刻: 2026-09-17T22:01:23Z)

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 新たに受ける action_key / status / note を許可リストで検証し、長さ上限を設ける。D1 へはプレースホルダ束縛で書き、文字列連結で SQL を組み立てない。診断の根拠には取引先名と金額が含まれるため、サーバ・クライアントのログへ明細の内容を出さず、エラー応答に内部の SQL やスタックを含めない。状態変更は GET ではなく PATCH で行う。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G6

#### 主たる接地根拠: `qa-diagnosis-security-web-001`

**問**

診断画面で増える攻撃面と、その防ぎ方を決めてください。新しく受け取る入力は何で、どう検証しますか。

**答**

新しく外から受け取る入力は PATCH /diagnosis/actions/:action_key の action_key・status・note の 3 つだけであり、ここを閉じることが要点になる。

**入力検証**: action_key は検知器レジストリが生成しうる形 (登録済み検知器 id + 許可文字種・長さ上限) に一致するものだけ受ける。status は 4 語の許可集合との完全一致。note は長さ上限を設け、超過は 400 で拒む。いずれも許可リスト方式とし、拒否リストで通さない。

**保存と出力**: D1 へはプレースホルダ束縛で書き、文字列連結で SQL を組み立てない。note は保存時に加工せず、表示は React の既定のエスケープに委ねる (dangerouslySetInnerHTML を使わない)。

**CSRF**: 状態変更は GET ではなく PATCH で行い、既存のセッション Cookie の SameSite 設定に依存する。既存の他画面の状態変更操作と同じ扱いにそろえる。

**情報の露出**: 診断の根拠には取引先名や金額が含まれる。サーバログ・クライアントログへ明細の内容を出さない。エラー応答には内部の SQL やスタックを含めない。

**新しい依存**: 本サイクルで外部サービスへの送信・新規依存パッケージの追加は行わない(供給網の面を増やさない)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存実装の観測 (packages/api のルート実装とバインド方式、web のレンダリング方式) + G4/G6 / 回答時刻: 2026-09-17T22:01:23Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 改善アクションの対応状況を D1 に保存して引き継ぐ。検知器と対象から決まる安定した action_key を持つ新表を作り、利用者が選んだ状態 (未着手・対応中・対応済み・見送り) と任意のメモ・決定時刻を保存する。期間の切替・再取込・再ログインをまたいで同じ判断が復元され、対応済みと見送りは既定では一覧から畳まれて改善余地の合計にも入らない (畳んだ件数と金額は注記で示し、切替で再表示できる)。検知結果が消えた action_key の記録は消さずに残し、同じ課題が再発したときに前回の判断を示す。
- **G6**: 診断の計算規則を単純で説明可能な形で docs に明記しテストで固定する。年間改善インパクトの見積り方 (検知器ごとの根拠と年換算の仕方)、優先度の決め方 (改善インパクトと対応の手間の組合せ)、信頼度とデータカバー率の出し方、改善後の見込みの積み上げ方、完了すると変わる指標の before→after の出し方、要確認の明細を数値に含めない規則、事業/家計/総合の取引集合を総収支・推移と一致させる規則を docs/diagnosis-screen.md に書き、境界値付きの core テストと DOM テストで固定する。既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (視覚検査を含む) を緑のまま保つ。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 対応状況が期間と再取込をまたいで引き継がれる。 | 対応中に変更 → 期間切替 → 再取込 → 再取得の順で API を叩く統合テストで、同じ action_key の状態・メモ・決定時刻が保持され、対応済みと見送りが既定の一覧から畳まれ改善余地の合計から除かれ、畳んだ件数と金額が注記に現れることを確認する。 |
| O6 | 数値が他画面と一致し、規則が docs とテストで固定されている。 | 同じ期間の総収支・推移の API 返却と、診断が使う取引集合の合計が一致する core テストが通り、docs/diagnosis-screen.md に見積り・優先度・信頼度・カバー率・改善後の見込みの規則が書かれ、境界値テストが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 診断結果カードに、最も効く改善の見出し (例『固定費の見直しで年間 ¥148,000 の改善余地』)・補足・信頼度・データカバー率を出す。
- **I6**: 改善アクションの優先順位の表を、# ・優先度 (高/中/低)・課題・年間改善インパクト・対応の手間 (高/中/低)・ステータス (未着手/対応中/対応済み/見送り、要確認は判断待ちの検知)・次のアクション の列で出し、行を選ぶと詳細パネルと選択バーが連動する。
- **I7**: 改善インパクトの見込みをウォーターフォールチャートで出す。左端に改善余地の合計、中間に項目ごとの削減 (負の棒)、右端に改善後の支出見込みを置き、『年間 ¥X の改善で支出を Y% 削減できます』の注記を添える。
- **I8**: 診断根拠の表に、データソース (銀行口座・クレジットカード・電子マネー・手入力データ) ごとの対象期間・カバー率・主な内容と、全体のデータカバー率を出す。
- **I12**: 改善アクションのステータスを画面から変更でき、変更は D1 の新表へ保存される。対応済みと見送りは既定で畳まれ、注記から再表示できる。
- **I13**: 既存の科目別プロファイル表と自動診断は『統計の詳細を表示』で開閉できる根拠として下部に残し、どの基準で数えたか (MF 明細の事業側だけか) を明記する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

入力検証の『許可リストで受ける』を、本サイクルで新たに増える 3 つの入力へ具体化した。action_key は検知器レジストリが生成しうる形との一致、status は 4 語の完全一致、note は長さ上限で受ける。拒否リストは作らない。書込は D1 へのプレースホルダ束縛に限り、note は保存時に加工せず出力は React の既定エスケープへ委ねる (dangerouslySetInnerHTML を使わない)。攻撃面の増分をこの 3 入力に限定し、外部サービスへの送信と新規依存の追加を行わないことで、供給網の面も増やさない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-17T23:25:04Z)

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
| owasp-asvs | 5.0.0 | OWASP Foundation (owasp.org) | https://owasp.org/projects/asvs | 2026-09-17T22:05:46Z | 2026-09-17T22:05:46Z |
