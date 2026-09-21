---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G4, G5]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-statements-foundation-001。裏付け質疑 (`qa_refs`): `qa-statements-decision-007`, `qa-statements-auth-web-002`, `qa-statements-agent-decisions-001`, `qa-statements-reopen-pass3-001`, `qa-statements-auth-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、認証ではモバイルの生体認証と端末内のトークン保管 (Keychain / Keystore) を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、認証では共用されやすいタブレットでの自動ログアウトと再認証の間隔を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、認証では Windows 資格情報マネージャへのトークン保管と OS ログインとの連携を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、認証では Linux の Secret Service へのトークン保管を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、認証では macOS キーチェーンへのトークン保管と Touch ID 連携を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 決算書と負債保存の 2 経路に既存のセッション Cookie (HttpOnly・Secure・SameSite=Strict) による認証をそのまま効かせる形へ反映した。未認証は authGuard が 401 を返し、一時パスワードのままの利用者は mustChangePasswordFence が止める。新しい認証方式や役割は足さない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 負債保存の操作者を liability_audit_log の actor_user_id に残す形へ反映した。監査には金額を残さず項目ごとの状態遷移だけを記録し、監査表そのものが金額の複製にならないようにする。ブラウザ内の下書きは userId をキーに含めログアウト時に消す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5

#### 主たる接地根拠: `qa-statements-foundation-001`

**問**

決算書画面 (design/FINAL-UI/images/11-statements.png) を正本として画面・集計・API・保存を作り直す今サイクルの上位概念 U1-U9 (本質的目的 / 背景 / ゴール G1-G5 / 目標 O1-O5 / 成功基準 S1-S5 / 関係者 SH1-SH2 / 範囲 in 7・out 5 / 制約 C1-C5 / 具体的やりたいこと I1-I8) を、要件定義書の憲法として確定してよいか。

**答**

この内容で承認する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / U1-U9 要約を preview で提示 / 回答時刻: 2026-09-19T01:53:56Z)

#### 裏付け質疑: `qa-statements-decision-007`

**問**

負債残高の保存・削除の記録 (監査ログ) をどう残しますか？

**答**

新表・金額は残さない (推奨)。migration 0045 で liability_audit_log を追加し、誰がいつどの月のどの項目を 保存/0円/未入力 にしたかだけを記録し、金額は残さない。既存 audit_log の CHECK 変更は表の再構築 (Deploy 自動適用で止まる) が要るため避ける。(提示した他の選択肢: 新表・金額も残す / 記録しない)

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: 新表で金額を残さない決定は有効だが、実 migration は migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり (2026-09-19T02:30:05Z 提示・02:41:21Z 回答) / 回答時刻: 2026-09-19T02:41:21Z)

#### 裏付け質疑: `qa-statements-auth-web-002`

**問**

決算書の閲覧と負債の保存を、誰がどの認証で行えるか。

**答**

既存のアカウントログイン (メールアドレス+パスワード、HttpOnly・Secure・SameSite=Strict のセッション Cookie) をそのまま使い、/api/* の authGuard と一時パスワードの fence を通った利用者だけが自分の user_id の決算書を読み、負債を保存できる。新しい認証方式・権限は足さない。監査 liability_audit_log には actor_user_id を残す。下書きのキーに userId を含め、ログアウトで消すので、同じブラウザで別の利用者に前の利用者の下書きが見えない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-statements-auth-web-001 を置き換える訂正版。利用者が選んだのは appr-foundation-statements-001 (G5: 既存の認証・セッションを保つ) と qa-statements-decision-007 (保存の監査) の範囲で、それ以外の具体化 (値・部品分割・名前・判定式・テスト観点) はエージェント判断 (qa-statements-detail-parameters-001・qa-statements-agent-decisions-001 に列挙)。 / 回答時刻: 2026-09-19T11:41:33Z)

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

#### 裏付け質疑: `qa-statements-auth-web-evidence-001`

**問**

auth 章の裏付けとして、既存の認証の仕組みについて何を観測したか。

**答**

packages/api/src/index.ts は認証エンドポイントの後に app.use('/api/*', authGuard()) と mustChangePasswordFence() を掛ける (102 行付近)。packages/api/src/auth.ts はセッション Cookie を sameSite 'Strict'・httpOnly・secure で発行し (129 行)、ログアウトで maxAge 0 にする (136 行)。migrations/0039_account_login.sql が users と audit_log の actor_user_id を導入している。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T02:01:29Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 貸借対照表の負債残高を、基準月ごと・項目ごとに『未入力 / 0円 / 金額』の 3 状態で入力・保存できるようにする。借入金・未払金・クレジット未払の 3 項目は状態の選択を必須とし、その他の負債は任意項目として残す。保存済みの値を読み込んで初期表示し、保存は項目単位で上書きして他の項目を消さない。基準月は期間内の任意の月を選べる。入力中の値はブラウザ内に利用者ごとの下書きとして自動保存し保存時刻を示し、リセットで保存済みの値へ戻し、未保存の項目数を画面下部の固定バーに出す。未入力の項目がある月は BS にデータ不足の表示を出し、純資産を出さない。
- **G5**: 負債の保存経路と画面の安全性を整える。既存の認証・セッション・CSRF 相当の防御 (SameSite=Strict の Cookie と JSON の Content-Type 検証) と取込との直列化を保ったまま、金額の上限、リクエストの大きさの上限、保存操作の監査ログを加える。下書きには利用者の識別子をキーに含め、ログアウトで消す。取込データや下書きを外部へ送らない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 負債残高の 3 状態入力が値を失わない。 | API と DOM のテストで、1 項目だけ保存しても他項目の保存値が残り、保存済みの値が初期表示され、『未入力』と『0円』が別々に保存・表示され、必須 3 項目の状態が未選択なら保存できず、下書きの復元・リセット・未保存件数の表示が緑である。 |
| O5 | 負債の保存経路が入力の上限と監査を持つ。 | API テストで、上限を超える金額と大きすぎる本文が 4xx で拒否され、保存が監査ログに 1 件残り、未認証の保存が拒否されることが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

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

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を、決算書の読み取りと負債保存の 2 経路の配置に適用した。GET /api/statements と PUT /api/balances/liabilities はどちらも /api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard の内側に載せ、route の中で個別の認可判定を書かない。利用者の識別は c.get('userId') だけから取り、本文やクエリで user_id を受け取らない。ブラウザ内の下書きもキーに userId を含め、ログアウトで消すことで同じ端末の別利用者へ漏れないようにする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T02:05:18Z)

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
| set-cookie-samesite | 2026-09-01 | MDN Web Docs (Mozilla) (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie | 2026-09-19T02:03:50Z | 2026-09-19T02:03:50Z |
