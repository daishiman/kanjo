---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G4, G5]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-maintenance-ops-web-tc-observed-001。裏付け質疑 (`qa_refs`): `qa-total-cashflow-decision-007`, `qa-total-cashflow-decision-010`, `qa-total-cashflow-decision-012`, `qa-total-cashflow-decision-013`, `qa-total-cashflow-decision-014`, `qa-total-cashflow-decision-015`, `qa-total-cashflow-decision-016`, `qa-total-cashflow-decision-017`, `qa-total-cashflow-decision-018`, `qa-backend-web-tc-inference-006`, `qa-database-web-tc-inference-006`, `qa-infrastructure-web-tc-observed-002`, `qa-infrastructure-web-tc-observed-003`, `qa-infrastructure-web-tc-observed-004` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではアプリ版ごとの回帰確認とストア配布の更新手順を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではアプリ版ごとの回帰確認とストア配布の更新手順を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではアプリ版ごとの回帰確認とストア配布の更新手順を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではアプリ版ごとの回帰確認とストア配布の更新手順を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではアプリ版ごとの回帰確認とストア配布の更新手順を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 保守運用を、判定規則の docs とテストを同じ変更で更新する手順と、取消できない誤操作が起きた場合に操作履歴から前後の値を確認できることに反映した。文言変更は e2e の期待値と同時に直す。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5

#### 主たる接地根拠: `qa-maintenance-ops-web-tc-observed-001`

**問**

総収支画面の改修後の検証と保守の手順 (回帰確認・規則の維持・migration の運用) はどうなるか。

**答**

ルート package.json の verify:full (pnpm test → typecheck → lint → build → web の check:thead / check:mobile-layout / check:financial-figure / check:financial-routes / check:analysis-hub → preview:smoke) と design-system:fast がある。lint は biome・check-design-tokens・check-design-system-document-contract 等を束ね、CI (ci.yml) が lint/typecheck/test/build を実行する。本サイクルでは、一致度・判定作業の 3 区分・完全一致の扱い・前期比の null 規則を docs に明記し core テストの境界値で固定する。消し込みの不変条件は packages/core/test/total-cashflow-contract.test.ts、判定の保存は packages/api/test/total-cashflow-verdict.integration.test.ts、画面は packages/web/test/total-cashflow-table.dom.test.tsx が既に検査しており、これらを緑のまま拡張する。migration は追加のみで、既存除外の reason が memo へ移ることを統合テストで確かめる。check:financial-routes / check:mobile-layout の対象に /analysis/total-cashflow が含まれるかを確認し、無ければ追加して狭幅の横スクロールを検査する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD 1b16825) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: package.json, packages/web/package.json, .github/workflows/ci.yml, packages/core/test/total-cashflow-contract.test.ts, packages/api/test/total-cashflow-verdict.integration.test.ts, packages/web/test/total-cashflow-table.dom.test.tsx。 / 回答時刻: 2026-09-15T12:00:44Z)

#### 裏付け質疑: `qa-total-cashflow-decision-007`

**問**

判定作業に出す『一致度』はどう扱うか。選択肢: 規則で算出して表示 (金額・日付差・口座・摘要の配点で 0〜100、% と内訳を出し docs とテストで固定) / 数値は出さない (判定材料を文字で並べるだけ)。

**答**

規則で算出して表示する。含意: 確率ではなく配点の合計であることを内訳で示す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: C06 ヒアリング監査が qa-total-cashflow-decision-005 を『複数論点を 1 問に束ねた誘導質問』(R6 観点 c) と判定したため、R3-reask で論点を 1 問 1 論点に分けて再質問した。 利用者は AskUserQuestion の 2 択 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T12:19:17Z)

#### 裏付け質疑: `qa-total-cashflow-decision-010`

**問**

共通ヘッダーとフッターの文言をどうするか (現状『防衛線』『毎晩バックアップ(30日保持)』/ 画像『防衛ライン: 正常』『毎朝バックアップ』)。選択肢: 画像に揃える (全画面の共通シェルが変わる・『毎朝』が cron 時刻と合うかも扱う) / 現状のまま (総収支の本体だけを対象にする)。

**答**

