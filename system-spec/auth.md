---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G5]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-classify-bulk-decision-072。裏付け質疑 (`qa_refs`): `qa-classify-bulk-auth-web-001`, `qa-classify-bulk-auth-web-evidence-001`, `qa-classify-bulk-backend-web-008`, `qa-classify-bulk-backend-web-009`, `qa-classify-bulk-decision-017` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアで一括保存の操作者を確かめ、既存セッションと結び付ける方式を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアで一括保存の操作者を確かめ、既存セッションと結び付ける方式を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアで一括保存の操作者を確かめ、既存セッションと結び付ける方式を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアで一括保存の操作者を確かめ、既存セッションと結び付ける方式を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアで一括保存の操作者を確かめ、既存セッションと結び付ける方式を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 選択の読み出し・一括保存・勘定科目の対応表の読み書きも、既存のセッション Cookie (HttpOnly・Secure・SameSite=Strict) の認証だけで通す形へ反映した。これらの操作のために新しい資格情報・トークン・API キーを発行しない。未認証は 401 を返す。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 一時パスワードの利用者は mustChangePasswordFence で選択の読み出し・一括保存・勘定科目の対応表の API に届かず 403 になる。他の利用者の行の key と txId は、選択の読み出しでは存在しない key と同じく missing に入れ、一括保存では not_found として返し、他の利用者の勘定科目の対応表の行も『見つからない』として扱って、存在するかどうかを明かさない形へ反映した (OWASP API1:2023 BOLA)。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G5

#### 主たる接地根拠: `qa-classify-bulk-decision-072`

**問**

要件の土台のうち、選択の単位と選べる行・保存の経路の認可と入力検証を書いた 12 項目 (G3・G5・O4・O6・S3・S5・I3・I5・範囲に含む 4・5・9・範囲に含まない 5) を、『承認する』の preview の今の文面で承認しますか。要件の土台 (U1〜U9) の文面は、以前の承認の後に続いた決定で書き換わっていて、今の全文を逐語で示して承認を得た記録がありません。以前の問 (decision-060) の (b)『要件の土台 U1〜U9 の全文を逐語で示し、承認し直す』に当たります。土台を 6 つに分け、前の回で 3 つを承認いただいたので、この回で残りの 3 つを伺います。今の全文は『承認する』の preview に、改める項目と変えない項目に分けて置きます。文中の括弧内の id は、その文面のもとになった決定です。12 項目のうち 6 項目 (G3・G5・O6・S5・範囲に含む 4・5) は、以前の承認 (decision-017・030) の後の決定で文面が変わりました。ほかの 6 項目は変えません。主な変化: 分割の設定が不正な明細の行も選べず、理由『分割の設定を直してから保存してください』を示す (decision-038)。勘定科目の対応表の読み書きも利用者自身の行だけを扱い、他の利用者の行は存在を明かさず『見つからない』とし、同じ大項目の 2 行目と一覧に無い対応先を 400 にし、変更を設定の変更履歴に残す (decision-049)。『カテゴリなし』の予約の値は一括指定と編集の値としては 400 にし、同じ名前のカテゴリの候補は作れない (decision-045・048)。一括保存の本文は 256KB までで、超えたら 413 を返す (decision-030)。以前の問 (decision-017) は、『承認しない』にだけ結果を書いていて利点と不利な点の対が無かったので、各選択肢に利点と不利な点を書いて問い直します。承認すると、この問の記録を、仕様の security と auth の章の主な根拠にします。今の auth の章の主な根拠は、勘定科目の対応表を足す前の回答で、対応表の行の扱いを含んでいません。

**答**

承認する。preview の項目を、今の文面のまま要件の土台として承認する。利点: 土台と仕様の各章が同じ文面に揃い、承認の記録から今の文面を辿れる。不利な点: preview は約 3100 字あり、読み落とした細部も、この文面のまま計画と実装へ渡る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「土台・選択と認可」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-025)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T09:28:56.562Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-017 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T09:28:57Z)

#### 裏付け質疑: `qa-classify-bulk-auth-web-001`

**問**

選択の読み出しと一括保存を、誰にどこまで許すか。

**答**

