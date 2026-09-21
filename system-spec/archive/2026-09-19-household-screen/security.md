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
| Web (web) | 確定 | 確定質疑: qa-household-security-web-004。裏付け質疑 (`qa_refs`): `qa-household-security-web-evidence-001`, `qa-household-security-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、セキュリティではモバイル端末の紛失時に家計データを消す手段と、画面の録画・スクリーンショット対策を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、セキュリティでは共有端末に家計の明細が残らないようにするキャッシュ方針を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、セキュリティではインストーラの署名と自動更新の改ざん対策を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、セキュリティでは配布パッケージの署名検証とサンドボックス権限を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、セキュリティでは公証 (notarization) とサンドボックスの権限範囲を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 入力検証・出力の無害化・外部送信なしの 3 点を、家計収支画面で増える入出力に反映した。入力は名義ラベルの表示名と家計 API のクエリだけで、どちらも zod の許可リストで受ける。出力の表示名と取引先名は React のエスケープで描く。明細や表示名を外部サービスへ送らず、公開文書への実データ混入は既存の security:content で検査する。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5

#### 主たる接地根拠: `qa-household-security-web-004`

**問**

家計収支画面で新しく生じる入力・出力・外部送信のリスクにどう備えるか。

**答**

新しい入力は名義ラベルの表示名だけで、zod の許可リスト (長さ・使える文字・名義間の重複) で検証し (具体値は qa-household-security-web-003 (agent 推定) を参照)、違反は 400 とフィールド別のエラーを返す。D1 の CHECK 制約でも長さを守る。表示名は React の既定のエスケープで描画し、dangerouslySetInnerHTML を使わない。家計 API のクエリ (month・key・期間) も zod で enum と書式を検証し、期間外の月は 400。応答は利用者本人のデータだけで、明細の内容・取引先はこれまでどおり画面に出すが外部へ送信しない (取込データの外部送信なし)。振替の対推定は表示だけで、データを書き換えない。更新系は既存の canonicalMutationFence の内側に置く。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-security-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-security-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

#### 裏付け質疑: `qa-household-security-web-evidence-001`

**問**

security 章の裏付けとして、既存の入力検証と公開物の検査について何を観測したか。

**答**

settingsRoute の PUT /classification は zValidator('json', classificationSchema) で institutionOwners を z.record(z.string().max(100), z.enum(OWNER_VALUES).nullable()) と検証している (packages/api/src/routes/settings.ts:654-661)。一方、家計の GET /api/household は専用の zod 検証を持たない (analytics.ts:528-531)。リポジトリには pnpm run security:content (scripts/hooks/guard-real-data.sh --scan-public-docs) が lint に組み込まれており、公開文書への実データ混入を検査している。フッターは『取込データは外部送信しません』を掲げる。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-18T11:33:59Z)

#### 裏付け質疑: `qa-household-security-web-003`

**問**

web の家計収支画面で、利用者が決めていない 名義ラベルの表示名の入力規則 を何にするか。

**答**

前後の空白を除いて 1〜20 文字、制御文字 U+0000–U+001F と U+007F を拒否、4 つの名義の表示名が互いに異なることを zod で確かめ、違反はフィールド別の 400 で返す。 これは agent の推定で、利用者は未確認である。画像と決定 001〜007 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様書 specs/spec-household-cashflow-screen.md を書く際に補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-18T12:02:30Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 名義を『本人 / パートナー / 子ども / その他』で扱えるようにする。内部値 (business / spouse / family と未設定) は変えず、名義ラベル表を追加する追加のみの migration と、表示名の取得・更新 API を設ける。初期表示名は business→本人、spouse→パートナー、family→子ども、未設定→その他。『名義ラベルを編集』から表示名だけを変更でき、家計画面・設定画面・明細画面の名義表示がすべてこの表示名を参照する。更新 API は既存の authGuard・パスワード変更フェンス・スキーマガード・変更系フェンスの内側に置き、入力は zod で長さと文字種を検証する。
- **G5**: 振替を家計の収入・支出から除外していることを利用者が確かめられるようにする。期間内に除外した振替の一覧 (日付・内容・金額・名義間) を出し、名義間は同額・逆符号・日付が近い振替 2 行を core の純関数で対にし、それぞれの口座の名義表示名から『本人 → パートナー』のように示す。対にならない行は『相手不明』と示す。スキーマは変えない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 名義ラベルの編集が安全に保存され全画面に反映される。 | API 統合テストで、未認証 401・変更系フェンス違反の拒否・長さ超過と制御文字の 400・正常更新の 200 と再取得での反映を確認し、migration が既存行を 1 行も書き換えないことを検査する。 |
| O5 | 振替の対推定が決定論で再現する。 | core の単体テストで、同額・逆符号・日付差の許容内の 2 行が対になり、許容外・同符号・3 行以上の競合が相手不明または一意な規則で解決され、同じ入力で同じ出力になる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I6**: owner_labels 表と GET / PUT の表示名 API、名義ラベル編集ダイアログを作り、家計・設定・明細の名義表示を表示名の取得関数 1 つへ寄せる。
- **I7**: 振替の一覧と対推定を core の純関数にし、日付差の許容・同額・逆符号・一意性の規則を docs とテストで固定する。

### 本章に効く確定意思決定

- **dec-household-owner-model**: 名義を『本人 / パートナー / 子ども / その他』で扱うとき、内部値を移行するか、内部値を残して表示名だけを編集可能にするか。
  - 採択: 内部値は残し表示名を編集可能にする (`opt-owner-display-label`)
  - 目的適合: G4 の表示名の要件を満たし、既存の business / spouse / family / unset を使う規則・明細を壊さない。
- **dec-household-transfer-pairs**: 振替の欄で名義間の移動を見せるか。入出金の対を推定して表示するか、名義間の欄を出さないか。
  - 採択: 入出金の対を推定して表示する (`opt-transfer-pair-estimate`)
  - 目的適合: G5 の『振替を家計の収入・支出から除外していることを確かめられる』に、どこからどこへ動いたかまで見せて答える。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『入力を許可リストで検証する』を、本サイクルで唯一増える自由記述の入力 (名義ラベルの表示名) に適用した。前後の空白を除いて 1〜20 文字、制御文字 U+0000–U+001F と U+007F を拒否、4 つの名義の表示名が互いに異なることを zod で確かめ、違反はフィールド別の 400 で返す。D1 の CHECK 制約でも長さを二重に守る。家計 API のクエリ (month・key・期間) も enum と YYYY-MM の書式で受け、期間外の月は 400 にする。表示名は React の既定のエスケープで描き、dangerouslySetInnerHTML を使わない。振替の対推定は表示だけでデータを書き換えない。

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

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| owasp-asvs | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/README.md | 2026-09-18T11:39:30Z | 2026-09-18T11:39:30Z |
