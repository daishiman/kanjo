---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G4, G5]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-settings-security-web-003。裏付け質疑 (`qa_refs`): `qa-settings-security-web-evidence-001`, `qa-settings-security-web-002`, `qa-settings-security-web-004`, `qa-settings-decision-010` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、security ではスマートフォン向け専用アプリの端末に書き出した設定 JSON とバックアップの保存場所・暗号化・他アプリからの読み取り防止を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、security ではタブレット向け専用アプリの端末に書き出した設定 JSON とバックアップの保存場所・暗号化・他アプリからの読み取り防止を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、security ではWindows 向けデスクトップアプリの端末に書き出した設定 JSON とバックアップの保存場所・暗号化・他アプリからの読み取り防止を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、security ではLinux 向けデスクトップアプリの端末に書き出した設定 JSON とバックアップの保存場所・暗号化・他アプリからの読み取り防止を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、security ではmacOS 向けデスクトップアプリの端末に書き出した設定 JSON とバックアップの保存場所・暗号化・他アプリからの読み取り防止を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 設定画面では、復元 JSON の厳密な検証 (未知キー拒否・件数と長さの上限・全か無か) と本文上限 413 を入れ、CSV 出力を RFC 4180 のエスケープとセル先頭の式文字の無害化で守る形へ反映した (ASVS 5.0 V1.2.10・V2 入力検証)。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5

#### 主たる接地根拠: `qa-settings-security-web-003`

**問**

web の設定画面の security 要件のうち、利用者の決定・承認に遡れるものは何か。

**答**

web の設定画面のセキュリティ要件 (G4・G5・C4・S4 に基づく): 設定系の新 API は公開向けの入力検証で詳細を外に出さず、本文サイズ上限を掛ける (G5・C4)。設定の復元は同じ形の版番号つき JSON だけを受け、厳密に形を検証し、サイズ上限を掛け、差分プレビューと確認を経て、復元直前に現在の設定を退避する (G4)。不正な JSON は何も変えずに拒否する (S4)。バックアップからの復元も同じ検証を通し、取引は消えない (決定 010)。外部送信は 0 件 (G5)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が決めた・承認したものだけから書き起こした要件。出所は 画像 design/FINAL-UI/images/18-settings.png (利用者が正本と指示)、U1-U9 (appr-foundation-settings-001)、決定 qa-settings-decision-001〜010 と qa-settings-target-platforms-001。仕組みの選択 (パス・保存先の形・部品名・具体値) は同じ章の -002 と -004 (agent-inference) に分けた。 / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-security-web-evidence-001`

**問**

web の設定画面の security について、既存コードで何が観測できるか。

**答**

CSRF 専用ミドルウェアは無く、SameSite=Strict の Cookie (auth.ts:131)・fetch の Content-Type: application/json 固定 (api-client.ts:42-47)・secureHeaders の CSP (form-action 'self'、frame-ancestors 'none') に頼る。bodyLimit は /api/auth/*・balances・ai にだけある。publicJsonValidator (public-validation.ts) は zod の詳細を外に出さない。エラー応答は {error:{code,message}}、onError は requestId を付け明細内容をログに出さない。/restore の body は形の検査のみで上限なし。フッタに『取込データは外部送信しません』。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存コードの読解 (HEAD 0ed2d8c、Explore 調査) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-security-web-002`

**問**

web の設定画面の security で、利用者が決めていない具体値は何か。

**答**

具体値の推定: 本文上限は画面の PUT 64KB、復元 256KB、集計ルールは 500 行まで。CSV の式注入対策は既存の CSV 出力に既にあるかを実装時に確かめる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者確認も検証可能な出典も経ていない具体値。実装時に確かめる) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-security-web-004`

**問**

web の設定画面の security で、利用者が選んでいない仕組みの選択は何か。

**答**

仕組みの選択の推定 (security): 本文上限は画面の PUT 64KB、復元 256KB、集計ルールは 500 行まで。未知のキーを拒否する。値の規則は core を正本にし zod は形だけを見る。取引先名・メモは React の既定のエスケープで表示し、CSV 出力はセル先頭の = + - @ を無害化する (ASVS V1.2.10)。エラー応答とログに設定値を出さない。バックアップ・変更履歴に秘密情報を入れない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者が選んでいない仕組みの選択。実装時に確かめる) / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-decision-010`

**問**