選択の読み出し API と一括保存 API は、既存の認証 (authGuard) とパスワード変更フェンス (mustChangePasswordFence) の後に置き、認証済みの利用者自身の明細だけを扱う。未認証は 401、フェンスに拒まれた場合は 403。他の利用者の txId は存在を明かさず『見つからない』(not_found) として扱う。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T13:43:42Z` — provenance の後半『利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた』は、8 カテゴリの -001 に同じ文を付けたもので、本カテゴリには当てはまらない。本カテゴリに -003 は無く、agent-inference の qa も無い。
> - `2026-09-30T21:16:05Z` — answer の『他の利用者の txId は存在を明かさず『見つからない』(not_found) として扱う』は、qa-classify-bulk-decision-007・qa-classify-bulk-decision-017 で選択の単位が行の key になったことを受け、行の key と txId の両方に当てる形になった。選択の読み出しでは、他の利用者の key と消えた key を missing として返す (qa-classify-bulk-backend-web-008 (2)、agent の推定)。未認証の 401 とフェンスの 403 は変わらない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-classify-bulk-001) と決定 qa-classify-bulk-decision-001〜004 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-30T07:53:11Z)

#### 裏付け質疑: `qa-classify-bulk-auth-web-evidence-001`

**問**

auth 章の裏付けとして、現行実装について何を観測したか。

**答**

/api/* は authGuard の後に mustChangePasswordFence を通り (packages/api/src/index.ts:111, 113)、classifyRoute と classifyBulkRoute はその後に登録される (index.ts:128-129)。セッション cookie は httpOnly・secure・sameSite=Strict (packages/api/src/auth.ts:129-131)。一括保存は c.get('userId') で本人の Dataset と取引先の記憶だけを読む (packages/api/src/routes/classify-bulk.ts:87-94)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-30T07:53:11Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-008`

**問**

qa-classify-bulk-decision-010〜012 と反復 2 回目の検証を受けて、選択の読み出し・一括保存・core が、利用者の決めていない細部で何を約束するか (qa-classify-bulk-backend-web-007 の補足と訂正)。

**答**

