---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G3]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-security-web-rc-observed-001。裏付け質疑 (`qa_refs`): `qa-security-web-rc-decision-009`, `qa-frontend-web-rc-inference-002` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは端末に残る照合候補の取引内容・金額と、一括照合や元に戻すの操作履歴をどう保護するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリでは端末に残る照合候補の取引内容・金額と、一括照合や元に戻すの操作履歴をどう保護するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリでは端末に残る照合候補の取引内容・金額と、一括照合や元に戻すの操作履歴をどう保護するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリでは端末に残る照合候補の取引内容・金額と、一括照合や元に戻すの操作履歴をどう保護するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリでは端末に残る照合候補の取引内容・金額と、一括照合や元に戻すの操作履歴をどう保護するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS の入力検証と業務ロジックの整合を、照合 actions の列挙値・件数 1〜200・id 形式の検証、書込系 API の canonicalMutationFence による取込との排他、取消済み操作の再取消拒否に反映した。照合 API は外部サービスへ送信せず、secureHeaders を全体に掛ける既存構成を維持する。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3

#### 主たる接地根拠: `qa-security-web-rc-observed-001`

**問**

照合で扱う情報のセキュリティ上の前提 (入力検証・書込の排他・外部送信・表示) は何か。

**答**

index.ts は secureHeaders と requestId を全体に掛ける。書込系 route は zValidator で入力を検証する (総収支 verdicts は最大 200 件)。canonical-mutation-fence.ts の CANONICAL_MUTATION_ROUTES は取込 (POST /api/imports・/api/restore) と重なる書込を acquireImportWriter で排他し 409 canonical_write_busy を返すが、POST /api/total-cashflow/verdicts と freee-exclusions は対象外である。照合は利用者本人の取引内容・金額を扱い外部サービスへ送らない (画像フッター『取込データは外部送信しません』)。検索語は web の状態に留め URL・サーバーへ送らない。取引内容 (支払先名・メモ) は React のテキストとして描画し innerHTML を使わない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD cc0d5e3) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/index.ts, packages/api/src/canonical-mutation-fence.ts, packages/api/src/routes/total-cashflow.ts, design/FINAL-UI/images/04-reconciliation.png のフッター。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-security-web-rc-decision-009`

**問**

照合の書込 (判断・除外・取消・月次レビュー完了) を取込中の書込と重ならないようにするか (現行の総収支 verdicts API は canonicalMutationFence の対象外)。選択肢: (A) fence 対象に追加: 照合の書込系 API を CANONICAL_MUTATION_ROUTES に足し、取込と重なると 409 canonical_write_busy を返す。画面は『取込中のため保存できませんでした』と出し再試行できる。既存の総収支 verdicts API も同じ扱いに揃える (推奨) / (B) 現行どおり排他しない。

**答**

(A) fence 対象に追加 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-frontend-web-rc-inference-002`

**問**

照合画面の絞り込み・検索・ページ送り・選択状態をどこで持つか。

**答**

GET /api/reconciliation は期間内の候補全件 (KPI・キュー件数も同じ応答) を返し、データソース・ステータス・対象年月・キュー選択・検索語・ページ (10/20/50 件) は web のコンポーネント状態で絞る。検索語と絞り込みは URL にもサーバーにも送らない (期間は既存どおり localStorage 共有、タブは URL)。選択中の行 id は候補の key (MF tx id) で持ち、絞り込みを変えても見えない選択は選択中バーの件数に含めて『選択をクリア』で外せる。書込後は ['reconciliation', period]・analysisHubQueryKey・['total-cashflow', period]・['summary', period] を invalidate し、ハブ・サイドバーのバッジ・総収支を追随させる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントが 2026-09-15 に観測事実と利用者決定から導いた推定。単独では確定の根拠にせず、観測事実 (主根拠) の補足として qa_refs に載せる。answered_at は記録直前に date -u で実測した時刻。 前提: qa-backend-web-rc-decision-007 (1 回で返す GET)、docs/ui-decisions.md のタブ URL と期間 localStorage の既存判断、Layout.tsx の analysisHubQueryKey 共有。 / 回答時刻: 2026-09-15T08:59:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 照合操作を保存し元に戻せるようにする。既存の duplicate_verdicts と freee 除外表を再利用し、照合画面用の API (一覧・KPI・キューを返す GET と、照合 / 別取引 / 除外 / 一括照合の POST)、verdict 取消 API、MF 側除外、照合操作の履歴表 (直前の操作と元に戻すに使う) を migration 付きで追加する。一括は最大 200 件で部分成功を返す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 照合操作 API・取消・MF 除外・操作履歴を migration 付きで追加する。 | API 統合テストが認証付きで照合 / 別取引 / 除外 / 一括 (201 件で 400、部分成功の内訳) / 取消 / 直前の操作の取得を検証し、migration が既存 D1 に冪等に適用され、元に戻すと KPI とキューが操作前の値に戻る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: 照合画面用 API と verdict 取消・MF 除外・操作履歴を migration 付きで足し、同じ取引として照合 / 別の取引として処理 / 除外 / 一括照合 / 元に戻すを web から呼ぶ。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『入力を許可リストで検証する』を照合の書込に適用した。POST /api/reconciliation/actions は zValidator で action を same/different/exclude-mf/exclude-freee の列挙に限り、件数 1〜200・tx id と freee key の形を検証する。『書込の競合を安全側に倒す』は書込系 API を canonicalMutationFence の対象に加える利用者決定 (qa-security-web-rc-decision-009) に当て、取込と重なった書込は 409 で拒否して判断が消えかけの明細に結ばれる事態を防ぐ。検索語を URL やサーバーへ送らないことで、取引内容がアクセスログや共有 URL に残る経路を作らない。

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

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| owasp-authorization-cheatsheet | 2026-08-31 | OWASP Foundation (Cheat Sheet Series) (cheatsheetseries.owasp.org) | https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html | 2026-09-15T09:06:39Z | 2026-09-15T09:06:39Z |