画像に揃える。含意: 全画面の共通シェルの文言が変わる。cron は UTC 18 時 (日本時間 3 時) なので『毎朝』と矛盾しないことを実装時に確かめ、保持期間の表示を落とすかは画像に合わせる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: C06 ヒアリング監査が qa-total-cashflow-decision-005 を『複数論点を 1 問に束ねた誘導質問』(R6 観点 c) と判定したため、R3-reask で論点を 1 問 1 論点に分けて再質問した。 利用者は AskUserQuestion の 2 択 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T12:22:21Z)

#### 裏付け質疑: `qa-total-cashflow-decision-012`

**問**

完全一致候補一覧 (自動で寄せた組) に出す一致度はどうするか。自動で寄せる条件は日付と金額の一致だけで摘要を見ないため、配点どおりに計算すると 78〜100% に散る。選択肢: 規則どおり計算して表示 (摘要や口座の差が数字で見える・画像の『一致度 100%』と合わない場合があり一覧名を改める必要がある) / 自動で寄せた組は常に 100% (画像どおり・摘要が違う組も 100% と出て内訳を出さない)。

**答**

規則どおり計算して表示。含意: 一覧の一致度は 78〜100% の値をそのまま出し、配点の内訳も見せる。画像の説明文『金額・日付・内容が完全一致する取引の候補です』は事実と合わなくなるので、一覧名と説明文を『日付と金額が一致して自動で寄せた組』の意味に改める。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の再評価が、アシスタント推定 qa-backend-web-tc-inference-004 で利用者に見える規則が一意に決まっていない (どちらで実装してもテストが通る) と medium 指摘したため、R3-reask で 1 問 1 論点に分けて質問した。利用者は AskUserQuestion の 2 択 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T13:10:17Z)

#### 裏付け質疑: `qa-total-cashflow-decision-013`

**問**

『元に戻す』を続けて押したときの動きはどうするか (取り消した操作も履歴に 1 件残る)。選択肢: 1 つ前の操作へ遡る (押すたびに未取消の操作を新しい順に戻す・取消のやり直しは無い) / 直前の 1 回だけ戻せる (取消後はボタンを消す・2 つ以上前は戻せない)。

**答**

1 つ前の操作へ遡る。含意: 取消そのものは取消の対象にならず、押すたびに未取消の書込み操作を新しい順に 1 つずつ戻す。取り消した取消をやり直す手段は作らない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の再評価が、アシスタント推定 qa-backend-web-tc-inference-004 で利用者に見える規則が一意に決まっていない (どちらで実装してもテストが通る) と medium 指摘したため、R3-reask で 1 問 1 論点に分けて質問した。利用者は AskUserQuestion の 2 択 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T13:10:17Z)

#### 裏付け質疑: `qa-total-cashflow-decision-014`

**問**

freee 取引を『集計から除外』したとき、対応する MF 明細の事業/家計はどう数えるか。現行 core は freee 取引を総額から外し、MF 明細を公私仕分けの判定で数えるため、事業費だった取引が家計へ移ることがある。選択肢: MF の公私仕分けに従う (現行のまま・二重計上は消える・公私仕分けが家計の明細は事業費から家計支出へ移る) / 除外した freee の事業/家計を引き継ぐ (事業費の額が動かない・core に引継ぎ規則とテストが増え公私仕分けと食い違う明細が生じる)。

**答**

MF の公私仕分けに従う。含意: 除外後の MF 明細は公私仕分け (resolveTx) の結果で事業か家計に数え、除外の前後で事業と家計の内訳が入れ替わることがある。core の集計規則は変えず、この入れ替わりを境界テストで固定する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の再評価が、アシスタント推定 qa-backend-web-tc-inference-004 で利用者に見える規則が一意に決まっていない (どちらで実装してもテストが通る) と medium 指摘したため、R3-reask で 1 問 1 論点に分けて質問した。利用者は AskUserQuestion の 2 択 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T13:10:17Z)

#### 裏付け質疑: `qa-total-cashflow-decision-015`

**問**