(1) 選択の読み出しの母集団は、利用者自身の全明細である。期間・絞り込み・ページ・並べ替えを掛けない。一括保存がサーバで明細を引き直す母集団 (packages/api/src/routes/classify-bulk.ts) と同じにし、選択 (G3) が表示に左右されないようにする。(2) 他の利用者の明細の key と、削除・分割・取込の取り消しで消えた明細の key は、応答の missing に入れ、rows に出さない。missing は、選択の読み出しにおける『見つからない』(not_found) の形であり、qa-classify-bulk-auth-web-001 と qa-classify-bulk-security-web-004 の『他の利用者の明細は存在を明かさず not_found で返す』を満たす。存在しない key と他の利用者の key は、同じ形で返す。(3) qa-classify-bulk-security-web-004 の『要求全体を 400 にするのは 3 つだけ』は、選択の読み出しについては、件数の範囲外 (1〜50 件)・key の重複・key の形の範囲外 (mf:・cash:・split: のどれかで始まり、1 件 200 字まで。qa-classify-bulk-backend-web-007 (1)) と読む。key の形の範囲外は、一括保存の『一括指定の値の範囲外』と同じく、要求全体に当たる入力の範囲外である。(4) 一括保存の値の解決は、qa-classify-bulk-decision-010 のとおり区分とカテゴリを 1 組で決める。一括指定のカテゴリ (中) は、カテゴリ (大) を伴うときだけ受け、(中) だけの一括指定は一括指定の値の範囲外として 400 にする (packages/core/src/categories.ts の categoryAllowed は、大項目が空なら中項目も空であることを求める)。(5) 書き込みの前に決まる失敗 (1 回の batch のクエリが D1 の上限を超える、束ねた JSON が 2MB を超える) は、送り直しても結果が変わらない。今は、この例外も write_failed に丸められ、画面が再試行を出す (packages/api/src/routes/classify-bulk.ts の classify_bulk_query_budget と、aggregateReplacementQueries の事前検査)。これを明細ごとの write_failed ではなく、明細ごとの結果を持たない要求全体の失敗として返す。write_failed は、D1 への書き込みそのものが失敗したときだけに使う。(6) qa-classify-bulk-backend-web-007 (6) の『D1 の 1 起動あたりのクエリの上限を core の 1 か所に置く』を訂正する。D1 の上限は Workers と D1 の実行環境の制約で、環境に依存しない純関数を置く core の関心ではない。api の 1 か所に置き、今 api に別の名前で 4 か所ある同じ値 50 の定数 (import-lifecycle.ts の D1_FREE_QUERY_LIMIT、scheduled-maintenance-budget.ts の SCHEDULED_D1_QUERY_LIMIT、routes/classify.ts の CLASSIFY_BATCH_STATEMENTS、routes/classify-bulk.ts の MAX_BATCH_STATEMENTS) をそこへまとめる。core の 1 か所に置くのは、選択の上限 50 件、表示件数 25・50・100 と既定値 50、行の key の作成と解析、選べる行の判定 (qa-classify-bulk-decision-012)、値の解決関数 (qa-classify-bulk-decision-010) である。key の解析は、最初の ':' の後ろを txId とする (現金の明細の id は cash: で始まるので、key は cash:cash: の形になり、':' で分けると壊れる)。値の解決関数は、画面の resolveBulkItem と inputFromRow の提案の分岐 (packages/web/src/pages/classify/view-model.ts) を 1 つにまとめたもので、画面とサーバで同じ関数を使う。(7) qa-classify-bulk-backend-web-007 (5) の『legacyBasisLabel にこの由来の分岐を足す』を訂正する。分岐を足すと、提案の根拠文を決める場所が、core の候補の算出と /review-queue の 2 か所に残る。/review-queue は候補が持つ根拠文をそのまま使い、legacyBasisLabel は消す。由来の型は、同じ値の集合で core に 2 つある (classify-status.ts の SuggestionBasis と overview.ts の RecommendationBasis) ので、RecommendationBasis を SuggestionBasis の別名にして 1 つにする。(8) 『MF の分類』の提案は、分割の内訳行には付けない。内訳行のカテゴリは分割で決めた値で、取込 CSV の値は元の明細のものだからである。集計ルールが当たる個人の明細には、ルールを当てた後の値を提案する (qa-classify-bulk-decision-011)。 これは agent の推定で、利用者は未確認である。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T14:31:12Z` — (3) の key の形の範囲外を 400 にする読み、(5) の要求全体の失敗の形、(6) の key の解析と D1 の上限の名前、(7) の『legacyBasisLabel を消し、候補が持つ根拠文をそのまま使う』は、qa-classify-bulk-backend-web-009 (2)〜(5) で訂正・補足した。/review-queue の短い根拠文 basisLabel は残す。
> - `2026-10-01T00:36:07Z` — (5) の要求全体の失敗は、qa-classify-bulk-backend-web-010 (3) で 2 種類の 413 にした。本文の大きさは payload_too_large、書き込みの予算は too_many_classify_changes で、どちらも明細ごとの結果を持たない。
> - `2026-10-01T10:08:23Z` — (4)(6) の qa-classify-bulk-decision-010 は、qa-classify-bulk-decision-035 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-035 で選定を agent に委ね、agent は qa-classify-bulk-delegated-003 で区分とカテゴリを 1 組で決める案を選んだ。区分だけを指定し、区分に合う組が下書き・提案・今の値のどこにも無い明細は『カテゴリなし』で保存する (qa-classify-bulk-decision-048)。(6) の qa-classify-bulk-decision-012 は、qa-classify-bulk-decision-038 で問い直して置き換わり、利用者は旧と同じ案 (分割の設定が不正な明細の行は選べない) を選んだ。(8) の qa-classify-bulk-decision-011 は、qa-classify-bulk-decision-028 で問い直して置き換わり、利用者は旧と同じ案 (ルールを当てた後の値を提案する) を選んだ。qa-classify-bulk-decision-028 は、不利な点『確定した明細は、後から集計ルールを変えても追従しない』を示したうえで選ばれた。(6) の表示件数 25・50・100 は要件の土台の G4 にある (qa-classify-bulk-decision-074 で文面を承認)。既定値 50 は土台にも決定にも無い agent の案で、利用者は未確認である (qa-classify-bulk-ui-ux-web-003 の訂正と同じ)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。(1) と、(6) の D1 の上限の置き場所は、3 問を提示する前の本文 (2026-09-30T14:02:16.917Z) で『自分で決められる不足 (既定で記録します)』として示した。(2) は、同じ本文で画面の側 (保存前の内訳に出し、sel から外す) を示し、サーバの側をここで補った。(5) は、4 問を提示する前の本文 (2026-09-30T13:29:51.114Z) で示した『再試行は write_failed と通信の失敗にだけ出す』を、サーバの側から成り立たせるものである。(3)(4)、(6) の core に置くもの、(7)(8) は、どちらの本文にも示していない agent の推定である。利用者は異議を述べなかったが、選んだ値ではない。 / 回答時刻: 2026-09-30T14:11:48Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-009`

