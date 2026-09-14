---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G1, G3, G5]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-backend-web-001。裏付け質疑 (`qa_refs`): `qa-backend-web-002`, `qa-basis-correction-001`, `qa-c8-owner-linkage-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G3, G5 |
| モバイル (mobile) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。API は Hono の単一 Worker が全 platform 共通で提供する契約であり、platform 別のバックエンド分岐や専用エンドポイントを設けない。 |
| タブレット (tablet) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。API は Hono の単一 Worker が全 platform 共通で提供する契約であり、platform 別のバックエンド分岐や専用エンドポイントを設けない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。API は Hono の単一 Worker が全 platform 共通で提供する契約であり、platform 別のバックエンド分岐や専用エンドポイントを設けない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。API は Hono の単一 Worker が全 platform 共通で提供する契約であり、platform 別のバックエンド分岐や専用エンドポイントを設けない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。API は Hono の単一 Worker が全 platform 共通で提供する契約であり、platform 別のバックエンド分岐や専用エンドポイントを設けない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の『業務規則を入出力から独立させる』に従い、認証と監査の主体としての利用者と、明細データの所有関係を意図的に分離した。API の追加は境界の外側 (入出力) に限る。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 認証系の現在状態を users に閉じ、既存の業務テーブルへ認証都合の列を足さない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G3, G5

#### 主たる接地根拠: `qa-backend-web-001`

**問**

ドメインモデルと API 契約 (web) を確定してください。どの実体を追加し、どのエンドポイントが要りますか。

**答**

ドメインに『利用者 (user)』を新設する。属性は id / email / password_hash / role / status / session_generation / must_change_password / temporary_password_expires_at / created_at / updated_at / last_login_at。既存の全業務データは共有テナントのまま変更せず、利用者は認証と監査のactorとして導入する。API は POST /api/auth/login・logout・password、GET /api/auth/me、およびadmin限定の GET|POST /api/admin/users、PATCH /api/admin/users/:id、POST /api/admin/users/:id/password-reset を持つ。退出運用は停止・再開へ一本化し、監査主体を失う物理DELETEは提供しない。入力はzod、エラー形状は { error: { code, message } } を踏襲し、未捕捉500だけ任意のrequestIdを加える。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/src/index.ts の現行ルーティング (L83-L130) と auth.ts の AuthEnv 観測、および利用者指示 (管理者からアカウント管理を行う) / 回答時刻: 2026-09-13T01:49:08Z)

#### 裏付け質疑: `qa-backend-web-002`

**問**

U7 scope.in の『既存データの所有者紐付け』と、qa-backend-web-001 の『明細データへの所有者列追加は本サイクルのスコープ外』は矛盾しているように読める。どちらが本サイクルの規範か。

**答**

矛盾ではなく、U7 の語の指す範囲を狭く読む。U7 scope.in の『既存データの所有者紐付け』が指すのは、業務データ本体 (明細・取引・カテゴリ等) へ所有者列を追加することではなく、audit_log へ actor_user_id を追加して『既存データに対してどの操作を誰が行ったか』を辿れるようにすることである。業務データ本体は単一テナントの共有資産のまま変更せず、行単位の所有者による参照制御は導入しない。これは U7 scope.out の『細粒度の権限ロール設計 (画面別・操作別の権限行列) を本サイクルでは扱わない』という利用者決定と同じ境界であり、本回答は新しい範囲判断を加えていない。したがって本サイクルで追加される所有者性は監査上の actor のみであり、qa-backend-web-001 の記述が規範として有効である。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: requirements_foundation U7 scope.in / scope.out の逐語と、qa-backend-web-001・qa-database-web-001 の確定内容の突合 / 回答時刻: 2026-09-13T02:07:56Z)

#### 裏付け質疑: `qa-basis-correction-001`

**問**

design_applications 8件 / doctrine_applications 13件 の basis を 'user-decision' として記録したが、これらの適用記述はエージェントが確定セルを読んで合成した文章であり、利用者が個々の文を選択・承認したものではない。basis の申告を実態に合わせて訂正せよ。

**答**

訂正する。21件の適用記述 (design 8 / doctrine 13) の basis を 'agent-inference' へ改める。記述内容そのものは変更しない — 確定セルの内容を読んで『その上流指針が本章のどこへ効いたか』を書いたという事実は変わらず、変わるのは『誰がそう判断したか』の申告である。利用者から得ているのは上位概念 (U1-U9, appr-foundation-account-login-001) と各カテゴリの確定回答であって、適用記述の一文一文ではない。併せて、同じ回で記録した qa-backend-web-002 / qa-database-web-002 の basis 'observed-fact' も実態と異なる: これらの答えの実体は既存コードの観測ではなく『U7 scope.in の語をどこまで狭く読むか』というエージェントの解釈判断であり、agent-inference が正しい区分である。qa-uiux-web-002 の basis 'user-decision' も、レイアウト・文言・ヘッダー等の不在は利用者の明示指示だが、『パスワードをお忘れの方』押下でダイアログを開くという UI 実装形式は利用者指示から演繹した推論であり、この部分に限り agent-inference である。qa_log の basis は fill-once で上書きできないため、これらの訂正は本 entry を裏付け質疑として当該セルへ添えることで記録に残す (誤った申告を消さずに残すことが、訂正そのものの監査可能性を保つ)。残る軽微な不正確として、qa-uiux-web-002 の required_info_items に無関係な 'target-platforms' が含まれ、qa-design-doctrine-application-001 には required_info_items が欠落している。いずれも接地判定 (target-platforms は qa-platform-scope-001 で接地済み) に影響しないため訂正質疑を重ねず、本 entry に記録して残す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 独立監査 (system-spec-hearing-auditor 再監査 2026-09-13) の指摘1・2・4・5 と、spec-state.json の design_applications / doctrine_applications / qa_log の逐語突合 / 回答時刻: 2026-09-13T02:20:00Z)

#### 裏付け質疑: `qa-c8-owner-linkage-001`

**問**

承認済み制約 C8「既存データには所有者列が無く userId は 'default' 固定であるため、初回管理者への紐付けを移行で決める必要がある」について、移行での扱いを確定してください。選択肢は (a) 業務データに所有者列を追加せず audit_log の actor_user_id 記録のみとする、(b) owner_user_id 列を追加し既存の全行を初回管理者の所有として埋める、(c) owner_user_id 列を追加するが既存行は NULL のまま埋めない、の3案です。

**答**

(a) を採る。明細等の業務データに所有者列を追加せず、既存データは登録済み利用者全員が参照できる共有資産のままとする。C8 が要求する『初回管理者への紐付けを移行で決める』ことへの答えは『紐付けない』であり、決めていないのではなく、紐付けないことを決めた。理由は3点: (1) C6 のとおり実質的に単独運用であり、行単位の所有者を持っても分ける相手がいない。(2) U7 scope.out で細粒度の権限ロール設計を本サイクルの対象外としており、所有者列を入れても参照制御に使えず、使わない列だけが残る。(3) (b) は既存行に『初回管理者が入力した』という観測していない事実を書き込むことになり、監査ログの信頼性を下げる。今回追加する所有者性は audit_log.actor_user_id による『今後どの操作を誰が行ったか』だけであり、既存行の actor は NULL (= 共有パスワード時代の操作で識別不能) のまま保持する。将来『誰の明細か』を分ける必要が生じた時点で、別サイクルとして所有者モデルを設計する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が3案の比較 (移行の重さ・将来の分割可能性・観測していない事実の書き込みリスク) を見たうえで (a) を明示選択 (2026-09-13)。独立監査 (system-spec-hearing-auditor 再監査) の指摘3『C8 の文言が qa-backend-web-002 の解釈で上書きされたまま再承認されていない』を受けて確認した / 回答時刻: 2026-09-13T04:36:37Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 利用者がメールアドレスとパスワードで本人として認証でき、セッションが誰のものかシステム側で特定できる
- **G3**: 管理者が設定画面から利用者の追加・停止・パスワード再発行を完結でき、共有パスワードの配り直しが不要になる
- **G5**: 既存20画面と /api/* 認証ガードの契約を壊さずに認証主体を差し替える

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | users テーブルを新設し、パスワードを鍵導出関数 (WebCrypto PBKDF2) で保存する | migration 適用後の schema に password_hash と salt と反復回数が存在し、平文パスワードを保持するカラムが0件 |
| O2 | セッション cookie に利用者識別子を含め、識別子を署名対象に含める | 利用者識別子を改ざんした cookie が /api/* で401になる契約テストが緑 |
| O3 | 「次回からもログイン状態を保持する」の選択でセッション有効期間を2段階に切り替える | 未選択時と選択時で Set-Cookie の maxAge が異なることを検査するテストが緑 |
| O4 | 管理者が設定画面から利用者の作成・停止・一時パスワード発行を行える | 3操作それぞれに API と画面操作が存在し、非管理者からの呼出しが403になる |
| O8 | migration適用後のbootstrap seedで初回管理者を1件作成し、共有パスワード認証経路を撤去する | active runtimeと必須設定に共有パスワード認証分岐が0件で、旧secretを外しても全機能が動作する |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: メールアドレスとパスワードの2入力によるログインフォーム
- **I3**: 「次回からもログイン状態を保持する」チェックボックス
- **I8**: 「パスワードをお忘れの方」を管理者への問い合わせ導線として置く (メール送信は行わない)
- **I10**: セッションへの利用者識別子の埋め込みと、利用者単位でのセッション失効
- **I11**: 設定画面の管理者セクションで、利用者一覧の閲覧・追加・停止・一時パスワード発行を行う
- **I13**: migration適用後のbootstrap seedで初回管理者を作成し、共有パスワード認証経路を撤去する
- **I14**: 既存 /api/* 認証ガードの mount 順序と契約を維持したまま主体を差し替える
- **I15**: 管理者が最後の管理者を停止・降格できないようにする

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

clean-architecture の『業務規則を入出力から独立させる』を、本章の API 契約へ適用した: 利用者という実体を 認証と監査の主体としてのみ導入し、明細データへ所有者列を伝播させない境界を引いた。エラー形状 { error: { code, message } } を既存のまま保つ決定も、境界の安定を優先した同じ原則の帰結である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T02:20:00Z)

### Clean Architecture — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-architecture.md`