freee 取引を『集計から除外』したとき、月ずれ (取込月と表示日の月が違う) などで要確認に止まっている MF 明細はどう扱うか (現行 core は、候補が 0 件になっても要確認に残し、総額に入れない)。選択肢: 要確認に残す (現行 core のまま・確認文に『月ずれ等の明細は要確認に残り集計に入らない』と書く・総額の意味は変わらないが除外しても総額が動かないことがある) / 唯一の候補なら集計へ (除外した freee が唯一の候補だった明細は要確認から出し公私仕分けで事業/家計に数える・除外で総額が動くが core に規則とテストが増え月ずれの確認を飛ばすことになる)。

**答**

唯一の候補なら集計へ。含意: 除外した freee 取引がその明細の唯一の候補だったとき、明細は要確認から出て公私仕分けで事業か家計に数えられ、総額が動く。候補がもともと無い明細や、他にも候補がある明細は要確認に残る。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の 3 回目の評価が medium を 3 件指摘した (除外後の数え方が core と食い違う・上位概念が改名に追随していない・取消が冪等でない)。そのうち利用者に見える規則の 2 件と、上位概念の語の変更の承認を、R3-reask で 1 問 1 論点に分けて質問した。利用者は AskUserQuestion の選択肢 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T13:41:26Z)

#### 裏付け質疑: `qa-total-cashflow-decision-016`

**問**

一致度が 78〜100% に散るため、画像の『完全一致候補』『金額・日付・内容が完全一致する…』の文言を『自動一致の候補』『日付と金額が一致して自動で寄せた取引です』に改める。画像の文言から外れるこの変更を、上位概念 (目標 G1/G3/G5・成果 O1/O5 など) にも反映してよいか。選択肢: 改名を承認 (上位概念と画面の文言を『自動一致の候補』に揃える・画像と文言が違うが表示される一致度と説明が矛盾しない) / 画像の文言を残す (見出しは『完全一致候補』のまま説明文だけ事実に合わせる・78% の組が『完全一致』の見出しの下に並ぶ)。

**答**

改名を承認。含意: 上位概念・画面・docs の語を『自動一致の候補』と『日付と金額の一致による自動寄せ』に揃え、画像の『完全一致候補』の文言からは外れる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の 3 回目の評価が medium を 3 件指摘した (除外後の数え方が core と食い違う・上位概念が改名に追随していない・取消が冪等でない)。そのうち利用者に見える規則の 2 件と、上位概念の語の変更の承認を、R3-reask で 1 問 1 論点に分けて質問した。利用者は AskUserQuestion の選択肢 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T13:41:26Z)

#### 裏付け質疑: `qa-total-cashflow-decision-017`

**問**

『元に戻す』はどこまで遡れるようにするか (操作履歴は無期限に残る設計)。選択肢: その画面を開いている間 (画面を開いてから行った操作だけを遡れる・再読込すると取消できない・古い判定を誤って戻す危険が小さい) / 上限なし (未取消の操作が残る限り何日前でも遡れる・押し続けると数か月前の判定まで戻る) / 当日の操作だけ (同じ日 (JST) の操作だけ・再読込後も戻せるが日をまたぐと取消できない)。

**答**

その画面を開いている間。含意: 取り消せるのは総収支の画面を開いてから行った操作だけで、再読込や画面の移動の後は取消の導線を出さない。操作履歴そのものは残る。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の 3 回目の評価が medium を 3 件指摘した (除外後の数え方が core と食い違う・上位概念が改名に追随していない・取消が冪等でない)。そのうち利用者に見える規則の 2 件と、上位概念の語の変更の承認を、R3-reask で 1 問 1 論点に分けて質問した。利用者は AskUserQuestion の選択肢 (推奨ラベルなし・両案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T13:41:26Z)

#### 裏付け質疑: `qa-total-cashflow-decision-018`

**問**

毎日のバックアップは表を列挙して作っており、総収支の判定 (duplicate_verdicts)・freee 除外 (freee_deal_exclusions)・新しい操作履歴の 3 表は入っていない。バックアップから復元したとき、これらをどうするか (前例: 月次クローズの『後で確認』と月次レビューは、復元で失わないよう後からバックアップに加えた)。選択肢: 3 表をバックアップに加える (復元しても判定・除外理由・操作履歴が戻る・backup の SQL と payload と復元テストに 3 表ぶんの追加が要りバックアップが少し大きくなる) / 判定と除外だけ加える (総額に効く判定と除外理由は戻る・操作履歴は復元されず復元直後は取消の記録が無い) / 加えない (現行のまま・復元すると判定と除外がやり直しになり総額が復元前と変わりうる)。

