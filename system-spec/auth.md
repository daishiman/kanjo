---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G3, G5]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-settings-auth-web-003。裏付け質疑 (`qa_refs`): `qa-settings-auth-web-evidence-001`, `qa-settings-auth-web-002`, `qa-settings-auth-web-004` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、auth ではスマートフォン向け専用アプリの端末でのセッション保持と、設定の復元操作に対する再認証の方式を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、auth ではタブレット向け専用アプリの端末でのセッション保持と、設定の復元操作に対する再認証の方式を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、auth ではWindows 向けデスクトップアプリの端末でのセッション保持と、設定の復元操作に対する再認証の方式を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、auth ではLinux 向けデスクトップアプリの端末でのセッション保持と、設定の復元操作に対する再認証の方式を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、auth ではmacOS 向けデスクトップアプリの端末でのセッション保持と、設定の復元操作に対する再認証の方式を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 設定画面の認証では、新しい設定 API をすべて既存のセッション検証とパスワード変更強制の内側に置き、未認証は 401 にする形へ反映した。変更履歴の更新者はセッションの actor から決め、要求本文の値を使わない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 設定画面の認可では、設定の保存と復元を書込みフェンスへ登録して取込の洗替えと重ならないようにし、復元の権限は既存の /restore と同じに留める形へ反映した (ASVS V8 認可)。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G5

#### 主たる接地根拠: `qa-settings-auth-web-003`

**問**

web の設定画面の auth 要件のうち、利用者の決定・承認に遡れるものは何か。

**答**

web の設定画面の認証・認可要件 (G5・C4・O5 に基づく): 設定系の新 API はすべて既存の認証・パスワード変更強制・スキーマ確認・canonicalMutationFence の内側に置き、未認証は 401 にする (G5・O5)。書込み API (全節の保存・設定の復元・バックアップからの設定の復元) はすべて CANONICAL_MUTATION_ROUTES に登録する。読むだけの API (画面の取得・元に戻す用の直前値・書き出し・差分プレビュー・比較・一覧) は登録しない (C4・O5)。画像外の既存機能 (パスワード変更・利用者管理) の権限は変えない (G5)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が決めた・承認したものだけから書き起こした要件。出所は 画像 design/FINAL-UI/images/18-settings.png (利用者が正本と指示)、U1-U9 (appr-foundation-settings-001)、決定 qa-settings-decision-001〜010 と qa-settings-target-platforms-001。仕組みの選択 (パス・保存先の形・部品名・具体値) は同じ章の -002 と -004 (agent-inference) に分けた。 / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-auth-web-evidence-001`

**問**

web の設定画面の auth について、既存コードで何が観測できるか。

**答**

ミドルウェア順は authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence (index.ts:105-109)。authGuard (auth.ts:245) は Access JWT かセッション Cookie を検証し userId=TENANT_ID('default') と actor を set する。adminGuard (auth.ts:319-) がある。/api/settings は CANONICAL_MUTATION_ROUTES (canonical-mutation-fence.ts:159-163) に登録済み。POST /restore は admin 限定ではない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存コードの読解 (HEAD 0ed2d8c、Explore 調査) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-auth-web-002`

**問**

web の設定画面の auth で、利用者が決めていない具体値は何か。

**答**

具体値の推定: 更新者の表示名は actor のメールアドレスのローカル部。restore 系は import writer lease と同じ直列化を取る。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者確認も検証可能な出典も経ていない具体値。実装時に確かめる) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-auth-web-004`

**問**

web の設定画面の auth で、利用者が選んでいない仕組みの選択は何か。

**答**

仕組みの選択の推定 (auth): 変更履歴の更新者は authGuard が set する actor から取り、要求本文の値を使わない。表示名は actor のメールアドレスのローカル部。設定の復元とバックアップからの復元の権限は既存 /restore と同じに留める。復元系は取込の洗替えと重ならないよう既存の直列化に揃える。差分プレビューは POST だが読むだけなのでフェンス対象から外す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者が選んでいない仕組みの選択。実装時に確かめる) / 回答時刻: 2026-09-22T09:45:25Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 設定を安全に保存する。全節の編集を 1 つの下書きに集め、未保存の件数を数え、localStorage へ自動保存・復元し、リセットと離脱の前に確認する。保存は baseSavedAt つきの 1 回の PUT で、他所の更新と競合したら 409 で上書きを防ぐ。設定の変更は追記のみの変更履歴表に 変更前・変更後・更新者・日時 を残し、右パネルの最終更新・更新者と『このルールを元に戻す』(直前の保存値を下書きへ戻す) はそこから導く。復元や移行で入った値の更新者は『システム』とする。
- **G5**: 既存のデータと安全性を壊さない。migration は追加のみで既存行の書き換えは 0 件、既存の設定値は初回に同じ意味で引き継ぐ。設定系の変更 API は認証・パスワード変更強制・スキーマ確認・canonicalMutationFence の内側に置き、公開向けの入力検証 (詳細を外に出さない) と本文サイズ上限を掛ける。外部送信は 0 件で、画像に無い既存の設定機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版からの初期移行) は 1 つも消さない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 保存が 1 回にまとまり、競合と取り消しが安全に扱える。 | API 結合テストで、古い baseSavedAt の PUT が 409 を返して行が変わらず、保存ごとに変更履歴が追記され (更新・削除は 0 件)、『元に戻す』が直前の保存値を返す。DOM テストで未保存件数・下書きの復元・リセットと離脱の確認が動く。 |
| O5 | 既存データと安全性の回帰が 0 件である。 | migration が追加のみで既存行の書き換え 0 件、既存の設定値が初回に引き継がれる。設定系の新 API が CANONICAL_MUTATION_ROUTES に登録され、未認証 401・本文上限超過 413・不正入力で詳細を返さない。外部送信 0 件。既存の設定機能の DOM テストが引き続き緑。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Settings.tsx を pages/settings/ 配下へ分割し、見出し・期間タブ・節ナビ・各節・説明パネル・保存バーの構成に作り直す。画像外の既存機能はアカウント / その他の管理の節へ移す。
- **I3**: 集計ルールと現金上書きの列追加・変更履歴表の追加のみの migration と、GET / PUT の設定 API (baseSavedAt つき・409・変更履歴の追記) を作り、canonicalMutationFence に登録する。
- **I4**: 下書きの localStorage 自動保存・復元・未保存件数・リセットと離脱の確認を予算画面の先例 (draft.ts・BudgetSaveBar) にならって作る。
- **I5**: 設定のみの JSON 書き出し・復元 API (版番号・厳密検証・サイズ上限・差分プレビュー・復元前退避) と、出力 3 種の期間連動を作る。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card を適用した。Least privilege / deny by default: 新しい書込み API はすべて明示登録し、登録漏れが素通りにならないよう『書込みは登録・読むだけは除外』の規則で分けた。Threat modeling: 資産は設定と取引、境界は認証の内側、悪用は他者の更新を上書きすることで、baseSavedAt の 409 がこれを防ぐ。Defense in depth: 認証・パスワード変更強制・スキーマ確認・書込みフェンスの 4 層の内側に置き、1 層の漏れを全体の漏れにしない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-22T09:45:25Z)

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

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
