---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed`

## U1 本質的目的 (essential_purpose)

正式採用された FINAL-UI (Focus Ledger, design/FINAL-UI の 20 画面) を見た目の正本とし、色・文字・余白・角丸・影・動き・部品・共通シェル・図の見た目を単一の共通定義へ集約する。今後つくる画面・図・成果物が個別に色や寸法を決めなくても、共通定義を参照するだけで自動的に同じ見た目になり、ずれた値を持ち込めば機械的に検出される状態にする。

## U2 背景 (background)

kanjo の web SPA (packages/web) は FINAL-UI 以前の HTML 版トークンを移植した styles.css の :root を持つが、同じ色の値を持つ場所が 3 つあり、一部がずれている。(1) packages/web/src/styles.css の :root (--primary #14353d, --warn #805a12, --good #2e7d5b 等) が画面の色の正本である。(2) packages/web/src/components/charts.ts は getComputedStyle でその CSS 変数を読むが、CSS を読めない環境向けの予備値 COLOR_FALLBACKS を直書きしており、その値が CSS とずれている (ink #1d2a2c 対 #15262b、biz #2f5da8 対 #087f78、line #dde3e1 対 #d7e0e2 等)。CSS 変数を持たない neutral と VENDOR_EXTRA_COLORS は直書きのみ。(3) skills/report-design-system/assets/report.css (会計レポート用、brand #1d63be の青系) は別の配色を持つ。2026-09-10 に FINAL-UI 20 画面と共通デザインシステム仕様 (design/FINAL-UI/spec/DESIGN-SYSTEM.md: 背景 #F6F8F9 / 面 #FFFFFF / 境界 #D7E0E2 / 文字 #15262B / 補助 #617177 / ネイビー #14353D / ティール #087F78 / 注意 #B97000 / 危険 #B33A3A / 成功 #247A52、サイドバー 220px、ヘッダー 64px、本文最大幅 1180px、角丸 8px、操作対象 44px 以上) が正式採用された。利用者は 2026-09-13 に、これを元に全体の構成と色を抽出し、ボタン・サイドバー・ヘッダー・各図・文字フォント・構成をすべて共通化して今後のすべての作成物に反映される形に整えること、まずは大まかな全体像をつくることを依頼した。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。和文は OS の system-ui、金額・数値は自己配信する IBM Plex Mono Latin 400/600 だけを使い、全非 test source・dependencies・外部フォントURLの検査でこの配信契約を固定する。 |
| G2 | route registry由来の20ルートを共通Layout/PageShellで描画する。標準操作はButtonを通し、固定アクション群を持つ画面はPageActionsを使う。ARIA固有controlはnative buttonの明示例外とする。 |
| G3 | チャート (棒・線・内訳バー・凡例・軸・グリッド・ツールチップ) の配色と描画規約を 1 つにし、全ての図が共通トークンから色を得る。系列の意味色は FINAL-UI に合わせ、収入=青系、支出=赤系、純収支=ティールの線とする。 |
| G4 | 今後の作成物が自動的に規約へ従うよう、トークン定義以外での色の直書きと、正本と写し (CSS 変数・チャート色) のずれを lint で機械検出し、使い方を規約文書として置く。 |
| G5 | 文字と部品は WCAG 2.2 AA のコントラスト (文字 4.5:1、部品を見分ける境界・図形 3:1) を維持する。FINAL-UI の値がこれを満たさない場合は役割を分けて両立させる: 塗り・アイコン・バッジ面には画像どおりの値、文字にはその色相で 4.5:1 を満たす派生色を使う。境界は、カード区切りや表の罫線などの装飾罫線には画像どおり #D7E0E2 (1.4.11 の対象外)、入力欄・チェックボックスなど部品を見分ける枠には同じ色相で 3:1 を満たす派生色を使う。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | packages/core/src/design-tokens.ts に色・文字・余白・角丸・影・動き・寸法のトークンを定義し、値の唯一の実装正本とする。 | 単体テストは schema・役割集合・alias・コントラストに必要な関係不変条件を値の転記なしで検査する。表示に影響する全トークン値は、版・外部承認状態・由来ファイルを持つ `docs/design-system/token-approval.json` の SHA-256 fingerprint と lint で照合し、machine integrity baseline に未登録の値変更を拒否する。lint の成功は人間承認を意味せず、release には同じ approval subject digest に対する独立した外部人間承認を必須とする。 |
| O2 | styles.css の :root トークンと charts.ts の COLORS を design-tokens.ts から導出した写しに置き換え、写しのずれと色構文の直書きを検出する lint を組み込む。 | pnpm lint が写しの不一致またはhex/rgb/hsl/CSS Color構文の未許可リテラルで exit 非0になり、一致時に exit 0 になる。 |
| O3 | Layout (サイドバー・ヘッダー・フッター)・PageShell・PageActions・Button (主/副/危険/テキスト) を共通部品として定義する。route registry由来の20ルートは共通シェルとPageShellを経由し、標準の主・副・危険・submit操作はButtonを使う。ARIA固有controlはnative buttonの明示例外とする。 | route registryから導出するDOMテストが全ルートのランドマークとPageShellを検査し、静的検査が標準variant/submitを直接所有するnative buttonを拒否する。 |
| O4 | 文字・部品の枠・チャート系列に使う全トークンの、背景/面に対するコントラストを計算するテストを置く。 | 文字用トークンは背景 #F6F8F9 と面 #FFFFFF の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色は 3:1 以上であることをテストが検証し、基準未満の値を入れると落ちる。装飾罫線トークン (#D7E0E2) は 1.4.11 の対象外として検査から外し、入力欄・チェックボックスの枠が装飾罫線トークンを参照していないことを同じテストで確かめる。 |
| O5 | トークンと共通部品の使い方を規約文書 (docs 配下) にまとめ、新しい画面・図をつくるときの参照先を 1 つにする。 | 規約文書が色の役割 (塗り/文字の分離)・タイポグラフィ・余白・シェル・ボタン・チャートの各節を持ち、README または AGENTS.md から参照されている。 |

## U5 成功基準 (success_criteria)

- S1 (G1, G4): packages/web/src の .ts/.tsx/.css において、トークン定義とその生成物以外での hex/rgb/hsl/CSS Color構文による色の直書きが 0 件であり、lint がこれを検査する。
- S2 (G3): charts.ts と全ての実描画consumerの系列色・軸・グリッド・文字色がdesign-tokens.ts由来で、収入=青系・支出=赤系・純収支=ティール線になっている。
- S3 (G1): design-tokens.ts を唯一の実装正本とし、schema・関係不変条件を単体テスト、machine integrity baseline の fingerprint と CSS/charts consumer の一致を lint が検査する。人間承認は `pending-external` の独立release条件としてlintから分離する。
- S4 (G5): 文字用トークンのコントラストが背景と面の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色が 3:1 以上である。装飾罫線 (#D7E0E2) は 1.4.11 の対象外で、部品の枠には使われていない。
- S5 (G2): route registry由来の20ルートすべてが共通PageShell (サイドバー 220px・ヘッダー 64px・フッター) の下で描画される。
- S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (thead / mobile-layout / financial-figure / financial-routes) が全て緑のままである。

## U6 ステークホルダー (stakeholders)

- SH1 利用者 (単独の個人事業主): 画面ごとに色・ボタン・図の見た目が揃い、FINAL-UI の画像どおりの落ち着いた見た目で月次クローズを進められること。文字が読みにくくならないこと。
- SH2 保守者 (同一人物、および Claude Code などのコーディングエージェント): 新しい画面や図をつくるとき、色や寸法を自分で決めずに共通定義を参照するだけで済み、ずれた値を持ち込めば lint が教えてくれること。

## U7 スコープ (scope)

- **対象 (in)**: design/FINAL-UI の画像と DESIGN-SYSTEM.md からの色・構成・タイポグラフィ・寸法の抽出, packages/core へのデザイントークン正本 (依存ゼロの TypeScript) の新設, styles.css の :root トークンと charts.ts の COLORS をトークン正本から導出する形への置換と、写しのずれ検出 lint, サイドバー・ヘッダー・共通フッター・固定アクションバー・ページ骨格・ボタンの共通部品化と、既存 20 画面からの参照, チャート配色と描画規約の統一, 色の直書き検出と、文字・部品の枠・チャート系列のコントラスト検証のテスト, トークンと共通部品の使い方を示す規約文書
- **対象外 (out)**: 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル), 新機能の追加, API・データベースの変更, ネイティブアプリ (スマートフォン・タブレット・デスクトップ), ダークテーマ, Web フォントの追加 (system-ui 系の和文ゴシックと既存の IBM Plex Mono を維持し規約化する), 会計レポート用 report-design-system (report.css / report-css.ts) の配色移行と、その 2 ファイルの変更 (次サイクル。今回はトークン正本を依存ゼロの packages/core に置くことで、レポート側から同じ値を import できる前提だけを用意する)

## U8 制約 (constraints)

- C1: packages/core は依存ゼロの純関数・純データに保つ (README アーキテクチャ節)。トークン正本はランタイム依存を持たない TypeScript の定数として置く。
- C2: 初期 JS 予算 (packages/web の check:js-budget) を超えない。トークン導入で追加の外部ライブラリを入れない。
- C3: 新しいWebフォントと外部フォントURLを追加しない。和文は system-ui 系ゴシック、金額・数値は既存の IBM Plex Mono Latin 400/600 だけを `@fontsource/ibm-plex-mono` から自己配信する。それ以外の subset / weight はビルドに含めず、`font-family: var(--font-mono)` を使う rule は 400 または 600 を明示する。
- C4: WCAG 2.2 AA を下回らない。文字 4.5:1、図形・UI 部品 3:1。FINAL-UI の注意色 #B97000 は白い面で 3.90:1 のため文字には派生色を使う (利用者決定 2026-09-13『役割で分ける』)。画像から実測したチャート系列色 (収入 #599AE9 は 2.91:1、支出 #EB9099 は 2.34:1) は色相を保ったまま明度を 3:1 以上へ調整する。 境界色 #D7E0E2 は白い面で 1.34:1 のため、装飾罫線にだけ使い、部品を見分ける枠には同じ色相で 3:1 を満たす派生色を使う (利用者決定 2026-09-13『役割で2つに分ける』)。
- C5: 既存の prefers-contrast: more の上書きと、狭幅のドロワー・下部タブ (tabbar) の挙動を壊さない。
- C6: CI の headless Chrome は pointer:none として振る舞うため、ポインタ種別に依存する見た目の分岐を新設するときは否定形の 2 段で書く。
- C7: 表示値は匿名・架空のサンプルに限り、実データを成果物・テスト・画像に含めない (guard-real-data)。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | 新しい画面をつくるとき、色・余白・角丸・文字サイズを design-tokens から選ぶだけで FINAL-UI と同じ見た目になる。 | G1, G4 |
| I2 | どの画面を開いても、左に同じネイビーのサイドバー (220px)、上に同じヘッダー (64px・期間 1年/2年/3年/任意)、下に同じフッターが出る。 | G2 |
| I3 | 月次の収入・支出・純収支の図は、どの画面でも収入が青い棒、支出が赤系の棒、純収支がティールの線で描かれる。 | G3 |
| I4 | 誰かが画面のコードに #xxxxxx の色を直書きしたら、pnpm lint が落ちて共通トークンを使うよう促す。 | G4 |
| I5 | 注意 (アンバー) の表示は、バッジやアイコンの塗りは画像どおりの色で、文字は読みやすい濃さで出る。表の罫線は画像どおり淡く、入力欄の枠は見分けられる濃さで出る。 | G5 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-design-system-002`