**答**

3 表をバックアップに加える。含意: 復元すると判定・除外理由とメモ・操作履歴が復元時点の状態に戻り、総額も復元前の判断を反映したものになる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 完成度評価 (C05) の 4 回目の評価が、判定・除外・操作履歴をバックアップに入れない方針がアシスタント推定だけで確定しており、PR #51 (0040) の前例と逆の判断になっていると medium 指摘したため、R3-reask で質問した。利用者は AskUserQuestion の 3 択 (推奨ラベルなし・各案の利点と代償を併記) から選んだ。利用者の意思決定行為はこの選択だけであり、question の選択肢説明と answer の含意の文はアシスタントが書いた。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-15T14:03:31Z)

#### 裏付け質疑: `qa-backend-web-tc-inference-006`

**問**

利用者決定 qa-total-cashflow-decision-015 (唯一の候補を除外した明細は集計へ) と -017 (取消は画面を開いている間) を受けて、qa-backend-web-tc-inference-005 の除外後の数え方と取消の規則をどう改めるか。取消の二重送信・古い表示からの取消で利用者が見ていない操作を戻さないために、取消の要求をどう設計するか (005 を置き換える)。

**答**

一致度 (0〜100 の整数) = 金額 40 (同額・同じ向きのときだけ候補になるので候補は常に 40) + 日付 30/20/10/5/0 (dayGap の絶対値 0/1/2/3/4 以上) + 口座 15/8/0 (一致/片側の情報なし/accountsConflict) + 摘要 15/8/0 (normalizeInstitution と同じ正規化の後に MF content と freee partner が一致/一方が他方を含む/それ以外)。満点は 100。判定作業の 3 区分: 『重複候補』は review のうち候補がちょうど 1 件で理由が『発生日が一致しません』または『取込月と表示日の月が一致しません』のもの (1 対 1 で同じ/別を決められる)。『要確認』は残りの review (候補 0 件・2 件以上・『口座不一致』・『対応する freee 取引が他の明細へ寄せられています』)。『freee除外』は excluded。3 区分の和は review 件数 + excluded 件数に一致する。自動一致の一覧は matched のうち by=auto の組で、自動で寄せる条件は発生日一致かつ金額一致だけなので一致度は 78〜100 の値になり、これを規則どおりそのまま出す (100 に丸めない。qa-total-cashflow-decision-012)。各組に判定状態 (same 記録があれば『同じ』、無ければ『未判定』) を付ける。『同じ取引にする』は same を記録するだけで matched の集合と総額は変わらない。セグメント: 総合=事業+家計 (months の bizIncome+householdIncome=totalIncome 等) の期間合計と月次系列。除外後の数え方: freee 取引を除外すると、その freee 取引は総額から外れ、対応していた MF 明細は公私仕分け (resolveTx) の結果で事業か家計に数える。除外の前後で事業と家計の内訳が入れ替わることがある (qa-total-cashflow-decision-014)。要確認に残る明細のうち、除外を考えずに引いた候補がちょうど 1 件で、その freee 取引が除外されているものは、理由 (月ずれ・発生日不一致・口座不一致・他の明細へ寄せられている) にかかわらず review から出して resolveTx で数える。もともと候補の無い明細と、除外を考えない候補が 2 件以上ある明細は review に残る (qa-total-cashflow-decision-015)。これは core の review 判定 (total-cashflow.ts の review 生成) に 1 条件を足す変更で、除外を集計へ戻すと明細は review へ戻る。前年同期比: core に previousYearPeriod(range) を足し、選択期間の開始月と終了月をそれぞれ 12 か月前へずらした期間を返す (例 2026-04〜2026-06 → 2025-04〜2025-06)。analysis-hub の previousPeriod (直前の同じ長さ) は変えず名前も分ける。前年同期間の全ての月がデータ範囲にあるときだけ前年値を出し、1 か月でも欠ければ null (画面は『比較データなし』)。差額 = 当期 − 前年値、率 = 差額 / |前年値| で前年値が 0 のとき率は null。ラベルは『前年同期』。判定進捗『N件中M件』は表示中区分の対象件数 N と、その中で verdict または除外を記録済みの件数 M。取消: 画面が取り消したい操作の id を送り、その id が kind が undo でなく undone_at が空の書込み操作のうち最新の 1 操作と一致するときだけ、記録した操作前の値へ戻す (一括は 1 操作に複数件)。一致しなければ何も変えず 409 を返す。同じ id の再送・通信の再試行・別タブの古い表示からの送信が、利用者の見ていない 1 つ前の操作を戻さないためである。取消した操作は undone_at を持ち、取消そのものも kind=undo の履歴 1 件 (undoes_id に対象) として残るが、undo の行は次の取消の対象にならないので、画面が自分の操作 id を新しい順に送れば 1 つ前の操作へ遡る。取消のやり直しは無い (qa-total-cashflow-decision-013)。取り消せる範囲はその画面を開いてから行った操作で、画面が保持する操作 id の列で決まる。サーバは古さの上限を持たず、最新の未取消操作との一致だけを見る (qa-total-cashflow-decision-017)。取消後の総収入・総支出・判定件数は操作前と一致する。本記録は qa-backend-web-tc-inference-005 を置き換え (005 は 003 と 004 を置き換えていた)、以後 003・004・005 は根拠に使わない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントが 2026-09-15 に、qa-backend-web-tc-inference-005 の本文を基に、利用者決定 qa-total-cashflow-decision-015/017 と、完成度評価 (C05) の medium 指摘『取消 API が id を受け取らず二重押下で 1 つ前まで戻る』を反映した推測。packages/core/src/total-cashflow.ts の review 生成 (monthMismatched と blocked の理由は候補数に関係なく review に入り、nearCandidates は除外済みの freee を候補から外す) を読んで条件を決めた。『除外を考えずに引いた候補がちょうど 1 件』という判定方法・409 の条件付き取消・id を送る契約は利用者の明示選択ではない (唯一の候補なら集計へ、取消は画面を開いている間、の 2 点は利用者決定)。 / 回答時刻: 2026-09-15T13:44:10Z)

