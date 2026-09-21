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
| Web (web) | 確定 | 確定質疑: qa-ai-security-web-001。裏付け質疑 (`qa_refs`): `qa-ai-security-web-evidence-001`, `qa-ai-security-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、security では端末紛失時にレポートを消す手段と、画面の録画・スクリーンショット対策を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、security では共有端末にレポートと下書きが残らないようにするキャッシュ方針を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、security ではインストーラの署名と自動更新の改ざん対策を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、security では配布パッケージの署名検証とサンドボックス権限を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、security では公証 (notarization) とサンドボックスの権限範囲を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 入力の大きさの制限・契約検証・出力の無害化・外部送信なしの 4 点を、AI分析画面で増える入出力に反映した。レポート送信と貼り付けは body 上限の後で zod 契約を通し、レポートの文字列は React のエスケープで描き、AI へ渡すのは集計値だけで、アプリからの自動送信は無い。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5

#### 主たる接地根拠: `qa-ai-security-web-001`

**問**

AI分析画面で新しく生じる入力・出力・外部送信のリスクにどう備えるか。

**答**

エージェント経路のレポート送信と利用者経路の貼り付けに body の上限を設け、超過は 413 で止める。キャンセル・再実行・使用するデータの経路の id と期間は zod で書式を検証する。AI へ渡すのは集計値だけで、明細行と摘要は渡さない (qa-ai-decision-004)。アプリは外部へ自動送信せず、データは利用者が依頼をコピーしたときだけ外へ出る。レポートの文字列と補足指示は React の既定のエスケープで描き、dangerouslySetInnerHTML を使わない。取り込みの JSON は構文検査と契約検査を通ったものだけを保存し、失敗しても入力は画面に保持する。下書きはブラウザ内だけに置く (qa-ai-decision-006)。具体の上限値は qa-ai-security-web-003 (agent 推定) を参照。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-ai-analysis-001) と決定 qa-ai-decision-001〜008 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-security-web-evidence-001`

**問**

security 章の裏付けとして、AI 経路の入力の大きさと検証について何を観測したか。

**答**

bodyLimit は /api/auth/* にだけ 16KB で掛かっており (index.ts:84-92)、エージェント経路の POST /ai/tasks/:id/report と利用者経路の POST /ai/tasks/:id/paste には body の上限が無い。レポート本文は reportInputSchema (packages/api/src/ai/contract.ts) の zod で検証し、sanitizeText で文字列を整える。リポジトリの lint には security:content (scripts/hooks/guard-real-data.sh --scan-public-docs) が組み込まれ、公開文書への実データ混入を検査している。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-security-web-003`

**問**

web の AI分析画面で、利用者が決めていない エージェント経路と貼り付け経路の body の上限値 を何にするか。

**答**

POST /ai/tasks/:id/report と POST /ai/tasks/:id/paste の request body 上限は固定 4 MiB (4,194,304 bytes) とし、1 byte でも超えたら JSON 読み込み前に 413 payload_too_large を返す。これは転送量を抑える request budget であり、個別 field・配列の妥当性は reportInputSchema と normalizeReport が別に検証する。キャンセル・再実行は 4KB。下書きは利用者別キーで1000文字までとする。AI用SELECTは集計に必要な列へ限定し、明細ID・摘要・memoを応答へ含めない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-19T12:36:49Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 結果の取り込みとレポートの読み方を整える。取り込み先は選択中の依頼 (結果待ちが 1 件なら自動選択・無ければ無効)、JSON の構文エラーは行と位置を、契約違反は項目名を日本語で示し、入力は保持する。レポートは 要約 / 根拠データ / 改善提案 / 関連リンク のタブに問い順で振り分け、版履歴は補足指示の 1 行目 (無ければ既定文) を説明にし、2 つの版を並べて比較できる。一覧は名前で検索でき、アーカイブの表示を切り替えられる。
- **G5**: データの扱いと安全を固める。使用するデータのカードは実データ (対象期間・freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数) を新しい API で返し、AI へは集計値だけを渡す。エージェント用と貼り付けの経路に body の上限を設け、キャンセル済み・期限切れのトークンを拒否する。段階を導くための列 (連番・データ取得時刻・差し戻し時刻と回数・取消時刻) は追加のみの migration で足す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 取り込みの誤りが直せる形で示され、レポートがタブと版で読める。 | DOM と core のテストで、構文エラーの行・列の表示と入力の保持、契約違反の項目名表示、選択中の依頼への取り込み、4 タブへの振り分け、版の説明の導出、2 版比較、一覧の検索とアーカイブ切替を確かめる。 |
| O5 | データの件数が実データと一致し、外部へ出るのは集計値だけである。 | API テストで、使用するデータの件数が同じ期間の D1 行数と一致し、エージェントへ渡すデータセットに明細行と摘要が含まれず、上限を超える body が 413 で止まることを確かめる。migration は追加のみで既存行の書き換えが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: 結果の取り込みを選択中の依頼へ向け、JSON の構文エラーの行・位置と契約違反の項目名を示し、入力を保持する。
- **I5**: レポート詳細を 要約 / 根拠データ / 改善提案 / 関連リンク のタブに問い順で振り分け、要約の下に関連ページのリンクと版履歴 (補足指示の 1 行目から説明) と 2 版比較を置く。一覧に検索とアーカイブ切替を付ける。
- **I6**: 使用するデータの件数 API を足し、エージェント経路と貼り付け経路へ body 上限を掛け、追加のみの migration で段階の記録列を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『入力を許可リストで検証し、大きさを境界で制限する』を、本サイクルで外から入る 2 つの大きな入力 (エージェントのレポート送信と利用者の貼り付け) に適用した。どちらも JSON を読み込む前に body の上限で止め、読み込んだ後は既存の reportInputSchema で契約を検証する。取り込み欄の構文エラーは保存せず、行と位置だけを返して入力を画面に残す。AI へ渡すデータは dataset.ts の集計値だけという既存の境界を、使用するデータのカードの注記として利用者にも見える形にする。

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

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| hono-body-limit | 4.13.8 | Hono (honojs) (github.com) | https://github.com/honojs/hono/releases/latest | 2026-09-19T12:40:44Z | 2026-09-19T12:40:44Z |
| owasp-asvs | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/README.md | 2026-09-19T12:40:44Z | 2026-09-19T12:40:44Z |
