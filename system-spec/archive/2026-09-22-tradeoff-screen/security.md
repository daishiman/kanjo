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
| Web (web) | 確定 | 確定質疑: qa-tradeoff-security-web-001。裏付け質疑 (`qa_refs`): `qa-tradeoff-security-web-evidence-001`, `qa-tradeoff-security-web-003`, `qa-tradeoff-security-web-004`, `qa-tradeoff-security-web-005` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、security では端末の画面共有やスクリーンショットから金額を守る規則を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、security では共有端末に試算条件を残さない規則を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、security ではWindows のアプリ署名と自動更新の検証を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、security ではLinux の配布パッケージの署名検証を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、security ではmacOS の公証と自動更新の検証を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | ASVS の入力検証の要求を、tradeoffSchema と上書きの schema の上限 (文字数・件数・金額範囲・YYYY-MM) へ反映した。covered と selected.value に範囲を課し、極端な値で差額の表示を壊す入力を拒否する。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G5

#### 主たる接地根拠: `qa-tradeoff-security-web-001`

**問**

web のトレードオフ画面のセキュリティ要件は何か。

**答**

入力はすべて zod で検証し、文字数・件数・金額に上限を設ける (現行の covered と selected.value の無制限を塞ぐ)。全クエリを user_id で絞り、候補キーは利用者自身の freee_deals から導いたものだけを受け付ける前提で、上書きの保存も user_id で分ける。利用者の文字列 (支出名・メモ・取引先名) は React の既定エスケープで描画し dangerouslySetInnerHTML を使わない。アプリは LLM を呼ばず外部へ送信しない (qa-tradeoff-decision-003)。migration は追加のみ。具体の上限は qa-tradeoff-security-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-tradeoff-001) と決定 qa-tradeoff-decision-001〜009 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-security-web-evidence-001`

**問**

security 章の裏付けとして、現行のトレードオフ画面まわりについて何を観測したか。

**答**

packages/api/src/index.ts:89 で bodyLimit が全体に掛かる。POST /api/tradeoff の zod (routes/analytics.ts:805 付近の tradeoffSchema) は title ≤200、amount 正の整数、selected の label ≤200 と件数 ≤50 を課すが、covered と selected.value には上下限が無い。利用者の文字列は React の既定エスケープで描画しており dangerouslySetInnerHTML は使っていない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-security-web-003`

**問**

web のトレードオフ画面で、利用者が決めていない 入力の上限値 を何にするか。

**答**

支出名 100 文字、メモ 500 文字、候補のメモ 500 文字、候補キー 300 文字、金額は 1〜100,000,000 円の整数、開始月は YYYY-MM、選んだ候補は最大 50 件、候補の value は 0〜100,000,000 の整数、covered は −10,000,000,000〜10,000,000,000 の整数とする。上書きの保存は 1 回に 1 候補。 これは agent の推定で、利用者は未確認である。画像と決定 001〜009 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-security-web-004`

**問**

web のトレードオフ画面で、クライアントが送る試算値をどう扱うか。

**答**

POST /api/tradeoff の covered・判定・候補の月額はサーバが core で再計算した値だけを保存し、送られた値は使わない (qa-tradeoff-backend-web-004 の (6))。候補キーはその利用者の現在の候補にあるものだけを受け付け、無いものは 422 で拒否する。上書きの PUT は user_id で行を分け、他の利用者の候補キーには書けない。これは agent の推定で、利用者は未確認である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: completeness evaluator の medium 指摘 (POST の covered / verdict / selected.value をサーバで再計算するかが未確定) を受けて agent が補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T15:39:50Z)

#### 裏付け質疑: `qa-tradeoff-security-web-005`

**問**

qa-tradeoff-security-web-003 の covered の範囲 (±1e10 の符号付き) と、クライアント値への範囲検査の記述を、サーバ再計算 (qa-tradeoff-security-web-004) とどう整合させるか。

**答**

POST /api/tradeoff の zod スキーマから covered・verdict・selected.value を外し、受け取るのは支出名・金額・単発 / 毎月・開始月・メモ・候補キーの配列だけにする。003 の covered ±1e10 と value 0〜1e8 の範囲は入力検査ではなく、サーバが計算した値の保存前の不変条件 (covered は 0 以上 1e10 以下の整数) として core のテストで守る。候補キーは長さ 300 以下の文字列で、その利用者の現在の候補に存在することを検証する (無ければ 422)。これは agent の推定で、利用者は未確認である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: completeness evaluator の low 指摘 (security 章の covered ±1e10 とクライアント値への範囲検査の記述が -004 と食い違う) を受けて agent が補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-21T22:24:40Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G5**: 試算条件と候補ごとの上書きを安全に記録する。『この条件で試算』を押すたびに条件 (支出名・金額・単発 / 毎月・開始月・メモ・選んだ候補・差額) を既存 tradeoff_plans へ履歴として追加し、画面は最新の 1 件を復元する。保存一覧と翌月の突合は画面から外すが、既存の行と突合の関数は消さない。列と表は追加のみの migration で足し、入力は zod で検証し文字数に上限を設け、利用者ごとに分離する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O5 | 試算条件と上書きの記録が追加のみで安全に行われる。 | migration が CREATE TABLE / ALTER TABLE ADD COLUMN だけで、api テストで zod の上限・認証・利用者分離・最新 1 件の復元を検査し、既存の tradeoff_plans の行と tradeoffReview の契約テストが緑のままである。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に科目×取引先の候補集計・推移・必要度・自動の理由を新設し、上書きの新表と保存 API を足す。
- **I5**: tradeoff_plans に開始月・メモ列を足し、POST で履歴を追加、GET で最新 1 件を返して画面で復元する。保存一覧と突合の表示を外す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

入力検証を境界に置く原則を、試算の保存と上書きの保存に適用した。zod で支出名・メモ・候補キーの文字数、金額・件数・covered の範囲を課し、現行で上限の無かった covered と selected.value を塞ぐ。利用者の文字列は React の既定エスケープで描画し、アプリは LLM を呼ばないので、プロンプト注入や外部送信の経路が無い。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:19:22Z)

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
| hono-body-limit | 4.13.8 | Hono (honojs) (github.com) | https://github.com/honojs/hono/releases/latest | 2026-09-21T15:23:17Z | 2026-09-21T15:23:17Z |
| owasp-asvs | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/README.md | 2026-09-21T15:23:17Z | 2026-09-21T15:23:17Z |