#### 目的

変化しやすいUI、DB、framework、外部サービスから、長く保持したい業務ルールとuse caseを隔離し、技術交換やテストを目的達成の阻害要因にしない。

#### 解決する問題

- 業務ルールがcontroller/ORM/UI lifecycleへ埋まり、単体で検証できない。
- 外部技術変更が内側のuse caseまで波及し、置換費用を予測できない。
- 入出力形式やvendor型が境界を越え、責務と所有者が曖昧になる。

#### 適用条件

- business ruleが外部I/Oより長寿命で、UI/DB/providerの変更可能性がある。
- 複数delivery channelや外部integrationから同じuse caseを再利用する。
- 重要なpolicyを高速・決定論的にテストする価値が、境界導入費を上回る。

#### 非適用条件

- 寿命の短い検証用prototypeで、交換可能性より学習速度が明確に優先される。
- domain ruleがほぼ無い単純変換scriptで、port/adapterが実質的な抽象を生まない。
- 外部製品そのものがsystemの目的で、抽象化すると必要機能が失われる。ただしsecurity/audit boundaryは別途必要。

#### トレードオフ・失敗モード

- 境界、DTO、mapping、dependency injectionの量が増え、小規模systemでは認知負荷が先行する。
- 「4層を作ること」が目的化すると、変化軸のないinterfaceやpass-through use caseが増える。
- domain modelを万能化してdelivery固有の制約を隠すと、現実のlatency/transaction/error semanticsを見失う。
- portを外側が定義したりinner layerがORM型を返したりすると、名前だけcleanな依存逆転になる。