**問**

qa-classify-bulk-decision-013・qa-classify-bulk-decision-014 と反復 3 回目の検証を受けて、一括保存の値の解決・選択の読み出し・core が、利用者の決めていない細部で何を約束するか (qa-classify-bulk-backend-web-008 の補足と訂正)。

**答**

(1) 値の解決の順。未整理 (status が unsorted) の明細は、区分・カテゴリの組・所有者を項目ごとに、一括指定→下書き→提案の順で埋める。確定済みの明細は、一括指定→下書き→今の値の順で埋め、提案を使わない。支払い方法は状態によらず、一括指定→下書き→今の値の順で埋める。支払い方法の今の値は保存済みの手動の値 (row.edit.paymentMethod) で、無ければ送らない (導出した値を送ると、変わっていないのに履歴が増える)。カテゴリの組は、区分が決まったら、上の順のうち区分の系統に合う最初の組を取る。合う組がどこにも無い明細は、保存前に理由『区分に合うカテゴリがありません』を付けて外し、失敗に数えない (qa-classify-bulk-decision-014)。サーバは qa-classify-bulk-security-web-004 のとおり、その明細を invalid_item で返して二重に防ぐ。カテゴリ (大) を指定し区分を指定しないときも、各明細の区分と合わない明細は同じ理由で外す。区分とカテゴリ (大) を両方指定して系統が合わないときは、選択した全件に当たる値なので、一括指定の値の範囲外として要求全体を 400 にする。確定済みの明細で一括指定も下書きも無いものは、変わる値が無いので、理由『変わる値がありません』を付けて外す。未整理の明細で指定も下書きも提案も無いものは、今までどおり O1 で外す。値の解決関数は、画面の inputFromRow の分岐 (未整理で提案があるときだけ提案を使う) に揃え、resolveBulkItem の『状態を見ずに提案を使う』はやめる (packages/web/src/pages/classify/view-model.ts)。qa-classify-bulk-decision-010 の answer の『無ければカテゴリを空にする』は、データに空の状態が無い (packages/api/src/tx-edit-codec.ts の patch.big || null と、packages/core/src/classify.ts の editedCat) ので、qa-classify-bulk-decision-014 に置き換わる。(2) qa-classify-bulk-backend-web-008 (3) を訂正する。選択の読み出しで要求全体を 400 にするのは、qa-classify-bulk-security-web-004 のうち当てはまる件数の範囲外 (1〜50 件) と key の重複だけとする。key の形の範囲外 (mf:・cash:・split: のどれでも始まらない、または 200 字を超える) は、存在しない key と同じく missing に入れる。(3) qa-classify-bulk-backend-web-008 (5) の要求全体の失敗は、HTTP 413 と code bulk_too_large で返し、明細ごとの結果を持たない。サーバの 5xx と、応答が得られない通信の失敗は、書き込まれたかどうかが分からない失敗として画面が扱う (qa-classify-bulk-frontend-web-004 (1))。(4) qa-classify-bulk-backend-web-008 (6) を補う。D1 の上限は api の 1 か所に置くが、1 回の起動のクエリの合計 (50 未満) と、1 回の batch の文の数 (50 以下) は意味と境界が違うので、2 つの名前で持つ。key の解析は、最初の ':' の前を行の種類、後ろを id とする。id は、mf と cash では txId、split では内訳の lineId である。(5) qa-classify-bulk-backend-web-008 (7) を訂正する。/review-queue の短い根拠文 basisLabel (『過去 10 件中 9 件』の形) は残す。specs/spec-overview-screen.md の FR-005、specs/spec-classify-screen.md の『既存の basisLabel は /review-queue との互換のために残す』、packages/core/test/overview-recommendation-contract.test.ts がこれを求める。候補に短い根拠文も持たせ、長い根拠文 basisText と同じく候補を作る 1 か所で作る。legacyBasisLabel は、その 1 か所へ移して消す。RecommendationBasis を SuggestionBasis の別名にすることは変えない。(6) qa-classify-bulk-decision-011 を成り立たせるため、提案 (classifySuggestion) と行の解決 (resolveTx) に集計ルール (normRules) を渡す。今は渡しておらず、提案の呼び出しは 6 か所 (api の classify-row.ts に 2 か所、routes/classify.ts、routes/classify-bulk.ts、core の overview.ts に 2 か所) ある。1 か所でも漏れると、一覧・一括保存・/review-queue で提案が食い違うので、提案の入力 (ルール・取引先の記憶・集計ルール) を 1 つの値にまとめて渡す。(7) qa-classify-bulk-decision-011 の不利な点を記録する。集計ルールの値の提案で保存した明細は、カテゴリの出所が手動になり、後から集計ルールを変えても追従しない。 これは agent の推定で、利用者は未確認である。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-10-01T00:36:07Z` — (3) の『HTTP 413 と code bulk_too_large』は、qa-classify-bulk-backend-web-010 (3) で訂正した。bulk_too_large は導入せず、既存の payload_too_large と too_many_classify_changes を使う。通信の失敗と 5xx の画面の扱いは qa-classify-bulk-frontend-web-005 (1) で訂正した。
> - `2026-10-01T09:47:30Z` — (1) の『合う組がどこにも無い明細は、保存前に理由「区分に合うカテゴリがありません」を付けて外し、失敗に数えない』と『サーバはその明細を invalid_item で返して二重に防ぐ』は、qa-classify-bulk-decision-037・qa-classify-bulk-decision-045・qa-classify-bulk-decision-048 で改まった。区分だけを指定し、区分に合うカテゴリの組が埋める値 (下書き・提案・今の値) のどこにも無い明細は、カテゴリの組を『カテゴリなし』の予約の値にして保存の対象に入れ、保存前の内訳に『カテゴリなし』で保存する件数を出す。サーバも同じ core の解決関数で同じ値にするので、invalid_item で外さない。『カテゴリなし』の予約の値を一括指定の値として送る要求は、一括指定の値の範囲外として要求全体を 400 にする (requirements_foundation の G5)。『qa-classify-bulk-decision-010 の「無ければカテゴリを空にする」は、データに空の状態が無いので qa-classify-bulk-decision-014 に置き換わる』は、予約の値で空の状態をデータに持てるようになったので、qa-classify-bulk-decision-037・qa-classify-bulk-decision-048 に置き換わる。カテゴリ (大) だけを指定し区分を指定しないときに、明細の区分と系統が合わない明細を外す扱いは、qa-classify-bulk-decision-048 の場面 (区分だけを指定) に当たらないので変えない。外す理由の文言は『指定したカテゴリ (大) が明細の区分に合いません』とする。区分とカテゴリ (大) を両方指定して系統が合わないときの 400 も変えない。(6) の『提案の入力 (ルール・取引先の記憶・集計ルール) を 1 つの値にまとめて渡す』には、qa-classify-bulk-decision-049 の勘定科目の対応表も入れる。入れないと、事業の明細の提案が一覧・一括保存・/review-queue で食い違う。カテゴリ (大) だけを指定したときの扱いとその文言、提案の入力に勘定科目の対応表を入れることは agent の読みで、利用者は未確認である。(3) は 2026-10-01T00:36:07Z の訂正のとおりで、要求全体の失敗の扱いは qa-classify-bulk-decision-054・qa-classify-bulk-decision-055・qa-classify-bulk-decision-056・qa-classify-bulk-decision-057 で利用者が決めた。(2)(4)(5)(7) は変わらない。
> - `2026-10-01T10:08:23Z` — (1) の qa-classify-bulk-decision-010 は、qa-classify-bulk-decision-035 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-035 で選定を agent に委ね、agent は qa-classify-bulk-delegated-003 で区分とカテゴリを 1 組で決める案を選んだ。組が無いときの扱いは 2026-10-01T09:47:30Z の訂正のとおり (qa-classify-bulk-decision-048)。(6)(7) の qa-classify-bulk-decision-011 は、qa-classify-bulk-decision-028 で問い直して置き換わり、利用者は旧と同じ案 (ルールを当てた後の値を提案する) を選んだ。(7) の不利な点 (確定した明細は、後から集計ルールを変えても追従しない) は、qa-classify-bulk-decision-028 の選択肢に示したうえで選ばれた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。(1) は qa-classify-bulk-decision-013・qa-classify-bulk-decision-014 から導いた読みで、qa-classify-bulk-decision-010 の provenance に混ざっていた読み (提示した選択肢に無いもの) を置き換える。(2)(3)(5)(6)(7) は、問を提示する前の本文 (2026-09-30T14:27:03.589Z) で『私の判断で直せるもの』として示した。利用者は異議を述べなかったが、選んだ値ではない。(4) は、どの本文にも示していない agent の推定である。 / 回答時刻: 2026-09-30T14:31:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-017` — 旧版（置き換え先: `qa-classify-bulk-decision-072`）

