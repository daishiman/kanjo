---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G3, G4]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-security-web-trends-observed-003。裏付け質疑 (`qa_refs`): `qa-trends-decision-002`, `qa-trends-decision-004`, `qa-trends-decision-011`, `qa-target-platforms-trends-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、推移画面の本カテゴリでは端末内に保存した明細と取引先名の暗号化とアプリ配布経路の保護を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、推移画面の本カテゴリでは端末内に保存した明細と取引先名の暗号化とアプリ配布経路の保護を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、推移画面の本カテゴリでは端末内に保存した明細と取引先名の暗号化とアプリ配布経路の保護を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、推移画面の本カテゴリでは端末内に保存した明細と取引先名の暗号化とアプリ配布経路の保護を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、推移画面の本カテゴリでは端末内に保存した明細と取引先名の暗号化とアプリ配布経路の保護を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-foundation-trends-001`

2026-09-16T09:27:37Z (回答直後の date -u 実測、選択時刻の上限値) 利用者が AskUserQuestion で推移画面サイクルの foundation (U1・G1-G5・対象外・制約) を『この内容で承認』と回答。先行する利用者決定 (2026-09-16T09:16:35Z / 09:19:14Z): 手を打つ順番=開閉式で残す、要因の説明=規則で自動生成、汎用性=指標を登録制、明細への導線=/classify に絞込を足す、期間タブ=全体の期間選択を操作、前期間=直前の同じ長さ、初期の月=最も変化が大きい月。

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 未登録の metric だけ 400 で止め、scope・compare・month は既定値へ倒す。payee は完全一致の比較にだけ使い、SQL と HTML へ渡さない。読取専用のため監査ログの対象の書込は増えない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4

#### 主たる接地根拠: `qa-security-web-trends-observed-003`

**問**

推移の拡張でセキュリティ上気を付けることは何ですか?

**答**

新しいクエリ (scope・metric・compare・month、/classify の category・payee) はすべて許可値の列挙または YYYY-MM 形式で検証する。qa-trends-decision-011 に従い、形式違反の month・未知の scope/compare は既定値へ倒し、未登録の metric だけ 400 invalid_metric を返す。指標 id は登録済み定義の辞書で引き、任意の関数名やキーを評価しない。payee は取得後の配列で完全一致の比較にだけ使い、SQL へ連結しない。取引先の文字列は React のテキストとして描画し innerHTML を使わない。CSP は index.ts の secureHeaders (script-src 'self'、frame-ancestors 'none') のまま。説明文は規則で作り外部の AI や API へ明細を送らない。変更は読取専用で canonicalMutationFence と監査ログの対象になる書込は増えない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: R4-reopen (2026-09-16T09:55:09Z、数値の出所の利用者決定の反映) の後に既存コードを読み直した再観測 (worktree 07推移画面改善、origin/main 9da407b。packages/api/src/routes/analytics.ts の loadScoped / loadReviewSources、packages/core/src/total-cashflow.ts の totalCashflowReport、packages/web/src/pages/analysis/TotalCashflow.tsx)。answered_at は読解直後に date -u で実測した時刻。 / 回答時刻: 2026-09-16T09:55:39Z)

#### 裏付け質疑: `qa-trends-decision-002`

**問**

画像の増減要因の説明文(例『春のキャンペーンに伴う広告出稿の増加』)は、何から作りますか?選択肢: (A) 規則で自動生成 (推奨) / (B) 利用者がメモを書く / (C) AI で生成。

**答**

(A) 規則で自動生成 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:16:35Z)

#### 裏付け質疑: `qa-trends-decision-004`

**問**

『該当明細を開く』と、カテゴリ行→取引先の内訳はどこまで作りますか?選択肢: (A) 明細画面 /classify に category・取引先(明細の内容)の絞込クエリを足す。取引先は名寄せなし (推奨) / (B) 月だけで開く / (C) 取引先の名寄せ規則も作る。

**答**

(A) 明細画面に絞込を足す を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:16:35Z)

#### 裏付け質疑: `qa-trends-decision-011`

**問**

推移 API と明細画面のクエリの誤りと取引先の絞込はどう扱いますか?選択肢: (A) 形式違反の month などは既定値へ倒し、400 は未登録の metric (invalid_metric) だけにする。取引先は専用の payee クエリで完全一致で絞る (推奨) / (B) 形式違反はすべて 400 にし、取引先は既存の検索 q に入れて部分一致で絞る。

**答**

(A) 既定値へ倒す+専用 payee を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の decision_guidance 指摘を受けた追加質問)。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T09:50:42Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:50:42Z)

#### 裏付け質疑: `qa-target-platforms-trends-001`

**問**

推移画面サイクルの対象プラットフォームはどれですか? foundation の対象外に『web 以外の platform (専用アプリ)』を含めた案を提示し、承認を求めた。

**答**