#### 裏付け質疑: `qa-database-web-tc-inference-006`

**問**

バックアップと復元に 3 表を加えるときの変更箇所を前例の全体 (qa-infrastructure-web-tc-observed-003/004) で数え直し、取消 batch の照合と実行のすき間に別の操作が入った場合も含めてどう条件付けるか (qa-database-web-tc-inference-005 を置き換える)。

**答**

migration 0041 (番号は取込時点の main の最新 +1 で確定する) で freee_deal_exclusions に reason_code TEXT NOT NULL DEFAULT 'other' (CHECK で transfer/internal/book_only/duplicate/other の 5 値) と memo TEXT を追加し、既存行は memo = reason、reason_code = 'other' に移す。reason 列は後方互換のため残し、書込時は memo を正本として同じ値を入れる (旧 Worker が読んでも壊れない)。画面の表示語は 振替/内部移動/帳簿のみ/二重登録/その他。操作履歴は total_cashflow_operations (id TEXT PRIMARY KEY、user_id TEXT NOT NULL、kind TEXT NOT NULL CHECK (verdict/exclude/restore/undo)、items_json TEXT NOT NULL (対象ごとの操作前後の値。判定なら txId・before verdict/freeeKey・after、除外なら freeeKey・before 行の有無と reason_code/memo・after。自由文は取消に要る memo だけを持つ)、item_count INTEGER NOT NULL、undoes_id TEXT NULL、undone_at TEXT NULL、created_at TEXT NOT NULL) を新設し、索引 (user_id, created_at DESC)。取消は、指定された id が user_id の一致する kind <> 'undo' かつ undone_at IS NULL の行のうち最新 (created_at の降順、同時刻は id の降順) の 1 行と一致するときだけ行う。他人の id や存在しない id は 404、一致しない id (再送・古い表示) は書き込まず 409 とする。照合の後に、対象の値の復元 → kind=undo (undoes_id=対象 id) の行の追加 → 対象行の undone_at の更新 の順に並べた文を 1 つの D1 batch で行う。3 種の文は全て同じ条件『対象行が存在し undone_at IS NULL で、かつ対象より新しい kind <> 'undo' の未取消行が同じ user_id に無い (NOT EXISTS)』を持つ条件付き文にする。値の復元は、操作前に行が無かったものは DELETE … WHERE EXISTS、有ったものは INSERT … SELECT … WHERE EXISTS … ON CONFLICT DO UPDATE で操作前の値に戻す。undo 行は INSERT … SELECT … WHERE EXISTS、最後に UPDATE … SET undone_at WHERE id = ? AND undone_at IS NULL AND NOT EXISTS (より新しい未取消行)。照合と batch の間に同じ id の 2 回目や別タブの新しい操作が割り込んだときは全ての文が 0 行になる。route は undone_at の更新件数が 0 なら 409 を返す。undo の行は対象にならないので、画面が自分の操作 id を新しい順に送ると 1 つ前の操作へ遡り、やり直しの経路は持たない。取消できる範囲 (画面を開いている間) は画面が持つ id の列で決まり、D1 側は古さの上限を持たない (qa-total-cashflow-decision-017)。書込 1 操作 = 判定/除外の更新と履歴 1 行を D1 batch で同時に行い、片方だけ残らないようにする。items_json は 1 操作最大 200 件で、D1_MAX_BOUND_PARAMS に合わせて分割する。保持は無期限で、利用者の判断記録のみ (集計値は保存しない dec-aggregation-strategy-001 と矛盾しない)。毎日のバックアップは表を列挙して組み立てており判定・除外・操作履歴を含まない (qa-infrastructure-web-tc-observed-002) ので、duplicate_verdicts・freee_deal_exclusions・total_cashflow_operations の 3 表を、0040 の前例 (qa-infrastructure-web-tc-observed-003/004) が触れた全ての箇所に加える (qa-total-cashflow-decision-018): JSON_SNAPSHOT_MUTATION_CONSUMERS、復元 write-set の DELETE と insertJsonRows、スナップショット SQL の行と件数、canonical-mutation-fence の consumers、routes/imports.ts の復元 payload の zod 検証と受け渡しと件数 (key は duplicateVerdicts・freeeDealExclusions・totalCashflowOperations)、書込み route からの invalidateJsonSnapshotQuery、schema-guard の EXPECTED_D1_MIGRATION。旧バックアップに key が無いときは前例と同じく null として既存の行を残し、key があれば空配列でもその集合で置き換え、形が不正なら復元全体を拒む。復元は 3 表を user_id 単位で入れ替え、復元前の操作履歴の行も復元時点のものに置き換わる。取消は画面を開いている間だけなので、復元の前に持っていた操作 id の列は再読込で消え、復元後に古い id で取り消すことは無い。本記録は qa-database-web-tc-inference-005 を置き換え (005 は 004 を、004 は 003 を、003 は 002 を置き換えていた)、以後 002〜005 は根拠に使わない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントが 2026-09-15 に、qa-database-web-tc-inference-005 の本文を基に、観測 qa-infrastructure-web-tc-observed-004 で数え直した変更箇所と、完成度評価 (C05) 5 回目の low 指摘 (照合と batch のすき間に別の操作が入る場合・復元文の形) を反映した推測。NOT EXISTS の条件・DELETE と UPSERT による復元・旧バックアップで既存の行を残す扱いは利用者の明示選択ではない (3 表をバックアップに加えることは利用者決定 qa-total-cashflow-decision-018)。 / 回答時刻: 2026-09-15T14:26:23Z)