#### goalへの寄与

- `essential_purpose`に直結するpolicyを外部詳細から守り、goal達成ロジックの検証を速くする。
- 制約に「vendor lock-in低減」「複数platform」「高い変更頻度」がある場合、変更範囲と移行riskを局所化する。
- 適用判断は「何層あるか」でなく、守るgoal、予想される変更、boundary testで観測する。

---

### API Design Patterns — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/api-design-patterns.md`

#### 目的

consumerとproviderの独立変更を支える安定した契約を作り、再試行、失敗、並行更新、pagination、evolutionを予測可能にする。

#### 解決する問題

- resource/operationの意味、error、null、time、identifierがendpointごとに揺れる。
- timeout後の再試行で二重処理が起き、clientが成功/失敗を判断できない。
- collection増大や並行更新でoffset paginationと全件responseが破綻する。
- version/evolution方針がなく、provider変更がconsumerを突然壊す。

#### 適用条件

- 複数client/team/organizationが独立releaseで同じservice boundaryを利用する。
- network failureとretryが通常事象で、operation結果の重複や不明状態を制御する必要がある。
- contractの長期互換性とobservabilityが局所的な実装簡潔性より重要。

#### 非適用条件

- 同一process内のprivate callで、network boundaryや独立versioningが存在しない。
- hard real-time stream、双方向session、巨大event flowなど、request/response RESTが問題形状に合わない。
- 単純CRUD表面化がdomain invariantを迂回させる場合。use-case operationまたは別interaction modelを選ぶ。

#### トレードオフ・失敗モード

- version、idempotency ledger、schema governance、compatibility testに運用費がかかる。
- 「名詞URL」だけ守ってtransaction、authorization、error semanticsを設計しない表層RESTになる。
- offset paginationは簡単だが大規模/更新中datasetで遅延・重複・欠落を起こす。
- idempotency keyのscope/TTL/payload bindingが曖昧だと、別requestを誤って同一視する。
- breaking changeを新versionで逃がし続けると、複数version保守とsecurity patch負担が増える。

#### goalへの寄与

- mobile/web/desktop間で一貫したbusiness capabilityを共有し、platform別再実装を減らす。
- reliability goalにはretry-safe operationと明示的error、delivery goalにはcontract testとadditive evolutionを結ぶ。
- 選択はAPI様式の流行でなく、consumer、latency、consistency、offline、security、cost constraintsへの適合で評価する。

---

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| hono | 4.13.7 | Hono (honojs) (github.com) | https://github.com/honojs/hono/releases | 2026-09-13T01:55:58Z | 2026-09-13T01:55:58Z |
| zod | 4.6 | Zod (zod.dev) | https://zod.dev/ | 2026-09-13T01:55:58Z | 2026-09-13T01:55:58Z |
