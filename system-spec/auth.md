---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G3, G4]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-auth-web-rc-observed-001。裏付け質疑 (`qa_refs`): `qa-backend-web-rc-decision-007` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは照合操作 API を呼ぶ端末アプリのセッションを OS の生体認証やキーチェーンとどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリでは照合操作 API を呼ぶ端末アプリのセッションを OS の生体認証やキーチェーンとどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリでは照合操作 API を呼ぶ端末アプリのセッションを OS の生体認証やキーチェーンとどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリでは照合操作 API を呼ぶ端末アプリのセッションを OS の生体認証やキーチェーンとどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリでは照合操作 API を呼ぶ端末アプリのセッションを OS の生体認証やキーチェーンとどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS の『全ての保護資源で認証を強制する』を、照合 API と月次レビュー API を既存 /api/* の authGuard 配下へマウントする確定内容に反映した。新しい認証経路・トークンは作らず、アカウントログインのセッションと mustChangePasswordFence をそのまま通す。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS のアクセス制御 (他利用者のデータに触れない) を、照合の読み書きと取消の全てを userId で絞り、他人の操作 id を 404 にする確定内容に反映した。直前の操作の表示も本人の reconciliation_actions だけから引く。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4

#### 主たる接地根拠: `qa-auth-web-rc-observed-001`

**問**

照合 API と月次レビュー API の認証・認可はどこで行われるか。

**答**

packages/api/src/index.ts は authRoute・aiAgentRoute・improvementAgentRoute を先に、その後 /api/* に authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence を掛けてから adminUsersRoute ほか業務 route (totalCashflowRoute・analysisHubRoute 等) をマウントする。各 route は c.get('userId') で全ての読み書きを絞り、route 内に別の認可判断を持たない。照合 API と月次レビュー API も同じ位置 (authGuard の後) にマウントすれば、未認証の呼出しは route に届かず、他利用者の判断・履歴に触れない。取消 (undo) は reconciliation_actions の user_id 一致を条件にし、他人の操作 id は 404 にする。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD cc0d5e3) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/index.ts, packages/api/src/auth.ts, packages/api/src/routes/total-cashflow.ts。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-backend-web-rc-decision-007`

**問**

照合画面の API をどう切るか。選択肢: (A) 照合専用 API を新設: GET /api/reconciliation (KPI・キュー・候補一覧・下段 2 表・直前の操作を 1 回で返す) と POST /api/reconciliation/actions (照合/別取引/除外・最大 200 件・部分成功)、POST /api/reconciliation/actions/:id/undo。保存先は既存 duplicate_verdicts / freee 除外表を共用し bindDuplicateVerdicts で総収支と件数を揃える。既存 /business-spend と /total-cashflow は残す (推奨) / (B) 既存 total-cashflow API を拡張。

**答**

(A) 照合専用 API を新設 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:59:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 照合操作を保存し元に戻せるようにする。既存の duplicate_verdicts と freee 除外表を再利用し、照合画面用の API (一覧・KPI・キューを返す GET と、照合 / 別取引 / 除外 / 一括照合の POST)、verdict 取消 API、MF 側除外、照合操作の履歴表 (直前の操作と元に戻すに使う) を migration 付きで追加する。一括は最大 200 件で部分成功を返す。
- **G4**: 共通シェルを画像に揃える。サイドバーの文言 (概要/データ取込/現金入力/明細仕分け/サブスク/累計収支/支出分析/決算書/AI分析/予算/トレードオフ/設定/使い方/改善リクエスト) とグループ・件数バッジ (データ取込=要確認の取込件数・明細仕分け=未整理明細数・サブスク=判定待ち候補数・照合=要確認件数)、ページ見出し・パンくず・コマンドパレットのラベル追随、月次クローズ進捗 3/4 (データ取込/仕分け/照合は直近の締め月について自動判定、月次レビューは利用者の完了操作を月単位で D1 に保存し取消可)、ヘッダー (防衛ライン：正常 の表記・未記録 Nか月・最終更新・⌘K 検索・ダウンロード・ヘルプのアイコンボタン・アバター)、フッター (外部送信しない / 税務上の正本は freee / 毎晩バックアップ と 利用規約・プライバシー・データ出典・v1.0) と改善を送るボタン。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 照合操作 API・取消・MF 除外・操作履歴を migration 付きで追加する。 | API 統合テストが認証付きで照合 / 別取引 / 除外 / 一括 (201 件で 400、部分成功の内訳) / 取消 / 直前の操作の取得を検証し、migration が既存 D1 に冪等に適用され、元に戻すと KPI とキューが操作前の値に戻る。 |
| O4 | 共通シェルの差分を実装する。 | shell 系 DOM テストをサイドバー新文言・件数バッジ・月次クローズ 3/4 (自動 3 + レビュー手動の保存と取消)・ヘッダーのアイコンボタン・フッターリンクで更新して緑、月次レビュー API の統合テストが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: 照合画面用 API と verdict 取消・MF 除外・操作履歴を migration 付きで足し、同じ取引として照合 / 別の取引として処理 / 除外 / 一括照合 / 元に戻すを web から呼ぶ。
- **I5**: routeMetadata のラベルとグループを画像に揃え、件数バッジ・月次クローズ 3/4 (月次レビュー完了の保存と取消)・ヘッダーのアイコンボタン・フッター・改善を送るボタンを共通シェルに入れる。
- **I7**: 一致度・キュー・ステータス・月次クローズ判定の規則を docs に書き、docs/data-schema.md の古い候補条件を直し、境界値テストで固定する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を照合 API と月次レビュー API の認可に適用した。新 route は /api/* の authGuard と mustChangePasswordFence の後にマウントし、route 内の認可は c.get('userId') で読み書きを絞ることだけに限る。取消 (undo) は操作 id を受け取るため、reconciliation_actions の user_id 一致を WHERE 条件に含め、他人の操作 id は存在の有無を漏らさず 404 に倒す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T08:59:56Z)

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
