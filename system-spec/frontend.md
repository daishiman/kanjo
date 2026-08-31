---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G3, G5, G6, G7, G8, G9, G10, G11]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-020 / 確定質疑: qa-mobile-frontend-001 |
| モバイル (mobile) | 確定 | 確定質疑: qa-mobile-frontend-001 |
| タブレット (tablet) | 確定 | 確定質疑: qa-mobile-frontend-001 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 / 理由: 承認: appr-mobile-platform-001 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 / 理由: 承認: appr-mobile-platform-001 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 / 理由: 承認: appr-mobile-platform-001 |

## 適用された設計知識

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

### Information Design (表現物の情報設計) — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/information-design.md`

#### 目的

保持しているデータを、受け手が**その利用文脈で最短の認知コストで目的を達成できる形**へ翻訳する。「見た目を良くする」ことではなく、情報の意味的な順序付け・取捨選択・加工を設計判断として明示し、視覚表現をその写像として導出できる状態にする。

#### 解決する問題

- 保存形式 (DB の値・API のフィールド) をそのまま表示形式として採用し、受け手が頭の中で変換させられる (生年月日を見せて年齢を計算させる、絶対日時を見せて「何日前か」を計算させる)。
- 全要素が同じ大きさ・同じ濃度で並び、どこから見ればよいか分からない (強弱の欠如)。
- ラベル・罫線・説明文など「無くても伝わる要素」が削られず、本体の情報を圧迫する。
- 最初に一つの形式 (表・リスト・箇条書き・JSON ダンプ) を作ってしまい、他の形式との比較機会が失われる (早期形式固定)。
- 装飾が「今風に見せる」ために使われ、操作可能性・状態・重要度といった意味を運んでいない。
- 情報の物理的な近さがグループの意味と一致せず、無関係な要素が隣接して誤読を生む。
- 「設計」と「デザイン」を別工程・別担当に分割し、前工程の出力が後工程の到達可能な品質の上限を決めてしまう。

#### 適用条件

- 人間が読む表現物を生成・レビューするとき (UI 画面、report、slide、ダッシュボード、CLI 出力、通知、エラーメッセージ、仕様書)。
- 出せる情報量が受け手の一度に処理できる量を上回り、取捨選択が避けられないとき。
- 受け手と利用文脈が一つに定まる、または文脈ごとに別表現を作る余地があるとき。

#### 非適用条件

- 機械が消費する成果物 (JSON/DB スキーマ/ログの構造化フィールド) — ここでは網羅性・安定性・後方互換が優先し、削減や加工はむしろ有害。
- 監査・法定表示・原本性が要件で、**元の値をそのまま**提示する義務があるとき (加工は併記に留める)。
- 習熟した専任者が長時間・大量に操作する高密度業務画面。一覧性と一括操作の効率が学習容易性より重い場合、表形式・高密度・等価表示が正解になりうる (Nielsen のユーザビリティ 5 指標のうち efficiency を優先する状況)。
- 探索的な使い捨て成果物で、寿命が短く投資が回収できないとき。

#### トレードオフ・失敗モード

- **学習容易性 ⇄ 効率性**: 情報を削って強弱を付けるほど初見は分かりやすくなるが、熟練者の一覧性・一括操作は落ちる。どちらを取るかは context of use が決めるのであって、原則が決めるのではない。
- **加工 ⇄ 検証コスト**: 表示値を加工するほど元データとの突合テストが増える。加工の各件に「どの task を助けるか」を書けないなら加工しない。
- 優先順位付けを飛ばしたまま視覚変数だけ調整し、「なんとなく今風」だが読み順が崩れた表現物を作る (最頻の失敗)。
- 削減を進めすぎて、文脈を持たない受け手が識別できなくなる (会員 No. のラベルまで落とす等)。削減の停止条件は「ラベルなしで受け手が識別できるか」。
- 「シンプルにする」を目的化し、必要な状態表示・エラー理由・可逆性の手がかりまで削る。
- 原則を checklist 化して機械適用し、非適用条件 (高密度業務画面・監査表示) に当てはめて品質を落とす。
- 強弱を色だけで表現し、色覚特性・モノクロ印刷・低コントラスト環境で情報が消える。