foundation を『この内容で承認』と回答した。対象は web のみ (狭幅は既存 web のレスポンシブ表示で扱う)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で foundation 全体 (scope.out に web 以外を含む) を承認した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:27:37Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 推移に必要な集計を packages/core の純関数と API に置く。数値は総収支と同じ取引集合 (freee 取引と MF 明細を消し込んだ後、totalCashflowReport と同じ数え方) から数え、総合・事業・家計の値を概況と総収支画面に一致させる。範囲 (総合/事業/家計)・指標・比較対象 (前期間=直前の同じ長さ / 前年=前年の同じ月範囲) を受け取り、今回と比較期間の月次系列、月次差、KPI (現在値・増減額と率・最も変化が大きい月)、選択月の詳細 (各指標の値・増減要因 上位 3・出典の口座)、カテゴリ別の行 (直近 12 か月の系列・今回・比較・増減額・増減率・構成比・寄与度。カテゴリは MF 由来が大項目、freee 由来が勘定科目)、カテゴリ内の取引先別の行、パレート (増減額の降順と累計構成比) を返す。期間は既存の Dataset を切る設計 (sliceDataset) に従い、比較期間のデータは同じ方法で切り出す。全期間を選んだときは比較期間を作らず、KPI の増減は最も変化が大きい月の前月差で出す。要確認の MF 明細は総収支と同じく事業にも家計にも数えず、期間と選択月の要確認の件数と金額 (totalCashflowReport の月次 reviewCount・reviewAmount) を返す。開閉で残す傾向の判定は現行どおり MF 明細だけから trendsReport で計算し、どの基準で数えたかを返却に含める。
- **G4**: 推移から根拠の明細へ辿れるようにする。MF 由来の行の『該当明細を開く』『増減の明細を確認』は /classify へ月・範囲に加えてカテゴリと取引先 (専用の payee クエリ、明細の内容と完全一致、名寄せなし) の絞込クエリを渡して開き、明細画面はその絞込で表示する。freee 由来の行は MF 明細の画面に無いため、全体の期間選択を保ったまま総収支画面 (/analysis/total-cashflow) を開く。期間タブは全体の期間選択 (usePeriod) を操作し、範囲・指標・比較対象・選択月・選択カテゴリは URL に保持して再読込と共有で同じ表示に戻る。URL の値が形式違反なら既定値へ倒して画面を出す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 範囲・指標・比較対象の切替で KPI・チャート・表・パレートが同じ条件の値に切り替わる。 | core テストで 3 指標×3 範囲×2 比較対象の組合せについて、総合=事業+家計、純収支=収入-支出、カテゴリ行の今回合計の和=指標の期間合計、寄与度の和=100% (増減 0 を除く) が成り立つ。 |
| O4 | 選択した月・カテゴリ・取引先から絞り込んだ明細へ遷移できる。 | DOM テストで MF 由来の行の遷移先 URL (/classify の month・cls・category・payee) が正しく、/classify がそのクエリで該当明細だけを表示する。freee 由来の行は /analysis/total-cashflow へ遷移する。URL の条件から推移の表示が復元され、形式違反の値は既定値で表示される。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 推移タブの上部に期間タブ (1年/2年/3年/任意) と期間表示を置き、全体の期間選択と同期させる。
- **I3**: KPI 3 枚: 現在の値 (期間合計)、前期間 (または前年) からの増減の額と率、最も変化が大きい月とその増減と主な要因の一文。KPI の値は要確認の明細を含まない値である (帯の注記と対応する)。
- **I4**: 推移チャート: 収入・支出・純収支の今回の折れ線と、選んだ指標の比較期間の点線、月次差の棒、選択月の縦帯。月をクリックで選択月を変える。
- **I5**: 詳細パネル: 選択月の収入・支出・純収支と比較期間の値、主な増減要因 上位 3 (カテゴリ・増減額・説明文)、データの出典 (口座名と件数)、該当明細を開くボタン。選択月に要確認の明細があればその件数と金額も出す。freee 由来の行で口座が空のものは口座名を『—』と表示し、口座別の件数には数えない。
- **I6**: カテゴリ別の推移と増減の表: 12 か月のスパークライン・今回合計・比較期間・増減額・増減率・構成比・寄与度。行を開くと取引先別の同じ列の内訳を出す。
- **I7**: 増減の要因のパレート図 (増減額の棒と累計構成比の折れ線) と、増減が大きい項目の上位 3 のカード。
- **I8**: 下部の選択バー: 選択中の月とカテゴリ (取引先) と増減額・率を出し、『増減の明細を確認』で絞込済みの明細へ遷移する。
- **I10**: /classify にカテゴリ・取引先の絞込クエリを追加する。

### 本章に効く確定意思決定

- **dec-trends-datasource-001**: 推移の数値をどの取引集合から数えるか (総収支と同じ freee+MF の消し込み後か、MF 明細だけか)
  - 採択: 総収支と同じ取引集合 (totalCashflowReport) (`opt-total-cashflow`)
  - 目的適合: G3 の『概況・総収支と一致する値』を満たし、事業費・事業収入を freee 側から数えるため事業の推移が会計と合う。
- **dec-trends-review-rows-001**: 推移の数値に要確認の MF 明細をどう扱うか (含めず件数を表示するか、公私仕分けで仮に数えるか)
  - 採択: 含めず件数と金額を注記する (`opt-exclude-with-note`)
  - 目的適合: G3 の『総収支と一致する値』を保ったまま、G1 の画面上で欠けている量を見せられる。
- **dec-trends-judgement-source-001**: 開閉で残す傾向の判定を MF 明細のまま計算するか、総収支と同じ取引集合へ移すか
  - 採択: MF 明細のまま計算し、基準を見出しに明記する (`opt-keep-mf-with-label`)
  - 目的適合: C4 (既存の傾向判定の値とテストを壊さない) を満たし、G5 の規則の固定も既存テストで続けられる。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design の『入力は許可リストで検証し、失敗は安全側へ倒す』を適用した。scope・compare・month は既定値へ倒し、評価の入口になる metric だけ 400 で止める。payee は取得後の配列の完全一致比較にだけ使い、SQL・HTML・関数名のどれにも渡さない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-16T09:55:39Z)

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
| owasp-asvs | 5.0.0 | OWASP Foundation (owasp.org) | https://owasp.org/www-project-asvs/ | 2026-09-16T09:31:19Z | 2026-09-16T09:31:19Z |
