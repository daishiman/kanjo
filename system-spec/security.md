---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G5]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-statements-decision-007。裏付け質疑 (`qa_refs`): `qa-statements-decision-003`, `qa-statements-security-web-002`, `qa-statements-agent-decisions-001`, `qa-statements-reopen-pass3-001`, `qa-statements-security-web-evidence-001`, `qa-statements-detail-parameters-001`, `qa-statements-csv-chars-001`, `qa-statements-migration-0046-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、セキュリティでは端末の紛失時に端末内の決算データを消す手段とジェイルブレイク検知を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、セキュリティでは共用タブレットの画面ロックと端末内キャッシュの消去を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、セキュリティでは Windows 版のコード署名と更新配信の改ざん防止を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、セキュリティでは Linux 版パッケージの署名と配布元の検証を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、セキュリティでは macOS の公証とサンドボックス権限を決める必要があった。対象を web のみとする利用者決定 (qa-statements-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS 5.0 の入力検証と 1.2.10 (CSV / 数式注入) を負債保存と PL エクスポートへ反映した。負債は zod strict の列挙・整数・上限・8 KiB の本文上限で受けて 400 / 413 を返し、CSV は RFC 4180 のエスケープに加えて先頭の = + - @ タブ NUL に単一引用符を前置する。取込データと下書きは外部へ送らない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G5

#### 主たる接地根拠: `qa-statements-decision-007`

**問**

負債残高の保存・削除の記録 (監査ログ) をどう残しますか？

**答**

新表・金額は残さない (推奨)。migration 0045 で liability_audit_log を追加し、誰がいつどの月のどの項目を 保存/0円/未入力 にしたかだけを記録し、金額は残さない。既存 audit_log の CHECK 変更は表の再構築 (Deploy 自動適用で止まる) が要るため避ける。(提示した他の選択肢: 新表・金額も残す / 記録しない)

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-19T22:35:37Z` — SUPERSEDED NUMBER ONLY: 新表で金額を残さない決定は有効だが、実 migration は migrations/0046_liability_status.sql。qa-statements-migration-0046-001 が現行番号の規範である。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり (2026-09-19T02:30:05Z 提示・02:41:21Z 回答) / 回答時刻: 2026-09-19T02:41:21Z)

#### 裏付け質疑: `qa-statements-decision-003`

**問**

『下書きを自動保存しました』の下書きをどこに保存するか。

**答**

ブラウザ内。localStorage に利用者ごとのキーで保存し、サーバへ送るのは『負債残高を保存』のときだけ。既存の Cash / Budget 画面と同じ方式で migration は不要。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-19T01:53:56Z)

#### 裏付け質疑: `qa-statements-security-web-002`

**問**

負債の保存経路と決算書画面の安全性要件は何か。

**答**

既存の防御 (authGuard、SameSite=Strict の Cookie、JSON の Content-Type 検証、取込との直列化 canonical-mutation-fence) を保ったまま、(1) 金額は整数・0 以上・1 兆円以下を zod で検証、(2) PUT /api/balances/liabilities に bodyLimit 8 KiB (超過は 413)、(3) 保存ごとに liability_audit_log へ 1 件 (金額は残さない)、(4) 下書きは利用者別キーでブラウザ内に留めログアウトで消す、(5) CSV エクスポートは = + - @・タブ・NUL で始まる文字列セルに ' を付けて数式注入を防ぐ、(6) 取込データ・下書きを外部へ送らない。未認証の保存は 401、不正な本文は 400。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-statements-security-web-001 を置き換える訂正版。利用者が選んだのは qa-statements-decision-007 (監査は新表・金額は残さない)・003 (下書きはブラウザ内) と appr-foundation-statements-001 (G5) の範囲で、それ以外の具体化 (値・部品分割・名前・判定式・テスト観点) はエージェント判断 (qa-statements-detail-parameters-001・qa-statements-agent-decisions-001 に列挙)。 / 回答時刻: 2026-09-19T11:41:33Z)

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

#### 裏付け質疑: `qa-statements-security-web-evidence-001`

**問**

security 章の裏付けとして、既存の入力上限と直列化について何を観測したか。

**答**

packages/api/src/index.ts の bodyLimit は /api/auth/* だけに 16 KiB で掛かり (85-92 行)、保護された API には掛かっていない。balances.ts の amount は z.number().int().nonnegative() で上限が無い。取込との直列化は packages/api/src/canonical-mutation-fence.ts (45 行) にある。監査ログの書込みは packages/api/src/audit-log.ts の buildAuditStatements (248 行)。

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

#### 裏付け質疑: `qa-statements-migration-0046-001`

**問**

負債 3 状態の migration 番号は、実際のワークツリーで何番になったか。

**答**

0045_owner_labels.sql が先に存在するため、仕様の衝突時繰り下げ規則を適用し、実体は migrations/0046_liability_status.sql になった。現行の仕様・運用・schema guard・テスト参照は 0046 を使う。0045 という記述は生成済み計画の履歴を除き、現行契約として扱わない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: migrations/0045_owner_labels.sql と migrations/0046_liability_status.sql のワークツリー観測 / 回答時刻: 2026-09-19T21:52:53Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G5**: 負債の保存経路と画面の安全性を整える。既存の認証・セッション・CSRF 相当の防御 (SameSite=Strict の Cookie と JSON の Content-Type 検証) と取込との直列化を保ったまま、金額の上限、リクエストの大きさの上限、保存操作の監査ログを加える。下書きには利用者の識別子をキーに含め、ログアウトで消す。取込データや下書きを外部へ送らない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O5 | 負債の保存経路が入力の上限と監査を持つ。 | API テストで、上限を超える金額と大きすぎる本文が 4xx で拒否され、保存が監査ログに 1 件残り、未認証の保存が拒否されることが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I7**: 入力中の負債を localStorage に利用者別のキーで下書き保存し、保存時刻・リセット・未保存件数の固定バーを出し、ログアウトで下書きを消す。
- **I8**: PUT /api/balances/liabilities に金額の上限と本文の大きさの上限を課し、保存を監査ログへ記録する。

### 本章に効く確定意思決定

- **D-statements-draft-storage**: 決算書の負債入力の下書き (『下書きを自動保存しました』) をどこに保存するか
  - 採択: ブラウザ内 (localStorage に利用者別キー) (`browser-localstorage`)
  - 目的適合: G4 の『入力中の値をブラウザ内に利用者ごとの下書きとして自動保存』をそのまま満たす。既存の period.tsx と同じ方式。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『入力を許可リストで検証する』を、本サイクルで増える入力 (負債の状態と金額、基準月、CSV に書き出す科目名) に適用した。状態は unset / zero / amount の列挙、金額は整数・0 以上・1 兆円以下、項目は LIABILITY_CATEGORIES の列挙で zod strict に受け、本文は 8 KiB で打ち切る。出力側では、利用者データ由来の科目名を CSV に書くとき先頭の = + - @ タブ NUL に単一引用符を前置して数式として評価されないようにする。

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
| owasp-asvs-csv-injection | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x10-V1-Encoding-and-Sanitization.md | 2026-09-19T11:43:20Z | 2026-09-19T11:43:20Z |