#### 裏付け質疑: `qa-infrastructure-web-tc-observed-002`

**問**

毎日のバックアップ (nightly_backup) は総収支の判定・除外・新しい操作履歴の表を含むか。

**答**

含まない。バックアップの payload は packages/api/src/store.ts の loadBackupPayload が BACKUP_SNAPSHOT_SQL で表を 1 つずつ列挙して組み立てる (sqlite_master の走査ではない)。列挙に入るのは baseline・freee_deals・MF 明細・sub_vendor_exclusions・現金・review_snoozes・monthly_close_reviews など (0040 の保留と月次レビューは『復元で失うと片付けた未処理が戻る』として後から足された)。duplicate_verdicts と freee_deal_exclusions は列挙に無く、新設する total_cashflow_operations も足さない限り入らない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD 1b16825) の packages/api/src/store.ts (BACKUP_SNAPSHOT_SQL・loadBackupPayload) と packages/api/src/index.ts (nightlyBackup) を読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 / 回答時刻: 2026-09-15T13:12:17Z)

#### 裏付け質疑: `qa-infrastructure-web-tc-observed-003`

**問**

既存の表をバックアップと復元の対象に加えるとき、コードのどこに手が入るか (0040 で review_snoozes と monthly_close_reviews を加えた前例)。