> **旧版** — この問答は `qa-classify-bulk-decision-072` で置き換えられた (`2026-10-01T09:29:15Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は、『承認しない』にだけ結果を書き、利点と不利な点の対が無く、選択肢の書き方が片寄っていた (N2 の違反)。また、承認の後の決定で土台の文面が変わり、今の全文を逐語で示した承認が無かった (軸 5)。今の全文を preview に置き、各選択肢に利点と不利な点を書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-025。利用者は『承認する』を選んだ。

**問**

```text
テーマ C（選択の単位と選べる行）: G3・G5・O4.measure・O6.measure・S3・I3・I5・範囲 in[4]・in[5]・out[5] を、preview の「新」の文面に改めることを承認しますか？
```

**答**

```text
承認する。10 項目を preview の「新」の文面に改めます。改めた後の文面は requirements_foundation の該当項目にある。承認した文面の要点: 選択は sel に行の key で持ち、内訳行と分割の設定が不正な行は選べず、見出しの全選択は 50 件で止める。他の利用者の行の key と txId は存在を明かさず『見つからない』とし、選択の key と一括の txId の重複は 400 にする。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問を 1 回で提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-007)。利用者はこの問で「承認する」を選択。answered_at は回答受領時刻 (2026-09-30T15:07:35.741Z) を秒へ切り上げた値で、選択時刻の上界である。backend と security の web セルの reopen (2026-09-30T15:04:11Z) より後の回答である。 / 回答時刻: 2026-09-30T15:07:36Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G5**: 保存の経路を安全に保つ。選択の読み出し・一括保存・勘定科目の対応表の読み書きは、認証済みの利用者自身の行だけを扱い、他の利用者の行の key・txId・勘定科目の対応表の行は、存在を明かさず『見つからない』として扱う。入力は zod で検証する。選択は 50 件・一括は 100 件までとし、選択の key と一括の txId の重複は 400 にする。一括指定の値は既存の編集と同じ制約とし、『カテゴリなし』の予約の値は一括指定と編集の値としては 400 にする (qa-classify-bulk-decision-048)。予約の値と同じ名前のカテゴリの候補は作れない (qa-classify-bulk-decision-045)。勘定科目の対応表は、同じ大項目の 2 行目と、勘定科目の一覧に無い対応先を 400 にする。一括保存の本文は 256KB までとして超えたら 413 を返し、変更はフェンスを通し、保存した明細の値が変わった項目ごとに履歴 (一括保存) を 1 行ずつ残す (値が変わらない明細は履歴を書かない)。勘定科目の対応表の変更は、設定の変更履歴に残す (qa-classify-bulk-decision-049)。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O6 | 保存の経路が認可と入力検証を通る。 | API テストで、未認証 401、フェンス拒否 403、選択 51 件・選択の key の重複・一括 101 件・一括の txId の重複が 400、『カテゴリなし』の予約の値を一括指定か編集の値として送ると 400、予約の値と同じ名前のカテゴリの候補の作成が 400、一括保存の本文が 256KB を超えると 413 payload_too_large、他の利用者の行の key と txId が見つからない扱い (存在を明かさない)、保存した明細の値が変わった項目ごとに履歴 source=bulk が 1 行ずつ残り、値が変わらない明細には履歴が残らないことを確かめる。勘定科目の対応表の API で、未認証 401、同じ大項目の 2 行目と一覧に無い対応先が 400、他の利用者の行が見つからない扱いになることを確かめ、いずれも通る。 |
| O7 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: POST /api/transactions/bulk を拡張し、一括指定と各明細の下書きを受け取る。サーバは明細を引き直し、core の解決関数で、未整理の明細は 一括指定→下書き→提案、確定済みの明細は 一括指定→下書き→今の値 の順に値を決める。区分に合うカテゴリの組がどこにも無い明細は、明細の編集の大項目の欄に『カテゴリなし』の予約の値を入れて保存する (『カテゴリなし』のための表と列は足さない。qa-classify-bulk-decision-045)。予約の値は core の 1 か所で定め、一括指定と編集の値としては受け付けない (qa-classify-bulk-decision-048)。値を決められない明細と、区分とカテゴリの組が候補に合わない明細は、明細単位の失敗として返す (画面は保存前に外すので、通常は届かない)。書き込みは json_each で束ねた 1 回の batch で行い (qa-classify-bulk-delegated-001)、batch が失敗したら要求を 2xx で返して保存対象の全件を write_failed にする (qa-classify-bulk-decision-057)。同じ要求を送り直しても、明細の値 (更新時刻を除く)・提案との一致 (done か manual か)・月次集計・履歴は 1 回目の後と変わらない。書き込む前に予算 (1 回の batch の文 50 本・束ねた JSON 2MB) を超えると分かった要求は、明細ごとの結果を持たない 413 で返す。
- **I3**: 選択中の行の key (最大 50 件、利用者ごとに分離) を受けて、表示外の明細も含めて一覧の行の形で返す読み出し API を追加し、一覧の応答から絞り込み後の全件を外す。
- **I8**: 勘定科目の対応表の表を migration で足し、既存の利用者に初期の 5 行を入れ、新しい利用者の作成時にも入れる。読み出し・追加・削除の API と設定画面の編集を足し、変更を設定の変更履歴に残す (変更履歴の種類の制約は表の作り直しで改め、PR で承認する)。設定の JSON (kanjo-settings) とバックアップ・復元に勘定科目の対応表を加える。

