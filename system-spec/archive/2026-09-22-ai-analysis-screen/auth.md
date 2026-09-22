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
| Web (web) | 確定 | 確定質疑: qa-ai-auth-web-001。裏付け質疑 (`qa_refs`): `qa-ai-auth-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、auth では端末の生体認証とセッションの結び付け、依頼トークンを端末に残さない方法を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、auth では家族で共有するタブレットでの利用者切替とセッションの分離を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、auth ではWindows 資格情報マネージャへのセッション保存の可否を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、auth ではSecret Service が無い環境でのセッション保存の代替を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、auth ではKeychain へのセッション保存と、コピーした依頼トークンの扱いを決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | キャンセル・再実行・使用するデータの 3 経路に、既存のセッション cookie による認証をそのまま効かせる形へ反映した。エージェント経路は既存のトークン認証のままで、キャンセル済みの判定を agentGuard に足す。新しいログイン手段や長期トークンは設けない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 利用者単位でデータを閉じる規則を、キャンセル・再実行・削除・使用するデータの全経路に反映した。どれも c.get('userId') で自分の依頼と明細だけを扱い、他の利用者の依頼 id を渡されたときは 404 を返すことを API テストで確かめる。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G5

#### 主たる接地根拠: `qa-ai-auth-web-001`

**問**

AI分析画面の新しい経路は、誰がどの条件で読み書きできるか。

**答**

利用者向けの新経路 (キャンセル・再実行・使用するデータ) は既存の aiRoute と同じく /api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の内側に置き、c.get('userId') で自分の依頼だけを扱う。エージェント経路は従来どおり依頼ごとの使い捨てトークン (SHA-256 保存・24 時間) だけで認証し、キャンセル済みの依頼のトークンを期限切れ・受信済みと同じく 401 で拒否する (qa-ai-decision-003)。再実行は新しいトークンを発行し、元のトークンは生かさない。新しい役割や長期トークンは設けない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-ai-analysis-001) と決定 qa-ai-decision-001〜008 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-auth-web-evidence-001`

**問**

auth 章の裏付けとして、AI の利用者経路とエージェント経路の認証について何を観測したか。

**答**

packages/api/src/index.ts は aiAgentRoute を /api/* のフェンスより前 (index.ts:95) に載せ、利用者向けの aiRoute を authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence (index.ts:102-106) の後 (index.ts:108) に載せる。エージェント経路は agentGuard (ai.ts:445-470) が Authorization: Bearer kjo_… を SHA-256 で ai_tasks.token_hash と照合し、期限切れと受信済みを 401 で拒否する。トークンの寿命は 24 時間 (ai.ts:36)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T12:36:49Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 依頼の操作を画面で決着できるようにする。キャンセルはトークンを無効にして行を残し、再実行は同じ期間と補足指示で新しい依頼を発行し、削除は結果の無い依頼だけを消す (受信済みは削除不可)。依頼の発行とプロンプトのコピーを 1 操作にする。
- **G5**: データの扱いと安全を固める。使用するデータのカードは実データ (対象期間・freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数) を新しい API で返し、AI へは集計値だけを渡す。エージェント用と貼り付けの経路に body の上限を設け、キャンセル済み・期限切れのトークンを拒否する。段階を導くための列 (連番・データ取得時刻・差し戻し時刻と回数・取消時刻) は追加のみの migration で足す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | キャンセル・再実行・削除が規則どおりに効く。 | API テストで、キャンセル後のトークンがデータ取得とレポート送信で拒否され行が残ること、再実行が同じ期間と補足指示の新しい依頼を作ること、受信済みの依頼の削除が拒否されることを確かめる。 |
| O5 | データの件数が実データと一致し、外部へ出るのは集計値だけである。 | API テストで、使用するデータの件数が同じ期間の D1 行数と一致し、エージェントへ渡すデータセットに明細行と摘要が含まれず、上限を超える body が 413 で止まることを確かめる。migration は追加のみで既存行の書き換えが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: キャンセル (トークン無効化・行を残す) と再実行 (同じ期間と補足指示で新規発行) の API を足し、実行中の表の操作列から呼ぶ。発行とコピーを 1 操作にする。
- **I6**: 使用するデータの件数 API を足し、エージェント経路と貼り付け経路へ body 上限を掛け、追加のみの migration で段階の記録列を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を、利用者経路とエージェント経路の 2 系統の配置に適用した。キャンセル・再実行・使用するデータは利用者の操作なので /api/* のフェンスの内側に載せ、route の中で個別の認可判定を書かない。エージェント経路は依頼ごとのトークンだけを受け、agentGuard 1 か所で期限切れ・受信済み・キャンセル済みを同じ 401 で拒否する。取り消しをトークンの削除ではなく canceled_at の記録で表すため、拒否の理由を利用者の画面にも残せる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T12:38:49Z)

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
