---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G4]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-household-auth-web-001。裏付け質疑 (`qa_refs`): `qa-household-auth-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、認証ではモバイルアプリ向けの生体認証やトークンの端末保存をどう扱うかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、認証では家族で共有するタブレットでの利用者切替とセッションの分離を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、認証では Windows Hello や資格情報マネージャとの連携を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、認証では Secret Service などの鍵保管との連携を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、認証では Touch ID とキーチェーンとの連携を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 家計と名義ラベルの 4 経路に、既存のセッション cookie による認証をそのまま効かせる形へ反映した。未認証は authGuard が 401 を返し、一時パスワードのままの利用者は mustChangePasswordFence が止める。家計画面のための新しいログイン手段や長期トークンは設けない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 利用者単位でデータを閉じる規則を、名義ラベルの表の主キー (user_id, owner) と家計集計の入力に反映した。どちらも c.get('userId') で絞り、他の利用者の表示名や明細が混ざらないことを API 統合テストで確かめる。名義ラベルの更新は canonicalMutationFence の内側にあり、既存の更新系と同じ保護を受ける。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-household-auth-web-001`

**問**

家計収支画面と名義ラベルの API は、誰がどの条件で読み書きできるか。

**答**

既存のログイン (セッション cookie) を変えず、家計の API (GET /api/household・GET /api/household/category) と名義ラベルの API (GET / PUT /api/settings/owner-labels) を /api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の内側に置く。未認証は 401、一時パスワードのままは既存のフェンスで止める。データは利用者単位 (user_id) で閉じ、他の利用者の家計や表示名を読めない・書けない。名義ラベルの更新は利用者本人の表示設定であり、管理者専用の権限を新設しない。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-18T12:02:30Z` — answered_at に承認時刻 2026-09-18T11:25:37Z を写していた。この回答は利用者の承認と決定 001〜007 を agent が具体化した文で、実際に記録したのは R2 の chunk を適用した 2026-09-18T11:36:56Z である。
>   - 変更: `answered_at` `'2026-09-18T11:25:37Z'` → `'2026-09-18T11:36:56Z'` (フィールドは訂正後の値。旧値はこの行にのみ残る)
> - `2026-09-18T12:02:30Z` — answered_at の訂正を記録した。本文の値は利用者の決定 001〜007 と承認の範囲に収まり、agent が補った値は含まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-household-cashflow-001) と利用者決定 qa-household-decision-001〜007 を、specs/spec-household-cashflow-screen.md へ具体化した回答 / 回答時刻: 2026-09-18T11:36:56Z)

#### 裏付け質疑: `qa-household-auth-web-evidence-001`

**問**

auth 章の裏付けとして、保護された API の認可の並びについて何を観測したか。

**答**

packages/api/src/index.ts の『保護されたAPI』節 (101-114 行付近) で app.use('/api/*', authGuard()) → mustChangePasswordFence() → runtimeSchemaGuard → canonicalMutationFence() の順に登録し、その後に analyticsRoute・settingsRoute・totalCashflowRoute などを app.route('/api', ...) で載せている。家計の GET /api/household は analyticsRoute に、名義の設定 (PUT /classification の institutionOwners) は settingsRoute にあり、いずれも userId を c.get('userId') から取って利用者単位で読み書きしている。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-18T11:33:59Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 名義を『本人 / パートナー / 子ども / その他』で扱えるようにする。内部値 (business / spouse / family と未設定) は変えず、名義ラベル表を追加する追加のみの migration と、表示名の取得・更新 API を設ける。初期表示名は business→本人、spouse→パートナー、family→子ども、未設定→その他。『名義ラベルを編集』から表示名だけを変更でき、家計画面・設定画面・明細画面の名義表示がすべてこの表示名を参照する。更新 API は既存の authGuard・パスワード変更フェンス・スキーマガード・変更系フェンスの内側に置き、入力は zod で長さと文字種を検証する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 名義ラベルの編集が安全に保存され全画面に反映される。 | API 統合テストで、未認証 401・変更系フェンス違反の拒否・長さ超過と制御文字の 400・正常更新の 200 と再取得での反映を確認し、migration が既存行を 1 行も書き換えないことを検査する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I6**: owner_labels 表と GET / PUT の表示名 API、名義ラベル編集ダイアログを作り、家計・設定・明細の名義表示を表示名の取得関数 1 つへ寄せる。

### 本章に効く確定意思決定

- **dec-household-owner-model**: 名義を『本人 / パートナー / 子ども / その他』で扱うとき、内部値を移行するか、内部値を残して表示名だけを編集可能にするか。
  - 採択: 内部値は残し表示名を編集可能にする (`opt-owner-display-label`)
  - 目的適合: G4 の表示名の要件を満たし、既存の business / spouse / family / unset を使う規則・明細を壊さない。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を家計の 2 経路と名義ラベルの 2 経路の配置に適用した。GET /api/household・GET /api/household/category・GET / PUT /api/settings/owner-labels はいずれも /api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の内側に載せ、route の中で個別の認可判定を書かない。利用者の識別は c.get('userId') だけから取り、クエリや本文で user_id を受け取らない。名義ラベルの変更は利用者本人の表示設定なので、管理者専用の役割を新設しない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T11:37:52Z)

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
