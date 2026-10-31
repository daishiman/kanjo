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
| Web (web) | 確定 | 確定質疑: qa-imp-auth-web-001。裏付け質疑 (`qa_refs`): `qa-imp-auth-web-evidence-001`, `qa-imp-decision-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、auth ではその端末の安全な資格情報の保管場所 (キーチェーン等) にセッションを置く方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、auth ではその端末の安全な資格情報の保管場所 (キーチェーン等) にセッションを置く方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、auth ではその端末の安全な資格情報の保管場所 (キーチェーン等) にセッションを置く方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、auth ではその端末の安全な資格情報の保管場所 (キーチェーン等) にセッションを置く方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、auth ではその端末の安全な資格情報の保管場所 (キーチェーン等) にセッションを置く方式を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 削除・復元・一覧の検索を、既存のセッション Cookie (HttpOnly・Secure・SameSite=Strict) の認証だけで通す形へ反映した。agent 経路のトークンは再発行で旧ハッシュを上書きし、削除中・完全消去済みの依頼では 404 を返す。新しい資格情報の種類は増やさない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 他の利用者の依頼を指す id を、取得・画像・指示文・コピー記録・状態の変更・再発行・削除・復元のどれでも 404 にそろえる形へ反映した。存在するかどうかを応答の違いから推測させない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-imp-auth-web-001`

**問**

auth の web の方針を次の内容で確定してよいか。

**答**

既存のセッション Cookie と authGuard をそのまま使う。全クエリを user_id で絞り、他の利用者の依頼は 404 にする。再発行すると旧トークンは即失効し、削除中の依頼には agent 経路からも届かない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 8 カテゴリの web 方針を表で提示し、AskUserQuestion の選択肢『この8カテゴリで確定 (推奨) / 修正して再提示』から利用者が『この8カテゴリで確定』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:16:38Z)

#### 裏付け質疑: `qa-imp-auth-web-evidence-001`

**問**

auth の web について、現行の実装と画像の差分は何か。

**答**

auth.ts:41 の役割は admin|member で、adminGuard (auth.ts:309-317) がある。改善要望の API は authGuard 配下の /api/* にあり、クエリを userId で絞っている。agent 経路はトークン (接頭辞 imp_、ハッシュで保存、24 時間・20 回まで) で認証する。認証の既定はセッション Cookie (HttpOnly・Secure・SameSite=Strict) である。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: repo の現物 (該当ファイルと行) と design/FINAL-UI/images/20-improvement.png を読んで観測した事実。answered_at は記録直前に実測した時刻。 / 回答時刻: 2026-09-23T13:17:45Z)

#### 裏付け質疑: `qa-imp-decision-003`

**問**

詳細パネルの『削除』をどう扱うか (物理削除 / 論理削除)。

**答**

論理削除にし、完了トーストの『元に戻す』で同じ番号のまま戻す。削除から 30 日後に夜間処理で本文・画像・履歴を完全消去する。削除中の依頼は一覧・件数・agent 経路のどこからも読まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案を提示し、利用者が『論理削除＋元に戻す (推奨)』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:05:47Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 依頼と添付を安全に保つ。利用者ごとの分離、入力検証 (本文 1000 字・プライバシー確認 2 つ・画像の形式と大きさ)、削除は論理削除で『元に戻す』で戻し 30 日後に夜間処理で本文・画像・履歴を完全消去、使い捨てトークンの再発行、夜間バックアップへ添付を入れない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 削除・分離・保持期限・既存ゲートを守る。 | API テストで削除→元に戻すで同じ id と番号が戻ること、削除中の行が一覧と件数に 0 件、他の利用者の依頼が 404、30 日経過の完全消去で R2 の画像と履歴が消えること、BACKUP_SNAPSHOT_SQL に改善リクエストの表が無いことが通り、pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: migration 0054 で状態の CHECK の張り替え (wontfix→done の移し替え)、利用者ごとの連番、論理削除の列、アクティビティの表を足し、削除・復元・状態変更・再発行で履歴を書く API と夜間の完全消去を実装する。
- **I6**: 入力検証 (本文 1000 字・プライバシー確認 2 つ・状態の候補・画像の形式と大きさ) を core と API の zod で揃え、他の利用者の依頼を 404 にする。

### 本章に効く確定意思決定

- **D-imp-008**: 夜間 scheduledMaintenance の D1 予算は 49/49 (Free の 1 invocation あたり 50 クエリ、1 本は必ず残す) で満杯。削除した改善リクエストを 30 日後に行と履歴ごと消す DELETE を 1 本足すにはどうするか。
  - 採択: 他 job の枠を 1 本回す (`borrow-slot`)
  - 目的適合: G4 の完全消去をアプリのコードとテストに明示したまま満たす。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を、新しい削除・復元・一覧の検索の経路の置き場所に適用した。新しい経路はすべて authGuard 配下の /api/* に置き、各クエリの条件に user_id を必ず含める。そのため、他の利用者の依頼を指す id は、存在しても存在しなくても同じ 404 になる。agent 経路はトークンのハッシュだけで照合し、再発行した時点で古いハッシュを上書きして即座に失効させる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T13:17:45Z)

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