**答**

0040 の前例では 4 箇所に同じ表が並んでいる。(1) packages/api/src/import-active.ts の JSON_SNAPSHOT_MUTATION_CONSUMERS (復元の write-set を変える表の列挙。コメント『変えると復元後の未処理件数とクローズ状況が変わる』)。(2) packages/api/src/import-lifecycle.ts の復元 write-set (宛先が空でなければ DELETE FROM <表> WHERE user_id=? の後に insertJsonRows で行を入れ直す)。(3) packages/api/src/store.ts のスナップショット SQL (行の読出しと review_counts の件数)。(4) packages/api/src/canonical-mutation-fence.ts の書込み route ごとの consumers (PUT/DELETE の route に表名を結び付ける)。duplicate_verdicts と freee_deal_exclusions はこの 4 箇所のどれにも無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD 1b16825) の import-active.ts・import-lifecycle.ts・store.ts・canonical-mutation-fence.ts を grep と sed で読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 / 回答時刻: 2026-09-15T14:04:19Z)

#### 裏付け質疑: `qa-infrastructure-web-tc-observed-004`

**問**

0040 (cd470e3) で review_snoozes と monthly_close_reviews をバックアップと復元に加えたとき、qa-infrastructure-web-tc-observed-003 の 4 箇所の外で変わった箇所はあるか。総収支の書込み route は同じ仕組みにつながっているか。

**答**