上位概念の改訂承認。基底は appr-foundation-design-system-001 で、利用者は上位概念 U1-U9 の要約に『この内容で承認』を選んだ (会話記録上の回答返却時刻 2026-09-13T04:54:53Z。001 の note が根拠にした reopened_at は現行 state に実在せず、この実測時刻へ付け替える)。本改訂の変更点は 3 つで、いずれも利用者の意図を変えない: (1) 利用者決定 qa-ui-ux-web-ds-decision-007 (2026-09-13、境界を『役割で2つに分ける』を選択) を G5 / O1 / O4 / S3 / S4 / C4 / I5 と scope.in に反映し、完成度評価が指摘した O1/S3 (境界 #D7E0E2 に一致) と O4/S4 (境界 3:1) の矛盾を解いた。(2) U2 背景の charts.ts の記述を、アシスタントの観測誤り (CSS 変数を読めない) から実装どおり (getComputedStyle で読み、予備値だけが直書きでずれている) へ訂正した (qa-frontend-web-ds-observed-005)。(3) C3 の『現行フォントを維持する』決定を、全非 test source と dependencies の再調査で確定した実装事実に合わせ、和文は system-ui、金額・数値は既存の IBM Plex Mono Latin 400/600 だけを自己配信すると明記した。scope.out の report-design-system の扱いも章間で揺れない 1 文へ揃えた。個別の選択は 1 つの note に束ねず、論点ごとの qa (decision-004 色の役割 / -005 フォント / -006 範囲 / -007 境界 / frontend decision-004 トークン正本 / maintenance-ops decision-002 report-design-system) に提示選択肢付きで記録してある。改訂の要約全体を改めて承認質問にかけてはいない。basis=user-decision (変更 1) と observed-fact (変更 2・3)。記録時刻 2026-09-13T07:58:19Z。2026-09-14 に変更点 (3) の観測事実だけを訂正。


## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| dec-design-token-source | デザイントークンの正本をどこに置くか | confirmed | core-ts:packages/core の design-tokens.ts を正本にし、CSS 変数とチャートの予備値を生成する / cost={'category': 'free', 'amount': 0, 'notes': 'OSS と既存ツールチェーンだけで実装でき、追加の費用は発生しない', 'currency': 'JPY', 'billing_period': 'none', 'tco': '追加費用 0。保守は既存 CI (pnpm lint / vitest) の実行時間内に収まる'} / free=該当なし (ライブラリ・サービスを追加しない) / fit=G1 の『依存ゼロの TypeScript 1 か所』に直接合う。テスト (O1・O4) が CSS を解析せず値を import でき、次サイクルでレポート側からも同じ値を import できる / pros=テストとレポートが型付きで同じ値を読める, charts.ts の予備値の直書きを 0 件にできる / cons=CSS 変数を生成する工程か、写しの一致を検査する lint が要る, 既存の report-css は CSS→TS の向きで、正本の向きが逆になる / risks=生成物を手で編集されると正本と写しがずれる (lint で検出する前提) / lock-in=低い。値は平文の定数で、生成方向を後から逆にできる / ops=lint スクリプト 1 本の保守 / evidence=https://www.chartjs.org/docs/latest/general/colors.html, https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html<br>css-root:styles.css の :root を正本に維持し、予備値のずれを lint で塞ぐ / cost={'category': 'free', 'amount': 0, 'notes': 'OSS と既存ツールチェーンだけで実装でき、追加の費用は発生しない', 'currency': 'JPY', 'billing_period': 'none', 'tco': '追加費用 0。保守は既存 CI (pnpm lint / vitest) の実行時間内に収まる'} / free=該当なし (ライブラリ・サービスを追加しない) / fit=現行の charts.ts の設計 (getComputedStyle で CSS 変数を読む) をそのまま使え、変更が最小。ただし G1 の『TypeScript 1 か所』とは合わず、テストは CSS を解析して値を得る / pros=変更が最も少ない, report-css と同じ CSS→TS の向きで揃う / cons=CSS を持たない成果物やテスト (jsdom) では値を取りにくい, 予備値は結局 TS に残るため、lint で一致を見続ける必要がある / risks=CSS 解析に頼るテストは記法の変更で壊れやすい / lock-in=低い / ops=lint スクリプト 1 本の保守 / evidence=https://www.chartjs.org/docs/latest/general/colors.html | core-ts — G1 と O1・O4 の検証を CSS の解析なしで書け、次サイクルのレポート配色移行でも同じ値を import できる。実行時の図の色の読み方 (getComputedStyle) は変えず、ずれている予備値だけを正本から取るので、現行実装の利点を保ったまま直書きを 0 件にできる。 (注意: 既存 report-css の検査は CSS→TS の向きで、正本の向きが逆になる。規約文書で向きを明記する, 推奨を提示した時点 (2026-09-13T04:39Z) では、判断材料のコード観測記録に Chart.js が CSS 変数を読めないという誤記があった。選択肢 2 の説明文は実装どおりだった; confidence=medium; checked=2026-09-13T05:06:15Z) | core-ts @ 2026-09-13T04:54:53Z | G1, G3, G4 |
| dec-border-color-roles | 境界色 #D7E0E2 (白に 1.34:1) を、WCAG 2.2 の 1.4.11 とどう両立させるか | confirmed | split-roles:装飾罫線は #D7E0E2、部品を見分ける枠は 3:1 の派生色 / cost={'category': 'free', 'amount': 0, 'notes': 'OSS と既存ツールチェーンだけで実装でき、追加の費用は発生しない', 'currency': 'JPY', 'billing_period': 'none', 'tco': '追加費用 0。保守は既存 CI (pnpm lint / vitest) の実行時間内に収まる'} / free=該当なし / fit=G5 の役割分離を境界へ広げ、画像の淡い罫線と部品の枠の 1.4.11 を両立する / pros=表やカードの見た目が画像どおり, 入力欄・チェックボックスの枠が 3:1 を満たす / cons=境界トークンが 2 つになり、使い分けの規約が要る / risks=部品の枠に装飾罫線トークンを使う誤用 (O4 のテストで検出する) / lock-in=低い / ops=トークン 1 つとテスト 1 項目の追加 / evidence=https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html<br>all-3to1:すべての境界を 3:1 以上にする / cost={'category': 'free', 'amount': 0, 'notes': 'OSS と既存ツールチェーンだけで実装でき、追加の費用は発生しない', 'currency': 'JPY', 'billing_period': 'none', 'tco': '追加費用 0。保守は既存 CI (pnpm lint / vitest) の実行時間内に収まる'} / free=該当なし / fit=G5 は単純に満たすが、FINAL-UI の落ち着いた見た目 (正本) から離れる / pros=規約が 1 つで単純 / cons=画面全体の線が画像より濃くなり、数字と線が競合する / risks=FINAL-UI を正本とする U1 と食い違う / lock-in=低い / ops=最小 / evidence=https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html<br>all-image:すべて画像どおり #D7E0E2 / cost={'category': 'free', 'amount': 0, 'notes': 'OSS と既存ツールチェーンだけで実装でき、追加の費用は発生しない', 'currency': 'JPY', 'billing_period': 'none', 'tco': '追加費用 0。保守は既存 CI (pnpm lint / vitest) の実行時間内に収まる'} / free=該当なし / fit=見た目は画像に一致するが、G5 の部品 3:1 を外すことになる / pros=見た目が完全に画像どおり / cons=入力欄などの枠が 1.4.11 を満たさない / risks=低視力の利用時に入力欄の範囲が見分けにくい / lock-in=低い / ops=最小 / evidence=https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html, https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | split-roles — 1.4.11 は部品を識別するのに必要な視覚情報に適用され、装飾だけの罫線は対象外である。そのため罫線は画像どおりに残し、部品の枠だけを加工すれば、U1 (FINAL-UI を正本) と G5 (AA 維持) を同時に満たせる。 (注意: 派生色 #7F9095 は背景 #F6F8F9 で 3.12:1 と余裕が小さい。背景色を変えるときは再計算する, 入力欄が塗りなど別の手段で識別できる場合の扱いは規約文書で明記する; confidence=high; checked=2026-09-13T05:06:15Z) | split-roles @ 2026-09-13T07:48:43Z | G5, G1 |