### 本章に効く確定意思決定

- **decision-005-d1-query-budget**: 一括保存の 1 要求が、Cloudflare 無料プランの「1 起動あたり合計 50 クエリ」を超えます（50 件で 200 本超）。どう解きますか？
  - 採択: 書き込みを束ねる (`bundle-writes`)
  - 目的適合: 明細ごとの編集と履歴を json_each で 1 文ずつに束ね、1 要求は明細数によらず約 25 本になる。選択 50 件も一括 100 件も 1 回で保存でき (G1・G5)、上限と無料プランはそのまま (C4)。
  - 採択の接地根拠: `qa-classify-bulk-decision-033`

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を、新しく足す選択の読み出し API と勘定科目の対応表の読み出し・追加・削除の API の置き場所に適用した。経路を authGuard と mustChangePasswordFence の配下の /api/* に置き、ハンドラは authGuard が決めた userId を読むだけで、利用者の判定を経路の中で書き直さない。明細を引く 2 つの経路 (行の key で受ける選択の読み出しと、txId で受ける一括保存) と勘定科目の対応表の読み書きは、どれも userId を検索条件に含めるので、他の利用者の明細と対応表の行は結果に現れない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-10-01T10:34:37Z)

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
| owasp-api-bola | API Security Top 10 2023 (API1:2023) | OWASP Foundation (api-security.owasp.org) | https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization | 2026-09-30T07:58:03Z | 2026-09-30T07:58:03Z |