#### goalへの寄与

- 要件定義段階で「この表現物の受け手・task・優先順位」を宣言させることで、実装後の主観的な「なんかダサい」を**設計判断への差し戻し**に変換できる (レビューが好みの表明でなくなる)。
- 順位・グループ・削除理由・加工理由が構造化データとして残るため、生成 AI・人間のどちらが作っても同じ根拠で検証できる。決定論ゲート (`../../../scripts/validate-information-priority.py`) が手順の順序制約 (装飾より前に順位が確定していること) を機械検査する。
- 成果は「見た目の評価」ではなく outcome で測る: 目的達成までの操作数・初見での到達率・誤操作率・問い合わせ件数。装飾の量では測らない。

---

### モーダル表示前スクリーンショットの順序保証と診断リングバッファ

- project candidate: `frontend-capture-before-modal-open` (`deepened`)
- 解決対象: 確定セル frontend×web (qa-020) の要件『撮影された画像に、その押下で開くモーダルの DOM が含まれない』『改善要望ボタンを押す前に発生した失敗が診断情報に含まれる』を、除外規則やモーダル open 時収集といった網羅性依存の方式では満たせない。

#### 目的

汎用カードが述べる『非同期処理の順序は制御構造で固定する』という原則を、本仕様の確定要件 D5 (opt-dom-capture-before-open) と D8 (opt-always-on-ring-buffer) へ具体的に適用する。

#### 解決する問題

- 撮影対象からモーダルを除外リストで外す方式は、将来モーダル外へ描画されるトースト・ポータルを取りこぼす (除外規則の網羅性に依存する)
- モーダル open 時に診断収集を開始する方式は、押下より前に起きた未捕捉例外を1件も含められない
- 上限を件数だけで課すと1件が巨大なケースが、バイト数だけで課すと小さい大量のケースが漏れる
- SVG `<foreignObject>` を `<img>` 経由でラスタライズすると描画は t=0 に固定される。`animation: page-in ... both` のような開始状態 opacity:0 の規則が本文へ効いていると、本文が透明のまま焼き付く (利用者報告 2026-08-30 の『サイドバーとヘッダーしか写らない』の原因)

#### 適用条件

- acceptance『改善要望ボタン押下で撮影された画像に、その押下で開くモーダルの DOM が含まれない』: capture() の Promise を await し終えてから open=true にする。この1行の順序が受入条件そのものである
- acceptance『撮影中はボタンが押下不可で、待機していることが画面に出る』: await 区間は必ず可視化する。無反応に見える待機は二重押下を誘発する
- acceptance『押す前に発生した未捕捉例外・unhandledrejection・console error/warn・失敗した通信が診断情報に含まれる』: window error / unhandledrejection の購読をアプリ起動時に張る
- acceptance『件数上限または総バイト上限を超えたとき、切り詰められたうえで省略件数が保存され画面にも出る』: リングバッファの押し出し時に省略件数を加算する
- acceptance『撮影された画像に、そのとき見えていた本文が写る』: 全アニメーション/トランジションを止める規則を、複製したページ CSS より**後ろ**へ置く。順序が逆だと詳細度に関わらず負ける。この順序自体をテストで固定する
- acceptance『起動導線は撮影対象に写らない』: 除外は `data-capture-hide` を付けた要素だけに限定する。モーダルの除外は依然として順序 (開く前に撮る) で保証し、リストへ足さない

#### 非適用条件