設定画面の『バックアップ』節で、ある日のバックアップを『復元』したとき、何を戻しますか？ 【提示した選択肢 (逐語)】(1)『設定だけ戻す (Recommended)』— 集計ルール・名義・統計・現金上書きだけをその日の値へ戻し、取引は消さない。『比較』の差分と同じ範囲で、設定 JSON の復元と同じ経路 (差分プレビュー→確認→直前に現在の設定を退避) を通す。U3 G4『取引は消えない』と一致する。 (2)『全データを戻す』— 取引も含めてその日の状態へ置き換える (既存 /api/restore と同じ意味)。取引が消えうるので、G4『取引は消えない』の書き換えと強い確認が必要になる。

**答**

設定だけ戻す (推奨)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 2 件の文面を question に逐語で保存 (推奨案を選択) / 回答時刻: 2026-09-22T09:40:36Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 設定を持ち出し・戻せるようにする。設定のエクスポートは集計ルール・名義・統計・現金上書きだけを版番号つき JSON で出し、復元は同じ形だけを受ける (厳密な形の検証・サイズ上限・差分プレビューと確認・復元直前に現在の設定を自動退避)。取引は消えない。マトリクス CSV・取引 CSV・レポート HTML は選択中の期間で出す。自動バックアップは毎日 JST 2:00 に実行し、各回に 状態 (成功 / 失敗)・メモ・設定部分の要約 を持たせて失敗も一覧に出し、『比較』でその日の設定と現在の設定の差分を見てから『復元』できる。
- **G5**: 既存のデータと安全性を壊さない。migration は追加のみで既存行の書き換えは 0 件、既存の設定値は初回に同じ意味で引き継ぐ。設定系の変更 API は認証・パスワード変更強制・スキーマ確認・canonicalMutationFence の内側に置き、公開向けの入力検証 (詳細を外に出さない) と本文サイズ上限を掛ける。外部送信は 0 件で、画像に無い既存の設定機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版からの初期移行) は 1 つも消さない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 設定の書き出し・復元・バックアップが安全に往復する。 | 書き出した JSON を復元すると設定が一致し取引件数は不変、形の違う JSON・上限超過・版違いは 4xx で拒否され何も変わらない。復元前の自動退避が 1 件増える。scheduled のテストで 2:00 の実行が状態つきで保存され、失敗も一覧に出る。比較が差分を返す。 |
| O5 | 既存データと安全性の回帰が 0 件である。 | migration が追加のみで既存行の書き換え 0 件、既存の設定値が初回に引き継がれる。設定系の新 API が CANONICAL_MUTATION_ROUTES に登録され、未認証 401・本文上限超過 413・不正入力で詳細を返さない。外部送信 0 件。既存の設定機能の DOM テストが引き続き緑。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Settings.tsx を pages/settings/ 配下へ分割し、見出し・期間タブ・節ナビ・各節・説明パネル・保存バーの構成に作り直す。画像外の既存機能はアカウント / その他の管理の節へ移す。
- **I2**: core に設定画面の算出 (仮称 settingsScreen) と、集計ルールの照合・適用 (勘定科目 / 取引先)・現金上書きの解決・設定 JSON の検証と差分を新設する。
- **I3**: 集計ルールと現金上書きの列追加・変更履歴表の追加のみの migration と、GET / PUT の設定 API (baseSavedAt つき・409・変更履歴の追記) を作り、canonicalMutationFence に登録する。
- **I5**: 設定のみの JSON 書き出し・復元 API (版番号・厳密検証・サイズ上限・差分プレビュー・復元前退避) と、出力 3 種の期間連動を作る。
- **I6**: 夜間バックアップを JST 2:00 にし、R2 の customMetadata に状態・メモ・設定要約を持たせ、失敗も記録する。一覧 API に状態・メモ、比較 API に差分を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card を適用した。Secure defaults: 復元は何も変えずに拒否する側へ倒し、1 つでも不正なら全体を捨てる。Data lifecycle: 設定の書き出しは取引を含めない最小の形にし、復元直前の退避は同じ保持 30 日で消す。Assurance: 形の違う JSON・上限超過・版違いを 4xx で拒否し何も変わらないことを、悪用ケースのテストで確かめる。

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

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| owasp-asvs-encoding | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/5.0/en/0x10-V1-Encoding-and-Sanitization.md | 2026-09-22T08:43:18Z | 2026-09-22T08:43:18Z |
