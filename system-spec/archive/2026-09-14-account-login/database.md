---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G1, G3]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-001。裏付け質疑 (`qa_refs`): `qa-database-web-002`, `qa-basis-correction-001`, `qa-c8-owner-linkage-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G3 |
| モバイル (mobile) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。永続化は D1 に集約し、端末内 DB やオフライン同期 (SQLite/IndexedDB の複製) を持たない。したがって platform 別のスキーマ・移行手順は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。永続化は D1 に集約し、端末内 DB やオフライン同期 (SQLite/IndexedDB の複製) を持たない。したがって platform 別のスキーマ・移行手順は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。永続化は D1 に集約し、端末内 DB やオフライン同期 (SQLite/IndexedDB の複製) を持たない。したがって platform 別のスキーマ・移行手順は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。永続化は D1 に集約し、端末内 DB やオフライン同期 (SQLite/IndexedDB の複製) を持たない。したがって platform 別のスキーマ・移行手順は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。永続化は D1 に集約し、端末内 DB やオフライン同期 (SQLite/IndexedDB の複製) を持たない。したがって platform 別のスキーマ・移行手順は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | Clean Architecture の data-access 境界を永続化の形へ落とした: 秘密は D1 の 2 テーブルに閉じ、R2 / KV へ複製しない。migration は前方のみで既存行を壊さない。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の『変更は巻き戻せる形で入れる』に従い、audit_log への actor_user_id 追加を NULL 許容として既存行と後方互換にし、D1 の Time Travel (30 日) を復旧手段として前提に置いた。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G3

#### 主たる接地根拠: `qa-database-web-001`

**問**

データ永続化 (web) を確定してください。どのテーブルを追加し、既存 migration とどう整合させますか。

**答**

D1 (kanjo-db) に `0039_account_login.sql` で追加する。(a) users は email UNIQUE、status/role CHECKに加え、現在の一時資格情報期限を password_hash と同じ行に持つ。(b) password_login_rate_limits は送信元とaccountの独立2軸へ拡張する。(c) audit_log には actor_user_id を追加し、既存行は NULL 許容として後方互換を保つ。初回適用時は初期管理者1件だけを作るseed手順を伴う。パスワードハッシュはD1にのみ置き、R2/KVや重複する履歴表へ複製しない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: migrations/ 配下の連番 (0038 が最新)・0014/0033 の既存スキーマ観測と、上記 auth/security の確定内容 / 回答時刻: 2026-09-13T01:49:08Z)

#### 裏付け質疑: `qa-database-web-002`

**問**

audit_log.actor_user_id を追加したとき、共有パスワード時代に記録された既存行の actor をどう扱うか。

**答**

既存行の actor_user_id は NULL のまま保持し、遡って埋めない。共有パスワード経路では操作者を識別する情報をそもそも記録していないため、誰であったかは観測されていない。観測されていない事実を移行で書き込むと、監査ログが『特定できた』と誤って主張することになる。よって NULL は欠測ではなく『識別不能な時代の操作である』という意味を持つ値として扱い、カラムは NOT NULL 制約を付けずに追加する。併せて、明細系テーブルへ owner 列を追加する migration は本サイクルで作らない (qa-backend-web-002 と同じ境界)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: migrations/0033_audit_log.sql の既存スキーマ観測と、packages/api/src/auth.ts の authGuard が userId='default' 固定である観測 / 回答時刻: 2026-09-13T02:07:56Z)

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
- **I15**: 管理者が最後の管理者を停止・降格できないようにする

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

clean-architecture の data-access 境界を、永続化の配置判断に適用した: 現在の一時資格情報を D1 の users 1行に閉じ、R2 や KV、重複履歴表へ複製しないと本章で確定した。migration を前方のみに限り既存行を壊さない方針も、既存データを新しい認証主体の都合で書き換えないための境界設定である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T02:20:00Z)

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
| cloudflare-d1 | 2026-04-30 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/ | 2026-09-13T01:55:58Z | 2026-09-13T01:55:58Z |