- Screen Capture API 経由の画面共有ダイアログを挟む方式 (scope_out)。報告のたびに利用者操作が増え、日常導線として成立しない
- 外部エラートラッキング SaaS への常時送出 (scope_out)。記帳内容に由来しうる情報を第三者へ渡し G11 と衝突する
- web 以外のプラットフォーム。mobile/tablet/desktop は appr-002 で全カテゴリ対象外

#### トレードオフ

- await を挟むぶんモーダルの表示が遅れる。この遅延は待機表示で受け止め、撮影失敗時は待たせ続けずモーダルを開く
- 常時収集はメモリを占有する。件数と総バイトの二重上限がその代償を有界にする

#### 失敗モード

- 撮影失敗を投稿の失敗として扱ってしまい、報告そのものが届かなくなる (acceptance で明示的に禁止)
- 省略件数を記録せず黙って捨て、受け取った側が『これで全部』と誤解する
- await を忘れた変更が入っても既存テストが緑のままになる (順序を固定するテストが必要)
- 撮影結果を『画像が生成されたか』だけで判定し、中身が透明であることを検知できない (CSS の適用順を固定するテストが必要)
- `data-capture-hide` を除外の一般手段として使い始め、モーダル除外までリスト依存へ退行する

#### goalへの寄与

G9 (画面から離れず、見えていた画面と起きていた不具合ごと届ける) の中核。写り込みのない画像と押下前の失敗記録の両方が揃って初めて G10 (エージェントがそのまま着手できる証跡) が成立する。二重上限は G11 (最小範囲) を構造的に支える。

---

### responsive financial chart container

- project candidate: `responsive-financial-chart-container` (`deepened`)
- 解決対象: Chart.jsのresponsive描画が狭幅や親要素寸法の変化で0寸法・過小表示にならず、視覚表現と意味表現を同期させる必要がある

#### 目的

Chart.jsのcanvasを全対象viewportで可視寸法に保ち、同一の既存API集計結果から視覚表現と読み上げ可能な意味表現を生成する。

#### 解決する問題

- gridやflexの最小内容幅でchart containerが縮まずページ全体を横あふれさせる
- 親高さ未確定や非表示切替のタイミングでcanvasが0寸法になりfigureが存在しても読めない
- canvasと代替表が別計算だと金額・符号・期間の不一致を起こす

#### 適用条件

- react-chartjs-2で財務seriesを360px、375px、390px、tablet、desktopへ描画するとき

#### 非適用条件

- 静的な単一値や短いKPIはcanvasを導入せずsemantic HTMLだけで表現する

#### トレードオフ

- 狭幅でchart高さを確保すると縦スクロールは増えるが、情報欠落より可逆であり要約と段階表示で負荷を抑える

#### 失敗モード

- canvas要素へ相対サイズを直接指定して親containerのresponsive contractを持たない
- ラベル重なりを避けるため主要seriesや期間情報を削除する
- snapshotやCSS文字列検査だけで実際のcanvas寸法を確認しない

#### goalへの寄与

- G1へは全figureの可視寸法と主要series保持で寄与する
- G2へはtick間引き・legend再配置・結論要約で寄与する
- G3へはcanvas非依存のsemantic tableとkeyboard/zoom対応で寄与する
- G4へは匿名fixtureの実Chromeでfigure数・bounding box・意味情報同等性を固定して寄与する

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| mdn-canvas-toblob | 2026-02-12 | Mozilla (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| mdn-screen-capture-api | 2026-05-21 | Mozilla (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API/Using_Screen_Capture | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| mdn-window-error-event | 2026-08-21 | Mozilla (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| mdn-unhandledrejection-event | 2026-07-28 | Mozilla (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| html2canvas | 1.4.1 | niklasvh (html2canvas project) (github.com) | https://github.com/niklasvh/html2canvas | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
| chartjs-responsive-charts | 4.x latest documentation | Chart.js Project (www.chartjs.org) | https://www.chartjs.org/docs/latest/configuration/responsive.html | 2026-08-30T08:58:25Z | 2026-08-30T08:58:25Z |