ある。cd470e3 の packages/api の変更は 4 箇所の外に 3 系統ある。(5) packages/api/src/routes/imports.ts: 復元 payload の zod 検証 (reviewSnoozesBackupSchema / monthlyCloseReviewsBackupSchema)、resolveRestoreReviewState (key が無い旧バックアップは null を返して既存の行を残し、key があれば空配列でもその集合で置き換え、形が不正なら InvalidRestoreSettingsError で復元全体を拒む)、復元への受け渡しと reviewStateCounts。key は camelCase なので表名の grep では見つからない。(6) 書込み route からの invalidateJsonSnapshotQuery の呼出し (routes/analytics.ts の保留と月次レビューの PUT/DELETE)。consumer 引数は JSON_SNAPSHOT_MUTATION_CONSUMERS の型に縛られ、列挙外の表では呼べない。(7) schema-guard.ts の EXPECTED_D1_MIGRATION と deletion-schema.test.ts の期待値。現行の routes/total-cashflow.ts の書込み (POST /total-cashflow/verdicts・POST と DELETE /total-cashflow/freee-exclusions) は invalidateJsonSnapshotQuery を呼ばず、canonical-mutation-fence.ts にも登録されていない。qa-infrastructure-web-tc-observed-003 の『4 箇所』は前例の変更の一部だけを数えていたので、本記録で補う。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD 1b16825) で git show --stat cd470e3、routes/imports.ts 218〜245 行、import-active.ts の invalidateJsonSnapshotQuery、canonical-mutation-fence.ts、schema-guard.ts、routes/total-cashflow.ts の書込み route を読んで確認した観測事実。完成度評価 (C05) 5 回目の medium 指摘を受けて数え直した。answered_at は確認直後に date -u で実測した時刻。 / 回答時刻: 2026-09-15T14:26:23Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 判定と除外の操作を D1 に記録し元に戻せるようにする。freee 除外は理由区分 (振替/内部移動/帳簿のみ/二重登録/その他) とメモに分けて一括設定でき、既存の自由記述理由は失わずに移行する。判定・除外・戻すの操作履歴を残し、画面を開いてから行った操作を新しい順に取り消すと総額が操作前と一致し、同じ取消の再送や古い表示からの取消で意図しない操作を戻さない。再読込後は取り消せない (操作履歴は残る)。判定・除外・操作履歴はバックアップに含め、復元しても戻る。
- **G5**: 一致度・判定作業の区分・自動一致の候補の扱いを単純で説明可能な規則として docs に明記しテストで固定する。日付と金額が一致する組は既存どおり自動で freee 正本へ寄せ、一覧は確認用で『同じ取引にする』は same 判定の記録だけとし総額を変えない。共通ヘッダー/フッターの文言 (防衛ライン・毎朝バックアップ等) を画像に揃え、サイドバーは支出分析 > 総収支 の現在地と照合の件数バッジが表示されることを確認する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 除外理由区分とメモ、操作履歴と取消が永続化される。 | migration 適用後に既存除外の理由がメモへ保持され、取消 API の統合テストで操作前後の総額が一致し、同じ取消の再送や古い表示からの取消で意図しない操作が戻らず、再取込後も判定が再適用され、バックアップから復元すると判定・除外・操作履歴が復元時点に戻る。 |
| O5 | 規則が docs とテストで固定され、既存の検査が緑のままである。 | 一致度・区分・自動一致の規則が docs に記載され、pnpm test / typecheck / lint と packages/web の check 系スクリプトが全て緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I5**: freee から除外した明細一覧に理由区分バッジ・メモ・集計へ戻す・全選択/選択クリア/一括で理由を設定 を置く。
- **I6**: 自動一致の候補 (日付と金額の一致で自動に寄せた組) 一覧にソースフィルタ・全選択・一致度・『選択した取引を同じ取引にする』を置き、確定は same の記録だけで総額を変えない。
- **I8**: core に総収支のセグメント別集計・前期比較・判定作業の区分・一致度関数を追加し、API が 1 回で返す。一括判定と取消の API を足す。
- **I9**: D1 に freee 除外の reason_code と memo を足し既存 reason を memo と『その他』へ移し、判定・除外・戻すの操作履歴テーブルを作って画面を開いてから行った操作の取消を、同じ取消の再送や古い表示から意図しない操作を戻さない形で実装する。判定・除外・操作履歴の 3 表をバックアップと復元の対象に加える。
- **I10**: 一致度 (金額・日付差・口座・摘要の各要素から算出)、判定作業の 3 区分、自動一致の扱いを docs に書き、境界値テストで固定する。
- **I11**: 共通ヘッダー/フッターの文言を画像に揃え、サイドバーの支出分析 > 総収支 の現在地と照合バッジを DOM テストで確認する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『規則は名前と境界値テストで読めるようにする』を、総収支の判定規則の保守に適用した。一致度の配点 (金額 40・日付 30/20/10/5/0・口座 15/8/0・摘要 15/8/0)、3 区分の境界、前年同期比の null 規則、取消の対象範囲を docs と core の単体テストで固定し、数値は名前付き定数にする (qa-backend-web-tc-inference-006)。テストは境界値 (日付差 3 日と 4 日、候補 1 件と 2 件、前年同期の月が 1 か月欠ける場合、続けて 2 回取り消す場合、同じ操作 id を 2 回送る場合、古い id を送る場合、唯一の候補を除外した月ずれ明細が要確認から出る場合、除外の前後で事業/家計の内訳が入れ替わる場合、自動一致の組で摘要だけが違う場合) を持ち、旧実装では落ちる形にする。文言変更 (防衛ライン・毎朝バックアップ) は、その文言を期待値に持つテストがあれば同じ変更で更新する (qa-total-cashflow-decision-010)。判定・除外・操作履歴の 3 表をバックアップと復元の対象に加え (qa-total-cashflow-decision-018)、0040 の前例が触れた全ての箇所 (consumers の列挙・復元 write-set・スナップショット SQL と件数・fence・復元 payload の検証・route の無効化・schema-guard) に揃え、復元テストで 3 表が復元時点へ戻ること、key の無い旧バックアップでは既存の行が残ることを固定する (qa-infrastructure-web-tc-observed-003/004・qa-database-web-tc-inference-006)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T14:26:23Z)

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-15T12:11:33Z | 2026-09-15T12:11:33Z |
